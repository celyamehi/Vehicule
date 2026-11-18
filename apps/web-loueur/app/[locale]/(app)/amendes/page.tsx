"use client";

import type { Langue } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Champ,
  Chargement,
  Liste,
  Message,
  Modale,
  Pastille,
  PuceIcone,
  Saisie,
  Vide,
  depuisChampLocal,
  formaterDate,
  formaterMontant,
  useSession,
  versChampLocal,
} from "@lvb/ui";
import { Plus, ReceiptText, ShieldAlert, UserRoundCheck, UserRoundX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { EnTete, usePeut } from "@/components/coquille";
import { Link } from "@/i18n/navigation";
import { useAction, useDonnees } from "@/lib/donnees";
import type { Vehicule } from "@/lib/types";

type Amende = {
  id: string;
  vehicule: string;
  immatriculation: string;
  dateInfraction: string;
  montant: number;
  motif: string;
  lieu: string | null;
  reference: string | null;
  statut: "a_traiter" | "refacturee" | "payee" | "contestee";
  client: string | null;
  telephone: string | null;
  code: string | null;
  reservationId: string | null;
};
type Responsable = {
  reservationId: string;
  nom: string | null;
  prenom: string | null;
  telephone: string;
} | null;

const STATUTS = ["a_traiter", "refacturee", "payee", "contestee"] as const;
const TON_STATUT = {
  a_traiter: "en_attente",
  refacturee: "confirmee",
  payee: "ok",
  contestee: "masque",
} as const;

/** Amendes et contraventions : le logiciel retrouve la location en cours à la date de l'infraction. */
export default function PageAmendes() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const peut = usePeut();
  const { api } = useSession();
  const action = useAction();
  const { donnees, erreur, recharger } = useDonnees<Amende[]>("/agence/amendes");
  const { donnees: vehicules } = useDonnees<Vehicule[]>("/agence/vehicules");
  const [f, setF] = useState<{
    vehiculeId: string;
    date: string;
    montant: string;
    motif: string;
    lieu: string;
    reference: string;
  } | null>(null);
  const [responsable, setResponsable] = useState<Responsable | undefined>(undefined);

  // Aperçu du conducteur responsable dès que le véhicule et la date sont choisis.
  useEffect(() => {
    setResponsable(undefined);
    if (!f?.vehiculeId || !f.date) return;
    const id = setTimeout(
      () =>
        void api
          .get<Responsable>("/agence/amendes/responsable", {
            vehiculeId: f.vehiculeId,
            dateInfraction: depuisChampLocal(f.date),
          })
          .then((r) => setResponsable(r && "reservationId" in r ? r : null))
          .catch(() => setResponsable(null)),
      300,
    );
    return () => clearTimeout(id);
  }, [api, f?.vehiculeId, f?.date]);

  return (
    <div className="flex flex-col gap-6">
      <EnTete
        titre={t("amendes.titre")}
        sousTitre={t("amendes.sousTitre")}
        actions={
          peut("encaissements") && (
            <Bouton
              icone={Plus}
              disabled={!vehicules?.length}
              onClick={() =>
                setF({
                  vehiculeId: vehicules?.[0]?.id ?? "",
                  date: versChampLocal(new Date()),
                  montant: "",
                  motif: "",
                  lieu: "",
                  reference: "",
                })
              }
            >
              {t("amendes.ajouter")}
            </Bouton>
          )
        }
      />
      {(erreur || (action.erreur && !f)) && (
        <Message ton="erreur">{erreur ?? action.erreur}</Message>
      )}
      <Carte>
        {!donnees ? (
          <Chargement />
        ) : donnees.length === 0 ? (
          <Vide icone={ReceiptText}>{t("amendes.aucune")}</Vide>
        ) : (
          <ul className="divide-y divide-trait">
            {donnees.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
                <PuceIcone icone={ShieldAlert} ton="rose" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {m.motif} ·{" "}
                    <span className="tabular-nums">{formaterMontant(m.montant, langue)}</span>
                  </div>
                  <div className="text-sm text-attenue">
                    {formaterDate(m.dateInfraction, langue)} · {m.vehicule}{" "}
                    <span className="ltr">{m.immatriculation}</span>
                    {m.lieu && <> · {m.lieu}</>}
                  </div>
                  <div className="mt-0.5 text-sm">
                    {m.reservationId ? (
                      <Link
                        href={`/reservations/${m.reservationId}`}
                        className="inline-flex items-center gap-1 font-medium text-marque-700"
                      >
                        <UserRoundCheck className="size-4" />
                        {m.client ?? <span className="ltr">{m.telephone}</span>} ·{" "}
                        {t("amendes.reservation", { code: m.code ?? "" })}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-attenue">
                        <UserRoundX className="size-4" />
                        {t("amendes.aucunResponsable")}
                      </span>
                    )}
                  </div>
                </div>
                {peut("encaissements") ? (
                  <Liste
                    className="w-auto"
                    aria-label={t("commun.statut")}
                    value={m.statut}
                    onChange={(e) =>
                      void action.executer(async () => {
                        await api.patch(`/agence/amendes/${m.id}`, { statut: e.target.value });
                        await recharger();
                      })
                    }
                  >
                    {STATUTS.map((s) => (
                      <option key={s} value={s}>
                        {t(`amendes.statuts.${s}`)}
                      </option>
                    ))}
                  </Liste>
                ) : (
                  <Pastille statut={TON_STATUT[m.statut]}>
                    {t(`amendes.statuts.${m.statut}`)}
                  </Pastille>
                )}
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Modale ouverte={!!f} titre={t("amendes.ajouter")} onFermer={() => setF(null)}>
        {f && (
          <div className="flex flex-col gap-3">
            <Champ libelle={t("loueur.reservations.vehicule")}>
              <Liste
                value={f.vehiculeId}
                onChange={(e) => setF({ ...f, vehiculeId: e.target.value })}
              >
                {vehicules?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marque} {v.modele} — {v.immatriculation}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ libelle={t("amendes.date")}>
              <Saisie
                type="datetime-local"
                value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value })}
              />
            </Champ>
            {responsable !== undefined && (
              <Message ton={responsable ? "succes" : "info"}>
                {responsable ? (
                  <>
                    {t("amendes.responsable")} :{" "}
                    <strong>
                      {[responsable.prenom, responsable.nom].filter(Boolean).join(" ")}
                    </strong>{" "}
                    <span className="ltr">{responsable.telephone}</span>
                  </>
                ) : (
                  t("amendes.aucunResponsable")
                )}
              </Message>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Champ libelle={t("amendes.montant")}>
                <Saisie
                  type="number"
                  min={0}
                  step={100}
                  dir="ltr"
                  value={f.montant}
                  onChange={(e) => setF({ ...f, montant: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("amendes.reference")}>
                <Saisie
                  dir="ltr"
                  value={f.reference}
                  onChange={(e) => setF({ ...f, reference: e.target.value })}
                />
              </Champ>
            </div>
            <Champ libelle={t("amendes.motif")}>
              <Saisie value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} />
            </Champ>
            <Champ libelle={t("amendes.lieu")}>
              <Saisie value={f.lieu} onChange={(e) => setF({ ...f, lieu: e.target.value })} />
            </Champ>
            {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
            <Bouton
              chargement={action.enCours}
              disabled={!f.vehiculeId || !f.date || f.motif.trim().length < 2 || !f.montant}
              onClick={() =>
                void action.executer(async () => {
                  await api.post("/agence/amendes", {
                    vehiculeId: f.vehiculeId,
                    dateInfraction: depuisChampLocal(f.date),
                    montant: Number(f.montant),
                    motif: f.motif,
                    lieu: f.lieu || null,
                    reference: f.reference || null,
                  });
                  setF(null);
                  await recharger();
                })
              }
            >
              {t("commun.enregistrer")}
            </Bouton>
          </div>
        )}
      </Modale>
    </div>
  );
}
