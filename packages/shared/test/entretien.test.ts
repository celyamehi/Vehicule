import { describe, expect, it } from "vitest";
import {
  ajouterMois,
  calculerRappels,
  etatEcheance,
  prochaineEcheance,
  rentabilite,
} from "../src/index.js";

describe("entretien (4.10)", () => {
  it("ajoute des mois en gérant les fins de mois", () => {
    expect(ajouterMois("2026-01-31", 1)).toBe("2026-02-28");
    expect(ajouterMois("2026-11-18", 12)).toBe("2027-11-18");
    expect(ajouterMois("2024-02-29", 12)).toBe("2025-02-28");
  });

  it("propose la prochaine échéance selon le type", () => {
    expect(prochaineEcheance("vidange", "2026-03-01", 42_000)).toEqual({
      date: "2027-03-01",
      km: 52_000,
    });
    expect(prochaineEcheance("assurance", "2026-03-01", 42_000)).toEqual({
      date: "2027-03-01",
      km: null,
    });
    expect(prochaineEcheance("freins", "2026-03-01", null)).toEqual({ date: null, km: null });
    expect(prochaineEcheance("reparation", "2026-03-01", 10)).toEqual({ date: null, km: null });
  });

  it("la plus urgente entre date et kilométrage l'emporte", () => {
    const base = { aujourdhui: "2026-11-18", kilometrageActuel: 50_000 };
    expect(etatEcheance({ ...base, echeanceDate: "2027-06-01", echeanceKm: 49_000 }).niveau).toBe(
      "en_retard",
    );
    expect(etatEcheance({ ...base, echeanceDate: "2026-11-17", echeanceKm: null }).niveau).toBe(
      "en_retard",
    );
    expect(etatEcheance({ ...base, echeanceDate: "2026-12-01", echeanceKm: 80_000 })).toEqual({
      niveau: "bientot",
      joursRestants: 13,
      kmRestants: 30_000,
    });
    expect(etatEcheance({ ...base, echeanceDate: null, echeanceKm: 50_800 }).niveau).toBe(
      "bientot",
    );
    expect(etatEcheance({ ...base, echeanceDate: "2027-06-01", echeanceKm: 60_000 }).niveau).toBe(
      "ok",
    );
  });

  it("ne garde que la dernière intervention par véhicule et par type, triée par urgence", () => {
    const rappels = calculerRappels(
      [
        {
          vehiculeId: "v1",
          type: "vidange",
          date: "2025-01-10",
          prochaineEcheanceDate: "2026-01-10",
          prochaineEcheanceKm: 40_000,
        },
        {
          vehiculeId: "v1",
          type: "vidange",
          date: "2026-06-01",
          prochaineEcheanceDate: "2027-06-01",
          prochaineEcheanceKm: 59_500,
        },
        {
          vehiculeId: "v1",
          type: "assurance",
          date: "2025-11-25",
          prochaineEcheanceDate: "2026-11-25",
          prochaineEcheanceKm: null,
        },
        {
          vehiculeId: "v2",
          type: "controle_technique",
          date: "2025-10-01",
          prochaineEcheanceDate: "2026-10-01",
          prochaineEcheanceKm: null,
        },
        {
          vehiculeId: "v2",
          type: "reparation",
          date: "2026-02-01",
          prochaineEcheanceDate: null,
          prochaineEcheanceKm: null,
        },
        {
          vehiculeId: "inconnu",
          type: "vidange",
          date: "2026-01-01",
          prochaineEcheanceDate: "2026-01-02",
          prochaineEcheanceKm: null,
        },
      ],
      [
        { id: "v1", kilometrage: 59_000 },
        { id: "v2", kilometrage: 20_000 },
      ],
      "2026-11-18",
    );
    expect(rappels.map((r) => [r.vehiculeId, r.type, r.niveau])).toEqual([
      ["v2", "controle_technique", "en_retard"],
      ["v1", "assurance", "bientot"],
      ["v1", "vidange", "bientot"],
    ]);
    expect(rappels[2]!.kmRestants).toBe(500);
  });

  it("calcule la rentabilité d'un véhicule", () => {
    expect(rentabilite(300_000, 45_000)).toMatchObject({ marge: 255_000, tauxMarge: 85 });
    expect(rentabilite(0, 5_000)).toMatchObject({ marge: -5_000, tauxMarge: null });
    expect(rentabilite(1, 0, "2024-01-01", "2026-06-01").annees).toBe(2);
  });
});
