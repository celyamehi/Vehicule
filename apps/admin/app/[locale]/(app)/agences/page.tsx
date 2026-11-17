"use client";

import { nomWilaya, type Langue } from "@lvb/shared";
import { Bouton, Carte, Chargement, Message, Pastille, Saisie, formaterDate } from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useDonnees } from "@/lib/donnees";

type Agence = {
  id: string;
  raisonSociale: string;
  nif: string;
  wilaya: number;
  statut: string;
  createdAt: string;
  nbVehicules: number;
  telephoneGerant: string | null;
  score: number;
};

export default function Agences() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const [statut, setStatut] = useState<string | undefined>("en_attente");
  const [recherche, setRecherche] = useState("");
  const { donnees, erreur } = useDonnees<Agence[]>("/admin/agences", {
    statut,
    recherche: recherche || undefined,
  });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("admin.nav.agences")}</h1>
      <div className="flex flex-wrap gap-2">
        <Bouton
          taille="petite"
          variante={statut === "en_attente" ? "principal" : "secondaire"}
          onClick={() => setStatut("en_attente")}
        >
          {t("admin.agences.fileValidation")}
        </Bouton>
        <Bouton
          taille="petite"
          variante={statut === undefined ? "principal" : "secondaire"}
          onClick={() => setStatut(undefined)}
        >
          {t("admin.agences.toutes")}
        </Bouton>
        <Saisie
          className="max-w-xs"
          placeholder={t("ui.rechercherPlaceholder")}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>
      {erreur && <Message ton="erreur">{erreur}</Message>}
      {!donnees ? (
        <Chargement />
      ) : (
        <Carte className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-fond text-xs text-attenue">
              <tr>
                <th className="p-2 text-start">{t("loueur.inscription.raisonSociale")}</th>
                <th className="p-2 text-start">{t("commun.wilaya")}</th>
                <th className="p-2 text-start">{t("admin.agences.vehicules")}</th>
                <th className="p-2 text-start">{t("admin.agences.inscriteLe")}</th>
                <th className="p-2 text-start">{t("commun.statut")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-trait">
              {donnees.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-attenue">
                    {t("commun.aucunResultat")}
                  </td>
                </tr>
              )}
              {donnees.map((a) => (
                <tr key={a.id} className="hover:bg-fond">
                  <td className="p-2">
                    <Link
                      href={`/agences/${a.id}`}
                      className="font-medium text-marque-700 underline"
                    >
                      {a.raisonSociale}
                    </Link>
                    <div className="ltr text-xs text-attenue">{a.telephoneGerant}</div>
                  </td>
                  <td className="p-2">{nomWilaya(a.wilaya, langue)}</td>
                  <td className="p-2 tabular-nums">{a.nbVehicules}</td>
                  <td className="p-2">{formaterDate(a.createdAt, langue, false)}</td>
                  <td className="p-2">
                    <Pastille statut={a.statut}>{t(`statutsAgence.${a.statut}`)}</Pastille>
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
