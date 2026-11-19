"use client";

import type { Langue } from "@lvb/shared";
import {
  Chargement,
  FilMessages,
  Message,
  Pastille,
  Periode,
  Saisie,
  Vide,
  cx,
  formaterDate,
  useSession,
  useTempsReel,
} from "@lvb/ui";
import { ChevronLeft, MessageCircle, MessagesSquare, Phone, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ProfilClient } from "@/components/profil-client";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { URL_API } from "@/lib/config";
import { useDonnees } from "@/lib/donnees";

type Conversation = {
  reservationId: string;
  code: string;
  statut: string;
  debut: string;
  fin: string;
  vehicule: string;
  clientId: string;
  prenom: string | null;
  nom: string | null;
  telephone: string;
  dernierTexte: string;
  dernierAuteur: "client" | "agence";
  dernierLe: string;
  nonLus: number;
};

const nomDe = (c: Pick<Conversation, "prenom" | "nom" | "telephone">) =>
  [c.prenom, c.nom].filter(Boolean).join(" ") || c.telephone;
const initiales = (c: Pick<Conversation, "prenom" | "nom">) =>
  ((c.prenom?.[0] ?? "") + (c.nom?.[0] ?? "")).toUpperCase() || "?";

function Avatar({
  c,
  taille = "normale",
}: {
  c: Pick<Conversation, "prenom" | "nom">;
  taille?: "normale" | "grande";
}) {
  return (
    <span
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full bg-lavande-100 font-semibold text-lavande-800",
        taille === "grande" ? "size-11 text-sm" : "size-10 text-xs",
      )}
      aria-hidden
    >
      {initiales(c)}
    </span>
  );
}

/** Boîte de réception : toutes les conversations avec les clients, comme une messagerie. */
function BoiteDeReception() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { jetonAcces } = useSession();
  const routeur = useRouter();
  const chemin = usePathname();
  const sp = useSearchParams();
  const { donnees, erreur, recharger } = useDonnees<Conversation[]>("/agence/conversations");
  const [recherche, setRecherche] = useState("");
  const [profil, setProfil] = useState<string | null>(null);
  const choisie = sp.get("r");

  useTempsReel(URL_API, jetonAcces, { "message.nouveau": () => void recharger() });
  // Ouvrir une conversation la marque lue : on rafraîchit le compteur de la liste.
  useEffect(() => {
    if (choisie) {
      const id = setTimeout(() => void recharger(), 800);
      return () => clearTimeout(id);
    }
  }, [choisie, recharger]);

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (donnees ?? []).filter(
      (c) => !q || `${nomDe(c)} ${c.telephone} ${c.code} ${c.vehicule}`.toLowerCase().includes(q),
    );
  }, [donnees, recherche]);
  const conv = donnees?.find((c) => c.reservationId === choisie) ?? null;
  const ouvrir = (id: string | null) => routeur.replace(id ? `${chemin}?r=${id}` : chemin);

  if (erreur) return <Message ton="erreur">{erreur}</Message>;
  if (!donnees) return <Chargement />;

  return (
    <div className="-mx-4 -my-5 flex h-[calc(100dvh-7.5rem)] overflow-hidden bg-surface sm:-mx-6 lg:-mx-10 lg:-my-8 lg:h-dvh">
      {/* Liste des conversations */}
      <aside
        className={cx(
          "flex w-full flex-col border-e border-trait lg:w-[22rem] lg:shrink-0",
          conv && "hidden lg:flex",
        )}
      >
        <div className="p-4 pb-3">
          <h1 className="mb-3 text-[24px] font-semibold tracking-tight">
            {t("messagerie.conversations")}
          </h1>
          <label className="relative block">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-attenue" />
            <Saisie
              className="ps-9"
              placeholder={t("ui.rechercherPlaceholder")}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </label>
        </div>
        <ul className="flex-1 overflow-y-auto px-2 pb-3">
          {liste.length === 0 && (
            <Vide icone={MessagesSquare}>{t("messagerie.aucuneConversation")}</Vide>
          )}
          {liste.map((c) => (
            <li key={c.reservationId}>
              <button
                type="button"
                onClick={() => ouvrir(c.reservationId)}
                className={cx(
                  "flex w-full items-center gap-3 rounded-2xl p-3 text-start transition",
                  c.reservationId === choisie ? "bg-marque-50" : "hover:bg-fond",
                )}
              >
                <Avatar c={c} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={cx(
                        "truncate text-[15px]",
                        c.nonLus ? "font-semibold" : "font-medium",
                      )}
                    >
                      {nomDe(c)}
                    </span>
                    <span className="shrink-0 text-[11px] text-attenue">
                      {formaterDate(c.dernierLe, langue, false).replace(/\s?\d{4}$/, "")}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-attenue">
                    <span className="ltr">{c.code}</span> · {c.vehicule}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={cx(
                        "truncate text-sm",
                        c.nonLus ? "font-medium text-encre" : "text-attenue",
                      )}
                    >
                      {c.dernierAuteur === "agence" && `${t("messagerie.vous")} : `}
                      {c.dernierTexte}
                    </span>
                    {c.nonLus > 0 && (
                      <span className="inline-flex min-w-5 shrink-0 justify-center rounded-full bg-marque-600 px-1.5 text-xs font-semibold text-white">
                        {c.nonLus}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Discussion */}
      <section className={cx("min-w-0 flex-1 flex-col", conv ? "flex" : "hidden lg:flex")}>
        {!conv ? (
          <div className="flex flex-1 items-center justify-center">
            <Vide icone={MessagesSquare}>{t("messagerie.choisir")}</Vide>
          </div>
        ) : (
          <>
            <header className="verre flex flex-wrap items-center gap-3 border-b border-trait px-4 py-3">
              <button
                type="button"
                className="rounded-full bg-champ p-1.5 lg:hidden"
                onClick={() => ouvrir(null)}
                aria-label={t("messagerie.retour")}
              >
                <ChevronLeft className="size-5 rtl:rotate-180" />
              </button>
              {/* Comme sur une messagerie : un clic sur le nom ouvre le profil du client. */}
              <button
                type="button"
                onClick={() => setProfil(conv.clientId)}
                className="flex min-w-0 items-center gap-3 rounded-2xl p-1 pe-3 text-start transition hover:bg-fond"
              >
                <Avatar c={conv} taille="grande" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-marque-700 underline-offset-2 hover:underline">
                    {nomDe(conv)}
                  </span>
                  <span className="block truncate text-xs text-attenue">
                    {t("messagerie.profil")} · <span className="ltr">{conv.telephone}</span>
                  </span>
                </span>
              </button>
              <div className="ms-auto flex items-center gap-2">
                <a
                  href={`tel:${conv.telephone}`}
                  className="rounded-full bg-champ p-2 text-encre hover:bg-[#ececf1]"
                  aria-label={t("commun.appeler")}
                >
                  <Phone className="size-4" />
                </a>
                <a
                  href={`https://wa.me/${conv.telephone.replace("+", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-menthe-100 p-2 text-menthe-800"
                  aria-label={t("commun.whatsapp")}
                >
                  <MessageCircle className="size-4" />
                </a>
              </div>
            </header>
            <Link
              href={`/reservations/${conv.reservationId}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-trait bg-fond/60 px-4 py-2 text-sm transition hover:bg-fond"
            >
              <span className="ltr font-medium">{conv.code}</span>
              <span>{conv.vehicule}</span>
              <span className="text-attenue">
                <Periode
                  debut={formaterDate(conv.debut, langue)}
                  fin={formaterDate(conv.fin, langue)}
                />
              </span>
              <Pastille statut={conv.statut}>{t(`statutsReservation.${conv.statut}`)}</Pastille>
              <span className="ms-auto font-medium text-marque-700">
                {t("messagerie.voirReservation")}
              </span>
            </Link>
            <div className="flex-1 overflow-y-auto p-4">
              <FilMessages
                key={conv.reservationId}
                chemin={`/agence/reservations/${conv.reservationId}/messages`}
                reservationId={conv.reservationId}
                moi="agence"
                urlApi={URL_API}
              />
            </div>
          </>
        )}
      </section>

      <ProfilClient clientId={profil} onFermer={() => setProfil(null)} />
    </div>
  );
}

export default function PageMessages() {
  return (
    <Suspense fallback={<Chargement />}>
      <BoiteDeReception />
    </Suspense>
  );
}
