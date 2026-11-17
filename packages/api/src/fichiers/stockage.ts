import { randomUUID } from "node:crypto";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { CONFIG, type Config } from "../config.js";

/** Stockage de fichiers (photos, documents) — interface S3, jamais de fichier en base. */
export abstract class Stockage {
  abstract urlTeleversement(cle: string, typeMime: string, taille: number): Promise<string>;
  abstract urlLecture(cle: string, dureeSecondes?: number): Promise<string>;
  abstract deposer(cle: string, contenu: Buffer, typeMime: string): Promise<void>;
  abstract lire(cle: string): Promise<Buffer>;

  /** Clé unique : `<usage>/<proprietaire>/<uuid>.<ext>`. */
  static nouvelleCle(usage: string, proprietaire: string, typeMime: string) {
    const ext =
      { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[
        typeMime
      ] ?? "bin";
    return `${usage}/${proprietaire}/${randomUUID()}.${ext}`;
  }
}

@Injectable()
export class StockageS3 extends Stockage implements OnModuleInit {
  private readonly log = new Logger("Stockage");
  private readonly client: S3Client;
  /** Client utilisé pour signer les URL données aux navigateurs (adresse publique). */
  private readonly signeur: S3Client;

  constructor(@Inject(CONFIG) private readonly config: Config) {
    super();
    const base = {
      region: config.S3_REGION,
      forcePathStyle: true,
      credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
    };
    this.client = new S3Client({ ...base, endpoint: config.S3_ENDPOINT });
    this.signeur = new S3Client({
      ...base,
      endpoint: config.S3_URL_PUBLIQUE ?? config.S3_ENDPOINT,
    });
  }

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.S3_BUCKET }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.config.S3_BUCKET }));
        this.log.log(`Bucket ${this.config.S3_BUCKET} créé`);
      } catch (e) {
        this.log.warn(`Stockage S3 indisponible : ${(e as Error).message}`);
      }
    }
  }

  urlTeleversement(cle: string, typeMime: string, taille: number) {
    return getSignedUrl(
      this.signeur,
      new PutObjectCommand({
        Bucket: this.config.S3_BUCKET,
        Key: cle,
        ContentType: typeMime,
        ContentLength: taille,
      }),
      { expiresIn: 600 },
    );
  }

  /** URL de lecture signée, à durée courte (5 min par défaut, section 11). */
  urlLecture(cle: string, dureeSecondes = 300) {
    return getSignedUrl(
      this.signeur,
      new GetObjectCommand({ Bucket: this.config.S3_BUCKET, Key: cle }),
      {
        expiresIn: dureeSecondes,
      },
    );
  }

  async deposer(cle: string, contenu: Buffer, typeMime: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.S3_BUCKET,
        Key: cle,
        Body: contenu,
        ContentType: typeMime,
      }),
    );
  }

  async lire(cle: string) {
    const r = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.S3_BUCKET, Key: cle }),
    );
    return Buffer.from(await r.Body!.transformToByteArray());
  }
}

/** Décode une image en data URL (signature) en Buffer. */
export function depuisDataUrl(dataUrl: string): { contenu: Buffer; typeMime: string } {
  const m = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("data URL invalide");
  return { typeMime: m[1]!, contenu: Buffer.from(m[2]!, "base64") };
}
