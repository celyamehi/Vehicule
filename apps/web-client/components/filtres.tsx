"use client";

import { BOITES, CARBURANTS, CATEGORIES_VEHICULE } from "@lvb/shared";
import { Bouton, Case, Champ, Liste, Saisie } from "@lvb/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { versRequete } from "@/lib/recherche";

type Params = Record<string, string | undefined>;

/** Filtres de la section 3.2 ; ils modifient l'URL (résultats rendus côté serveur). */
export function Filtres({ params }: { params: Params }) {
  const t = useTranslations();
  const routeur = useRouter();
  const [f, setF] = useState(params);
  const [ouvert, setOuvert] = useState(false);
  const appliquer = (p: Params) =>
    routeur.push(`/recherche?${versRequete({ ...p, page: undefined })}`);
  const maj = (k: string) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value || undefined });

  return (
    <div className="rounded-xl border border-trait bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <Bouton
          taille="petite"
          variante="secondaire"
          onClick={() => setOuvert(!ouvert)}
          aria-expanded={ouvert}
        >
          {t("client.recherche.filtres")}
        </Bouton>
        <label className="flex items-center gap-2 text-sm">
          {t("client.recherche.tri")}
          <Liste
            className="w-auto"
            value={f.tri ?? "prix"}
            onChange={(e) => {
              const p = { ...f, tri: e.target.value };
              setF(p);
              appliquer(p);
            }}
          >
            <option value="prix">{t("client.recherche.triPrix")}</option>
            <option value="note">{t("client.recherche.triNote")}</option>
          </Liste>
        </label>
      </div>
      {ouvert && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Champ libelle={t("loueur.flotte.categorie")}>
            <Liste value={f.categorie ?? ""} onChange={maj("categorie")}>
              <option value="">{t("ui.tous")}</option>
              {CATEGORIES_VEHICULE.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </Liste>
          </Champ>
          <Champ libelle={t("loueur.flotte.boite")}>
            <Liste value={f.boite ?? ""} onChange={maj("boite")}>
              <option value="">{t("ui.tous")}</option>
              {BOITES.map((b) => (
                <option key={b} value={b}>
                  {t(`boites.${b}`)}
                </option>
              ))}
            </Liste>
          </Champ>
          <Champ libelle={t("loueur.flotte.carburant")}>
            <Liste value={f.carburant ?? ""} onChange={maj("carburant")}>
              <option value="">{t("ui.tous")}</option>
              {CARBURANTS.map((c) => (
                <option key={c} value={c}>
                  {t(`carburants.${c}`)}
                </option>
              ))}
            </Liste>
          </Champ>
          <Champ libelle={t("client.recherche.placesMin")}>
            <Saisie
              type="number"
              min={1}
              max={20}
              dir="ltr"
              value={f.placesMin ?? ""}
              onChange={maj("placesMin")}
            />
          </Champ>
          <Champ libelle={t("client.recherche.prixMax")}>
            <Saisie
              type="number"
              min={0}
              step={1000}
              dir="ltr"
              value={f.prixMax ?? ""}
              onChange={maj("prixMax")}
            />
          </Champ>
          <div className="flex flex-col justify-end gap-2">
            <Case
              libelle={t("options.climatisation")}
              checked={f.climatisation === "true"}
              onChange={(e) => setF({ ...f, climatisation: e.target.checked ? "true" : undefined })}
            />
          </div>
          <div className="flex gap-2 sm:col-span-3">
            <Bouton onClick={() => appliquer(f)}>{t("client.recherche.appliquer")}</Bouton>
            <Bouton
              variante="fantome"
              onClick={() => {
                const p = { debut: f.debut, fin: f.fin, wilaya: f.wilaya, commune: f.commune };
                setF(p);
                appliquer(p);
              }}
            >
              {t("client.recherche.reinitialiser")}
            </Bouton>
          </div>
        </div>
      )}
    </div>
  );
}
