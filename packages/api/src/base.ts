import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { type Base, creerBase } from "@lvb/db";
import { CONFIG, type Config, lireConfig } from "./config.js";

export const BASE = Symbol("BASE");
const CONNEXION = Symbol("CONNEXION");

/** Injection de la base Drizzle : `@InjectBase() private readonly db: Base`. */
export const InjectBase = () => Inject(BASE);

class FermetureBase implements OnApplicationShutdown {
  constructor(@Inject(CONNEXION) private readonly connexion: ReturnType<typeof creerBase>) {}
  async onApplicationShutdown() {
    await this.connexion.fermer();
  }
}

@Global()
@Module({
  providers: [
    { provide: CONFIG, useFactory: () => lireConfig() },
    {
      provide: CONNEXION,
      inject: [CONFIG],
      useFactory: (c: Config) => creerBase(c.DATABASE_URL, { max: 20 }),
    },
    { provide: BASE, inject: [CONNEXION], useFactory: (c: ReturnType<typeof creerBase>) => c.db },
    FermetureBase,
  ],
  exports: [CONFIG, BASE],
})
export class BaseModule {}

export type { Base };
