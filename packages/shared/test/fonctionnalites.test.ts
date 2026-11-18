import { describe, expect, it } from "vitest";
import {
  avisPossible,
  creerSlug,
  noteMoyenne,
  numeroFacture,
  schemas,
  trouverLocationResponsable,
  type ReservationPourAmende,
} from "../src/index.js";

const j = (iso: string) => new Date(`${iso}+01:00`);

describe("avis (6.3.9)", () => {
  const retourLe = j("2026-07-01T10:00:00");
  it("possible seulement pour une réservation terminée, dans les 14 jours", () => {
    expect(
      avisPossible({ statut: "terminee", retourLe, maintenant: j("2026-07-15T10:00:00") }),
    ).toBe(true);
    expect(
      avisPossible({ statut: "terminee", retourLe, maintenant: j("2026-07-15T10:01:00") }),
    ).toBe(false);
    expect(
      avisPossible({ statut: "en_cours", retourLe, maintenant: j("2026-07-02T10:00:00") }),
    ).toBe(false);
    expect(
      avisPossible({ statut: "terminee", retourLe: null, maintenant: j("2026-07-02T10:00:00") }),
    ).toBe(false);
    expect(
      avisPossible({ statut: "terminee", retourLe, maintenant: j("2026-06-30T10:00:00") }),
    ).toBe(false);
  });
  it("calcule la note moyenne", () => {
    expect(noteMoyenne([5, 4, 4])).toBe(4.3);
    expect(noteMoyenne([])).toBeNull();
  });
});

describe("amendes : qui conduisait ?", () => {
  const base = { origine: "comptoir", departLe: null, retourLe: null } as const;
  const locations: ReservationPourAmende[] = [
    {
      ...base,
      id: "a",
      clientId: "c1",
      statut: "terminee",
      debut: j("2026-07-01T10:00:00"),
      fin: j("2026-07-05T10:00:00"),
      departLe: j("2026-07-01T11:00:00"),
      retourLe: j("2026-07-05T18:00:00"),
    },
    {
      ...base,
      id: "b",
      clientId: "c2",
      statut: "en_cours",
      debut: j("2026-07-10T10:00:00"),
      fin: j("2026-07-12T10:00:00"),
      departLe: j("2026-07-10T09:30:00"),
      retourLe: null,
    },
    {
      ...base,
      id: "c",
      clientId: "c3",
      statut: "annulee_client",
      debut: j("2026-07-06T10:00:00"),
      fin: j("2026-07-08T10:00:00"),
    },
    {
      ...base,
      id: "d",
      clientId: null,
      origine: "blocage",
      statut: "confirmee",
      debut: j("2026-07-06T10:00:00"),
      fin: j("2026-07-08T10:00:00"),
    },
  ];
  it("utilise la remise et le retour réels", () => {
    expect(trouverLocationResponsable(j("2026-07-05T17:00:00"), locations)?.id).toBe("a"); // retour en retard
    expect(trouverLocationResponsable(j("2026-07-01T10:30:00"), locations)).toBeNull(); // avant la remise
    expect(trouverLocationResponsable(j("2026-07-14T08:00:00"), locations)?.id).toBe("b"); // toujours en cours
    expect(trouverLocationResponsable(j("2026-07-07T08:00:00"), locations)).toBeNull(); // annulée / blocage
  });
});

describe("factures et pages d'agence", () => {
  it("numérote les factures", () => {
    expect(numeroFacture(2026, 42)).toBe("F-2026-00042");
  });
  it("crée un identifiant d'URL lisible", () => {
    expect(creerSlug("Yemma Gouraya Location", "ab12")).toBe("yemma-gouraya-location-ab12");
    expect(creerSlug("Ég Àuto  & Fils!!")).toBe("eg-auto-fils");
    expect(creerSlug("وكالة")).toBe("agence");
  });
});

describe("schémas", () => {
  const v = "3f1c3a4e-1d2b-4c5d-8e9f-0a1b2c3d4e5f";
  const periode = { debut: "2026-07-01T10:00:00+01:00", fin: "2026-07-03T10:00:00+01:00" };
  it("la livraison exige une adresse", () => {
    expect(
      schemas.reservationClientCreer.safeParse({ vehiculeId: v, ...periode, livraison: true })
        .success,
    ).toBe(false);
    expect(
      schemas.reservationClientCreer.safeParse({
        vehiculeId: v,
        ...periode,
        livraison: true,
        adresseLivraison: { adresse: "Hôtel Les Hammadites", commune: "Tichy" },
      }).success,
    ).toBe(true);
  });
  it("note d'avis entre 1 et 5", () => {
    expect(schemas.avisCreer.safeParse({ note: 6 }).success).toBe(false);
    expect(schemas.avisCreer.safeParse({ note: 5, commentaire: "Parfait" }).success).toBe(true);
  });
});
