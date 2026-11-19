import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { agences, codesOtp, membresAgence, sessions, utilisateurs } from "@lvb/db";
import { type Langue, traduire } from "@lvb/shared";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { type Base, InjectBase } from "../base.js";
import { ErreurApi } from "../commun/erreur-api.js";
import { CONFIG, type Config } from "../config.js";
import { FournisseurSms } from "./sms.js";
import type { UtilisateurConnecte } from "./types.js";

const DUREE_OTP_MINUTES = 5;
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export type ReponseConnexion = {
  jetonAcces: string;
  jetonRafraichissement: string;
  utilisateur: Awaited<ReturnType<AuthService["profil"]>>;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectBase() private readonly db: Base,
    @Inject(CONFIG) private readonly config: Config,
    private readonly jwt: JwtService,
    private readonly sms: FournisseurSms,
  ) {}

  private hacherCode(telephone: string, code: string) {
    return createHmac("sha256", this.config.JWT_REFRESH_SECRET)
      .update(`${telephone}:${code}`)
      .digest("hex");
  }

  /** Envoie un code OTP à 6 chiffres par SMS (limité par heure et par numéro). */
  async envoyerOtp(telephone: string, langue: Langue) {
    const [{ n }] = (await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(codesOtp)
      .where(
        and(
          eq(codesOtp.telephone, telephone),
          gt(codesOtp.createdAt, sql`now() - interval '1 hour'`),
        ),
      )) as [{ n: number }];
    if (n >= this.config.OTP_MAX_ENVOIS_PAR_HEURE) throw new ErreurApi("TROP_DE_TENTATIVES");

    // En développement, les numéros de test reçoivent un code fixe (jamais en production).
    const codeTest =
      this.config.NODE_ENV !== "production" &&
      this.config.OTP_CODE_TEST &&
      this.config.OTP_NUMEROS_TEST.includes(telephone)
        ? this.config.OTP_CODE_TEST
        : null;
    const code = codeTest ?? String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.db.insert(codesOtp).values({
      telephone,
      codeHash: this.hacherCode(telephone, code),
      expireLe: new Date(Date.now() + DUREE_OTP_MINUTES * 60_000),
    });
    await this.sms.envoyer(telephone, traduire(langue, "sms.otp", { code }));
    return { envoye: true, expireDansSecondes: DUREE_OTP_MINUTES * 60 };
  }

  /** Vérifie le code ; crée le compte au premier passage ; ouvre une session. */
  async verifierOtp(
    telephone: string,
    code: string,
    langue: Langue,
    appareil?: string,
  ): Promise<ReponseConnexion> {
    const [otp] = await this.db
      .select()
      .from(codesOtp)
      .where(and(eq(codesOtp.telephone, telephone), isNull(codesOtp.utiliseLe)))
      .orderBy(desc(codesOtp.createdAt))
      .limit(1);
    if (!otp) throw new ErreurApi("OTP_INVALIDE");
    if (otp.essais >= this.config.OTP_MAX_ESSAIS) throw new ErreurApi("TROP_DE_TENTATIVES");
    if (otp.expireLe.getTime() < Date.now()) throw new ErreurApi("OTP_EXPIRE");

    const attendu = Buffer.from(otp.codeHash, "hex");
    const recu = Buffer.from(this.hacherCode(telephone, code), "hex");
    if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) {
      await this.db
        .update(codesOtp)
        .set({ essais: sql`${codesOtp.essais} + 1` })
        .where(eq(codesOtp.id, otp.id));
      throw new ErreurApi("OTP_INVALIDE");
    }
    // Usage unique, même en cas de double envoi simultané.
    const consomme = await this.db
      .update(codesOtp)
      .set({ utiliseLe: new Date() })
      .where(and(eq(codesOtp.id, otp.id), isNull(codesOtp.utiliseLe)))
      .returning({ id: codesOtp.id });
    if (consomme.length === 0) throw new ErreurApi("OTP_INVALIDE");

    const [utilisateur] = await this.db
      .insert(utilisateurs)
      .values({ telephone, langue })
      .onConflictDoUpdate({ target: utilisateurs.telephone, set: { updatedAt: new Date() } })
      .returning();
    if (utilisateur!.statut !== "actif") throw new ErreurApi("ACCES_REFUSE");
    return this.ouvrirSession(utilisateur!.id, appareil);
  }

  async ouvrirSession(utilisateurId: string, appareil?: string): Promise<ReponseConnexion> {
    const profil = await this.profil(utilisateurId);
    const jetonRafraichissement = randomBytes(48).toString("base64url");
    await this.db.insert(sessions).values({
      utilisateurId,
      jetonHash: sha256(jetonRafraichissement),
      expireLe: new Date(Date.now() + this.config.REFRESH_TTL_JOURS * 86_400_000),
      appareil: appareil ?? null,
    });
    const jetonAcces = await this.jwt.signAsync({ sub: utilisateurId });
    return { jetonAcces, jetonRafraichissement, utilisateur: profil };
  }

  /** Rotation du jeton de rafraîchissement : l'ancien est révoqué. */
  async rafraichir(jeton: string): Promise<ReponseConnexion> {
    const [session] = await this.db
      .update(sessions)
      .set({ revoqueLe: new Date() })
      .where(
        and(
          eq(sessions.jetonHash, sha256(jeton)),
          isNull(sessions.revoqueLe),
          gt(sessions.expireLe, new Date()),
        ),
      )
      .returning();
    if (!session) throw new ErreurApi("JETON_INVALIDE");
    const [u] = await this.db
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.id, session.utilisateurId));
    if (!u || u.statut !== "actif") throw new ErreurApi("JETON_INVALIDE");
    return this.ouvrirSession(u.id, session.appareil ?? undefined);
  }

  async deconnecter(jeton: string) {
    await this.db
      .update(sessions)
      .set({ revoqueLe: new Date() })
      .where(eq(sessions.jetonHash, sha256(jeton)));
  }

  /** Vérifie un jeton d'accès et renvoie l'utilisateur actif correspondant. */
  async utilisateurDepuisJeton(jeton: string): Promise<UtilisateurConnecte> {
    let sub: string;
    try {
      ({ sub } = await this.jwt.verifyAsync<{ sub: string }>(jeton));
    } catch {
      throw new ErreurApi("JETON_INVALIDE");
    }
    const [u] = await this.db.select().from(utilisateurs).where(eq(utilisateurs.id, sub));
    if (!u || u.statut !== "actif") throw new ErreurApi("JETON_INVALIDE");
    return {
      id: u.id,
      telephone: u.telephone,
      langue: u.langue === "en" ? "fr" : u.langue,
      admin: u.rolePlateforme === "admin",
    };
  }

  /** Profil et agences dont l'utilisateur est membre. */
  async profil(utilisateurId: string) {
    const [u] = await this.db.select().from(utilisateurs).where(eq(utilisateurs.id, utilisateurId));
    if (!u) throw new ErreurApi("INTROUVABLE");
    const mesAgences = await this.db
      .select({
        id: agences.id,
        raisonSociale: agences.raisonSociale,
        statut: agences.statut,
        role: membresAgence.role,
        permissions: membresAgence.permissions,
      })
      .from(membresAgence)
      .innerJoin(agences, eq(agences.id, membresAgence.agenceId))
      .where(and(eq(membresAgence.utilisateurId, utilisateurId), eq(membresAgence.actif, true)));
    return {
      id: u.id,
      telephone: u.telephone,
      email: u.email,
      nom: u.nom,
      prenom: u.prenom,
      dateNaissance: u.dateNaissance,
      langue: u.langue,
      admin: u.rolePlateforme === "admin",
      consentementLe: u.consentementLe,
      agences: mesAgences,
    };
  }
}
