"use client";

import type { Langue } from "@lvb/shared";
import { Bouton, PuceIcone, formaterDate, useSession, useTempsReel } from "@lvb/ui";
import { Bell, BellRing, ChevronRight, MessagesSquare, X } from "lucide-react";
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
  const [messagesRecus, setMessagesRecus] = useState<
    { id: string; reservationId: string; code: string; texte: string }[]
  >([]);
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
    "message.nouveau": (d) => {
      const m = d as {
        id: string;
        reservationId: string;
        code: string;
        texte: string;
        auteur: string;
      };
      if (m.auteur !== "client") return;
      setMessagesRecus((x) =>
        [m, ...x.filter((y) => y.reservationId !== m.reservationId)].slice(0, 3),
      );
      bip();
      if (permission === "granted" && document.hidden) {
        const n = new Notification(`${t("messagerie.nouveau")} — ${m.code}`, {
          body: m.texte.slice(0, 140),
          tag: m.id,
        });
        n.onclick = () => {
          window.focus();
          routeur.push(`/reservations/${m.reservationId}`);
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
      {messagesRecus.length > 0 && (
        <div
          className="fixed inset-x-3 bottom-3 z-50 flex flex-col gap-2 sm:inset-x-auto sm:bottom-5 sm:end-5 sm:w-[23rem]"
          role="status"
          aria-live="polite"
        >
          {messagesRecus.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMessagesRecus((x) => x.filter((y) => y.id !== m.id));
                routeur.push(`/reservations/${m.reservationId}`);
              }}
              className="verre flex items-start gap-3 rounded-3xl p-4 text-start shadow-[var(--shadow-relief)] ring-1 ring-black/5"
            >
              <PuceIcone icone={MessagesSquare} ton="ciel" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {t("messagerie.nouveau")} · <span className="ltr">{m.code}</span>
                </span>
                <span className="line-clamp-2 text-sm text-attenue">{m.texte}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {alertes.length > 0 && (
        <div
          className="fixed inset-x-3 top-3 z-50 flex flex-col gap-2 sm:inset-x-auto sm:end-5 sm:top-5 sm:w-[23rem]"
          role="alert"
          aria-live="assertive"
        >
          {alertes.map((a) => (
            <div
              key={a.id}
              className="verre rounded-3xl p-4 shadow-[var(--shadow-relief)] ring-1 ring-black/5"
            >
              <div className="flex items-start gap-3">
                <PuceIcone icone={BellRing} ton="peche" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{t("loueur.alertes.nouvelle")}</div>
                  <div className="text-sm text-attenue">
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
                  className="rounded-full bg-champ p-1.5 text-attenue hover:text-encre"
                  onClick={() => setAlertes((x) => x.filter((y) => y.id !== a.id))}
                >
                  <X className="size-3.5" strokeWidth={2.4} />
                </button>
              </div>
              <Bouton
                taille="petite"
                className="mt-3 w-full"
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ciel-50 px-4 py-3 text-sm text-ciel-800">
          <span className="flex items-center gap-2">
            <Bell className="size-[18px]" strokeWidth={1.9} />
            {t("loueur.alertes.activerBureau")}
          </span>
          <Bouton taille="petite" variante="secondaire" onClick={demanderPermission}>
            {t("commun.confirmer")}
          </Bouton>
        </div>
      )}
      {enAttente > 0 && (
        <button
          type="button"
          onClick={() => routeur.push("/reservations")}
          className="mb-5 flex w-full items-center gap-3 rounded-2xl bg-peche-100 px-4 py-3 text-start text-sm font-semibold text-peche-800 transition hover:bg-peche-50"
        >
          <BellRing className="size-[18px]" strokeWidth={2} />
          <span className="flex-1">{t("loueur.alertes.enAttente", { n: enAttente })}</span>
          <ChevronRight className="size-4 rtl:rotate-180" strokeWidth={2} />
        </button>
      )}
    </>
  );
}
