"use client";

import type { Langue } from "@lvb/shared";
import {
  Chargement,
  Message,
  Pastille,
  Periode,
  cx,
  formaterDate,
  formaterMontant,
  useMessageErreur,
  useSession,
} from "@lvb/ui";
import { ChevronRight, MessageCircle, NotebookPen, Phone, UserRound, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

type Fiche = {
  utilisateurId: string;
  nom: string | null;
  prenom: string | null;
  telephone: string;
  dateNaissance: string | null;
  notesInternes: string | null;
  listeNoire: boolean;
  motifListeNoire: string | null;
  historique: {
    id: string;
    code: string;
    statut: string;
    debut: string;
    fin: string;
    prixTotal: number;
    origine: string;
  }[];
};

/**
 * Profil du client en panneau latéral (comme sur une messagerie) : contact, notes internes,
 * liste noire et toutes ses réservations avec l'agence.
 */
export function ProfilClient({
  clientId,
  onFermer,
}: {
  clientId: string | null;
  onFermer: () => void;
}) {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { api } = useSession();
  const messageErreur = useMessageErreur();
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setFiche(null);
    setErreur(null);
    if (!clientId) return;
    api
      .get<Fiche>(`/agence/clients/${clientId}`)
      .then(setFiche)
      .catch((e) => setErreur(messageErreur(e)));
  }, [api, clientId]); // messageErreur change à chaque rendu

  if (!clientId) return null;
  const nom = fiche ? [fiche.prenom, fiche.nom].filter(Boolean).join(" ") || fiche.telephone : "";
  const total =
    fiche?.historique
      .filter((r) => ["confirmee", "en_cours", "terminee"].includes(r.statut))
      .reduce((s, r) => s + r.prixTotal, 0) ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[rgb(29_29_31/0.2)] backdrop-blur-[2px]"
      onClick={onFermer}
      role="presentation"
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("messagerie.profil")}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface shadow-[var(--shadow-relief)] sm:rounded-s-[1.75rem]"
      >
        <div className="flex items-center justify-between p-4">
          <span className="text-sm font-medium text-attenue">{t("messagerie.profil")}</span>
          <button
            type="button"
            onClick={onFermer}
            className="rounded-full bg-champ p-1.5 text-attenue hover:text-encre"
            aria-label={t("commun.fermer")}
          >
            <X className="size-4" strokeWidth={2.4} />
          </button>
        </div>
        {erreur && (
          <div className="px-4">
            <Message ton="erreur">{erreur}</Message>
          </div>
        )}
        {!fiche && !erreur && <Chargement />}
        {fiche && (
          <div className="flex flex-col gap-5 px-5 pb-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="flex size-20 items-center justify-center rounded-full bg-lavande-100 text-2xl font-semibold uppercase text-lavande-800">
                {(fiche.prenom?.[0] ?? "") + (fiche.nom?.[0] ?? "") || (
                  <UserRound className="size-8" />
                )}
              </span>
              <h2 className="text-xl font-semibold">{nom}</h2>
              <span className="ltr text-sm text-attenue">{fiche.telephone}</span>
              {fiche.listeNoire && (
                <Pastille statut="liste_noire">{t("loueur.clients.listeNoire")}</Pastille>
              )}
              <div className="mt-1 flex gap-2">
                <a
                  href={`tel:${fiche.telephone}`}
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-champ px-4 text-sm font-medium"
                >
                  <Phone className="size-4" /> {t("commun.appeler")}
                </a>
                <a
                  href={`https://wa.me/${fiche.telephone.replace("+", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-menthe-100 px-4 text-sm font-medium text-menthe-800"
                >
                  <MessageCircle className="size-4" /> {t("commun.whatsapp")}
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-fond/70 p-3">
                <div className="text-xs text-attenue">{t("loueur.clients.reservations")}</div>
                <div className="text-xl font-semibold tabular-nums">{fiche.historique.length}</div>
              </div>
              <div className="rounded-2xl bg-fond/70 p-3">
                <div className="text-xs text-attenue">{t("commun.total")}</div>
                <div className="text-xl font-semibold tabular-nums">
                  {formaterMontant(total, langue)}
                </div>
              </div>
            </div>

            {(fiche.notesInternes || fiche.motifListeNoire || fiche.dateNaissance) && (
              <div className="rounded-2xl bg-citron-50 p-3 text-sm text-citron-800">
                <div className="mb-1 flex items-center gap-1.5 font-medium">
                  <NotebookPen className="size-4" /> {t("loueur.clients.notes")}
                </div>
                {fiche.dateNaissance && (
                  <p>
                    {t("commun.dateNaissance")} : {formaterDate(fiche.dateNaissance, langue, false)}
                  </p>
                )}
                {fiche.notesInternes && (
                  <p className="whitespace-pre-wrap">{fiche.notesInternes}</p>
                )}
                {fiche.motifListeNoire && <p>{fiche.motifListeNoire}</p>}
              </div>
            )}

            <div>
              <h3 className="mb-2 font-semibold">{t("messagerie.toutesReservations")}</h3>
              <ul className="flex flex-col gap-2">
                {fiche.historique.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/reservations/${r.id}`}
                      onClick={onFermer}
                      className="flex items-center gap-3 rounded-2xl bg-fond/70 p-3 text-sm transition hover:bg-fond"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="ltr font-medium">{r.code}</span>
                          <span className="text-xs text-attenue">{t(`origines.${r.origine}`)}</span>
                        </span>
                        <span className="block text-xs text-attenue">
                          <Periode
                            debut={formaterDate(r.debut, langue, false)}
                            fin={formaterDate(r.fin, langue, false)}
                          />
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <Pastille statut={r.statut}>{t(`statutsReservation.${r.statut}`)}</Pastille>
                        <span className="text-xs tabular-nums">
                          {formaterMontant(r.prixTotal, langue)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              href={`/clients/${fiche.utilisateurId}`}
              onClick={onFermer}
              className={cx(
                "flex items-center justify-center gap-1 rounded-full bg-marque-600 py-2.5 text-sm font-medium text-white",
              )}
            >
              {t("loueur.clients.historique")} · {t("commun.details")}{" "}
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
