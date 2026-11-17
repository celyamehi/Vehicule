"use client";

import { STATUTS_RESERVATION, type Langue } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Chargement,
  Liste,
  Message,
  Pastille,
  Saisie,
  formaterDate,
  formaterMontant,
  useSession,
  useTempsReel,
} from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { EnTete } from "@/components/coquille";
import { Link } from "@/i18n/navigation";
import { URL_API } from "@/lib/config";
import { useDonnees } from "@/lib/donnees";
import type { LigneReservation } from "@/lib/types";

export default function Reservations() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { jetonAcces } = useSession();
  const [statut, setStatut] = useState("");
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const { donnees, erreur, recharger } = useDonnees<{
    total: number;
    resultats: LigneReservation[];
  }>("/agence/reservations", {
    statut: statut || undefined,
    recherche: recherche || undefined,
    page,
    parPage: 25,
  });
  useTempsReel(URL_API, jetonAcces, {
    "reservation.creee": () => void recharger(),
    "reservation.statut_change": () => void recharger(),
  });

  return (
    <div className="flex flex-col gap-4">
      <EnTete
        titre={t("loueur.reservations.titre")}
        actions={
          <Link
            href="/reservations/nouvelle"
            className="rounded-lg bg-marque-600 px-4 py-2 text-sm font-medium text-white"
          >
            {t("loueur.nav.nouvelleReservation")}
          </Link>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Saisie
          className="max-w-xs"
          placeholder={t("ui.rechercherPlaceholder")}
          value={recherche}
          onChange={(e) => {
            setRecherche(e.target.value);
            setPage(1);
          }}
        />
        <Liste
          className="max-w-xs"
          value={statut}
          onChange={(e) => {
            setStatut(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("ui.tous")}</option>
          {STATUTS_RESERVATION.map((s) => (
            <option key={s} value={s}>
              {t(`statutsReservation.${s}`)}
            </option>
          ))}
        </Liste>
      </div>
      {erreur && <Message ton="erreur">{erreur}</Message>}
      {!donnees ? (
        <Chargement />
      ) : donnees.resultats.length === 0 ? (
        <Carte>
          <p className="text-sm text-attenue">{t("loueur.reservations.aucune")}</p>
        </Carte>
      ) : (
        <Carte className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-fond text-start text-xs text-attenue">
              <tr>
                {["code", "client", "vehicule", "periode", "origine", "montant"].map((c) => (
                  <th key={c} className="p-2 text-start font-medium">
                    {t(`loueur.reservations.${c}`)}
                  </th>
                ))}
                <th className="p-2 text-start font-medium">{t("commun.statut")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-trait">
              {donnees.resultats.map((r) => (
                <tr key={r.id} className="hover:bg-fond">
                  <td className="p-2">
                    <Link
                      href={`/reservations/${r.id}`}
                      className="ltr font-medium text-marque-700 underline"
                    >
                      {r.code}
                    </Link>
                  </td>
                  <td className="p-2">{r.client ?? <span className="ltr">{r.telephone}</span>}</td>
                  <td className="p-2">
                    {r.vehicule}{" "}
                    <span className="ltr text-xs text-attenue">{r.immatriculation}</span>
                  </td>
                  <td className="whitespace-nowrap p-2 text-xs">
                    {formaterDate(r.debut, langue)}
                    <br />
                    {formaterDate(r.fin, langue)}
                  </td>
                  <td className="p-2">{t(`origines.${r.origine}`)}</td>
                  <td className="whitespace-nowrap p-2 tabular-nums">
                    {formaterMontant(r.prixTotal, langue)}
                  </td>
                  <td className="p-2">
                    <Pastille statut={r.statut}>{t(`statutsReservation.${r.statut}`)}</Pastille>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Carte>
      )}
      {donnees && donnees.total > 25 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Bouton
            variante="secondaire"
            taille="petite"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            {t("commun.precedent")}
          </Bouton>
          <span>{t("commun.page", { page, total: Math.ceil(donnees.total / 25) })}</span>
          <Bouton
            variante="secondaire"
            taille="petite"
            disabled={page * 25 >= donnees.total}
            onClick={() => setPage(page + 1)}
          >
            {t("commun.suivant")}
          </Bouton>
        </div>
      )}
    </div>
  );
}
