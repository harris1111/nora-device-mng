import { PrismaClient } from '../generated/prisma/client.js';

// @ts-expect-error Prisma 7 constructor typing issue
const prisma = new PrismaClient();

export default prisma;
