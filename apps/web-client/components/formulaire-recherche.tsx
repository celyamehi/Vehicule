"use client";

import { COMMUNES_BEJAIA, type Langue, WILAYA_BEJAIA, nomWilaya } from "@lvb/shared";
import { cx, depuisChampLocal, versChampLocal } from "@lvb/ui";
import { CalendarArrowDown, CalendarArrowUp, MapPin, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { versRequete } from "@/lib/recherche";

function Segment({
  icone: Icone,
  libelle,
  children,
}: {
  icone: typeof MapPin;
  libelle: string;
  children: ReactNode;
}) {
  return (
    <label className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[1.4rem] px-4 py-2.5 transition hover:bg-champ">
      <Icone className="size-5 shrink-0 text-marque-500" strokeWidth={1.9} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-medium text-attenue">{libelle}</span>
        {children}
      </span>
    </label>
  );
}

const champ = "w-full min-w-0 bg-transparent text-[15px] font-medium text-encre outline-none";

/** Barre de recherche « en pilule » : lieu (communes de Béjaïa), départ, retour. */
export function FormulaireRecherche({
  debut,
  fin,
  commune,
  compact = false,
}: {
  debut: string;
  fin: string;
  commune?: string;
  compact?: boolean;
}) {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const routeur = useRouter();
  const [lieu, setLieu] = useState(commune ?? "");
  const [d, setD] = useState(versChampLocal(debut));
  const [f, setF] = useState(versChampLocal(fin));
  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    routeur.push(
      `/recherche?${versRequete({ wilaya: "6", commune: lieu || undefined, debut: depuisChampLocal(d), fin: depuisChampLocal(f) })}`,
    );
  };
  return (
    <form
      onSubmit={soumettre}
      className={cx(
        "flex flex-col gap-1 rounded-[1.75rem] bg-surface p-2 sm:flex-row sm:items-center",
        compact ? "shadow-[var(--shadow-douce)]" : "shadow-[var(--shadow-relief)]",
      )}
    >
      <Segment icone={MapPin} libelle={t("client.accueil.ou")}>
        <select
          className={cx(champ, "cursor-pointer appearance-none")}
          value={lieu}
          onChange={(e) => setLieu(e.target.value)}
        >
          <option value="">
            {t("ui.tous")} — {nomWilaya(WILAYA_BEJAIA, langue)}
          </option>
          {COMMUNES_BEJAIA.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Segment>
      <span className="hidden h-8 w-px bg-trait sm:block" aria-hidden />
      <Segment icone={CalendarArrowUp} libelle={t("client.accueil.depart")}>
        <input
          type="datetime-local"
          required
          className={champ}
          value={d}
          onChange={(e) => setD(e.target.value)}
        />
      </Segment>
      <span className="hidden h-8 w-px bg-trait sm:block" aria-hidden />
      <Segment icone={CalendarArrowDown} libelle={t("client.accueil.retour")}>
        <input
          type="datetime-local"
          required
          min={d}
          className={champ}
          value={f}
          onChange={(e) => setF(e.target.value)}
        />
      </Segment>
      <button
        type="submit"
        className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-[1.4rem] bg-marque-600 px-6 text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgb(76_93_228/0.8)] transition hover:bg-marque-700 active:scale-[0.97]"
      >
        <Search className="size-5" strokeWidth={2.2} />
        {t("commun.rechercher")}
      </button>
    </form>
  );
}
