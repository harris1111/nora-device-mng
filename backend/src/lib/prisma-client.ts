import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']!, max: 20, idleTimeoutMillis: 30000 });
const prisma = new PrismaClient({ adapter });

export default prisma;
