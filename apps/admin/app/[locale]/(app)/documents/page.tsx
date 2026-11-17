"use client";

import type { Langue } from "@lvb/shared";
import { Bouton, Carte, Chargement, Message, formaterDate, useSession } from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { useDonnees } from "@/lib/donnees";

type Document = {
  id: string;
  type: string;
  numero: string | null;
  dateDelivrance: string | null;
  dateExpiration: string | null;
  createdAt: string;
  utilisateur: { telephone: string; nom: string | null; prenom: string | null };
  urls: { recto: string | null; verso: string | null };
};

/** Vérification des documents des clients (badge « Profil vérifié »). */
export default function Documents() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { api } = useSession();
  const { donnees, erreur, recharger } = useDonnees<Document[]>("/admin/documents");
  const decider = (id: string, decision: "verifie" | "refuse") =>
    void api.post(`/admin/documents/${id}/decision`, { decision }).then(recharger);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("admin.documents.titre")}</h1>
      {erreur && <Message ton="erreur">{erreur}</Message>}
      {!donnees ? (
        <Chargement />
      ) : donnees.length === 0 ? (
        <Carte>
          <p className="text-sm text-attenue">{t("admin.documents.aucun")}</p>
        </Carte>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {donnees.map((d) => (
            <Carte
              key={d.id}
              titre={`${[d.utilisateur.prenom, d.utilisateur.nom].filter(Boolean).join(" ")} — ${d.type}`}
            >
              <div className="flex flex-col gap-2 text-sm">
                <div className="ltr text-attenue">{d.utilisateur.telephone}</div>
                <div>
                  N° <span className="ltr">{d.numero}</span> · {d.dateDelivrance} →{" "}
                  {d.dateExpiration ?? "—"}
                </div>
                <div className="text-xs text-attenue">{formaterDate(d.createdAt, langue)}</div>
                <div className="flex gap-2">
                  {(["recto", "verso"] as const).map((c) =>
                    d.urls[c] ? (
                      <img
                        key={c}
                        src={d.urls[c]!}
                        alt={t(`client.profil.${c}`)}
                        className="h-28 rounded-lg border border-trait object-cover"
                      />
                    ) : null,
                  )}
                </div>
                <div className="flex gap-2">
                  <Bouton taille="petite" onClick={() => decider(d.id, "verifie")}>
                    {t("admin.documents.verifier")}
                  </Bouton>
                  <Bouton taille="petite" variante="danger" onClick={() => decider(d.id, "refuse")}>
                    {t("admin.documents.refuser")}
                  </Bouton>
                </div>
              </div>
            </Carte>
          ))}
        </div>
      )}
    </div>
  );
}
