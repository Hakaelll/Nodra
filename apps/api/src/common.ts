import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
export function openApiSchema(schema: z.ZodType): SchemaObject {
  return z.toJSONSchema(schema, {
    io: "input",
    target: "openapi-3.0",
  }) as SchemaObject;
}
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  return result.data;
}
export function uuid(value: string) {
  return parse(z.uuid(), value);
}
export const publicUser = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const;
const parserMessages: Partial<Record<number, string>> = {
  400: "No se pudo leer la solicitud. Revisa el formato de los datos.",
  413: "El archivo o la solicitud supera el tamaño permitido.",
  415: "El formato de la solicitud no está admitido.",
};
@Catch()
export class ApiErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    let status = 500,
      code = "INTERNAL_ERROR",
      message = "No se pudo completar la operación. Vuelve a intentarlo.";
    if (error instanceof HttpException) {
      status = error.getStatus();
      if (status < 500) {
        code = error.name.replace(/Exception$/, "").toUpperCase();
        message =
          code === "HTTP"
            ? (parserMessages[status] ?? error.message)
            : error.message;
      }
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        status = 409;
        code = "CONFLICT";
        message = "Ya existe un registro con estos datos.";
      } else if (error.code === "P2025") {
        status = 404;
        code = "NOT_FOUND";
        message = "No se encontró el registro.";
      } else if (["P2003", "P2004", "P2034"].includes(error.code)) {
        status = 409;
        code = "CONFLICT";
        message = "Los datos han cambiado. Actualiza y vuelve a intentarlo.";
      }
    }
    if (status >= 500)
      request.log.error(
        {
          requestId: request.id,
          errorType:
            error instanceof Error ? error.constructor.name : "Unknown",
        },
        "Request failed",
      );
    void reply.status(status).send({ code, message, requestId: request.id });
  }
}
