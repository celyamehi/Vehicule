import { type Langue, WILAYA_BEJAIA, nomWilaya } from "@lvb/shared";
import { BadgeCheck, MapPin, ReceiptText, Timer } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FormulaireRecherche } from "@/components/formulaire-recherche";
import { Link } from "@/i18n/navigation";
import { VILLES, datesParDefaut } from "@/lib/recherche";

export const dynamic = "force-dynamic";

const ATOUTS = [
  ["atoutPrix", "atoutPrixTexte", ReceiptText, "bg-menthe-100 text-menthe-800"],
  ["atoutAgences", "atoutAgencesTexte", BadgeCheck, "bg-ciel-100 text-ciel-800"],
  ["atoutRapide", "atoutRapideTexte", Timer, "bg-peche-100 text-peche-800"],
] as const;

export default async function Accueil({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const dates = datesParDefaut();
  return (
    <div className="flex flex-col gap-14">
      <section className="relative -mx-4 overflow-hidden px-4 pb-4 pt-10 sm:mx-0 sm:rounded-[2.25rem] sm:px-10 sm:pb-10 sm:pt-16">
        {/* Fond pastel : halos flous, sans image (léger en 3G). */}
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-br from-marque-50 via-lavande-50 to-peche-50"
          aria-hidden
        />
        <div
          className="absolute -start-24 -top-24 -z-10 size-80 rounded-full bg-marque-200/70 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -end-20 top-10 -z-10 size-72 rounded-full bg-peche-100 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute bottom-0 start-1/3 -z-10 size-64 rounded-full bg-menthe-100 blur-3xl"
          aria-hidden
        />

        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-3 py-1 text-xs font-medium text-marque-700 shadow-sm ring-1 ring-black/5">
            <MapPin className="size-3.5" strokeWidth={2} />
            {nomWilaya(WILAYA_BEJAIA, locale as Langue)}
          </span>
          <h1 className="text-balance text-[34px] font-semibold leading-[1.08] tracking-tight sm:text-[56px]">
            {t("client.accueil.titre")}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-[17px] text-attenue sm:text-lg">
            {t("client.accueil.sousTitre")}
          </p>
        </div>
        <div className="mx-auto mt-9 max-w-4xl">
          <FormulaireRecherche debut={dates.debut} fin={dates.fin} />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {ATOUTS.map(([titre, texte, Icone, couleurs]) => (
          <div
            key={titre}
            className="rounded-[var(--radius-carte)] bg-surface p-6 shadow-[var(--shadow-douce)]"
          >
            <span
              className={`mb-4 inline-flex size-12 items-center justify-center rounded-2xl ${couleurs}`}
            >
              <Icone className="size-6" strokeWidth={1.8} />
            </span>
            <h2 className="mb-1.5 text-[17px] font-semibold">{t(`client.accueil.${titre}`)}</h2>
            <p className="text-[15px] leading-relaxed text-attenue">
              {t(`client.accueil.${texte}`)}
            </p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-4 text-[22px] font-semibold tracking-tight">
          {t("client.accueil.villes")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {VILLES.map((v) => (
            <Link
              key={v.slug}
              href={`/location-voiture/${v.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-[15px] font-medium shadow-[var(--shadow-douce)] transition hover:-translate-y-0.5 hover:text-marque-700"
            >
              <MapPin className="size-4 text-marque-500" strokeWidth={2} />
              {v.commune}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
