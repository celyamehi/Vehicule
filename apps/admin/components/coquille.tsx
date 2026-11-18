"use client";

import {
  Bouton,
  Carte,
  Chargement,
  ConnexionOtp,
  Message,
  SelecteurLangue,
  cx,
  useSession,
} from "@lvb/ui";
import {
  ChartNoAxesColumn,
  ClipboardList,
  FileCheck2,
  LogOut,
  MessageSquareQuote,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

const LIENS = [
  ["/indicateurs", "tableau", ChartNoAxesColumn],
  ["/agences", "agences", Store],
  ["/reservations", "reservations", ClipboardList],
  ["/documents", "documents", FileCheck2],
  ["/avis", "avis", MessageSquareQuote],
  ["/utilisateurs", "utilisateurs", Users],
] as const;

/** Back-office : réservé aux administrateurs de la plateforme. */
export function Coquille({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const { pret, profil, deconnecter } = useSession();
  const chemin = usePathname();
  const routeur = useRouter();
  if (!pret) return <Chargement />;
  if (!profil)
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-4">
        <Carte>
          <ConnexionOtp />
        </Carte>
      </main>
    );
  if (!profil.admin)
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 p-4">
        <Message ton="erreur">{t("ui.accesRefuse")}</Message>
        <Bouton variante="secondaire" onClick={() => void deconnecter()}>
          {t("commun.deconnexion")}
        </Bouton>
      </main>
    );
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="verre sticky top-0 z-30 border-b border-black/5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="flex items-center gap-2.5 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-[0.9rem] bg-lavande-100 text-lavande-800">
              <ShieldCheck className="size-5" strokeWidth={1.9} />
            </span>
            {t("commun.nomPlateforme")}
          </span>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {LIENS.map(([href, cle, Icone]) => (
              <Link
                key={href}
                href={href}
                className={cx(
                  "flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                  chemin.startsWith(href)
                    ? "bg-marque-600 text-white"
                    : "text-encre/75 hover:bg-black/[0.04]",
                )}
              >
                <Icone className="size-4" strokeWidth={1.9} />
                {t(`admin.nav.${cle}`)}
              </Link>
            ))}
          </nav>
          <SelecteurLangue onChanger={(l) => routeur.replace(chemin, { locale: l })} />
          <button
            type="button"
            className="rounded-full bg-champ p-2 text-attenue hover:text-encre"
            aria-label={t("commun.deconnexion")}
            onClick={() => void deconnecter()}
          >
            <LogOut className="size-4" strokeWidth={2} />
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
