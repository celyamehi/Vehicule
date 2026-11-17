import { Injectable, Logger } from "@nestjs/common";

/** Fournisseur d'envoi de SMS (décision D2) : interface remplaçable par un prestataire réel. */
export abstract class FournisseurSms {
  abstract envoyer(telephone: string, message: string): Promise<void>;
}

/** Développement et tests : le SMS est écrit dans les logs et gardé en mémoire. */
@Injectable()
export class SmsConsole extends FournisseurSms {
  private readonly log = new Logger("SMS");
  readonly envoyes: { telephone: string; message: string }[] = [];

  async envoyer(telephone: string, message: string) {
    this.envoyes.push({ telephone, message });
    if (this.envoyes.length > 200) this.envoyes.shift();
    this.log.log(`→ ${telephone} : ${message}`);
  }

  dernierPour(telephone: string) {
    return [...this.envoyes].reverse().find((s) => s.telephone === telephone)?.message;
  }
}
