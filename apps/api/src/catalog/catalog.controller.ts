import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
  Inject,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiOperation,
} from "@nestjs/swagger";
import { z } from "zod";
import {
  roleInput,
  pageInput,
  roleCatalogInput,
  organizationCustomizationUpdateInput,
  notificationOutput,
  serviceActivityPageOutput,
} from "@nodra/contracts";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { parse, uuid, openApiSchema } from "../common";
import { CatalogService } from "./catalog.service";
import {
  groupInput,
  roleUpdateInput,
  groupUpdateInput,
  groupMemberInput,
  roleOutput,
  roleCatalogOutput,
  groupOutput,
  groupListOutput,
  candidatesOutput,
  noticeInput,
  acknowledgementOutput,
  noticeOutput,
  noticePageOutput,
  settingsOutput,
  updateFeaturesInput,
} from "./catalog.schemas";
import { okOutput, errorOutput } from "../auth/auth.schemas";
@ApiTags("Catalog")
@ApiParam({ name: "org", format: "uuid" })
@ApiResponse({ status: 400, schema: openApiSchema(errorOutput) })
@ApiResponse({ status: 401, schema: openApiSchema(errorOutput) })
@ApiResponse({ status: 403, schema: openApiSchema(errorOutput) })
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("organizations/:org")
export class CatalogController {
  constructor(
    @Inject(CatalogService) private readonly service: CatalogService,
  ) {}
  @Get("roles")
  @ApiOperation({
    summary: "Listar roles operativos",
    description: "Hasta 100 roles, ordenados por nombre.",
  })
  @ApiResponse({ status: 200, schema: openApiSchema(z.array(roleOutput)) })
  roles(@CurrentUser() u: string, @Param("org") o: string) {
    return this.service.roles(u, o);
  }
  @Get("roles/catalog")
  @ApiOperation({ summary: "Buscar roles laborales con paginación" })
  @ApiResponse({ status: 200, schema: openApiSchema(roleCatalogOutput) })
  @ApiQuery({
    name: "page",
    required: false,
    schema: { type: "integer", minimum: 1, maximum: 100000, default: 1 },
  })
  @ApiQuery({
    name: "limit",
    required: false,
    schema: { type: "integer", minimum: 1, maximum: 50, default: 10 },
  })
  @ApiQuery({
    name: "search",
    required: false,
    schema: { type: "string", maxLength: 120 },
  })
  @ApiQuery({ name: "active", required: false, enum: ["true", "false"] })
  roleCatalog(
    @CurrentUser() u: string,
    @Param("org") o: string,
    @Query() q: unknown,
  ) {
    return this.service.roleCatalog(u, o, parse(roleCatalogInput, q));
  }
  @Post("roles")
  @ApiBody({ schema: openApiSchema(roleInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(roleOutput) })
  @ApiResponse({ status: 409, schema: openApiSchema(errorOutput) })
  role(@CurrentUser() u: string, @Param("org") o: string, @Body() b: unknown) {
    return this.service.role(u, o, parse(roleInput, b));
  }
  @Patch("roles/:id")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "Editar o archivar un rol operativo" })
  @ApiBody({ schema: openApiSchema(roleUpdateInput) })
  @ApiResponse({ status: 200, schema: openApiSchema(roleOutput) })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  @ApiResponse({ status: 409, schema: openApiSchema(errorOutput) })
  updateRole(
    @CurrentUser() u: string,
    @Param("org") o: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.service.updateRole(u, o, uuid(id), parse(roleUpdateInput, b));
  }
  @Get("groups")
  @ApiOperation({
    summary: "Listar grupos activos",
    description:
      "Grupos paginados por nombre e id. MEMBER sólo ve los grupos a los que pertenece.",
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
  @ApiResponse({ status: 200, schema: openApiSchema(groupListOutput) })
  groups(
    @CurrentUser() u: string,
    @Param("org") o: string,
    @Query() q: unknown,
  ) {
    const p = parse(pageInput, q);
    return this.service.groups(u, o, p.page, p.limit);
  }
  @Get("notices/candidates")
  @ApiOperation({ summary: "Buscar destinatarios activos de avisos" })
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
  @ApiResponse({ status: 200, schema: openApiSchema(candidatesOutput) })
  noticeCandidates(
    @CurrentUser() u: string,
    @Param("org") o: string,
    @Query() q: unknown,
  ) {
    const p = parse(pageInput, q);
    return this.service.noticeCandidates(u, o, p.page, p.limit, p.search);
  }
  @Get("groups/:id/candidates")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({
    summary: "Buscar participantes activos",
    description:
      "Requiere OWNER, ADMIN o COORDINATOR; el grupo debe estar activo.",
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
  @ApiResponse({ status: 200, schema: openApiSchema(candidatesOutput) })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  candidates(
    @CurrentUser() u: string,
    @Param("org") o: string,
    @Param("id") id: string,
    @Query() q: unknown,
  ) {
    const p = parse(pageInput, q);
    return this.service.groupCandidates(
      u,
      o,
      uuid(id),
      p.page,
      p.limit,
      p.search,
    );
  }
  @Post("groups")
  @ApiBody({ schema: openApiSchema(groupInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(groupOutput) })
  @ApiResponse({ status: 409, schema: openApiSchema(errorOutput) })
  group(@CurrentUser() u: string, @Param("org") o: string, @Body() b: unknown) {
    return this.service.group(u, o, parse(groupInput, b));
  }
  @Patch("groups/:id")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: openApiSchema(groupUpdateInput) })
  @ApiResponse({ status: 200, schema: openApiSchema(okOutput) })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  @ApiResponse({ status: 409, schema: openApiSchema(errorOutput) })
  updateGroup(
    @CurrentUser() u: string,
    @Param("org") o: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.service.updateGroup(u, o, uuid(id), parse(groupUpdateInput, b));
  }
  @Post("groups/:id/members")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: openApiSchema(groupMemberInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(okOutput) })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  groupMember(
    @CurrentUser() u: string,
    @Param("org") o: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const data = parse(groupMemberInput, b);
    return this.service.groupMember(
      u,
      o,
      uuid(id),
      data.membershipId,
      data.add,
    );
  }
  @Get("notices")
  @ApiOperation({
    summary: "Listar avisos",
    description:
      "OWNER, ADMIN y COORDINATOR reciben los nombres de quienes confirmaron lectura. MEMBER sólo recibe su propia confirmación.",
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
  @ApiResponse({ status: 200, schema: openApiSchema(noticePageOutput) })
  @ApiQuery({
    name: "pendingAcknowledgement",
    required: false,
    enum: ["true", "false"],
    description:
      "Sólo avisos que requieren acuse y que el usuario actual aún no ha leído.",
  })
  notices(
    @CurrentUser() u: string,
    @Param("org") o: string,
    @Query() q: unknown,
  ) {
    const p = parse(
      pageInput
        .extend({
          pendingAcknowledgement: z.enum(["true", "false"]).optional(),
        })
        .strict(),
      q,
    );
    return this.service.notices(
      u,
      o,
      p.page,
      p.limit,
      p.pendingAcknowledgement === "true",
    );
  }
  @Post("notices")
  @ApiBody({ schema: openApiSchema(noticeInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(noticeOutput) })
  notice(
    @CurrentUser() u: string,
    @Param("org") o: string,
    @Body() b: unknown,
  ) {
    return this.service.notice(u, o, parse(noticeInput, b));
  }
  @Post("notices/:id/acknowledge")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 201, schema: openApiSchema(acknowledgementOutput) })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  @ApiResponse({
    status: 409,
    description: "El aviso no necesita confirmación de lectura.",
    schema: openApiSchema(errorOutput),
  })
  acknowledge(
    @CurrentUser() u: string,
    @Param("org") o: string,
    @Param("id") id: string,
  ) {
    return this.service.acknowledge(u, o, uuid(id));
  }
  @Get("notifications")
  @ApiOperation({
    summary: "Listar notificaciones propias",
    description:
      "Array paginado, sin contador total; sólo usuario actual y organización activa.",
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
  @ApiResponse({
    status: 200,
    schema: openApiSchema(z.array(notificationOutput)),
  })
  notifications(
    @CurrentUser() u: string,
    @Param("org") o: string,
    @Query() q: unknown,
  ) {
    const p = parse(pageInput, q);
    return this.service.notifications(u, o, p.page, p.limit);
  }
  @Get("service-activity")
  @ApiOperation({
    summary: "Actividad propia de servicios",
    description:
      "Eventos de servicio y asignación para el usuario actual, con servicios cancelados después de los activos antes de paginar. Excluye avisos manuales para evitar duplicados.",
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
  @ApiResponse({
    status: 200,
    schema: openApiSchema(serviceActivityPageOutput),
  })
  serviceActivity(
    @CurrentUser() u: string,
    @Param("org") o: string,
    @Query() q: unknown,
  ) {
    const p = parse(pageInput, q);
    return this.service.serviceActivity(u, o, p.page, p.limit);
  }
  @Patch("settings/customization")
  @ApiOperation({
    summary: "Cambiar terminología y acento limitado de la organización",
    description:
      "Sólo OWNER/ADMIN. Requiere el snapshot esperado; una edición obsoleta devuelve 409.",
  })
  @ApiBody({ schema: openApiSchema(organizationCustomizationUpdateInput) })
  @ApiResponse({ status: 200, schema: openApiSchema(settingsOutput) })
  @ApiResponse({ status: 409, schema: openApiSchema(errorOutput) })
  updateCustomization(
    @CurrentUser() u: string,
    @Param("org") o: string,
    @Body() b: unknown,
  ) {
    return this.service.updateCustomization(
      u,
      o,
      parse(organizationCustomizationUpdateInput, b),
    );
  }
  @Get("settings")
  @ApiResponse({ status: 200, schema: openApiSchema(settingsOutput) })
  settings(@CurrentUser() u: string, @Param("org") o: string) {
    return this.service.settings(u, o);
  }
  @Patch("settings/features")
  @ApiOperation({
    summary: "Activar o desactivar Grupos y Chat en una organización",
    description:
      "Sólo OWNER o ADMIN de la organización pueden cambiar esta función.",
  })
  @ApiBody({ schema: openApiSchema(updateFeaturesInput) })
  @ApiResponse({ status: 200, schema: openApiSchema(settingsOutput) })
  updateFeatures(
    @CurrentUser() u: string,
    @Param("org") o: string,
    @Body() b: unknown,
  ) {
    return this.service.updateFeatures(u, o, parse(updateFeaturesInput, b));
  }
}
