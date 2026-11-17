"use client";

import { LANGUES, type Langue } from "@lvb/shared";
import { useLocale, useTranslations } from "next-intl";

/** Sélecteur fr / ar / kab ; la navigation est confiée à l'application (préfixe de langue). */
export function SelecteurLangue({ onChanger }: { onChanger: (langue: Langue) => void }) {
  const t = useTranslations("langues");
  const actuelle = useLocale();
  return (
    <select
      aria-label="Langue"
      value={actuelle}
      onChange={(e) => onChanger(e.target.value as Langue)}
      className="rounded-md border border-trait bg-surface px-2 py-1 text-sm"
    >
      {LANGUES.map((l) => (
        <option key={l} value={l}>
          {t(l)}
        </option>
      ))}
    </select>
  );
}
