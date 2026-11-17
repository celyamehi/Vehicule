"use client";

import { CATEGORIES_VEHICULE, OPTIONS_RESERVABLES, type Langue } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Case,
  Champ,
  Chargement,
  Liste,
  Message,
  Modale,
  Saisie,
  formaterMontant,
  useSession,
} from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { EnTete, usePeut } from "@/components/coquille";
import { useAction, useDonnees } from "@/lib/donnees";
import type { Vehicule } from "@/lib/types";

type Supplements = Partial<Record<string, { parJour?: number; forfait?: number }>>;
type Tarif = {
  id: string;
  vehiculeId: string | null;
  categorie: string | null;
  libelle: string | null;
  prixJour: number;
  paliers: { aPartirDeJours: number; prixJour: number }[];
  supplements: Supplements;
  saisonDebut: string | null;
  saisonFin: string | null;
  caution: number;
  actif: boolean;
};

const nouveau = (): Omit<Tarif, "id"> => ({
  vehiculeId: null,
  categorie: "citadine",
  libelle: null,
  prixJour: 4000,
  paliers: [{ aPartirDeJours: 7, prixJour: 3600 }],
  supplements: { siegeBebe: { parJour: 500 }, livraison: { forfait: 2000 } },
  saisonDebut: null,
  saisonFin: null,
  caution: 30000,
  actif: true,
});

export default function Tarifs() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const peut = usePeut();
  const { api } = useSession();
  const action = useAction();
  const { donnees, erreur, recharger } = useDonnees<Tarif[]>("/agence/tarifs");
  const { donnees: vehicules } = useDonnees<Vehicule[]>("/agence/vehicules");
  const [edition, setEdition] = useState<(Omit<Tarif, "id"> & { id?: string }) | null>(null);

  const libelleCible = (x: Tarif) => {
    if (x.vehiculeId) {
      const v = vehicules?.find((y) => y.id === x.vehiculeId);
      return v ? `${v.marque} ${v.modele} — ${v.immatriculation}` : "…";
    }
    return t(`categories.${x.categorie}`);
  };

  const enregistrer = () =>
    edition &&
    void action.executer(async () => {
      const { id, ...corps } = edition;
      const charge = {
        ...corps,
        vehiculeId: corps.vehiculeId ?? undefined,
        categorie: corps.vehiculeId ? undefined : (corps.categorie ?? undefined),
        libelle: corps.libelle ?? undefined,
      };
      if (id) await api.patch(`/agence/tarifs/${id}`, charge);
      else await api.post("/agence/tarifs", charge);
      setEdition(null);
      await recharger();
    });

  return (
    <div className="flex flex-col gap-4">
      <EnTete
        titre={t("loueur.tarifs.titre")}
        actions={
          peut("tarifs.modifier") && (
            <Bouton onClick={() => setEdition(nouveau())}>{t("loueur.tarifs.ajouter")}</Bouton>
          )
        }
      />
      <Message ton="info">{t("loueur.tarifs.prixFige")}</Message>
      {erreur && <Message ton="erreur">{erreur}</Message>}
      {!donnees ? (
        <Chargement />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {donnees.map((x) => (
            <Carte
              key={x.id}
              titre={libelleCible(x)}
              actions={
                peut("tarifs.modifier") && (
                  <Bouton taille="petite" variante="secondaire" onClick={() => setEdition(x)}>
                    {t("commun.modifier")}
                  </Bouton>
                )
              }
              className={x.actif ? "" : "opacity-60"}
            >
              <div className="text-sm">
                <div className="text-lg font-semibold">
                  {formaterMontant(x.prixJour, langue)}{" "}
                  <span className="text-sm font-normal text-attenue">
                    {t("client.recherche.parJour")}
                  </span>
                </div>
                <div className="text-attenue">
                  {x.saisonDebut ? `${x.saisonDebut} → ${x.saisonFin}` : t("loueur.tarifs.base")}
                </div>
                {x.paliers.map((p) => (
                  <div key={p.aPartirDeJours}>
                    ≥ {t("commun.jours", { n: p.aPartirDeJours })} :{" "}
                    {formaterMontant(p.prixJour, langue)}
                  </div>
                ))}
                <div>
                  {t("pdf.caution")} : {formaterMontant(x.caution, langue)}
                </div>
              </div>
            </Carte>
          ))}
        </div>
      )}

      <Modale
        ouverte={!!edition}
        titre={t(edition?.id ? "commun.modifier" : "loueur.tarifs.ajouter")}
        onFermer={() => setEdition(null)}
      >
        {edition && (
          <div className="flex flex-col gap-3">
            <Champ libelle={t("loueur.tarifs.cible")}>
              <Liste
                value={edition.vehiculeId ? `v:${edition.vehiculeId}` : `c:${edition.categorie}`}
                onChange={(e) => {
                  const [type, val] = e.target.value.split(":") as [string, string];
                  setEdition({
                    ...edition,
                    vehiculeId: type === "v" ? val : null,
                    categorie: type === "c" ? val : null,
                  });
                }}
              >
                <optgroup label={t("loueur.flotte.categorie")}>
                  {CATEGORIES_VEHICULE.map((c) => (
                    <option key={c} value={`c:${c}`}>
                      {t(`categories.${c}`)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t("loueur.reservations.vehicule")}>
                  {vehicules?.map((v) => (
                    <option key={v.id} value={`v:${v.id}`}>
                      {v.marque} {v.modele} — {v.immatriculation}
                    </option>
                  ))}
                </optgroup>
              </Liste>
            </Champ>
            <div className="grid grid-cols-2 gap-3">
              <Champ libelle={t("loueur.tarifs.prixJour")}>
                <Saisie
                  type="number"
                  min={1}
                  dir="ltr"
                  value={edition.prixJour}
                  onChange={(e) => setEdition({ ...edition, prixJour: Number(e.target.value) })}
                />
              </Champ>
              <Champ libelle={t("loueur.tarifs.caution")}>
                <Saisie
                  type="number"
                  min={0}
                  dir="ltr"
                  value={edition.caution}
                  onChange={(e) => setEdition({ ...edition, caution: Number(e.target.value) })}
                />
              </Champ>
            </div>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">{t("loueur.tarifs.paliers")}</legend>
              {edition.paliers.map((p, i) => (
                <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <Champ libelle={t("loueur.tarifs.aPartirDe")}>
                    <Saisie
                      type="number"
                      min={2}
                      dir="ltr"
                      value={p.aPartirDeJours}
                      onChange={(e) =>
                        setEdition({
                          ...edition,
                          paliers: edition.paliers.map((x, j) =>
                            j === i ? { ...x, aPartirDeJours: Number(e.target.value) } : x,
                          ),
                        })
                      }
                    />
                  </Champ>
                  <Champ libelle={t("loueur.tarifs.prixJour")}>
                    <Saisie
                      type="number"
                      min={1}
                      dir="ltr"
                      value={p.prixJour}
                      onChange={(e) =>
                        setEdition({
                          ...edition,
                          paliers: edition.paliers.map((x, j) =>
                            j === i ? { ...x, prixJour: Number(e.target.value) } : x,
                          ),
                        })
                      }
                    />
                  </Champ>
                  <Bouton
                    variante="fantome"
                    aria-label={t("commun.supprimer")}
                    onClick={() =>
                      setEdition({ ...edition, paliers: edition.paliers.filter((_, j) => j !== i) })
                    }
                  >
                    ✕
                  </Bouton>
                </div>
              ))}
              <Bouton
                taille="petite"
                variante="secondaire"
                onClick={() =>
                  setEdition({
                    ...edition,
                    paliers: [
                      ...edition.paliers,
                      { aPartirDeJours: 30, prixJour: edition.prixJour },
                    ],
                  })
                }
              >
                {t("loueur.tarifs.ajouterPalier")}
              </Bouton>
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">{t("loueur.tarifs.supplements")}</legend>
              {[...OPTIONS_RESERVABLES, "livraison" as const].map((o) => {
                const s = edition.supplements[o];
                const mode = s?.forfait !== undefined ? "forfait" : "parJour";
                return (
                  <div
                    key={o}
                    className="mb-2 grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2 text-sm"
                  >
                    <Case
                      libelle={t(`options.${o}`)}
                      checked={!!s}
                      onChange={(e) =>
                        setEdition({
                          ...edition,
                          supplements: {
                            ...edition.supplements,
                            [o]: e.target.checked ? { parJour: 500 } : undefined,
                          },
                        })
                      }
                    />
                    {s && (
                      <>
                        <Liste
                          value={mode}
                          onChange={(e) =>
                            setEdition({
                              ...edition,
                              supplements: {
                                ...edition.supplements,
                                [o]: { [e.target.value]: s.parJour ?? s.forfait ?? 0 },
                              },
                            })
                          }
                        >
                          <option value="parJour">{t("loueur.tarifs.parJour")}</option>
                          <option value="forfait">{t("loueur.tarifs.forfait")}</option>
                        </Liste>
                        <Saisie
                          type="number"
                          min={0}
                          dir="ltr"
                          value={s.parJour ?? s.forfait ?? 0}
                          onChange={(e) =>
                            setEdition({
                              ...edition,
                              supplements: {
                                ...edition.supplements,
                                [o]: { [mode]: Number(e.target.value) },
                              },
                            })
                          }
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Champ libelle={`${t("loueur.tarifs.saison")} — ${t("loueur.tarifs.saisonDebut")}`}>
                <Saisie
                  type="date"
                  value={edition.saisonDebut ?? ""}
                  onChange={(e) => setEdition({ ...edition, saisonDebut: e.target.value || null })}
                />
              </Champ>
              <Champ libelle={t("loueur.tarifs.saisonFin")}>
                <Saisie
                  type="date"
                  value={edition.saisonFin ?? ""}
                  onChange={(e) => setEdition({ ...edition, saisonFin: e.target.value || null })}
                />
              </Champ>
            </div>
            <Case
              libelle={t("loueur.tarifs.actif")}
              checked={edition.actif}
              onChange={(e) => setEdition({ ...edition, actif: e.target.checked })}
            />
            {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
            <div className="flex gap-2">
              <Bouton chargement={action.enCours} onClick={enregistrer}>
                {t("commun.enregistrer")}
              </Bouton>
              {edition.id && (
                <Bouton
                  variante="danger"
                  className="ms-auto"
                  onClick={() =>
                    confirm(t("ui.confirmerAction")) &&
                    void action.executer(async () => {
                      await api.delete(`/agence/tarifs/${edition.id}`);
                      setEdition(null);
                      await recharger();
                    })
                  }
                >
                  {t("commun.supprimer")}
                </Bouton>
              )}
            </div>
          </div>
        )}
      </Modale>
    </div>
  );
}
