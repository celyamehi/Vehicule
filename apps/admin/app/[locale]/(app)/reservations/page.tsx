"use client";

import { STATUTS_RESERVATION, type Langue } from "@lvb/shared";
import {
  Carte,
  Chargement,
  Liste,
  Message,
  Pastille,
  Saisie,
  formaterDate,
  formaterMontant,
} from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useDonnees } from "@/lib/donnees";

type Ligne = {
  id: string;
  code: string;
  statut: string;
  origine: string;
  debut: string;
  fin: string;
  prixTotal: number;
  agence: string;
  client: string | null;
  vehicule: string;
  createdAt: string;
};

export default function Reservations() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState("");
  const { donnees, erreur } = useDonnees<Ligne[]>("/admin/reservations", {
    recherche: recherche || undefined,
    statut: statut || undefined,
    parPage: 50,
  });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("admin.nav.reservations")}</h1>
      <div className="flex flex-wrap gap-2">
        <Saisie
          className="max-w-xs"
          placeholder={t("ui.rechercherPlaceholder")}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <Liste className="max-w-xs" value={statut} onChange={(e) => setStatut(e.target.value)}>
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
      ) : (
        <Carte className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-fond text-xs text-attenue">
              <tr>
                {["code", "client", "vehicule", "periode", "origine", "montant"].map((c) => (
                  <th key={c} className="p-2 text-start">
                    {t(`loueur.reservations.${c}`)}
                  </th>
                ))}
                <th className="p-2 text-start">{t("admin.nav.agences")}</th>
                <th className="p-2 text-start">{t("commun.statut")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-trait">
              {donnees.map((r) => (
                <tr key={r.id}>
                  <td className="ltr p-2 font-medium">{r.code}</td>
                  <td className="ltr p-2">{r.client}</td>
                  <td className="p-2">{r.vehicule}</td>
                  <td className="whitespace-nowrap p-2 text-xs">
                    {formaterDate(r.debut, langue)}
                    <br />
                    {formaterDate(r.fin, langue)}
                  </td>
                  <td className="p-2">{t(`origines.${r.origine}`)}</td>
                  <td className="p-2 tabular-nums">{formaterMontant(r.prixTotal, langue)}</td>
                  <td className="p-2">{r.agence}</td>
                  <td className="p-2">
                    <Pastille statut={r.statut}>{t(`statutsReservation.${r.statut}`)}</Pastille>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Carte>
      )}
    </div>
  );
}
