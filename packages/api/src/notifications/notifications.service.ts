import { Injectable, Logger } from "@nestjs/common";
import { agences, membresAgence, notifications, utilisateurs } from "@lvb/db";
import { type Langue, traduire } from "@lvb/shared";
import { and, eq } from "drizzle-orm";
import { FournisseurSms } from "../auth/sms.js";
import { type Base, InjectBase } from "../base.js";

type CleSms =
  "reservationRecue" | "reservationConfirmee" | "reservationRefusee" | "reservationExpiree";

/** Notifications dans l'application + SMS (section 3.4). Les échecs d'envoi ne bloquent jamais l'action. */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger("Notifications");

  constructor(
    @InjectBase() private readonly db: Base,
    private readonly sms: FournisseurSms,
  ) {}

  async notifier(
    utilisateurId: string,
    type: string,
    donnees: Record<string, string | number>,
    sms?: { cle: CleSms; valeurs: Record<string, string | number> },
  ) {
    try {
      await this.db
        .insert(notifications)
        .values({ utilisateurId, type, donnees, canal: sms ? "sms" : "app" });
      if (sms) {
        const [u] = await this.db
          .select({ telephone: utilisateurs.telephone, langue: utilisateurs.langue })
          .from(utilisateurs)
          .where(eq(utilisateurs.id, utilisateurId));
        if (u) {
          const langue: Langue = u.langue === "en" ? "fr" : u.langue;
          await this.sms.envoyer(u.telephone, traduire(langue, `sms.${sms.cle}`, sms.valeurs));
        }
      }
    } catch (e) {
      this.log.warn(`Notification non envoyée : ${(e as Error).message}`);
    }
  }

  /**
   * Prévient l'agence d'une nouvelle demande en ligne (décision D35) : notification pour les
   * membres qui peuvent l'accepter, et SMS au numéro de l'agence pour ne rien manquer quand le
   * logiciel est fermé. La langue du SMS est celle du gérant.
   */
  async notifierAgence(
    agenceId: string,
    donnees: { code: string; vehicule: string; date: string },
  ) {
    try {
      const membres = await this.db
        .select({
          utilisateurId: membresAgence.utilisateurId,
          role: membresAgence.role,
          permissions: membresAgence.permissions,
          langue: utilisateurs.langue,
        })
        .from(membresAgence)
        .innerJoin(utilisateurs, eq(utilisateurs.id, membresAgence.utilisateurId))
        .where(and(eq(membresAgence.agenceId, agenceId), eq(membresAgence.actif, true)));
      const destinataires = membres.filter(
        (m) => m.role === "gerant" || m.permissions.includes("reservations.accepter"),
      );
      if (destinataires.length)
        await this.db.insert(notifications).values(
          destinataires.map((m) => ({
            utilisateurId: m.utilisateurId,
            type: "reservation_creee",
            donnees,
            canal: "app",
          })),
        );
      const [agence] = await this.db
        .select({ telephone: agences.telephone })
        .from(agences)
        .where(eq(agences.id, agenceId));
      const gerant = membres.find((m) => m.role === "gerant");
      const langue: Langue = !gerant || gerant.langue === "en" ? "fr" : gerant.langue;
      if (agence)
        await this.sms.envoyer(
          agence.telephone,
          traduire(langue, "sms.nouvelleDemandeAgence", donnees),
        );
    } catch (e) {
      this.log.warn(`Notification agence non envoyée : ${(e as Error).message}`);
    }
  }
}
