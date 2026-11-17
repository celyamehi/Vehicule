"use client";

import {
  COMMUNES_BEJAIA,
  POLITIQUES_ANNULATION,
  WILAYA_BEJAIA,
  WILAYAS,
  nomWilaya,
  type Langue,
} from "@lvb/shared";
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
  televerser,
  useSession,
} from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { EnTete } from "@/components/coquille";
import { useAction, useDonnees } from "@/lib/donnees";
import type { PointRetrait } from "@/lib/types";

type Agence = {
  battementMinutes: number;
  confirmationInstantanee: boolean;
  politiqueAnnulation: "souple" | "moderee" | "stricte";
  ageMinimum: number;
  ancienneteMinPermisAnnees: number;
  prixKmSupplementaire: number;
  prixHuitiemeCarburant: number;
  telephone: string;
  adresse: string;
  monRole: string;
};

export default function Parametres() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { api } = useSession();
  const action = useAction();
  const { donnees: agence, erreur } = useDonnees<Agence>("/agence");
  const { donnees: points, recharger: rechargerPoints } =
    useDonnees<PointRetrait[]>("/agence/points-retrait");
  const [f, setF] = useState<Partial<Agence>>({});
  const [succes, setSucces] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [point, setPoint] = useState<{
    id?: string;
    nom: string;
    adresse: string;
    wilaya: number;
    commune: string;
    lat: string;
    lon: string;
  } | null>(null);

  useEffect(() => {
    if (agence) setF(agence);
  }, [agence]);
  if (erreur) return <Message ton="erreur">{erreur}</Message>;
  if (!agence) return <Chargement />;
  const gerant = agence.monRole === "gerant";
  const nombre = (k: keyof Agence) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: Number(e.target.value) });

  const enregistrer = () =>
    void action.executer(async () => {
      const logoUrl = logo ? await televerser(api, logo, "logo") : undefined;
      await api.patch("/agence/parametres", {
        battementMinutes: f.battementMinutes,
        confirmationInstantanee: f.confirmationInstantanee,
        politiqueAnnulation: f.politiqueAnnulation,
        ageMinimum: f.ageMinimum,
        ancienneteMinPermisAnnees: f.ancienneteMinPermisAnnees,
        prixKmSupplementaire: f.prixKmSupplementaire,
        prixHuitiemeCarburant: f.prixHuitiemeCarburant,
        ...(logoUrl ? { logoUrl } : {}),
      });
      setSucces(true);
    });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <EnTete titre={t("loueur.parametres.titre")} />
      <Carte>
        <fieldset disabled={!gerant} className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle={t("loueur.parametres.battement")}
            aide={t("loueur.parametres.battementAide")}
          >
            <Saisie
              type="number"
              min={0}
              max={1440}
              step={15}
              dir="ltr"
              value={f.battementMinutes ?? 0}
              onChange={nombre("battementMinutes")}
            />
          </Champ>
          <Champ
            libelle={t("loueur.parametres.politique")}
            aide={f.politiqueAnnulation && t(`politiques.${f.politiqueAnnulation}_detail`)}
          >
            <Liste
              value={f.politiqueAnnulation}
              onChange={(e) =>
                setF({ ...f, politiqueAnnulation: e.target.value as Agence["politiqueAnnulation"] })
              }
            >
              {POLITIQUES_ANNULATION.map((p) => (
                <option key={p} value={p}>
                  {t(`politiques.${p}`)}
                </option>
              ))}
            </Liste>
          </Champ>
          <Champ libelle={t("loueur.parametres.ageMinimum")}>
            <Saisie
              type="number"
              min={18}
              max={99}
              dir="ltr"
              value={f.ageMinimum ?? 21}
              onChange={nombre("ageMinimum")}
            />
          </Champ>
          <Champ libelle={t("loueur.parametres.anciennetePermis")}>
            <Saisie
              type="number"
              min={0}
              max={20}
              dir="ltr"
              value={f.ancienneteMinPermisAnnees ?? 2}
              onChange={nombre("ancienneteMinPermisAnnees")}
            />
          </Champ>
          <Champ libelle={t("loueur.parametres.prixKm")}>
            <Saisie
              type="number"
              min={0}
              dir="ltr"
              value={f.prixKmSupplementaire ?? 0}
              onChange={nombre("prixKmSupplementaire")}
            />
          </Champ>
          <Champ libelle={t("loueur.parametres.prixCarburant")}>
            <Saisie
              type="number"
              min={0}
              dir="ltr"
              value={f.prixHuitiemeCarburant ?? 0}
              onChange={nombre("prixHuitiemeCarburant")}
            />
          </Champ>
          <div className="sm:col-span-2">
            <Case
              libelle={t("loueur.parametres.confirmationInstantanee")}
              aide={t("loueur.parametres.confirmationAide")}
              checked={!!f.confirmationInstantanee}
              onChange={(e) => setF({ ...f, confirmationInstantanee: e.target.checked })}
            />
          </div>
          <Champ libelle={t("loueur.parametres.logo")}>
            <Saisie
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
            />
          </Champ>
        </fieldset>
        {succes && (
          <div className="mt-3">
            <Message ton="succes">{t("ui.enregistre")}</Message>
          </div>
        )}
        {action.erreur && !point && (
          <div className="mt-3">
            <Message ton="erreur">{action.erreur}</Message>
          </div>
        )}
        {gerant && (
          <Bouton className="mt-4" chargement={action.enCours} onClick={enregistrer}>
            {t("commun.enregistrer")}
          </Bouton>
        )}
      </Carte>

      <Carte
        titre={t("loueur.parametres.pointsRetrait")}
        actions={
          gerant && (
            <Bouton
              taille="petite"
              variante="secondaire"
              onClick={() =>
                setPoint({
                  nom: "",
                  adresse: "",
                  wilaya: WILAYA_BEJAIA,
                  commune: "Béjaïa",
                  lat: "",
                  lon: "",
                })
              }
            >
              {t("loueur.parametres.ajouterPoint")}
            </Bouton>
          )
        }
      >
        <ul className="divide-y divide-trait text-sm">
          {points?.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2">
              <div>
                <div className="font-medium">{p.nom}</div>
                <div className="text-attenue">
                  {p.adresse} — {p.commune}, {nomWilaya(p.wilaya, langue)}
                </div>
              </div>
              {gerant && (
                <Bouton
                  taille="petite"
                  variante="fantome"
                  onClick={() =>
                    setPoint({
                      id: p.id,
                      nom: p.nom,
                      adresse: p.adresse,
                      wilaya: p.wilaya,
                      commune: p.commune,
                      lat: p.lat?.toString() ?? "",
                      lon: p.lon?.toString() ?? "",
                    })
                  }
                >
                  {t("commun.modifier")}
                </Bouton>
              )}
            </li>
          ))}
        </ul>
      </Carte>

      <Modale
        ouverte={!!point}
        titre={t("loueur.parametres.ajouterPoint")}
        onFermer={() => setPoint(null)}
      >
        {point && (
          <div className="flex flex-col gap-3">
            <Champ libelle={t("loueur.parametres.nomPoint")}>
              <Saisie
                value={point.nom}
                onChange={(e) => setPoint({ ...point, nom: e.target.value })}
              />
            </Champ>
            <Champ libelle={t("commun.adresse")}>
              <Saisie
                value={point.adresse}
                onChange={(e) => setPoint({ ...point, adresse: e.target.value })}
              />
            </Champ>
            <div className="grid grid-cols-2 gap-3">
              <Champ libelle={t("commun.wilaya")}>
                <Liste
                  value={point.wilaya}
                  onChange={(e) => setPoint({ ...point, wilaya: Number(e.target.value) })}
                >
                  {WILAYAS.map((w) => (
                    <option key={w.code} value={w.code}>
                      {nomWilaya(w.code, langue)}
                    </option>
                  ))}
                </Liste>
              </Champ>
              <Champ libelle={t("commun.commune")}>
                <Saisie
                  list="communes"
                  value={point.commune}
                  onChange={(e) => setPoint({ ...point, commune: e.target.value })}
                />
                <datalist id="communes">
                  {COMMUNES_BEJAIA.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Champ>
              <Champ libelle={t("loueur.parametres.latitude")}>
                <Saisie
                  inputMode="decimal"
                  dir="ltr"
                  value={point.lat}
                  onChange={(e) => setPoint({ ...point, lat: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("loueur.parametres.longitude")}>
                <Saisie
                  inputMode="decimal"
                  dir="ltr"
                  value={point.lon}
                  onChange={(e) => setPoint({ ...point, lon: e.target.value })}
                />
              </Champ>
            </div>
            {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
            <Bouton
              chargement={action.enCours}
              onClick={() =>
                void action.executer(async () => {
                  const { id, lat, lon, ...reste } = point;
                  const corps = {
                    ...reste,
                    ...(lat && lon ? { lat: Number(lat), lon: Number(lon) } : {}),
                  };
                  if (id) await api.patch(`/agence/points-retrait/${id}`, corps);
                  else await api.post("/agence/points-retrait", corps);
                  setPoint(null);
                  await rechargerPoints();
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
