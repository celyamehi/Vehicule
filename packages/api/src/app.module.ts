import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AdminController } from "./admin/admin.controller.js";
import { AgenceController } from "./agence/agence.controller.js";
import { FlotteController } from "./agence/flotte.controller.js";
import { AuthModule } from "./auth/auth.module.js";
import { BaseModule } from "./base.js";
import { FiltreErreurs } from "./commun/filtre-erreurs.js";
import { JournalService } from "./commun/journal.service.js";
import { DocumentsController } from "./documents/documents.controller.js";
import { GenerateurPdf } from "./documents/pdf.js";
import { FichiersController } from "./fichiers/fichiers.controller.js";
import { Stockage, StockageS3 } from "./fichiers/stockage.js";
import { MoiController } from "./moi/moi.controller.js";
import { NotificationsService } from "./notifications/notifications.service.js";
import { RechercheController } from "./recherche/recherche.controller.js";
import { RechercheService } from "./recherche/recherche.service.js";
import { ReservationsAgenceController } from "./reservations/agence.controller.js";
import { ReservationsClientController } from "./reservations/client.controller.js";
import { ExpirationReservations } from "./reservations/expiration.js";
import { ReservationsService } from "./reservations/reservations.service.js";
import { SanteController } from "./sante.controller.js";
import { Diffusion } from "./temps-reel/diffusion.js";
import { PasserelleTempsReel } from "./temps-reel/passerelle.js";

@Module({
  imports: [BaseModule, AuthModule],
  controllers: [
    SanteController,
    RechercheController,
    ReservationsClientController,
    MoiController,
    AgenceController,
    FlotteController,
    ReservationsAgenceController,
    DocumentsController,
    FichiersController,
    AdminController,
  ],
  providers: [
    { provide: APP_FILTER, useClass: FiltreErreurs },
    JournalService,
    NotificationsService,
    Diffusion,
    PasserelleTempsReel,
    StockageS3,
    { provide: Stockage, useExisting: StockageS3 },
    ReservationsService,
    ExpirationReservations,
    RechercheService,
    GenerateurPdf,
  ],
})
export class AppModule {}
