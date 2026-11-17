"use client";

import { COMMUNES_BEJAIA } from "@lvb/shared";
import { Bouton, Champ, Liste, Saisie, depuisChampLocal, versChampLocal } from "@lvb/ui";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { versRequete } from "@/lib/recherche";

/** Formulaire principal : lieu (communes de Béjaïa), départ, retour. */
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
      className={
        compact
          ? "grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          : "grid gap-3 rounded-2xl bg-surface p-4 shadow-lg sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end"
      }
    >
      <Champ libelle={t("client.accueil.ou")}>
        <Liste value={lieu} onChange={(e) => setLieu(e.target.value)}>
          <option value="">{t("ui.tous")} — Béjaïa</option>
          {COMMUNES_BEJAIA.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Liste>
      </Champ>
      <Champ libelle={t("client.accueil.depart")}>
        <Saisie type="datetime-local" required value={d} onChange={(e) => setD(e.target.value)} />
      </Champ>
      <Champ libelle={t("client.accueil.retour")}>
        <Saisie
          type="datetime-local"
          required
          min={d}
          value={f}
          onChange={(e) => setF(e.target.value)}
        />
      </Champ>
      <Bouton type="submit">{t("commun.rechercher")}</Bouton>
    </form>
  );
}
