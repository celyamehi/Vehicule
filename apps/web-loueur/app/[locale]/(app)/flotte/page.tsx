"use client";

import { Carte, Chargement, Message, Pastille } from "@lvb/ui";
import { useTranslations } from "next-intl";
import { EnTete, usePeut } from "@/components/coquille";
import { Link } from "@/i18n/navigation";
import { useDonnees } from "@/lib/donnees";
import type { Vehicule } from "@/lib/types";

export default function Flotte() {
  const t = useTranslations();
  const peut = usePeut();
  const { donnees, erreur } = useDonnees<Vehicule[]>("/agence/vehicules");

  return (
    <div className="flex flex-col gap-4">
      <EnTete
        titre={`${t("loueur.flotte.titre")}${donnees ? ` (${donnees.length})` : ""}`}
        actions={
          peut("flotte.modifier") && (
            <Link
              href="/flotte/nouveau"
              className="rounded-lg bg-marque-600 px-4 py-2 text-sm font-medium text-white"
            >
              {t("loueur.flotte.ajouter")}
            </Link>
          )
        }
      />
      {erreur && <Message ton="erreur">{erreur}</Message>}
      {!donnees ? (
        <Chargement />
      ) : donnees.length === 0 ? (
        <Carte>
          <p className="text-sm text-attenue">{t("loueur.flotte.aucun")}</p>
        </Carte>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {donnees.map((v) => (
            <Link
              key={v.id}
              href={`/flotte/${v.id}`}
              className="flex gap-3 rounded-xl border border-trait bg-surface p-3 hover:border-marque-600"
            >
              <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-fond">
                {v.photo && (
                  <img src={v.photo} alt="" className="size-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-semibold">
                  {v.marque} {v.modele} <span className="font-normal text-attenue">{v.annee}</span>
                </div>
                <div className="ltr text-attenue">{v.immatriculation}</div>
                <div className="text-xs text-attenue">
                  {t(`categories.${v.categorie}`)} · {t(`boites.${v.boite}`)} ·{" "}
                  {t(`carburants.${v.carburant}`)}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Pastille statut={v.statut}>{t(`statutsVehicule.${v.statut}`)}</Pastille>
                  {!v.visiblePlateforme && (
                    <Pastille statut="masque">{t("origines.comptoir")}</Pastille>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
