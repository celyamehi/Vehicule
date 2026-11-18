import type { Langue } from "@lvb/shared";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { FormulaireRecherche } from "@/components/formulaire-recherche";
import { Resultats } from "@/components/resultats";
import { routing } from "@/i18n/routing";
import { type ReponseRecherche, VILLES, datesParDefaut, versRequete } from "@/lib/recherche";
import { apiServeur } from "@/lib/serveur";

export const revalidate = 600;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => VILLES.map((v) => ({ locale, ville: v.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; ville: string }>;
}): Promise<Metadata> {
  const { locale, ville } = await params;
  const v = VILLES.find((x) => x.slug === ville);
  if (!v) return {};
  const t = await getTranslations({ locale });
  return {
    title: t("client.seo.titreVille", { ville: v.commune }),
    description: t("client.seo.descriptionVille", { ville: v.commune }),
    alternates: {
      canonical: `/${locale}/location-voiture/${ville}`,
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `/${l}/location-voiture/${ville}`]),
      ),
    },
  };
}

/** Page « location voiture <ville> » pour le référencement Google (section 7 et 14.4). */
export default async function PageVille({
  params,
}: {
  params: Promise<{ locale: string; ville: string }>;
}) {
  const { locale, ville } = await params;
  setRequestLocale(locale);
  const v = VILLES.find((x) => x.slug === ville);
  if (!v) notFound();
  const t = await getTranslations();
  const dates = datesParDefaut();
  const reponse = await apiServeur<ReponseRecherche>(
    `/recherche?${versRequete({ wilaya: "6", commune: v.commune, ...dates, parPage: "20" })}`,
    locale,
    600,
  );
  // Pas de véhicule dans la commune : on propose ceux de la wilaya.
  const repli =
    reponse && reponse.total === 0
      ? await apiServeur<ReponseRecherche>(
          `/recherche?${versRequete({ wilaya: "6", ...dates, parPage: "20" })}`,
          locale,
          600,
        )
      : null;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("client.seo.titreVille", { ville: v.commune })}</h1>
      <p className="text-attenue">{t("client.seo.descriptionVille", { ville: v.commune })}</p>
      <div>
        <FormulaireRecherche debut={dates.debut} fin={dates.fin} commune={v.commune} compact />
      </div>
      <Resultats
        reponse={repli ?? reponse}
        langue={locale as Langue}
        requete={versRequete(dates)}
      />
    </div>
  );
}
