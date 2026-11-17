"use client";

import { useLocale } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ClientApi, type Jetons } from "./client-api.js";

export type AgenceMembre = {
  id: string;
  raisonSociale: string;
  statut: "en_attente" | "validee" | "suspendue";
  role: "gerant" | "employe";
  permissions: string[];
};

export type Profil = {
  id: string;
  telephone: string;
  email: string | null;
  nom: string | null;
  prenom: string | null;
  dateNaissance: string | null;
  langue: string;
  admin: boolean;
  consentementLe: string | null;
  agences: AgenceMembre[];
};

type ValeurSession = {
  api: ClientApi;
  profil: Profil | null;
  pret: boolean;
  jetonAcces: string | null;
  agenceId: string | null;
  agence: AgenceMembre | null;
  choisirAgence: (id: string) => void;
  connecte: (j: Jetons & { utilisateur: Profil }) => void;
  deconnecter: () => Promise<void>;
  recharger: () => Promise<void>;
};

const Contexte = createContext<ValeurSession | null>(null);

const lire = <T,>(cle: string): T | null => {
  try {
    const v = localStorage.getItem(cle);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const ecrire = (cle: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(cle);
    else localStorage.setItem(cle, JSON.stringify(v));
  } catch {
    /* stockage indisponible (navigation privée) */
  }
};

/**
 * Session de l'utilisateur : jetons (stockés dans le navigateur, décision D33), profil,
 * agence courante pour le logiciel loueur, et client API préconfiguré.
 */
export function FournisseurSession({
  urlApi,
  espace,
  children,
}: {
  urlApi: string;
  espace: string;
  children: ReactNode;
}) {
  const langue = useLocale();
  const cleJetons = `${espace}.jetons`;
  const cleAgence = `${espace}.agence`;
  const jetonsRef = useRef<Jetons | null>(null);
  const agenceRef = useRef<string | null>(null);
  const langueRef = useRef(langue);
  langueRef.current = langue;
  const [profil, setProfil] = useState<Profil | null>(null);
  const [pret, setPret] = useState(false);
  const [jetonAcces, setJetonAcces] = useState<string | null>(null);
  const [agenceId, setAgenceId] = useState<string | null>(null);

  const appliquerJetons = useCallback(
    (j: Jetons | null) => {
      jetonsRef.current = j;
      setJetonAcces(j?.jetonAcces ?? null);
      ecrire(cleJetons, j);
      if (!j) setProfil(null);
    },
    [cleJetons],
  );

  const api = useMemo(
    () =>
      new ClientApi({
        urlApi,
        langue: () => langueRef.current,
        jetons: () => jetonsRef.current,
        surNouveauxJetons: appliquerJetons,
        agenceId: () => agenceRef.current,
      }),
    [urlApi, appliquerJetons],
  );

  const choisirAgence = useCallback(
    (id: string) => {
      agenceRef.current = id;
      setAgenceId(id);
      ecrire(cleAgence, id);
    },
    [cleAgence],
  );

  const adopterProfil = useCallback(
    (p: Profil) => {
      setProfil(p);
      const memorisee = agenceRef.current ?? lire<string>(cleAgence);
      const valide =
        p.agences.find((a) => a.id === memorisee) ??
        (p.agences.length === 1 ? p.agences[0] : undefined);
      if (valide) choisirAgence(valide.id);
    },
    [cleAgence, choisirAgence],
  );

  const recharger = useCallback(async () => {
    if (!jetonsRef.current) return;
    try {
      adopterProfil(await api.get<Profil>("/moi"));
    } catch {
      /* jeton expiré et non rafraîchissable : la session est vidée par le client */
    }
  }, [api, adopterProfil]);

  useEffect(() => {
    jetonsRef.current = lire<Jetons>(cleJetons);
    setJetonAcces(jetonsRef.current?.jetonAcces ?? null);
    agenceRef.current = lire<string>(cleAgence);
    setAgenceId(agenceRef.current);
    void recharger().finally(() => setPret(true));
  }, [cleJetons, cleAgence, recharger]);

  const valeur: ValeurSession = {
    api,
    profil,
    pret,
    jetonAcces,
    agenceId,
    agence: profil?.agences.find((a) => a.id === agenceId) ?? null,
    choisirAgence,
    connecte: (r) => {
      appliquerJetons({ jetonAcces: r.jetonAcces, jetonRafraichissement: r.jetonRafraichissement });
      adopterProfil(r.utilisateur);
    },
    deconnecter: async () => {
      const j = jetonsRef.current;
      if (j)
        await api
          .post("/auth/deconnexion", { jetonRafraichissement: j.jetonRafraichissement })
          .catch(() => undefined);
      appliquerJetons(null);
      agenceRef.current = null;
      setAgenceId(null);
      ecrire(cleAgence, null);
    },
    recharger,
  };
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useSession() {
  const v = useContext(Contexte);
  if (!v) throw new Error("useSession doit être utilisé dans FournisseurSession");
  return v;
}
