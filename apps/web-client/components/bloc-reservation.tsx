"use client";

import { OPTIONS_RESERVABLES, type Langue } from "@lvb/shared";
import {
  Bouton,
  Case,
  Champ,
  Message,
  Saisie,
  depuisChampLocal,
  formaterMontant,
  useMessageErreur,
  useSession,
  versChampLocal,
} from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { versRequete } from "@/lib/recherche";
import type { FicheVehicule, Prix } from "@/lib/types";

/** Choix des dates et options, prix total détaillé et bouton « Réserver » (3.3, 3.4). */
export function BlocReservation({
  vehicule,
  debutInitial,
  finInitiale,
}: {
  vehicule: FicheVehicule;
  debutInitial: string;
  finInitiale: string;
}) {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { api } = useSession();
  const routeur = useRouter();
  const messageErreur = useMessageErreur();
  const [debut, setDebut] = useState(versChampLocal(debutInitial));
  const [fin, setFin] = useState(versChampLocal(finInitiale));
  const [options, setOptions] = useState<string[]>([]);
  const [prix, setPrix] = useState<Prix | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const proposees = OPTIONS_RESERVABLES.filter((o) => vehicule.tarif?.supplements[o]);

  useEffect(() => {
    let annule = false;
    setErreur(null);
    api
      .get<Prix>(`/vehicules/${vehicule.id}/prix`, {
        debut: depuisChampLocal(debut),
        fin: depuisChampLocal(fin),
        options: options.join(","),
      })
      .then((p) => !annule && setPrix(p))
      .catch((e) => {
        if (annule) return;
        setPrix(null);
        setErreur(messageErreur(e));
      });
    return () => {
      annule = true;
    };
    // messageErreur change à chaque rendu : volontairement absent des dépendances.
  }, [api, vehicule.id, debut, fin, options]);

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-carte)] bg-surface shadow-[var(--shadow-douce)] p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-2">
        <Champ libelle={t("client.accueil.depart")}>
          <Saisie type="datetime-local" value={debut} onChange={(e) => setDebut(e.target.value)} />
        </Champ>
        <Champ libelle={t("client.accueil.retour")}>
          <Saisie
            type="datetime-local"
            min={debut}
            value={fin}
            onChange={(e) => setFin(e.target.value)}
          />
        </Champ>
      </div>
      {proposees.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-medium">{t("client.reservation.options")}</legend>
          {proposees.map((o) => {
            const s = vehicule.tarif!.supplements[o]!;
            return (
              <Case
                key={o}
                libelle={`${t(`options.${o}`)} (${s.parJour !== undefined ? `${formaterMontant(s.parJour, langue)} ${t("client.recherche.parJour")}` : formaterMontant(s.forfait ?? 0, langue)})`}
                checked={options.includes(o)}
                onChange={(e) =>
                  setOptions(e.target.checked ? [...options, o] : options.filter((x) => x !== o))
                }
              />
            );
          })}
        </fieldset>
      )}
      {erreur && <Message ton="erreur">{erreur}</Message>}
      {prix && (
        <dl className="grid grid-cols-[1fr_auto] gap-1 border-t border-trait pt-3 text-sm">
          <dt className="font-medium">{t("client.fiche.prixDetaille")}</dt>
          <dd />
          <dt>
            {t("client.fiche.location")} : {t("commun.jours", { n: prix.jours })} ×{" "}
            {formaterMontant(prix.prixJourApplique, langue)}
          </dt>
          <dd className="text-end tabular-nums">
            {formaterMontant(prix.sousTotalLocation, langue)}
          </dd>
          {prix.options.map((o) => (
            <div key={o.code} className="contents">
              <dt>{t(`options.${o.code}`)}</dt>
              <dd className="text-end tabular-nums">{formaterMontant(o.montant, langue)}</dd>
            </div>
          ))}
          <dt className="text-base font-bold">{t("commun.total")}</dt>
          <dd className="text-end text-base font-bold tabular-nums text-marque-700">
            {formaterMontant(prix.total, langue)}
          </dd>
          <dt className="text-attenue">{t("pdf.caution")}</dt>
          <dd className="text-end tabular-nums text-attenue">
            {formaterMontant(prix.caution, langue)}
          </dd>
        </dl>
      )}
      {prix && !prix.disponible && <Message ton="alerte">{t("client.fiche.indisponible")}</Message>}
      <p className="text-xs text-attenue">
        {vehicule.conditions.confirmationInstantanee
          ? t("client.fiche.confirmationInstantanee")
          : t("client.fiche.confirmationSous2h")}{" "}
        · {t("client.fiche.paiementSurPlace")}
      </p>
      <Bouton
        disabled={!prix?.disponible}
        onClick={() =>
          routeur.push(
            `/reserver/${vehicule.id}?${versRequete({ debut: depuisChampLocal(debut), fin: depuisChampLocal(fin), options: options.join(",") || undefined })}`,
          )
        }
      >
        {t("client.fiche.reserver")}
      </Bouton>
    </div>
  );
}
