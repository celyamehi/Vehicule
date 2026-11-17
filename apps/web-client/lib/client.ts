"use client";

import { useMessageErreur, useSession } from "@lvb/ui";
import { useCallback, useEffect, useState } from "react";

/** Données de l'espace client (connecté). */
export function useDonneesClient<T>(chemin: string | null) {
  const { api, profil } = useSession();
  const messageErreur = useMessageErreur();
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const recharger = useCallback(async () => {
    if (!chemin || !profil) return;
    try {
      setDonnees(await api.get<T>(chemin));
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, [api, chemin, profil]);
  useEffect(() => {
    void recharger();
  }, [recharger]);
  return { donnees, erreur, recharger };
}
