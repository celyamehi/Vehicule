import { Controller, HttpCode, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { type Langue, schemas } from "@lvb/shared";
import type { z } from "zod";
import { LangueRequete } from "../commun/langue.js";
import { Corps, DocCorps } from "../commun/zod.js";
import { AuthService } from "./auth.service.js";
import { Public } from "./decorateurs.js";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("otp/envoyer")
  @HttpCode(200)
  @DocCorps(schemas.otpEnvoyer)
  envoyer(
    @Corps(schemas.otpEnvoyer) corps: z.output<typeof schemas.otpEnvoyer>,
    @LangueRequete() langue: Langue,
  ) {
    return this.auth.envoyerOtp(corps.telephone, langue);
  }

  @Public()
  @Post("otp/verifier")
  @HttpCode(200)
  @DocCorps(schemas.otpVerifier)
  verifier(
    @Corps(schemas.otpVerifier) corps: z.output<typeof schemas.otpVerifier>,
    @LangueRequete() langue: Langue,
  ) {
    return this.auth.verifierOtp(corps.telephone, corps.code, langue, corps.appareil);
  }

  @Public()
  @Post("rafraichir")
  @HttpCode(200)
  @DocCorps(schemas.rafraichir)
  rafraichir(@Corps(schemas.rafraichir) corps: z.output<typeof schemas.rafraichir>) {
    return this.auth.rafraichir(corps.jetonRafraichissement);
  }

  @Public()
  @Post("deconnexion")
  @HttpCode(204)
  @DocCorps(schemas.rafraichir)
  async deconnexion(@Corps(schemas.rafraichir) corps: z.output<typeof schemas.rafraichir>) {
    await this.auth.deconnecter(corps.jetonRafraichissement);
  }
}
