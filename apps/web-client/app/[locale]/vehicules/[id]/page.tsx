import { type Langue, nomWilaya } from "@lvb/shared";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { BlocReservation } from "@/components/bloc-reservation";
import { datesParDefaut } from "@/lib/recherche";
import { apiServeur } from "@/lib/serveur";
import type { FicheVehicule } from "@/lib/types";

type Props = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const v = await apiServeur<FicheVehicule>(`/vehicules/${id}`, locale, 300);
  if (!v) return {};
  const t = await getTranslations({ locale });
  return {
    title: `${v.marque} ${v.modele} — ${t("client.seo.titreVille", { ville: v.pointRetrait.commune || "Béjaïa" })}`,
    description: `${v.agence.raisonSociale} · ${t(`categories.${v.categorie}`)} · ${t(`boites.${v.boite}`)}`,
    openGraph: v.photos[0] ? { images: [v.photos[0]] } : undefined,
  };
}

/** Fiche véhicule (3.3), rendue côté serveur. */
export default async function Fiche({ params, searchParams }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const v = await apiServeur<FicheVehicule>(`/vehicules/${id}`, locale, 300);
  if (!v) notFound();
  const t = await getTranslations();
  const langue = locale as Langue;
  const defaut = datesParDefaut();
  const equipements = Object.entries(v.options)
    .filter(([, actif]) => actif)
    .map(([o]) => o);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-xl">
          {v.photos.length === 0 && <div className="aspect-[16/10] w-full rounded-xl bg-fond" />}
          {v.photos.map((p, i) => (
            <img
              key={p}
              src={p}
              alt={`${v.marque} ${v.modele} ${i + 1}`}
              className="aspect-[16/10] w-full shrink-0 snap-center rounded-xl object-cover sm:w-[85%]"
              loading={i === 0 ? "eager" : "lazy"}
            />
          ))}
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {v.marque} {v.modele}{" "}
            <span className="text-lg font-normal text-attenue">{v.annee}</span>
          </h1>
          <p className="text-attenue">{t(`categories.${v.categorie}`)}</p>
        </div>
        <section>
          <h2 className="mb-2 font-semibold">{t("client.fiche.caracteristiques")}</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {[
              t(`boites.${v.boite}`),
              t(`carburants.${v.carburant}`),
              t("client.fiche.places", { n: v.places }),
              ...equipements.map((o) => t(`options.${o}`)),
            ].map((x) => (
              <li key={x} className="rounded-full bg-fond px-3 py-1">
                {x}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-2 font-semibold">{t("client.fiche.conditions")}</h2>
          <ul className="list-inside list-disc text-sm">
            <li>{t("client.fiche.ageMinimum", { age: v.conditions.ageMinimum })}</li>
            <li>
              {t("client.fiche.permisMinimum", { annees: v.conditions.ancienneteMinPermisAnnees })}
            </li>
            <li>
              {v.kmInclusParJour === null
                ? t("client.fiche.kmIllimite")
                : t("client.fiche.kmInclus", { km: v.kmInclusParJour })}
            </li>
            <li>
              {t("politiques." + v.conditions.politiqueAnnulation)} —{" "}
              {t(`politiques.${v.conditions.politiqueAnnulation}_detail`)}
            </li>
            <li>{t("client.fiche.paiementSurPlace")}</li>
          </ul>
        </section>
        <section className="rounded-xl border border-trait bg-surface p-4 text-sm">
          <h2 className="mb-2 font-semibold">{t("client.fiche.agence")}</h2>
          <p className="font-medium">{v.agence.raisonSociale}</p>
          <p className="text-attenue">
            {v.agence.adresse}, {nomWilaya(v.agence.wilaya, langue)}
          </p>
          <h3 className="mt-3 font-medium">{t("client.fiche.lieuRetrait")}</h3>
          <p>
            {v.pointRetrait.nom} — {v.pointRetrait.adresse}
          </p>
          {v.pointRetrait.lat !== null && (
            <a
              className="text-marque-700 underline"
              target="_blank"
              rel="noreferrer"
              href={`https://www.openstreetmap.org/?mlat=${v.pointRetrait.lat}&mlon=${v.pointRetrait.lon}#map=16/${v.pointRetrait.lat}/${v.pointRetrait.lon}`}
            >
              OpenStreetMap
            </a>
          )}
          <ul className="mt-2 text-xs text-attenue">
            {Object.entries(v.pointRetrait.horaires).map(([j, plages]) => (
              <li key={j}>
                {t(`jours.${j}`)} :{" "}
                <span className="ltr">{plages.map((p) => p.join("–")).join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <BlocReservation
          vehicule={v}
          debutInitial={sp.debut ?? defaut.debut}
          finInitiale={sp.fin ?? defaut.fin}
        />
      </aside>
    </div>
  );
}
