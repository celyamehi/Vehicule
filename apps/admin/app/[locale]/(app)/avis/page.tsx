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
  formaterDate,
  useSession,
} from "@lvb/ui";
import { Eye, EyeOff, MessageSquareQuote } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useDonnees } from "@/lib/donnees";

type Avis = {
  id: string;
  note: number;
  commentaire: string | null;
  reponseAgence: string | null;
  auteur: string | null;
  agence: string;
  createdAt: string;
  statut: "publie" | "masque";
  signale: boolean;
};

/** Modération des avis (section 5) : avis signalés par les agences en premier. */
export default function ModerationAvis() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { api } = useSession();
  const [signales, setSignales] = useState(true);
  const { donnees, erreur, recharger } = useDonnees<Avis[]>("/admin/avis", {
    signales: signales ? "true" : undefined,
  });
  const decider = (id: string, decision: "publier" | "masquer") =>
    void api.post(`/admin/avis/${id}/decision`, { decision }).then(recharger);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight">{t("avis.titre")}</h1>
        <div className="flex rounded-full bg-champ p-1 text-sm">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setSignales(v)}
              className={`rounded-full px-3 py-1 font-medium ${signales === v ? "bg-surface shadow-sm" : "text-attenue"}`}
            >
              {v ? t("avis.signale") : t("ui.tous")}
            </button>
          ))}
        </div>
      </div>
      {erreur && <Message ton="erreur">{erreur}</Message>}
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
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{a.agence}</span>
                  <span className="flex items-center gap-2">
                    {a.signale && <Pastille statut="signale">{t("avis.signale")}</Pastille>}
                    {a.statut === "masque" && (
                      <Pastille statut="masque">{t("avis.masquer")}</Pastille>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-attenue">
                  <Etoiles note={a.note} taille="petite" /> {a.auteur ?? "—"} ·{" "}
                  {formaterDate(a.createdAt, langue, false)}
                </div>
                {a.commentaire && <p className="text-[15px]">{a.commentaire}</p>}
                {a.reponseAgence && (
                  <p className="rounded-xl bg-fond p-2.5 text-attenue">{a.reponseAgence}</p>
                )}
                <div className="mt-1 flex gap-2">
                  {a.statut === "publie" ? (
                    <Bouton
                      taille="petite"
                      variante="danger"
                      icone={EyeOff}
                      onClick={() => decider(a.id, "masquer")}
                    >
                      {t("avis.masquer")}
                    </Bouton>
                  ) : (
                    <Bouton
                      taille="petite"
                      variante="secondaire"
                      icone={Eye}
                      onClick={() => decider(a.id, "publier")}
                    >
                      {t("avis.publier")}
                    </Bouton>
                  )}
                  {a.signale && a.statut === "publie" && (
                    <Bouton
                      taille="petite"
                      variante="fantome"
                      icone={Eye}
                      onClick={() => decider(a.id, "publier")}
                    >
                      {t("avis.publier")}
                    </Bouton>
                  )}
                </div>
              </div>
            </Carte>
          ))}
        </div>
      )}
    </div>
  );
}
