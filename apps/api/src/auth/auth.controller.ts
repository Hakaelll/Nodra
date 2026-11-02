import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  UseGuards,
  Inject,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiTags,
  ApiBearerAuth,
  ApiResponse,
  ApiOperation,
} from "@nestjs/swagger";
import { credentials, registration, tokenInput } from "@nodra/contracts";
import { AuthService } from "./auth.service";
import { AuthGuard, CurrentUser } from "./auth.guard";
import { parse, openApiSchema } from "../common";
import type { FastifyReply } from "fastify";
import { ProfileService } from "./profile.service";
import {
  passwordInput,
  tokensOutput,
  sessionOutput,
  okOutput,
  errorOutput,
  profileInput,
  profileOutput,
  resetRequestInput,
  resetCompleteInput,
  verificationInput,
} from "./auth.schemas";
@ApiTags("Auth")
@ApiResponse({
  status: 400,
  description: "Entrada inválida.",
  schema: openApiSchema(errorOutput),
})
@ApiResponse({
  status: 500,
  description: "Error interno sin detalles sensibles.",
  schema: openApiSchema(errorOutput),
})
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ProfileService) private readonly profile: ProfileService,
  ) {}
  @Post("register")
  @ApiOperation({ summary: "Crear usuario y sesión" })
  @ApiBody({ schema: openApiSchema(registration) })
  @ApiResponse({ status: 201, schema: openApiSchema(sessionOutput) })
  @ApiResponse({
    status: 409,
    description: "Email registrado o conflicto concurrente.",
    schema: openApiSchema(errorOutput),
  })
  register(@Body() body: unknown) {
    return this.auth.register(parse(registration, body));
  }
  @Post("login")
  @ApiOperation({ summary: "Iniciar sesión" })
  @ApiBody({ schema: openApiSchema(credentials) })
  @ApiResponse({ status: 201, schema: openApiSchema(sessionOutput) })
  @ApiResponse({ status: 401, schema: openApiSchema(errorOutput) })
  login(@Body() body: unknown) {
    return this.auth.login(parse(credentials, body));
  }
  @Post("reset/request")
  @ApiOperation({
    summary: "Solicitar recuperación de contraseña",
    description: "Siempre devuelve ok sin revelar si el correo existe.",
  })
  @ApiBody({ schema: openApiSchema(resetRequestInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(okOutput) })
  resetRequest(@Body() body: unknown) {
    return this.auth.requestPasswordReset(parse(resetRequestInput, body).email);
  }
  @Post("reset/complete")
  @ApiOperation({
    summary: "Establecer contraseña con un enlace de un solo uso",
  })
  @ApiBody({ schema: openApiSchema(resetCompleteInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(okOutput) })
  @ApiResponse({ status: 400, schema: openApiSchema(errorOutput) })
  resetComplete(@Body() body: unknown) {
    const input = parse(resetCompleteInput, body);
    return this.auth.resetPassword(input.token, input.newPassword);
  }
  @Post("verify/request")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Solicitar verificación del correo propio" })
  @ApiResponse({ status: 201, schema: openApiSchema(okOutput) })
  @ApiResponse({ status: 401, schema: openApiSchema(errorOutput) })
  verifyRequest(@CurrentUser() userId: string) {
    return this.auth.requestEmailVerification(userId);
  }
  @Post("verify/complete")
  @ApiOperation({ summary: "Verificar correo con un enlace de un solo uso" })
  @ApiBody({ schema: openApiSchema(verificationInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(okOutput) })
  @ApiResponse({ status: 400, schema: openApiSchema(errorOutput) })
  verifyComplete(@Body() body: unknown) {
    return this.auth.verifyEmail(parse(verificationInput, body).token);
  }
  @Post("refresh")
  @ApiOperation({
    summary: "Rotar sesión",
    description:
      "Consume el refresh token y devuelve un par nuevo. Reutilizar uno revocado invalida su familia.",
  })
  @ApiBody({ schema: openApiSchema(tokenInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(tokensOutput) })
  @ApiResponse({ status: 401, schema: openApiSchema(errorOutput) })
  refresh(@Body() body: unknown) {
    return this.auth.refresh(parse(tokenInput, body).token);
  }
  @Post("logout")
  @ApiOperation({
    summary: "Cerrar la familia de sesiones",
    description: "Idempotente: un token desconocido también devuelve ok.",
  })
  @ApiBody({ schema: openApiSchema(tokenInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(okOutput) })
  logout(@Body() body: unknown) {
    return this.auth.logout(parse(tokenInput, body).token);
  }
  @Get("me")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Obtener perfil propio" })
  @ApiResponse({ status: 200, schema: openApiSchema(profileOutput) })
  @ApiResponse({ status: 401, schema: openApiSchema(errorOutput) })
  me(@CurrentUser() userId: string) {
    return this.profile.me(userId);
  }
  @Patch("me")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Actualizar nombre y apellidos propios" })
  @ApiBody({ schema: openApiSchema(profileInput) })
  @ApiResponse({ status: 200, schema: openApiSchema(profileOutput) })
  @ApiResponse({ status: 401, schema: openApiSchema(errorOutput) })
  updateProfile(@CurrentUser() userId: string, @Body() body: unknown) {
    return this.profile.updateProfile(userId, parse(profileInput, body));
  }
  @Get("me/avatar")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Obtener la foto de perfil propia" })
  @ApiResponse({ status: 401, schema: openApiSchema(errorOutput) })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  @ApiResponse({
    status: 200,
    content: { "image/jpeg": { schema: { type: "string", format: "binary" } } },
  })
  async avatar(
    @CurrentUser() userId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const bytes = await this.profile.avatar(userId);
    reply
      .type("image/jpeg")
      .header("cache-control", "private, no-cache, max-age=0");
    return bytes;
  }
  @Post("me/avatar")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Guardar una foto de perfil JPEG recortada" })
  @ApiConsumes("image/jpeg")
  @ApiResponse({ status: 413, schema: openApiSchema(errorOutput) })
  @ApiResponse({ status: 415, schema: openApiSchema(errorOutput) })
  @ApiBody({
    required: true,
    description:
      "JPEG binario de 512×512 píxeles, máximo 524288 bytes. No multipart ni base64.",
    schema: { type: "string", format: "binary" },
  })
  @ApiResponse({ status: 201, schema: openApiSchema(profileOutput) })
  @ApiResponse({ status: 401, schema: openApiSchema(errorOutput) })
  saveAvatar(@CurrentUser() userId: string, @Body() body: unknown) {
    return this.profile.saveAvatar(userId, body);
  }
  @Post("password")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Cambiar contraseña",
    description:
      "Revoca todas las sesiones, incluida la actual. Requiere iniciar sesión de nuevo.",
  })
  @ApiBody({ schema: openApiSchema(passwordInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(okOutput) })
  @ApiResponse({ status: 401, schema: openApiSchema(errorOutput) })
  @ApiResponse({ status: 409, schema: openApiSchema(errorOutput) })
  password(@CurrentUser() userId: string, @Body() body: unknown) {
    const data = parse(passwordInput, body);
    return this.auth.changePassword(
      userId,
      data.currentPassword,
      data.newPassword,
    );
  }
}
