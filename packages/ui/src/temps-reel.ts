"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

/**
 * Abonnement aux événements temps réel de l'API (Socket.IO). Le serveur place la connexion
 * dans les canaux de l'utilisateur et de ses agences.
 */
export function useTempsReel(
  urlApi: string,
  jeton: string | null,
  evenements: Record<string, (donnees: unknown) => void>,
) {
  const gestionnaires = useRef(evenements);
  gestionnaires.current = evenements;
  const [connecte, setConnecte] = useState(false);

  useEffect(() => {
    if (!jeton) return;
    const origine = new URL(urlApi).origin;
    const socket: Socket = io(origine, {
      path: "/socket.io",
      auth: { jeton },
      transports: ["websocket", "polling"],
    });
    socket.on("connecte", () => setConnecte(true));
    socket.on("disconnect", () => setConnecte(false));
    socket.onAny((nom: string, donnees: unknown) => gestionnaires.current[nom]?.(donnees));
    return () => {
      socket.close();
    };
  }, [urlApi, jeton]);

  return connecte;
}
