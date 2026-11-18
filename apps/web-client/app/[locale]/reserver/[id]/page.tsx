"use client";

import { COMMUNES_BEJAIA, type Langue } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Champ,
  Chargement,
  ConnexionOtp,
  Message,
  Saisie,
  formaterDate,
  formaterMontant,
  useMessageErreur,
  useSession,
  Periode,
  PuceIcone,
  Case,
  Liste,
} from "@lvb/ui";
import { CheckCircle2, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useState, type FormEvent } from "react";
import { Link } from "@/i18n/navigation";
import type { FicheVehicule, Prix } from "@/lib/types";

type Document = { type: string; numero: string | null; dateDelivrance: string | null };
type Reservation = { id: string; code: string; statut: string };

function Tunnel({ id }: { id: string }) {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const sp = useSearchParams();
  const { api, profil, pret, recharger } = useSession();
  const messageErreur = useMessageErreur();
  const debut = sp.get("debut") ?? "";
  const fin = sp.get("fin") ?? "";
  const options = (sp.get("options") ?? "").split(",").filter(Boolean);
  const livraison = sp.get("livraison") === "true";
  const [adresse, setAdresse] = useState({
    adresse: "",
    commune: "Béjaïa",
    instructions: "",
    recuperation: true,
  });
  const [vehicule, setVehicule] = useState<FicheVehicule | null>(null);
  const [prix, setPrix] = useState<Prix | null>(null);
  const [permis, setPermis] = useState<Document | null | undefined>(undefined);
  const [f, setF] = useState({
    prenom: "",
    nom: "",
    dateNaissance: "",
    numeroPermis: "",
    dateDelivrance: "",
    dateExpiration: "",
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<Reservation | null>(null);

  useEffect(() => {
    void api
      .get<FicheVehicule>(`/vehicules/${id}`)
      .then(setVehicule)
      .catch((e) => setErreur(messageErreur(e)));
    void api
      .get<Prix>(`/vehicules/${id}/prix`, {
        debut,
        fin,
        options: options.join(","),
        livraison: livraison ? "true" : undefined,
      })
      .then(setPrix)
      .catch((e) => setErreur(messageErreur(e)));
  }, [api, id, debut, fin]);

  useEffect(() => {
    if (!profil) return;
    setF((x) => ({
      ...x,
      prenom: profil.prenom ?? "",
      nom: profil.nom ?? "",
      dateNaissance: profil.dateNaissance ?? "",
    }));
    void api
      .get<Document[]>("/moi/documents")
      .then((d) => setPermis(d.find((x) => x.type === "permis") ?? null));
  }, [api, profil]);

  const confirmer = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await api.patch("/moi", { prenom: f.prenom, nom: f.nom, dateNaissance: f.dateNaissance });
      if (!permis) {
        await api.post("/moi/documents", {
          type: "permis",
          numero: f.numeroPermis,
          dateDelivrance: f.dateDelivrance,
          dateExpiration: f.dateExpiration || null,
          fichiers: {},
        });
      }
      const r = await api.post<Reservation>("/reservations", {
        vehiculeId: id,
        debut,
        fin,
        options,
        ...(livraison
          ? {
              livraison: true,
              adresseLivraison: { ...adresse, instructions: adresse.instructions || undefined },
            }
          : {}),
      });
      await recharger();
      setResultat(r);
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  };

  if (!pret) return <Chargement />;
  if (resultat)
    return (
      <Carte className="mx-auto max-w-lg text-center">
        <div className="mb-4 flex justify-center">
          <PuceIcone icone={CheckCircle2} ton="menthe" taille="grande" />
        </div>
        <h1 className="mb-2 text-xl font-bold">{t("client.reservation.succesTitre")}</h1>
        <p className="mb-4 text-sm">
          {resultat.statut === "confirmee"
            ? t("client.reservation.succesConfirmee")
            : t("client.reservation.succesTexte")}
        </p>
        <p className="text-sm text-attenue">{t("client.reservation.code")}</p>
        <p className="ltr mb-4 text-2xl font-bold tracking-widest">{resultat.code}</p>
        <Link
          href={`/compte/${resultat.id}`}
          className="inline-block rounded-lg bg-marque-600 px-4 py-2 font-medium text-white"
        >
          {t("client.mesReservations.titre")}
        </Link>
      </Carte>
    );

  return (
    <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">{t("client.reservation.titre")}</h1>
        {!profil ? (
          <Carte>
            <p className="mb-3 text-sm text-attenue">{t("client.reservation.connexionRequise")}</p>
            <ConnexionOtp avecConsentement />
          </Carte>
        ) : (
          <Carte titre={t("client.reservation.conducteur")}>
            <form onSubmit={confirmer} className="grid gap-3 sm:grid-cols-2">
              <Champ libelle={t("commun.prenom")}>
                <Saisie
                  required
                  value={f.prenom}
                  onChange={(e) => setF({ ...f, prenom: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("commun.nom")}>
                <Saisie
                  required
                  value={f.nom}
                  onChange={(e) => setF({ ...f, nom: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("commun.dateNaissance")}>
                <Saisie
                  type="date"
                  required
                  value={f.dateNaissance}
                  onChange={(e) => setF({ ...f, dateNaissance: e.target.value })}
                />
              </Champ>
              {permis === null && (
                <>
                  <Champ libelle={t("client.reservation.numeroPermis")}>
                    <Saisie
                      required
                      dir="ltr"
                      value={f.numeroPermis}
                      onChange={(e) => setF({ ...f, numeroPermis: e.target.value })}
                    />
                  </Champ>
                  <Champ libelle={t("client.reservation.dateDelivrancePermis")}>
                    <Saisie
                      type="date"
                      required
                      value={f.dateDelivrance}
                      onChange={(e) => setF({ ...f, dateDelivrance: e.target.value })}
                    />
                  </Champ>
                  <Champ libelle={t("client.reservation.dateExpirationPermis")}>
                    <Saisie
                      type="date"
                      value={f.dateExpiration}
                      onChange={(e) => setF({ ...f, dateExpiration: e.target.value })}
                    />
                  </Champ>
                </>
              )}
              {livraison && (
                <fieldset className="grid gap-3 rounded-2xl bg-lavande-50 p-4 sm:col-span-2 sm:grid-cols-2">
                  <legend className="sr-only">{t("livraison.titre")}</legend>
                  <div className="flex items-center gap-2 font-medium text-lavande-800 sm:col-span-2">
                    <Truck className="size-[18px]" strokeWidth={1.9} />
                    {t("livraison.titre")}
                  </div>
                  <Champ libelle={t("livraison.adresse")} className="sm:col-span-2">
                    <Saisie
                      required
                      minLength={5}
                      value={adresse.adresse}
                      onChange={(e) => setAdresse({ ...adresse, adresse: e.target.value })}
                    />
                  </Champ>
                  <Champ libelle={t("livraison.commune")}>
                    <Liste
                      value={adresse.commune}
                      onChange={(e) => setAdresse({ ...adresse, commune: e.target.value })}
                    >
                      {COMMUNES_BEJAIA.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Liste>
                  </Champ>
                  <Champ libelle={t("livraison.instructions")}>
                    <Saisie
                      value={adresse.instructions}
                      onChange={(e) => setAdresse({ ...adresse, instructions: e.target.value })}
                    />
                  </Champ>
                  <div className="sm:col-span-2">
                    <Case
                      libelle={t("livraison.recuperation")}
                      checked={adresse.recuperation}
                      onChange={(e) => setAdresse({ ...adresse, recuperation: e.target.checked })}
                    />
                  </div>
                </fieldset>
              )}
              {permis && (
                <p className="text-sm text-attenue sm:col-span-2">
                  {t("pdf.permis")} : <span className="ltr">{permis.numero}</span>
                </p>
              )}
              {erreur && (
                <div className="sm:col-span-2">
                  <Message ton="erreur">{erreur}</Message>
                </div>
              )}
              <Bouton
                type="submit"
                chargement={enCours}
                disabled={permis === undefined || !prix?.disponible}
                className="sm:col-span-2"
              >
                {t("client.reservation.confirmer")}
              </Bouton>
            </form>
          </Carte>
        )}
      </div>
      <Carte titre={t("client.reservation.recapitulatif")} className="self-start">
        {!vehicule || !prix ? (
          erreur ? (
            <Message ton="erreur">{erreur}</Message>
          ) : (
            <Chargement />
          )
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            {vehicule.photos[0] && (
              <img
                src={vehicule.photos[0]}
                alt=""
                className="aspect-[16/10] w-full rounded-lg object-cover"
              />
            )}
            <div className="font-semibold">
              {vehicule.marque} {vehicule.modele}
            </div>
            <div className="text-attenue">
              {vehicule.agence.raisonSociale} — {vehicule.pointRetrait.nom}
            </div>
            <div>
              <Periode debut={formaterDate(debut, langue)} fin={formaterDate(fin, langue)} />
            </div>
            {prix.fraisLivraison > 0 && (
              <div className="flex justify-between">
                <span>{t("options.livraison")}</span>
                <span>{formaterMontant(prix.fraisLivraison, langue)}</span>
              </div>
            )}
            {prix.options.map((o) => (
              <div key={o.code} className="flex justify-between">
                <span>{t(`options.${o.code}`)}</span>
                <span>{formaterMontant(o.montant, langue)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-trait pt-2 text-base font-bold">
              <span>{t("commun.total")}</span>
              <span>{formaterMontant(prix.total, langue)}</span>
            </div>
            <div className="flex justify-between text-attenue">
              <span>{t("pdf.caution")}</span>
              <span>{formaterMontant(prix.caution, langue)}</span>
            </div>
            <p className="text-xs text-attenue">{t("client.fiche.paiementSurPlace")}</p>
            {!prix.disponible && <Message ton="alerte">{t("client.fiche.indisponible")}</Message>}
          </div>
        )}
      </Carte>
    </div>
  );
}

export default function Reserver({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<Chargement />}>
      <Tunnel id={id} />
    </Suspense>
  );
}
