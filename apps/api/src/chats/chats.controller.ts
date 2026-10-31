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
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { errorOutput } from "../auth/auth.schemas";
import { openApiSchema, parse, uuid } from "../common";
import {
  chatMessageOutput,
  chatMessagePageOutput,
  chatCandidatesOutput,
  chatOutput,
  chatPageOutput,
  createChatInput,
  sendChatMessageInput,
} from "./chats.schemas";
import { z } from "zod";
import { ChatsService } from "./chats.service";

@ApiTags("Chats")
@ApiBearerAuth()
@ApiParam({ name: "org", format: "uuid" })
@ApiResponse({ status: 400, schema: openApiSchema(errorOutput) })
@ApiResponse({ status: 401, schema: openApiSchema(errorOutput) })
@ApiResponse({ status: 403, schema: openApiSchema(errorOutput) })
@UseGuards(AuthGuard)
@Controller("organizations/:org/chats")
export class ChatsController {
  constructor(@Inject(ChatsService) private readonly chats: ChatsService) {}

  @Get()
  @ApiOperation({ summary: "Listar sólo los chats en los que participas" })
  @ApiResponse({ status: 200, schema: openApiSchema(chatPageOutput) })
  list(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Query() q: unknown,
  ) {
    const { page, limit } = parse(pageInput, q);
    return this.chats.list(user, uuid(org), page, limit);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Contar chats y mensajes sin leer" })
  @ApiResponse({
    status: 200,
    schema: openApiSchema(
      z
        .object({
          count: z.number().int().min(0),
          chatsCount: z.number().int().min(0),
        })
        .strict(),
    ),
  })
  unreadCount(@CurrentUser() user: string, @Param("org") org: string) {
    return this.chats.unreadCount(user, uuid(org));
  }

  @Get("candidates")
  @ApiOperation({ summary: "Buscar compañeros activos para un chat manual" })
  @ApiResponse({ status: 200, schema: openApiSchema(chatCandidatesOutput) })
  candidates(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Query() q: unknown,
  ) {
    const { page, limit, search } = parse(pageInput, q);
    return this.chats.candidates(user, uuid(org), page, limit, search);
  }

  @Post()
  @ApiOperation({ summary: "Crear chat manual o desde un servicio confirmado" })
  @ApiBody({ schema: openApiSchema(createChatInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(chatOutput) })
  @ApiResponse({ status: 409, schema: openApiSchema(errorOutput) })
  create(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Body() body: unknown,
  ) {
    return this.chats.create(user, uuid(org), parse(createChatInput, body));
  }

  @Get(":id")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, schema: openApiSchema(chatOutput) })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  detail(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Param("id") id: string,
  ) {
    return this.chats.detail(user, uuid(org), uuid(id));
  }

  @Post(":id/read")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "Marcar como leído un chat propio" })
  @ApiResponse({
    status: 201,
    schema: openApiSchema(z.object({ ok: z.boolean() }).strict()),
  })
  markRead(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Param("id") id: string,
  ) {
    return this.chats.markRead(user, uuid(org), uuid(id));
  }

  @Delete(":id")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({
    summary: "Borrar el chat de la lista propia; un mensaje nuevo lo recupera",
  })
  @ApiResponse({
    status: 200,
    schema: openApiSchema(z.object({ ok: z.literal(true) }).strict()),
  })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  hide(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Param("id") id: string,
  ) {
    return this.chats.hide(user, uuid(org), uuid(id));
  }

  @Get(":id/messages")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, schema: openApiSchema(chatMessagePageOutput) })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  messages(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Param("id") id: string,
    @Query() q: unknown,
  ) {
    const { page, limit } = parse(pageInput, q);
    return this.chats.messages(user, uuid(org), uuid(id), page, limit);
  }

  @Post(":id/messages")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: openApiSchema(sendChatMessageInput) })
  @ApiResponse({ status: 201, schema: openApiSchema(chatMessageOutput) })
  @ApiResponse({ status: 404, schema: openApiSchema(errorOutput) })
  send(
    @CurrentUser() user: string,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.chats.send(
      user,
      uuid(org),
      uuid(id),
      parse(sendChatMessageInput, body),
    );
  }
}
