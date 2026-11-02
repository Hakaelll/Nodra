import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Inject,
  Res,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiOperation,
  ApiConsumes,
} from "@nestjs/swagger";
import {
  organizationInput,
  organizationUpdateInput,
  invitationInput,
  tokenInput,
  pageInput,
  membershipUpdateInput,
} from "@nodra/contracts";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { parse, uuid, openApiSchema } from "../common";
import { OrganizationsService } from "./organizations.service";
import { OrganizationLogoService } from "./organization-logo.service";
import {
  organizationOutput,
  organizationListOutput,
  memberOutput,
  membershipOutput,
  memberPageOutput,
  invitationOutput,
  invitationPreviewOutput,
} from "./organizations.schemas";
import { okOutput, errorOutput } from "../auth/auth.schemas";
import type { FastifyReply } from "fastify";
@ApiTags("Organizations")
@ApiResponse({ status: 400, schema: openApiSchema(errorOutput) })
@ApiResponse({ status: 401, schema: openApiSchema(errorOutput) })
@ApiResponse({ status: 403, schema: openApiSchema(errorOutput) })
@ApiResponse({ status: 500, schema: openApiSchema(errorOutput) })
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class OrganizationsController {
  constructor(
    @Inject(OrganizationsService)
    private readonly service: OrganizationsService,
    @Inject(OrganizationLogoService)
    private readonly logos: OrganizationLogoService,
  ) {}
  @Get("organizations")
  @ApiOperation({
    summary: "Listar pertenencias activas propias",
    description:
      "Devuelve Membership con organización y usuario público, ordenadas por joinedAt.",
  })
  @ApiResponse({ status: 200, schema: openApiSchema(organizationListOutput) })
  list(@CurrentUser() user: string) {
    return this.service.list(user);
  }
  @Get("organizations/:org/logo")
  @ApiParam({ name: "org", format: "uuid" })
  @ApiOperation({ summary: "Consultar el logo privado de la organización" })
  @ApiResponse({
    status: 200,
    content: { "image/jpeg": { schema: { type: "string", format: "binary" } } },
  })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  async logo(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const bytes = await this.logos.read(user, org);
    reply
      .type("image/jpeg")
      .header("cache-control", "private, no-cache, max-age=0");
    return bytes;
  }
  @Post("organizations/:org/logo")
  @ApiParam({ name: "org", format: "uuid" })
  @ApiOperation({ summary: "Cambiar logo, sólo OWNER o ADMIN" })
  @ApiResponse({ status: 409, schema: openApiSchema(errorOutput) })
  @ApiConsumes("image/jpeg")
  @ApiBody({
    required: true,
    description: "JPEG binario de 512×512 píxeles, máximo 524288 bytes.",
    schema: { type: "string", format: "binary" },
  })
  @ApiResponse({ status: 201, schema: openApiSchema(organizationOutput) })
  @ApiResponse({ status: 413, schema: openApiSchema(errorOutput) })
  @ApiResponse({ status: 415, schema: openApiSchema(errorOutput) })
  saveLogo(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Body() body: unknown,
  ) {
    return this.logos.save(user, org, body);
  }
  @Delete("organizations/:org/logo")
  @ApiParam({ name: "org", format: "uuid" })
  @ApiOperation({ summary: "Quitar logo, sólo OWNER o ADMIN; idempotente" })
  @ApiResponse({ status: 409, schema: openApiSchema(errorOutput) })
  @ApiResponse({ status: 200, schema: openApiSchema(okOutput) })
  removeLogo(@CurrentUser() user: string, @Param("org") org: string) {
    return this.logos.remove(user, org);
  }
  @Get("organizations/:org/users/:id/avatar")
  @ApiParam({ name: "org", format: "uuid" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({
    summary: "Foto de un participante de la organización",
    description:
      "La persona puede ver la suya; coordinación puede ver la de otros miembros de su organización.",
  })
  @ApiResponse({
    status: 200,
    content: { "image/jpeg": { schema: { type: "string", format: "binary" } } },
  })
  async memberAvatar(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Param("id") id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const bytes = await this.service.memberAvatar(user, org, uuid(id));
    reply.type("image/jpeg").header("cache-control", "private, no-store");
    return bytes;
  }
  @Post("organizations")
  @ApiBody({ schema: openApiSchema(organizationInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(organizationOutput) })
  @ApiResponse({ status: 409, schema: openApiSchema(errorOutput) })
  create(@CurrentUser() user: string, @Body() body: unknown) {
    return this.service.create(user, parse(organizationInput, body));
  }
  @Patch("organizations/:org")
  @ApiParam({ name: "org", format: "uuid" })
  @ApiOperation({
    summary: "Corregir nombre y zona horaria de la organización",
    description:
      "Sólo OWNER/ADMIN. expected evita sobrescribir cambios simultáneos. No cambia slug ni instantes UTC de servicios.",
  })
  @ApiBody({ schema: openApiSchema(organizationUpdateInput) })
  @ApiResponse({ status: 200, schema: openApiSchema(organizationOutput) })
  @ApiResponse({ status: 409, schema: openApiSchema(errorOutput) })
  update(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Body() body: unknown,
  ) {
    return this.service.update(user, org, parse(organizationUpdateInput, body));
  }
  @Get("organizations/:org/members")
  @ApiParam({ name: "org", format: "uuid" })
  @ApiOperation({
    summary: "Listar equipo",
    description:
      "Requiere OWNER o ADMIN. Búsqueda por nombre o email; orden joinedAt descendente, id ascendente.",
  })
  @ApiQuery({
    name: "page",
    required: false,
    schema: { type: "integer", minimum: 1, default: 1 },
  })
  @ApiQuery({
    name: "limit",
    required: false,
    schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
  })
  @ApiQuery({
    name: "search",
    required: false,
    schema: { type: "string", maxLength: 120 },
  })
  @ApiResponse({ status: 200, schema: openApiSchema(memberPageOutput) })
  members(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Query() query: unknown,
  ) {
    const q = parse(pageInput, query);
    return this.service.members(user, org, q.page, q.limit, q.search);
  }
  @Post("organizations/:org/invitations")
  @ApiParam({ name: "org", format: "uuid" })
  @ApiBody({ schema: openApiSchema(invitationInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(invitationOutput) })
  invite(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Body() body: unknown,
  ) {
    return this.service.invite(user, org, parse(invitationInput, body));
  }
  @Patch("organizations/:org/members/:id")
  @ApiParam({ name: "org", format: "uuid" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({
    summary: "Actualizar acceso",
    description:
      "Sólo OWNER gestiona OWNER/ADMIN. Protege último propietario activo y rechaza valores esperados obsoletos con 409.",
  })
  @ApiBody({ schema: openApiSchema(membershipUpdateInput) })
  @ApiResponse({ status: 200, schema: openApiSchema(memberOutput) })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  @ApiResponse({ status: 409, schema: openApiSchema(errorOutput) })
  updateMember(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.updateMember(
      user,
      org,
      uuid(id),
      parse(membershipUpdateInput, body),
    );
  }
  @Post("organizations/:org/invitations/:id/revoke")
  @ApiParam({ name: "org", format: "uuid" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 201, schema: openApiSchema(okOutput) })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  revoke(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Param("id") id: string,
  ) {
    return this.service.revoke(user, org, uuid(id));
  }
  @Post("invitations/preview")
  @ApiBody({ schema: openApiSchema(tokenInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(invitationPreviewOutput) })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  preview(@Body() body: unknown) {
    return this.service.preview(parse(tokenInput, body).token);
  }
  @Post("invitations/accept")
  @ApiOperation({
    summary: "Aceptar invitación",
    description:
      "Crea Membership MEMBER activa. Una pertenencia suspendida o dada de baja exige reactivación por la organización (409).",
  })
  @ApiBody({ schema: openApiSchema(tokenInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(membershipOutput) })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  @ApiResponse({ status: 409, schema: openApiSchema(errorOutput) })
  accept(@CurrentUser() user: string, @Body() body: unknown) {
    return this.service.accept(user, parse(tokenInput, body).token);
  }
}
