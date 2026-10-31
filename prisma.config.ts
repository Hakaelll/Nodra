import 'dotenv/config';
import { defineConfig } from 'prisma/config';
export default defineConfig({schema:'infrastructure/database/schema.prisma',migrations:{path:'infrastructure/database/migrations'},datasource:{url:process.env.DATABASE_URL ?? 'postgresql://nodra:nodra_local@localhost:5432/nodra'}});
