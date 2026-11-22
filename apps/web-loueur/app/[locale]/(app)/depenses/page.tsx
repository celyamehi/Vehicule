"use client";

import {
  CATEGORIES_DEPENSE,
  type CategorieDepense,
  type Langue,
  MOYENS_PAIEMENT,
  dateAlger,
} from "@lvb/shared";
import {
  Bouton,
  Carte,
  Champ,
  Chargement,
  Liste,
  Message,
  Modale,
  PuceIcone,
  Saisie,
  Vide,
  Zone,
  formaterDate,
  formaterMontant,
  useSession,
} from "@lvb/ui";
import { Banknote, Car, HandCoins, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { EnTete, usePeut } from "@/components/coquille";
import { ChoixPeriode, usePeriode } from "@/components/periode";
import { useAction, useDonnees } from "@/lib/donnees";
import type { Vehicule } from "@/lib/types";
import { type LigneDepense, VISUEL_CATEGORIE, visuelDepense } from "@/components/depenses";

type Formulaire = {
  id?: string;
  categorie: CategorieDepense;
  libelle: string;
  montant: string;
  date: string;
  vehiculeId: string;
  moyen: string;
  notes: string;
};

/** Dépenses de l'agence : saisies ici, plus les coûts d'entretien (lecture seule). */
export default function PageDepenses() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const peut = usePeut();
  const { api } = useSession();
  const action = useAction();
  const periode = usePeriode("mois");
  const { donnees, erreur, recharger } = useDonnees<LigneDepense[]>("/agence/depenses", {
    du: periode.du,
    au: periode.au,
  });
  const { donnees: vehicules } = useDonnees<Vehicule[]>("/agence/vehicules");
  const [f, setF] = useState<Formulaire | null>(null);
  const [aSupprimer, setASupprimer] = useState<LigneDepense | null>(null);

  const total = (donnees ?? []).reduce((s, d) => s + d.montant, 0);
  const parCategorie = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of donnees ?? []) {
      const cle = d.origine === "entretien" ? "entretien" : d.categorie;
      m.set(cle, (m.get(cle) ?? 0) + d.montant);
    }
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [donnees]);

  const nouveau = (): Formulaire => ({
    categorie: "carburant",
    libelle: "",
    montant: "",
    date: dateAlger(new Date()),
    vehiculeId: "",
    moyen: "especes",
    notes: "",
  });

  const enregistrer = (x: Formulaire) =>
    void action.executer(async () => {
      const corps = {
        categorie: x.categorie,
        libelle: x.libelle,
        montant: Number(x.montant),
        date: x.date,
        vehiculeId: x.vehiculeId || null,
        moyen: x.moyen || null,
        notes: x.notes || null,
      };
      if (x.id) await api.patch(`/agence/depenses/${x.id}`, corps);
      else await api.post("/agence/depenses", corps);
      setF(null);
      await recharger();
    });

  return (
    <div className="flex flex-col gap-6">
      <EnTete
        titre={t("finances.depenses.titre")}
        sousTitre={t("finances.depenses.sousTitre")}
        actions={
          peut("encaissements") && (
            <Bouton icone={Plus} onClick={() => setF(nouveau())}>
              {t("finances.depenses.ajouter")}
            </Bouton>
          )
        }
      />
      <ChoixPeriode valeur={periode.code} onChanger={periode.setCode} />
      {(erreur || (action.erreur && !f)) && (
        <Message ton="erreur">{erreur ?? action.erreur}</Message>
      )}

      {!donnees ? (
        <Chargement />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_20rem] xl:items-start">
          <Carte>
            {donnees.length === 0 ? (
              <Vide icone={HandCoins}>{t("finances.depenses.aucune")}</Vide>
            ) : (
              <ul className="-my-1 divide-y divide-trait">
                {donnees.map((d) => {
                  const [Icone, ton] = visuelDepense(d);
                  return (
                    <li key={`${d.origine}-${d.id}`} className="flex items-center gap-3 py-3">
                      <PuceIcone icone={Icone} ton={ton} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {d.origine === "entretien"
                            ? t(`loueur.entretien.types.${d.categorie}`)
                            : d.libelle}
                        </div>
                        <div className="truncate text-sm text-attenue">
                          {formaterDate(d.date, langue, false)} ·{" "}
                          {d.origine === "entretien"
                            ? t("finances.depenses.entretienAide")
                            : t(`finances.categories.${d.categorie}`)}
                          {d.vehicule && (
                            <>
                              {" "}
                              · <Car className="inline size-3.5 align-[-2px]" /> {d.vehicule}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-semibold tabular-nums text-rose-800">
                          −{formaterMontant(d.montant, langue)}
                        </span>
                        {d.moyen && (
                          <span className="text-xs text-attenue">
                            {t(`moyensPaiement.${d.moyen}`)}
                          </span>
                        )}
                      </div>
                      {d.origine === "depense" && peut("encaissements") && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            aria-label={t("finances.depenses.modifier")}
                            className="rounded-full p-2 text-attenue transition hover:bg-champ hover:text-encre"
                            onClick={() =>
                              setF({
                                id: d.id,
                                categorie: d.categorie as CategorieDepense,
                                libelle: d.libelle,
                                montant: String(d.montant),
                                date: d.date,
                                vehiculeId: d.vehiculeId ?? "",
                                moyen: d.moyen ?? "",
                                notes: d.notes ?? "",
                              })
                            }
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={t("finances.depenses.supprimer")}
                            className="rounded-full p-2 text-attenue transition hover:bg-rose-50 hover:text-rose-800"
                            onClick={() => setASupprimer(d)}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Carte>

          <Carte titre={t("finances.depenses.parCategorie")} icone={Banknote} ton="rose">
            <div className="mb-4">
              <div className="text-sm text-attenue">{t("finances.depenses.total")}</div>
              <div className="text-[28px] font-semibold tracking-tight tabular-nums">
                {formaterMontant(total, langue)}
              </div>
            </div>
            <ul className="flex flex-col gap-3">
              {parCategorie.map(([cat, montant]) => {
                const [Icone, ton] =
                  VISUEL_CATEGORIE[cat as CategorieDepense] ?? VISUEL_CATEGORIE.autre;
                const part = total > 0 ? Math.round((montant / total) * 100) : 0;
                return (
                  <li key={cat} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <PuceIcone icone={Icone} ton={ton} taille="petite" />
                      <span className="min-w-0 flex-1 truncate">
                        {t(`finances.categories.${cat}`)}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formaterMontant(montant, langue)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-champ">
                      <div
                        className="h-full rounded-full bg-rose-300"
                        style={{ inlineSize: `${part}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Carte>
        </div>
      )}

      <Modale
        ouverte={!!f}
        titre={f?.id ? t("finances.depenses.modifier") : t("finances.depenses.ajouter")}
        onFermer={() => setF(null)}
      >
        {f && (
          <div className="flex flex-col gap-3">
            <Champ libelle={t("finances.depenses.libelle")}>
              <Saisie
                autoFocus
                placeholder={t("finances.depenses.libelleExemple")}
                value={f.libelle}
                onChange={(e) => setF({ ...f, libelle: e.target.value })}
              />
            </Champ>
            <div className="grid grid-cols-2 gap-3">
              <Champ libelle={t("finances.depenses.montant")}>
                <Saisie
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={100}
                  dir="ltr"
                  value={f.montant}
                  onChange={(e) => setF({ ...f, montant: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("finances.depenses.date")}>
                <Saisie
                  type="date"
                  dir="ltr"
                  value={f.date}
                  onChange={(e) => setF({ ...f, date: e.target.value })}
                />
              </Champ>
            </div>
            <Champ libelle={t("finances.depenses.categorie")}>
              <Liste
                value={f.categorie}
                onChange={(e) => setF({ ...f, categorie: e.target.value as CategorieDepense })}
              >
                {CATEGORIES_DEPENSE.map((c) => (
                  <option key={c} value={c}>
                    {t(`finances.categories.${c}`)}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ libelle={t("finances.depenses.vehicule")}>
              <Liste
                value={f.vehiculeId}
                onChange={(e) => setF({ ...f, vehiculeId: e.target.value })}
              >
                <option value="">{t("finances.depenses.aucunVehicule")}</option>
                {vehicules?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marque} {v.modele} — {v.immatriculation}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ libelle={t("finances.depenses.moyen")}>
              <Liste value={f.moyen} onChange={(e) => setF({ ...f, moyen: e.target.value })}>
                <option value="">{t("finances.depenses.moyenAucun")}</option>
                {MOYENS_PAIEMENT.map((m) => (
                  <option key={m} value={m}>
                    {t(`moyensPaiement.${m}`)}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ libelle={t("finances.depenses.notes")}>
              <Zone
                rows={2}
                value={f.notes}
                onChange={(e) => setF({ ...f, notes: e.target.value })}
              />
            </Champ>
            {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
            <Bouton
              chargement={action.enCours}
              disabled={f.libelle.trim().length < 2 || !(Number(f.montant) > 0) || !f.date}
              onClick={() => enregistrer(f)}
            >
              {t("commun.enregistrer")}
            </Bouton>
          </div>
        )}
      </Modale>

      <Modale
        ouverte={!!aSupprimer}
        titre={t("finances.depenses.confirmerSuppression")}
        onFermer={() => setASupprimer(null)}
      >
        {aSupprimer && (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              {aSupprimer.libelle} · <strong>{formaterMontant(aSupprimer.montant, langue)}</strong>
            </p>
            <div className="flex gap-2">
              <Bouton variante="secondaire" className="flex-1" onClick={() => setASupprimer(null)}>
                {t("commun.annuler")}
              </Bouton>
              <Bouton
                variante="danger"
                className="flex-1"
                icone={Trash2}
                chargement={action.enCours}
                onClick={() =>
                  void action.executer(async () => {
                    await api.delete(`/agence/depenses/${aSupprimer.id}`);
                    setASupprimer(null);
                    await recharger();
                  })
                }
              >
                {t("finances.depenses.supprimer")}
              </Bouton>
            </div>
          </div>
        )}
      </Modale>
    </div>
  );
}
