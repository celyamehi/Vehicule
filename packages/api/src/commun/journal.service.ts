import { Injectable } from "@nestjs/common";
import { journalActions } from "@lvb/db";
import { type Base, InjectBase } from "../base.js";

/** Journal des actions sensibles (section 11) : prix, annulations, accès aux documents… */
@Injectable()
export class JournalService {
  constructor(@InjectBase() private readonly db: Base) {}

  async noter(entree: {
    action: string;
    entite: string;
    entiteId?: string | null;
    agenceId?: string | null;
    utilisateurId?: string | null;
    details?: Record<string, unknown>;
    ip?: string | null;
  }) {
    await this.db.insert(journalActions).values({
      action: entree.action,
      entite: entree.entite,
      entiteId: entree.entiteId ?? null,
      agenceId: entree.agenceId ?? null,
      utilisateurId: entree.utilisateurId ?? null,
      details: entree.details ?? {},
      ip: entree.ip ?? null,
    });
  }
}
