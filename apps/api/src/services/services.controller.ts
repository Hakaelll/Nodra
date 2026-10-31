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
} from "@nestjs/swagger";
import { ServiceStatus } from "@prisma/client";
import { z } from "zod";
import {
  serviceInput,
  positionInput,
  serviceListInput,
  dashboardInput,
  calendarMonthInput,
} from "@nodra/contracts";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { parse, uuid, openApiSchema } from "../common";
import { ServicesService } from "./services.service";
import {
  statusInput,
  interestInput,
  assignmentInput,
  responseInput,
  serviceOutput,
  positionOutput,
  interestOutput,
  assignmentOutput,
  selectionOutput,
  servicePageOutput,
  serviceDetailOutput,
  dashboardOutput,
  calendarMonthOutput,
} from "./services.schemas";
import { errorOutput } from "../auth/auth.schemas";
@ApiTags("Services")
@ApiParam({ name: "org", format: "uuid" })
@ApiResponse({ status: 400, schema: openApiSchema(errorOutput) })
@ApiResponse({ status: 401, schema: openApiSchema(errorOutput) })
@ApiResponse({ status: 403, schema: openApiSchema(errorOutput) })
@ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
@ApiResponse({ status: 409, schema: openApiSchema(errorOutput) })
@ApiResponse({ status: 500, schema: openApiSchema(errorOutput) })
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("organizations/:org")
export class ServicesController {
  constructor(
    @Inject(ServicesService) private readonly service: ServicesService,
  ) {}
  @Get("dashboard")
  @ApiResponse({ status: 200, schema: openApiSchema(dashboardOutput) })
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
    name: "filter",
    required: false,
    enum: ["upcoming", "drafts", "attention"],
  })
  @ApiQuery({
    name: "day",
    required: false,
    schema: { type: "string", format: "date" },
    description: "Fecha local en la zona horaria de la organización.",
  })
  summary(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Query() query: unknown,
  ) {
    return this.service.summary(user, org, parse(dashboardInput, query));
  }
  @Get("calendar")
  @ApiResponse({ status: 200, schema: openApiSchema(calendarMonthOutput) })
  @ApiQuery({
    name: "month",
    required: false,
    schema: { type: "string", pattern: "^(19|20|21)\\d{2}-(0[1-9]|1[0-2])$" },
    description:
      "Mes local en la zona horaria de la organización (YYYY-MM); por defecto, el actual.",
  })
  calendar(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Query() query: unknown,
  ) {
    return this.service.calendar(
      user,
      org,
      parse(calendarMonthInput, query).month,
    );
  }
  @Get("services")
  @ApiResponse({ status: 200, schema: openApiSchema(servicePageOutput) })
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
  @ApiQuery({ name: "status", required: false, enum: ServiceStatus })
  @ApiQuery({ name: "upcoming", required: false, enum: ["true"] })
  @ApiQuery({
    name: "jobRoleId",
    required: false,
    schema: { type: "string", format: "uuid" },
  })
  @ApiQuery({
    name: "from",
    required: false,
    schema: { type: "string", format: "date-time" },
    description:
      "Inicio inclusivo del intervalo; ISO 8601 con zona. Filtra servicios que se solapan con el intervalo.",
  })
  @ApiQuery({
    name: "to",
    required: false,
    schema: { type: "string", format: "date-time" },
    description: "Final exclusivo del intervalo; debe ser posterior a from.",
  })
  list(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Query() query: unknown,
  ) {
    const q = parse(serviceListInput, query);
    return this.service.list(
      user,
      org,
      q.page,
      q.limit,
      q.search,
      q.status ? parse(z.enum(ServiceStatus), q.status) : undefined,
      q.upcoming === "true",
      { jobRoleId: q.jobRoleId, from: q.from, to: q.to },
    );
  }
  @Get("services/:id")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, schema: openApiSchema(serviceDetailOutput) })
  detail(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Param("id") id: string,
  ) {
    return this.service.detail(user, org, uuid(id));
  }
  @Post("services")
  @ApiResponse({ status: 201, schema: openApiSchema(serviceOutput) })
  @ApiBody({ schema: openApiSchema(serviceInput) })
  create(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Body() body: unknown,
  ) {
    return this.service.create(user, org, parse(serviceInput, body));
  }
  @Patch("services/:id")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: openApiSchema(serviceInput) })
  @ApiResponse({ status: 200, schema: openApiSchema(serviceOutput) })
  edit(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.edit(user, org, uuid(id), parse(serviceInput, body));
  }
  @Post("services/:id/positions")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: openApiSchema(positionInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(positionOutput) })
  position(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.addPosition(
      user,
      org,
      uuid(id),
      parse(positionInput, body),
    );
  }
  @Post("services/:id/status")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: openApiSchema(statusInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(serviceOutput) })
  status(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.transition(
      user,
      org,
      uuid(id),
      parse(statusInput, body).status,
    );
  }
  @Post("positions/:id/interest")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: openApiSchema(interestInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(interestOutput) })
  interest(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.interest(
      user,
      org,
      uuid(id),
      parse(interestInput, body).interested,
    );
  }
  @Post("positions/:id/assignments")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: openApiSchema(assignmentInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(selectionOutput) })
  assign(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.assign(
      user,
      org,
      uuid(id),
      parse(assignmentInput, body).userId,
    );
  }
  @Post("assignments/:id/respond")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: openApiSchema(responseInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(assignmentOutput) })
  respond(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.respond(
      user,
      org,
      uuid(id),
      parse(responseInput, body).response,
    );
  }
}
