/**
 * Règle 6.3.1 (anti-double réservation) et 6.3.2 (battement), garanties par PostgreSQL.
 * Ces tests tournent sur une vraie base (DATABASE_URL_TEST).
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { estViolationChevauchement, infosErreurPg } from "../src/erreurs.js";
import { reservations } from "../src/schema.js";
import { baseDeTest, creerJeuDeDonnees, valeursReservation } from "./outils.js";

const base = baseDeTest(25);
const { db } = base;
afterAll(() => base.fermer());

async function inserer(valeurs: typeof reservations.$inferInsert) {
  const [r] = await db.insert(reservations).values(valeurs).returning();
  return r!;
}

async function attendreRefus(promesse: Promise<unknown>) {
  const erreur = await promesse.then(
    () => null,
    (e: unknown) => e,
  );
  expect(erreur, "la base aurait dû refuser la réservation").not.toBeNull();
  expect(estViolationChevauchement(erreur)).toBe(true);
}

describe("anti-double réservation (contrainte pas_de_chevauchement)", () => {
  let jeu: Awaited<ReturnType<typeof creerJeuDeDonnees>>;
  beforeAll(async () => {
    jeu = await creerJeuDeDonnees(db);
  });

  it("refuse deux réservations qui se chevauchent sur le même véhicule", async () => {
    const vehicule = await jeu.creerVehicule();
    const j = { ...jeu, vehicule };
    await inserer(valeursReservation(j, "2027-07-01T10:00:00", "2027-07-05T10:00:00"));
    await attendreRefus(
      inserer(valeursReservation(j, "2027-07-04T10:00:00", "2027-07-08T10:00:00")),
    );
    // Période incluse dans la première
    await attendreRefus(
      inserer(valeursReservation(j, "2027-07-02T10:00:00", "2027-07-03T10:00:00")),
    );
  });

  it("refuse le chevauchement quelle que soit l'origine (plateforme, comptoir, téléphone, blocage)", async () => {
    const vehicule = await jeu.creerVehicule();
    const j = { ...jeu, vehicule };
    await inserer(
      valeursReservation(j, "2027-08-01T10:00:00", "2027-08-03T10:00:00", {
        origine: "plateforme",
        statut: "en_attente_agence",
        expireLe: new Date("2027-07-31T12:00:00+01:00"),
      }),
    );
    for (const origine of ["comptoir", "telephone"] as const) {
      await attendreRefus(
        inserer(valeursReservation(j, "2027-08-02T10:00:00", "2027-08-04T10:00:00", { origine })),
      );
    }
    await attendreRefus(
      inserer(
        valeursReservation(j, "2027-08-02T10:00:00", "2027-08-04T10:00:00", {
          origine: "blocage",
          clientId: null,
          motifBlocage: "Entretien",
        }),
      ),
    );
  });

  it("deux réservations simultanées sur le même véhicule et la même période : une seule passe", async () => {
    const vehicule = await jeu.creerVehicule();
    const j = { ...jeu, vehicule };
    const resultats = await Promise.allSettled([
      inserer(valeursReservation(j, "2027-09-01T10:00:00", "2027-09-04T10:00:00")),
      inserer(valeursReservation(j, "2027-09-01T10:00:00", "2027-09-04T10:00:00")),
    ]);
    expect(resultats.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refus = resultats.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(estViolationChevauchement(refus.reason)).toBe(true);
  });

  it("vingt tentatives concurrentes sur des périodes qui se chevauchent : une seule passe", async () => {
    const vehicule = await jeu.creerVehicule();
    const j = { ...jeu, vehicule };
    const tentatives = Array.from({ length: 20 }, (_, i) => {
      const jour = String(10 + (i % 3)).padStart(2, "0");
      return inserer(valeursReservation(j, `2027-10-${jour}T09:00:00`, "2027-10-15T18:00:00"));
    });
    const resultats = await Promise.allSettled(tentatives);
    expect(resultats.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of resultats) {
      if (r.status === "rejected") expect(estViolationChevauchement(r.reason)).toBe(true);
    }
    const enBase = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(reservations)
      .where(eq(reservations.vehiculeId, vehicule.id));
    expect(enBase[0]!.n).toBe(1);
  });

  it("accepte la même période sur deux véhicules différents", async () => {
    const v1 = await jeu.creerVehicule();
    const v2 = await jeu.creerVehicule();
    await inserer(
      valeursReservation({ ...jeu, vehicule: v1 }, "2027-11-01T10:00:00", "2027-11-02T10:00:00"),
    );
    await inserer(
      valeursReservation({ ...jeu, vehicule: v2 }, "2027-11-01T10:00:00", "2027-11-02T10:00:00"),
    );
  });

  it.each([
    "terminee",
    "refusee",
    "expiree",
    "annulee_client",
    "annulee_agence",
    "non_presentation",
    "litige",
  ] as const)("une réservation au statut « %s » ne bloque pas le véhicule", async (statut) => {
    const vehicule = await jeu.creerVehicule();
    const j = { ...jeu, vehicule };
    await inserer(valeursReservation(j, "2027-12-01T10:00:00", "2027-12-05T10:00:00", { statut }));
    await inserer(valeursReservation(j, "2027-12-02T10:00:00", "2027-12-04T10:00:00"));
  });

  it.each(["en_attente_paiement", "en_attente_agence", "confirmee", "en_cours"] as const)(
    "une réservation au statut « %s » bloque le véhicule",
    async (statut) => {
      const vehicule = await jeu.creerVehicule();
      const j = { ...jeu, vehicule };
      await inserer(
        valeursReservation(j, "2028-01-01T10:00:00", "2028-01-05T10:00:00", {
          statut,
          expireLe: new Date("2027-12-31T10:00:00+01:00"),
        }),
      );
      await attendreRefus(
        inserer(valeursReservation(j, "2028-01-03T10:00:00", "2028-01-06T10:00:00")),
      );
    },
  );

  it("refuse de réactiver une réservation annulée si le créneau a été repris entre-temps", async () => {
    const vehicule = await jeu.creerVehicule();
    const j = { ...jeu, vehicule };
    const annulee = await inserer(
      valeursReservation(j, "2028-02-01T10:00:00", "2028-02-03T10:00:00", {
        statut: "annulee_client",
      }),
    );
    await inserer(valeursReservation(j, "2028-02-01T10:00:00", "2028-02-03T10:00:00"));
    await attendreRefus(
      db.update(reservations).set({ statut: "confirmee" }).where(eq(reservations.id, annulee.id)),
    );
  });

  it("refuse de déplacer une réservation sur un créneau déjà pris", async () => {
    const vehicule = await jeu.creerVehicule();
    const j = { ...jeu, vehicule };
    await inserer(valeursReservation(j, "2028-03-01T10:00:00", "2028-03-03T10:00:00"));
    const seconde = await inserer(
      valeursReservation(j, "2028-03-10T10:00:00", "2028-03-12T10:00:00"),
    );
    await attendreRefus(
      db
        .update(reservations)
        .set({ debut: new Date("2028-03-02T10:00:00+01:00") })
        .where(eq(reservations.id, seconde.id)),
    );
  });

  it("un blocage manuel (entretien) bloque les nouvelles réservations", async () => {
    const vehicule = await jeu.creerVehicule();
    const j = { ...jeu, vehicule };
    await inserer(
      valeursReservation(j, "2028-04-01T08:00:00", "2028-04-02T18:00:00", {
        origine: "blocage",
        clientId: null,
        prixTotal: 0,
        motifBlocage: "Vidange",
      }),
    );
    await attendreRefus(
      inserer(valeursReservation(j, "2028-04-02T10:00:00", "2028-04-04T10:00:00")),
    );
  });
});

describe("battement entre deux locations (règle 6.3.2)", () => {
  it("ajoute le battement de l'agence (2 h par défaut) à la fin de la période", async () => {
    const jeu = await creerJeuDeDonnees(db);
    const r = await inserer(valeursReservation(jeu, "2028-05-01T10:00:00", "2028-05-03T10:00:00"));
    const [ligne] = await db.execute<{ debut_periode: Date; fin_periode: Date }>(
      sql`select lower(periode) as debut_periode, upper(periode) as fin_periode from reservations where id = ${r.id}`,
    );
    expect(new Date(ligne!.debut_periode).toISOString()).toBe("2028-05-01T09:00:00.000Z");
    expect(new Date(ligne!.fin_periode).toISOString()).toBe("2028-05-03T11:00:00.000Z"); // 10 h + 2 h, Alger
  });

  it("refuse un départ pendant le battement et l'accepte juste après", async () => {
    const jeu = await creerJeuDeDonnees(db);
    await inserer(valeursReservation(jeu, "2028-06-01T10:00:00", "2028-06-03T10:00:00"));
    // Retour à 10 h, battement jusqu'à 12 h : départ à 11 h refusé.
    await attendreRefus(
      inserer(valeursReservation(jeu, "2028-06-03T11:00:00", "2028-06-05T10:00:00")),
    );
    // Départ à 12 h pile : accepté (borne supérieure exclue).
    await inserer(valeursReservation(jeu, "2028-06-03T12:00:00", "2028-06-05T10:00:00"));
  });

  it("respecte un battement paramétré par l'agence (30 min)", async () => {
    const jeu = await creerJeuDeDonnees(db, { battementMinutes: 30 });
    await inserer(valeursReservation(jeu, "2028-07-01T10:00:00", "2028-07-02T10:00:00"));
    await attendreRefus(
      inserer(valeursReservation(jeu, "2028-07-02T10:20:00", "2028-07-03T10:00:00")),
    );
    await inserer(valeursReservation(jeu, "2028-07-02T10:30:00", "2028-07-03T10:00:00"));
  });

  it("recalcule la période quand les dates changent, même si on essaie de la forcer", async () => {
    const jeu = await creerJeuDeDonnees(db);
    const r = await inserer(valeursReservation(jeu, "2028-08-01T10:00:00", "2028-08-02T10:00:00"));
    await db
      .update(reservations)
      .set({ fin: new Date("2028-08-04T10:00:00+01:00"), periode: "empty" })
      .where(eq(reservations.id, r.id));
    const [ligne] = await db.execute<{ fin_periode: Date }>(
      sql`select upper(periode) as fin_periode from reservations where id = ${r.id}`,
    );
    expect(new Date(ligne!.fin_periode).toISOString()).toBe("2028-08-04T11:00:00.000Z");
  });
});

describe("intégrité des réservations", () => {
  it("refuse un véhicule appartenant à une autre agence", async () => {
    const a = await creerJeuDeDonnees(db);
    const b = await creerJeuDeDonnees(db);
    const erreur = await inserer(
      valeursReservation(
        { ...a, vehicule: b.vehicule },
        "2028-09-01T10:00:00",
        "2028-09-02T10:00:00",
      ),
    ).catch((e: unknown) => e);
    expect(infosErreurPg(erreur)?.contrainte).toBe("reservations_vehicule_meme_agence_fk");
  });

  it("refuse une date de fin antérieure ou égale au début", async () => {
    const jeu = await creerJeuDeDonnees(db);
    const erreur = await inserer(
      valeursReservation(jeu, "2028-09-05T10:00:00", "2028-09-05T10:00:00"),
    ).catch((e: unknown) => e);
    expect(infosErreurPg(erreur)?.contrainte).toBe("reservations_dates_coherentes");
  });

  it("refuse un montant négatif", async () => {
    const jeu = await creerJeuDeDonnees(db);
    const erreur = await inserer(
      valeursReservation(jeu, "2028-09-10T10:00:00", "2028-09-11T10:00:00", { prixTotal: -1 }),
    ).catch((e: unknown) => e);
    expect(infosErreurPg(erreur)?.contrainte).toBe("reservations_montants_positifs");
  });

  it("exige un client sauf pour un blocage", async () => {
    const jeu = await creerJeuDeDonnees(db);
    const erreur = await inserer(
      valeursReservation(jeu, "2028-09-12T10:00:00", "2028-09-13T10:00:00", { clientId: null }),
    ).catch((e: unknown) => e);
    expect(infosErreurPg(erreur)?.contrainte).toBe("reservations_client_obligatoire");
  });

  it("exige une échéance d'expiration pour une réservation en attente", async () => {
    const jeu = await creerJeuDeDonnees(db);
    const erreur = await inserer(
      valeursReservation(jeu, "2028-09-14T10:00:00", "2028-09-15T10:00:00", {
        statut: "en_attente_agence",
        expireLe: null,
      }),
    ).catch((e: unknown) => e);
    expect(infosErreurPg(erreur)?.contrainte).toBe("reservations_expiration_si_attente");
  });

  it("met à jour updated_at à chaque modification", async () => {
    const jeu = await creerJeuDeDonnees(db);
    const r = await inserer(valeursReservation(jeu, "2028-09-20T10:00:00", "2028-09-21T10:00:00"));
    await new Promise((ok) => setTimeout(ok, 20));
    const [maj] = await db
      .update(reservations)
      .set({ noteInterne: "Client fidèle" })
      .where(eq(reservations.id, r.id))
      .returning();
    expect(maj!.updatedAt.getTime()).toBeGreaterThan(r.updatedAt.getTime());
  });
});

describe("estViolationChevauchement", () => {
  it("ne reconnaît que la contrainte pas_de_chevauchement", () => {
    expect(
      estViolationChevauchement({ code: "23P01", constraint_name: "pas_de_chevauchement" }),
    ).toBe(true);
    expect(
      estViolationChevauchement({
        cause: { code: "23P01", constraint_name: "pas_de_chevauchement" },
      }),
    ).toBe(true);
    expect(estViolationChevauchement({ code: "23P01", constraint_name: "autre" })).toBe(false);
    expect(estViolationChevauchement({ code: "23505" })).toBe(false);
    expect(estViolationChevauchement(new Error("x"))).toBe(false);
    expect(estViolationChevauchement(null)).toBe(false);
    expect(infosErreurPg("texte")).toBeUndefined();
  });
});
