import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { documentsIdentite, notifications, utilisateurs } from "@lvb/db";
import { schemas } from "@lvb/shared";
import { desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { AuthService } from "../auth/auth.service.js";
import { Moi } from "../auth/decorateurs.js";
import type { UtilisateurConnecte } from "../auth/types.js";
import { type Base, InjectBase } from "../base.js";
import { ErreurApi } from "../commun/erreur-api.js";
import { Corps, DocCorps, PipeZod } from "../commun/zod.js";
import { Stockage } from "../fichiers/stockage.js";

@ApiTags("Mon compte")
@ApiBearerAuth()
@Controller("moi")
export class MoiController {
  constructor(
    @InjectBase() private readonly db: Base,
    private readonly auth: AuthService,
    private readonly stockage: Stockage,
  ) {}

  @Get()
  profil(@Moi() moi: UtilisateurConnecte) {
    return this.auth.profil(moi.id);
  }

  @Patch()
  @DocCorps(schemas.profilModifier)
  async modifier(
    @Moi() moi: UtilisateurConnecte,
    @Body(new PipeZod(schemas.profilModifier)) c: z.output<typeof schemas.profilModifier>,
  ) {
    const { consentement, ...champs } = c;
    await this.db
      .update(utilisateurs)
      .set({ ...champs, ...(consentement ? { consentementLe: new Date() } : {}) })
      .where(eq(utilisateurs.id, moi.id));
    return this.auth.profil(moi.id);
  }

  @Get("documents")
  async documents(@Moi() moi: UtilisateurConnecte) {
    const docs = await this.db
      .select()
      .from(documentsIdentite)
      .where(eq(documentsIdentite.utilisateurId, moi.id))
      .orderBy(desc(documentsIdentite.createdAt));
    return Promise.all(
      docs.map(async (d) => ({
        ...d,
        urls: {
          recto: d.fichiers.recto ? await this.stockage.urlLecture(d.fichiers.recto) : null,
          verso: d.fichiers.verso ? await this.stockage.urlLecture(d.fichiers.verso) : null,
        },
      })),
    );
  }

  @Post("documents")
  @DocCorps(schemas.documentIdentite)
  async ajouterDocument(
    @Moi() moi: UtilisateurConnecte,
    @Corps(schemas.documentIdentite) c: z.output<typeof schemas.documentIdentite>,
  ) {
    // Un client ne peut référencer que ses propres fichiers.
    for (const cle of Object.values(c.fichiers))
      if (cle && !cle.startsWith(`document_identite/${moi.id}/`))
        throw new ErreurApi("FICHIER_INVALIDE");
    const [d] = await this.db
      .insert(documentsIdentite)
      .values({ ...c, dateExpiration: c.dateExpiration ?? null, utilisateurId: moi.id })
      .returning();
    return d;
  }

  @Get("notifications")
  notifications(@Moi() moi: UtilisateurConnecte) {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.utilisateurId, moi.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }
}
