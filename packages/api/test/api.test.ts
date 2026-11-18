/**
 * Tests d'intégration de l'API sur une vraie base PostgreSQL (critères d'acceptation de la Phase 1).
 */
import { reservations, tarifs } from "@lvb/db";
import { eq } from "drizzle-orm";
import { io, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ReservationsService } from "../src/reservations/reservations.service.js";
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

beforeAll(async () => {
  ctx = await demarrer();
  admin = await connecter(ctx, nouveauTelephone(), { admin: true });
});
afterAll(async () => {
  await ctx?.app.close();
});

describe("authentification par OTP", () => {
  it("connecte un nouvel utilisateur et crée son compte", async () => {
    const telephone = nouveauTelephone();
    const u = await connecter(ctx, telephone);
    const moi = await api(ctx, u.jeton).get("/moi").expect(200);
    expect(moi.body.telephone).toBe(telephone);
  });

  it("normalise un numéro local (0550…) en +213", async () => {
    const r = await api(ctx).post("/auth/otp/envoyer", { telephone: "0661 23 45 67" }).expect(200);
    expect(r.body.envoye).toBe(true);
    expect(ctx.sms.dernierPour("+213661234567")).toMatch(/\d{6}/);
  });

  it("refuse un mauvais code puis bloque après 5 essais", async () => {
    const telephone = nouveauTelephone();
    await api(ctx).post("/auth/otp/envoyer", { telephone }).expect(200);
    const code = /(\d{6})/.exec(ctx.sms.dernierPour(telephone)!)![1]!;
    const faux = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      const r = await api(ctx).post("/auth/otp/verifier", { telephone, code: faux }).expect(401);
      expect(r.body).toMatchObject({ code: "OTP_INVALIDE" });
    }
    const bloque = await api(ctx).post("/auth/otp/verifier", { telephone, code }).expect(429);
    expect(bloque.body.code).toBe("TROP_DE_TENTATIVES");
  });

  it("un code ne sert qu'une fois ; le jeton de rafraîchissement tourne", async () => {
    const telephone = nouveauTelephone();
    await api(ctx).post("/auth/otp/envoyer", { telephone }).expect(200);
    const code = /(\d{6})/.exec(ctx.sms.dernierPour(telephone)!)![1];
    const r = await api(ctx).post("/auth/otp/verifier", { telephone, code }).expect(200);
    await api(ctx).post("/auth/otp/verifier", { telephone, code }).expect(401);
    const r2 = await api(ctx)
      .post("/auth/rafraichir", { jetonRafraichissement: r.body.jetonRafraichissement })
      .expect(200);
    expect(r2.body.jetonAcces).toBeTruthy();
    await api(ctx)
      .post("/auth/rafraichir", { jetonRafraichissement: r.body.jetonRafraichissement })
      .expect(401);
  });

  it("renvoie les erreurs au format { code, message, details } traduit", async () => {
    const r = await api(ctx).get("/moi").set("Accept-Language", "ar").expect(401);
    expect(r.body).toEqual({ code: "NON_AUTHENTIFIE", message: "يرجى تسجيل الدخول." });
    const v = await api(ctx).post("/auth/otp/envoyer", { telephone: "12" }).expect(400);
    expect(v.body.code).toBe("REQUETE_INVALIDE");
    expect(v.body.details[0]).toMatchObject({
      champ: "telephone",
      message: "validation.telephone",
    });
  });
});

describe("parcours de réservation en ligne", () => {
  let agence: Awaited<ReturnType<typeof creerAgenceValidee>>;
  let client: Awaited<ReturnType<typeof connecter>>;
  beforeAll(async () => {
    agence = await creerAgenceValidee(ctx, admin);
    client = await creerClientConforme(ctx);
  });

  it("une agence non validée n'apparaît pas sur le site, puis apparaît après validation", async () => {
    const nouvelle = await creerAgenceValidee(ctx, admin, { valider: false });
    const p = periode(40);
    const avant = await api(ctx)
      .get(
        `/recherche?wilaya=6&debut=${encodeURIComponent(p.debut)}&fin=${encodeURIComponent(p.fin)}&parPage=100`,
      )
      .expect(200);
    expect(avant.body.resultats.map((r: { id: string }) => r.id)).not.toContain(
      nouvelle.vehicule.id,
    );
    await api(ctx).get(`/vehicules/${nouvelle.vehicule.id}`).expect(404);
    // Le logiciel de gestion reste utilisable avant validation.
    await nouvelle.g.get("/agence/vehicules").expect(200);

    await api(ctx, admin.jeton)
      .post(`/admin/agences/${nouvelle.agenceId}/decision`, { decision: "valider" })
      .expect(200);
    const apres = await api(ctx)
      .get(
        `/recherche?wilaya=6&debut=${encodeURIComponent(p.debut)}&fin=${encodeURIComponent(p.fin)}&parPage=100`,
      )
      .expect(200);
    expect(apres.body.resultats.map((r: { id: string }) => r.id)).toContain(nouvelle.vehicule.id);
  });

  it("affiche le prix détaillé et la disponibilité", async () => {
    const p = periode(10, 7);
    const r = await api(ctx)
      .get(
        `/vehicules/${agence.vehicule.id}/prix?debut=${encodeURIComponent(p.debut)}&fin=${encodeURIComponent(p.fin)}&options=siegeBebe`,
      )
      .expect(200);
    expect(r.body).toMatchObject({
      jours: 7,
      prixJourApplique: 4500,
      sousTotalLocation: 31500,
      total: 31500 + 3500,
      caution: 30000,
      disponible: true,
    });
  });

  it("réservation → en attente de l'agence → confirmée ; visible dans le planning ; prix figé", async () => {
    const p = periode(5, 2);
    const r = await api(ctx, client.jeton)
      .post("/reservations", { vehiculeId: agence.vehicule.id, ...p })
      .expect(201);
    expect(r.body.statut).toBe("en_attente_agence");
    expect(r.body.code).toMatch(/^BEJ-[2-9A-HJKMNP-Z]{6}$/);
    expect(r.body.prixTotal).toBe(10000);
    expect(ctx.sms.dernierPour(client.telephone)).toContain(r.body.code);
    // L'agence est prévenue par SMS, même si son logiciel est fermé (D35).
    expect(ctx.sms.dernierPour("+213550000000")).toMatch(
      new RegExp(`Nouvelle réservation en ligne ${r.body.code}`),
    );

    const planning = await agence.g
      .get(`/agence/planning?debut=${encodeURIComponent(p.debut)}&fin=${encodeURIComponent(p.fin)}`)
      .expect(200);
    expect(planning.body.reservations.map((x: { id: string }) => x.id)).toContain(r.body.id);
    const tdb = await agence.g.get("/agence/tableau-de-bord").expect(200);
    expect(tdb.body.enAttente.map((x: { id: string }) => x.id)).toContain(r.body.id);

    // Le gérant augmente son tarif : la réservation garde son prix (règle 6.3.6).
    await ctx.db
      .update(tarifs)
      .set({ prixJour: 9000 })
      .where(eq(tarifs.vehiculeId, agence.vehicule.id));
    const ok = await agence.g.post(`/agence/reservations/${r.body.id}/accepter`).expect(200);
    expect(ok.body.statut).toBe("confirmee");
    expect(ok.body.prixTotal).toBe(10000);
    await ctx.db
      .update(tarifs)
      .set({ prixJour: 5000 })
      .where(eq(tarifs.vehiculeId, agence.vehicule.id));

    const mes = await api(ctx, client.jeton).get("/moi/reservations").expect(200);
    expect(mes.body.find((x: { id: string }) => x.id === r.body.id).statut).toBe("confirmee");
  });

  it("le véhicule réservé disparaît de la recherche sur la période (battement inclus)", async () => {
    const p = periode(60, 2);
    await api(ctx, client.jeton)
      .post("/reservations", { vehiculeId: agence.vehicule.id, ...p })
      .expect(201);
    const pendant = await api(ctx)
      .get(
        `/recherche?debut=${encodeURIComponent(p.debut)}&fin=${encodeURIComponent(p.fin)}&parPage=100`,
      )
      .expect(200);
    expect(pendant.body.resultats.map((x: { id: string }) => x.id)).not.toContain(
      agence.vehicule.id,
    );
    // Départ 1 h après le retour : refusé à cause des 2 h de battement.
    const juste = new Date(new Date(p.fin).getTime() + 3_600_000);
    const apres = await api(ctx)
      .get(
        `/recherche?debut=${encodeURIComponent(juste.toISOString())}&fin=${encodeURIComponent(new Date(juste.getTime() + 86_400_000).toISOString())}&parPage=100`,
      )
      .expect(200);
    expect(apres.body.resultats.map((x: { id: string }) => x.id)).not.toContain(agence.vehicule.id);
  });

  it("deux réservations simultanées sur le même véhicule et la même période : une seule passe", async () => {
    const autre = await creerClientConforme(ctx);
    const p = periode(80, 3);
    const [a, b] = await Promise.all([
      api(ctx, client.jeton).post("/reservations", { vehiculeId: agence.vehicule.id, ...p }),
      api(ctx, autre.jeton).post("/reservations", { vehiculeId: agence.vehicule.id, ...p }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const refus = a.status === 409 ? a : b;
    expect(refus.body.code).toBe("VEHICULE_INDISPONIBLE");
    // Le comptoir ne peut pas non plus prendre le créneau.
    const comptoir = await agence.g
      .post("/agence/reservations", {
        vehiculeId: agence.vehicule.id,
        ...p,
        client: { telephone: nouveauTelephone(), nom: "Comptoir", prenom: "Client" },
      })
      .expect(409);
    expect(comptoir.body.code).toBe("VEHICULE_INDISPONIBLE");
  });

  it("refuse si les conditions conducteur ne sont pas remplies", async () => {
    const sansPermis = await connecter(ctx);
    const r = await api(ctx, sansPermis.jeton)
      .post("/reservations", { vehiculeId: agence.vehicule.id, ...periode(100) })
      .expect(409);
    expect(r.body.code).toBe("CONDITIONS_CONDUCTEUR");
    expect(r.body.details.problemes).toEqual(["DATE_NAISSANCE_MANQUANTE", "PERMIS_MANQUANT"]);
  });

  it("une réservation non confirmée en 2 h expire et libère le véhicule", async () => {
    const p = periode(120, 2);
    const r = await api(ctx, client.jeton)
      .post("/reservations", { vehiculeId: agence.vehicule.id, ...p })
      .expect(201);
    const echeance = new Date(r.body.expireLe).getTime() - new Date(r.body.createdAt).getTime();
    expect(Math.round(echeance / 60_000)).toBe(120);

    const service = ctx.app.get(ReservationsService);
    expect(await service.expirer(new Date(Date.now() + 119 * 60_000))).toBe(0);
    expect(await service.expirer(new Date(Date.now() + 121 * 60_000))).toBeGreaterThanOrEqual(1);

    const [apres] = await ctx.db.select().from(reservations).where(eq(reservations.id, r.body.id));
    expect(apres!.statut).toBe("expiree");
    await agence.g.post(`/agence/reservations/${r.body.id}/accepter`).expect(409);
    // Le créneau est de nouveau réservable.
    await api(ctx, client.jeton)
      .post("/reservations", { vehiculeId: agence.vehicule.id, ...p })
      .expect(201);
  });

  it("le client annule ; l'agence refuse avec motif", async () => {
    const r1 = await api(ctx, client.jeton)
      .post("/reservations", { vehiculeId: agence.vehicule.id, ...periode(150) })
      .expect(201);
    const a = await api(ctx, client.jeton)
      .post(`/reservations/${r1.body.id}/annuler`, {})
      .expect(200);
    expect(a.body.statut).toBe("annulee_client");
    const r2 = await api(ctx, client.jeton)
      .post("/reservations", { vehiculeId: agence.vehicule.id, ...periode(160) })
      .expect(201);
    await agence.g
      .post(`/agence/reservations/${r2.body.id}/refuser`, { motif: "Véhicule en révision" })
      .expect(200);
    await agence.g.post(`/agence/reservations/${r2.body.id}/accepter`).expect(409);
  });
});

describe("isolation stricte entre agences", () => {
  it("un membre de l'agence A ne voit ni ne modifie rien de l'agence B", async () => {
    const a = await creerAgenceValidee(ctx, admin);
    const b = await creerAgenceValidee(ctx, admin);
    const client = await creerClientConforme(ctx);
    const resaB = await api(ctx, client.jeton)
      .post("/reservations", { vehiculeId: b.vehicule.id, ...periode(30) })
      .expect(201);

    // A tente d'utiliser l'identifiant de B dans l'en-tête : refusé.
    await api(ctx, a.gerant.jeton, b.agenceId).get("/agence/vehicules").expect(403);
    // A tente d'accéder aux ressources de B depuis son propre contexte : introuvables.
    await a.g.get(`/agence/vehicules/${b.vehicule.id}`).expect(404);
    await a.g.patch(`/agence/vehicules/${b.vehicule.id}`, { marque: "Piraté" }).expect(404);
    await a.g.get(`/agence/reservations/${resaB.body.id}`).expect(404);
    await a.g.post(`/agence/reservations/${resaB.body.id}/accepter`).expect(404);
    await a.g.get(`/agence/reservations/${resaB.body.id}/documents-client`).expect(404);
    await a.g.get(`/contrats/${resaB.body.id}/pdf`).expect(404);
    const liste = await a.g.get("/agence/reservations").expect(200);
    expect(liste.body.resultats.map((x: { id: string }) => x.id)).not.toContain(resaB.body.id);
    // A ne peut pas réserver au comptoir un véhicule de B.
    await a.g
      .post("/agence/reservations", {
        vehiculeId: b.vehicule.id,
        ...periode(31),
        client: { id: client.id },
      })
      .expect(404);
    // Un client ne voit pas la réservation d'un autre.
    const autre = await connecter(ctx);
    await api(ctx, autre.jeton).get(`/moi/reservations/${resaB.body.id}`).expect(404);
    await api(ctx, autre.jeton).post(`/reservations/${resaB.body.id}/annuler`, {}).expect(404);
    // Les routes admin sont réservées aux administrateurs.
    await a.g.get("/admin/agences").expect(403);
  });

  it("un employé n'a que les droits accordés par le gérant", async () => {
    const a = await creerAgenceValidee(ctx, admin);
    const telephone = nouveauTelephone();
    await a.g
      .post("/agence/membres", {
        telephone,
        nom: "Mansouri",
        prenom: "Lynda",
        role: "employe",
        permissions: ["etats_des_lieux"],
      })
      .expect(201);
    const employe = await connecter(ctx, telephone);
    const e = api(ctx, employe.jeton, a.agenceId);
    await e.get("/agence/vehicules").expect(200);
    await e.post("/agence/tarifs", { categorie: "suv", prixJour: 9000 }).expect(403);
    await e.patch("/agence/parametres", { battementMinutes: 30 }).expect(403);
    await e
      .post("/agence/reservations", {
        vehiculeId: a.vehicule.id,
        ...periode(20),
        client: { telephone: nouveauTelephone(), nom: "X", prenom: "Y" },
      })
      .expect(403);
  });
});

describe("comptoir, état des lieux, contrat, retour", () => {
  it("parcours complet au comptoir avec contrat signé et frais au retour", async () => {
    const a = await creerAgenceValidee(ctx, admin);
    const p = {
      debut: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      fin: new Date(Date.now() - 3_600_000).toISOString(),
    };
    const r = await a.g
      .post("/agence/reservations", {
        vehiculeId: a.vehicule.id,
        ...p,
        origine: "telephone",
        client: {
          telephone: nouveauTelephone(),
          nom: "Belkacem",
          prenom: "Amel",
          dateNaissance: "1988-02-03",
          permis: { numero: "BJ998877", dateDelivrance: "2010-05-05" },
        },
        options: ["siegeBebe"],
      })
      .expect(201);
    expect(r.body.statut).toBe("confirmee");

    // Départ impossible sans état des lieux.
    expect((await a.g.post(`/agence/reservations/${r.body.id}/depart`).expect(409)).body.code).toBe(
      "ETAT_DES_LIEUX_MANQUANT",
    );
    await a.g
      .post(`/agence/reservations/${r.body.id}/etat-des-lieux`, {
        moment: "depart",
        kilometrage: 20_000,
        carburant: 8,
        dommages: [{ id: "d1", zone: "pare-choc avant", x: 0.5, y: 0.05, type: "rayure" }],
        signatureClient: SIGNATURE,
      })
      .expect(201);
    const contrat = await a.g
      .post(`/agence/reservations/${r.body.id}/contrat/signer`, {
        signatureClient: SIGNATURE,
        signatureAgence: SIGNATURE,
      })
      .expect(201);
    expect(contrat.body.numero).toMatch(/^\d{4}-00001$/);
    expect(contrat.body.empreintePdf).toMatch(/^[0-9a-f]{64}$/);

    const pdf = await a.g
      .get(`/contrats/${r.body.id}/pdf`)
      .buffer(true)
      .parse((res, cb) => {
        const morceaux: Buffer[] = [];
        res.on("data", (m: Buffer) => morceaux.push(m));
        res.on("end", () => cb(null, Buffer.concat(morceaux)));
      })
      .expect(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");

    await a.g.post(`/agence/reservations/${r.body.id}/depart`).expect(200);
    await a.g
      .post(`/agence/reservations/${r.body.id}/etat-des-lieux`, {
        moment: "retour",
        kilometrage: 20_900,
        carburant: 6,
        signatureClient: SIGNATURE,
      })
      .expect(201);
    const fin = await a.g
      .post(`/agence/reservations/${r.body.id}/retour`, { fraisDommages: 0 })
      .expect(200);
    expect(fin.body.statut).toBe("terminee");
    // 3 jours × 250 km inclus = 750 ; 900 parcourus → 150 km × 20 DA ; 2/8 × 1000 DA.
    expect(fin.body.fraisRetour).toMatchObject({
      kmSupplementaires: 150,
      montantKm: 3000,
      huitiemesManquants: 2,
      montantCarburant: 2000,
      total: 5000,
    });

    const edl = await a.g.get(`/reservations/${r.body.id}/etat-des-lieux/retour/pdf`).expect(200);
    expect(edl.headers["content-type"]).toBe("application/pdf");
    // Le comptoir ne génère pas de commission ; le journal trace la signature.
    const journal = await a.g.get("/agence/journal").expect(200);
    expect(journal.body.map((l: { j: { action: string } }) => l.j.action)).toContain(
      "contrat.signer",
    );
  });

  it("blocage manuel et réaffectation par glisser-déposer (même catégorie uniquement)", async () => {
    const a = await creerAgenceValidee(ctx, admin);
    const v2 = await a.creerVehicule("citadine");
    const suv = await a.creerVehicule("suv");
    const p = periode(15, 2);
    const blocage = await a.g
      .post("/agence/blocages", { vehiculeId: v2.id, ...p, motif: "Vidange" })
      .expect(201);
    const r = await a.g
      .post("/agence/reservations", {
        vehiculeId: a.vehicule.id,
        ...p,
        client: { telephone: nouveauTelephone(), nom: "A", prenom: "B" },
      })
      .expect(201);
    expect(
      (
        await a.g
          .post(`/agence/reservations/${r.body.id}/reaffecter`, { vehiculeId: v2.id })
          .expect(409)
      ).body.code,
    ).toBe("VEHICULE_INDISPONIBLE");
    expect(
      (
        await a.g
          .post(`/agence/reservations/${r.body.id}/reaffecter`, { vehiculeId: suv.id })
          .expect(409)
      ).body.code,
    ).toBe("CATEGORIE_DIFFERENTE");
    await a.g.delete(`/agence/blocages/${blocage.body.id}`).expect(204);
    const ok = await a.g
      .post(`/agence/reservations/${r.body.id}/reaffecter`, { vehiculeId: v2.id })
      .expect(200);
    expect(ok.body.vehiculeId).toBe(v2.id);
  });
});

describe("temps réel", () => {
  it("une réservation faite sur le site apparaît chez l'agence en moins de 2 secondes", async () => {
    const a = await creerAgenceValidee(ctx, admin);
    const client = await creerClientConforme(ctx);
    const socket: Socket = io(ctx.url, {
      path: "/socket.io",
      auth: { jeton: a.gerant.jeton },
      transports: ["websocket"],
    });
    try {
      await new Promise<void>((ok, ko) => {
        socket.once("connecte", () => ok());
        socket.once("connect_error", ko);
      });
      const recu = new Promise<{ id: string; delai: number }>((ok) => {
        const t0 = Date.now();
        socket.once("reservation.creee", (r: { id: string }) =>
          ok({ id: r.id, delai: Date.now() - t0 }),
        );
      });
      const r = await api(ctx, client.jeton)
        .post("/reservations", { vehiculeId: a.vehicule.id, ...periode(25) })
        .expect(201);
      const evenement = await recu;
      expect(evenement.id).toBe(r.body.id);
      expect(evenement.delai).toBeLessThan(2000);
    } finally {
      socket.close();
    }
  });

  it("refuse une connexion WebSocket sans jeton valide", async () => {
    const socket = io(ctx.url, {
      path: "/socket.io",
      auth: { jeton: "faux" },
      transports: ["websocket"],
    });
    const erreur = await new Promise<{ code: string }>((ok) => socket.once("erreur", ok));
    expect(erreur.code).toBe("NON_AUTHENTIFIE");
    socket.close();
  });
});

describe("documentation", () => {
  it("publie la description OpenAPI", async () => {
    const r = await api(ctx).get("/openapi.json").expect(200);
    expect(r.body.openapi).toMatch(/^3\./);
    expect(Object.keys(r.body.paths)).toContain("/api/v1/reservations");
  });
});
