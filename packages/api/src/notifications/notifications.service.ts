import { Injectable, Logger } from "@nestjs/common";
import { notifications, utilisateurs } from "@lvb/db";
import { type Langue, traduire } from "@lvb/shared";
import { eq } from "drizzle-orm";
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
}
