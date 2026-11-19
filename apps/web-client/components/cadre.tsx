"use client";

import { SelecteurLangue, useSession } from "@lvb/ui";
import { CarFront, CircleUserRound, ShieldCheck, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { URL_ADMIN, URL_LOUEUR } from "@/lib/config";
import { VILLES } from "@/lib/recherche";

function Langue() {
  const chemin = usePathname();
  const routeur = useRouter();
  const sp = useSearchParams();
  return (
    <SelecteurLangue
      onChanger={(l) => routeur.replace(`${chemin}${sp.size ? `?${sp}` : ""}`, { locale: l })}
    />
  );
}

export function Logo() {
  const t = useTranslations();
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-[0.9rem] bg-marque-600 text-white shadow-[0_6px_16px_-8px_rgb(76_93_228/0.9)]">
        <CarFront className="size-5" strokeWidth={1.9} />
      </span>
      <span className="text-[17px] font-semibold tracking-tight">{t("commun.nomPlateforme")}</span>
    </span>
  );
}

export function EnTeteSite() {
  const t = useTranslations();
  const langue = useLocale();
  const { profil } = useSession();
  return (
    <header className="verre sticky top-0 z-40 border-b border-black/5">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label={t("commun.nomPlateforme")}>
          <Logo />
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Suspense>
            <Langue />
          </Suspense>
          {profil?.admin && (
            <a
              href={URL_ADMIN}
              className="hidden h-9 items-center gap-2 rounded-full bg-champ px-3 font-medium sm:inline-flex"
            >
              <ShieldCheck className="size-4" strokeWidth={2} />
              {t("ui.espaceAdmin")}
            </a>
          )}
          {profil && profil.agences.length > 0 && (
            <a
              href={`${URL_LOUEUR}/${langue}`}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-lavande-100 px-3 font-medium text-lavande-800 transition hover:bg-lavande-50"
            >
              <Store className="size-4" strokeWidth={2} />
              <span className="hidden sm:inline">{t("ui.espaceAgence")}</span>
            </a>
          )}
          <Link
            href={profil ? "/compte" : "/connexion"}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-encre px-4 font-medium text-white transition hover:bg-black active:scale-[0.97]"
          >
            <CircleUserRound className="size-4" strokeWidth={2} />
            <span className="hidden sm:inline">
              {profil ? t("client.mesReservations.titre") : t("commun.connexion")}
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PiedSite() {
  const t = useTranslations();
  const langue = useLocale();
  return (
    <footer className="mt-16 border-t border-black/5 bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-[1.4fr_1fr] sm:px-6">
        <div>
          <div className="mb-3 font-semibold">{t("client.accueil.villes")}</div>
          <ul className="flex flex-wrap gap-2">
            {VILLES.map((v) => (
              <li key={v.slug}>
                <Link
                  href={`/location-voiture/${v.slug}`}
                  className="inline-block rounded-full bg-champ px-3 py-1.5 text-attenue transition hover:bg-marque-50 hover:text-marque-700"
                >
                  {t("client.seo.titreVille", { ville: v.commune })}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <Logo />
          <a
            href={`${URL_LOUEUR}/${langue}/inscription`}
            className="inline-flex items-center gap-2 rounded-full bg-lavande-100 px-4 py-2 font-medium text-lavande-800 transition hover:bg-lavande-50"
          >
            <Store className="size-4" strokeWidth={2} />
            {t("client.pied.agences")}
          </a>
          <span className="text-attenue">{t("client.pied.confidentialite")}</span>
        </div>
      </div>
    </footer>
  );
}
