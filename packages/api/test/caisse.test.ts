/**
 * Dépenses, caisse et statistiques par véhicule.
 */
import { dateAlger } from "@lvb/shared";
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
const auj = dateAlger(new Date());
const periodeJour = `du=${auj}&au=${auj}`;

beforeAll(async () => {
  ctx = await demarrer();
  const admin = await connecter(ctx, nouveauTelephone(), { admin: true });
  agence = await creerAgenceValidee(ctx, admin);
  autre = await creerAgenceValidee(ctx, admin);
});
afterAll(async () => {
  await ctx?.app.close();
});

/** Location au comptoir confirmée qui commence aujourd'hui (3 jours). */
async function location() {
  const debut = new Date(Date.now() + 3_600_000);
  const r = await agence.g
    .post("/agence/reservations", {
      vehiculeId: agence.vehicule.id,
      debut: debut.toISOString(),
      fin: new Date(debut.getTime() + 3 * 86_400_000).toISOString(),
      client: {
        telephone: nouveauTelephone(),
        nom: "Haddad",
        prenom: "Sofiane",
        dateNaissance: "1990-05-05",
      },
    })
    .expect(201);
  return r.body as { id: string; prixTotal: number };
}

describe("dépenses", () => {
  it("création, liste, modification, suppression ; montant > 0 ; isolation par agence", async () => {
    await agence.g
      .post("/agence/depenses", { categorie: "pneus", libelle: "x", montant: 0, date: auj })
      .expect(400);
    const d = await agence.g
      .post("/agence/depenses", {
        categorie: "pneus",
        libelle: "Pneu avant droit",
        montant: 9_000,
        date: auj,
        vehiculeId: agence.vehicule.id,
        moyen: "especes",
      })
      .expect(201);
    // Véhicule d'une autre agence : refusé.
    await agence.g
      .post("/agence/depenses", {
        categorie: "pneus",
        libelle: "Pneu",
        montant: 1_000,
        date: auj,
        vehiculeId: autre.vehicule.id,
      })
      .expect(404);

    const liste = await agence.g.get(`/agence/depenses?${periodeJour}`).expect(200);
    expect(liste.body).toEqual([
      expect.objectContaining({ id: d.body.id, origine: "depense", montant: 9_000 }),
    ]);
    // L'autre agence ne voit ni ne modifie cette dépense.
    expect((await autre.g.get(`/agence/depenses?${periodeJour}`).expect(200)).body).toEqual([]);
    await autre.g
      .patch(`/agence/depenses/${d.body.id}`, {
        categorie: "autre",
        libelle: "Piratage",
        montant: 1,
        date: auj,
      })
      .expect(404);
    await autre.g.delete(`/agence/depenses/${d.body.id}`).expect(404);

    await agence.g
      .patch(`/agence/depenses/${d.body.id}`, {
        categorie: "pneus",
        libelle: "Deux pneus avant",
        montant: 18_000,
        date: auj,
        vehiculeId: agence.vehicule.id,
      })
      .expect(200);
    await agence.g.delete(`/agence/depenses/${d.body.id}`).expect(204);
    expect((await agence.g.get(`/agence/depenses?${periodeJour}`).expect(200)).body).toEqual([]);
  });

  it("un véhicule avec des dépenses ne peut plus être supprimé", async () => {
    const v = await agence.creerVehicule();
    await agence.g
      .post("/agence/depenses", {
        categorie: "lavage",
        libelle: "Lavage complet",
        montant: 800,
        date: auj,
        vehiculeId: v.id,
      })
      .expect(201);
    await agence.g.delete(`/agence/vehicules/${v.id}`).expect(409);
  });
});

describe("caisse", () => {
  it("paiements en entrées, dépenses et entretiens en sorties, cautions à part", async () => {
    const debutCaisse = (await agence.g.get(`/agence/caisse?${periodeJour}`).expect(200)).body;
    const r = await location();
    const encaisser = (type: string, montant: number, moyen = "especes") =>
      agence.g.post(`/agence/reservations/${r.id}/paiements`, { type, moyen, montant }).expect(201);
    await encaisser("acompte", 5_000);
    await encaisser("solde", 10_000, "cib");
    await encaisser("caution", 30_000);
    await encaisser("remboursement", 1_000);
    await agence.g
      .post("/agence/depenses", {
        categorie: "carburant",
        libelle: "Plein",
        montant: 4_000,
        date: auj,
      })
      .expect(201);
    await agence.g
      .post("/agence/entretiens", {
        vehiculeId: agence.vehicule.id,
        type: "vidange",
        date: auj,
        cout: 3_500,
      })
      .expect(201);

    const c = (await agence.g.get(`/agence/caisse?${periodeJour}`).expect(200)).body;
    expect(c.entrees - debutCaisse.entrees).toBe(15_000);
    expect(c.sorties - debutCaisse.sorties).toBe(1_000 + 4_000 + 3_500);
    expect(c.solde).toBe(c.entrees - c.sorties);
    expect(c.cautionsDetenues - debutCaisse.cautionsDetenues).toBe(30_000);
    expect(c.parMoyen).toEqual(
      expect.arrayContaining([expect.objectContaining({ moyen: "cib", entrees: 10_000 })]),
    );
    expect(c.mouvements.map((m: { origine: string }) => m.origine)).toEqual(
      expect.arrayContaining(["paiement", "depense", "entretien"]),
    );

    // Rien ne fuit vers une autre agence.
    const vide = (await autre.g.get(`/agence/caisse?${periodeJour}`).expect(200)).body;
    expect(vide).toMatchObject({ entrees: 0, sorties: 0, solde: 0, mouvements: [] });
    await agence.g.get(`/agence/caisse?du=${auj}&au=2000-01-01`).expect(400);
  });
});

describe("statistiques des véhicules", () => {
  it("classe les véhicules : plus rentables (marge) et plus loués", async () => {
    const v2 = await agence.creerVehicule();
    await agence.g
      .post("/agence/depenses", {
        categorie: "reparation",
        libelle: "Embrayage",
        montant: 50_000,
        date: auj,
        vehiculeId: v2.id,
      })
      .expect(201);
    const fin = dateAlger(new Date(Date.now() + 10 * 86_400_000));
    const s = (await agence.g.get(`/agence/statistiques/vehicules?du=${auj}&au=${fin}`).expect(200))
      .body;
    expect(s.jours).toBe(11);
    const premier = s.plusRentables[0];
    expect(premier.vehiculeId).toBe(agence.vehicule.id);
    expect(premier.locations).toBeGreaterThanOrEqual(1);
    expect(premier.revenus).toBeGreaterThan(0);
    expect(s.plusRentables.at(-1).vehiculeId).toBe(v2.id);
    expect(s.plusRentables.at(-1).marge).toBe(-50_000);
    expect(s.plusLoues[0].vehiculeId).toBe(agence.vehicule.id);
    expect(premier.nom).toBeTruthy();

    // Isolation : l'autre agence ne voit que ses véhicules.
    const s2 = (await autre.g.get(`/agence/statistiques/vehicules?du=${auj}&au=${fin}`).expect(200))
      .body;
    expect(s2.plusRentables.map((v: { vehiculeId: string }) => v.vehiculeId)).toEqual([
      autre.vehicule.id,
    ]);
  });
});
