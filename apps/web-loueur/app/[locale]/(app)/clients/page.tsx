"use client";

import { Carte, Chargement, Message, Pastille, Saisie } from "@lvb/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { EnTete } from "@/components/coquille";
import { Link } from "@/i18n/navigation";
import { useDonnees } from "@/lib/donnees";

type Client = {
  utilisateurId: string;
  nom: string | null;
  prenom: string | null;
  telephone: string;
  listeNoire: boolean;
  reservations: number;
};

export default function Clients() {
  const t = useTranslations();
  const [recherche, setRecherche] = useState("");
  const { donnees, erreur } = useDonnees<Client[]>("/agence/clients", {
    recherche: recherche || undefined,
  });
  return (
    <div className="flex flex-col gap-4">
      <EnTete titre={t("loueur.clients.titre")} />
      <Saisie
        className="max-w-sm"
        placeholder={t("ui.rechercherPlaceholder")}
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
      />
      {erreur && <Message ton="erreur">{erreur}</Message>}
      {!donnees ? (
        <Chargement />
      ) : (
        <Carte className="p-0">
          <ul className="divide-y divide-trait">
            {donnees.length === 0 && (
              <li className="p-4 text-sm text-attenue">{t("commun.aucunResultat")}</li>
            )}
            {donnees.map((c) => (
              <li key={c.utilisateurId}>
                <Link
                  href={`/clients/${c.utilisateurId}`}
                  className="flex items-center justify-between gap-2 p-3 hover:bg-fond"
                >
                  <div>
                    <div className="font-medium">
                      {[c.prenom, c.nom].filter(Boolean).join(" ") || "—"}
                    </div>
                    <div className="ltr text-sm text-attenue">{c.telephone}</div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {c.listeNoire && (
                      <Pastille statut="liste_noire">{t("loueur.clients.listeNoire")}</Pastille>
                    )}
                    <span className="text-attenue">
                      {c.reservations} {t("loueur.clients.reservations").toLowerCase()}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </div>
  );
}
