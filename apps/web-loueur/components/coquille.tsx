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
import { BandeauxAlertes, FournisseurAlertes, useDemandesEnAttente } from "@/components/alertes";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

const LIENS = [
  ["/tableau-de-bord", "tableauDeBord"],
  ["/planning", "planning"],
  ["/reservations", "reservations"],
  ["/reservations/nouvelle", "nouvelleReservation"],
  ["/flotte", "flotte"],
  ["/tarifs", "tarifs"],
  ["/clients", "clients"],
  ["/equipe", "equipe"],
  ["/parametres", "parametres"],
] as const;

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
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-4">
        <Carte>
          <ConnexionOtp avecConsentement />
        </Carte>
        <div className="mt-4 flex justify-center">
          <SelecteurLangue onChanger={(l) => routeur.replace(chemin, { locale: l })} />
        </div>
      </main>
    );

  if (!surInscription && profil.agences.length === 0)
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
        <Message ton="info">{t("loueur.inscription.aucuneAgence")}</Message>
        <Link
          href="/inscription"
          className="rounded-lg bg-marque-600 px-4 py-2.5 text-center font-medium text-white"
        >
          {t("loueur.inscription.titre")}
        </Link>
        <Bouton variante="fantome" onClick={() => void deconnecter()}>
          {t("commun.deconnexion")}
        </Bouton>
      </main>
    );

  if (!surInscription && !agenceId)
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-4">
        <h1 className="text-lg font-semibold">{t("loueur.inscription.choisirAgence")}</h1>
        {profil.agences.map((a) => (
          <Bouton key={a.id} variante="secondaire" onClick={() => choisirAgence(a.id)}>
            {a.raisonSociale}
          </Bouton>
        ))}
      </main>
    );

  return (
    <FournisseurAlertes>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <aside className="border-b border-trait bg-surface lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-e">
          <div className="flex items-center justify-between gap-2 p-3 lg:block">
            <div className="min-w-0">
              <div className="truncate font-semibold text-marque-900">
                {agence?.raisonSociale ?? t("commun.nomPlateforme")}
              </div>
              <div className="truncate text-xs text-attenue">
                {[profil.prenom, profil.nom].filter(Boolean).join(" ") || (
                  <span className="ltr">{profil.telephone}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 lg:mt-3">
              <SelecteurLangue onChanger={(l) => routeur.replace(chemin, { locale: l })} />
              {profil.agences.length > 1 && (
                <select
                  aria-label={t("loueur.inscription.choisirAgence")}
                  className="max-w-32 rounded-md border border-trait px-1 py-1 text-sm"
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
          <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible lg:pb-4">
            {LIENS.map(([href, cle]) => {
              const actif =
                href === "/reservations"
                  ? chemin === href || /^\/reservations\/(?!nouvelle)/.test(chemin)
                  : chemin.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cx(
                    "whitespace-nowrap rounded-lg px-3 py-2 text-sm",
                    actif
                      ? "bg-marque-50 font-semibold text-marque-700"
                      : "text-encre hover:bg-fond",
                  )}
                >
                  {t(`loueur.nav.${cle}`)}
                  {href === "/reservations" && <CompteurDemandes />}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => void deconnecter()}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-start text-sm text-attenue hover:bg-fond"
            >
              {t("commun.deconnexion")}
            </button>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 p-3 sm:p-5">
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
        </main>
      </div>
    </FournisseurAlertes>
  );
}

/** Pastille du nombre de demandes en ligne à confirmer, dans le menu. */
function CompteurDemandes() {
  const n = useDemandesEnAttente();
  if (!n) return null;
  return (
    <span className="ms-2 inline-flex min-w-5 justify-center rounded-full bg-amber-400 px-1.5 text-xs font-bold text-amber-950">
      {n}
    </span>
  );
}

/** Titre de page avec actions. */
export function EnTete({ titre, actions }: { titre: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold">{titre}</h1>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Le gérant a tous les droits ; un employé seulement ceux accordés. */
export function usePeut() {
  const { agence } = useSession();
  return (permission: string) =>
    agence?.role === "gerant" || (agence?.permissions ?? []).includes(permission);
}
