import { describe, expect, it } from "vitest";
import {
  bilanCaisse,
  joursChevauchement,
  sensPaiement,
  statistiquesFlotte,
} from "../src/caisse.js";

describe("caisse", () => {
  it("classe les paiements : entrées, remboursements, cautions à part", () => {
    expect(sensPaiement("acompte")).toBe("entree");
    expect(sensPaiement("solde")).toBe("entree");
    expect(sensPaiement("frais")).toBe("entree");
    expect(sensPaiement("remboursement")).toBe("sortie");
    expect(sensPaiement("caution")).toBe("caution");
    expect(sensPaiement("restitution_caution")).toBe("caution");
  });

  it("calcule entrées, sorties, solde et cautions détenues", () => {
    const b = bilanCaisse([
      { origine: "paiement", type: "acompte", montant: 5_000 },
      { origine: "paiement", type: "solde", montant: 10_000 },
      { origine: "paiement", type: "remboursement", montant: 2_000 },
      { origine: "paiement", type: "caution", montant: 30_000 },
      { origine: "paiement", type: "restitution_caution", montant: 30_000 },
      { origine: "paiement", type: "caution", montant: 20_000 },
      { origine: "depense", montant: 8_000 },
      { origine: "entretien", montant: 4_500 },
    ]);
    expect(b).toEqual({ entrees: 15_000, sorties: 14_500, solde: 500, cautionsDetenues: 20_000 });
  });

  it("caisse vide : tout à zéro", () => {
    expect(bilanCaisse([])).toEqual({ entrees: 0, sorties: 0, solde: 0, cautionsDetenues: 0 });
  });

  it("solde négatif quand les dépenses dépassent les entrées", () => {
    expect(bilanCaisse([{ origine: "depense", montant: 3_000 }]).solde).toBe(-3_000);
  });
});

describe("statistiques des véhicules", () => {
  const j = (s: string) => new Date(`${s}T00:00:00+01:00`);

  it("ne compte que les jours dans la période", () => {
    expect(
      joursChevauchement(j("2026-10-28"), j("2026-11-03"), j("2026-11-01"), j("2026-12-01")),
    ).toBe(2);
    expect(
      joursChevauchement(j("2026-12-02"), j("2026-12-05"), j("2026-11-01"), j("2026-12-01")),
    ).toBe(0);
  });

  it("classe par marge et par nombre de locations", () => {
    const s = statistiquesFlotte(
      [
        { vehiculeId: "a", locations: 5, joursLoues: 12, revenus: 60_000, couts: 40_000 },
        { vehiculeId: "b", locations: 2, joursLoues: 15, revenus: 50_000, couts: 5_000 },
        { vehiculeId: "c", locations: 5, joursLoues: 20, revenus: 30_000, couts: 0 },
      ],
      30,
    );
    expect(s.plusRentables.map((v) => v.vehiculeId)).toEqual(["b", "c", "a"]);
    expect(s.plusLoues.map((v) => v.vehiculeId)).toEqual(["c", "a", "b"]);
    expect(s.vehicules[1]!.tauxOccupation).toBe(50);
    expect(s.totaux).toEqual({ locations: 12, revenus: 140_000, couts: 45_000, marge: 95_000 });
  });

  it("taux d'occupation plafonné à 100 %", () => {
    const s = statistiquesFlotte(
      [{ vehiculeId: "a", locations: 1, joursLoues: 40, revenus: 0, couts: 0 }],
      30,
    );
    expect(s.vehicules[0]!.tauxOccupation).toBe(100);
  });
});
