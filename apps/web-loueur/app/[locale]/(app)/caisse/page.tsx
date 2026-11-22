"use client";

import type { Langue } from "@lvb/shared";
import {
  Carte,
  Chargement,
  Indicateur,
  Message,
  PuceIcone,
  Vide,
  cx,
  formaterDate,
  formaterMontant,
  useSession,
  useTempsReel,
} from "@lvb/ui";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Landmark,
  LockKeyhole,
  Scale,
  Wallet,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { EnTete } from "@/components/coquille";
import { visuelDepense } from "@/components/depenses";
import { ChoixPeriode, usePeriode } from "@/components/periode";
import { Link } from "@/i18n/navigation";
import { URL_API } from "@/lib/config";
import { useDonnees } from "@/lib/donnees";

type Mouvement = {
  id: string;
  origine: "paiement" | "depense" | "entretien";
  sens: "entree" | "sortie" | "caution";
  type: string;
  le: string;
  jourSeul: boolean;
  montant: number;
  moyen: string | null;
  reservationId: string | null;
  code: string | null;
  vehicule: string | null;
  libelle?: string;
};
type Caisse = {
  entrees: number;
  sorties: number;
  solde: number;
  cautionsDetenues: number;
  parMoyen: { moyen: string; entrees: number; sorties: number; solde: number }[];
  mouvements: Mouvement[];
};

const FILTRES = ["tous", "entree", "sortie"] as const;
const CLE_FILTRE = {
  tous: "filtreTous",
  entree: "filtreEntrees",
  sortie: "filtreSorties",
} as const;

/**
 * Caisse : les paiements des locations y entrent automatiquement ; dépenses, entretiens et
 * remboursements en sortent. Les cautions sont suivies à part (argent à restituer).
 */
export default function PageCaisse() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { jetonAcces } = useSession();
  const periode = usePeriode("mois");
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]>("tous");
  const { donnees, erreur, recharger } = useDonnees<Caisse>("/agence/caisse", {
    du: periode.du,
    au: periode.au,
  });
  // Un encaissement fait sur une autre tablette met la caisse à jour.
  useTempsReel(URL_API, jetonAcces, { "reservation.modifiee": () => void recharger() });

  const mouvements = (donnees?.mouvements ?? []).filter(
    (m) => filtre === "tous" || m.sens === filtre,
  );
  const max = Math.max(1, ...(donnees?.parMoyen ?? []).map((p) => Math.max(p.entrees, p.sorties)));

  return (
    <div className="flex flex-col gap-6">
      <EnTete titre={t("finances.caisse.titre")} sousTitre={t("finances.caisse.sousTitre")} />
      <ChoixPeriode valeur={periode.code} onChanger={periode.setCode} />
      {erreur && <Message ton="erreur">{erreur}</Message>}
      {!donnees ? (
        <Chargement />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicateur
              libelle={t("finances.caisse.entrees")}
              valeur={formaterMontant(donnees.entrees, langue)}
              icone={ArrowDownLeft}
              ton="menthe"
            />
            <Indicateur
              libelle={t("finances.caisse.sorties")}
              valeur={formaterMontant(donnees.sorties, langue)}
              icone={ArrowUpRight}
              ton="rose"
            />
            <Indicateur
              libelle={t("finances.caisse.solde")}
              valeur={
                <span className={donnees.solde < 0 ? "text-rose-800" : undefined}>
                  {formaterMontant(donnees.solde, langue)}
                </span>
              }
              icone={Scale}
              ton={donnees.solde < 0 ? "rose" : "marque"}
            />
            <Indicateur
              libelle={t("finances.caisse.cautions")}
              valeur={formaterMontant(donnees.cautionsDetenues, langue)}
              aide={t("finances.caisse.cautionsAide")}
              icone={LockKeyhole}
              ton="citron"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_20rem] xl:items-start">
            <Carte
              titre={t("finances.caisse.mouvements")}
              icone={Wallet}
              ton="lavande"
              actions={
                <div className="inline-flex gap-1 rounded-full bg-champ p-1 text-xs font-medium">
                  {FILTRES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={f === filtre}
                      onClick={() => setFiltre(f)}
                      className={cx(
                        "rounded-full px-3 py-1 transition",
                        f === filtre
                          ? "bg-surface shadow-[var(--shadow-douce)]"
                          : "text-attenue hover:text-encre",
                      )}
                    >
                      {t(`finances.caisse.${CLE_FILTRE[f]}`)}
                    </button>
                  ))}
                </div>
              }
            >
              {mouvements.length === 0 ? (
                <Vide icone={Wallet}>{t("finances.caisse.aucun")}</Vide>
              ) : (
                <ul className="-my-1 divide-y divide-trait">
                  {mouvements.map((m) => (
                    <LigneMouvement key={`${m.origine}-${m.id}`} m={m} langue={langue} />
                  ))}
                </ul>
              )}
            </Carte>

            <Carte titre={t("finances.caisse.parMoyen")} icone={CreditCard} ton="ciel">
              {donnees.parMoyen.length === 0 ? (
                <p className="text-sm text-attenue">{t("finances.caisse.aucun")}</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {donnees.parMoyen.map((p) => (
                    <li key={p.moyen} className="flex flex-col gap-1.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-medium">
                          {p.moyen === "especes" ? (
                            <Wallet className="size-4 text-attenue" />
                          ) : (
                            <Landmark className="size-4 text-attenue" />
                          )}
                          {p.moyen === "non_precise"
                            ? t("finances.caisse.nonPrecise")
                            : t(`moyensPaiement.${p.moyen}`)}
                        </span>
                        <span
                          className={cx(
                            "font-semibold tabular-nums",
                            p.solde < 0 && "text-rose-800",
                          )}
                        >
                          {formaterMontant(p.solde, langue)}
                        </span>
                      </div>
                      <Barre valeur={p.entrees} max={max} classe="bg-menthe-300" />
                      <Barre valeur={p.sorties} max={max} classe="bg-rose-300" />
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
          </div>
        </>
      )}
    </div>
  );
}

function Barre({ valeur, max, classe }: { valeur: number; max: number; classe: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-champ">
      <div
        className={cx("h-full rounded-full", classe)}
        style={{ inlineSize: `${Math.round((valeur / max) * 100)}%` }}
      />
    </div>
  );
}

function LigneMouvement({ m, langue }: { m: Mouvement; langue: Langue }) {
  const t = useTranslations();
  const entree = m.sens === "entree";
  const caution = m.sens === "caution";
  const [Icone, ton] =
    m.origine === "paiement"
      ? ([
          entree ? ArrowDownLeft : caution ? LockKeyhole : ArrowUpRight,
          entree ? "menthe" : caution ? "citron" : "rose",
        ] as const)
      : visuelDepense({ origine: m.origine, categorie: m.type });
  const titre =
    m.origine === "paiement"
      ? t(`typesPaiement.${m.type}`)
      : m.origine === "entretien"
        ? t(`loueur.entretien.types.${m.type}`)
        : m.libelle || t(`finances.categories.${m.type}`);
  const sousTitre = [
    formaterDate(m.le, langue, !m.jourSeul),
    m.origine === "paiement"
      ? t("finances.caisse.paiementLocation")
      : t(`finances.caisse.${m.origine}`),
    m.code,
    m.vehicule,
  ]
    .filter(Boolean)
    .join(" · ");
  const contenu = (
    <>
      <PuceIcone icone={Icone} ton={ton} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{titre}</div>
        <div className="truncate text-sm text-attenue">{sousTitre}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span
          className={cx(
            "font-semibold tabular-nums",
            entree ? "text-menthe-800" : caution ? "text-citron-800" : "text-rose-800",
          )}
        >
          {entree ? "+" : caution ? "" : "−"}
          {formaterMontant(m.montant, langue)}
        </span>
        {m.moyen && <span className="text-xs text-attenue">{t(`moyensPaiement.${m.moyen}`)}</span>}
      </div>
    </>
  );
  return (
    <li>
      {m.reservationId ? (
        <Link
          href={`/reservations/${m.reservationId}`}
          className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-3 transition hover:bg-fond"
        >
          {contenu}
        </Link>
      ) : (
        <div className="flex items-center gap-3 py-3">{contenu}</div>
      )}
    </li>
  );
}
