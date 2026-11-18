"use client";

import { STATUTS_RESERVATION, dateAlger, depuisHeureAlger, type Langue } from "@lvb/shared";
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
  Champ,
  Modale,
} from "@lvb/ui";
import { FileSpreadsheet, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { EnTete, LienBouton, usePeut } from "@/components/coquille";
import { Link } from "@/i18n/navigation";
import { URL_API } from "@/lib/config";
import { useAction, useDonnees } from "@/lib/donnees";
import type { LigneReservation } from "@/lib/types";

export default function Reservations() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { api, jetonAcces } = useSession();
  const peut = usePeut();
  const action = useAction();
  const [exp, setExport] = useState<{ debut: string; fin: string } | null>(null);
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
          <>
            {peut("encaissements") && (
              <Bouton
                variante="secondaire"
                icone={FileSpreadsheet}
                onClick={() =>
                  setExport({
                    debut: dateAlger(new Date(Date.now() - 30 * 86_400_000)),
                    fin: dateAlger(new Date()),
                  })
                }
              >
                {t("factures.exporter")}
              </Bouton>
            )}
            <LienBouton href="/reservations/nouvelle" icone={Plus}>
              {t("loueur.nav.nouvelleReservation")}
            </LienBouton>
          </>
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
      <Modale ouverte={!!exp} titre={t("factures.export")} onFermer={() => setExport(null)}>
        {exp && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-attenue">{t("factures.exportAide")}</p>
            <div className="grid grid-cols-2 gap-3">
              <Champ libelle={t("commun.du")}>
                <Saisie
                  type="date"
                  value={exp.debut}
                  onChange={(e) => setExport({ ...exp, debut: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("commun.au")}>
                <Saisie
                  type="date"
                  value={exp.fin}
                  onChange={(e) => setExport({ ...exp, fin: e.target.value })}
                />
              </Champ>
            </div>
            {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
            <Bouton
              icone={FileSpreadsheet}
              chargement={action.enCours}
              onClick={() =>
                void action.executer(async () => {
                  const debut = depuisHeureAlger(exp.debut).toISOString();
                  const fin = new Date(
                    depuisHeureAlger(exp.fin).getTime() + 86_400_000,
                  ).toISOString();
                  await api.telecharger(
                    `/agence/export.xlsx?debut=${encodeURIComponent(debut)}&fin=${encodeURIComponent(fin)}`,
                    `export-${exp.debut}-${exp.fin}.xlsx`,
                  );
                  setExport(null);
                })
              }
            >
              {t("commun.telecharger")}
            </Bouton>
          </div>
        )}
      </Modale>
    </div>
  );
}
