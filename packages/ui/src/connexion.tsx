"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import type { Jetons } from "./client-api.js";
import { Bouton, Case, Champ, Message, Saisie } from "./composants.js";
import { useMessageErreur } from "./erreurs.js";
import { type Profil, useSession } from "./session.js";

/** Connexion par numéro de téléphone + code SMS (section 3.1). */
export function ConnexionOtp({
  avecConsentement = false,
  onConnecte,
}: {
  avecConsentement?: boolean;
  onConnecte?: () => void;
}) {
  const t = useTranslations();
  const { api, connecte } = useSession();
  const messageErreur = useMessageErreur();
  const [etape, setEtape] = useState<"telephone" | "code">("telephone");
  const [telephone, setTelephone] = useState("");
  const [code, setCode] = useState("");
  const [consentement, setConsentement] = useState(!avecConsentement);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  const envoyer = async (e?: FormEvent) => {
    e?.preventDefault();
    setErreur(null);
    setChargement(true);
    try {
      await api.post("/auth/otp/envoyer", { telephone });
      setEtape("code");
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setChargement(false);
    }
  };

  const verifier = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    try {
      const r = await api.post<Jetons & { utilisateur: Profil }>("/auth/otp/verifier", {
        telephone,
        code,
      });
      connecte(r);
      if (avecConsentement && !r.utilisateur.consentementLe)
        await api.patch("/moi", { consentement: true });
      onConnecte?.();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t("ui.connexionTitre")}</h1>
        <p className="text-sm text-attenue">{t("ui.connexionSousTitre")}</p>
      </div>
      {erreur && <Message ton="erreur">{erreur}</Message>}
      {etape === "telephone" ? (
        <form onSubmit={envoyer} className="flex flex-col gap-4">
          <Champ libelle={t("commun.telephone")} aide={t("ui.telephoneAide")}>
            <Saisie
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              required
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
            />
          </Champ>
          {avecConsentement && (
            <Case
              libelle={t("ui.consentement")}
              checked={consentement}
              onChange={(e) => setConsentement(e.target.checked)}
            />
          )}
          <Bouton
            type="submit"
            chargement={chargement}
            disabled={!consentement || telephone.length < 9}
          >
            {t("ui.envoyerCode")}
          </Bouton>
        </form>
      ) : (
        <form onSubmit={verifier} className="flex flex-col gap-4">
          <p className="text-sm">{t("ui.codeEnvoye", { telephone })}</p>
          <Champ libelle={t("ui.code")}>
            <Saisie
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              dir="ltr"
              required
              autoFocus
              className="text-center text-2xl tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </Champ>
          <Bouton type="submit" chargement={chargement} disabled={code.length !== 6}>
            {t("ui.verifier")}
          </Bouton>
          <div className="flex justify-between text-sm">
            <button
              type="button"
              className="text-marque-700 underline"
              onClick={() => setEtape("telephone")}
            >
              {t("ui.changerNumero")}
            </button>
            <button
              type="button"
              className="text-marque-700 underline"
              onClick={() => void envoyer()}
            >
              {t("ui.renvoyer")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
