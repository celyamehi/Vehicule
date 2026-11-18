"use client";

import { TYPES_ENTRETIEN, dateAlger, type Langue, type TypeEntretien } from "@lvb/shared";
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
  Zone,
  cx,
  formaterDate,
  formaterMontant,
  useSession,
} from "@lvb/ui";
import { BadgeCheck, CalendarClock, Gauge, History, Plus, Trash2, Wrench } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { EnTete, usePeut } from "@/components/coquille";
import { TexteEcheance, VISUELS } from "@/components/entretien";
import { useAction, useDonnees } from "@/lib/donnees";
import type { Vehicule } from "@/lib/types";

type Rappel = {
  vehiculeId: string;
  type: TypeEntretien;
  vehicule: string;
  immatriculation: string;
  derniereFois: string;
  echeanceDate: string | null;
  echeanceKm: number | null;
  niveau: "en_retard" | "bientot" | "ok";
  joursRestants: number | null;
  kmRestants: number | null;
};
type Entretien = {
  id: string;
  vehiculeId: string;
  vehicule: string;
  immatriculation: string;
  type: TypeEntretien;
  date: string;
  kilometrage: number | null;
  cout: number;
  prochaineEcheanceDate: string | null;
  prochaineEcheanceKm: number | null;
  prestataire: string | null;
  notes: string | null;
};
type Formulaire = {
  id?: string;
  vehiculeId: string;
  type: TypeEntretien;
  date: string;
  kilometrage: string;
  cout: string;
  prochaineEcheanceDate: string;
  prochaineEcheanceKm: string;
  prestataire: string;
  notes: string;
};

export default function PageEntretien() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const peut = usePeut();
  const { api } = useSession();
  const action = useAction();
  const {
    donnees: rappels,
    erreur,
    recharger: rechargerRappels,
  } = useDonnees<Rappel[]>("/agence/entretiens/rappels");
  const { donnees: historique, recharger: rechargerHistorique } =
    useDonnees<Entretien[]>("/agence/entretiens");
  const { donnees: vehicules } = useDonnees<Vehicule[]>("/agence/vehicules");
  const [f, setF] = useState<Formulaire | null>(null);
  const [filtre, setFiltre] = useState<"tous" | "urgents">("urgents");

  const nouveau = (vehiculeId?: string, type: TypeEntretien = "vidange"): Formulaire => {
    const v = vehicules?.find((x) => x.id === (vehiculeId ?? vehicules[0]?.id));
    return {
      vehiculeId: v?.id ?? "",
      type,
      date: dateAlger(new Date()),
      kilometrage: v ? String(v.kilometrage) : "",
      cout: "",
      prochaineEcheanceDate: "",
      prochaineEcheanceKm: "",
      prestataire: "",
      notes: "",
    };
  };

  const enregistrer = () =>
    f &&
    void action.executer(async () => {
      const corps = {
        vehiculeId: f.vehiculeId,
        type: f.type,
        date: f.date,
        kilometrage: f.kilometrage ? Number(f.kilometrage) : null,
        cout: Number(f.cout) || 0,
        // Vide en création = échéance proposée automatiquement par l'API.
        prochaineEcheanceDate: f.prochaineEcheanceDate || (f.id ? null : undefined),
        prochaineEcheanceKm: f.prochaineEcheanceKm
          ? Number(f.prochaineEcheanceKm)
          : f.id
            ? null
            : undefined,
        prestataire: f.prestataire || null,
        notes: f.notes || null,
      };
      if (f.id) await api.patch(`/agence/entretiens/${f.id}`, corps);
      else await api.post("/agence/entretiens", corps);
      setF(null);
      await Promise.all([rechargerRappels(), rechargerHistorique()]);
    });

  const affiches = (rappels ?? []).filter((r) => filtre === "tous" || r.niveau !== "ok");
  const enRetard = rappels?.filter((r) => r.niveau === "en_retard").length ?? 0;
  const bientot = rappels?.filter((r) => r.niveau === "bientot").length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <EnTete
        titre={t("loueur.entretien.titre")}
        sousTitre={t("loueur.entretien.sousTitre")}
        actions={
          peut("flotte.modifier") && (
            <Bouton icone={Plus} disabled={!vehicules?.length} onClick={() => setF(nouveau())}>
              {t("loueur.entretien.ajouter")}
            </Bouton>
          )
        }
      />
      {erreur && <Message ton="erreur">{erreur}</Message>}

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["en_retard", enRetard, "rose", CalendarClock],
            ["bientot", bientot, "peche", Gauge],
            ["ok", (rappels?.length ?? 0) - enRetard - bientot, "menthe", BadgeCheck],
          ] as const
        ).map(([niveau, n, ton, Icone]) => (
          <div
            key={niveau}
            className="flex items-center gap-4 rounded-[var(--radius-carte)] bg-surface p-5 shadow-[var(--shadow-douce)]"
          >
            <PuceIcone icone={Icone} ton={ton} taille="grande" />
            <div>
              <div className="text-[28px] font-semibold leading-none tabular-nums">
                {rappels ? n : "–"}
              </div>
              <div className="mt-1 text-sm text-attenue">
                {t(`loueur.entretien.${niveau === "en_retard" ? "enRetard" : niveau}`)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Carte
        titre={t("loueur.entretien.rappels")}
        icone={CalendarClock}
        ton="peche"
        actions={
          <div className="flex rounded-full bg-champ p-1 text-sm">
            {(["urgents", "tous"] as const).map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setFiltre(x)}
                className={cx(
                  "rounded-full px-3 py-1 font-medium transition",
                  filtre === x ? "bg-surface shadow-sm" : "text-attenue",
                )}
              >
                {x === "tous"
                  ? t("ui.tous")
                  : `${t("loueur.entretien.enRetard")} / ${t("loueur.entretien.bientot")}`}
              </button>
            ))}
          </div>
        }
      >
        {!rappels ? (
          <Chargement />
        ) : affiches.length === 0 ? (
          <Vide icone={BadgeCheck}>{t("loueur.entretien.aucunRappel")}</Vide>
        ) : (
          <ul className="flex flex-col gap-2">
            {affiches.map((r) => {
              const { icone, ton } = VISUELS[r.type];
              return (
                <li
                  key={`${r.vehiculeId}-${r.type}`}
                  className="flex flex-wrap items-center gap-3 rounded-2xl bg-fond/70 p-3 sm:flex-nowrap"
                >
                  <PuceIcone icone={icone} ton={ton} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {t(`loueur.entretien.types.${r.type}`)} · {r.vehicule}{" "}
                      <span className="ltr text-sm font-normal text-attenue">
                        {r.immatriculation}
                      </span>
                    </div>
                    <div className="text-sm text-attenue">
                      <TexteEcheance r={r} /> ·{" "}
                      {t("loueur.entretien.derniereFois", {
                        date: formaterDate(r.derniereFois, langue, false),
                      })}
                    </div>
                  </div>
                  <Pastille statut={r.niveau === "en_retard" ? "en_retard" : r.niveau}>
                    {t(`loueur.entretien.${r.niveau === "en_retard" ? "enRetard" : r.niveau}`)}
                  </Pastille>
                  {peut("flotte.modifier") && (
                    <Bouton
                      taille="petite"
                      variante="secondaire"
                      icone={Plus}
                      onClick={() => setF(nouveau(r.vehiculeId, r.type))}
                    >
                      {t("commun.ajouter")}
                    </Bouton>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Carte>

      <Carte titre={t("loueur.entretien.historique")} icone={History} ton="lavande">
        {!historique ? (
          <Chargement />
        ) : historique.length === 0 ? (
          <Vide icone={Wrench}>{t("loueur.entretien.aucunHistorique")}</Vide>
        ) : (
          <ul className="divide-y divide-trait">
            {historique.map((e) => {
              const { icone, ton } = VISUELS[e.type];
              return (
                <li key={e.id} className="flex items-center gap-3 py-3">
                  <PuceIcone icone={icone} ton={ton} taille="petite" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-start"
                    disabled={!peut("flotte.modifier")}
                    onClick={() =>
                      setF({
                        id: e.id,
                        vehiculeId: e.vehiculeId,
                        type: e.type,
                        date: e.date,
                        kilometrage: e.kilometrage?.toString() ?? "",
                        cout: String(e.cout),
                        prochaineEcheanceDate: e.prochaineEcheanceDate ?? "",
                        prochaineEcheanceKm: e.prochaineEcheanceKm?.toString() ?? "",
                        prestataire: e.prestataire ?? "",
                        notes: e.notes ?? "",
                      })
                    }
                  >
                    <div className="truncate text-sm font-medium">
                      {t(`loueur.entretien.types.${e.type}`)} · {e.vehicule}{" "}
                      <span className="ltr font-normal text-attenue">{e.immatriculation}</span>
                    </div>
                    <div className="truncate text-xs text-attenue">
                      {formaterDate(e.date, langue, false)}
                      {e.kilometrage !== null && (
                        <>
                          {" "}
                          · <span className="ltr">{e.kilometrage.toLocaleString("fr-FR")} km</span>
                        </>
                      )}
                      {e.prestataire && <> · {e.prestataire}</>}
                    </div>
                  </button>
                  <span className="text-sm font-medium tabular-nums">
                    {formaterMontant(e.cout, langue)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Carte>

      <Modale
        ouverte={!!f}
        titre={t(f?.id ? "commun.modifier" : "loueur.entretien.ajouter")}
        onFermer={() => setF(null)}
      >
        {f && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {TYPES_ENTRETIEN.map((ty) => {
                const { icone: Icone } = VISUELS[ty];
                return (
                  <button
                    key={ty}
                    type="button"
                    onClick={() => setF({ ...f, type: ty })}
                    className={cx(
                      "flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-xs font-medium transition",
                      f.type === ty
                        ? "bg-marque-600 text-white shadow-[0_6px_16px_-8px_rgb(76_93_228/0.9)]"
                        : "bg-champ text-encre hover:bg-[#ececf1]",
                    )}
                  >
                    <Icone className="size-5" strokeWidth={1.9} />
                    {t(`loueur.entretien.types.${ty}`)}
                  </button>
                );
              })}
            </div>
            <Champ libelle={t("loueur.reservations.vehicule")}>
              <Liste
                value={f.vehiculeId}
                onChange={(e) => {
                  const v = vehicules?.find((x) => x.id === e.target.value);
                  setF({
                    ...f,
                    vehiculeId: e.target.value,
                    kilometrage: v ? String(v.kilometrage) : f.kilometrage,
                  });
                }}
              >
                {vehicules?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marque} {v.modele} — {v.immatriculation}
                  </option>
                ))}
              </Liste>
            </Champ>
            <div className="grid grid-cols-2 gap-3">
              <Champ libelle={t("loueur.entretien.date")}>
                <Saisie
                  type="date"
                  value={f.date}
                  onChange={(e) => setF({ ...f, date: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("loueur.entretien.kilometrage")}>
                <Saisie
                  type="number"
                  min={0}
                  dir="ltr"
                  inputMode="numeric"
                  value={f.kilometrage}
                  onChange={(e) => setF({ ...f, kilometrage: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("loueur.entretien.cout")}>
                <Saisie
                  type="number"
                  min={0}
                  step={100}
                  dir="ltr"
                  inputMode="numeric"
                  value={f.cout}
                  onChange={(e) => setF({ ...f, cout: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("loueur.entretien.prestataire")}>
                <Saisie
                  value={f.prestataire}
                  onChange={(e) => setF({ ...f, prestataire: e.target.value })}
                />
              </Champ>
              <Champ
                libelle={t("loueur.entretien.prochaineDate")}
                aide={!f.id ? t("loueur.entretien.echeanceAuto") : undefined}
              >
                <Saisie
                  type="date"
                  min={f.date}
                  value={f.prochaineEcheanceDate}
                  onChange={(e) => setF({ ...f, prochaineEcheanceDate: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("loueur.entretien.prochaineKm")}>
                <Saisie
                  type="number"
                  min={0}
                  dir="ltr"
                  inputMode="numeric"
                  value={f.prochaineEcheanceKm}
                  onChange={(e) => setF({ ...f, prochaineEcheanceKm: e.target.value })}
                />
              </Champ>
            </div>
            <Champ libelle={t("loueur.entretien.notes")}>
              <Zone value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </Champ>
            {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
            <div className="flex gap-2">
              <Bouton
                className="flex-1"
                chargement={action.enCours}
                disabled={!f.vehiculeId || !f.date}
                onClick={enregistrer}
              >
                {t("commun.enregistrer")}
              </Bouton>
              {f.id && (
                <Bouton
                  variante="danger"
                  icone={Trash2}
                  aria-label={t("commun.supprimer")}
                  onClick={() =>
                    confirm(t("ui.confirmerAction")) &&
                    void action.executer(async () => {
                      await api.delete(`/agence/entretiens/${f.id}`);
                      setF(null);
                      await Promise.all([rechargerRappels(), rechargerHistorique()]);
                    })
                  }
                />
              )}
            </div>
          </div>
        )}
      </Modale>
    </div>
  );
}
