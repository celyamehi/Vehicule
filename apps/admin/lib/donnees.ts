"use client";

import { useMessageErreur, useSession } from "@lvb/ui";
import { useCallback, useEffect, useState } from "react";

export function useDonnees<T>(
  chemin: string | null,
  params?: Record<string, string | number | undefined>,
) {
  const { api, profil } = useSession();
  const messageErreur = useMessageErreur();
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const cle = JSON.stringify(params ?? {});
  const recharger = useCallback(async () => {
    if (!chemin || !profil?.admin) return;
    try {
      setDonnees(await api.get<T>(chemin, JSON.parse(cle) as Record<string, string>));
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, [api, chemin, cle, profil?.admin]);
  useEffect(() => {
    void recharger();
  }, [recharger]);
  return { donnees, erreur, recharger };
}
