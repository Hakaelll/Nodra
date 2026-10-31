import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { configuration } from "@nodra/config";
import { ProfileService } from "./profile.service";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { DevicesController } from "./devices.controller";
import { DevicesService } from "./devices.service";
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: configuration().JWT_SECRET,
        signOptions: {
          expiresIn: "15m",
          issuer: "nodra",
          audience: "nodra-clients",
        },
        verifyOptions: {
          issuer: "nodra",
          audience: "nodra-clients",
          algorithms: ["HS256"],
        },
      }),
    }),
  ],
  providers: [AuthService, AuthGuard, DevicesService, ProfileService],
  controllers: [AuthController, DevicesController],
  exports: [AuthGuard, JwtModule],
})
export class AuthModule {}
