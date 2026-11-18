"use client";

import type { Langue } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Chargement,
  Etoiles,
  Message,
  Pastille,
  Vide,
  Zone,
  formaterDate,
  useSession,
} from "@lvb/ui";
import { Flag, MessageSquareQuote, Reply } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { EnTete } from "@/components/coquille";
import { useAction, useDonnees } from "@/lib/donnees";

type Avis = {
  id: string;
  note: number;
  commentaire: string | null;
  reponseAgence: string | null;
  auteur: string | null;
  code: string;
  createdAt: string;
  statut: string;
  signale: boolean;
};

/** Avis des clients sur l'agence : réponse publique, signalement d'un avis abusif. */
export default function PageAvis() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { api } = useSession();
  const action = useAction();
  const { donnees, erreur, recharger } = useDonnees<Avis[]>("/agence/avis");
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const moyenne = donnees?.length
    ? Math.round((donnees.reduce((s, a) => s + a.note, 0) / donnees.length) * 10) / 10
    : null;

  return (
    <div className="flex flex-col gap-6">
      <EnTete
        titre={t("avis.titre")}
        sousTitre={
          moyenne !== null
            ? `${moyenne} / 5 · ${t("avis.nombre", { n: donnees!.length })}`
            : undefined
        }
      />
      {(erreur || action.erreur) && <Message ton="erreur">{erreur ?? action.erreur}</Message>}
      {!donnees ? (
        <Chargement />
      ) : donnees.length === 0 ? (
        <Carte>
          <Vide icone={MessageSquareQuote}>{t("avis.aucun")}</Vide>
        </Carte>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {donnees.map((a) => (
            <Carte key={a.id}>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{a.auteur ?? "—"}</span>
                    <Etoiles note={a.note} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-attenue">
                    <span className="ltr">{a.code}</span> ·{" "}
                    {formaterDate(a.createdAt, langue, false)}
                    {a.statut === "masque" && (
                      <Pastille statut="masque">{t("avis.masquer")}</Pastille>
                    )}
                    {a.signale && <Pastille statut="signale">{t("avis.signale")}</Pastille>}
                  </div>
                </div>
                {a.commentaire && <p className="text-[15px] leading-relaxed">{a.commentaire}</p>}
                {a.reponseAgence ? (
                  <div className="rounded-2xl bg-marque-50 p-3 text-sm">
                    <div className="mb-0.5 font-medium text-marque-700">
                      {t("avis.reponseAgence")}
                    </div>
                    {a.reponseAgence}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Zone
                      placeholder={t("avis.reponse")}
                      value={reponses[a.id] ?? ""}
                      onChange={(e) => setReponses({ ...reponses, [a.id]: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Bouton
                        taille="petite"
                        icone={Reply}
                        disabled={(reponses[a.id] ?? "").trim().length < 2}
                        chargement={action.enCours}
                        onClick={() =>
                          void action.executer(async () => {
                            await api.post(`/agence/avis/${a.id}/reponse`, {
                              reponse: reponses[a.id],
                            });
                            await recharger();
                          })
                        }
                      >
                        {t("avis.repondre")}
                      </Bouton>
                      {!a.signale && (
                        <Bouton
                          taille="petite"
                          variante="fantome"
                          icone={Flag}
                          onClick={() =>
                            void action.executer(async () => {
                              await api.post(`/agence/avis/${a.id}/signaler`);
                              await recharger();
                            })
                          }
                        >
                          {t("avis.signaler")}
                        </Bouton>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Carte>
          ))}
        </div>
      )}
    </div>
  );
}
