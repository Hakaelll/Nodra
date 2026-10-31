import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { pageInput } from "@nodra/contracts";
import { parse, uuid, openApiSchema } from "../common";
import { AuthGuard, CurrentUser } from "./auth.guard";
import { errorOutput, okOutput } from "./auth.schemas";
import {
  deviceOutput,
  devicePageOutput,
  deviceRegistrationInput,
} from "./devices.schemas";
import { DevicesService } from "./devices.service";

@ApiTags("Devices")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@ApiResponse({ status: 400, schema: openApiSchema(errorOutput) })
@ApiResponse({ status: 401, schema: openApiSchema(errorOutput) })
@ApiResponse({ status: 409, schema: openApiSchema(errorOutput) })
@Controller("auth/devices")
export class DevicesController {
  constructor(
    @Inject(DevicesService) private readonly devices: DevicesService,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Registrar o renovar una instalación propia sin devolver su token",
  })
  @ApiBody({ schema: openApiSchema(deviceRegistrationInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(deviceOutput) })
  register(@CurrentUser() user: string, @Body() body: unknown) {
    return this.devices.register(user, parse(deviceRegistrationInput, body));
  }

  @Get()
  @ApiOperation({
    summary: "Listar metadatos de instalaciones propias activas",
  })
  @ApiResponse({ status: 200, schema: openApiSchema(devicePageOutput) })
  list(@CurrentUser() user: string, @Query() query: unknown) {
    const { page, limit } = parse(pageInput, query);
    return this.devices.list(user, page, limit);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Revocar una instalación propia" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, schema: openApiSchema(okOutput) })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  revoke(@CurrentUser() user: string, @Param("id") id: string) {
    return this.devices.revoke(user, uuid(id));
  }
}
