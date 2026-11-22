"use client";

import type { Langue } from "@lvb/shared";
import {
  Carte,
  Chargement,
  Indicateur,
  Message,
  Pastille,
  Periode,
  PuceIcone,
  Vide,
  formaterDate,
  formaterMontant,
  useSession,
  useTempsReel,
  type Ton,
} from "@lvb/ui";
import {
  AlarmClock,
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  ChevronRight,
  Gauge,
  Globe2,
  Hourglass,
  Inbox,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { EnTete, usePeut } from "@/components/coquille";
import { StatsVehicules } from "@/components/stats-vehicules";
import { TexteEcheance, VISUELS } from "@/components/entretien";
import { Link } from "@/i18n/navigation";
import { URL_API } from "@/lib/config";
import { useDonnees } from "@/lib/donnees";

type Ligne = {
  id: string;
  code: string;
  statut: string;
  origine: string;
  debut: string;
  fin: string;
  expireLe: string | null;
  vehicule: string;
  immatriculation: string;
  client: string | null;
  telephone: string | null;
};
type Tdb = {
  departs: Ligne[];
  retours: Ligne[];
  enAttente: Ligne[];
  retards: Ligne[];
  tauxOccupation: number;
  chiffreAffairesMois: number;
  partEnLigne: number;
  reservationsMois: number;
};
type Rappel = Parameters<typeof TexteEcheance>[0]["r"] & {
  vehiculeId: string;
  type: keyof typeof VISUELS;
  vehicule: string;
  niveau: "en_retard" | "bientot" | "ok";
};

function Bloc({
  titre,
  icone,
  ton,
  lignes,
  avecExpiration,
}: {
  titre: string;
  icone: LucideIcon;
  ton: Ton;
  lignes: Ligne[];
  avecExpiration?: boolean;
}) {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  return (
    <Carte
      titre={titre}
      icone={icone}
      ton={ton}
      actions={
        <span className="rounded-full bg-champ px-2.5 py-0.5 text-sm font-semibold tabular-nums">
          {lignes.length}
        </span>
      }
    >
      {lignes.length === 0 ? (
        <Vide icone={BadgeCheck}>{t("loueur.tdb.rien")}</Vide>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {lignes.map((l) => (
            <li key={l.id}>
              <Link
                href={`/reservations/${l.id}`}
                className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-fond"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">
                    {l.vehicule}{" "}
                    <span className="ltr text-sm font-normal text-attenue">
                      {l.immatriculation}
                    </span>
                  </div>
                  <div className="truncate text-xs text-attenue">
                    {l.client ?? <span className="ltr">{l.telephone}</span>} ·{" "}
                    <Periode
                      debut={formaterDate(l.debut, langue)}
                      fin={formaterDate(l.fin, langue)}
                    />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Pastille statut={l.statut}>{t(`statutsReservation.${l.statut}`)}</Pastille>
                  {avecExpiration && l.expireLe && (
                    <span className="flex items-center gap-1 text-xs font-medium text-peche-800">
                      <Hourglass className="size-3" />
                      {t("loueur.tdb.expireDans", {
                        minutes: Math.max(
                          0,
                          Math.round((new Date(l.expireLe).getTime() - Date.now()) / 60_000),
                        ),
                      })}
                    </span>
                  )}
                </div>
                <ChevronRight className="size-4 shrink-0 text-attenue rtl:rotate-180" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Carte>
  );
}

export default function TableauDeBord() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { jetonAcces } = useSession();
  const peut = usePeut();
  const { donnees, erreur, recharger } = useDonnees<Tdb>("/agence/tableau-de-bord");
  const { donnees: rappels } = useDonnees<Rappel[]>("/agence/entretiens/rappels");
  const direct = useTempsReel(URL_API, jetonAcces, {
    "reservation.creee": () => void recharger(),
    "reservation.statut_change": () => void recharger(),
  });

  if (erreur) return <Message ton="erreur">{erreur}</Message>;
  if (!donnees) return <Chargement />;
  const urgents = (rappels ?? []).filter((r) => r.niveau !== "ok").slice(0, 5);
  return (
    <div className="flex flex-col gap-6">
      <EnTete
        titre={t("loueur.tdb.titre")}
        sousTitre={formaterDate(new Date(), langue, false)}
        actions={
          direct ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-menthe-100 px-3 py-1.5 text-xs font-medium text-menthe-800">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-menthe-800/40" />
                <span className="relative inline-flex size-2 rounded-full bg-menthe-800" />
              </span>
              {t("ui.tempsReel")}
            </span>
          ) : null
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur
          libelle={t("loueur.tdb.occupation")}
          valeur={`${donnees.tauxOccupation} %`}
          icone={Gauge}
          ton="lavande"
        />
        <Indicateur
          libelle={t("loueur.tdb.caMois")}
          valeur={formaterMontant(donnees.chiffreAffairesMois, langue)}
          icone={Wallet}
          ton="menthe"
        />
        <Indicateur
          libelle={t("loueur.tdb.partEnLigne")}
          valeur={`${donnees.partEnLigne} %`}
          icone={Globe2}
          ton="ciel"
        />
        <Indicateur
          libelle={t("loueur.tdb.reservationsMois")}
          valeur={donnees.reservationsMois}
          icone={Inbox}
          ton="peche"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc
          titre={t("loueur.tdb.enAttente")}
          icone={Hourglass}
          ton="citron"
          lignes={donnees.enAttente}
          avecExpiration
        />
        <Bloc
          titre={t("loueur.tdb.retards")}
          icone={AlarmClock}
          ton="rose"
          lignes={donnees.retards}
        />
        <Bloc
          titre={t("loueur.tdb.departs")}
          icone={ArrowUpFromLine}
          ton="ciel"
          lignes={donnees.departs}
        />
        <Bloc
          titre={t("loueur.tdb.retours")}
          icone={ArrowDownToLine}
          ton="menthe"
          lignes={donnees.retours}
        />
      </div>
      <Carte
        titre={t("loueur.entretien.aSurveiller")}
        icone={Wrench}
        ton="peche"
        actions={
          <Link
            href="/entretien"
            className="flex items-center gap-1 text-sm font-medium text-marque-700"
          >
            {t("commun.voir")} <ChevronRight className="size-4 rtl:rotate-180" />
          </Link>
        }
      >
        {urgents.length === 0 ? (
          <Vide icone={BadgeCheck}>{t("loueur.entretien.aucunRappel")}</Vide>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {urgents.map((r) => (
              <li
                key={`${r.vehiculeId}-${r.type}`}
                className="flex min-w-0 items-center gap-3 rounded-2xl bg-fond/70 p-3"
              >
                <PuceIcone
                  icone={VISUELS[r.type].icone}
                  ton={VISUELS[r.type].ton}
                  taille="petite"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {t(`loueur.entretien.types.${r.type}`)} · {r.vehicule}
                  </div>
                  <div className="truncate text-xs text-attenue">
                    <TexteEcheance r={r} />
                  </div>
                </div>
                <Pastille statut={r.niveau}>
                  {t(`loueur.entretien.${r.niveau === "en_retard" ? "enRetard" : r.niveau}`)}
                </Pastille>
              </li>
            ))}
          </ul>
        )}
      </Carte>
      {peut("encaissements") && <StatsVehicules />}
    </div>
  );
}
