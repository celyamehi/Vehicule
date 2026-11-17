"use client";

import {
  Bouton,
  Champ,
  Liste,
  Message,
  PadSignature,
  Saisie,
  Zone,
  televerser,
  useSession,
} from "@lvb/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAction } from "@/lib/donnees";
import type { Dommage, EtatDesLieux } from "@/lib/types";

const zoneDepuis = (x: number, y: number) =>
  y < 0.22 ? "avant" : y > 0.78 ? "arriere" : x < 0.3 ? "gauche" : x > 0.7 ? "droite" : "toit";

/** Schéma du véhicule vu de dessus : un toucher ajoute un dommage (coordonnées relatives 0-1). */
export function SchemaVehicule({
  dommages,
  existants = [],
  onAjouter,
  onRetirer,
}: {
  dommages: Dommage[];
  existants?: Dommage[];
  onAjouter?: (x: number, y: number) => void;
  onRetirer?: (id: string) => void;
}) {
  return (
    <div dir="ltr" className="mx-auto w-48">
      <svg
        viewBox="0 0 100 160"
        className="w-full cursor-crosshair touch-manipulation select-none"
        onClick={(e) => {
          if (!onAjouter) return;
          const r = e.currentTarget.getBoundingClientRect();
          onAjouter(
            Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
            Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
          );
        }}
        role="img"
      >
        <rect
          x="8"
          y="4"
          width="84"
          height="152"
          rx="26"
          fill="#f8fafc"
          stroke="#334155"
          strokeWidth="2"
        />
        <rect x="18" y="32" width="64" height="24" rx="6" fill="#e2e8f0" stroke="#64748b" />
        <rect x="18" y="112" width="64" height="18" rx="6" fill="#e2e8f0" stroke="#64748b" />
        <rect x="2" y="30" width="8" height="18" rx="3" fill="#334155" />
        <rect x="90" y="30" width="8" height="18" rx="3" fill="#334155" />
        <rect x="2" y="112" width="8" height="18" rx="3" fill="#334155" />
        <rect x="90" y="112" width="8" height="18" rx="3" fill="#334155" />
        {existants.map((d) => (
          <circle key={`e-${d.id}`} cx={d.x * 100} cy={d.y * 160} r="4" fill="#94a3b8" />
        ))}
        {dommages.map((d, i) => (
          <g
            key={d.id}
            onClick={(e) => {
              e.stopPropagation();
              onRetirer?.(d.id);
            }}
          >
            <circle cx={d.x * 100} cy={d.y * 160} r="6" fill="#dc2626" />
            <text
              x={d.x * 100}
              y={d.y * 160 + 3}
              textAnchor="middle"
              fontSize="8"
              fill="#fff"
              fontWeight="700"
            >
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function FormulaireEtatDesLieux({
  reservationId,
  moment,
  depart,
  kilometrageInitial,
  onTermine,
}: {
  reservationId: string;
  moment: "depart" | "retour";
  depart?: EtatDesLieux;
  kilometrageInitial: number;
  onTermine: () => void;
}) {
  const t = useTranslations();
  const { api } = useSession();
  const { executer, enCours, erreur } = useAction();
  const [kilometrage, setKilometrage] = useState(String(depart?.kilometrage ?? kilometrageInitial));
  const [carburant, setCarburant] = useState(moment === "depart" ? 8 : (depart?.carburant ?? 8));
  const [dommages, setDommages] = useState<Dommage[]>([]);
  const [photos, setPhotos] = useState<{ cle: string; prisLe: string; apercu: string }[]>([]);
  const [observations, setObservations] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [envoiPhotos, setEnvoiPhotos] = useState(false);

  const ajouterPhotos = async (fichiers: FileList | null) => {
    if (!fichiers?.length) return;
    setEnvoiPhotos(true);
    await executer(async () => {
      for (const f of [...fichiers]) {
        const prisLe = new Date().toISOString();
        const cle = await televerser(api, f, "photo_etat_des_lieux");
        setPhotos((p) => [...p, { cle, prisLe, apercu: URL.createObjectURL(f) }]);
      }
    });
    setEnvoiPhotos(false);
  };

  const km = Number(kilometrage);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!signature) return;
        void executer(async () => {
          await api.post(`/agence/reservations/${reservationId}/etat-des-lieux`, {
            moment,
            kilometrage: km,
            carburant,
            dommages,
            photos: photos.map(({ cle, prisLe }) => ({
              cle,
              prisLe: prisLe.replace("Z", "+00:00"),
            })),
            observations: observations || undefined,
            signatureClient: signature,
          });
          onTermine();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ
          libelle={t("loueur.edl.kilometrage")}
          aide={
            depart && km >= depart.kilometrage
              ? t("loueur.edl.kmParcourus", { km: km - depart.kilometrage })
              : undefined
          }
        >
          <Saisie
            type="number"
            inputMode="numeric"
            min={0}
            required
            dir="ltr"
            value={kilometrage}
            onChange={(e) => setKilometrage(e.target.value)}
          />
        </Champ>
        <Champ libelle={`${t("loueur.edl.carburant")} : ${carburant}/8`}>
          <input
            type="range"
            min={0}
            max={8}
            step={1}
            value={carburant}
            onChange={(e) => setCarburant(Number(e.target.value))}
            className="accent-marque-600"
          />
        </Champ>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t("pdf.dommages")}</p>
        <p className="mb-2 text-xs text-attenue">
          {t("loueur.edl.toucherSchema")}{" "}
          {depart && t("loueur.edl.dommagesDepart", { n: depart.dommages.length })}
        </p>
        <SchemaVehicule
          dommages={dommages}
          existants={depart?.dommages}
          onAjouter={(x, y) =>
            setDommages([
              ...dommages,
              { id: crypto.randomUUID().slice(0, 8), x, y, zone: zoneDepuis(x, y), type: "rayure" },
            ])
          }
          onRetirer={(id) => setDommages(dommages.filter((d) => d.id !== id))}
        />
        {dommages.length > 0 && (
          <ol className="mt-3 flex flex-col gap-2">
            {dommages.map((d, i) => (
              <li
                key={d.id}
                className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-sm sm:grid-cols-[auto_1fr_1fr_2fr]"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-danger-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <Liste
                  aria-label={t("loueur.edl.zone")}
                  value={d.zone}
                  onChange={(e) =>
                    setDommages(
                      dommages.map((x) => (x.id === d.id ? { ...x, zone: e.target.value } : x)),
                    )
                  }
                >
                  {(["avant", "arriere", "gauche", "droite", "toit"] as const).map((z) => (
                    <option key={z} value={z}>
                      {t(`loueur.edl.zones.${z}`)}
                    </option>
                  ))}
                </Liste>
                <Liste
                  aria-label={t("loueur.edl.typeDommage")}
                  value={d.type}
                  onChange={(e) =>
                    setDommages(
                      dommages.map((x) =>
                        x.id === d.id ? { ...x, type: e.target.value as Dommage["type"] } : x,
                      ),
                    )
                  }
                >
                  {(["rayure", "bosse", "casse", "autre"] as const).map((ty) => (
                    <option key={ty} value={ty}>
                      {t(`loueur.edl.types.${ty}`)}
                    </option>
                  ))}
                </Liste>
                <Saisie
                  className="col-span-3 sm:col-span-1"
                  placeholder={t("loueur.edl.description")}
                  value={d.description ?? ""}
                  onChange={(e) =>
                    setDommages(
                      dommages.map((x) =>
                        x.id === d.id ? { ...x, description: e.target.value } : x,
                      ),
                    )
                  }
                />
              </li>
            ))}
          </ol>
        )}
      </div>

      <Champ libelle={t("loueur.edl.photosHorodatees")}>
        <Saisie
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => void ajouterPhotos(e.target.files)}
        />
      </Champ>
      {envoiPhotos && <p className="text-xs text-attenue">{t("ui.compression")}</p>}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <img key={p.cle} src={p.apercu} alt="" className="size-20 rounded-lg object-cover" />
          ))}
        </div>
      )}

      <Champ libelle={t("loueur.edl.observations")}>
        <Zone value={observations} onChange={(e) => setObservations(e.target.value)} />
      </Champ>
      <div>
        <p className="mb-2 text-sm font-medium">{t("loueur.edl.signatureClient")}</p>
        <PadSignature onChange={setSignature} />
      </div>
      {erreur && <Message ton="erreur">{erreur}</Message>}
      <Bouton
        type="submit"
        chargement={enCours}
        disabled={!signature || envoiPhotos || !kilometrage}
      >
        {t("loueur.edl.valider")}
      </Bouton>
    </form>
  );
}
