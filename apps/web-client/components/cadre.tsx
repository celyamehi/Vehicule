"use client";

import { SelecteurLangue, useSession } from "@lvb/ui";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
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

export function EnTeteSite() {
  const t = useTranslations();
  const { profil } = useSession();
  return (
    <header className="sticky top-0 z-40 border-b border-trait bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
        <Link href="/" className="text-lg font-bold text-marque-700">
          {t("commun.nomPlateforme")}
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Suspense>
            <Langue />
          </Suspense>
          <Link
            href={profil ? "/compte" : "/connexion"}
            className="rounded-lg bg-marque-600 px-3 py-1.5 font-medium text-white"
          >
            {profil ? t("client.mesReservations.titre") : t("commun.connexion")}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PiedSite() {
  const t = useTranslations();
  return (
    <footer className="mt-8 border-t border-trait bg-surface">
      <div className="mx-auto grid max-w-6xl gap-4 px-3 py-6 text-sm sm:grid-cols-2 sm:px-5">
        <div>
          <div className="mb-2 font-semibold">{t("client.accueil.villes")}</div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {VILLES.map((v) => (
              <li key={v.slug}>
                <Link
                  href={`/location-voiture/${v.slug}`}
                  className="text-marque-700 hover:underline"
                >
                  {t("client.seo.titreVille", { ville: v.commune })}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <a
            href={process.env.NEXT_PUBLIC_URL_LOUEUR ?? "http://localhost:3001"}
            className="text-marque-700 hover:underline"
          >
            {t("client.pied.agences")}
          </a>
          <span className="text-attenue">{t("client.pied.confidentialite")}</span>
        </div>
      </div>
    </footer>
  );
}
