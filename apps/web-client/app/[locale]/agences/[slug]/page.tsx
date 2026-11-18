import { type Langue, nomWilaya } from "@lvb/shared";
import { formaterMontant } from "@lvb/ui";
import {
  BadgeCheck,
  CarFront,
  Clock,
  Fuel,
  MapPin,
  MessageCircle,
  Phone,
  Settings2,
  Users,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AvisAgence, EtoilesServeur } from "@/components/avis-agence";
import { FormulaireRecherche } from "@/components/formulaire-recherche";
import { Resultats } from "@/components/resultats";
import { Link } from "@/i18n/navigation";
import { type ReponseRecherche, datesParDefaut, versRequete } from "@/lib/recherche";
import { apiServeur } from "@/lib/serveur";

type PageAgence = {
  id: string;
  slug: string;
  raisonSociale: string;
  adresse: string;
  wilaya: number;
  telephone: string;
  logo: string | null;
  photo: string | null;
  politiqueAnnulation: "souple" | "moderee" | "stricte";
  confirmationInstantanee: boolean;
  noteMoyenne: number | null;
  nombreAvis: number;
  points: {
    id: string;
    nom: string;
    adresse: string;
    commune: string;
    horaires: Record<string, [string, string][]>;
  }[];
  vehicules: {
    id: string;
    marque: string;
    modele: string;
    annee: number;
    categorie: string;
    boite: string;
    carburant: string;
    places: number;
    photo: string | null;
    prixJour: number | null;
  }[];
};

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export const revalidate = 120;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const a = await apiServeur<PageAgence>(`/agences/page/${slug}`, locale, 120);
  if (!a) return {};
  const t = await getTranslations({ locale });
  return {
    title: `${a.raisonSociale} — ${t("client.seo.titreVille", { ville: nomWilaya(a.wilaya, locale as Langue) })}`,
    description: `${a.raisonSociale} · ${a.adresse} · ${t("pageAgence.vehicules")} : ${a.vehicules.length}`,
    openGraph:
      a.photo || a.vehicules[0]?.photo
        ? { images: [(a.photo ?? a.vehicules[0]!.photo)!] }
        : undefined,
  };
}

/** Page publique d'une agence : vitrine à partager, réservations directes dans le logiciel. */
export default async function PageAgencePublique({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const langue = locale as Langue;
  const sp = await searchParams;
  const a = await apiServeur<PageAgence>(`/agences/page/${slug}`, locale, 120);
  if (!a) notFound();
  const t = await getTranslations();
  const dates = { debut: sp.debut ?? datesParDefaut().debut, fin: sp.fin ?? datesParDefaut().fin };
  // Avec des dates choisies, on affiche la disponibilité réelle et le prix total.
  const recherche = sp.debut
    ? await apiServeur<ReponseRecherche>(
        `/recherche?${versRequete({ agenceId: a.id, ...dates, parPage: "50" })}`,
        locale,
      )
    : null;
  const telephone = a.telephone.replace(/\D/g, "");

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-marque-50 via-lavande-50 to-menthe-50 p-6 sm:p-10">
        <div
          className="absolute -end-16 -top-16 size-64 rounded-full bg-marque-200/50 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.5rem] bg-surface shadow-[var(--shadow-douce)]">
            {a.logo ? (
              <img src={a.logo} alt="" className="size-full object-contain p-2" />
            ) : (
              <CarFront className="size-9 text-marque-500" strokeWidth={1.5} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-4xl">
              {a.raisonSociale}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-attenue">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" strokeWidth={1.9} />
                {a.adresse}, {nomWilaya(a.wilaya, langue)}
              </span>
              <span className="inline-flex items-center gap-1 text-menthe-800">
                <BadgeCheck className="size-4" strokeWidth={2} />
                {t("client.accueil.atoutAgences")}
              </span>
              {a.noteMoyenne !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <EtoilesServeur
                    note={a.noteMoyenne}
                    label={t("avis.etoiles", { n: a.noteMoyenne })}
                  />
                  {a.noteMoyenne} · {t("avis.nombre", { n: a.nombreAvis })}
                </span>
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {a.confirmationInstantanee && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface/80 px-3 py-1 font-medium text-marque-700">
                  <Zap className="size-3.5" strokeWidth={2} />
                  {t("client.fiche.confirmationInstantanee")}
                </span>
              )}
              <span className="rounded-full bg-surface/80 px-3 py-1 font-medium">
                {t(`politiques.${a.politiqueAnnulation}`)}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={`tel:${a.telephone}`}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-surface px-4 font-medium shadow-[var(--shadow-douce)]"
            >
              <Phone className="size-4" strokeWidth={2} />
              {t("commun.appeler")}
            </a>
            <a
              href={`https://wa.me/${telephone}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-menthe-800 px-4 font-medium text-white"
            >
              <MessageCircle className="size-4" strokeWidth={2} />
              {t("commun.whatsapp")}
            </a>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-[22px] font-semibold tracking-tight">{t("pageAgence.vehicules")}</h2>
        <FormulaireRecherche
          debut={dates.debut}
          fin={dates.fin}
          compact
          cible={`/agences/${a.slug}`}
        />
        {recherche ? (
          <Resultats reponse={recherche} langue={langue} requete={versRequete(dates)} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {a.vehicules.map((v) => (
              <Link
                key={v.id}
                href={`/vehicules/${v.id}`}
                className="group overflow-hidden rounded-[var(--radius-carte)] bg-surface shadow-[var(--shadow-douce)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-relief)]"
              >
                <div className="flex aspect-[16/10] items-center justify-center overflow-hidden bg-gradient-to-br from-marque-50 to-lavande-50">
                  {v.photo ? (
                    <img
                      src={v.photo}
                      alt={`${v.marque} ${v.modele}`}
                      className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  ) : (
                    <CarFront className="size-12 text-marque-300" strokeWidth={1.3} />
                  )}
                </div>
                <div className="p-4">
                  <div className="font-semibold">
                    {v.marque} {v.modele}{" "}
                    <span className="font-normal text-attenue">{v.annee}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-attenue">
                    <span className="inline-flex items-center gap-1">
                      <Settings2 className="size-3.5" />
                      {t(`boites.${v.boite}`)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Fuel className="size-3.5" />
                      {t(`carburants.${v.carburant}`)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" />
                      {t("client.fiche.places", { n: v.places })}
                    </span>
                  </div>
                  {v.prixJour !== null && (
                    <div className="mt-3 text-lg font-semibold">
                      {formaterMontant(v.prixJour, langue)}{" "}
                      <span className="text-sm font-normal text-attenue">
                        {t("client.recherche.parJour")}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <AvisAgence agenceId={a.id} langue={langue} />

      <section className="grid gap-3 sm:grid-cols-2">
        {a.points.map((p) => (
          <div
            key={p.id}
            className="rounded-[var(--radius-carte)] bg-surface p-5 text-sm shadow-[var(--shadow-douce)]"
          >
            <div className="flex items-center gap-2 font-semibold">
              <MapPin className="size-4 text-marque-500" strokeWidth={2} />
              {p.nom}
            </div>
            <p className="mt-1 text-attenue">
              {p.adresse} — {p.commune}
            </p>
            {Object.keys(p.horaires).length > 0 && (
              <ul className="mt-3 flex flex-col gap-0.5 text-xs text-attenue">
                <li className="mb-1 flex items-center gap-1 font-medium text-encre">
                  <Clock className="size-3.5" />
                  {t("pageAgence.horaires")}
                </li>
                {Object.entries(p.horaires).map(([j, plages]) => (
                  <li key={j}>
                    {t(`jours.${j}`)} :{" "}
                    <span className="ltr">{plages.map((x) => x.join("–")).join(", ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
