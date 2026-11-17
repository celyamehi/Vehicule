"use client";

import { useMessageErreur, useSession } from "@lvb/ui";
import { useCallback, useEffect, useState } from "react";

/** Charge une ressource de l'API (avec l'agence courante) et permet de la recharger. */
export function useDonnees<T>(
  chemin: string | null,
  params?: Record<string, string | number | boolean | undefined>,
) {
  const { api, agenceId } = useSession();
  const messageErreur = useMessageErreur();
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const cle = JSON.stringify(params ?? {});

  const recharger = useCallback(async () => {
    if (!chemin || !agenceId) return;
    setChargement(true);
    try {
      setDonnees(await api.get<T>(chemin, JSON.parse(cle) as Record<string, string>));
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargement(false);
    }
  }, [api, chemin, cle, agenceId]);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  return { donnees, erreur, chargement, recharger, setDonnees };
}

/** Exécute une action de l'API en gérant l'état de chargement et le message d'erreur. */
export function useAction() {
  const messageErreur = useMessageErreur();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const executer = async <R>(action: () => Promise<R>): Promise<R | undefined> => {
    setEnCours(true);
    setErreur(null);
    try {
      return await action();
    } catch (e) {
      setErreur(messageErreur(e));
      return undefined;
    } finally {
      setEnCours(false);
    }
  };
  return { executer, enCours, erreur, setErreur };
}
