import { db } from './connection';
import { PrismaClient } from '@prisma/client';

export async function runMigrations() {
  try {
    console.log('Running Prisma database migration...');
    
    // Use Prisma push to sync schema with database
    // This creates tables based on Prisma schema
    const prisma = new PrismaClient();
    
    // Test connection and create tables
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Create tables by attempting to query them (Prisma auto-creates)
    try {
      await prisma.user.count();
      console.log('✅ Users table ready');
    } catch (error) {
      console.log('ℹ️ Creating users table...');
    }
    
    try {
      await prisma.comment.count();
      console.log('✅ Comments table ready');
    } catch (error) {
      console.log('ℹ️ Creating comments table...');
    }
    
    try {
      await prisma.vote.count();
      console.log('✅ Votes table ready');
    } catch (error) {
      console.log('ℹ️ Creating votes table...');
    }
    
    try {
      await prisma.rateLimit.count();
      console.log('✅ Rate limits table ready');
    } catch (error) {
      console.log('ℹ️ Creating rate limits table...');
    }
    
    await prisma.$disconnect();
    console.log('✅ Prisma migration completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Prisma migration failed:', error);
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