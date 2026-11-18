"use client";

import {
  BOITES,
  CARBURANTS,
  CATEGORIES_VEHICULE,
  OPTIONS_VEHICULE,
  STATUTS_VEHICULE,
} from "@lvb/shared";
import {
  Bouton,
  Carte,
  Case,
  Champ,
  Chargement,
  Liste,
  Message,
  Saisie,
  televerser,
  useSession,
} from "@lvb/ui";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useState, type FormEvent } from "react";
import { EnTete } from "@/components/coquille";
import { RentabiliteVehicule } from "@/components/entretien";
import { useRouter } from "@/i18n/navigation";
import { useAction, useDonnees } from "@/lib/donnees";
import type { PointRetrait, Vehicule } from "@/lib/types";

type Detail = Vehicule & {
  photos: { id: string; url: string; ordre: number }[];
  tarifs: {
    id: string;
    prixJour: number;
    caution: number;
    saisonDebut: string | null;
    paliers: unknown[];
    supplements: Record<string, unknown>;
  }[];
};

const vide = {
  pointRetraitId: "",
  categorie: "citadine",
  marque: "",
  modele: "",
  annee: new Date().getFullYear(),
  immatriculation: "",
  boite: "manuelle",
  carburant: "essence",
  places: 5,
  options: { climatisation: true } as Record<string, boolean>,
  kilometrage: 0,
  kmInclusParJour: 250 as number | null,
  visiblePlateforme: true,
  statut: "disponible",
};

/** Création et modification d'un véhicule, avec photos et tarif de base (ajout rapide de la flotte). */
export default function FicheVehicule({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const creation = id === "nouveau";
  const t = useTranslations();
  const routeur = useRouter();
  const { api } = useSession();
  const action = useAction();
  const { donnees: points } = useDonnees<PointRetrait[]>("/agence/points-retrait");
  const { donnees: detail, recharger } = useDonnees<Detail>(
    creation ? null : `/agence/vehicules/${id}`,
  );
  const [f, setF] = useState(vide);
  const [prixJour, setPrixJour] = useState("");
  const [caution, setCaution] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [succes, setSucces] = useState<string | null>(null);

  useEffect(() => {
    if (creation && points?.length && !f.pointRetraitId)
      setF((x) => ({ ...x, pointRetraitId: points[0]!.id }));
  }, [creation, points, f.pointRetraitId]);
  useEffect(() => {
    if (!detail) return;
    setF({
      pointRetraitId: detail.pointRetraitId,
      categorie: detail.categorie,
      marque: detail.marque,
      modele: detail.modele,
      annee: detail.annee,
      immatriculation: detail.immatriculation,
      boite: detail.boite,
      carburant: detail.carburant,
      places: detail.places,
      options: detail.options,
      kilometrage: detail.kilometrage,
      kmInclusParJour: detail.kmInclusParJour,
      visiblePlateforme: detail.visiblePlateforme,
      statut: detail.statut,
    });
    const base = detail.tarifs.find((x) => !x.saisonDebut);
    if (base) {
      setPrixJour(String(base.prixJour));
      setCaution(String(base.caution));
    }
  }, [detail]);

  const enregistrer = (suivant: boolean) => (e?: FormEvent) => {
    e?.preventDefault();
    void action.executer(async () => {
      const v = creation
        ? await api.post<{ id: string }>("/agence/vehicules", f)
        : await api.patch<{ id: string }>(`/agence/vehicules/${id}`, f);
      for (const p of photos) {
        const cle = await televerser(api, p, "photo_vehicule");
        await api.post(`/agence/vehicules/${v.id}/photos`, { cle });
      }
      if (prixJour) {
        const base = detail?.tarifs.find((x) => !x.saisonDebut);
        const tarif = {
          vehiculeId: v.id,
          prixJour: Number(prixJour),
          caution: Number(caution) || 0,
          supplements: {
            siegeBebe: { parJour: 500 },
            gps: { parJour: 400 },
            conducteurAdditionnel: { forfait: 1500 },
          },
        };
        // En modification, on garde les paliers et suppléments réglés dans la page Tarifs.
        if (base)
          await api.patch(`/agence/tarifs/${base.id}`, {
            ...tarif,
            paliers: base.paliers,
            supplements: base.supplements,
          });
        else await api.post("/agence/tarifs", tarif);
      }
      setPhotos([]);
      if (suivant) {
        // Ajout rapide : on garde point, catégorie, prix ; on vide l'identité du véhicule.
        setF({ ...f, immatriculation: "", kilometrage: 0 });
        setSucces(t("ui.enregistre"));
      } else routeur.push("/flotte");
    });
  };

  if (!creation && !detail) return <Chargement />;
  const maj = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  return (
    <div className="mx-auto max-w-3xl">
      <EnTete titre={t(creation ? "loueur.flotte.ajouter" : "loueur.flotte.modifier")} />
      <form onSubmit={enregistrer(false)} className="flex flex-col gap-4">
        <Carte>
          <div className="grid gap-3 sm:grid-cols-3">
            <Champ libelle={t("loueur.flotte.marque")}>
              <Saisie required value={f.marque} onChange={(e) => maj("marque", e.target.value)} />
            </Champ>
            <Champ libelle={t("loueur.flotte.modele")}>
              <Saisie required value={f.modele} onChange={(e) => maj("modele", e.target.value)} />
            </Champ>
            <Champ libelle={t("loueur.flotte.annee")}>
              <Saisie
                type="number"
                required
                min={1990}
                max={2100}
                dir="ltr"
                value={f.annee}
                onChange={(e) => maj("annee", Number(e.target.value))}
              />
            </Champ>
            <Champ libelle={t("loueur.flotte.immatriculation")}>
              <Saisie
                required
                dir="ltr"
                value={f.immatriculation}
                onChange={(e) => maj("immatriculation", e.target.value)}
              />
            </Champ>
            <Champ libelle={t("loueur.flotte.categorie")}>
              <Liste value={f.categorie} onChange={(e) => maj("categorie", e.target.value)}>
                {CATEGORIES_VEHICULE.map((c) => (
                  <option key={c} value={c}>
                    {t(`categories.${c}`)}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ libelle={t("loueur.flotte.places")}>
              <Saisie
                type="number"
                min={1}
                max={60}
                dir="ltr"
                value={f.places}
                onChange={(e) => maj("places", Number(e.target.value))}
              />
            </Champ>
            <Champ libelle={t("loueur.flotte.boite")}>
              <Liste value={f.boite} onChange={(e) => maj("boite", e.target.value)}>
                {BOITES.map((b) => (
                  <option key={b} value={b}>
                    {t(`boites.${b}`)}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ libelle={t("loueur.flotte.carburant")}>
              <Liste value={f.carburant} onChange={(e) => maj("carburant", e.target.value)}>
                {CARBURANTS.map((c) => (
                  <option key={c} value={c}>
                    {t(`carburants.${c}`)}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ libelle={t("loueur.flotte.kilometrage")}>
              <Saisie
                type="number"
                min={0}
                dir="ltr"
                value={f.kilometrage}
                onChange={(e) => maj("kilometrage", Number(e.target.value))}
              />
            </Champ>
            <Champ
              libelle={t("loueur.flotte.kmInclus")}
              aide={f.kmInclusParJour === null ? t("loueur.flotte.illimite") : undefined}
            >
              <Saisie
                type="number"
                min={1}
                dir="ltr"
                placeholder={t("loueur.flotte.illimite")}
                value={f.kmInclusParJour ?? ""}
                onChange={(e) =>
                  maj("kmInclusParJour", e.target.value ? Number(e.target.value) : null)
                }
              />
            </Champ>
            <Champ libelle={t("loueur.flotte.pointRetrait")}>
              <Liste
                value={f.pointRetraitId}
                onChange={(e) => maj("pointRetraitId", e.target.value)}
              >
                {points?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ libelle={t("loueur.flotte.statut")}>
              <Liste value={f.statut} onChange={(e) => maj("statut", e.target.value)}>
                {STATUTS_VEHICULE.map((s) => (
                  <option key={s} value={s}>
                    {t(`statutsVehicule.${s}`)}
                  </option>
                ))}
              </Liste>
            </Champ>
          </div>
          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-medium">{t("loueur.flotte.options")}</legend>
            <div className="flex flex-wrap gap-4">
              {OPTIONS_VEHICULE.map((o) => (
                <Case
                  key={o}
                  libelle={t(`options.${o}`)}
                  checked={!!f.options[o]}
                  onChange={(e) => maj("options", { ...f.options, [o]: e.target.checked })}
                />
              ))}
            </div>
          </fieldset>
          <div className="mt-4">
            <Case
              libelle={t("loueur.flotte.visible")}
              aide={t("loueur.flotte.visibleAide")}
              checked={f.visiblePlateforme}
              onChange={(e) => maj("visiblePlateforme", e.target.checked)}
            />
          </div>
        </Carte>

        <Carte titre={t("loueur.nav.tarifs")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ
              libelle={t("loueur.flotte.prixBase")}
              aide={!prixJour ? t("loueur.flotte.sansTarif") : undefined}
            >
              <Saisie
                type="number"
                min={1}
                step={100}
                dir="ltr"
                value={prixJour}
                onChange={(e) => setPrixJour(e.target.value)}
              />
            </Champ>
            <Champ libelle={t("loueur.flotte.caution")}>
              <Saisie
                type="number"
                min={0}
                step={1000}
                dir="ltr"
                value={caution}
                onChange={(e) => setCaution(e.target.value)}
              />
            </Champ>
          </div>
        </Carte>

        <Carte titre={t("loueur.flotte.photos")}>
          {detail && detail.photos.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {detail.photos.map((p) => (
                <div key={p.id} className="relative">
                  <img src={p.url} alt="" className="size-24 rounded-lg object-cover" />
                  <button
                    type="button"
                    aria-label={t("commun.supprimer")}
                    className="absolute end-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
                    onClick={() =>
                      void action.executer(async () => {
                        await api.delete(`/agence/vehicules/${id}/photos/${p.id}`);
                        await recharger();
                      })
                    }
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Saisie
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={(e) => setPhotos([...(e.target.files ?? [])])}
          />
        </Carte>

        {!creation && <RentabiliteVehicule vehiculeId={id} />}

        {succes && <Message ton="succes">{succes}</Message>}
        {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
        <div className="flex flex-wrap gap-2">
          <Bouton type="submit" chargement={action.enCours}>
            {t("commun.enregistrer")}
          </Bouton>
          {creation && (
            <Bouton
              variante="secondaire"
              chargement={action.enCours}
              onClick={() => enregistrer(true)()}
            >
              {t("loueur.flotte.enregistreEtSuivant")}
            </Bouton>
          )}
          {!creation && (
            <Bouton
              variante="danger"
              className="ms-auto"
              onClick={() =>
                confirm(t("ui.confirmerAction")) &&
                void action.executer(async () => {
                  await api.delete(`/agence/vehicules/${id}`);
                  routeur.push("/flotte");
                })
              }
            >
              {t("loueur.flotte.supprimer")}
            </Bouton>
          )}
        </div>
      </form>
    </div>
  );
}
