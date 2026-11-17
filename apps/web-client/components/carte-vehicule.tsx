import type { Langue } from "@lvb/shared";
import { formaterMontant } from "@lvb/ui";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { ResultatRecherche } from "@/lib/recherche";

/** Carte d'un véhicule dans les résultats (rendue côté serveur). */
export async function CarteVehicule({
  v,
  langue,
  requete,
}: {
  v: ResultatRecherche;
  langue: Langue;
  requete: string;
}) {
  const t = await getTranslations({ locale: langue });
  return (
    <Link
      href={`/vehicules/${v.id}?${requete}`}
      className="flex flex-col overflow-hidden rounded-xl border border-trait bg-surface transition hover:shadow-md sm:flex-row"
    >
      <div className="aspect-[16/10] w-full shrink-0 bg-fond sm:aspect-auto sm:w-56">
        {v.photo ? (
          <img
            src={v.photo}
            alt={`${v.marque} ${v.modele}`}
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">
              {v.marque} {v.modele}{" "}
              <span className="text-sm font-normal text-attenue">{v.annee}</span>
            </h2>
            <p className="text-xs text-attenue">
              {t(`categories.${v.categorie}`)} · {t(`boites.${v.boite}`)} ·{" "}
              {t(`carburants.${v.carburant}`)} · {t("client.fiche.places", { n: v.places })}
            </p>
          </div>
        </div>
        <p className="text-sm">
          {v.agence.raisonSociale} · {v.pointRetrait.nom}
          {v.pointRetrait.distanceKm !== null && (
            <span className="text-attenue">
              {" "}
              · {t("client.recherche.kmDe", { km: v.pointRetrait.distanceKm })}
            </span>
          )}
        </p>
        <p className="text-xs text-attenue">
          {v.kmInclusParJour === null
            ? t("client.fiche.kmIllimite")
            : t("client.fiche.kmInclus", { km: v.kmInclusParJour })}{" "}
          · {t(`politiques.${v.agence.politiqueAnnulation}`)}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <div className="text-xl font-bold text-marque-700">
              {formaterMontant(v.prix.total, langue)}
            </div>
            <div className="text-xs text-attenue">
              {t("client.recherche.totalPour", { jours: t("commun.jours", { n: v.prix.jours }) })} ·{" "}
              {formaterMontant(v.prix.parJour, langue)} {t("client.recherche.parJour")}
            </div>
          </div>
          <span className="rounded-lg bg-marque-600 px-3 py-1.5 text-sm font-medium text-white">
            {t("client.recherche.voir")}
          </span>
        </div>
      </div>
    </Link>
  );
}
