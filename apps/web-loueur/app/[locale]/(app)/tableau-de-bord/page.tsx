"use client";

import type { Langue } from "@lvb/shared";
import {
  Carte,
  Chargement,
  Indicateur,
  Message,
  Pastille,
  formaterDate,
  formaterMontant,
  useSession,
  useTempsReel,
} from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { EnTete } from "@/components/coquille";
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

function Bloc({
  titre,
  lignes,
  avecExpiration,
}: {
  titre: string;
  lignes: Ligne[];
  avecExpiration?: boolean;
}) {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  return (
    <Carte titre={`${titre} (${lignes.length})`}>
      {lignes.length === 0 ? (
        <p className="text-sm text-attenue">{t("loueur.tdb.rien")}</p>
      ) : (
        <ul className="divide-y divide-trait">
          {lignes.map((l) => (
            <li key={l.id}>
              <Link
                href={`/reservations/${l.id}`}
                className="flex items-center justify-between gap-2 py-2 hover:bg-fond"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {l.vehicule} <span className="ltr text-attenue">{l.immatriculation}</span>
                  </div>
                  <div className="truncate text-xs text-attenue">
                    {l.client ?? <span className="ltr">{l.telephone}</span>} ·{" "}
                    {formaterDate(l.debut, langue)} → {formaterDate(l.fin, langue)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Pastille statut={l.statut}>{t(`statutsReservation.${l.statut}`)}</Pastille>
                  {avecExpiration && l.expireLe && (
                    <span className="text-xs text-amber-800">
                      {t("loueur.tdb.expireDans", {
                        minutes: Math.max(
                          0,
                          Math.round((new Date(l.expireLe).getTime() - Date.now()) / 60_000),
                        ),
                      })}
                    </span>
                  )}
                </div>
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
  const { donnees, erreur, recharger } = useDonnees<Tdb>("/agence/tableau-de-bord");
  const direct = useTempsReel(URL_API, jetonAcces, {
    "reservation.creee": () => void recharger(),
    "reservation.statut_change": () => void recharger(),
  });

  if (erreur) return <Message ton="erreur">{erreur}</Message>;
  if (!donnees) return <Chargement />;
  return (
    <div className="flex flex-col gap-4">
      <EnTete
        titre={t("loueur.tdb.titre")}
        actions={
          direct ? <span className="text-xs text-emerald-700">● {t("ui.tempsReel")}</span> : null
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur libelle={t("loueur.tdb.occupation")} valeur={`${donnees.tauxOccupation} %`} />
        <Indicateur
          libelle={t("loueur.tdb.caMois")}
          valeur={formaterMontant(donnees.chiffreAffairesMois, langue)}
        />
        <Indicateur libelle={t("loueur.tdb.partEnLigne")} valeur={`${donnees.partEnLigne} %`} />
        <Indicateur libelle={t("loueur.tdb.reservationsMois")} valeur={donnees.reservationsMois} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc titre={t("loueur.tdb.enAttente")} lignes={donnees.enAttente} avecExpiration />
        <Bloc titre={t("loueur.tdb.retards")} lignes={donnees.retards} />
        <Bloc titre={t("loueur.tdb.departs")} lignes={donnees.departs} />
        <Bloc titre={t("loueur.tdb.retours")} lignes={donnees.retours} />
      </div>
    </div>
  );
}
