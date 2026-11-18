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
  CalendarRange,
  CarFront,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Settings,
  ShieldAlert,
  Star,
  Store,
  Tags,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { BandeauxAlertes, FournisseurAlertes, useDemandesEnAttente } from "@/components/alertes";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

const LIENS: readonly (readonly [string, string, LucideIcon])[] = [
  ["/tableau-de-bord", "tableauDeBord", LayoutDashboard],
  ["/planning", "planning", CalendarRange],
  ["/reservations", "reservations", ClipboardList],
  ["/reservations/nouvelle", "nouvelleReservation", PlusCircle],
  ["/flotte", "flotte", CarFront],
  ["/entretien", "entretien", Wrench],
  ["/amendes", "amendes", ShieldAlert],
  ["/avis", "avis", Star],
  ["/ma-page", "pageAgence", Store],
  ["/tarifs", "tarifs", Tags],
  ["/clients", "clients", Users],
  ["/equipe", "equipe", UserCog],
  ["/parametres", "parametres", Settings],
];

/** Écran d'accueil non connecté : carte centrée sur fond pastel. */
function Accueil({ children }: { children: ReactNode }) {
  const routeur = useRouter();
  const chemin = usePathname();
  const t = useTranslations();
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden p-4">
      <div
        className="pointer-events-none absolute -start-32 -top-32 size-96 rounded-full bg-marque-200/60 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 -end-24 size-[28rem] rounded-full bg-peche-100 blur-3xl"
        aria-hidden
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-marque-600 text-white shadow-[0_8px_20px_-8px_rgb(76_93_228/0.8)]">
            <CarFront className="size-6" strokeWidth={1.9} />
          </span>
          <span className="text-lg font-semibold">{t("commun.nomPlateforme")}</span>
        </div>
        <Carte>{children}</Carte>
        <div className="mt-5 flex justify-center">
          <SelecteurLangue onChanger={(l) => routeur.replace(chemin, { locale: l })} />
        </div>
      </div>
    </main>
  );
}

/** Cadre du logiciel loueur : connexion, choix de l'agence, navigation, bandeaux de statut. */
export function Coquille({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const { pret, profil, agence, agenceId, choisirAgence, deconnecter } = useSession();
  const chemin = usePathname();
  const routeur = useRouter();
  const surInscription = chemin.startsWith("/inscription");

  if (!pret) return <Chargement />;
  if (!profil)
    return (
      <Accueil>
        <ConnexionOtp avecConsentement />
      </Accueil>
    );

  if (!surInscription && profil.agences.length === 0)
    return (
      <Accueil>
        <div className="flex flex-col gap-4">
          <Message ton="info">{t("loueur.inscription.aucuneAgence")}</Message>
          <Link
            href="/inscription"
            className="flex h-11 items-center justify-center rounded-full bg-marque-600 font-medium text-white"
          >
            {t("loueur.inscription.titre")}
          </Link>
          <Bouton variante="fantome" icone={LogOut} onClick={() => void deconnecter()}>
            {t("commun.deconnexion")}
          </Bouton>
        </div>
      </Accueil>
    );

  if (!surInscription && !agenceId)
    return (
      <Accueil>
        <div className="flex flex-col gap-3">
          <h1 className="text-lg font-semibold">{t("loueur.inscription.choisirAgence")}</h1>
          {profil.agences.map((a) => (
            <Bouton key={a.id} variante="secondaire" onClick={() => choisirAgence(a.id)}>
              {a.raisonSociale}
            </Bouton>
          ))}
        </div>
      </Accueil>
    );

  const initiales = (profil.prenom?.[0] ?? "") + (profil.nom?.[0] ?? "") || "•";

  return (
    <FournisseurAlertes>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <aside className="verre sticky top-0 z-30 border-b border-black/5 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-e lg:bg-surface/60">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:flex-col lg:items-stretch lg:px-5 lg:pt-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-marque-600 text-white shadow-[0_8px_20px_-10px_rgb(76_93_228/0.9)]">
                <CarFront className="size-5" strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">
                  {agence?.raisonSociale ?? t("commun.nomPlateforme")}
                </div>
                <div className="flex items-center gap-1.5 truncate text-xs text-attenue">
                  <span className="inline-flex size-4 items-center justify-center rounded-full bg-lavande-100 text-[9px] font-semibold uppercase text-lavande-800">
                    {initiales}
                  </span>
                  {[profil.prenom, profil.nom].filter(Boolean).join(" ") || (
                    <span className="ltr">{profil.telephone}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:mt-2">
              <SelecteurLangue onChanger={(l) => routeur.replace(chemin, { locale: l })} />
              {profil.agences.length > 1 && (
                <select
                  aria-label={t("loueur.inscription.choisirAgence")}
                  className="h-9 max-w-36 rounded-full bg-champ px-3 text-sm"
                  value={agenceId ?? ""}
                  onChange={(e) => {
                    choisirAgence(e.target.value);
                    window.location.reload();
                  }}
                >
                  {profil.agences.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.raisonSociale}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-3 lg:pt-4">
            {LIENS.map(([href, cle, Icone]) => {
              const actif =
                href === "/reservations"
                  ? chemin === href || /^\/reservations\/(?!nouvelle)/.test(chemin)
                  : chemin.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={actif ? "page" : undefined}
                  className={cx(
                    "group flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition",
                    actif
                      ? "bg-marque-600 text-white shadow-[0_6px_16px_-8px_rgb(76_93_228/0.9)]"
                      : "text-encre/80 hover:bg-black/[0.04] hover:text-encre",
                  )}
                >
                  <Icone
                    className={cx(
                      "size-[18px]",
                      actif ? "text-white" : "text-attenue group-hover:text-encre",
                    )}
                    strokeWidth={1.9}
                  />
                  <span>{t(`loueur.nav.${cle}`)}</span>
                  {href === "/reservations" && <CompteurDemandes actif={actif} />}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => void deconnecter()}
              className="flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-start text-sm font-medium text-attenue transition hover:bg-black/[0.04] lg:mt-4"
            >
              <LogOut className="size-[18px]" strokeWidth={1.9} />
              {t("commun.deconnexion")}
            </button>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-6xl">
            {agence?.statut === "en_attente" && (
              <div className="mb-4">
                <Message ton="alerte">{t("loueur.inscription.enAttente")}</Message>
              </div>
            )}
            {agence?.statut === "suspendue" && (
              <div className="mb-4">
                <Message ton="erreur">{t("loueur.inscription.suspendue")}</Message>
              </div>
            )}
            <BandeauxAlertes />
            {children}
          </div>
        </main>
      </div>
    </FournisseurAlertes>
  );
}

/** Pastille du nombre de demandes en ligne à confirmer, dans le menu. */
function CompteurDemandes({ actif }: { actif: boolean }) {
  const n = useDemandesEnAttente();
  if (!n) return null;
  return (
    <span
      className={cx(
        "ms-auto inline-flex min-w-5 justify-center rounded-full px-1.5 text-xs font-semibold",
        actif ? "bg-white/25 text-white" : "bg-peche-100 text-peche-800",
      )}
    >
      {n}
    </span>
  );
}

/** Titre de page avec sous-titre et actions. */
export function EnTete({
  titre,
  sousTitre,
  actions,
}: {
  titre: ReactNode;
  sousTitre?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{titre}</h1>
        {sousTitre && <p className="mt-1 text-[15px] text-attenue">{sousTitre}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Lien en forme de bouton (pilule). */
export function LienBouton({
  href,
  icone: Icone,
  children,
}: {
  href: string;
  icone?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-marque-600 px-5 text-[15px] font-medium text-white shadow-[0_6px_16px_-6px_rgb(76_93_228/0.6)] transition hover:bg-marque-700 active:scale-[0.97]"
    >
      {Icone && <Icone className="size-[18px]" strokeWidth={2} />}
      {children}
    </Link>
  );
}

/** Le gérant a tous les droits ; un employé seulement ceux accordés. */
export function usePeut() {
  const { agence } = useSession();
  return (permission: string) =>
    agence?.role === "gerant" || (agence?.permissions ?? []).includes(permission);
}
