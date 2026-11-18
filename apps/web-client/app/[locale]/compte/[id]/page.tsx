"use client";

import { BAREMES_ANNULATION, type Langue } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Champ,
  Chargement,
  Message,
  Modale,
  Pastille,
  Saisie,
  depuisChampLocal,
  formaterDate,
  formaterMontant,
  useMessageErreur,
  useSession,
  useTempsReel,
  versChampLocal,
  Periode,
} from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { use, useState } from "react";
import { GardeClient } from "@/components/garde-client";
import { useDonneesClient } from "@/lib/client";
import { URL_API } from "@/lib/config";

type Detail = {
  id: string;
  code: string;
  statut: string;
  debut: string;
  fin: string;
  prixTotal: number;
  caution: number;
  politiqueAnnulation: "souple" | "moderee" | "stricte";
  motifRefus: string | null;
  detailPrix: {
    jours: number;
    prixJourApplique: number;
    options: { code: string; montant: number }[];
  } | null;
  vehicule: { marque: string; modele: string; immatriculation: string };
  agence: { raisonSociale: string; telephone: string; adresse: string };
  pointDepart: { nom: string; adresse: string } | null;
  etatsDesLieux: { moment: "depart" | "retour" }[];
};

function Fiche({ id }: { id: string }) {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { api, jetonAcces } = useSession();
  const messageErreur = useMessageErreur();
  const { donnees: r, erreur, recharger } = useDonneesClient<Detail>(`/moi/reservations/${id}`);
  const [fenetre, setFenetre] = useState<null | "annuler" | "dates">(null);
  const [dates, setDates] = useState({ debut: "", fin: "" });
  const [message, setMessage] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  useTempsReel(URL_API, jetonAcces, {
    "reservation.statut_change": (d) => (d as { id: string }).id === id && void recharger(),
  });

  if (erreur) return <Message ton="erreur">{erreur}</Message>;
  if (!r) return <Chargement />;
  const heures = (new Date(r.debut).getTime() - Date.now()) / 3_600_000;
  const pourcentage =
    heures < 0
      ? 0
      : (BAREMES_ANNULATION[r.politiqueAnnulation].find((p) => heures >= p.heuresAvantDepartMin)
          ?.pourcentage ?? 0);
  const action = async (f: () => Promise<unknown>, succes: string) => {
    setEnCours(true);
    try {
      await f();
      setFenetre(null);
      setMessage({ ton: "succes", texte: succes });
      await recharger();
    } catch (e) {
      setMessage({ ton: "erreur", texte: messageErreur(e) });
    } finally {
      setEnCours(false);
    }
  };
  const modifiable = ["en_attente_agence", "confirmee"].includes(r.statut) && heures > 0;
  const tel = r.agence.telephone;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="ltr text-xl font-bold">{r.code}</h1>
        <Pastille statut={r.statut}>{t(`statutsReservation.${r.statut}`)}</Pastille>
      </div>
      {message && <Message ton={message.ton}>{message.texte}</Message>}
      {r.motifRefus && <Message ton="info">{r.motifRefus}</Message>}
      <Carte>
        <div className="flex flex-col gap-1 text-sm">
          <div className="text-base font-semibold">
            {r.vehicule.marque} {r.vehicule.modele}
          </div>
          <div>
            <Periode debut={formaterDate(r.debut, langue)} fin={formaterDate(r.fin, langue)} />
          </div>
          {r.pointDepart && (
            <div className="text-attenue">
              {r.pointDepart.nom} — {r.pointDepart.adresse}
            </div>
          )}
          <div className="mt-2 flex justify-between font-semibold">
            <span>{t("commun.total")}</span>
            <span>{formaterMontant(r.prixTotal, langue)}</span>
          </div>
          <div className="flex justify-between text-attenue">
            <span>{t("pdf.caution")}</span>
            <span>{formaterMontant(r.caution, langue)}</span>
          </div>
          <div className="text-xs text-attenue">
            {t(`politiques.${r.politiqueAnnulation}`)} —{" "}
            {t(`politiques.${r.politiqueAnnulation}_detail`)}
          </div>
        </div>
      </Carte>
      <Carte titre={t("client.mesReservations.contacter")}>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="w-full">
            {r.agence.raisonSociale} — {r.agence.adresse}
          </span>
          <a
            href={`tel:${tel}`}
            className="rounded-lg bg-marque-600 px-3 py-2 font-medium text-white"
          >
            {t("commun.appeler")}
          </a>
          <a
            href={`https://wa.me/${tel.replace("+", "")}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white"
          >
            {t("commun.whatsapp")}
          </a>
        </div>
      </Carte>
      <div className="flex flex-wrap gap-2">
        {["confirmee", "en_cours", "terminee"].includes(r.statut) && (
          <Bouton
            variante="secondaire"
            onClick={() => void api.ouvrirFichier(`/contrats/${id}/pdf`)}
          >
            {t("client.mesReservations.contrat")}
          </Bouton>
        )}
        {r.etatsDesLieux.map((e) => (
          <Bouton
            key={e.moment}
            variante="secondaire"
            onClick={() =>
              void api.ouvrirFichier(`/reservations/${id}/etat-des-lieux/${e.moment}/pdf`)
            }
          >
            {t("client.mesReservations.edl")} — {t(`pdf.${e.moment}`)}
          </Bouton>
        ))}
        {modifiable && (
          <>
            <Bouton
              variante="secondaire"
              onClick={() => {
                setDates({ debut: versChampLocal(r.debut), fin: versChampLocal(r.fin) });
                setFenetre("dates");
              }}
            >
              {t("client.mesReservations.modifierDates")}
            </Bouton>
            <Bouton variante="danger" onClick={() => setFenetre("annuler")}>
              {t("client.mesReservations.annuler")}
            </Bouton>
          </>
        )}
      </div>
      <Modale
        ouverte={fenetre === "annuler"}
        titre={t("client.mesReservations.annuler")}
        onFermer={() => setFenetre(null)}
      >
        <p className="mb-4 text-sm">
          {t("client.mesReservations.confirmerAnnulation", { pourcentage })}
        </p>
        <Bouton
          variante="danger"
          chargement={enCours}
          onClick={() =>
            void action(
              () => api.post(`/reservations/${id}/annuler`, {}),
              t("client.mesReservations.annulee"),
            )
          }
        >
          {t("commun.confirmer")}
        </Bouton>
      </Modale>
      <Modale
        ouverte={fenetre === "dates"}
        titre={t("client.mesReservations.modifierDates")}
        onFermer={() => setFenetre(null)}
      >
        <div className="flex flex-col gap-3">
          <Champ libelle={t("client.accueil.depart")}>
            <Saisie
              type="datetime-local"
              value={dates.debut}
              onChange={(e) => setDates({ ...dates, debut: e.target.value })}
            />
          </Champ>
          <Champ libelle={t("client.accueil.retour")}>
            <Saisie
              type="datetime-local"
              value={dates.fin}
              onChange={(e) => setDates({ ...dates, fin: e.target.value })}
            />
          </Champ>
          <Bouton
            chargement={enCours}
            onClick={() =>
              void action(
                () =>
                  api.patch(`/reservations/${id}/dates`, {
                    debut: depuisChampLocal(dates.debut),
                    fin: depuisChampLocal(dates.fin),
                  }),
                t("ui.enregistre"),
              )
            }
          >
            {t("commun.enregistrer")}
          </Bouton>
        </div>
      </Modale>
    </div>
  );
}

export default function PageReservation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <GardeClient>
      <Fiche id={id} />
    </GardeClient>
  );
}
