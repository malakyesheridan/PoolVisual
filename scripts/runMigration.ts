#!/usr/bin/env tsx
// Run migration script using Node.js instead of psql
import { getSql } from '../server/db.js';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('📦 Running migration: 010_system_mask_query.sql\n');
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '010_system_mask_query.sql');
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded\n');
    
    // Get database connection
    const sql = getSql();
    if (!sql) {
      throw new Error('Database connection not available');
    }
    
    console.log('🔄 Executing migration...\n');
    
    // Execute the migration using executeQuery helper
    // The migration SQL contains multiple statements, so we need to execute them separately
    // For Neon, we'll use the executeQuery helper which handles parameterized queries
    
    // Split by semicolons but be careful with function definitions
    // We'll execute the entire migration as one block since it's a function definition
    const { executeQuery } = await import('../server/lib/dbHelpers.js');
    
    // Execute the entire migration SQL
    // Replace the function creation with CREATE OR REPLACE to handle re-runs
    const migrationSQLFixed = migrationSQL.replace(
      /CREATE OR REPLACE FUNCTION/gi,
      'CREATE OR REPLACE FUNCTION'
    );
    
    // Split migration into individual statements
    // Neon doesn't support multiple commands in one query
    // The migration has 3 statements: CREATE FUNCTION, GRANT, COMMENT
    
    // Extract the function definition (from CREATE to closing $$;)
    // The function uses $$ delimiters, so we need to match the full body
    const functionMatch = migrationSQLFixed.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$;/);
    const grantMatch = migrationSQLFixed.match(/GRANT[\s\S]*?;/);
    const commentMatch = migrationSQLFixed.match(/COMMENT[\s\S]*?;/);
    
    // Execute function creation
    if (functionMatch) {
      try {
        const functionSQL = functionMatch[0].trim();
        // The function SQL should end with $$; - execute it as-is
        await executeQuery(functionSQL, []);
        console.log('✅ Created function get_masks_by_photo_system()');
      } catch (error: any) {
        if (error.code === '42723' || error.message?.includes('already exists')) {
          console.log('⚠️  Function already exists (skipping)');
        } else {
          console.error('❌ Error creating function:', error.message);
          console.error('   Code:', error.code);
          // Log the SQL for debugging (first 200 chars)
          console.error('   SQL preview:', functionMatch[0].substring(0, 200) + '...');
          throw error;
        }
      }
    } else {
      throw new Error('Could not extract function definition from migration SQL');
    }
    
    // Execute GRANT statement
    if (grantMatch) {
      try {
        await executeQuery(grantMatch[0].trim(), []);
        console.log('✅ Granted execute permission');
      } catch (error: any) {
        console.log('⚠️  Grant statement failed (may already be granted):', error.message);
        // Don't fail on grant errors
      }
    }
    
    // Execute COMMENT statement
    if (commentMatch) {
      try {
        await executeQuery(commentMatch[0].trim(), []);
        console.log('✅ Added function comment');
      } catch (error: any) {
        console.log('⚠️  Comment statement failed (non-critical):', error.message);
        // Don't fail on comment errors
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('📝 Function get_masks_by_photo_system() is now available\n');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

runMigration();

