import { getTranslations, setRequestLocale } from "next-intl/server";
import { FormulaireRecherche } from "@/components/formulaire-recherche";
import { Link } from "@/i18n/navigation";
import { VILLES, datesParDefaut } from "@/lib/recherche";

export const dynamic = "force-dynamic";

export default async function Accueil({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const dates = datesParDefaut();
  const atouts = [
    ["atoutPrix", "atoutPrixTexte"],
    ["atoutAgences", "atoutAgencesTexte"],
    ["atoutRapide", "atoutRapideTexte"],
  ] as const;
  return (
    <div className="flex flex-col gap-8">
      <section className="-mx-3 rounded-none bg-gradient-to-b from-marque-700 to-marque-600 px-4 py-8 text-white sm:mx-0 sm:rounded-2xl sm:px-8 sm:py-12">
        <h1 className="mb-2 text-2xl font-bold sm:text-4xl">{t("client.accueil.titre")}</h1>
        <p className="mb-6 text-marque-100">{t("client.accueil.sousTitre")}</p>
        <div className="text-encre">
          <FormulaireRecherche debut={dates.debut} fin={dates.fin} />
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {atouts.map(([titre, texte]) => (
          <div key={titre} className="rounded-xl border border-trait bg-surface p-4">
            <h2 className="mb-1 font-semibold">{t(`client.accueil.${titre}`)}</h2>
            <p className="text-sm text-attenue">{t(`client.accueil.${texte}`)}</p>
          </div>
        ))}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("client.accueil.villes")}</h2>
        <div className="flex flex-wrap gap-2">
          {VILLES.map((v) => (
            <Link
              key={v.slug}
              href={`/location-voiture/${v.slug}`}
              className="rounded-full border border-trait bg-surface px-3 py-1.5 text-sm hover:border-marque-600"
            >
              {v.commune}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
