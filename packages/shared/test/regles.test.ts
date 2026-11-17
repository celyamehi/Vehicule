import { describe, expect, it } from "vitest";
import {
  BAREMES_ANNULATION,
  ErreurTarif,
  STATUTS_RESERVATION,
  calculerCommission,
  calculerFraisRetour,
  calculerPrix,
  calculerRemboursement,
  choisirTarif,
  depuisHeureAlger as a,
  echeanceExpiration,
  estBloquant,
  joursFactures,
  litigePossible,
  prixJourDegressif,
  statutInitial,
  transitionAutorisee,
  verifierConditionsConducteur,
  type TarifPourCalcul,
} from "../src/index.js";

const tarifBase: TarifPourCalcul = {
  id: "t-base",
  vehiculeId: "v1",
  categorieId: null,
  prixJour: 5000,
  paliers: [
    { aPartirDeJours: 7, prixJour: 4500 },
    { aPartirDeJours: 30, prixJour: 3800 },
  ],
  supplements: {
    siegeBebe: { parJour: 500 },
    conducteurAdditionnel: { forfait: 1500 },
    livraison: { forfait: 2000 },
  },
  saisonDebut: null,
  saisonFin: null,
  caution: 40000,
};

describe("statuts (6.2)", () => {
  it("seuls les 4 statuts actifs bloquent le véhicule", () => {
    const bloquants = STATUTS_RESERVATION.filter(estBloquant);
    expect(bloquants).toEqual([
      "en_attente_paiement",
      "en_attente_agence",
      "confirmee",
      "en_cours",
    ]);
  });

  it.each([
    ["en_attente_paiement", "en_attente_agence", true],
    ["en_attente_paiement", "expiree", true],
    ["en_attente_agence", "confirmee", true],
    ["en_attente_agence", "refusee", true],
    ["en_attente_agence", "expiree", true],
    ["confirmee", "en_cours", true],
    ["confirmee", "annulee_client", true],
    ["confirmee", "annulee_agence", true],
    ["confirmee", "non_presentation", true],
    ["en_cours", "terminee", true],
    ["terminee", "litige", true],
    ["en_attente_agence", "en_cours", false],
    ["confirmee", "terminee", false],
    ["en_cours", "annulee_client", false],
    ["terminee", "confirmee", false],
    ["refusee", "confirmee", false],
    ["expiree", "confirmee", false],
    ["annulee_client", "confirmee", false],
  ] as const)("%s → %s : %s", (de, vers, attendu) => {
    expect(transitionAutorisee(de, vers)).toBe(attendu);
  });

  it("statut initial selon l'origine", () => {
    const base = { paiementEnLigne: false, confirmationInstantanee: false };
    expect(statutInitial({ ...base, origine: "plateforme" })).toBe("en_attente_agence");
    expect(statutInitial({ ...base, origine: "plateforme", confirmationInstantanee: true })).toBe(
      "confirmee",
    );
    expect(statutInitial({ ...base, origine: "plateforme", paiementEnLigne: true })).toBe(
      "en_attente_paiement",
    );
    expect(statutInitial({ ...base, origine: "comptoir" })).toBe("confirmee");
    expect(statutInitial({ ...base, origine: "telephone" })).toBe("confirmee");
    expect(statutInitial({ ...base, origine: "comptoir", departImmediat: true })).toBe("en_cours");
    expect(statutInitial({ ...base, origine: "blocage" })).toBe("confirmee");
  });

  it("échéances d'expiration : 15 min (paiement), 2 h (agence), aucune sinon", () => {
    const t = a("2026-07-01T10:00");
    expect(echeanceExpiration("en_attente_paiement", t)?.toISOString()).toBe(
      "2026-07-01T09:15:00.000Z",
    );
    expect(echeanceExpiration("en_attente_agence", t)?.toISOString()).toBe(
      "2026-07-01T11:00:00.000Z",
    );
    expect(echeanceExpiration("confirmee", t)).toBeNull();
  });

  it("litige possible jusqu'à 72 h après le retour", () => {
    const retour = a("2026-07-01T10:00");
    expect(litigePossible(retour, a("2026-07-04T10:00"))).toBe(true);
    expect(litigePossible(retour, a("2026-07-04T10:01"))).toBe(false);
  });
});

describe("durée facturée", () => {
  it.each([
    ["2026-07-01T10:00", "2026-07-01T12:00", 1],
    ["2026-07-01T10:00", "2026-07-02T10:00", 1],
    ["2026-07-01T10:00", "2026-07-02T10:59", 1],
    ["2026-07-01T10:00", "2026-07-02T11:00", 2],
    ["2026-07-01T10:00", "2026-07-08T10:00", 7],
  ])("%s → %s = %i jour(s)", (debut, fin, jours) => {
    expect(joursFactures(a(debut), a(fin))).toBe(jours);
  });

  it("refuse une fin avant le début", () => {
    expect(() => joursFactures(a("2026-07-02T10:00"), a("2026-07-01T10:00"))).toThrow(RangeError);
  });
});

describe("prix (3.3, 4.8)", () => {
  it("calcule un prix simple sans option", () => {
    const p = calculerPrix({
      debut: a("2026-07-01T10:00"),
      fin: a("2026-07-04T10:00"),
      tarifs: [tarifBase],
    });
    expect(p).toMatchObject({
      jours: 3,
      prixJourApplique: 5000,
      sousTotalLocation: 15000,
      total: 15000,
      caution: 40000,
      tarifId: "t-base",
    });
  });

  it("applique le palier dégressif le plus élevé atteint", () => {
    expect(prixJourDegressif(tarifBase, 6)).toBe(5000);
    expect(prixJourDegressif(tarifBase, 7)).toBe(4500);
    expect(prixJourDegressif(tarifBase, 45)).toBe(3800);
    // Un palier plus cher que le prix de base est ignoré.
    expect(
      prixJourDegressif({ prixJour: 4000, paliers: [{ aPartirDeJours: 7, prixJour: 4200 }] }, 10),
    ).toBe(4000);
  });

  it("ajoute options par jour, forfaits et livraison, puis la remise", () => {
    const p = calculerPrix({
      debut: a("2026-07-01T10:00"),
      fin: a("2026-07-08T10:00"),
      tarifs: [tarifBase],
      options: ["siegeBebe", "conducteurAdditionnel", "siegeBebe"],
      livraison: true,
      remise: 1000,
    });
    expect(p.jours).toBe(7);
    expect(p.sousTotalLocation).toBe(31500);
    expect(p.options).toEqual([
      { code: "siegeBebe", montant: 3500 },
      { code: "conducteurAdditionnel", montant: 1500 },
    ]);
    expect(p.fraisLivraison).toBe(2000);
    expect(p.remise).toBe(1000);
    expect(p.total).toBe(31500 + 3500 + 1500 + 2000 - 1000);
    expect(Number.isInteger(p.total)).toBe(true);
  });

  it("plafonne la remise au montant brut", () => {
    const p = calculerPrix({
      debut: a("2026-07-01T10:00"),
      fin: a("2026-07-02T10:00"),
      tarifs: [tarifBase],
      remise: 999999,
    });
    expect(p.total).toBe(0);
  });

  it("refuse une option non proposée", () => {
    expect(() =>
      calculerPrix({
        debut: a("2026-07-01T10:00"),
        fin: a("2026-07-02T10:00"),
        tarifs: [tarifBase],
        options: ["gps"],
      }),
    ).toThrow(ErreurTarif);
    expect(() =>
      calculerPrix({
        debut: a("2026-07-01T10:00"),
        fin: a("2026-07-02T10:00"),
        tarifs: [{ ...tarifBase, supplements: {} }],
        livraison: true,
      }),
    ).toThrow(ErreurTarif);
  });

  it("préfère le tarif du véhicule, puis le tarif de saison", () => {
    const categorie = {
      ...tarifBase,
      id: "t-cat",
      vehiculeId: null,
      categorieId: "c1",
      prixJour: 4000,
    };
    const ete = {
      ...tarifBase,
      id: "t-ete",
      prixJour: 7000,
      saisonDebut: "2026-06-15",
      saisonFin: "2026-09-15",
    };
    const inactif = { ...tarifBase, id: "t-off", prixJour: 1, actif: false };
    expect(choisirTarif([categorie, tarifBase], a("2026-01-10T10:00")).id).toBe("t-base");
    expect(choisirTarif([categorie, tarifBase, ete], a("2026-07-01T10:00")).id).toBe("t-ete");
    expect(choisirTarif([categorie, tarifBase, ete], a("2026-09-16T10:00")).id).toBe("t-base");
    expect(choisirTarif([categorie, inactif], a("2026-07-01T10:00")).id).toBe("t-cat");
    // La saison est jugée sur la date à Alger (00:30 à Alger le 15 juin = 23:30 UTC le 14).
    expect(choisirTarif([tarifBase, ete], a("2026-06-15T00:30")).id).toBe("t-ete");
  });

  it("échoue sans tarif applicable", () => {
    expect(() => choisirTarif([], a("2026-07-01T10:00"))).toThrow(ErreurTarif);
  });
});

describe("annulation (6.3.4, 6.3.5)", () => {
  const debut = a("2026-07-10T10:00");
  const cas = (politique: "souple" | "moderee" | "stricte", heuresAvant: number) =>
    calculerRemboursement({
      politique,
      montantPaye: 10_000,
      debut,
      annuleLe: new Date(debut.getTime() - heuresAvant * 3_600_000),
      par: "client",
    });

  it.each([
    ["souple", 48, 100],
    ["souple", 24, 100],
    ["souple", 23, 50],
    ["souple", 0, 50],
    ["moderee", 72, 100],
    ["moderee", 71, 50],
    ["moderee", 24, 50],
    ["moderee", 23, 0],
    ["stricte", 168, 100],
    ["stricte", 100, 50],
    ["stricte", 72, 50],
    ["stricte", 71, 0],
  ] as const)("%s, %i h avant : %i %%", (politique, heures, pourcentage) => {
    expect(cas(politique, heures)).toEqual({ pourcentage, montant: (10_000 * pourcentage) / 100 });
  });

  it("rien n'est remboursé après l'heure de départ", () => {
    expect(cas("souple", -1)).toEqual({ pourcentage: 0, montant: 0 });
  });

  it("remboursement intégral si l'agence annule", () => {
    expect(
      calculerRemboursement({
        politique: "stricte",
        montantPaye: 7_777,
        debut,
        annuleLe: debut,
        par: "agence",
      }),
    ).toEqual({ pourcentage: 100, montant: 7_777 });
  });

  it("les barèmes vont du plus au moins favorable et finissent à 0 h", () => {
    for (const bareme of Object.values(BAREMES_ANNULATION)) {
      expect(bareme.at(-1)?.heuresAvantDepartMin).toBe(0);
      const heures = bareme.map((p) => p.heuresAvantDepartMin);
      expect([...heures].sort((x, y) => y - x)).toEqual(heures);
    }
  });

  it("arrondit le remboursement à l'entier inférieur", () => {
    expect(
      calculerRemboursement({
        politique: "souple",
        montantPaye: 3_333,
        debut,
        annuleLe: debut,
        par: "client",
      }).montant,
    ).toBe(1_666);
  });
});

describe("conditions conducteur (6.3.7)", () => {
  const base = {
    depart: a("2026-07-01T10:00"),
    fin: a("2026-07-05T10:00"),
    ageMinimum: 21,
    ancienneteMinPermisAnnees: 2,
    dateNaissance: "1990-01-01",
    permis: { dateDelivrance: "2015-01-01", dateExpiration: "2030-01-01" },
  };

  it("accepte un conducteur conforme", () => {
    expect(verifierConditionsConducteur(base)).toEqual([]);
  });

  it("vérifie l'âge le jour du départ (anniversaire compris)", () => {
    expect(verifierConditionsConducteur({ ...base, dateNaissance: "2005-07-01" })).toEqual([]);
    expect(verifierConditionsConducteur({ ...base, dateNaissance: "2005-07-02" })).toEqual([
      "AGE_INSUFFISANT",
    ]);
  });

  it("vérifie l'ancienneté et l'expiration du permis", () => {
    expect(
      verifierConditionsConducteur({
        ...base,
        permis: { dateDelivrance: "2025-01-01", dateExpiration: null },
      }),
    ).toEqual(["PERMIS_TROP_RECENT"]);
    expect(
      verifierConditionsConducteur({
        ...base,
        permis: { dateDelivrance: "2015-01-01", dateExpiration: "2026-07-03" },
      }),
    ).toEqual(["PERMIS_EXPIRE"]);
  });

  it("signale les informations manquantes", () => {
    expect(verifierConditionsConducteur({ ...base, dateNaissance: null, permis: null })).toEqual([
      "DATE_NAISSANCE_MANQUANTE",
      "PERMIS_MANQUANT",
    ]);
  });
});

describe("commission (6.3.8)", () => {
  it("seulement sur les réservations venues de la plateforme", () => {
    expect(
      calculerCommission({ origine: "plateforme", montant: 20_000, tauxCommissionBp: 1000 }),
    ).toBe(2_000);
    expect(
      calculerCommission({ origine: "plateforme", montant: 12_345, tauxCommissionBp: 850 }),
    ).toBe(1_049);
    for (const origine of ["comptoir", "telephone", "blocage"] as const)
      expect(calculerCommission({ origine, montant: 20_000, tauxCommissionBp: 1000 })).toBe(0);
  });
});

describe("frais au retour (4.6)", () => {
  const base = {
    depart: { kilometrage: 10_000, carburant: 8 },
    retour: { kilometrage: 10_600, carburant: 6 },
    debut: a("2026-07-01T10:00"),
    finPrevue: a("2026-07-03T10:00"),
    retourReel: a("2026-07-03T10:30"),
    kmInclusParJour: 250,
    prixJourApplique: 5000,
    prixKmSupplementaire: 20,
    prixHuitiemeCarburant: 1000,
  };

  it("facture les km au-delà du forfait et le carburant manquant", () => {
    expect(calculerFraisRetour(base)).toEqual({
      kmParcourus: 600,
      kmInclus: 500,
      kmSupplementaires: 100,
      montantKm: 2000,
      huitiemesManquants: 2,
      montantCarburant: 2000,
      joursRetard: 0,
      montantRetard: 0,
      montantDommages: 0,
      total: 4000,
    });
  });

  it("facture un jour de retard au-delà de la tolérance et élargit le forfait km", () => {
    const f = calculerFraisRetour({
      ...base,
      retourReel: a("2026-07-03T11:30"),
      montantDommages: 3000,
    });
    expect(f.joursRetard).toBe(1);
    expect(f.montantRetard).toBe(5000);
    expect(f.kmInclus).toBe(750);
    expect(f.kmSupplementaires).toBe(0);
    expect(f.total).toBe(5000 + 2000 + 3000);
  });

  it("kilométrage illimité, plein refait, retour anticipé : aucun frais", () => {
    const f = calculerFraisRetour({
      ...base,
      kmInclusParJour: null,
      retour: { kilometrage: 12_000, carburant: 8 },
      retourReel: a("2026-07-02T09:00"),
    });
    expect(f.total).toBe(0);
    expect(f.kmInclus).toBeNull();
  });
});
