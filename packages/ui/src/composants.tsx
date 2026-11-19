"use client";

import { useTranslations } from "next-intl";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Bouton arrondi (pilule), quatre variantes. */
export function Bouton({
  variante = "principal",
  taille = "normale",
  chargement,
  icone: Icone,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "principal" | "secondaire" | "danger" | "fantome";
  taille?: "petite" | "normale";
  chargement?: boolean;
  icone?: LucideIcon;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || chargement}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 rounded-full font-medium transition duration-200 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marque-500 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
        taille === "petite" ? "h-9 px-4 text-sm" : "h-11 px-5 text-[15px]",
        variante === "principal" &&
          "bg-marque-600 text-white shadow-[0_6px_16px_-6px_rgb(76_93_228/0.6)] hover:bg-marque-700",
        variante === "secondaire" &&
          "bg-surface text-encre shadow-[0_0_0_1px_rgb(0_0_0/0.08)] hover:bg-fond",
        variante === "danger" && "bg-rose-50 text-danger-700 hover:bg-rose-100",
        variante === "fantome" && "text-marque-700 hover:bg-marque-50",
        className,
      )}
    >
      {chargement ? (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-e-transparent"
          aria-hidden
        />
      ) : (
        Icone && <Icone className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
      )}
      {children}
    </button>
  );
}

/** Pastille d'icône sur fond pastel (en-têtes de cartes, indicateurs). */
export function PuceIcone({
  icone: Icone,
  ton = "marque",
  taille = "normale",
}: {
  icone: LucideIcon;
  ton?: Ton;
  taille?: "petite" | "normale" | "grande";
}) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-2xl",
        TONS_FOND[ton],
        taille === "petite" && "size-8 rounded-xl",
        taille === "normale" && "size-10",
        taille === "grande" && "size-14 rounded-[1.25rem]",
      )}
      aria-hidden
    >
      <Icone
        className={taille === "grande" ? "size-7" : taille === "petite" ? "size-4" : "size-5"}
        strokeWidth={1.9}
      />
    </span>
  );
}

export type Ton = "marque" | "menthe" | "peche" | "lavande" | "ciel" | "rose" | "citron" | "neutre";
const TONS_FOND: Record<Ton, string> = {
  marque: "bg-marque-100 text-marque-700",
  menthe: "bg-menthe-100 text-menthe-800",
  peche: "bg-peche-100 text-peche-800",
  lavande: "bg-lavande-100 text-lavande-800",
  ciel: "bg-ciel-100 text-ciel-800",
  rose: "bg-rose-100 text-rose-800",
  citron: "bg-citron-100 text-citron-800",
  neutre: "bg-champ text-attenue",
};

export function Champ({
  libelle,
  aide,
  erreur,
  children,
  className,
}: {
  libelle: ReactNode;
  aide?: ReactNode;
  erreur?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("flex flex-col gap-1.5 text-sm", className)}>
      <span className="ps-1 font-medium text-encre">{libelle}</span>
      {children}
      {aide && !erreur && <span className="ps-1 text-xs text-attenue">{aide}</span>}
      {erreur && <span className="ps-1 text-xs text-danger-700">{erreur}</span>}
    </label>
  );
}

const styleSaisie =
  "rounded-xl border border-transparent bg-champ px-3.5 py-2.5 text-[15px] text-encre outline-none transition placeholder:text-attenue/70 hover:bg-[#ececf1] focus:border-marque-300 focus:bg-surface focus:ring-4 focus:ring-marque-100 disabled:opacity-60";

/** Pleine largeur par défaut, sauf si une largeur est donnée (w-auto, w-48…). */
const largeur = (className?: string) =>
  className && /(^|\s)(\w+:)?w-/.test(className) ? "" : "w-full";

export const Saisie = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...p}
    className={cx(
      styleSaisie,
      largeur(className),
      p.type === "file" &&
        "file:me-3 file:rounded-full file:border-0 file:bg-marque-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-marque-700",
      className,
    )}
  />
);
export const Zone = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cx(styleSaisie, largeur(className), "min-h-24", className)} />
);
export const Liste = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cx(styleSaisie, largeur(className), "cursor-pointer", className)} />
);

/** Case à cocher douce. */
export function Case({
  libelle,
  aide,
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { libelle: ReactNode; aide?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input
        type="checkbox"
        {...p}
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded-md accent-marque-600"
      />
      <span>
        <span className="text-encre">{libelle}</span>
        {aide && <span className="block text-xs text-attenue">{aide}</span>}
      </span>
    </label>
  );
}

/** Carte blanche aux grands arrondis et ombre douce. */
export function Carte({
  titre,
  icone,
  ton,
  actions,
  children,
  className,
}: {
  titre?: ReactNode;
  icone?: LucideIcon;
  ton?: Ton;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "min-w-0 rounded-[var(--radius-carte)] bg-surface p-5 shadow-[var(--shadow-douce)]",
        className,
      )}
    >
      {(titre || actions) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {titre && (
            <div className="flex items-center gap-3">
              {icone && <PuceIcone icone={icone} ton={ton} taille="petite" />}
              <h2 className="text-[17px] font-semibold text-encre">{titre}</h2>
            </div>
          )}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

const TONS_STATUT: Record<string, string> = {
  en_attente_paiement: "bg-citron-100 text-citron-800",
  en_attente_agence: "bg-citron-100 text-citron-800",
  en_attente: "bg-citron-100 text-citron-800",
  bientot: "bg-peche-100 text-peche-800",
  confirmee: "bg-ciel-100 text-ciel-800",
  loue: "bg-ciel-100 text-ciel-800",
  en_cours: "bg-menthe-100 text-menthe-800",
  validee: "bg-menthe-100 text-menthe-800",
  verifie: "bg-menthe-100 text-menthe-800",
  disponible: "bg-menthe-100 text-menthe-800",
  actif: "bg-menthe-100 text-menthe-800",
  ok: "bg-menthe-100 text-menthe-800",
  terminee: "bg-champ text-attenue",
  masque: "bg-lavande-100 text-lavande-800",
  en_entretien: "bg-lavande-100 text-lavande-800",
};

/** Étiquette de statut aux couleurs pastel. */
export function Pastille({ statut, children }: { statut: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        TONS_STATUT[statut] ?? "bg-rose-100 text-rose-800",
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {children}
    </span>
  );
}

const MESSAGES = {
  info: { classe: "bg-ciel-50 text-ciel-800", icone: Info },
  succes: { classe: "bg-menthe-50 text-menthe-800", icone: CheckCircle2 },
  erreur: { classe: "bg-rose-50 text-rose-800", icone: AlertCircle },
  alerte: { classe: "bg-citron-50 text-citron-800", icone: TriangleAlert },
} as const;

export function Message({
  ton = "info",
  children,
}: {
  ton?: keyof typeof MESSAGES;
  children: ReactNode;
}) {
  const { classe, icone: Icone } = MESSAGES[ton];
  return (
    <div
      role={ton === "erreur" ? "alert" : "status"}
      className={cx("flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm", classe)}
    >
      <Icone className="mt-0.5 size-[18px] shrink-0" strokeWidth={2} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Chargement() {
  return (
    <div className="flex justify-center p-10" role="status" aria-live="polite">
      <span className="size-7 animate-spin rounded-full border-[3px] border-marque-200 border-t-marque-600" />
    </div>
  );
}

/** Fenêtre en « feuille » qui monte du bas sur mobile, centrée sur ordinateur. */
export function Modale({
  ouverte,
  titre,
  onFermer,
  children,
}: {
  ouverte: boolean;
  titre: ReactNode;
  onFermer: () => void;
  children: ReactNode;
}) {
  const t = useTranslations();
  if (!ouverte) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(29_29_31/0.28)] backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onFermer}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[1.75rem] bg-surface p-6 shadow-[var(--shadow-relief)] sm:max-w-lg sm:rounded-[1.75rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-trait sm:hidden" aria-hidden />
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold">{titre}</h2>
          <button
            type="button"
            onClick={onFermer}
            className="rounded-full bg-champ p-1.5 text-attenue hover:text-encre"
            aria-label={t("commun.fermer")}
          >
            <X className="size-4" strokeWidth={2.4} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Indicateur chiffré pour les tableaux de bord. */
export function Indicateur({
  libelle,
  valeur,
  aide,
  icone,
  ton = "marque",
}: {
  libelle: ReactNode;
  valeur: ReactNode;
  aide?: ReactNode;
  icone?: LucideIcon;
  ton?: Ton;
}) {
  return (
    <div className="min-w-0 rounded-[var(--radius-carte)] bg-surface p-5 shadow-[var(--shadow-douce)]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-attenue">{libelle}</div>
        {icone && <PuceIcone icone={icone} ton={ton} taille="petite" />}
      </div>
      <div className="mt-2 text-[28px] font-semibold leading-tight tracking-tight tabular-nums text-encre">
        {valeur}
      </div>
      {aide && <div className="mt-1 text-xs text-attenue">{aide}</div>}
    </div>
  );
}

/** Flèche « de… à… » qui s'oriente selon le sens de lecture (RTL en arabe). */
export function Fleche({ className }: { className?: string }) {
  return (
    <ArrowRight
      className={cx("inline size-3.5 align-[-2px] text-attenue rtl:rotate-180", className)}
      strokeWidth={2}
      aria-hidden
    />
  );
}

/** Période « début → fin ». */
export function Periode({ debut, fin }: { debut: ReactNode; fin: ReactNode }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>{debut}</span>
      <Fleche />
      <span>{fin}</span>
    </span>
  );
}

/** État vide d'une liste, avec icône. */
export function Vide({ icone, children }: { icone: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm text-attenue">
      <PuceIcone icone={icone} ton="neutre" taille="grande" />
      <div>{children}</div>
    </div>
  );
}
