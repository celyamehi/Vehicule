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
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

const LIENS = [
  ["/indicateurs", "tableau"],
  ["/agences", "agences"],
  ["/reservations", "reservations"],
  ["/documents", "documents"],
  ["/utilisateurs", "utilisateurs"],
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
      <header className="border-b border-trait bg-marque-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-3 py-2">
          <span className="font-semibold">{t("commun.nomPlateforme")} — Admin</span>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {LIENS.map(([href, cle]) => (
              <Link
                key={href}
                href={href}
                className={cx(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
                  chemin.startsWith(href) ? "bg-white/15 font-semibold" : "hover:bg-white/10",
                )}
              >
                {t(`admin.nav.${cle}`)}
              </Link>
            ))}
          </nav>
          <div className="text-encre">
            <SelecteurLangue onChanger={(l) => routeur.replace(chemin, { locale: l })} />
          </div>
          <button type="button" className="text-sm underline" onClick={() => void deconnecter()}>
            {t("commun.deconnexion")}
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 p-3 sm:p-5">{children}</main>
    </div>
  );
}
