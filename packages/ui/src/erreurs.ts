"use client";

import { useTranslations } from "next-intl";
import { ErreurApi } from "./client-api.js";

/** Transforme une erreur de l'API en message lisible et traduit. */
export function useMessageErreur() {
  const t = useTranslations();
  return (e: unknown): string => {
    if (e instanceof ErreurApi) {
      if (e.code === "RESEAU") return t("commun.horsLigne");
      if (e.code === "CONDITIONS_CONDUCTEUR") {
        const d = e.details as
          | { problemes?: string[]; ageMinimum?: number; ancienneteMinPermisAnnees?: number }
          | undefined;
        const lignes = (d?.problemes ?? []).map((p) =>
          t(`conducteur.${p}`, {
            age: d?.ageMinimum ?? 0,
            annees: d?.ancienneteMinPermisAnnees ?? 0,
          }),
        );
        return [e.message, ...lignes].join(" ");
      }
      if (e.code === "REQUETE_INVALIDE" && Array.isArray(e.details)) {
        const lignes = (e.details as { message: string }[])
          .map((x) => (x.message.startsWith("validation.") ? t(x.message) : null))
          .filter(Boolean);
        if (lignes.length) return lignes.join(" ");
      }
      return e.message || t(`erreurs.${e.code}`);
    }
    return t("commun.erreurInattendue");
  };
}
