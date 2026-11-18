"use client";

import type { Langue } from "@lvb/shared";
import { Bouton, formaterDate, useSession, useTempsReel } from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "@/i18n/navigation";
import { URL_API } from "@/lib/config";

type Evenement = {
  id: string;
  code: string;
  origine: string;
  statut: string;
  debut: string;
  vehiculeId: string;
};
type Alerte = Evenement & { recueLe: number };

type ValeurAlertes = {
  enAttente: number;
  permission: NotificationPermission | "indisponible";
  demanderPermission: () => void;
};
const Contexte = createContext<ValeurAlertes>({
  enAttente: 0,
  permission: "indisponible",
  demanderPermission: () => {},
});
export const useDemandesEnAttente = () => useContext(Contexte).enAttente;

/** Deux bips courts, générés sans fichier audio (aucun téléchargement en 3G). */
function bip() {
  try {
    const ctx = new AudioContext();
    [0, 0.25].forEach((decalage, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 1046 : 784;
      g.gain.setValueAtTime(0.2, ctx.currentTime + decalage);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + decalage + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + decalage);
      o.stop(ctx.currentTime + decalage + 0.22);
    });
  } catch {
    /* son indisponible */
  }
}

/**
 * Alertes des nouvelles réservations en ligne (décision D35) : bandeau qui reste affiché
 * jusqu'à ce qu'on le traite, son, notification Windows si l'onglet est en arrière-plan,
 * compteur dans le titre de la fenêtre et dans le menu.
 */
export function FournisseurAlertes({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const routeur = useRouter();
  const { api, jetonAcces, agenceId } = useSession();
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [enAttente, setEnAttente] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | "indisponible">(
    "indisponible",
  );
  const vehicules = useRef(new Map<string, string>());
  const titreBase = useRef<string | null>(null);

  const compter = useCallback(async () => {
    if (!agenceId) return;
    try {
      const r = await api.get<{ total: number }>("/agence/reservations", {
        statut: "en_attente_agence",
        parPage: 1,
      });
      setEnAttente(r.total);
    } catch {
      /* compteur indicatif */
    }
  }, [api, agenceId]);

  useEffect(() => {
    void compter();
    if ("Notification" in window) setPermission(Notification.permission);
    void api
      .get<{ id: string; marque: string; modele: string }[]>("/agence/vehicules")
      .then((l) => l.forEach((v) => vehicules.current.set(v.id, `${v.marque} ${v.modele}`)))
      .catch(() => undefined);
  }, [api, compter]);

  useEffect(() => {
    titreBase.current ??= document.title.replace(/^\(\d+\)\s*/, "");
    document.title = enAttente ? `(${enAttente}) ${titreBase.current}` : titreBase.current;
  }, [enAttente]);

  useTempsReel(URL_API, jetonAcces, {
    "reservation.creee": (d) => {
      const r = d as Evenement;
      void compter();
      if (r.origine !== "plateforme") return;
      setAlertes((a) =>
        [{ ...r, recueLe: Date.now() }, ...a.filter((x) => x.id !== r.id)].slice(0, 5),
      );
      bip();
      if (permission === "granted" && document.hidden) {
        const n = new Notification(t("loueur.alertes.nouvelle"), {
          body: t("loueur.alertes.detail", {
            code: r.code,
            vehicule: vehicules.current.get(r.vehiculeId) ?? "",
            date: formaterDate(r.debut, langue),
          }),
          tag: r.id,
          requireInteraction: true,
        });
        n.onclick = () => {
          window.focus();
          routeur.push(`/reservations/${r.id}`);
          n.close();
        };
      }
    },
    "reservation.statut_change": (d) => {
      const r = d as Evenement;
      void compter();
      if (r.statut !== "en_attente_agence") setAlertes((a) => a.filter((x) => x.id !== r.id));
    },
  });

  return (
    <Contexte.Provider
      value={{
        enAttente,
        permission,
        demanderPermission: () => void Notification.requestPermission().then(setPermission),
      }}
    >
      {alertes.length > 0 && (
        <div
          className="fixed inset-x-2 top-2 z-50 flex flex-col gap-2 sm:inset-x-auto sm:end-4 sm:w-96"
          role="alert"
          aria-live="assertive"
        >
          {alertes.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3 shadow-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-amber-950">
                    🔔 {t("loueur.alertes.nouvelle")}
                  </div>
                  <div className="text-sm text-amber-900">
                    {t("loueur.alertes.detail", {
                      code: a.code,
                      vehicule: vehicules.current.get(a.vehiculeId) ?? "",
                      date: formaterDate(a.debut, langue),
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={t("commun.fermer")}
                  className="text-amber-900"
                  onClick={() => setAlertes((x) => x.filter((y) => y.id !== a.id))}
                >
                  ✕
                </button>
              </div>
              <Bouton
                taille="petite"
                className="mt-2 w-full"
                onClick={() => {
                  setAlertes((x) => x.filter((y) => y.id !== a.id));
                  routeur.push(`/reservations/${a.id}`);
                }}
              >
                {t("loueur.alertes.voir")}
              </Bouton>
            </div>
          ))}
        </div>
      )}
      {children}
    </Contexte.Provider>
  );
}

/** Bandeaux affichés en haut de chaque page : demandes à confirmer, activation des notifications. */
export function BandeauxAlertes() {
  const t = useTranslations();
  const routeur = useRouter();
  const { enAttente, permission, demanderPermission } = useContext(Contexte);
  return (
    <>
      {permission === "default" && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <span>{t("loueur.alertes.activerBureau")}</span>
          <Bouton taille="petite" variante="secondaire" onClick={demanderPermission}>
            {t("commun.confirmer")}
          </Bouton>
        </div>
      )}
      {enAttente > 0 && (
        <button
          type="button"
          onClick={() => routeur.push("/reservations")}
          className="mb-3 w-full rounded-lg bg-amber-400 px-3 py-2 text-start text-sm font-semibold text-amber-950"
        >
          {t("loueur.alertes.enAttente", { n: enAttente })}
        </button>
      )}
    </>
  );
}
