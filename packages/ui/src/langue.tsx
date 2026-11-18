"use client";

import { LANGUES, type Langue } from "@lvb/shared";
import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

/** Sélecteur fr / ar / kab ; la navigation est confiée à l'application (préfixe de langue). */
export function SelecteurLangue({ onChanger }: { onChanger: (langue: Langue) => void }) {
  const t = useTranslations();
  const actuelle = useLocale();
  return (
    <label className="relative inline-flex items-center">
      <Globe
        className="pointer-events-none absolute start-2.5 size-4 text-attenue"
        strokeWidth={1.9}
        aria-hidden
      />
      <select
        aria-label={t("commun.langue")}
        value={actuelle}
        onChange={(e) => onChanger(e.target.value as Langue)}
        className="h-9 cursor-pointer appearance-none rounded-full bg-champ ps-8 pe-3 text-sm font-medium text-encre outline-none transition hover:bg-[#ececf1] focus:ring-4 focus:ring-marque-100"
      >
        {LANGUES.map((l) => (
          <option key={l} value={l}>
            {t(`langues.${l}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
