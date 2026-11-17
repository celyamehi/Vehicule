import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  categoriesVehicule,
  photosVehicule,
  pointsRetrait,
  reservations,
  tarifs,
  vehicules,
} from "@lvb/db";
import { schemas } from "@lvb/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { MonAgence, Moi, Permission, RouteAgence } from "../auth/decorateurs.js";
import type { ContexteAgence, UtilisateurConnecte } from "../auth/types.js";
import { type Base, InjectBase } from "../base.js";
import { ErreurApi, introuvable } from "../commun/erreur-api.js";
import { JournalService } from "../commun/journal.service.js";
import { Corps, DocCorps } from "../commun/zod.js";
import { Stockage } from "../fichiers/stockage.js";

/** Flotte et tarifs de l'agence (4.3, 4.8). Toutes les requêtes sont filtrées par agence. */
@ApiTags("Flotte")
@ApiBearerAuth()
@RouteAgence()
@Controller("agence")
export class FlotteController {
  constructor(
    @InjectBase() private readonly db: Base,
    private readonly journal: JournalService,
    private readonly stockage: Stockage,
  ) {}

  private async idCategorie(code: string) {
    const [c] = await this.db
      .select({ id: categoriesVehicule.id })
      .from(categoriesVehicule)
      .where(eq(categoriesVehicule.code, code));
    if (!c) throw new ErreurApi("REQUETE_INVALIDE", { categorie: code });
    return c.id;
  }

  private async verifierPoint(agenceId: string, pointId: string) {
    const [p] = await this.db
      .select({ id: pointsRetrait.id })
      .from(pointsRetrait)
      .where(and(eq(pointsRetrait.id, pointId), eq(pointsRetrait.agenceId, agenceId)));
    if (!p) throw new ErreurApi("REQUETE_INVALIDE", { pointRetraitId: pointId });
  }

  private async vehiculeDeLAgence(agenceId: string, id: string) {
    const [v] = await this.db
      .select()
      .from(vehicules)
      .where(and(eq(vehicules.id, id), eq(vehicules.agenceId, agenceId)));
    if (!v) throw introuvable();
    return v;
  }

  // ---------------------------------------------------------------------------
  // Véhicules
  // ---------------------------------------------------------------------------

  @Get("vehicules")
  async lister(@MonAgence() a: ContexteAgence) {
    const lignes = await this.db
      .select({ v: vehicules, categorie: categoriesVehicule.code, point: pointsRetrait.nom })
      .from(vehicules)
      .innerJoin(categoriesVehicule, eq(categoriesVehicule.id, vehicules.categorieId))
      .innerJoin(pointsRetrait, eq(pointsRetrait.id, vehicules.pointRetraitId))
      .where(eq(vehicules.agenceId, a.agenceId))
      .orderBy(asc(categoriesVehicule.ordre), asc(vehicules.marque));
    const photos = await this.db
      .select()
      .from(photosVehicule)
      .innerJoin(vehicules, eq(vehicules.id, photosVehicule.vehiculeId))
      .where(eq(vehicules.agenceId, a.agenceId))
      .orderBy(asc(photosVehicule.ordre));
    return Promise.all(
      lignes.map(async (l) => {
        const premiere = photos.find((p) => p.photos_vehicule.vehiculeId === l.v.id);
        return {
          ...l.v,
          categorie: l.categorie,
          pointRetrait: l.point,
          nbPhotos: photos.filter((p) => p.photos_vehicule.vehiculeId === l.v.id).length,
          photo: premiere
            ? await this.stockage.urlLecture(premiere.photos_vehicule.url, 3600)
            : null,
        };
      }),
    );
  }

  @Get("vehicules/:id")
  async detail(@MonAgence() a: ContexteAgence, @Param("id", ParseUUIDPipe) id: string) {
    const v = await this.vehiculeDeLAgence(a.agenceId, id);
    const [cat] = await this.db
      .select({ code: categoriesVehicule.code })
      .from(categoriesVehicule)
      .where(eq(categoriesVehicule.id, v.categorieId));
    const photos = await this.db
      .select()
      .from(photosVehicule)
      .where(eq(photosVehicule.vehiculeId, id))
      .orderBy(asc(photosVehicule.ordre));
    return {
      ...v,
      categorie: cat?.code,
      photos: await Promise.all(
        photos.map(async (p) => ({
          id: p.id,
          ordre: p.ordre,
          url: await this.stockage.urlLecture(p.url, 3600),
        })),
      ),
      tarifs: await this.db
        .select()
        .from(tarifs)
        .where(and(eq(tarifs.agenceId, a.agenceId), eq(tarifs.vehiculeId, id))),
    };
  }

  @Permission("flotte.modifier")
  @Post("vehicules")
  @DocCorps(schemas.vehiculeCreer)
  async creer(
    @MonAgence() a: ContexteAgence,
    @Corps(schemas.vehiculeCreer) c: z.output<typeof schemas.vehiculeCreer>,
  ) {
    await this.verifierPoint(a.agenceId, c.pointRetraitId);
    const { categorie, ...reste } = c;
    const [v] = await this.db
      .insert(vehicules)
      .values({ ...reste, agenceId: a.agenceId, categorieId: await this.idCategorie(categorie) })
      .returning();
    return v;
  }

  @Permission("flotte.modifier")
  @Patch("vehicules/:id")
  @DocCorps(schemas.vehiculeModifier)
  async modifier(
    @MonAgence() a: ContexteAgence,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.vehiculeModifier) c: z.output<typeof schemas.vehiculeModifier>,
  ) {
    await this.vehiculeDeLAgence(a.agenceId, id);
    if (c.pointRetraitId) await this.verifierPoint(a.agenceId, c.pointRetraitId);
    const { categorie, ...reste } = c;
    const [v] = await this.db
      .update(vehicules)
      .set({ ...reste, ...(categorie ? { categorieId: await this.idCategorie(categorie) } : {}) })
      .where(and(eq(vehicules.id, id), eq(vehicules.agenceId, a.agenceId)))
      .returning();
    return v;
  }

  /** Suppression possible seulement si le véhicule n'a aucun historique ; sinon le passer « hors service ». */
  @Permission("flotte.modifier")
  @Delete("vehicules/:id")
  @HttpCode(204)
  async supprimer(@MonAgence() a: ContexteAgence, @Param("id", ParseUUIDPipe) id: string) {
    await this.vehiculeDeLAgence(a.agenceId, id);
    const [{ n }] = (await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(reservations)
      .where(eq(reservations.vehiculeId, id))) as [{ n: number }];
    if (n > 0) throw new ErreurApi("CONFLIT", { raison: "historique" });
    await this.db
      .delete(vehicules)
      .where(and(eq(vehicules.id, id), eq(vehicules.agenceId, a.agenceId)));
  }

  @Permission("flotte.modifier")
  @Post("vehicules/:id/photos")
  async ajouterPhoto(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(z.object({ cle: z.string().min(1).max(300) })) c: { cle: string },
  ) {
    await this.vehiculeDeLAgence(a.agenceId, id);
    if (!c.cle.startsWith(`photo_vehicule/${moi.id}/`)) throw new ErreurApi("FICHIER_INVALIDE");
    const [{ n }] = (await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(photosVehicule)
      .where(eq(photosVehicule.vehiculeId, id))) as [{ n: number }];
    if (n >= 12) throw new ErreurApi("REQUETE_INVALIDE", { raison: "12 photos maximum" });
    const [p] = await this.db
      .insert(photosVehicule)
      .values({ vehiculeId: id, url: c.cle, ordre: n })
      .returning();
    return { id: p!.id, ordre: p!.ordre, url: await this.stockage.urlLecture(p!.url, 3600) };
  }

  @Permission("flotte.modifier")
  @Delete("vehicules/:id/photos/:photoId")
  @HttpCode(204)
  async supprimerPhoto(
    @MonAgence() a: ContexteAgence,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("photoId", ParseUUIDPipe) photoId: string,
  ) {
    await this.vehiculeDeLAgence(a.agenceId, id);
    await this.db
      .delete(photosVehicule)
      .where(and(eq(photosVehicule.id, photoId), eq(photosVehicule.vehiculeId, id)));
  }

  // ---------------------------------------------------------------------------
  // Tarifs
  // ---------------------------------------------------------------------------

  @Get("tarifs")
  async tarifs(@MonAgence() a: ContexteAgence) {
    return this.db
      .select({ t: tarifs, categorie: categoriesVehicule.code })
      .from(tarifs)
      .leftJoin(categoriesVehicule, eq(categoriesVehicule.id, tarifs.categorieId))
      .where(eq(tarifs.agenceId, a.agenceId))
      .then((l) => l.map((x) => ({ ...x.t, categorie: x.categorie })));
  }

  private async valeursTarif(a: ContexteAgence, c: z.output<typeof schemas.tarifCreer>) {
    if (c.vehiculeId) await this.vehiculeDeLAgence(a.agenceId, c.vehiculeId);
    const { categorie, vehiculeId, ...reste } = c;
    return {
      ...reste,
      agenceId: a.agenceId,
      vehiculeId: vehiculeId ?? null,
      categorieId: categorie ? await this.idCategorie(categorie) : null,
      saisonDebut: c.saisonDebut ?? null,
      saisonFin: c.saisonFin ?? null,
    };
  }

  @Permission("tarifs.modifier")
  @Post("tarifs")
  @DocCorps(schemas.tarifCreer)
  async creerTarif(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Corps(schemas.tarifCreer) c: z.output<typeof schemas.tarifCreer>,
  ) {
    const [t] = await this.db
      .insert(tarifs)
      .values(await this.valeursTarif(a, c))
      .returning();
    await this.journal.noter({
      action: "tarif.creer",
      entite: "tarif",
      entiteId: t!.id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: { prixJour: t!.prixJour },
    });
    return t;
  }

  /** Modifier un tarif n'affecte jamais les réservations existantes (prix figé, règle 6.3.6). */
  @Permission("tarifs.modifier")
  @Patch("tarifs/:id")
  @DocCorps(schemas.tarifCreer)
  async modifierTarif(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.tarifCreer) c: z.output<typeof schemas.tarifCreer>,
  ) {
    const [avant] = await this.db
      .select()
      .from(tarifs)
      .where(and(eq(tarifs.id, id), eq(tarifs.agenceId, a.agenceId)));
    if (!avant) throw introuvable();
    const [t] = await this.db
      .update(tarifs)
      .set(await this.valeursTarif(a, c))
      .where(eq(tarifs.id, id))
      .returning();
    await this.journal.noter({
      action: "tarif.modifier",
      entite: "tarif",
      entiteId: id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: { prixJourAvant: avant.prixJour, prixJourApres: t!.prixJour },
    });
    return t;
  }

  @Permission("tarifs.modifier")
  @Delete("tarifs/:id")
  @HttpCode(204)
  async supprimerTarif(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const r = await this.db
      .delete(tarifs)
      .where(and(eq(tarifs.id, id), eq(tarifs.agenceId, a.agenceId)))
      .returning();
    if (!r.length) throw introuvable();
    await this.journal.noter({
      action: "tarif.supprimer",
      entite: "tarif",
      entiteId: id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
    });
  }
}
