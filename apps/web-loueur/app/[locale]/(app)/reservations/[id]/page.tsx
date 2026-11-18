"use client";

import { MOYENS_PAIEMENT, TYPES_PAIEMENT, type Langue } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Case,
  Champ,
  Chargement,
  Liste,
  Message,
  Modale,
  PadSignature,
  Periode,
  Pastille,
  Saisie,
  Zone,
  depuisChampLocal,
  formaterDate,
  formaterMontant,
  useSession,
  useTempsReel,
  versChampLocal,
  FilMessages,
} from "@lvb/ui";
import { CheckCircle2, ClipboardCheck, MessagesSquare, PenLine } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, use, useState } from "react";
import { EnTete, usePeut } from "@/components/coquille";
import { FormulaireEtatDesLieux } from "@/components/etat-des-lieux";
import { Link } from "@/i18n/navigation";
import { URL_API } from "@/lib/config";
import { useAction, useDonnees } from "@/lib/donnees";
import type { EtatDesLieux, Reservation, Vehicule } from "@/lib/types";

type Detail = Reservation & {
  vehicule: {
    id: string;
    marque: string;
    modele: string;
    immatriculation: string;
    categorie: string;
    kmInclusParJour: number | null;
  };
  client: {
    id: string;
    nom: string | null;
    prenom: string | null;
    telephone: string;
    dateNaissance: string | null;
  } | null;
  pointDepart: { nom: string } | null;
  etatsDesLieux: EtatDesLieux[];
  paiements: { id: string; type: string; moyen: string; montant: number; createdAt: string }[];
  livraison: {
    adresse: string;
    commune: string;
    instructions?: string;
    recuperation: boolean;
  } | null;
};
type Contrat = { numero: string; signeLe: string } | null;
type Document = {
  id: string;
  type: string;
  numero: string | null;
  dateDelivrance: string | null;
  statutVerification: string;
  urls: { recto: string | null; verso: string | null };
};

type Fenetre =
  | null
  | "refuser"
  | "annuler"
  | "edl"
  | "contrat"
  | "retour"
  | "prolonger"
  | "reaffecter"
  | "encaisser";

export default function DetailReservation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const peut = usePeut();
  const { api, jetonAcces } = useSession();
  const { donnees: r, erreur, recharger } = useDonnees<Detail>(`/agence/reservations/${id}`);
  const { donnees: contrat, recharger: rechargerContrat } = useDonnees<Contrat>(`/contrats/${id}`);
  const { donnees: vehicules } = useDonnees<Vehicule[]>("/agence/vehicules");
  const action = useAction();
  const [fenetre, setFenetre] = useState<Fenetre>(null);
  const [texte, setTexte] = useState("");
  const [signatures, setSignatures] = useState<{ client: string | null; agence: string | null }>({
    client: null,
    agence: null,
  });
  const [fraisDommages, setFraisDommages] = useState("0");
  const [restituer, setRestituer] = useState(true);
  const [nouvelleFin, setNouvelleFin] = useState("");
  const [nouveauVehicule, setNouveauVehicule] = useState("");
  const [paiement, setPaiement] = useState({ type: "solde", moyen: "especes", montant: "" });
  const [documents, setDocuments] = useState<Document[] | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  useTempsReel(URL_API, jetonAcces, {
    "reservation.statut_change": (d) => (d as { id: string }).id === id && void recharger(),
    "reservation.modifiee": (d) => (d as { id: string }).id === id && void recharger(),
  });

  if (erreur) return <Message ton="erreur">{erreur}</Message>;
  if (!r) return <Chargement />;

  const edlDepart = r.etatsDesLieux.find((e) => e.moment === "depart");
  const edlRetour = r.etatsDesLieux.find((e) => e.moment === "retour");
  const fermer = () => {
    setFenetre(null);
    setTexte("");
  };
  const faire = (chemin: string, corps: object = {}) =>
    void action.executer(async () => {
      await api.post(`/agence/reservations/${id}/${chemin}`, corps);
      fermer();
      setSucces(t("loueur.reservations.ok"));
      await recharger();
      await rechargerContrat();
    });

  const encaisse = r.paiements
    .filter((p) => ["acompte", "solde"].includes(p.type))
    .reduce((s, p) => s + p.montant, 0);

  return (
    <div className="flex flex-col gap-4">
      <EnTete
        titre={
          <span className="flex flex-wrap items-center gap-2">
            <span className="ltr">{r.code}</span>
            <Pastille statut={r.statut}>{t(`statutsReservation.${r.statut}`)}</Pastille>
            <span className="text-sm font-normal text-attenue">{t(`origines.${r.origine}`)}</span>
          </span>
        }
      />
      {succes && <Message ton="succes">{succes}</Message>}
      {action.erreur && !fenetre && <Message ton="erreur">{action.erreur}</Message>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Carte titre={t("loueur.reservations.client")}>
          {r.client ? (
            <div className="flex flex-col gap-1 text-sm">
              <Link
                href={`/clients/${r.client.id}`}
                className="font-medium text-marque-700 underline"
              >
                {[r.client.prenom, r.client.nom].filter(Boolean).join(" ") || r.client.telephone}
              </Link>
              <a href={`tel:${r.client.telephone}`} className="ltr">
                {r.client.telephone}
              </a>
              <a
                className="text-emerald-700 underline"
                href={`https://wa.me/${r.client.telephone.replace("+", "")}`}
                target="_blank"
                rel="noreferrer"
              >
                {t("commun.whatsapp")}
              </a>
              <Bouton
                variante="fantome"
                taille="petite"
                className="mt-2 self-start"
                onClick={() =>
                  void action.executer(async () =>
                    setDocuments(
                      await api.get<Document[]>(`/agence/reservations/${id}/documents-client`),
                    ),
                  )
                }
              >
                {t("loueur.reservations.documentsClient")}
              </Bouton>
              {documents && (
                <ul className="text-xs">
                  {documents.length === 0 && <li className="text-attenue">{t("ui.aucun")}</li>}
                  {documents.map((d) => (
                    <li key={d.id} className="flex flex-wrap gap-2">
                      <span>
                        {d.type} <span className="ltr">{d.numero}</span>
                      </span>
                      {d.urls.recto && (
                        <a
                          className="underline"
                          href={d.urls.recto}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("client.profil.recto")}
                        </a>
                      )}
                      {d.urls.verso && (
                        <a
                          className="underline"
                          href={d.urls.verso}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("client.profil.verso")}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm">{r.motifBlocage}</p>
          )}
        </Carte>
        <Carte titre={t("loueur.reservations.vehicule")}>
          <div className="text-sm">
            <div className="font-medium">
              {r.vehicule.marque} {r.vehicule.modele}
            </div>
            <div className="ltr text-attenue">{r.vehicule.immatriculation}</div>
            <div className="mt-2">
              <Periode debut={formaterDate(r.debut, langue)} fin={formaterDate(r.fin, langue)} />
            </div>
            {r.pointDepart && <div className="text-attenue">{r.pointDepart.nom}</div>}
          </div>
        </Carte>
        <Carte titre={t("loueur.reservations.detailPrix")}>
          <dl className="grid grid-cols-2 gap-1 text-sm">
            {r.detailPrix && (
              <>
                <dt>
                  {t("commun.jours", { n: r.detailPrix.jours })} ×{" "}
                  {formaterMontant(r.detailPrix.prixJourApplique, langue)}
                </dt>
                <dd className="text-end tabular-nums">
                  {formaterMontant(r.detailPrix.sousTotalLocation, langue)}
                </dd>
                {r.detailPrix.options.map((o) => (
                  <Fragment key={o.code}>
                    <dt>{t(`options.${o.code}`)}</dt>
                    <dd className="text-end tabular-nums">{formaterMontant(o.montant, langue)}</dd>
                  </Fragment>
                ))}
                {r.detailPrix.fraisLivraison > 0 && (
                  <>
                    <dt>{t("options.livraison")}</dt>
                    <dd className="text-end tabular-nums">
                      {formaterMontant(r.detailPrix.fraisLivraison, langue)}
                    </dd>
                  </>
                )}
              </>
            )}
            <dt className="font-semibold">{t("commun.total")}</dt>
            <dd className="text-end font-semibold tabular-nums">
              {formaterMontant(r.prixTotal, langue)}
            </dd>
            <dt>{t("pdf.caution")}</dt>
            <dd className="text-end tabular-nums">{formaterMontant(r.caution, langue)}</dd>
          </dl>
        </Carte>
      </div>

      <Carte titre={t("loueur.reservations.etapes")}>
        <div className="flex flex-wrap gap-2">
          {r.statut === "en_attente_agence" && peut("reservations.accepter") && (
            <>
              <Bouton chargement={action.enCours} onClick={() => faire("accepter")}>
                {t("loueur.reservations.accepter")}
              </Bouton>
              <Bouton variante="secondaire" onClick={() => setFenetre("refuser")}>
                {t("loueur.reservations.refuser")}
              </Bouton>
            </>
          )}
          {r.statut === "confirmee" && (
            <>
              {peut("etats_des_lieux") && (
                <Bouton
                  variante={edlDepart ? "secondaire" : "principal"}
                  icone={edlDepart ? CheckCircle2 : ClipboardCheck}
                  onClick={() => setFenetre("edl")}
                >
                  {t("loueur.reservations.edlDepart")}
                </Bouton>
              )}
              {peut("etats_des_lieux") && (
                <Bouton
                  variante={contrat ? "secondaire" : "principal"}
                  icone={contrat ? CheckCircle2 : PenLine}
                  disabled={!edlDepart}
                  onClick={() => setFenetre("contrat")}
                >
                  {t("loueur.reservations.signerContrat")}
                </Bouton>
              )}
              {peut("reservations.depart_retour") && (
                <Bouton
                  disabled={!edlDepart}
                  chargement={action.enCours}
                  onClick={() => faire("depart")}
                >
                  {t("loueur.reservations.depart")}
                </Bouton>
              )}
              {peut("reservations.depart_retour") && new Date(r.debut) < new Date() && (
                <Bouton variante="secondaire" onClick={() => faire("non-presentation")}>
                  {t("loueur.reservations.nonPresentation")}
                </Bouton>
              )}
            </>
          )}
          {r.statut === "en_cours" && (
            <>
              {peut("etats_des_lieux") && (
                <Bouton
                  variante={edlRetour ? "secondaire" : "principal"}
                  icone={edlRetour ? CheckCircle2 : ClipboardCheck}
                  onClick={() => setFenetre("edl")}
                >
                  {t("loueur.reservations.edlRetour")}
                </Bouton>
              )}
              {peut("reservations.depart_retour") && (
                <Bouton disabled={!edlRetour} onClick={() => setFenetre("retour")}>
                  {t("loueur.reservations.retour")}
                </Bouton>
              )}
            </>
          )}
          {["confirmee", "en_cours"].includes(r.statut) && peut("reservations.creer") && (
            <>
              <Bouton
                variante="secondaire"
                onClick={() => {
                  setNouvelleFin(versChampLocal(r.fin));
                  setFenetre("prolonger");
                }}
              >
                {t("loueur.reservations.prolonger")}
              </Bouton>
              <Bouton variante="secondaire" onClick={() => setFenetre("reaffecter")}>
                {t("loueur.reservations.changerVehicule")}
              </Bouton>
            </>
          )}
          {r.statut === "confirmee" && peut("gerant") && (
            <Bouton variante="danger" onClick={() => setFenetre("annuler")}>
              {t("loueur.reservations.annuler")}
            </Bouton>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {contrat && (
            <span className="text-emerald-800">
              {t("loueur.reservations.contratSigne", { numero: contrat.numero })}
            </span>
          )}
          {r.origine !== "blocage" && (
            <button
              type="button"
              className="text-marque-700 underline"
              onClick={() => void api.ouvrirFichier(`/contrats/${id}/pdf`)}
            >
              {t("loueur.reservations.contrat")} — {t("loueur.reservations.voirPdf")}
            </button>
          )}
          {["confirmee", "en_cours", "terminee", "litige"].includes(r.statut) &&
            r.origine !== "blocage" && (
              <button
                type="button"
                className="text-marque-700 underline"
                onClick={() => void api.ouvrirFichier(`/agence/reservations/${id}/facture/pdf`)}
              >
                {t("factures.telecharger")}
              </button>
            )}
          {edlDepart && (
            <button
              type="button"
              className="text-marque-700 underline"
              onClick={() =>
                void api.ouvrirFichier(`/reservations/${id}/etat-des-lieux/depart/pdf`)
              }
            >
              {t("loueur.reservations.edlDepart")} (PDF)
            </button>
          )}
          {edlRetour && (
            <button
              type="button"
              className="text-marque-700 underline"
              onClick={() =>
                void api.ouvrirFichier(`/reservations/${id}/etat-des-lieux/retour/pdf`)
              }
            >
              {t("loueur.reservations.edlRetour")} (PDF)
            </button>
          )}
        </div>
        {r.motifRefus && <p className="mt-2 text-sm text-attenue">{r.motifRefus}</p>}
      </Carte>

      {r.livraison && (
        <Message ton="info">
          {t("livraison.livreA", { adresse: r.livraison.adresse, commune: r.livraison.commune })}
          {r.livraison.instructions && <> — {r.livraison.instructions}</>}
          {r.livraison.recuperation && <> · {t("livraison.recupere")}</>}
        </Message>
      )}
      {r.clientId && (
        <Carte titre={t("messagerie.titre")} icone={MessagesSquare} ton="ciel">
          <FilMessages
            chemin={`/agence/reservations/${id}/messages`}
            reservationId={id}
            moi="agence"
            urlApi={URL_API}
          />
        </Carte>
      )}
      {r.fraisRetour && (
        <Carte titre={t("loueur.reservations.fraisRetour")}>
          <dl className="grid grid-cols-2 gap-1 text-sm sm:max-w-md">
            <dt>
              {t("pdf.kmSupplementaires")} ({r.fraisRetour.kmSupplementaires} km)
            </dt>
            <dd className="text-end">{formaterMontant(r.fraisRetour.montantKm, langue)}</dd>
            <dt>
              {t("pdf.carburantManquant")} ({r.fraisRetour.huitiemesManquants}/8)
            </dt>
            <dd className="text-end">{formaterMontant(r.fraisRetour.montantCarburant, langue)}</dd>
            <dt>
              {t("pdf.retard")} ({t("commun.jours", { n: r.fraisRetour.joursRetard })})
            </dt>
            <dd className="text-end">{formaterMontant(r.fraisRetour.montantRetard, langue)}</dd>
            <dt>{t("pdf.dommages")}</dt>
            <dd className="text-end">{formaterMontant(r.fraisRetour.montantDommages, langue)}</dd>
            <dt className="font-semibold">{t("commun.total")}</dt>
            <dd className="text-end font-semibold">
              {formaterMontant(r.fraisRetour.total, langue)}
            </dd>
          </dl>
        </Carte>
      )}

      {r.origine !== "blocage" && (
        <Carte
          titre={`${t("loueur.reservations.paiements")} — ${formaterMontant(encaisse, langue)} / ${formaterMontant(r.prixTotal, langue)}`}
          actions={
            peut("encaissements") && (
              <Bouton
                taille="petite"
                variante="secondaire"
                onClick={() => {
                  setPaiement({
                    type: "solde",
                    moyen: "especes",
                    montant: String(Math.max(0, r.prixTotal - encaisse)),
                  });
                  setFenetre("encaisser");
                }}
              >
                {t("loueur.reservations.encaisser")}
              </Bouton>
            )
          }
        >
          {r.paiements.length === 0 ? (
            <p className="text-sm text-attenue">{t("ui.aucun")}</p>
          ) : (
            <ul className="divide-y divide-trait text-sm">
              {r.paiements.map((p) => (
                <li key={p.id} className="flex justify-between py-1.5">
                  <span>
                    {t(`typesPaiement.${p.type}`)} · {t(`moyensPaiement.${p.moyen}`)} ·{" "}
                    {formaterDate(p.createdAt, langue)}
                  </span>
                  <span className="tabular-nums">{formaterMontant(p.montant, langue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      )}

      <Modale
        ouverte={fenetre === "refuser" || fenetre === "annuler"}
        titre={t(
          fenetre === "refuser" ? "loueur.reservations.refuser" : "loueur.reservations.annuler",
        )}
        onFermer={fermer}
      >
        <div className="flex flex-col gap-3">
          {fenetre === "annuler" && (
            <Message ton="alerte">{t("loueur.reservations.avertissementAnnulation")}</Message>
          )}
          <Champ
            libelle={t(
              fenetre === "refuser"
                ? "loueur.reservations.motifRefus"
                : "loueur.reservations.motifAnnulation",
            )}
          >
            <Zone value={texte} onChange={(e) => setTexte(e.target.value)} required />
          </Champ>
          {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
          <Bouton
            variante="danger"
            chargement={action.enCours}
            disabled={texte.trim().length < 3}
            onClick={() => faire(fenetre === "refuser" ? "refuser" : "annuler", { motif: texte })}
          >
            {t("commun.confirmer")}
          </Bouton>
        </div>
      </Modale>

      <Modale
        ouverte={fenetre === "edl"}
        titre={t(
          r.statut === "en_cours"
            ? "loueur.reservations.edlRetour"
            : "loueur.reservations.edlDepart",
        )}
        onFermer={fermer}
      >
        <FormulaireEtatDesLieux
          reservationId={id}
          moment={r.statut === "en_cours" ? "retour" : "depart"}
          depart={r.statut === "en_cours" ? edlDepart : undefined}
          kilometrageInitial={vehicules?.find((v) => v.id === r.vehiculeId)?.kilometrage ?? 0}
          onTermine={() => {
            fermer();
            void recharger();
          }}
        />
      </Modale>

      <Modale
        ouverte={fenetre === "contrat"}
        titre={t("loueur.reservations.signerContrat")}
        onFermer={fermer}
      >
        <div className="flex flex-col gap-4">
          <button
            type="button"
            className="self-start text-sm text-marque-700 underline"
            onClick={() => void api.ouvrirFichier(`/contrats/${id}/pdf`)}
          >
            {t("loueur.reservations.voirPdf")}
          </button>
          <div>
            <p className="mb-1 text-sm font-medium">{t("pdf.signatureLocataire")}</p>
            <PadSignature onChange={(s) => setSignatures((x) => ({ ...x, client: s }))} />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">{t("loueur.reservations.signatureAgence")}</p>
            <PadSignature
              hauteur={120}
              onChange={(s) => setSignatures((x) => ({ ...x, agence: s }))}
            />
          </div>
          {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
          <Bouton
            chargement={action.enCours}
            disabled={!signatures.client}
            onClick={() =>
              faire("contrat/signer", {
                signatureClient: signatures.client,
                signatureAgence: signatures.agence ?? undefined,
              })
            }
          >
            {t("loueur.reservations.signerContrat")}
          </Bouton>
        </div>
      </Modale>

      <Modale
        ouverte={fenetre === "retour"}
        titre={t("loueur.reservations.retour")}
        onFermer={fermer}
      >
        <div className="flex flex-col gap-3">
          <Champ libelle={t("loueur.reservations.fraisDommages")}>
            <Saisie
              type="number"
              min={0}
              step={100}
              dir="ltr"
              value={fraisDommages}
              onChange={(e) => setFraisDommages(e.target.value)}
            />
          </Champ>
          <Case
            libelle={t("loueur.reservations.restituerCaution")}
            checked={restituer}
            onChange={(e) => setRestituer(e.target.checked)}
          />
          {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
          <Bouton
            chargement={action.enCours}
            onClick={() =>
              faire("retour", {
                fraisDommages: Number(fraisDommages) || 0,
                restitutionCaution: restituer,
              })
            }
          >
            {t("commun.confirmer")}
          </Bouton>
        </div>
      </Modale>

      <Modale
        ouverte={fenetre === "prolonger"}
        titre={t("loueur.reservations.prolonger")}
        onFermer={fermer}
      >
        <div className="flex flex-col gap-3">
          <Champ libelle={t("loueur.reservations.nouvelleFin")}>
            <Saisie
              type="datetime-local"
              value={nouvelleFin}
              onChange={(e) => setNouvelleFin(e.target.value)}
            />
          </Champ>
          {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
          <Bouton
            chargement={action.enCours}
            onClick={() => faire("prolonger", { fin: depuisChampLocal(nouvelleFin) })}
          >
            {t("commun.confirmer")}
          </Bouton>
        </div>
      </Modale>

      <Modale
        ouverte={fenetre === "reaffecter"}
        titre={t("loueur.reservations.changerVehicule")}
        onFermer={fermer}
      >
        <div className="flex flex-col gap-3">
          <Liste value={nouveauVehicule} onChange={(e) => setNouveauVehicule(e.target.value)}>
            <option value="">{t("ui.choisir")}</option>
            {vehicules
              ?.filter((v) => v.id !== r.vehiculeId && v.categorie === r.vehicule.categorie)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.marque} {v.modele} — {v.immatriculation}
                </option>
              ))}
          </Liste>
          {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
          <Bouton
            chargement={action.enCours}
            disabled={!nouveauVehicule}
            onClick={() => faire("reaffecter", { vehiculeId: nouveauVehicule })}
          >
            {t("commun.confirmer")}
          </Bouton>
        </div>
      </Modale>

      <Modale
        ouverte={fenetre === "encaisser"}
        titre={t("loueur.reservations.encaisser")}
        onFermer={fermer}
      >
        <div className="flex flex-col gap-3">
          <Liste
            value={paiement.type}
            onChange={(e) => setPaiement({ ...paiement, type: e.target.value })}
          >
            {TYPES_PAIEMENT.map((x) => (
              <option key={x} value={x}>
                {t(`typesPaiement.${x}`)}
              </option>
            ))}
          </Liste>
          <Liste
            value={paiement.moyen}
            onChange={(e) => setPaiement({ ...paiement, moyen: e.target.value })}
          >
            {MOYENS_PAIEMENT.map((x) => (
              <option key={x} value={x}>
                {t(`moyensPaiement.${x}`)}
              </option>
            ))}
          </Liste>
          <Saisie
            type="number"
            min={1}
            dir="ltr"
            value={paiement.montant}
            onChange={(e) => setPaiement({ ...paiement, montant: e.target.value })}
          />
          {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
          <Bouton
            chargement={action.enCours}
            disabled={!Number(paiement.montant)}
            onClick={() => faire("paiements", { ...paiement, montant: Number(paiement.montant) })}
          >
            {t("commun.enregistrer")}
          </Bouton>
        </div>
      </Modale>
    </div>
  );
}
