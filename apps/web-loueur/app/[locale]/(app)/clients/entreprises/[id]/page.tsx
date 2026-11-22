"use client";

import type { Langue } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Chargement,
  Indicateur,
  Message,
  Pastille,
  Periode,
  Vide,
  formaterDate,
  formaterMontant,
  useSession,
} from "@lvb/ui";
import {
  Building2,
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { use, useState } from "react";
import { EnTete, usePeut } from "@/components/coquille";
import { type Entreprise, ModaleEntreprise } from "@/components/entreprise";
import { Link, useRouter } from "@/i18n/navigation";
import { useAction, useDonnees } from "@/lib/donnees";

type Fiche = Entreprise & {
  conducteurs: {
    utilisateurId: string;
    nom: string | null;
    telephone: string;
    locations: number;
  }[];
  historique: {
    id: string;
    code: string;
    statut: string;
    debut: string;
    fin: string;
    prixTotal: number;
    vehicule: string;
    conducteur: string | null;
    telephone: string | null;
  }[];
};

/** Fiche d'un client entreprise : informations fiscales, conducteurs et locations facturées. */
export default function FicheEntreprise({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const peut = usePeut();
  const routeur = useRouter();
  const { api, agence } = useSession();
  const action = useAction();
  const { donnees: e, erreur, recharger } = useDonnees<Fiche>(`/agence/entreprises/${id}`);
  const [edition, setEdition] = useState(false);

  if (erreur) return <Message ton="erreur">{erreur}</Message>;
  if (!e) return <Chargement />;

  const infos: [typeof Phone, string | null, boolean][] = [
    [UserRound, e.contactNom, false],
    [Phone, e.telephone, true],
    [Mail, e.email, true],
    [MapPin, e.adresse, false],
  ];
  const fiscal: [string, string | null][] = [
    ["entreprises.nif", e.nif],
    ["entreprises.nis", e.nis],
    ["entreprises.rc", e.registreCommerce],
    ["entreprises.ai", e.articleImposition],
  ];

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/clients?type=entreprises"
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-marque-700"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" /> {t("entreprises.entreprises")}
      </Link>
      <EnTete
        titre={e.raisonSociale}
        sousTitre={`${t("entreprises.delai")} : ${t("entreprises.delaiJours", { n: e.delaiPaiementJours })}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {e.listeNoire && (
              <Pastille statut="liste_noire">{t("loueur.clients.listeNoire")}</Pastille>
            )}
            {peut("reservations.creer") && (
              <>
                <Bouton variante="secondaire" icone={Pencil} onClick={() => setEdition(true)}>
                  {t("entreprises.modifier")}
                </Bouton>
                <Link
                  href={`/reservations/nouvelle?entreprise=${e.id}`}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-marque-600 px-4 text-sm font-medium text-white transition hover:bg-marque-700"
                >
                  <Plus className="size-4" /> {t("loueur.nav.nouvelleReservation")}
                </Link>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Indicateur
          libelle={t("loueur.clients.reservations")}
          valeur={e.locations ?? 0}
          icone={ClipboardList}
          ton="lavande"
        />
        <Indicateur
          libelle={t("entreprises.chiffreAffaires")}
          valeur={formaterMontant(e.chiffreAffaires ?? 0, langue)}
          icone={Wallet}
          ton="menthe"
        />
        <Indicateur
          libelle={t("entreprises.resteAPayer")}
          valeur={formaterMontant(e.resteAPayer ?? 0, langue)}
          icone={CalendarClock}
          ton={(e.resteAPayer ?? 0) > 0 ? "peche" : "neutre"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre={e.raisonSociale} icone={Building2} ton="ciel">
          <ul className="flex flex-col gap-2.5 text-sm">
            {infos
              .filter(([, v]) => v)
              .map(([Icone, v, ltr]) => (
                <li key={v} className="flex items-center gap-2.5">
                  <Icone className="size-4 shrink-0 text-attenue" />
                  <span className={ltr ? "ltr" : undefined}>{v}</span>
                </li>
              ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {fiscal.map(([cle, v]) => (
              <div key={cle} className="rounded-2xl bg-fond/70 p-3">
                <div className="text-xs text-attenue">{t(cle)}</div>
                <div className="ltr break-all text-sm font-medium">{v || "—"}</div>
              </div>
            ))}
          </div>
          {e.notesInternes && (
            <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-citron-50 p-3 text-sm text-citron-800">
              {e.notesInternes}
            </p>
          )}
        </Carte>

        <Carte titre={t("entreprises.conducteurs")} icone={Users} ton="lavande">
          {e.conducteurs.length === 0 ? (
            <Vide icone={Users}>{t("entreprises.aucunConducteur")}</Vide>
          ) : (
            <ul className="flex flex-col gap-1">
              {e.conducteurs.map((c) => (
                <li key={c.utilisateurId}>
                  <Link
                    href={`/clients/${c.utilisateurId}`}
                    className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-fond"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lavande-100 text-lavande-800">
                      <UserRound className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.nom ?? c.telephone}</div>
                      <div className="ltr truncate text-xs text-attenue">{c.telephone}</div>
                    </div>
                    <span className="shrink-0 text-sm text-attenue">
                      {t("entreprises.locations", { n: c.locations })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      <Carte titre={t("entreprises.historique")} icone={FileText} ton="marque">
        {e.historique.length === 0 ? (
          <Vide icone={ClipboardList}>{t("entreprises.locations", { n: 0 })}</Vide>
        ) : (
          <ul className="divide-y divide-trait">
            {e.historique.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reservations/${r.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-3 transition hover:bg-fond"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      <span className="ltr">{r.code}</span> · {r.vehicule}
                    </div>
                    <div className="truncate text-sm text-attenue">
                      <Periode
                        debut={formaterDate(r.debut, langue, false)}
                        fin={formaterDate(r.fin, langue, false)}
                      />
                      {r.conducteur && ` · ${r.conducteur}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums">
                      {formaterMontant(r.prixTotal, langue)}
                    </span>
                    <Pastille statut={r.statut}>{t(`statutsReservation.${r.statut}`)}</Pastille>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      {agence?.role === "gerant" && (
        <div className="flex flex-wrap gap-2">
          <Bouton
            variante={e.listeNoire ? "secondaire" : "danger"}
            chargement={action.enCours}
            onClick={() =>
              void action.executer(async () => {
                await api.patch(`/agence/entreprises/${id}`, {
                  raisonSociale: e.raisonSociale,
                  delaiPaiementJours: e.delaiPaiementJours,
                  listeNoire: !e.listeNoire,
                });
                await recharger();
              })
            }
          >
            {t(
              e.listeNoire
                ? "loueur.clients.retirerListeNoire"
                : "loueur.clients.ajouterListeNoire",
            )}
          </Bouton>
          {e.historique.length === 0 && (
            <Bouton
              variante="fantome"
              icone={Trash2}
              chargement={action.enCours}
              onClick={() =>
                void action.executer(async () => {
                  await api.delete(`/agence/entreprises/${id}`);
                  routeur.replace("/clients?type=entreprises");
                })
              }
            >
              {t("finances.depenses.supprimer")}
            </Bouton>
          )}
        </div>
      )}
      {action.erreur && <Message ton="erreur">{action.erreur}</Message>}

      <ModaleEntreprise
        ouverte={edition}
        entreprise={e}
        onFermer={() => setEdition(false)}
        onEnregistree={() => {
          setEdition(false);
          void recharger();
        }}
      />
    </div>
  );
}
