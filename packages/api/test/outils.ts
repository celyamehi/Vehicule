import { utilisateurs } from "@lvb/db";
import { eq } from "drizzle-orm";
import request from "supertest";
import { SmsConsole } from "../src/auth/sms.js";
import { BASE, type Base } from "../src/base.js";
import { creerApplication } from "../src/application.js";

let compteur = 0;
/** Numéro de téléphone algérien unique pour chaque test. */
export const nouveauTelephone = () =>
  `+2135${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

export async function demarrer() {
  const app = await creerApplication();
  await app.listen(0);
  const adresse = app.getHttpServer().address() as { port: number };
  return {
    app,
    url: `http://127.0.0.1:${adresse.port}`,
    db: app.get<Base>(BASE),
    sms: app.get(SmsConsole),
  };
}

export type Contexte = Awaited<ReturnType<typeof demarrer>>;

/** Connexion complète par OTP (le code est lu dans le fournisseur SMS de test). */
export async function connecter(
  ctx: Contexte,
  telephone = nouveauTelephone(),
  options: { admin?: boolean } = {},
) {
  await request(ctx.app.getHttpServer())
    .post("/api/v1/auth/otp/envoyer")
    .send({ telephone })
    .expect(200);
  const code = /(\d{6})/.exec(ctx.sms.dernierPour(telephone)!)![1];
  const r = await request(ctx.app.getHttpServer())
    .post("/api/v1/auth/otp/verifier")
    .send({ telephone, code })
    .expect(200);
  if (options.admin) {
    await ctx.db
      .update(utilisateurs)
      .set({ rolePlateforme: "admin" })
      .where(eq(utilisateurs.id, r.body.utilisateur.id));
  }
  return {
    jeton: r.body.jetonAcces as string,
    id: r.body.utilisateur.id as string,
    telephone,
    rafraichir: r.body.jetonRafraichissement as string,
  };
}

export function api(ctx: Contexte, jeton?: string, agenceId?: string) {
  const serveur = ctx.app.getHttpServer();
  const entetes = (r: request.Test) => {
    if (jeton) r.set("Authorization", `Bearer ${jeton}`);
    if (agenceId) r.set("X-Agence-Id", agenceId);
    return r;
  };
  return {
    get: (u: string) => entetes(request(serveur).get(`/api/v1${u}`)),
    post: (u: string, corps?: object) =>
      entetes(request(serveur).post(`/api/v1${u}`)).send(corps ?? {}),
    patch: (u: string, corps?: object) =>
      entetes(request(serveur).patch(`/api/v1${u}`)).send(corps ?? {}),
    delete: (u: string) => entetes(request(serveur).delete(`/api/v1${u}`)),
  };
}

/** Agence validée avec un gérant, un véhicule et un tarif. */
export async function creerAgenceValidee(
  ctx: Contexte,
  admin: { jeton: string },
  options: { valider?: boolean } = {},
) {
  const gerant = await connecter(ctx);
  const nif = String(Date.now()).padEnd(15, "0") + String(compteur++).padStart(3, "0");
  const agence = await api(ctx, gerant.jeton)
    .post("/agences", {
      raisonSociale: `Agence test ${compteur}`,
      nif,
      registreCommerce: `06/00-${compteur}B21`,
      wilaya: 6,
      adresse: "Boulevard Amirouche, Béjaïa",
      telephone: "0550000000",
    })
    .expect(201);
  const g = api(ctx, gerant.jeton, agence.body.id);
  const points = await g.get("/agence/points-retrait").expect(200);
  const pointId = points.body[0].id as string;
  const creerVehicule = async (categorie = "citadine") => {
    const v = await g
      .post("/agence/vehicules", {
        pointRetraitId: pointId,
        categorie,
        marque: "Renault",
        modele: "Clio",
        annee: 2023,
        immatriculation: `${Math.floor(Math.random() * 1e9)}-06`,
        boite: "manuelle",
        carburant: "essence",
        places: 5,
        kmInclusParJour: 250,
        options: { climatisation: true, siegeBebe: true },
      })
      .expect(201);
    await g
      .post("/agence/tarifs", {
        vehiculeId: v.body.id,
        prixJour: 5000,
        paliers: [{ aPartirDeJours: 7, prixJour: 4500 }],
        supplements: { siegeBebe: { parJour: 500 }, livraison: { forfait: 2000 } },
        caution: 30000,
      })
      .expect(201);
    return v.body as { id: string };
  };
  const vehicule = await creerVehicule();
  if (options.valider !== false)
    await api(ctx, admin.jeton)
      .post(`/admin/agences/${agence.body.id}/decision`, { decision: "valider" })
      .expect(200);
  return { gerant, agenceId: agence.body.id as string, pointId, vehicule, creerVehicule, g };
}

/** Client avec date de naissance et permis renseignés (conditions conducteur remplies). */
export async function creerClientConforme(ctx: Contexte) {
  const client = await connecter(ctx);
  const c = api(ctx, client.jeton);
  await c
    .patch("/moi", {
      nom: "Haddad",
      prenom: "Sofiane",
      dateNaissance: "1990-04-12",
      consentement: true,
    })
    .expect(200);
  await c
    .post("/moi/documents", {
      type: "permis",
      numero: "P123456",
      dateDelivrance: "2012-01-01",
      fichiers: {},
    })
    .expect(201);
  return client;
}

/** Période ISO dans N jours (heure d'Alger). */
export function periode(dansJours: number, duree = 3, heure = 10) {
  const debut = new Date(Date.now() + dansJours * 86_400_000);
  debut.setUTCHours(heure - 1, 0, 0, 0);
  const fin = new Date(debut.getTime() + duree * 86_400_000);
  return { debut: debut.toISOString(), fin: fin.toISOString() };
}
