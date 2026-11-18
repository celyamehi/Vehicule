"use client";

import type { Langue } from "@lvb/shared";
import { MessagesSquare, SendHorizontal, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { cx, Vide } from "./composants.js";
import { useMessageErreur } from "./erreurs.js";
import { formaterDate } from "./format.js";
import { useSession } from "./session.js";
import { useTempsReel } from "./temps-reel.js";

/** Affichage d'une note sur 5 en étoiles. */
export function Etoiles({
  note,
  taille = "normale",
}: {
  note: number;
  taille?: "petite" | "normale";
}) {
  const t = useTranslations();
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={t("avis.etoiles", { n: note })}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cx(
            taille === "petite" ? "size-3.5" : "size-4",
            i <= Math.round(note) ? "fill-citron-800 text-citron-800" : "fill-trait text-trait",
          )}
          strokeWidth={1.5}
          aria-hidden
        />
      ))}
    </span>
  );
}

/** Choix d'une note de 1 à 5 étoiles (grandes cibles tactiles). */
export function ChoixNote({ valeur, onChange }: { valeur: number; onChange: (n: number) => void }) {
  const t = useTranslations();
  const [survol, setSurvol] = useState(0);
  return (
    <div
      className="flex gap-1"
      role="radiogroup"
      aria-label={t("avis.note")}
      onMouseLeave={() => setSurvol(0)}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={valeur === i}
          aria-label={t("avis.etoiles", { n: i })}
          onMouseEnter={() => setSurvol(i)}
          onClick={() => onChange(i)}
          className="rounded-xl p-1.5 transition hover:bg-citron-50 active:scale-90"
        >
          <Star
            className={cx(
              "size-8",
              i <= (survol || valeur) ? "fill-citron-800 text-citron-800" : "fill-champ text-trait",
            )}
            strokeWidth={1.4}
          />
        </button>
      ))}
    </div>
  );
}

type MessageFil = {
  id: string;
  auteur: "client" | "agence";
  texte: string;
  createdAt: string;
  reservationId: string;
};

/**
 * Fil de messages d'une réservation (client ↔ agence), mis à jour en temps réel.
 * `chemin` : /moi/reservations/:id/messages ou /agence/reservations/:id/messages.
 */
export function FilMessages({
  chemin,
  reservationId,
  moi,
  urlApi,
}: {
  chemin: string;
  reservationId: string;
  moi: "client" | "agence";
  urlApi: string;
}) {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { api, jetonAcces } = useSession();
  const messageErreur = useMessageErreur();
  const [messages, setMessages] = useState<MessageFil[] | null>(null);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const bas = useRef<HTMLDivElement>(null);

  const charger = useCallback(async () => {
    try {
      setMessages(await api.get<MessageFil[]>(chemin));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, [api, chemin]); // messageErreur change à chaque rendu

  useEffect(() => {
    void charger();
  }, [charger]);
  useEffect(() => {
    bas.current?.scrollIntoView({ block: "nearest" });
  }, [messages?.length]);
  useTempsReel(urlApi, jetonAcces, {
    "message.nouveau": (d) => (d as MessageFil).reservationId === reservationId && void charger(),
  });

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (!texte.trim()) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await api.post(chemin, { texte });
      setTexte("");
      await charger();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-80 min-h-28 flex-col gap-2 overflow-y-auto rounded-2xl bg-fond/70 p-3">
        {messages?.length === 0 && (
          <Vide icone={MessagesSquare}>
            {t(moi === "client" ? "messagerie.aucun" : "messagerie.aucunAgence")}
          </Vide>
        )}
        {messages?.map((m) => {
          const deMoi = m.auteur === moi;
          return (
            <div
              key={m.id}
              className={cx(
                "flex max-w-[85%] flex-col gap-0.5",
                deMoi ? "items-end self-end" : "items-start self-start",
              )}
            >
              <div
                className={cx(
                  "whitespace-pre-wrap rounded-[1.25rem] px-3.5 py-2 text-[15px] leading-snug",
                  deMoi
                    ? "rounded-ee-md bg-marque-600 text-white"
                    : "rounded-es-md bg-surface text-encre shadow-sm",
                )}
              >
                {m.texte}
              </div>
              <span className="px-1 text-[11px] text-attenue">
                {deMoi
                  ? t("messagerie.vous")
                  : t(m.auteur === "agence" ? "messagerie.agence" : "messagerie.client")}{" "}
                · {formaterDate(m.createdAt, langue)}
              </span>
            </div>
          );
        })}
        <div ref={bas} />
      </div>
      {erreur && <p className="text-sm text-danger-700">{erreur}</p>}
      <form onSubmit={envoyer} className="flex items-end gap-2">
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) void envoyer(e);
          }}
          rows={1}
          maxLength={2000}
          placeholder={t("messagerie.placeholder")}
          aria-label={t("messagerie.placeholder")}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-[1.4rem] bg-champ px-4 py-2.5 text-[15px] outline-none transition focus:bg-surface focus:ring-4 focus:ring-marque-100"
        />
        <button
          type="submit"
          disabled={envoi || !texte.trim()}
          aria-label={t("messagerie.envoyer")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-marque-600 text-white transition hover:bg-marque-700 active:scale-95 disabled:opacity-40"
        >
          <SendHorizontal className="size-5 rtl:rotate-180" strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
