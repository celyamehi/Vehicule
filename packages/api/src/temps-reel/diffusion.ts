import { Injectable, Logger } from "@nestjs/common";
import type { Server } from "socket.io";

export type EvenementTempsReel =
  | "reservation.creee"
  | "reservation.statut_change"
  | "reservation.modifiee"
  | "vehicule.disponibilite_change"
  | "message.nouveau";

/** Diffuse les événements temps réel (section 9) vers les canaux agence:{id} et utilisateur:{id}. */
@Injectable()
export class Diffusion {
  private serveur?: Server;
  private readonly log = new Logger("Diffusion");

  brancher(serveur: Server) {
    this.serveur = serveur;
  }

  versAgence(agenceId: string, evenement: EvenementTempsReel, donnees: unknown) {
    this.emettre(`agence:${agenceId}`, evenement, donnees);
  }

  versUtilisateur(utilisateurId: string, evenement: EvenementTempsReel, donnees: unknown) {
    this.emettre(`utilisateur:${utilisateurId}`, evenement, donnees);
  }

  private emettre(canal: string, evenement: EvenementTempsReel, donnees: unknown) {
    if (!this.serveur) return this.log.debug(`(pas de serveur) ${canal} ${evenement}`);
    this.serveur.to(canal).emit(evenement, donnees);
  }
}
