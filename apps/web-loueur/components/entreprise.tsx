"use client";

import { Bouton, Champ, Liste, Message, Modale, Saisie, Zone, useSession } from "@lvb/ui";
import { Building2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAction, useDonnees } from "@/lib/donnees";

export type Entreprise = {
  id: string;
  raisonSociale: string;
  nif: string | null;
  nis: string | null;
  registreCommerce: string | null;
  articleImposition: string | null;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  contactNom: string | null;
  delaiPaiementJours: number;
  notesInternes: string | null;
  listeNoire: boolean;
  locations?: number;
  chiffreAffaires?: number;
  resteAPayer?: number;
};

type Champs = {
  raisonSociale: string;
  nif: string;
  nis: string;
  registreCommerce: string;
  articleImposition: string;
  adresse: string;
  telephone: string;
  email: string;
  contactNom: string;
  delaiPaiementJours: string;
  notesInternes: string;
};

const vide: Champs = {
  raisonSociale: "",
  nif: "",
  nis: "",
  registreCommerce: "",
  articleImposition: "",
  adresse: "",
  telephone: "",
  email: "",
  contactNom: "",
  delaiPaiementJours: "0",
  notesInternes: "",
};

/** Formulaire (création ou modification) d'un client entreprise, dans une fenêtre. */
export function ModaleEntreprise({
  ouverte,
  entreprise,
  onFermer,
  onEnregistree,
}: {
  ouverte: boolean;
  entreprise?: Entreprise | null;
  onFermer: () => void;
  onEnregistree: (e: Entreprise) => void;
}) {
  const t = useTranslations();
  const { api } = useSession();
  const action = useAction();
  const [f, setF] = useState<Champs>(vide);

  useEffect(() => {
    if (!ouverte) return;
    action.setErreur(null);
    setF(
      entreprise
        ? {
            raisonSociale: entreprise.raisonSociale,
            nif: entreprise.nif ?? "",
            nis: entreprise.nis ?? "",
            registreCommerce: entreprise.registreCommerce ?? "",
            articleImposition: entreprise.articleImposition ?? "",
            adresse: entreprise.adresse ?? "",
            telephone: entreprise.telephone ?? "",
            email: entreprise.email ?? "",
            contactNom: entreprise.contactNom ?? "",
            delaiPaiementJours: String(entreprise.delaiPaiementJours),
            notesInternes: entreprise.notesInternes ?? "",
          }
        : vide,
    );
  }, [ouverte, entreprise]); // action est recréé à chaque rendu

  const champ = (cle: keyof Champs, ltr = false) => ({
    value: f[cle],
    dir: ltr ? ("ltr" as const) : undefined,
    onChange: (e: { target: { value: string } }) => setF({ ...f, [cle]: e.target.value }),
  });

  return (
    <Modale
      ouverte={ouverte}
      titre={entreprise ? t("entreprises.modifier") : t("entreprises.ajouter")}
      onFermer={onFermer}
    >
      <div className="flex flex-col gap-3">
        <Champ libelle={t("entreprises.raisonSociale")}>
          <Saisie autoFocus {...champ("raisonSociale")} />
        </Champ>
        <div className="grid grid-cols-2 gap-3">
          <Champ libelle={t("entreprises.contact")}>
            <Saisie {...champ("contactNom")} />
          </Champ>
          <Champ libelle={t("entreprises.telephone")}>
            <Saisie type="tel" inputMode="tel" {...champ("telephone", true)} />
          </Champ>
        </div>
        <Champ libelle={t("entreprises.email")}>
          <Saisie type="email" {...champ("email", true)} />
        </Champ>
        <Champ libelle={t("entreprises.adresse")}>
          <Saisie {...champ("adresse")} />
        </Champ>
        <div className="mt-1 text-sm font-semibold">{t("entreprises.fiscal")}</div>
        <div className="grid grid-cols-2 gap-3">
          <Champ libelle={t("entreprises.nif")}>
            <Saisie inputMode="numeric" {...champ("nif", true)} />
          </Champ>
          <Champ libelle={t("entreprises.nis")}>
            <Saisie inputMode="numeric" {...champ("nis", true)} />
          </Champ>
          <Champ libelle={t("entreprises.rc")}>
            <Saisie {...champ("registreCommerce", true)} />
          </Champ>
          <Champ libelle={t("entreprises.ai")}>
            <Saisie inputMode="numeric" {...champ("articleImposition", true)} />
          </Champ>
        </div>
        <Champ libelle={t("entreprises.delai")}>
          <Saisie
            type="number"
            inputMode="numeric"
            min={0}
            max={365}
            {...champ("delaiPaiementJours", true)}
          />
        </Champ>
        <Champ libelle={t("entreprises.notes")}>
          <Zone rows={2} {...champ("notesInternes")} />
        </Champ>
        {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
        <Bouton
          chargement={action.enCours}
          disabled={f.raisonSociale.trim().length < 2}
          onClick={() =>
            void action.executer(async () => {
              const corps = {
                ...f,
                delaiPaiementJours: Number(f.delaiPaiementJours) || 0,
              };
              const e = entreprise
                ? await api.patch<Entreprise>(`/agence/entreprises/${entreprise.id}`, corps)
                : await api.post<Entreprise>("/agence/entreprises", corps);
              onEnregistree(e);
            })
          }
        >
          {t("commun.enregistrer")}
        </Bouton>
      </div>
    </Modale>
  );
}

/** « Facturée à » dans la fiche réservation : affiche l'entreprise et permet de la changer. */
export function FactureeA({
  reservationId,
  entrepriseId,
  modifiable,
  onModifiee,
}: {
  reservationId: string;
  entrepriseId: string | null | undefined;
  modifiable: boolean;
  onModifiee: () => void;
}) {
  const t = useTranslations();
  const { api } = useSession();
  const action = useAction();
  const { donnees } = useDonnees<Entreprise[]>("/agence/entreprises");
  const actuelle = donnees?.find((e) => e.id === entrepriseId);
  if (!modifiable && !entrepriseId) return null;
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-ciel-50 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-ciel-800">
        <Building2 className="size-4" /> {t("entreprises.facturee")}
      </div>
      {actuelle && (
        <Link
          href={`/clients/entreprises/${actuelle.id}`}
          className="font-medium text-marque-700 underline"
        >
          {actuelle.raisonSociale}
        </Link>
      )}
      {modifiable && donnees && (
        <Liste
          aria-label={t("entreprises.rattacher")}
          value={entrepriseId ?? ""}
          disabled={action.enCours}
          onChange={(e) =>
            void action.executer(async () => {
              await api.patch(`/agence/reservations/${reservationId}/entreprise`, {
                entrepriseId: e.target.value || null,
              });
              onModifiee();
            })
          }
        >
          <option value="">{t("entreprises.aucuneChoisie")}</option>
          {donnees
            .filter((x) => !x.listeNoire || x.id === entrepriseId)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.raisonSociale}
              </option>
            ))}
        </Liste>
      )}
      {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
    </div>
  );
}
