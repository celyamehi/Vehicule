"use client";

import type { Langue, TypeEntretien } from "@lvb/shared";
import { Carte, formaterMontant, type Ton } from "@lvb/ui";
import { useDonnees } from "@/lib/donnees";
import {
  BadgeCheck,
  CircleGauge,
  Disc3,
  Droplets,
  FileBadge,
  Hammer,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

/** Icône et teinte pastel de chaque type d'entretien. */
export const VISUELS: Record<TypeEntretien, { icone: LucideIcon; ton: Ton }> = {
  vidange: { icone: Droplets, ton: "citron" },
  assurance: { icone: ShieldCheck, ton: "ciel" },
  controle_technique: { icone: BadgeCheck, ton: "menthe" },
  vignette: { icone: FileBadge, ton: "lavande" },
  pneus: { icone: Disc3, ton: "neutre" },
  freins: { icone: CircleGauge, ton: "rose" },
  revision: { icone: Sparkles, ton: "marque" },
  reparation: { icone: Hammer, ton: "peche" },
  autre: { icone: Wrench, ton: "neutre" },
};

/** Texte « dans 12 jours · 800 km restants » d'une échéance. */
export function TexteEcheance({
  r,
}: {
  r: { joursRestants: number | null; kmRestants: number | null };
}) {
  const t = useTranslations("loueur.entretien");
  const parties: string[] = [];
  if (r.joursRestants !== null)
    parties.push(
      r.joursRestants >= 0
        ? t("dansJours", { n: r.joursRestants })
        : t("depuisJours", { n: -r.joursRestants }),
    );
  if (r.kmRestants !== null)
    parties.push(
      r.kmRestants >= 0
        ? t("kmRestants", { km: r.kmRestants.toLocaleString("fr-FR") })
        : t("kmDepasses", { km: (-r.kmRestants).toLocaleString("fr-FR") }),
    );
  return <>{parties.join(" · ")}</>;
}

type Rentabilite = {
  revenus: number;
  couts: number;
  marge: number;
  tauxMarge: number | null;
  locations: number;
};

/** Rentabilité d'un véhicule (4.10) : revenus des locations moins coûts d'entretien. */
export function RentabiliteVehicule({ vehiculeId }: { vehiculeId: string }) {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { donnees: r } = useDonnees<Rentabilite>(`/agence/vehicules/${vehiculeId}/rentabilite`);
  if (!r) return null;
  return (
    <Carte titre={t("loueur.entretien.rentabilite")} icone={TrendingUp} ton="menthe">
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["revenus", r.revenus, "text-encre"],
            ["couts", r.couts, "text-encre"],
            ["marge", r.marge, r.marge >= 0 ? "text-menthe-800" : "text-danger-700"],
          ] as const
        ).map(([cle, montant, couleur]) => (
          <div key={cle} className="rounded-2xl bg-fond/70 p-3">
            <div className="text-xs text-attenue">{t(`loueur.entretien.${cle}`)}</div>
            <div className={`mt-1 text-lg font-semibold tabular-nums ${couleur}`}>
              {formaterMontant(montant, langue)}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-attenue">
        {t("loueur.entretien.locations", { n: r.locations })}
        {r.tauxMarge !== null && <> · {r.tauxMarge} %</>}
      </p>
    </Carte>
  );
}
