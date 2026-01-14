import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export function createClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.POSTGRES_URL,
        },
      },
      log: ['error'],
    });
  }
  return globalForPrisma.prisma;
}

export const db = createClient();

// Connect to database
export async function connectDatabase() {
  try {
    await db.$connect();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

export async function testConnection() {
  try {
    await connectDatabase();
    const result = await db.$queryRaw`SELECT NOW()`;
    console.log('Database connected:', result);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}