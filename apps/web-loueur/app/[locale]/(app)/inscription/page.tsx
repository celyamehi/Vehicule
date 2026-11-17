"use client";

import { WILAYAS, WILAYA_BEJAIA, nomWilaya, type Langue } from "@lvb/shared";
import { Bouton, Carte, Champ, Liste, Message, Saisie, televerser, useSession } from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAction } from "@/lib/donnees";

export default function Inscription() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { api, recharger, choisirAgence } = useSession();
  const routeur = useRouter();
  const { executer, enCours, erreur } = useAction();
  const [f, setF] = useState({
    raisonSociale: "",
    nif: "",
    registreCommerce: "",
    agrement: "",
    wilaya: WILAYA_BEJAIA,
    adresse: "",
    telephone: "",
    email: "",
  });
  const [fichiers, setFichiers] = useState<File[]>([]);
  const maj = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: k === "wilaya" ? Number(e.target.value) : e.target.value });

  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    void executer(async () => {
      const justificatifs = await Promise.all(
        fichiers.map((x) => televerser(api, x, "justificatif_agence")),
      );
      const agence = await api.post<{ id: string }>("/agences", {
        ...f,
        agrement: f.agrement || undefined,
        email: f.email || undefined,
        justificatifs,
      });
      choisirAgence(agence.id);
      await recharger();
      routeur.push("/flotte");
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">{t("loueur.inscription.titre")}</h1>
      <p className="mb-4 text-sm text-attenue">{t("loueur.inscription.intro")}</p>
      <Carte>
        <form onSubmit={soumettre} className="grid gap-4 sm:grid-cols-2">
          <Champ libelle={t("loueur.inscription.raisonSociale")} className="sm:col-span-2">
            <Saisie required value={f.raisonSociale} onChange={maj("raisonSociale")} />
          </Champ>
          <Champ libelle={t("loueur.inscription.nif")} aide={t("validation.nif")}>
            <Saisie
              required
              inputMode="numeric"
              dir="ltr"
              pattern="\d{15,20}"
              value={f.nif}
              onChange={maj("nif")}
            />
          </Champ>
          <Champ libelle={t("loueur.inscription.registreCommerce")}>
            <Saisie
              required
              dir="ltr"
              value={f.registreCommerce}
              onChange={maj("registreCommerce")}
            />
          </Champ>
          <Champ libelle={t("loueur.inscription.agrement")}>
            <Saisie dir="ltr" value={f.agrement} onChange={maj("agrement")} />
          </Champ>
          <Champ libelle={t("commun.wilaya")}>
            <Liste value={f.wilaya} onChange={maj("wilaya")}>
              {WILAYAS.map((w) => (
                <option key={w.code} value={w.code}>
                  {String(w.code).padStart(2, "0")} — {nomWilaya(w.code, langue)}
                </option>
              ))}
            </Liste>
          </Champ>
          <Champ libelle={t("commun.adresse")} className="sm:col-span-2">
            <Saisie required value={f.adresse} onChange={maj("adresse")} />
          </Champ>
          <Champ libelle={t("commun.telephone")}>
            <Saisie required type="tel" dir="ltr" value={f.telephone} onChange={maj("telephone")} />
          </Champ>
          <Champ libelle={t("commun.email")}>
            <Saisie type="email" dir="ltr" value={f.email} onChange={maj("email")} />
          </Champ>
          <Champ libelle={t("loueur.inscription.justificatifs")} className="sm:col-span-2">
            <Saisie
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => setFichiers([...(e.target.files ?? [])])}
            />
          </Champ>
          {erreur && (
            <div className="sm:col-span-2">
              <Message ton="erreur">{erreur}</Message>
            </div>
          )}
          <Bouton type="submit" chargement={enCours} className="sm:col-span-2">
            {t("loueur.inscription.creer")}
          </Bouton>
        </form>
      </Carte>
    </div>
  );
}
