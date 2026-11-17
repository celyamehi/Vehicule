"use client";

import { PERMISSIONS_EMPLOYE, type Langue } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Case,
  Champ,
  Chargement,
  Liste,
  Message,
  Modale,
  Pastille,
  Saisie,
  formaterDate,
  useSession,
} from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { EnTete } from "@/components/coquille";
import { useAction, useDonnees } from "@/lib/donnees";

type Membre = {
  id: string;
  nom: string | null;
  prenom: string | null;
  telephone: string;
  role: "gerant" | "employe";
  permissions: string[];
  actif: boolean;
};
type Ligne = {
  j: { id: string; action: string; entite: string; createdAt: string };
  auteur: string | null;
};
const cleDroit = (p: string) => `loueur.equipe.droits.${p.replace(".", "_")}`;

export default function Equipe() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { api, agence } = useSession();
  const action = useAction();
  const gerant = agence?.role === "gerant";
  const { donnees, erreur, recharger } = useDonnees<Membre[]>("/agence/membres");
  const { donnees: journal } = useDonnees<Ligne[]>(gerant ? "/agence/journal" : null);
  const [nouveau, setNouveau] = useState<{
    telephone: string;
    nom: string;
    prenom: string;
    role: "gerant" | "employe";
    permissions: string[];
  } | null>(null);

  const basculer = (m: Membre, p: string) =>
    void action.executer(async () => {
      await api.patch(`/agence/membres/${m.id}`, {
        permissions: m.permissions.includes(p)
          ? m.permissions.filter((x) => x !== p)
          : [...m.permissions, p],
      });
      await recharger();
    });

  return (
    <div className="flex flex-col gap-4">
      <EnTete
        titre={t("loueur.equipe.titre")}
        actions={
          gerant && (
            <Bouton
              onClick={() =>
                setNouveau({
                  telephone: "",
                  nom: "",
                  prenom: "",
                  role: "employe",
                  permissions: ["etats_des_lieux", "reservations.depart_retour"],
                })
              }
            >
              {t("loueur.equipe.ajouter")}
            </Bouton>
          )
        }
      />
      {(erreur || action.erreur) && <Message ton="erreur">{erreur ?? action.erreur}</Message>}
      {!donnees ? (
        <Chargement />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {donnees.map((m) => (
            <Carte
              key={m.id}
              titre={[m.prenom, m.nom].filter(Boolean).join(" ") || m.telephone}
              actions={
                <Pastille statut={m.actif ? "actif" : "inactif"}>{t(`roles.${m.role}`)}</Pastille>
              }
            >
              <div className="ltr mb-2 text-sm text-attenue">{m.telephone}</div>
              {m.role === "employe" && (
                <div className="flex flex-col gap-1.5">
                  {PERMISSIONS_EMPLOYE.map((p) => (
                    <Case
                      key={p}
                      libelle={t(cleDroit(p))}
                      checked={m.permissions.includes(p)}
                      disabled={!gerant}
                      onChange={() => basculer(m, p)}
                    />
                  ))}
                </div>
              )}
              {gerant && (
                <Bouton
                  taille="petite"
                  variante="fantome"
                  className="mt-2"
                  onClick={() =>
                    void action.executer(async () => {
                      await api.patch(`/agence/membres/${m.id}`, { actif: !m.actif });
                      await recharger();
                    })
                  }
                >
                  {m.actif ? "⏸" : "▶"} {t("loueur.equipe.actif")}
                </Bouton>
              )}
            </Carte>
          ))}
        </div>
      )}
      {journal && (
        <Carte titre={t("loueur.equipe.journal")}>
          <ul className="max-h-96 divide-y divide-trait overflow-y-auto text-sm">
            {journal.map((l) => (
              <li key={l.j.id} className="flex justify-between gap-2 py-1.5">
                <span className="ltr font-mono text-xs">{l.j.action}</span>
                <span className="text-attenue">
                  {l.auteur ?? "—"} · {formaterDate(l.j.createdAt, langue)}
                </span>
              </li>
            ))}
          </ul>
        </Carte>
      )}
      <Modale
        ouverte={!!nouveau}
        titre={t("loueur.equipe.ajouter")}
        onFermer={() => setNouveau(null)}
      >
        {nouveau && (
          <div className="flex flex-col gap-3">
            <Champ libelle={t("commun.telephone")}>
              <Saisie
                type="tel"
                dir="ltr"
                value={nouveau.telephone}
                onChange={(e) => setNouveau({ ...nouveau, telephone: e.target.value })}
              />
            </Champ>
            <div className="grid grid-cols-2 gap-3">
              <Champ libelle={t("commun.prenom")}>
                <Saisie
                  value={nouveau.prenom}
                  onChange={(e) => setNouveau({ ...nouveau, prenom: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("commun.nom")}>
                <Saisie
                  value={nouveau.nom}
                  onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })}
                />
              </Champ>
            </div>
            <Champ libelle={t("loueur.equipe.role")}>
              <Liste
                value={nouveau.role}
                onChange={(e) =>
                  setNouveau({ ...nouveau, role: e.target.value as "gerant" | "employe" })
                }
              >
                <option value="employe">{t("roles.employe")}</option>
                <option value="gerant">{t("roles.gerant")}</option>
              </Liste>
            </Champ>
            {nouveau.role === "employe" &&
              PERMISSIONS_EMPLOYE.map((p) => (
                <Case
                  key={p}
                  libelle={t(cleDroit(p))}
                  checked={nouveau.permissions.includes(p)}
                  onChange={(e) =>
                    setNouveau({
                      ...nouveau,
                      permissions: e.target.checked
                        ? [...nouveau.permissions, p]
                        : nouveau.permissions.filter((x) => x !== p),
                    })
                  }
                />
              ))}
            {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
            <Bouton
              chargement={action.enCours}
              onClick={() =>
                void action.executer(async () => {
                  await api.post("/agence/membres", nouveau);
                  setNouveau(null);
                  await recharger();
                })
              }
            >
              {t("commun.ajouter")}
            </Bouton>
          </div>
        )}
      </Modale>
    </div>
  );
}
