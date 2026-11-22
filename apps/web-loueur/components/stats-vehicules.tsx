"use client";

import type { Langue } from "@lvb/shared";
import { Carte, Chargement, Message, Vide, cx, formaterMontant } from "@lvb/ui";
import { CarFront, Repeat2, TrendingUp, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ChoixPeriode, usePeriode } from "@/components/periode";
import { Link } from "@/i18n/navigation";
import { useDonnees } from "@/lib/donnees";

type StatVehicule = {
  vehiculeId: string;
  nom: string;
  immatriculation: string;
  locations: number;
  joursLoues: number;
  revenus: number;
  couts: number;
  marge: number;
  tauxOccupation: number;
};
type Stats = {
  jours: number;
  totaux: { locations: number; revenus: number; couts: number; marge: number };
  plusRentables: StatVehicule[];
  plusLoues: StatVehicule[];
};

const MEDAILLES = [
  "bg-citron-100 text-citron-800",
  "bg-champ text-encre",
  "bg-peche-100 text-peche-800",
];

function Rang({ i }: { i: number }) {
  return (
    <span
      className={cx(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
        MEDAILLES[i] ?? "bg-fond text-attenue",
      )}
    >
      {i + 1}
    </span>
  );
}

/** Classements de la flotte : véhicules les plus rentables et les plus loués. */
export function StatsVehicules() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const periode = usePeriode("mois");
  const { donnees, erreur } = useDonnees<Stats>("/agence/statistiques/vehicules", {
    du: periode.du,
    au: periode.au,
  });
  const aucuneLocation = donnees && donnees.totaux.locations === 0 && donnees.totaux.revenus === 0;
  const rentables = (donnees?.plusRentables ?? []).slice(0, 5);
  const loues = (donnees?.plusLoues ?? [])
    .filter((v) => v.locations > 0 || v.joursLoues > 0)
    .slice(0, 5);
  const maxMarge = Math.max(1, ...rentables.map((v) => Math.abs(v.marge)));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-tight">{t("finances.stats.titre")}</h2>
        <ChoixPeriode
          valeur={periode.code}
          onChanger={periode.setCode}
          codes={["mois", "trimestre", "annee"]}
        />
      </div>
      {erreur && <Message ton="erreur">{erreur}</Message>}
      {!donnees ? (
        <Chargement />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Carte
            titre={t("finances.stats.plusRentables")}
            icone={Trophy}
            ton="citron"
            actions={
              <span className="rounded-full bg-menthe-100 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-menthe-800">
                {formaterMontant(donnees.totaux.marge, langue)}
              </span>
            }
          >
            {aucuneLocation ? (
              <Vide icone={TrendingUp}>{t("finances.stats.aucune")}</Vide>
            ) : (
              <ol className="flex flex-col gap-3">
                {rentables.map((v, i) => (
                  <li key={v.vehiculeId}>
                    <Link
                      href={`/flotte/${v.vehiculeId}`}
                      className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-fond"
                    >
                      <Rang i={i} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-medium">{v.nom}</span>
                          <span
                            className={cx(
                              "shrink-0 font-semibold tabular-nums",
                              v.marge < 0 ? "text-rose-800" : "text-menthe-800",
                            )}
                          >
                            {formaterMontant(v.marge, langue)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-champ">
                          <div
                            className={cx(
                              "h-full rounded-full",
                              v.marge < 0 ? "bg-rose-300" : "bg-menthe-300",
                            )}
                            style={{
                              inlineSize: `${Math.round((Math.abs(v.marge) / maxMarge) * 100)}%`,
                            }}
                          />
                        </div>
                        <div className="mt-1 truncate text-xs text-attenue">
                          {t("finances.stats.revenus")} {formaterMontant(v.revenus, langue)} ·{" "}
                          {t("finances.stats.couts")} {formaterMontant(v.couts, langue)}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Carte>

          <Carte
            titre={t("finances.stats.plusLoues")}
            icone={Repeat2}
            ton="lavande"
            actions={
              <span className="rounded-full bg-champ px-2.5 py-0.5 text-sm font-semibold tabular-nums">
                {donnees.totaux.locations}
              </span>
            }
          >
            {loues.length === 0 ? (
              <Vide icone={CarFront}>{t("finances.stats.aucune")}</Vide>
            ) : (
              <ol className="flex flex-col gap-3">
                {loues.map((v, i) => (
                  <li key={v.vehiculeId}>
                    <Link
                      href={`/flotte/${v.vehiculeId}`}
                      className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-fond"
                    >
                      <Rang i={i} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-medium">{v.nom}</span>
                          <span className="shrink-0 text-sm font-semibold">
                            {t("finances.stats.locations", { n: v.locations })}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-champ">
                          <div
                            className="h-full rounded-full bg-lavande-300"
                            style={{ inlineSize: `${v.tauxOccupation}%` }}
                          />
                        </div>
                        <div className="mt-1 truncate text-xs text-attenue">
                          {t("finances.stats.jours", { n: v.joursLoues })} ·{" "}
                          {t("finances.stats.occupation", { taux: v.tauxOccupation })}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Carte>
        </div>
      )}
    </section>
  );
}
