"use client";

import { Bouton } from "@lvb/ui";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";

export type PointCarte = {
  id: string;
  lat: number | null;
  lon: number | null;
  prix: number;
  libelle: string;
};

// Leaflet n'est chargé que si l'utilisateur ouvre la carte (économie de données en 3G).
const Carte = dynamic(() => import("./carte-leaflet").then((m) => m.CarteLeaflet), { ssr: false });

export function VueResultats({
  points,
  requete,
  children,
}: {
  points: PointCarte[];
  requete: string;
  children: ReactNode;
}) {
  const t = useTranslations();
  const [vue, setVue] = useState<"liste" | "carte">("liste");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 self-end">
        {(["liste", "carte"] as const).map((v) => (
          <Bouton
            key={v}
            taille="petite"
            variante={vue === v ? "principal" : "secondaire"}
            onClick={() => setVue(v)}
          >
            {t(`client.recherche.${v}`)}
          </Bouton>
        ))}
      </div>
      {vue === "liste" ? children : <Carte points={points} requete={requete} />}
    </div>
  );
}
