import type { Langue } from "@lvb/shared";
import { formaterMontant } from "@lvb/ui";
import { BadgeCheck, CarFront, Fuel, Gauge, MapPin, Settings2, Users } from "lucide-react";
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
  const specs = [
    [Settings2, t(`boites.${v.boite}`)],
    [Fuel, t(`carburants.${v.carburant}`)],
    [Users, t("client.fiche.places", { n: v.places })],
    [
      Gauge,
      v.kmInclusParJour === null
        ? t("client.fiche.kmIllimite")
        : t("client.fiche.kmInclus", { km: v.kmInclusParJour }),
    ],
  ] as const;
  return (
    <Link
      href={`/vehicules/${v.id}?${requete}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-carte)] bg-surface shadow-[var(--shadow-douce)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-relief)] sm:flex-row"
    >
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-gradient-to-br from-marque-50 to-lavande-50 sm:aspect-auto sm:w-64">
        {v.photo ? (
          <img
            src={v.photo}
            alt={`${v.marque} ${v.modele}`}
            className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-marque-300">
            <CarFront className="size-14" strokeWidth={1.3} />
          </div>
        )}
        <span className="verre absolute start-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium">
          {t(`categories.${v.categorie}`)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {v.marque} {v.modele}{" "}
            <span className="text-[15px] font-normal text-attenue">{v.annee}</span>
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-attenue">
            <BadgeCheck className="size-4 text-menthe-800" strokeWidth={2} />
            {v.agence.raisonSociale}
            <span aria-hidden>·</span>
            <MapPin className="size-3.5" strokeWidth={2} />
            {v.pointRetrait.nom}
            {v.pointRetrait.distanceKm !== null && (
              <> · {t("client.recherche.kmDe", { km: v.pointRetrait.distanceKm })}</>
            )}
          </p>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {specs.map(([Icone, texte]) => (
            <li
              key={texte}
              className="inline-flex items-center gap-1.5 rounded-full bg-champ px-2.5 py-1 text-xs font-medium text-encre/80"
            >
              <Icone className="size-3.5 text-attenue" strokeWidth={2} />
              {texte}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-trait/70 pt-3">
          <div>
            <div className="text-[22px] font-semibold tracking-tight tabular-nums">
              {formaterMontant(v.prix.total, langue)}
            </div>
            <div className="text-xs text-attenue">
              {t("client.recherche.totalPour", { jours: t("commun.jours", { n: v.prix.jours }) })} ·{" "}
              {formaterMontant(v.prix.parJour, langue)} {t("client.recherche.parJour")}
            </div>
          </div>
          <span className="inline-flex h-10 items-center rounded-full bg-marque-600 px-4 text-sm font-medium text-white transition group-hover:bg-marque-700">
            {t("client.recherche.voir")}
          </span>
        </div>
      </div>
    </Link>
  );
}
