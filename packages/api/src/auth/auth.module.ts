import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { CONFIG, type Config } from "../config.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { GardeAcces } from "./garde.js";
import { FournisseurSms, SmsConsole } from "./sms.js";

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [CONFIG],
      useFactory: (c: Config) => ({
        secret: c.JWT_ACCESS_SECRET,
        signOptions: { expiresIn: c.JWT_ACCESS_TTL as `${number}m` },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SmsConsole,
    { provide: FournisseurSms, useExisting: SmsConsole },
    { provide: APP_GUARD, useClass: GardeAcces },
  ],
  exports: [AuthService, FournisseurSms, SmsConsole],
})
export class AuthModule {}
