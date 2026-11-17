"use client";

import { nomWilaya, type Langue } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Champ,
  Chargement,
  Message,
  Pastille,
  Saisie,
  formaterDate,
  useMessageErreur,
  useSession,
} from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { useDonnees } from "@/lib/donnees";

type Detail = {
  id: string;
  raisonSociale: string;
  nif: string;
  registreCommerce: string;
  agrement: string | null;
  wilaya: number;
  adresse: string;
  telephone: string;
  email: string | null;
  statut: "en_attente" | "validee" | "suspendue";
  motifStatut: string | null;
  tauxCommissionBp: number;
  score: number;
  createdAt: string;
  justificatifsUrls: string[];
  photosUrls: string[];
  membres: { nom: string | null; prenom: string | null; telephone: string; role: string }[];
  points: { id: string; nom: string; adresse: string }[];
  nbVehicules: number;
};

export default function DetailAgence({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { api } = useSession();
  const messageErreur = useMessageErreur();
  const { donnees: a, erreur, recharger } = useDonnees<Detail>(`/admin/agences/${id}`);
  const [motif, setMotif] = useState("");
  const [commission, setCommission] = useState("10");
  const [message, setMessage] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  useEffect(() => {
    if (a) setCommission(String(a.tauxCommissionBp / 100));
  }, [a]);
  if (erreur) return <Message ton="erreur">{erreur}</Message>;
  if (!a) return <Chargement />;

  const decider = async (decision: "valider" | "suspendre" | "reactiver") => {
    setEnCours(true);
    try {
      await api.post(`/admin/agences/${id}/decision`, {
        decision,
        motif: motif || undefined,
        tauxCommissionBp: Math.round(Number(commission) * 100),
      });
      setMessage({ ton: "succes", texte: t("ui.enregistre") });
      await recharger();
    } catch (e) {
      setMessage({ ton: "erreur", texte: messageErreur(e) });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{a.raisonSociale}</h1>
        <Pastille statut={a.statut}>{t(`statutsAgence.${a.statut}`)}</Pastille>
      </div>
      {message && <Message ton={message.ton}>{message.texte}</Message>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Carte>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-attenue">{t("pdf.nif")}</dt>
            <dd className="ltr">{a.nif}</dd>
            <dt className="text-attenue">{t("pdf.rc")}</dt>
            <dd className="ltr">{a.registreCommerce}</dd>
            <dt className="text-attenue">{t("pdf.agrement")}</dt>
            <dd className="ltr">{a.agrement ?? "—"}</dd>
            <dt className="text-attenue">{t("commun.adresse")}</dt>
            <dd>
              {a.adresse}, {nomWilaya(a.wilaya, langue)}
            </dd>
            <dt className="text-attenue">{t("commun.telephone")}</dt>
            <dd className="ltr">{a.telephone}</dd>
            <dt className="text-attenue">{t("admin.agences.inscriteLe")}</dt>
            <dd>{formaterDate(a.createdAt, langue)}</dd>
            <dt className="text-attenue">{t("admin.agences.vehicules")}</dt>
            <dd>{a.nbVehicules}</dd>
            <dt className="text-attenue">{t("admin.agences.score")}</dt>
            <dd>{a.score}/100</dd>
          </dl>
        </Carte>
        <Carte titre={t("admin.agences.justificatifs")}>
          {a.justificatifsUrls.length === 0 ? (
            <p className="text-sm text-attenue">{t("ui.aucun")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {a.justificatifsUrls.map((u, i) => (
                <li key={u}>
                  <a
                    href={u}
                    target="_blank"
                    rel="noreferrer"
                    className="text-marque-700 underline"
                  >
                    {t("admin.agences.justificatifs")} {i + 1}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mb-1 mt-3 text-sm font-medium">{t("admin.agences.membres")}</h3>
          <ul className="text-sm">
            {a.membres.map((m) => (
              <li key={m.telephone}>
                {[m.prenom, m.nom].filter(Boolean).join(" ")}{" "}
                <span className="ltr text-attenue">{m.telephone}</span> — {t(`roles.${m.role}`)}
              </li>
            ))}
          </ul>
        </Carte>
      </div>
      <Carte titre={t("commun.actions")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ libelle={t("admin.agences.commission")}>
            <Saisie
              type="number"
              min={0}
              max={100}
              step={0.5}
              dir="ltr"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
          </Champ>
          <Champ libelle={t("admin.agences.motif")}>
            <Saisie value={motif} onChange={(e) => setMotif(e.target.value)} />
          </Champ>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {a.statut !== "validee" && (
            <Bouton
              chargement={enCours}
              onClick={() => void decider(a.statut === "suspendue" ? "reactiver" : "valider")}
            >
              {t(a.statut === "suspendue" ? "admin.agences.reactiver" : "admin.agences.valider")}
            </Bouton>
          )}
          {a.statut === "validee" && (
            <Bouton
              variante="secondaire"
              chargement={enCours}
              onClick={() => void decider("valider")}
            >
              {t("commun.enregistrer")}
            </Bouton>
          )}
          {a.statut !== "suspendue" && (
            <Bouton
              variante="danger"
              chargement={enCours}
              onClick={() => void decider("suspendre")}
            >
              {t("admin.agences.suspendre")}
            </Bouton>
          )}
        </div>
      </Carte>
    </div>
  );
}
