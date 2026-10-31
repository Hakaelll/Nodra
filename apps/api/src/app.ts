import "reflect-metadata";
import { Controller, Get, Inject, Module, HttpException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import type { FastifyInstance } from "fastify";
import {
  DocumentBuilder,
  SwaggerModule,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { configuration } from "@nodra/config";
import { Database, DatabaseModule } from "./database";
import { ApiErrors, openApiSchema } from "./common";
import { z } from "zod";
import { errorOutput } from "./auth/auth.schemas";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { ServicesModule } from "./services/services.module";
import { CatalogModule } from "./catalog/catalog.module";
import { ChatsModule } from "./chats/chats.module";
import { ObjectStorageModule } from "./storage/object-storage";
@ApiTags("Health")
@Controller("health")
class HealthController {
  constructor(@Inject(Database) private readonly db: Database) {}
  @Get()
  @ApiResponse({
    status: 200,
    schema: openApiSchema(z.object({ status: z.literal("ok") }).strict()),
  })
  live() {
    return { status: "ok" };
  }
  @Get("ready")
  @ApiResponse({
    status: 200,
    schema: openApiSchema(
      z
        .object({ status: z.literal("ready"), database: z.literal("up") })
        .strict(),
    ),
  })
  @ApiResponse({ status: 500, schema: openApiSchema(errorOutput) })
  async ready() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: "ready", database: "up" };
  }
}
@Module({
  imports: [
    DatabaseModule,
    ObjectStorageModule,
    AuthModule,
    OrganizationsModule,
    ServicesModule,
    CatalogModule,
    ChatsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
export async function createApp(logging = true) {
  const config = configuration();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: logging
        ? {
            redact: [
              "req.headers.authorization",
              "req.headers.cookie",
              "res.headers.set-cookie",
            ],
            serializers: {
              req: (req: { method: string; url: string }) => ({
                method: req.method,
                url: req.url.split("?")[0],
              }),
            },
          }
        : false,
      bodyLimit: 65536,
    }),
    { logger: logging ? ["error", "warn", "log"] : false },
  );
  const server = app
    .getHttpAdapter()
    .getInstance() as unknown as FastifyInstance;
  server.addContentTypeParser(
    "image/jpeg",
    { parseAs: "buffer", bodyLimit: 524288 },
    (_request, body, done) => done(null, body),
  );
  await server.register(helmet);
  server.addHook("onRoute", (route) => {
    if (
      config.NODE_ENV !== "test" &&
      /auth\/(login|register|refresh|password|reset\/request|reset\/complete|verify\/request|verify\/complete)|invitations\/(accept|preview)/.test(
        route.url,
      )
    )
      route.config = {
        ...route.config,
        rateLimit: { max: 10, timeWindow: "1 minute" },
      };
  });
  await server.register(rateLimit, {
    max: config.NODE_ENV === "test" ? 10000 : 120,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.ip,
    global: true,
    errorResponseBuilder: () =>
      new HttpException(
        "Demasiadas peticiones. Espera antes de volver a intentarlo.",
        429,
      ),
  });
  app.enableCors({ origin: config.WEB_ORIGIN, credentials: false });
  app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
  app.useGlobalFilters(new ApiErrors());
  app.enableShutdownHooks();
  const spec = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Nodra API")
      .setVersion("1.0")
      .addBearerAuth()
      .build(),
  );
  for (const path of Object.values(spec.paths)) {
    for (const method of ["get", "post", "patch", "put", "delete"] as const) {
      const operation = path?.[method];
      if (operation)
        operation.responses["429"] = {
          description:
            "Límite por IP: 120/minuto; autenticación sensible e invitaciones accept/preview: 10/minuto por ruta.",
          headers: {
            "Retry-After": {
              description: "Segundos hasta poder reintentar.",
              schema: { type: "integer", minimum: 1 },
            },
          },
          content: {
            "application/json": { schema: openApiSchema(errorOutput) },
          },
        };
    }
  }
  SwaggerModule.setup("docs", app, spec);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
