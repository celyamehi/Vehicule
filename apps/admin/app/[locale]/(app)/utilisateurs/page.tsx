"use client";

import type { Langue } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Chargement,
  Message,
  Pastille,
  Saisie,
  formaterDate,
  useSession,
} from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useDonnees } from "@/lib/donnees";

type Utilisateur = {
  id: string;
  telephone: string;
  nom: string | null;
  prenom: string | null;
  statut: string;
  rolePlateforme: string;
  createdAt: string;
};

/** Blocage des comptes frauduleux (section 5). */
export default function Utilisateurs() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { api } = useSession();
  const [recherche, setRecherche] = useState("");
  const { donnees, erreur, recharger } = useDonnees<Utilisateur[]>("/admin/utilisateurs", {
    recherche: recherche || undefined,
  });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("admin.utilisateurs.titre")}</h1>
      <Saisie
        className="max-w-xs"
        placeholder={t("ui.rechercherPlaceholder")}
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
      />
      {erreur && <Message ton="erreur">{erreur}</Message>}
      {!donnees ? (
        <Chargement />
      ) : (
        <Carte className="p-0">
          <ul className="divide-y divide-trait text-sm">
            {donnees.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <div className="font-medium">
                    {[u.prenom, u.nom].filter(Boolean).join(" ") || "—"}
                  </div>
                  <div className="ltr text-attenue">{u.telephone}</div>
                  <div className="text-xs text-attenue">
                    {t("admin.utilisateurs.inscritLe")} {formaterDate(u.createdAt, langue, false)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Pastille statut={u.statut}>
                    {t(`admin.utilisateurs.statuts.${u.statut}`)}
                  </Pastille>
                  {u.rolePlateforme !== "admin" && (
                    <Bouton
                      taille="petite"
                      variante={u.statut === "bloque" ? "secondaire" : "danger"}
                      onClick={() =>
                        void api
                          .post(`/admin/utilisateurs/${u.id}/decision`, {
                            decision: u.statut === "bloque" ? "debloquer" : "bloquer",
                          })
                          .then(recharger)
                      }
                    >
                      {t(
                        u.statut === "bloque"
                          ? "admin.utilisateurs.debloquer"
                          : "admin.utilisateurs.bloquer",
                      )}
                    </Bouton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </div>
  );
}
