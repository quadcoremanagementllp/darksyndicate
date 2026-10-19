import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const databaseUrl = process.env.DATABASE_URL;
const datasourceUrl =
  process.env.DB_SSL === 'true' && databaseUrl && !databaseUrl.includes('sslaccept=')
    ? `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslaccept=strict`
    : databaseUrl;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: datasourceUrl,
  },
});
