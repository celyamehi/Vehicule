import type { Langue } from "@lvb/shared";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Filtres } from "@/components/filtres";
import { FormulaireRecherche } from "@/components/formulaire-recherche";
import { Resultats } from "@/components/resultats";
import { type ReponseRecherche, lireParametres, versRequete } from "@/lib/recherche";
import { apiServeur } from "@/lib/serveur";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t("commun.rechercher"), robots: { index: false, follow: true } };
}

/** Résultats rendus côté serveur : la page s'affiche vite même en 3G. */
export default async function Recherche({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const p = lireParametres(await searchParams);
  const reponse = await apiServeur<ReponseRecherche>(
    `/recherche?${versRequete({ ...p, parPage: "30" })}`,
    locale,
  );
  const requete = versRequete({ debut: p.debut, fin: p.fin });
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-trait bg-surface p-3">
        <FormulaireRecherche debut={p.debut} fin={p.fin} commune={p.commune} compact />
      </div>
      <Filtres params={p} />
      <Resultats reponse={reponse} langue={locale as Langue} requete={requete} />
    </div>
  );
}
