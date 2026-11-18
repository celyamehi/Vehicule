import { Injectable } from "@nestjs/common";
import {
  agences,
  categoriesVehicule,
  photosVehicule,
  pointsRetrait,
  tarifs,
  vehicules,
} from "@lvb/db";
import { type TarifPourCalcul, joursFactures, type schemas } from "@lvb/shared";

type RechercheParams = schemas.RechercheParams;
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { type Base, InjectBase } from "../base.js";
import { ErreurApi, introuvable } from "../commun/erreur-api.js";
import { Stockage } from "../fichiers/stockage.js";
import { ReservationsService } from "../reservations/reservations.service.js";

type LigneRecherche = {
  id: string;
  agence_id: string;
  categorie_id: string;
  categorie: string;
  marque: string;
  modele: string;
  annee: number;
  boite: string;
  carburant: string;
  places: number;
  options: Record<string, boolean>;
  km_inclus_par_jour: number | null;
  raison_sociale: string;
  score: number;
  note_moyenne: number | null;
  nombre_avis: number;
  slug: string | null;
  agence_wilaya: number;
  politique_annulation: string;
  age_minimum: number;
  point_id: string;
  point_nom: string;
  commune: string;
  point_adresse: string;
  lat: number | null;
  lon: number | null;
  distance_m: number | null;
};

const STATUTS_BLOQUANTS_SQL = sql.raw(
  `('en_attente_paiement','en_attente_agence','confirmee','en_cours')`,
);

@Injectable()
export class RechercheService {
  constructor(
    @InjectBase() private readonly db: Base,
    private readonly reservations: ReservationsService,
    private readonly stockage: Stockage,
  ) {}

  private async tarifsParVehicule(
    lignes: { id: string; agence_id: string; categorie_id: string }[],
  ) {
    if (!lignes.length) return new Map<string, TarifPourCalcul[]>();
    const tous = await this.db
      .select()
      .from(tarifs)
      .where(
        and(
          eq(tarifs.actif, true),
          inArray(tarifs.agenceId, [...new Set(lignes.map((l) => l.agence_id))]),
          or(
            inArray(
              tarifs.vehiculeId,
              lignes.map((l) => l.id),
            ),
            inArray(tarifs.categorieId, [...new Set(lignes.map((l) => l.categorie_id))]),
          ),
        ),
      );
    return new Map(
      lignes.map((l) => [
        l.id,
        tous
          .filter(
            (t) =>
              t.agenceId === l.agence_id &&
              (t.vehiculeId === l.id || t.categorieId === l.categorie_id),
          )
          .map((t) => ({ ...t, actif: t.actif })),
      ]),
    );
  }

  async photosDe(vehiculeIds: string[]) {
    if (!vehiculeIds.length) return new Map<string, string[]>();
    const photos = await this.db
      .select()
      .from(photosVehicule)
      .where(inArray(photosVehicule.vehiculeId, vehiculeIds))
      .orderBy(asc(photosVehicule.ordre));
    const parVehicule = new Map<string, string[]>();
    for (const p of photos) {
      const url = await this.stockage.urlLecture(p.url, 3600);
      parVehicule.set(p.vehiculeId, [...(parVehicule.get(p.vehiculeId) ?? []), url]);
    }
    return parVehicule;
  }

  /**
   * Recherche (3.2) : seuls les véhicules réellement disponibles sur toute la période
   * (battement de l'agence compris) et publiés par une agence validée s'affichent.
   */
  async rechercher(p: RechercheParams) {
    const point =
      p.lat !== undefined && p.lon !== undefined
        ? sql`ST_SetSRID(ST_MakePoint(${p.lon}, ${p.lat}), 4326)::geography`
        : null;
    const filtres = [
      sql`a.statut = 'validee'`,
      sql`v.visible_plateforme`,
      sql`v.statut IN ('disponible', 'loue')`,
      sql`pr.actif`,
      p.wilaya ? sql`pr.wilaya = ${p.wilaya}` : undefined,
      p.commune ? sql`pr.commune ILIKE ${p.commune}` : undefined,
      p.pointRetraitId ? sql`pr.id = ${p.pointRetraitId}` : undefined,
      p.agenceId ? sql`a.id = ${p.agenceId}` : undefined,
      p.categorie ? sql`c.code = ${p.categorie}` : undefined,
      p.boite ? sql`v.boite = ${p.boite}` : undefined,
      p.carburant ? sql`v.carburant = ${p.carburant}` : undefined,
      p.placesMin ? sql`v.places >= ${p.placesMin}` : undefined,
      p.climatisation ? sql`coalesce((v.options->>'climatisation')::boolean, false)` : undefined,
      p.avecChauffeur ? sql`coalesce((v.options->>'avecChauffeur')::boolean, false)` : undefined,
      sql`NOT EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.vehicule_id = v.id
          AND r.statut IN ${STATUTS_BLOQUANTS_SQL}
          AND r.periode && tstzrange(${p.debut.toISOString()}::timestamptz,
                                     ${p.fin.toISOString()}::timestamptz + make_interval(mins => a.battement_minutes), '[)')
      )`,
    ].filter(Boolean);

    const lignes = (await this.db.execute(sql`
      SELECT v.id, v.agence_id, v.categorie_id, c.code AS categorie, v.marque, v.modele, v.annee, v.boite,
             v.carburant, v.places, v.options, v.km_inclus_par_jour,
             a.raison_sociale, a.score, a.slug, a.wilaya AS agence_wilaya,
             (SELECT round(avg(av.note)::numeric, 1)::float FROM avis av WHERE av.agence_id = a.id AND av.statut = 'publie') AS note_moyenne,
             (SELECT count(*)::int FROM avis av WHERE av.agence_id = a.id AND av.statut = 'publie') AS nombre_avis, a.politique_annulation, a.age_minimum,
             pr.id AS point_id, pr.nom AS point_nom, pr.commune, pr.adresse AS point_adresse,
             ST_Y(pr.position::geometry) AS lat, ST_X(pr.position::geometry) AS lon,
             ${point ? sql`ST_Distance(pr.position, ${point})` : sql`NULL::float`} AS distance_m
      FROM vehicules v
      JOIN agences a ON a.id = v.agence_id
      JOIN points_retrait pr ON pr.id = v.point_retrait_id
      JOIN categories_vehicule c ON c.id = v.categorie_id
      WHERE ${sql.join(filtres as ReturnType<typeof sql>[], sql` AND `)}
    `)) as unknown as LigneRecherche[];

    const tarifsVehicule = await this.tarifsParVehicule(lignes);
    const jours = joursFactures(p.debut, p.fin);
    const resultats = lignes.flatMap((l) => {
      try {
        const prix = this.reservations.calculer({
          debut: p.debut,
          fin: p.fin,
          tarifs: tarifsVehicule.get(l.id) ?? [],
        });
        if (p.prixMax && prix.total > p.prixMax) return [];
        if (p.noteMin && (l.note_moyenne ?? 0) < p.noteMin) return [];
        return [{ ligne: l, prix }];
      } catch {
        return []; // Véhicule sans tarif applicable : non réservable en ligne.
      }
    });

    const comparateurs = {
      prix: (x: (typeof resultats)[number], y: (typeof resultats)[number]) =>
        x.prix.total - y.prix.total,
      // Note des avis publiés, puis score de fiabilité de l'agence, puis prix.
      note: (x: (typeof resultats)[number], y: (typeof resultats)[number]) =>
        (y.ligne.note_moyenne ?? 0) - (x.ligne.note_moyenne ?? 0) ||
        y.ligne.score - x.ligne.score ||
        x.prix.total - y.prix.total,
      distance: (x: (typeof resultats)[number], y: (typeof resultats)[number]) =>
        (x.ligne.distance_m ?? Infinity) - (y.ligne.distance_m ?? Infinity),
    };
    resultats.sort(comparateurs[p.tri]);
    const page = resultats.slice((p.page - 1) * p.parPage, p.page * p.parPage);
    const photos = await this.photosDe(page.map((r) => r.ligne.id));

    return {
      total: resultats.length,
      page: p.page,
      parPage: p.parPage,
      jours,
      resultats: page.map(({ ligne: l, prix }) => ({
        id: l.id,
        marque: l.marque,
        modele: l.modele,
        annee: l.annee,
        categorie: l.categorie,
        boite: l.boite,
        carburant: l.carburant,
        places: l.places,
        options: l.options,
        kmInclusParJour: l.km_inclus_par_jour,
        photo: photos.get(l.id)?.[0] ?? null,
        prix: {
          total: prix.total,
          parJour: prix.prixJourApplique,
          jours: prix.jours,
          caution: prix.caution,
        },
        agence: {
          id: l.agence_id,
          raisonSociale: l.raison_sociale,
          score: l.score,
          slug: l.slug,
          noteMoyenne: l.note_moyenne,
          nombreAvis: l.nombre_avis,
          politiqueAnnulation: l.politique_annulation,
        },
        pointRetrait: {
          id: l.point_id,
          nom: l.point_nom,
          commune: l.commune,
          adresse: l.point_adresse,
          lat: l.lat,
          lon: l.lon,
          distanceKm: l.distance_m === null ? null : Math.round(l.distance_m / 100) / 10,
        },
      })),
    };
  }

  /** Page publique d'une agence (lien à partager sur Facebook / WhatsApp). */
  async pageAgence(slug: string) {
    const [a] = await this.db
      .select()
      .from(agences)
      .where(and(eq(agences.slug, slug), eq(agences.statut, "validee")));
    if (!a) throw introuvable();
    const points = (await this.db.execute(sql`
      SELECT id, nom, adresse, commune, horaires, ST_Y(position::geometry) AS lat, ST_X(position::geometry) AS lon
      FROM points_retrait WHERE agence_id = ${a.id} AND actif ORDER BY created_at`)) as unknown as {
      id: string;
      nom: string;
      adresse: string;
      commune: string;
      horaires: Record<string, [string, string][]>;
      lat: number | null;
      lon: number | null;
    }[];
    const flotte = await this.db
      .select({ v: vehicules, categorie: categoriesVehicule.code })
      .from(vehicules)
      .innerJoin(categoriesVehicule, eq(categoriesVehicule.id, vehicules.categorieId))
      .where(
        and(
          eq(vehicules.agenceId, a.id),
          eq(vehicules.visiblePlateforme, true),
          sql`${vehicules.statut} <> 'hors_service'`,
        ),
      )
      .orderBy(asc(categoriesVehicule.ordre));
    const photos = await this.photosDe(flotte.map((f) => f.v.id));
    const lesTarifs = await this.tarifsParVehicule(
      flotte.map((f) => ({ id: f.v.id, agence_id: a.id, categorie_id: f.v.categorieId })),
    );
    const [notes] = (await this.db.execute(
      sql`SELECT round(avg(note)::numeric, 1)::float AS moyenne, count(*)::int AS nombre FROM avis WHERE agence_id = ${a.id} AND statut = 'publie'`,
    )) as unknown as { moyenne: number | null; nombre: number }[];
    return {
      id: a.id,
      slug: a.slug,
      raisonSociale: a.raisonSociale,
      adresse: a.adresse,
      wilaya: a.wilaya,
      telephone: a.telephone,
      logo: a.logoUrl ? await this.stockage.urlLecture(a.logoUrl, 3600) : null,
      photo: a.photos[0] ? await this.stockage.urlLecture(a.photos[0], 3600) : null,
      politiqueAnnulation: a.politiqueAnnulation,
      confirmationInstantanee: a.confirmationInstantanee,
      noteMoyenne: notes?.moyenne ?? null,
      nombreAvis: notes?.nombre ?? 0,
      points,
      vehicules: flotte.map(({ v, categorie }) => {
        const base = (lesTarifs.get(v.id) ?? [])
          .filter((t) => !t.saisonDebut)
          .sort((x, y) => (y.vehiculeId ? 1 : 0) - (x.vehiculeId ? 1 : 0))[0];
        return {
          id: v.id,
          marque: v.marque,
          modele: v.modele,
          annee: v.annee,
          categorie,
          boite: v.boite,
          carburant: v.carburant,
          places: v.places,
          kmInclusParJour: v.kmInclusParJour,
          photo: photos.get(v.id)?.[0] ?? null,
          prixJour: base?.prixJour ?? null,
        };
      }),
    };
  }

  /** Fiche véhicule publique (3.3). */
  async fiche(id: string) {
    const [l] = await this.db
      .select({ v: vehicules, a: agences, p: pointsRetrait, categorie: categoriesVehicule.code })
      .from(vehicules)
      .innerJoin(agences, eq(agences.id, vehicules.agenceId))
      .innerJoin(pointsRetrait, eq(pointsRetrait.id, vehicules.pointRetraitId))
      .innerJoin(categoriesVehicule, eq(categoriesVehicule.id, vehicules.categorieId))
      .where(
        and(
          eq(vehicules.id, id),
          eq(agences.statut, "validee"),
          eq(vehicules.visiblePlateforme, true),
        ),
      );
    if (!l) throw introuvable();
    const [position] = (await this.db.execute(
      sql`SELECT ST_Y(position::geometry) AS lat, ST_X(position::geometry) AS lon FROM points_retrait WHERE id = ${l.p.id}`,
    )) as unknown as { lat: number | null; lon: number | null }[];
    const lesTarifs = await this.reservations.tarifsPour(l.v);
    const base = lesTarifs
      .filter((t) => !t.saisonDebut)
      .sort((x, y) => (y.vehiculeId ? 1 : 0) - (x.vehiculeId ? 1 : 0))[0];
    const pointsAgence = await this.db
      .select({
        id: pointsRetrait.id,
        nom: pointsRetrait.nom,
        adresse: pointsRetrait.adresse,
        commune: pointsRetrait.commune,
      })
      .from(pointsRetrait)
      .where(and(eq(pointsRetrait.agenceId, l.a.id), eq(pointsRetrait.actif, true)));
    return {
      id: l.v.id,
      marque: l.v.marque,
      modele: l.v.modele,
      annee: l.v.annee,
      categorie: l.categorie,
      boite: l.v.boite,
      carburant: l.v.carburant,
      places: l.v.places,
      options: l.v.options,
      kmInclusParJour: l.v.kmInclusParJour,
      photos: (await this.photosDe([l.v.id])).get(l.v.id) ?? [],
      tarif: base
        ? {
            prixJour: base.prixJour,
            paliers: base.paliers,
            supplements: base.supplements,
            caution: base.caution,
          }
        : null,
      conditions: {
        ageMinimum: l.a.ageMinimum,
        ancienneteMinPermisAnnees: l.a.ancienneteMinPermisAnnees,
        politiqueAnnulation: l.a.politiqueAnnulation,
        confirmationInstantanee: l.a.confirmationInstantanee,
      },
      agence: {
        id: l.a.id,
        raisonSociale: l.a.raisonSociale,
        adresse: l.a.adresse,
        wilaya: l.a.wilaya,
        telephone: l.a.telephone,
        score: l.a.score,
        slug: l.a.slug,
        ...(
          (await this.db.execute(
            sql`SELECT round(avg(note)::numeric, 1)::float AS "noteMoyenne", count(*)::int AS "nombreAvis" FROM avis WHERE agence_id = ${l.a.id} AND statut = 'publie'`,
          )) as unknown as { noteMoyenne: number | null; nombreAvis: number }[]
        )[0],
      },
      pointRetrait: {
        id: l.p.id,
        nom: l.p.nom,
        adresse: l.p.adresse,
        commune: l.p.commune,
        horaires: l.p.horaires,
        lat: position?.lat ?? null,
        lon: position?.lon ?? null,
      },
      pointsRetraitAgence: pointsAgence,
    };
  }

  /** Prix détaillé et disponibilité pour une période (3.3). */
  async prix(id: string, debut: Date, fin: Date, options: string[] = [], livraison = false) {
    const [l] = await this.db
      .select({ v: vehicules, a: agences })
      .from(vehicules)
      .innerJoin(agences, eq(agences.id, vehicules.agenceId))
      .where(
        and(
          eq(vehicules.id, id),
          eq(agences.statut, "validee"),
          eq(vehicules.visiblePlateforme, true),
        ),
      );
    if (!l) throw introuvable();
    if (fin <= debut) throw new ErreurApi("DATES_INVALIDES");
    const detail = this.reservations.calculer({
      debut,
      fin,
      tarifs: await this.reservations.tarifsPour(l.v),
      options: options as never,
      livraison,
    });
    const disponible = await this.reservations.estDisponible(id, debut, fin, l.a.battementMinutes);
    return { ...detail, disponible };
  }
}
