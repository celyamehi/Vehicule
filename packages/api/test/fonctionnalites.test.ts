/**
 * Avis, messagerie, livraison, page agence, amendes, factures et export (fonctionnalités ajoutées).
 */
import { factures, reservations } from "@lvb/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Contexte,
  api,
  connecter,
  creerAgenceValidee,
  creerClientConforme,
  demarrer,
  nouveauTelephone,
  periode,
} from "./outils.js";

const SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let ctx: Contexte;
let admin: Awaited<ReturnType<typeof connecter>>;
let agence: Awaited<ReturnType<typeof creerAgenceValidee>>;

beforeAll(async () => {
  ctx = await demarrer();
  admin = await connecter(ctx, nouveauTelephone(), { admin: true });
  agence = await creerAgenceValidee(ctx, admin);
});
afterAll(async () => {
  await ctx?.app.close();
});

/** Location au comptoir menée jusqu'au retour (statut « terminee »). */
async function locationTerminee(telephone: string) {
  const debut = new Date(Date.now() - 3 * 86_400_000);
  const fin = new Date(Date.now() - 3_600_000);
  const r = await agence.g
    .post("/agence/reservations", {
      vehiculeId: agence.vehicule.id,
      debut: debut.toISOString(),
      fin: fin.toISOString(),
      client: { telephone, nom: "Ait Ali", prenom: "Nadia", dateNaissance: "1991-01-01" },
    })
    .expect(201);
  await agence.g
    .post(`/agence/reservations/${r.body.id}/etat-des-lieux`, {
      moment: "depart",
      kilometrage: 10_000,
      carburant: 8,
      signatureClient: SIGNATURE,
    })
    .expect(201);
  await agence.g.post(`/agence/reservations/${r.body.id}/depart`).expect(200);
  await agence.g
    .post(`/agence/reservations/${r.body.id}/etat-des-lieux`, {
      moment: "retour",
      kilometrage: 10_500,
      carburant: 8,
      signatureClient: SIGNATURE,
    })
    .expect(201);
  await agence.g.post(`/agence/reservations/${r.body.id}/retour`, {}).expect(200);
  // Remise réelle au début prévu (le test enchaîne tout en quelques millisecondes).
  await ctx.db.update(reservations).set({ departLe: debut }).where(eq(reservations.id, r.body.id));
  return r.body as { id: string; code: string };
}

describe("avis clients (6.3.9)", () => {
  it("un avis par location terminée ; réponse de l'agence ; moyenne ; modération", async () => {
    const telephone = nouveauTelephone();
    const r = await locationTerminee(telephone);
    const client = await connecter(ctx, telephone);
    const c = api(ctx, client.jeton);

    expect((await c.get(`/moi/reservations/${r.id}/avis`).expect(200)).body).toMatchObject({
      avis: null,
      possible: true,
    });
    await c.post(`/moi/reservations/${r.id}/avis`, { note: 6 }).expect(400);
    const a = await c
      .post(`/moi/reservations/${r.id}/avis`, {
        note: 4,
        commentaire: "Voiture propre, accueil chaleureux",
      })
      .expect(201);
    await c.post(`/moi/reservations/${r.id}/avis`, { note: 5 }).expect(409); // un seul avis

    const pub = await api(ctx).get(`/agences/${agence.agenceId}/avis`).expect(200);
    expect(pub.body).toMatchObject({ moyenne: 4, nombre: 1 });
    expect(pub.body.avis[0].auteur).toBe("Nadia A."); // nom protégé
    expect(pub.body.avis[0]).not.toHaveProperty("auteurId");

    await agence.g
      .post(`/agence/avis/${a.body.id}/reponse`, { reponse: "Merci Nadia, à bientôt !" })
      .expect(200);
    await agence.g.post(`/agence/avis/${a.body.id}/signaler`).expect(200);
    const signales = await api(ctx, admin.jeton).get("/admin/avis?signales=true").expect(200);
    expect(signales.body.map((x: { id: string }) => x.id)).toContain(a.body.id);
    await api(ctx, admin.jeton)
      .post(`/admin/avis/${a.body.id}/decision`, { decision: "masquer" })
      .expect(200);
    expect((await api(ctx).get(`/agences/${agence.agenceId}/avis`).expect(200)).body.nombre).toBe(
      0,
    );
  });

  it("refuse un avis sur une réservation non terminée ou d'un autre client", async () => {
    const client = await creerClientConforme(ctx);
    const r = await api(ctx, client.jeton)
      .post("/reservations", { vehiculeId: agence.vehicule.id, ...periode(200) })
      .expect(201);
    await api(ctx, client.jeton)
      .post(`/moi/reservations/${r.body.id}/avis`, { note: 5 })
      .expect(409);
    const autre = await connecter(ctx);
    await api(ctx, autre.jeton)
      .post(`/moi/reservations/${r.body.id}/avis`, { note: 1 })
      .expect(404);
  });
});

describe("messagerie client ↔ agence", () => {
  it("échange de messages, lus à l'ouverture, isolés par réservation", async () => {
    const client = await creerClientConforme(ctx);
    const r = await api(ctx, client.jeton)
      .post("/reservations", { vehiculeId: agence.vehicule.id, ...periode(210) })
      .expect(201);
    await api(ctx, client.jeton)
      .post(`/moi/reservations/${r.body.id}/messages`, {
        texte: "Bonjour, puis-je récupérer la voiture à 8 h ?",
      })
      .expect(201);
    expect((await agence.g.get("/agence/messages/non-lus").expect(200)).body).toEqual([
      { reservationId: r.body.id, n: 1 },
    ]);
    const fil = await agence.g.get(`/agence/reservations/${r.body.id}/messages`).expect(200);
    expect(fil.body).toHaveLength(1);
    expect((await agence.g.get("/agence/messages/non-lus").expect(200)).body).toEqual([]);
    await agence.g
      .post(`/agence/reservations/${r.body.id}/messages`, { texte: "Oui, sans problème." })
      .expect(201);
    const vu = await api(ctx, client.jeton)
      .get(`/moi/reservations/${r.body.id}/messages`)
      .expect(200);
    expect(vu.body.map((m: { auteur: string }) => m.auteur)).toEqual(["client", "agence"]);
    await api(ctx, client.jeton)
      .post(`/moi/reservations/${r.body.id}/messages`, { texte: "   " })
      .expect(400);
    const autre = await creerAgenceValidee(ctx, admin);
    await autre.g.get(`/agence/reservations/${r.body.id}/messages`).expect(404);
  });
});

describe("livraison à une adresse", () => {
  it("enregistre l'adresse et facture la livraison", async () => {
    const client = await creerClientConforme(ctx);
    const p = periode(220, 2);
    await api(ctx, client.jeton)
      .post("/reservations", { vehiculeId: agence.vehicule.id, ...p, livraison: true })
      .expect(400);
    const r = await api(ctx, client.jeton)
      .post("/reservations", {
        vehiculeId: agence.vehicule.id,
        ...p,
        livraison: true,
        adresseLivraison: {
          adresse: "Hôtel Les Hammadites, route de Tichy",
          commune: "Tichy",
          recuperation: true,
        },
      })
      .expect(201);
    expect(r.body.livraison).toMatchObject({ commune: "Tichy", recuperation: true });
    expect(r.body.prixTotal).toBe(2 * 5000 + 2000);
  });
});

describe("page publique de l'agence", () => {
  it("accessible par son lien, seulement si l'agence est validée", async () => {
    const infos = await agence.g.get("/agence").expect(200);
    expect(infos.body.slug).toMatch(/^agence-test-\d+-[0-9a-f]{4}$/);
    const page = await api(ctx).get(`/agences/page/${infos.body.slug}`).expect(200);
    expect(page.body.vehicules.map((v: { id: string }) => v.id)).toContain(agence.vehicule.id);
    expect(page.body.vehicules[0].prixJour).toBe(5000);
    const recherche = await api(ctx)
      .get(
        `/recherche?agenceId=${agence.agenceId}&debut=${encodeURIComponent(periode(300).debut)}&fin=${encodeURIComponent(periode(300).fin)}`,
      )
      .expect(200);
    expect(
      recherche.body.resultats.every(
        (x: { agence: { id: string } }) => x.agence.id === agence.agenceId,
      ),
    ).toBe(true);

    const enAttente = await creerAgenceValidee(ctx, admin, { valider: false });
    const slug = (await enAttente.g.get("/agence").expect(200)).body.slug;
    await api(ctx).get(`/agences/page/${slug}`).expect(404);
    await api(ctx).get("/agences/page/..%2Fadmin").expect(404);
  });
});

describe("amendes, factures, export", () => {
  it("retrouve le conducteur responsable d'une amende", async () => {
    const telephone = nouveauTelephone();
    const r = await locationTerminee(telephone);
    const pendant = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const apercu = await agence.g
      .get(
        `/agence/amendes/responsable?vehiculeId=${agence.vehicule.id}&dateInfraction=${encodeURIComponent(pendant)}`,
      )
      .expect(200);
    expect(apercu.body).toMatchObject({ reservationId: r.id, telephone });
    const m = await agence.g
      .post("/agence/amendes", {
        vehiculeId: agence.vehicule.id,
        dateInfraction: pendant,
        montant: 2000,
        motif: "Excès de vitesse",
        lieu: "RN 9",
      })
      .expect(201);
    expect(m.body.reservationId).toBe(r.id);
    const hors = await agence.g
      .post("/agence/amendes", {
        vehiculeId: agence.vehicule.id,
        dateInfraction: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        montant: 1000,
        motif: "Stationnement",
      })
      .expect(201);
    expect(hors.body.clientId).toBeNull();
    await agence.g.patch(`/agence/amendes/${m.body.id}`, { statut: "refacturee" }).expect(200);
    const liste = await agence.g.get("/agence/amendes").expect(200);
    expect(liste.body.find((x: { id: string }) => x.id === m.body.id)).toMatchObject({
      statut: "refacturee",
      code: r.code,
    });
  });

  it("émet une facture numérotée une seule fois, et exporte en Excel", async () => {
    const r = await locationTerminee(nouveauTelephone());
    const lire = (requete: ReturnType<typeof agence.g.get>) =>
      requete.buffer(true).parse((res, cb) => {
        const morceaux: Buffer[] = [];
        res.on("data", (x: Buffer) => morceaux.push(x));
        res.on("end", () => cb(null, Buffer.concat(morceaux)));
      });
    const pdf = await lire(agence.g.get(`/agence/reservations/${r.id}/facture/pdf`)).expect(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
    await lire(agence.g.get(`/agence/reservations/${r.id}/facture/pdf`)).expect(200);
    const emises = await ctx.db.select().from(factures).where(eq(factures.reservationId, r.id));
    expect(emises).toHaveLength(1);
    expect(emises[0]!.numero).toMatch(/^F-\d{4}-\d{5}$/);

    const debut = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const fin = new Date(Date.now() + 86_400_000).toISOString();
    const xlsx = await lire(
      agence.g.get(
        `/agence/export.xlsx?debut=${encodeURIComponent(debut)}&fin=${encodeURIComponent(fin)}`,
      ),
    ).expect(200);
    expect(xlsx.headers["content-type"]).toContain("spreadsheetml");
    expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe("PK"); // fichier .xlsx (zip)
    const autre = await creerAgenceValidee(ctx, admin);
    await autre.g.get(`/agence/reservations/${r.id}/facture/pdf`).expect(404);
  });
});
