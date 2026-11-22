/**
 * Clients entreprises : fiche, isolation par agence, location au comptoir facturée à la société.
 */
import { reservations } from "@lvb/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Contexte,
  connecter,
  creerAgenceValidee,
  demarrer,
  nouveauTelephone,
} from "./outils.js";

let ctx: Contexte;
let agence: Awaited<ReturnType<typeof creerAgenceValidee>>;
let autre: Awaited<ReturnType<typeof creerAgenceValidee>>;

beforeAll(async () => {
  ctx = await demarrer();
  const admin = await connecter(ctx, nouveauTelephone(), { admin: true });
  agence = await creerAgenceValidee(ctx, admin);
  autre = await creerAgenceValidee(ctx, admin);
});
afterAll(async () => {
  await ctx?.app.close();
});

const SOCIETE = {
  raisonSociale: "SARL Béjaïa Logistique",
  nif: "000106019876543",
  nis: "000106010012345",
  registreCommerce: "06/00-0123456B12",
  articleImposition: "06012345678",
  adresse: "Zone industrielle, Béjaïa",
  telephone: "034 21 22 23",
  email: "",
  contactNom: "M. Amrani",
  delaiPaiementJours: 30,
};

/** Location au comptoir de 2 jours qui commence dans `decalageJours` jours. */
const louer = (entrepriseId: string | null, decalageJours: number) => {
  const debut = new Date(Date.now() + decalageJours * 86_400_000);
  return agence.g.post("/agence/reservations", {
    vehiculeId: agence.vehicule.id,
    debut: debut.toISOString(),
    fin: new Date(debut.getTime() + 2 * 86_400_000).toISOString(),
    client: {
      telephone: nouveauTelephone(),
      nom: "Benali",
      prenom: "Karim",
      dateNaissance: "1985-03-03",
    },
    entrepriseId,
  });
};

describe("clients entreprises", () => {
  it("création, validation et isolation par agence", async () => {
    await agence.g.post("/agence/entreprises", { raisonSociale: "X" }).expect(400);
    await agence.g
      .post("/agence/entreprises", { raisonSociale: "SARL Test", nif: "12AB" })
      .expect(400);
    const e = await agence.g.post("/agence/entreprises", SOCIETE).expect(201);
    expect(e.body).toMatchObject({
      raisonSociale: SOCIETE.raisonSociale,
      telephone: "+21334212223",
      email: null,
      delaiPaiementJours: 30,
    });

    const liste = await agence.g.get("/agence/entreprises?recherche=logistique").expect(200);
    expect(liste.body.map((x: { id: string }) => x.id)).toContain(e.body.id);
    // L'autre agence ne voit, ne modifie ni ne supprime rien.
    expect((await autre.g.get("/agence/entreprises").expect(200)).body).toEqual([]);
    await autre.g.get(`/agence/entreprises/${e.body.id}`).expect(404);
    await autre.g
      .patch(`/agence/entreprises/${e.body.id}`, { raisonSociale: "Piratage" })
      .expect(404);
    await autre.g.delete(`/agence/entreprises/${e.body.id}`).expect(404);
  });

  it("location au comptoir pour une entreprise : facturée à son nom, conducteur listé", async () => {
    const e = await agence.g.post("/agence/entreprises", SOCIETE).expect(201);
    const r = await louer(e.body.id, 40).expect(201);
    expect(r.body.entrepriseId).toBe(e.body.id);

    const fiche = await agence.g.get(`/agence/entreprises/${e.body.id}`).expect(200);
    expect(fiche.body.locations).toBe(1);
    expect(fiche.body.chiffreAffaires).toBe(r.body.prixTotal);
    expect(fiche.body.resteAPayer).toBe(r.body.prixTotal);
    expect(fiche.body.conducteurs).toEqual([
      expect.objectContaining({ nom: "Karim Benali", locations: 1 }),
    ]);
    expect(fiche.body.historique[0]).toMatchObject({ id: r.body.id, conducteur: "Karim Benali" });

    // Un paiement réduit le reste à payer.
    await agence.g
      .post(`/agence/reservations/${r.body.id}/paiements`, {
        type: "acompte",
        moyen: "virement",
        montant: 1_000,
      })
      .expect(201);
    expect(
      (await agence.g.get(`/agence/entreprises/${e.body.id}`).expect(200)).body.resteAPayer,
    ).toBe(r.body.prixTotal - 1_000);

    // Facture PDF générée au nom de l'entreprise.
    const pdf = await agence.g
      .get(`/agence/reservations/${r.body.id}/facture/pdf`)
      .buffer(true)
      .parse((res, cb) => {
        const morceaux: Buffer[] = [];
        res.on("data", (x: Buffer) => morceaux.push(x));
        res.on("end", () => cb(null, Buffer.concat(morceaux)));
      })
      .expect(200);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");

    // Une entreprise avec des locations ne peut pas être supprimée.
    await agence.g.delete(`/agence/entreprises/${e.body.id}`).expect(409);
  });

  it("refuse l'entreprise d'une autre agence et une entreprise sur liste noire", async () => {
    const etrangere = await autre.g.post("/agence/entreprises", SOCIETE).expect(201);
    await louer(etrangere.body.id, 50).expect(404);

    const e = await agence.g.post("/agence/entreprises", SOCIETE).expect(201);
    await agence.g
      .patch(`/agence/entreprises/${e.body.id}`, { ...SOCIETE, listeNoire: true })
      .expect(200);
    await louer(e.body.id, 55).expect(403);
  });

  it("rattache puis détache une réservation existante", async () => {
    const e = await agence.g.post("/agence/entreprises", SOCIETE).expect(201);
    const r = await louer(null, 60).expect(201);
    expect(r.body.entrepriseId).toBeNull();
    await agence.g
      .patch(`/agence/reservations/${r.body.id}/entreprise`, { entrepriseId: e.body.id })
      .expect(200);
    const [enBase] = await ctx.db.select().from(reservations).where(eq(reservations.id, r.body.id));
    expect(enBase!.entrepriseId).toBe(e.body.id);
    await autre.g
      .patch(`/agence/reservations/${r.body.id}/entreprise`, { entrepriseId: null })
      .expect(404);
    await agence.g
      .patch(`/agence/reservations/${r.body.id}/entreprise`, { entrepriseId: null })
      .expect(200);
    // Supprimable de nouveau : plus aucune location rattachée.
    await agence.g.delete(`/agence/entreprises/${e.body.id}`).expect(204);
  });
});
