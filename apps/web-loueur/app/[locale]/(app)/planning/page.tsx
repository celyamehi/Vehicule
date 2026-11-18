"use client";

import { MS_JOUR, dateAlger, depuisHeureAlger, type Langue } from "@lvb/shared";
import {
  Bouton,
  Champ,
  Chargement,
  Liste,
  Message,
  Modale,
  Saisie,
  cx,
  depuisChampLocal,
  formaterDate,
  useSession,
  useTempsReel,
  versChampLocal,
} from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { EnTete, usePeut } from "@/components/coquille";
import { useRouter } from "@/i18n/navigation";
import { URL_API } from "@/lib/config";
import { useAction, useDonnees } from "@/lib/donnees";
import type { Reservation } from "@/lib/types";

type Planning = {
  vehicules: {
    id: string;
    marque: string;
    modele: string;
    immatriculation: string;
    categorieId: string;
    statut: string;
  }[];
  reservations: (Reservation & { client: string | null })[];
};

const JOURS = 14;
const LARGEUR_JOUR = 72;

function couleur(r: Reservation) {
  if (r.origine === "blocage")
    return "bg-slate-400 text-white bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(255,255,255,.25)_6px,rgba(255,255,255,.25)_12px)]";
  if (r.statut === "en_attente_agence" || r.statut === "en_attente_paiement")
    return "bg-amber-400 text-amber-950";
  if (r.statut === "terminee") return "bg-slate-200 text-slate-700";
  if (r.origine === "plateforme") return "bg-marque-600 text-white";
  return "bg-emerald-600 text-white";
}

export default function PagePlanning() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const routeur = useRouter();
  const peut = usePeut();
  const { api, jetonAcces } = useSession();
  const [debutFenetre, setDebutFenetre] = useState(
    () => depuisHeureAlger(dateAlger(new Date())).getTime() - MS_JOUR,
  );
  const finFenetre = debutFenetre + JOURS * MS_JOUR;
  const params = useMemo(
    () => ({
      debut: new Date(debutFenetre).toISOString(),
      fin: new Date(finFenetre).toISOString(),
    }),
    [debutFenetre, finFenetre],
  );
  const { donnees, erreur, recharger } = useDonnees<Planning>("/agence/planning", params);
  const action = useAction();
  const [glisse, setGlisse] = useState<string | null>(null);
  const [blocage, setBlocage] = useState<{
    vehiculeId: string;
    debut: string;
    fin: string;
    motif: string;
  } | null>(null);
  const [blocageOuvert, setBlocageOuvert] = useState<
    (Reservation & { client: string | null }) | null
  >(null);
  const [info, setInfo] = useState<string | null>(null);

  useTempsReel(URL_API, jetonAcces, {
    "reservation.creee": () => void recharger(),
    "reservation.statut_change": () => void recharger(),
    "reservation.modifiee": () => void recharger(),
  });

  const jours = Array.from({ length: JOURS }, (_, i) => new Date(debutFenetre + i * MS_JOUR));
  const position = (r: Reservation) => {
    const debut = Math.max(new Date(r.debut).getTime(), debutFenetre);
    const fin = Math.min(new Date(r.fin).getTime(), finFenetre);
    return {
      debut: ((debut - debutFenetre) / (finFenetre - debutFenetre)) * 100,
      largeur: Math.max(1.2, ((fin - debut) / (finFenetre - debutFenetre)) * 100),
    };
  };

  const deposer = (vehiculeId: string) => {
    const r = donnees?.reservations.find((x) => x.id === glisse);
    setGlisse(null);
    if (!r || r.vehiculeId === vehiculeId) return;
    void action.executer(async () => {
      await api.post(`/agence/reservations/${r.id}/reaffecter`, { vehiculeId });
      setInfo(t("loueur.planning.reaffectee"));
      await recharger();
    });
  };

  const maintenant = ((Date.now() - debutFenetre) / (finFenetre - debutFenetre)) * 100;

  return (
    <div className="flex flex-col gap-3">
      <EnTete
        titre={t("loueur.planning.titre")}
        actions={
          <>
            <Bouton
              variante="secondaire"
              taille="petite"
              onClick={() => setDebutFenetre(debutFenetre - 7 * MS_JOUR)}
            >
              {t("loueur.planning.semainePrecedente")}
            </Bouton>
            <Bouton
              variante="secondaire"
              taille="petite"
              onClick={() =>
                setDebutFenetre(depuisHeureAlger(dateAlger(new Date())).getTime() - MS_JOUR)
              }
            >
              {t("loueur.planning.aujourdhui")}
            </Bouton>
            <Bouton
              variante="secondaire"
              taille="petite"
              onClick={() => setDebutFenetre(debutFenetre + 7 * MS_JOUR)}
            >
              {t("loueur.planning.semaineSuivante")}
            </Bouton>
            {peut("reservations.creer") && (
              <Bouton
                taille="petite"
                onClick={() =>
                  setBlocage({
                    vehiculeId: donnees?.vehicules[0]?.id ?? "",
                    debut: versChampLocal(new Date()),
                    fin: versChampLocal(new Date(Date.now() + MS_JOUR)),
                    motif: "",
                  })
                }
              >
                {t("loueur.planning.bloquer")}
              </Bouton>
            )}
          </>
        }
      />
      <p className="text-xs text-attenue">{t("loueur.planning.glisserAide")}</p>
      <div className="flex flex-wrap gap-3 text-xs" aria-label={t("loueur.planning.legende")}>
        {[
          ["bg-marque-600", t("origines.plateforme")],
          ["bg-emerald-600", `${t("origines.comptoir")} / ${t("origines.telephone")}`],
          ["bg-amber-400", t("statutsReservation.en_attente_agence")],
          ["bg-slate-400", t("origines.blocage")],
        ].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1">
            <span className={cx("inline-block size-3 rounded", c)} />
            {l}
          </span>
        ))}
      </div>
      {erreur && <Message ton="erreur">{erreur}</Message>}
      {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
      {info && <Message ton="succes">{info}</Message>}
      {!donnees ? (
        <Chargement />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-carte)] bg-surface shadow-[var(--shadow-douce)]">
          <div style={{ minWidth: 180 + JOURS * LARGEUR_JOUR }}>
            <div className="sticky top-0 z-10 flex border-b border-trait bg-surface text-xs">
              <div className="sticky start-0 w-44 shrink-0 bg-surface p-2" />
              <div className="flex flex-1">
                {jours.map((j) => (
                  <div
                    key={j.getTime()}
                    className={cx(
                      "flex-1 border-s border-trait p-1 text-center",
                      dateAlger(j) === dateAlger(new Date()) && "bg-marque-50 font-semibold",
                    )}
                  >
                    {formaterDate(j, langue, false).replace(/\s?\d{4}$/, "")}
                  </div>
                ))}
              </div>
            </div>
            {donnees.vehicules.map((v) => (
              <div
                key={v.id}
                className={cx("flex border-b border-trait", glisse && "hover:bg-marque-50")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => deposer(v.id)}
              >
                <div className="sticky start-0 z-[1] w-44 shrink-0 bg-surface p-2 text-xs">
                  <div className="truncate font-medium">
                    {v.marque} {v.modele}
                  </div>
                  <div className="ltr truncate text-attenue">{v.immatriculation}</div>
                </div>
                <div className="relative h-14 flex-1">
                  {jours.map((j, i) => (
                    <div
                      key={j.getTime()}
                      className="absolute inset-y-0 border-s border-trait/60"
                      style={{ insetInlineStart: `${(i / JOURS) * 100}%` }}
                    />
                  ))}
                  {maintenant >= 0 && maintenant <= 100 && (
                    <div
                      className="absolute inset-y-0 w-0.5 bg-danger-600"
                      style={{ insetInlineStart: `${maintenant}%` }}
                    />
                  )}
                  {donnees.reservations
                    .filter((r) => r.vehiculeId === v.id)
                    .map((r) => {
                      const p = position(r);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          draggable={
                            peut("reservations.creer") &&
                            !["terminee", "en_cours"].includes(r.statut)
                          }
                          onDragStart={() => setGlisse(r.id)}
                          onDragEnd={() => setGlisse(null)}
                          onClick={() =>
                            r.origine === "blocage"
                              ? setBlocageOuvert(r)
                              : routeur.push(`/reservations/${r.id}`)
                          }
                          title={`${r.code} — ${formaterDate(r.debut, langue)} – ${formaterDate(r.fin, langue)}`}
                          className={cx(
                            "absolute top-2 h-10 overflow-hidden rounded-md px-1.5 text-start text-[11px] leading-tight shadow-sm",
                            couleur(r),
                          )}
                          style={{ insetInlineStart: `${p.debut}%`, width: `${p.largeur}%` }}
                        >
                          <div className="truncate font-semibold">
                            {r.origine === "blocage" ? r.motifBlocage : (r.client ?? r.code)}
                          </div>
                          <div className="truncate opacity-80">
                            {r.origine === "blocage"
                              ? t("origines.blocage")
                              : t(`statutsReservation.${r.statut}`)}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modale
        ouverte={!!blocage}
        titre={t("loueur.planning.bloquer")}
        onFermer={() => setBlocage(null)}
      >
        {blocage && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void action.executer(async () => {
                await api.post("/agence/blocages", {
                  vehiculeId: blocage.vehiculeId,
                  debut: depuisChampLocal(blocage.debut),
                  fin: depuisChampLocal(blocage.fin),
                  motif: blocage.motif,
                });
                setBlocage(null);
                await recharger();
              });
            }}
          >
            <Champ libelle={t("loueur.reservations.vehicule")}>
              <Liste
                value={blocage.vehiculeId}
                onChange={(e) => setBlocage({ ...blocage, vehiculeId: e.target.value })}
              >
                {donnees?.vehicules.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marque} {v.modele} — {v.immatriculation}
                  </option>
                ))}
              </Liste>
            </Champ>
            <div className="grid grid-cols-2 gap-3">
              <Champ libelle={t("commun.du")}>
                <Saisie
                  type="datetime-local"
                  required
                  value={blocage.debut}
                  onChange={(e) => setBlocage({ ...blocage, debut: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("commun.au")}>
                <Saisie
                  type="datetime-local"
                  required
                  value={blocage.fin}
                  onChange={(e) => setBlocage({ ...blocage, fin: e.target.value })}
                />
              </Champ>
            </div>
            <Champ libelle={t("loueur.planning.motifBlocage")}>
              <Saisie
                required
                value={blocage.motif}
                onChange={(e) => setBlocage({ ...blocage, motif: e.target.value })}
              />
            </Champ>
            {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
            <Bouton type="submit" chargement={action.enCours}>
              {t("commun.enregistrer")}
            </Bouton>
          </form>
        )}
      </Modale>

      <Modale
        ouverte={!!blocageOuvert}
        titre={blocageOuvert?.motifBlocage ?? ""}
        onFermer={() => setBlocageOuvert(null)}
      >
        {blocageOuvert && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              {formaterDate(blocageOuvert.debut, langue)} →{" "}
              {formaterDate(blocageOuvert.fin, langue)}
            </p>
            <Bouton
              variante="danger"
              chargement={action.enCours}
              onClick={() =>
                void action.executer(async () => {
                  await api.delete(`/agence/blocages/${blocageOuvert.id}`);
                  setBlocageOuvert(null);
                  await recharger();
                })
              }
            >
              {t("loueur.planning.debloquer")}
            </Bouton>
          </div>
        )}
      </Modale>
    </div>
  );
}
