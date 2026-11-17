"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Bouton({
  variante = "principal",
  taille = "normale",
  chargement,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "principal" | "secondaire" | "danger" | "fantome";
  taille?: "petite" | "normale";
  chargement?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || chargement}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marque-600 disabled:cursor-not-allowed disabled:opacity-50",
        taille === "petite" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5",
        variante === "principal" && "bg-marque-600 text-white hover:bg-marque-700",
        variante === "secondaire" && "border border-trait bg-surface text-encre hover:bg-fond",
        variante === "danger" && "bg-danger-600 text-white hover:bg-danger-700",
        variante === "fantome" && "text-marque-700 hover:bg-marque-50",
        className,
      )}
    >
      {chargement && (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-e-transparent"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}

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
    <label className={cx("flex flex-col gap-1 text-sm", className)}>
      <span className="font-medium text-encre">{libelle}</span>
      {children}
      {aide && !erreur && <span className="text-xs text-attenue">{aide}</span>}
      {erreur && <span className="text-xs text-danger-700">{erreur}</span>}
    </label>
  );
}

const styleSaisie =
  "w-full rounded-lg border border-trait bg-surface px-3 py-2 text-encre placeholder:text-attenue focus:border-marque-600 focus:outline-none focus:ring-2 focus:ring-marque-100 disabled:bg-fond";

export const Saisie = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={cx(styleSaisie, className)} />
);
export const Zone = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cx(styleSaisie, "min-h-20", className)} />
);
export const Liste = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cx(styleSaisie, className)} />
);

export function Case({
  libelle,
  aide,
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { libelle: ReactNode; aide?: ReactNode }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" {...p} className="mt-0.5 size-4 shrink-0 accent-marque-600" />
      <span>
        <span className="text-encre">{libelle}</span>
        {aide && <span className="block text-xs text-attenue">{aide}</span>}
      </span>
    </label>
  );
}

export function Carte({
  titre,
  actions,
  children,
  className,
}: {
  titre?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("rounded-xl border border-trait bg-surface p-4 shadow-sm", className)}>
      {(titre || actions) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titre && <h2 className="text-base font-semibold text-encre">{titre}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

const TONS: Record<string, string> = {
  en_attente_paiement: "bg-amber-100 text-amber-900",
  en_attente_agence: "bg-amber-100 text-amber-900",
  en_attente: "bg-amber-100 text-amber-900",
  confirmee: "bg-sky-100 text-sky-900",
  en_cours: "bg-emerald-100 text-emerald-900",
  validee: "bg-emerald-100 text-emerald-900",
  verifie: "bg-emerald-100 text-emerald-900",
  disponible: "bg-emerald-100 text-emerald-900",
  actif: "bg-emerald-100 text-emerald-900",
  terminee: "bg-slate-100 text-slate-800",
  loue: "bg-sky-100 text-sky-900",
};

export function Pastille({ statut, children }: { statut: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        TONS[statut] ?? "bg-rose-100 text-rose-900",
      )}
    >
      {children}
    </span>
  );
}

export function Message({
  ton = "info",
  children,
}: {
  ton?: "info" | "succes" | "erreur" | "alerte";
  children: ReactNode;
}) {
  return (
    <div
      role={ton === "erreur" ? "alert" : "status"}
      className={cx(
        "rounded-lg border px-3 py-2 text-sm",
        ton === "info" && "border-sky-200 bg-sky-50 text-sky-900",
        ton === "succes" && "border-emerald-200 bg-emerald-50 text-emerald-900",
        ton === "erreur" && "border-rose-200 bg-rose-50 text-rose-900",
        ton === "alerte" && "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      {children}
    </div>
  );
}

export function Chargement() {
  return (
    <div className="flex justify-center p-8" role="status" aria-live="polite">
      <span className="size-6 animate-spin rounded-full border-2 border-marque-600 border-e-transparent" />
    </div>
  );
}

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
  if (!ouverte) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onFermer}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">{titre}</h2>
        {children}
      </div>
    </div>
  );
}

/** Statistique pour les tableaux de bord. */
export function Indicateur({
  libelle,
  valeur,
  aide,
}: {
  libelle: ReactNode;
  valeur: ReactNode;
  aide?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-trait bg-surface p-4">
      <div className="text-sm text-attenue">{libelle}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-encre">{valeur}</div>
      {aide && <div className="mt-1 text-xs text-attenue">{aide}</div>}
    </div>
  );
}
