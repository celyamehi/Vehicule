import { Logger } from "@nestjs/common";
import { type OnGatewayConnection, type OnGatewayInit, WebSocketGateway } from "@nestjs/websockets";
import { membresAgence } from "@lvb/db";
import { and, eq } from "drizzle-orm";
import type { Server, Socket } from "socket.io";
import { AuthService } from "../auth/auth.service.js";
import { type Base, InjectBase } from "../base.js";
import { Diffusion } from "./diffusion.js";

/**
 * WebSocket (Socket.IO) : le client s'authentifie avec son jeton d'accès
 * (`auth: { jeton }`) et rejoint automatiquement ses canaux.
 */
@WebSocketGateway({ path: "/socket.io", cors: { origin: true, credentials: true } })
export class PasserelleTempsReel implements OnGatewayInit, OnGatewayConnection {
  private readonly log = new Logger("TempsReel");

  constructor(
    private readonly auth: AuthService,
    private readonly diffusion: Diffusion,
    @InjectBase() private readonly db: Base,
  ) {}

  afterInit(serveur: Server) {
    this.diffusion.brancher(serveur);
  }

  async handleConnection(socket: Socket) {
    try {
      const jeton = (socket.handshake.auth as { jeton?: string } | undefined)?.jeton;
      if (!jeton) throw new Error("jeton manquant");
      const u = await this.auth.utilisateurDepuisJeton(jeton);
      const canaux = [`utilisateur:${u.id}`];
      const adhesions = await this.db
        .select({ agenceId: membresAgence.agenceId })
        .from(membresAgence)
        .where(and(eq(membresAgence.utilisateurId, u.id), eq(membresAgence.actif, true)));
      for (const a of adhesions) canaux.push(`agence:${a.agenceId}`);
      await socket.join(canaux);
      socket.emit("connecte", { canaux });
    } catch (e) {
      this.log.debug(`Connexion refusée : ${(e as Error).message}`);
      socket.emit("erreur", { code: "NON_AUTHENTIFIE" });
      socket.disconnect(true);
    }
  }
}
