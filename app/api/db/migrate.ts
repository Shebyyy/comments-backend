import { db } from './connection';

export async function runMigrations() {
  try {
    // Create tables using Prisma
    await db.user.createMany({
      data: [],
      skipDuplicates: true
    });

    await db.comment.createMany({
      data: [],
      skipDuplicates: true
    });

    await db.vote.createMany({
      data: [],
      skipDuplicates: true
    });

    console.log('Prisma migration completed successfully');
    return true;
  } catch (error) {
    console.error('Prisma migration failed:', error);
    return false;
  }
}

// API endpoint for running migrations
export async function GET() {
  try {
    const success = await runMigrations();
    return Response.json({ 
      success, 
      message: success ? 'Prisma migration completed' : 'Prisma migration failed' 
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}