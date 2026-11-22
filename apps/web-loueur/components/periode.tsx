"use client";

import { MS_JOUR, dateAlger } from "@lvb/shared";
import { cx } from "@lvb/ui";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

export const PERIODES = ["jour", "semaine", "mois", "trimestre", "annee"] as const;
export type CodePeriode = (typeof PERIODES)[number];

/** Bornes calendaires (heure d'Alger, incluses) d'une période qui se termine aujourd'hui. */
export function bornesPeriode(code: CodePeriode, maintenant = new Date()) {
  const au = dateAlger(maintenant);
  const ilYa = (jours: number) => dateAlger(new Date(maintenant.getTime() - jours * MS_JOUR));
  switch (code) {
    case "jour":
      return { du: au, au };
    case "semaine":
      return { du: ilYa(6), au };
    case "mois":
      return { du: `${au.slice(0, 8)}01`, au };
    case "trimestre":
      return { du: ilYa(89), au };
    case "annee":
      return { du: ilYa(364), au };
  }
}

export function usePeriode(initiale: CodePeriode = "mois") {
  const [code, setCode] = useState<CodePeriode>(initiale);
  const bornes = useMemo(() => bornesPeriode(code), [code]);
  return { code, setCode, ...bornes };
}

/** Sélecteur de période en pastilles (style segmenté), défilant sur mobile. */
export function ChoixPeriode({
  valeur,
  onChanger,
  codes = PERIODES,
}: {
  valeur: CodePeriode;
  onChanger: (c: CodePeriode) => void;
  codes?: readonly CodePeriode[];
}) {
  const t = useTranslations();
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div
        role="tablist"
        className="inline-flex gap-1 rounded-full bg-champ p-1 text-sm font-medium"
      >
        {codes.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={c === valeur}
            onClick={() => onChanger(c)}
            className={cx(
              "whitespace-nowrap rounded-full px-3.5 py-1.5 transition",
              c === valeur
                ? "bg-surface text-encre shadow-[var(--shadow-douce)]"
                : "text-attenue hover:text-encre",
            )}
          >
            {t(`finances.periode.${c}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
