import {
  Global,
  Injectable,
  Module,
  OnModuleDestroy,
  ConflictException,
} from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { configuration } from "@nodra/config";
import { isTransactionConflict } from "./transaction-conflict";

@Injectable()
export class Database extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: configuration().DATABASE_URL,
        options: "-c timezone=UTC",
      }),
    });
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
  async atomic<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.$transaction(fn, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (isTransactionConflict(error)) {
          if (attempt < 3) continue;
          throw new ConflictException(
            "Los datos han cambiado. Actualiza y vuelve a intentarlo.",
          );
        }
        throw error;
      }
    }
  }
}
@Global()
@Module({ providers: [Database], exports: [Database] })
export class DatabaseModule {}
