import type { Langue } from "@lvb/shared";
import { formaterDate } from "@lvb/ui";
import { MessageSquareQuote, Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { apiServeur } from "@/lib/serveur";

type ReponseAvis = {
  moyenne: number | null;
  nombre: number;
  repartition: { note: number; nombre: number }[];
  avis: {
    id: string;
    note: number;
    commentaire: string | null;
    reponseAgence: string | null;
    createdAt: string;
    auteur: string | null;
    vehicule: string | null;
  }[];
};

/** Étoiles en lecture seule, rendues côté serveur. */
export function EtoilesServeur({ note, label }: { note: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`size-4 ${i <= Math.round(note) ? "fill-citron-800 text-citron-800" : "fill-trait text-trait"}`}
          strokeWidth={1.5}
          aria-hidden
        />
      ))}
    </span>
  );
}

/** Avis vérifiés d'une agence (seuls les clients ayant loué peuvent noter). */
export async function AvisAgence({
  agenceId,
  langue,
  limite = 6,
}: {
  agenceId: string;
  langue: Langue;
  limite?: number;
}) {
  const t = await getTranslations({ locale: langue });
  const r = await apiServeur<ReponseAvis>(
    `/agences/${agenceId}/avis?parPage=${limite}`,
    langue,
    300,
  );
  if (!r) return null;
  return (
    <section className="rounded-[var(--radius-carte)] bg-surface p-5 shadow-[var(--shadow-douce)]">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex size-8 items-center justify-center rounded-xl bg-citron-100 text-citron-800">
          <MessageSquareQuote className="size-4" strokeWidth={1.9} />
        </span>
        <h2 className="text-[17px] font-semibold">{t("avis.titre")}</h2>
        {r.moyenne !== null && (
          <span className="ms-auto flex items-center gap-2 text-sm">
            <span className="text-xl font-semibold tabular-nums">
              {r.moyenne.toLocaleString(langue === "ar" ? "ar-DZ" : "fr-FR", {
                numberingSystem: "latn",
              })}
            </span>
            <EtoilesServeur note={r.moyenne} label={t("avis.etoiles", { n: r.moyenne })} />
            <span className="text-attenue">{t("avis.nombre", { n: r.nombre })}</span>
          </span>
        )}
      </div>
      {r.avis.length === 0 ? (
        <p className="text-sm text-attenue">{t("avis.aucun")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {r.avis.map((a) => (
            <li key={a.id} className="rounded-2xl bg-fond/70 p-4 text-sm">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="font-medium">{a.auteur ?? "—"}</span>
                <EtoilesServeur note={a.note} label={t("avis.etoiles", { n: a.note })} />
              </div>
              {a.commentaire && <p className="leading-relaxed text-encre/85">{a.commentaire}</p>}
              <p className="mt-1.5 text-xs text-attenue">
                {formaterDate(a.createdAt, langue, false)}
                {a.vehicule && <> · {a.vehicule}</>}
              </p>
              {a.reponseAgence && (
                <div className="mt-3 rounded-xl bg-surface p-3 text-[13px]">
                  <div className="mb-0.5 font-medium text-marque-700">
                    {t("avis.reponseAgence")}
                  </div>
                  {a.reponseAgence}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
