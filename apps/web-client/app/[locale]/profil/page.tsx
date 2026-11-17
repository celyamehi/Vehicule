"use client";

import { LANGUES } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Champ,
  Liste,
  Message,
  Pastille,
  Saisie,
  televerser,
  useMessageErreur,
  useSession,
} from "@lvb/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { GardeClient } from "@/components/garde-client";
import { useDonneesClient } from "@/lib/client";

type Document = {
  id: string;
  type: string;
  numero: string | null;
  dateDelivrance: string | null;
  statutVerification: string;
  urls: { recto: string | null; verso: string | null };
};

function Profil() {
  const t = useTranslations();
  const { api, profil, recharger } = useSession();
  const messageErreur = useMessageErreur();
  const { donnees: documents, recharger: rechargerDocs } =
    useDonneesClient<Document[]>("/moi/documents");
  const [f, setF] = useState({ prenom: "", nom: "", email: "", dateNaissance: "", langue: "fr" });
  const [permis, setPermis] = useState({
    numero: "",
    dateDelivrance: "",
    recto: null as File | null,
    verso: null as File | null,
  });
  const [message, setMessage] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  useEffect(() => {
    if (profil)
      setF({
        prenom: profil.prenom ?? "",
        nom: profil.nom ?? "",
        email: profil.email ?? "",
        dateNaissance: profil.dateNaissance ?? "",
        langue: profil.langue,
      });
  }, [profil]);
  const executer = async (fn: () => Promise<unknown>) => {
    setEnCours(true);
    try {
      await fn();
      setMessage({ ton: "succes", texte: t("ui.enregistre") });
    } catch (e) {
      setMessage({ ton: "erreur", texte: messageErreur(e) });
    } finally {
      setEnCours(false);
    }
  };
  const verifie = documents?.some((d) => d.statutVerification === "verifie");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold">{t("client.profil.titre")}</h1>
        {verifie && <Pastille statut="verifie">{t("client.profil.verifie")}</Pastille>}
      </div>
      {message && <Message ton={message.ton}>{message.texte}</Message>}
      <Carte>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ libelle={t("commun.prenom")}>
            <Saisie value={f.prenom} onChange={(e) => setF({ ...f, prenom: e.target.value })} />
          </Champ>
          <Champ libelle={t("commun.nom")}>
            <Saisie value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
          </Champ>
          <Champ libelle={t("commun.email")}>
            <Saisie
              type="email"
              dir="ltr"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
            />
          </Champ>
          <Champ libelle={t("commun.dateNaissance")}>
            <Saisie
              type="date"
              value={f.dateNaissance}
              onChange={(e) => setF({ ...f, dateNaissance: e.target.value })}
            />
          </Champ>
          <Champ libelle={t("client.profil.langue")}>
            <Liste value={f.langue} onChange={(e) => setF({ ...f, langue: e.target.value })}>
              {LANGUES.map((l) => (
                <option key={l} value={l}>
                  {t(`langues.${l}`)}
                </option>
              ))}
            </Liste>
          </Champ>
        </div>
        <Bouton
          className="mt-4"
          chargement={enCours}
          onClick={() =>
            void executer(async () => {
              await api.patch("/moi", {
                ...f,
                email: f.email || null,
                dateNaissance: f.dateNaissance || undefined,
              });
              await recharger();
            })
          }
        >
          {t("commun.enregistrer")}
        </Bouton>
      </Carte>
      <Carte titre={t("client.profil.documents")}>
        <ul className="mb-4 flex flex-col gap-2 text-sm">
          {documents?.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2">
              <span>
                {t("pdf.permis")} <span className="ltr">{d.numero}</span>
              </span>
              <Pastille statut={d.statutVerification}>
                {t(
                  d.statutVerification === "verifie"
                    ? "client.profil.verifie"
                    : "client.profil.enVerification",
                )}
              </Pastille>
            </li>
          ))}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ libelle={t("client.reservation.numeroPermis")}>
            <Saisie
              dir="ltr"
              value={permis.numero}
              onChange={(e) => setPermis({ ...permis, numero: e.target.value })}
            />
          </Champ>
          <Champ libelle={t("client.reservation.dateDelivrancePermis")}>
            <Saisie
              type="date"
              value={permis.dateDelivrance}
              onChange={(e) => setPermis({ ...permis, dateDelivrance: e.target.value })}
            />
          </Champ>
          <Champ libelle={t("client.profil.recto")}>
            <Saisie
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPermis({ ...permis, recto: e.target.files?.[0] ?? null })}
            />
          </Champ>
          <Champ libelle={t("client.profil.verso")}>
            <Saisie
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPermis({ ...permis, verso: e.target.files?.[0] ?? null })}
            />
          </Champ>
        </div>
        <Bouton
          className="mt-4"
          variante="secondaire"
          chargement={enCours}
          disabled={!permis.numero || !permis.dateDelivrance}
          onClick={() =>
            void executer(async () => {
              const recto = permis.recto
                ? await televerser(api, permis.recto, "document_identite")
                : undefined;
              const verso = permis.verso
                ? await televerser(api, permis.verso, "document_identite")
                : undefined;
              await api.post("/moi/documents", {
                type: "permis",
                numero: permis.numero,
                dateDelivrance: permis.dateDelivrance,
                fichiers: { recto, verso },
              });
              await rechargerDocs();
            })
          }
        >
          {t("client.profil.ajouterPermis")}
        </Bouton>
      </Carte>
    </div>
  );
}

export default function PageProfil() {
  return (
    <GardeClient>
      <Profil />
    </GardeClient>
  );
}
