"use client";

import { nomWilaya, type Langue } from "@lvb/shared";
import { Carte, Chargement, Indicateur, Message, formaterMontant } from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { useDonnees } from "@/lib/donnees";

type Stats = {
  agencesValidees: number;
  agencesEnAttente: number;
  agencesActives: number;
  vehiculesVisibles: number;
  reservationsPlateformeMois: number;
  chiffreAffairesPlateformeMois: number;
  tauxAcceptation: number | null;
  delaiMedianConfirmationMinutes: number | null;
  parWilaya: { wilaya: number; reservations: number; chiffre_affaires: number }[];
  parAgence: {
    id: string;
    raison_sociale: string;
    reservations: number;
    chiffre_affaires: number;
  }[];
};

/** Indicateurs de la section 15 (objectifs de fin de Phase 1 entre parenthèses). */
export default function Indicateurs() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { donnees: s, erreur } = useDonnees<Stats>("/admin/stats");
  if (erreur) return <Message ton="erreur">{erreur}</Message>;
  if (!s) return <Chargement />;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("admin.nav.tableau")}</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur
          libelle={t("admin.stats.agencesActives")}
          valeur={s.agencesActives}
          aide="→ 20"
        />
        <Indicateur
          libelle={t("admin.stats.vehiculesVisibles")}
          valeur={s.vehiculesVisibles}
          aide="→ 150"
        />
        <Indicateur
          libelle={t("admin.stats.reservationsMois")}
          valeur={s.reservationsPlateformeMois}
          aide="→ 100"
        />
        <Indicateur
          libelle={t("admin.stats.caMois")}
          valeur={formaterMontant(s.chiffreAffairesPlateformeMois, langue)}
        />
        <Indicateur
          libelle={t("admin.stats.tauxAcceptation")}
          valeur={s.tauxAcceptation === null ? "—" : `${s.tauxAcceptation} %`}
          aide="→ 90 %"
        />
        <Indicateur
          libelle={t("admin.stats.delaiMedian")}
          valeur={
            s.delaiMedianConfirmationMinutes === null
              ? "—"
              : t("admin.stats.minutes", { n: s.delaiMedianConfirmationMinutes })
          }
          aide="→ < 30 min"
        />
        <Indicateur libelle={t("admin.stats.agencesValidees")} valeur={s.agencesValidees} />
        <Indicateur libelle={t("admin.stats.agencesEnAttente")} valeur={s.agencesEnAttente} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre={t("admin.stats.parWilaya")}>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-trait">
              {s.parWilaya.map((w) => (
                <tr key={w.wilaya}>
                  <td className="py-1.5">{nomWilaya(w.wilaya, langue)}</td>
                  <td className="text-end tabular-nums">{w.reservations}</td>
                  <td className="text-end tabular-nums">
                    {formaterMontant(w.chiffre_affaires, langue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Carte>
        <Carte titre={t("admin.stats.parAgence")}>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-trait">
              {s.parAgence.map((a) => (
                <tr key={a.id}>
                  <td className="py-1.5">{a.raison_sociale}</td>
                  <td className="text-end tabular-nums">{a.reservations}</td>
                  <td className="text-end tabular-nums">
                    {formaterMontant(a.chiffre_affaires, langue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Carte>
      </div>
    </div>
  );
}
