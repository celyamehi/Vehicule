"use client";

import type { Langue } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Chargement,
  Message,
  Pastille,
  Saisie,
  Vide,
  cx,
  formaterMontant,
} from "@lvb/ui";
import { Building2, ChevronRight, Plus, Search, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { EnTete, usePeut } from "@/components/coquille";
import { type Entreprise, ModaleEntreprise } from "@/components/entreprise";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useDonnees } from "@/lib/donnees";

type Client = {
  utilisateurId: string;
  nom: string | null;
  prenom: string | null;
  telephone: string;
  listeNoire: boolean;
  reservations: number;
};

const initiales = (texte: string) =>
  texte
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0])
    .join("")
    .toUpperCase();

function Particuliers({ recherche }: { recherche: string }) {
  const t = useTranslations();
  const { donnees, erreur } = useDonnees<Client[]>("/agence/clients", {
    recherche: recherche || undefined,
  });
  if (erreur) return <Message ton="erreur">{erreur}</Message>;
  if (!donnees) return <Chargement />;
  return (
    <Carte className="p-2">
      {donnees.length === 0 ? (
        <Vide icone={UserRound}>{t("commun.aucunResultat")}</Vide>
      ) : (
        <ul className="divide-y divide-trait">
          {donnees.map((c) => {
            const nom = [c.prenom, c.nom].filter(Boolean).join(" ");
            return (
              <li key={c.utilisateurId}>
                <Link
                  href={`/clients/${c.utilisateurId}`}
                  className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-fond"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lavande-100 text-xs font-semibold text-lavande-800">
                    {initiales(nom) || <UserRound className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{nom || "—"}</div>
                    <div className="ltr truncate text-sm text-attenue">{c.telephone}</div>
                  </div>
                  {c.listeNoire && (
                    <Pastille statut="liste_noire">{t("loueur.clients.listeNoire")}</Pastille>
                  )}
                  <span className="shrink-0 text-sm text-attenue">
                    {t("entreprises.locations", { n: c.reservations })}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-attenue rtl:rotate-180" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Carte>
  );
}

function Entreprises({
  recherche,
  creation,
  setCreation,
}: {
  recherche: string;
  creation: boolean;
  setCreation: (v: boolean) => void;
}) {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const routeur = useRouter();
  const { donnees, erreur } = useDonnees<Entreprise[]>("/agence/entreprises", {
    recherche: recherche || undefined,
  });
  return (
    <>
      {erreur && <Message ton="erreur">{erreur}</Message>}
      {!donnees ? (
        <Chargement />
      ) : (
        <Carte className="p-2">
          {donnees.length === 0 ? (
            <Vide icone={Building2}>{t("entreprises.aucune")}</Vide>
          ) : (
            <ul className="divide-y divide-trait">
              {donnees.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/clients/entreprises/${e.id}`}
                    className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-fond"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-ciel-100 text-ciel-800">
                      <Building2 className="size-5" strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{e.raisonSociale}</div>
                      <div className="truncate text-sm text-attenue">
                        {[
                          e.contactNom,
                          e.nif && `${t("entreprises.nif")} ${e.nif}`,
                          t("entreprises.locations", { n: e.locations ?? 0 }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    {e.listeNoire && (
                      <Pastille statut="liste_noire">{t("loueur.clients.listeNoire")}</Pastille>
                    )}
                    <div className="hidden shrink-0 text-end sm:block">
                      <div className="font-semibold tabular-nums">
                        {formaterMontant(e.chiffreAffaires ?? 0, langue)}
                      </div>
                      {(e.resteAPayer ?? 0) > 0 && (
                        <div className="text-xs font-medium text-peche-800">
                          {t("entreprises.resteAPayer")} :{" "}
                          {formaterMontant(e.resteAPayer ?? 0, langue)}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-attenue rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      )}
      <ModaleEntreprise
        ouverte={creation}
        onFermer={() => setCreation(false)}
        onEnregistree={(e) => {
          setCreation(false);
          routeur.push(`/clients/entreprises/${e.id}`);
        }}
      />
    </>
  );
}

/** Clients de l'agence : particuliers (conducteurs) et entreprises (facturées à leur nom). */
function PageClients() {
  const t = useTranslations();
  const peut = usePeut();
  const routeur = useRouter();
  const chemin = usePathname();
  const sp = useSearchParams();
  const onglet = sp.get("type") === "entreprises" ? "entreprises" : "particuliers";
  const [recherche, setRecherche] = useState("");
  const [creation, setCreation] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <EnTete
        titre={t("loueur.clients.titre")}
        actions={
          onglet === "entreprises" &&
          peut("reservations.creer") && (
            <Bouton icone={Plus} onClick={() => setCreation(true)}>
              {t("entreprises.ajouter")}
            </Bouton>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          className="inline-flex gap-1 rounded-full bg-champ p-1 text-sm font-medium"
        >
          {(
            [
              ["particuliers", UserRound],
              ["entreprises", Building2],
            ] as const
          ).map(([o, Icone]) => (
            <button
              key={o}
              type="button"
              role="tab"
              aria-selected={o === onglet}
              onClick={() => {
                setRecherche("");
                routeur.replace(o === "entreprises" ? `${chemin}?type=entreprises` : chemin);
              }}
              className={cx(
                "inline-flex items-center gap-2 rounded-full px-4 py-1.5 transition",
                o === onglet
                  ? "bg-surface text-encre shadow-[var(--shadow-douce)]"
                  : "text-attenue hover:text-encre",
              )}
            >
              <Icone className="size-4" strokeWidth={1.9} />
              {t(`entreprises.${o}`)}
            </button>
          ))}
        </div>
        <label className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-attenue" />
          <Saisie
            className="ps-9"
            placeholder={
              onglet === "entreprises" ? t("entreprises.rechercher") : t("ui.rechercherPlaceholder")
            }
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </label>
      </div>
      {onglet === "entreprises" ? (
        <Entreprises recherche={recherche} creation={creation} setCreation={setCreation} />
      ) : (
        <Particuliers recherche={recherche} />
      )}
    </div>
  );
}

export default function Clients() {
  return (
    <Suspense fallback={<Chargement />}>
      <PageClients />
    </Suspense>
  );
}
