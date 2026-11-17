import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { CONFIG, type Config } from "../config.js";
import { ReservationsService } from "./reservations.service.js";

const FILE = "reservations";
const INTERVALLE_MS = 30_000;

/**
 * Tâche planifiée (BullMQ sur Redis, règle 6.3.3) : toutes les 30 s, passe en `expiree`
 * les réservations non confirmées dans les délais et libère le véhicule.
 */
@Injectable()
export class ExpirationReservations implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("Expiration");
  private file?: Queue;
  private travailleur?: Worker;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly reservations: ReservationsService,
  ) {}

  async onModuleInit() {
    if (!this.config.JOBS_ACTIFS) return;
    const url = new URL(this.config.REDIS_URL);
    const connection = {
      host: url.hostname,
      port: Number(url.port || 6379),
      maxRetriesPerRequest: null,
    };
    this.file = new Queue(FILE, { connection });
    await this.file.upsertJobScheduler("expirer", { every: INTERVALLE_MS }, { name: "expirer" });
    this.travailleur = new Worker(
      FILE,
      async () => {
        const n = await this.reservations.expirer();
        if (n) this.log.log(`${n} réservation(s) expirée(s)`);
      },
      { connection, concurrency: 1 },
    );
    this.travailleur.on("failed", (_job, e) =>
      this.log.error(`Échec de l'expiration : ${e.message}`),
    );
  }

  async onModuleDestroy() {
    await this.travailleur?.close();
    await this.file?.close();
  }
}
