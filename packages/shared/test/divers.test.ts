import { describe, expect, it } from "vitest";
import {
  COMMUNES_BEJAIA,
  MESSAGES,
  WILAYAS,
  ageEnAnnees,
  dateAlger,
  depuisHeureAlger,
  estRtl,
  formaterDZD,
  formaterMessage,
  genererCodeReservation,
  heureAlger,
  langueDepuis,
  nomWilaya,
  schemas,
  traduire,
} from "../src/index.js";

describe("dates à Alger", () => {
  it("convertit une heure locale d'Alger (UTC+1)", () => {
    expect(depuisHeureAlger("2026-07-01T10:00").toISOString()).toBe("2026-07-01T09:00:00.000Z");
    expect(depuisHeureAlger("2026-12-31").toISOString()).toBe("2026-12-30T23:00:00.000Z");
    expect(() => depuisHeureAlger("01/07/2026")).toThrow(RangeError);
  });

  it("donne la date et l'heure locales", () => {
    const d = new Date("2026-06-30T23:30:00Z");
    expect(dateAlger(d)).toBe("2026-07-01");
    expect(heureAlger(d)).toBe("00:30");
  });

  it("calcule un âge révolu", () => {
    expect(ageEnAnnees("2000-07-01", depuisHeureAlger("2026-07-01T00:10"))).toBe(26);
    expect(ageEnAnnees("2000-07-02", depuisHeureAlger("2026-07-01T23:00"))).toBe(25);
  });
});

describe("montants", () => {
  it("formate en dinars entiers", () => {
    expect(formaterDZD(12500, "fr").replace(/\s/g, " ")).toBe("12 500 DA");
    expect(formaterDZD(12500, "ar")).toMatch(/12.500 د\.ج/);
    expect(() => formaterDZD(10.5)).toThrow(RangeError);
  });
});

describe("code de réservation", () => {
  it("a le format PREFIXE-XXXXXX sans caractères ambigus", () => {
    for (let i = 0; i < 200; i++)
      expect(genererCodeReservation()).toMatch(/^BJA-[2-9A-HJKMNP-Z]{6}$/);
    expect(genererCodeReservation("ALG", () => new Uint8Array(6))).toBe("ALG-222222");
  });
});

describe("géographie", () => {
  it("contient les 58 wilayas et les 52 communes de Béjaïa", () => {
    expect(WILAYAS).toHaveLength(58);
    expect(new Set(WILAYAS.map((w) => w.code)).size).toBe(58);
    expect(COMMUNES_BEJAIA).toHaveLength(52);
    expect(nomWilaya(6, "kab")).toBe("Bgayet");
    expect(nomWilaya(6, "ar")).toBe("بجاية");
    expect(nomWilaya(31, "kab")).toBe("Oran");
    expect(nomWilaya(99, "fr")).toBe("99");
  });
});

describe("traductions", () => {
  const cles = (o: object, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) =>
      typeof v === "string" ? [p + k] : cles(v as object, `${p}${k}.`),
    );

  it("fr, ar et kab ont exactement les mêmes clés, toutes non vides", () => {
    const reference = cles(MESSAGES.fr).sort();
    for (const langue of ["ar", "kab"] as const) {
      expect(cles(MESSAGES[langue]).sort()).toEqual(reference);
      for (const cle of reference) expect(traduire(langue, cle).length).toBeGreaterThan(0);
    }
  });

  it("garde les mêmes variables dans chaque langue", () => {
    const variables = (s: string) => [...s.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]).sort();
    for (const cle of cles(MESSAGES.fr)) {
      const ref = variables(traduire("fr", cle));
      const modeleFr = cle
        .split(".")
        .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], MESSAGES.fr) as string;
      for (const langue of ["ar", "kab"] as const) {
        const modele = cle
          .split(".")
          .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], MESSAGES[langue]) as string;
        expect(variables(modele), `${langue}:${cle}`).toEqual(variables(modeleFr));
      }
      expect(ref).toBeDefined();
    }
  });

  it("formate variables et pluriels", () => {
    expect(traduire("fr", "commun.jours", { n: 1 })).toBe("1 jour");
    expect(traduire("fr", "commun.jours", { n: 3 })).toBe("3 jours");
    expect(traduire("ar", "commun.jours", { n: 2 })).toBe("يومان");
    expect(traduire("ar", "commun.jours", { n: 5 })).toBe("5 أيام");
    expect(traduire("fr", "sms.otp", { code: "123456" })).toContain("123456");
    expect(traduire("fr", "cle.inconnue")).toBe("cle.inconnue");
    expect(formaterMessage("Bonjour {nom}", {})).toBe("Bonjour {nom}");
    expect(formaterMessage("{n, plural, =0 {aucun} other {#}}", { n: 0 })).toBe("aucun");
    expect(formaterMessage("ouvert {", {})).toBe("ouvert {");
  });

  it("détecte la langue et le sens d'écriture", () => {
    expect(langueDepuis("ar-DZ,fr;q=0.8")).toBe("ar");
    expect(langueDepuis("kab")).toBe("kab");
    expect(langueDepuis("ber")).toBe("kab");
    expect(langueDepuis("en-US")).toBe("fr");
    expect(langueDepuis(undefined)).toBe("fr");
    expect(estRtl("ar")).toBe(true);
    expect(estRtl("kab")).toBe(false);
  });
});

describe("schémas de validation", () => {
  it("normalise les numéros algériens", () => {
    expect(schemas.telephone.parse("0550 12 34 56")).toBe("+213550123456");
    expect(schemas.telephone.parse("00213550123456")).toBe("+213550123456");
    expect(schemas.telephone.parse("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(schemas.telephone.safeParse("12").success).toBe(false);
  });

  it("refuse une recherche dont la fin précède le début", () => {
    const r = schemas.rechercheParams.safeParse({
      debut: "2026-07-05T10:00:00+01:00",
      fin: "2026-07-01T10:00:00+01:00",
    });
    expect(r.success).toBe(false);
    const ok = schemas.rechercheParams.parse({
      debut: "2026-07-01T10:00:00+01:00",
      fin: "2026-07-05T10:00:00+01:00",
      climatisation: "true",
    });
    expect(ok.climatisation).toBe(true);
    expect(ok.page).toBe(1);
  });

  it("exige des montants entiers", () => {
    expect(
      schemas.paiementEnregistrer.safeParse({ type: "solde", moyen: "especes", montant: 100.5 })
        .success,
    ).toBe(false);
    expect(
      schemas.paiementEnregistrer.safeParse({ type: "solde", moyen: "especes", montant: 100 })
        .success,
    ).toBe(true);
  });

  it("un tarif cible soit un véhicule soit une catégorie, avec une saison cohérente", () => {
    const v = "3f1c3a4e-1d2b-4c5d-8e9f-0a1b2c3d4e5f";
    expect(schemas.tarifCreer.safeParse({ prixJour: 4000 }).success).toBe(false);
    expect(
      schemas.tarifCreer.safeParse({ prixJour: 4000, vehiculeId: v, categorie: "suv" }).success,
    ).toBe(false);
    expect(schemas.tarifCreer.safeParse({ prixJour: 4000, categorie: "suv" }).success).toBe(true);
    expect(
      schemas.tarifCreer.safeParse({ prixJour: 4000, categorie: "suv", saisonDebut: "2026-07-01" })
        .success,
    ).toBe(false);
    expect(
      schemas.tarifCreer.safeParse({
        prixJour: 4000,
        categorie: "suv",
        saisonDebut: "2026-07-01",
        saisonFin: "2026-06-01",
      }).success,
    ).toBe(false);
    expect(
      schemas.tarifCreer.safeParse({
        prixJour: 4000,
        vehiculeId: v,
        supplements: { gps: { parJour: 300 } },
      }).success,
    ).toBe(true);
  });
});
