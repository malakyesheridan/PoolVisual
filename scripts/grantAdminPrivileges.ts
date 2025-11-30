/**
 * Grant Admin Privileges Script
 * 
 * Grants admin privileges to a user by email address.
 * This script should be run after migration 019_admin_system.sql
 * 
 * Usage: npx tsx scripts/grantAdminPrivileges.ts <email>
 * Example: npx tsx scripts/grantAdminPrivileges.ts malakyse@easyflow.au
 */

// Load environment variables first (must be before any imports that use process.env)
import '../server/bootstrapEnv.js';

// Import storage after environment is loaded
import { storage } from '../server/storage.js';

const TARGET_EMAIL = process.argv[2] || 'malakyse@easyflow.au';

async function grantAdminPrivileges() {
  try {
    console.log('\n🔐 Granting admin privileges...\n');
    console.log(`Target email: ${TARGET_EMAIL}\n`);

    // Normalize email to lowercase
    const normalizedEmail = TARGET_EMAIL.toLowerCase().trim();

    // Check if user exists
    const existingUser = await storage.getUserByEmail(normalizedEmail);
    
    if (!existingUser) {
      console.error(`❌ User not found with email: ${normalizedEmail}`);
      console.error('   Please ensure the user exists before granting admin privileges.\n');
      process.exit(1);
    }
    
    console.log(`✅ User found:`);
    console.log(`   User ID: ${existingUser.id}`);
    console.log(`   Email: ${existingUser.email}`);
    console.log(`   Username: ${existingUser.username || 'N/A'}`);
    console.log(`   Current Admin Status: ${existingUser.isAdmin ? 'Yes' : 'No'}\n`);
    
    if (existingUser.isAdmin) {
      console.log('⚠️  User already has admin privileges.');
      console.log('   Updating permissions to ensure full access...\n');
    }
    
    // Grant admin privileges
    const updatedUser = await storage.updateUser(existingUser.id, {
      isAdmin: true,
      adminPermissions: ['*'], // All permissions
      isActive: true, // Ensure account is active
      emailVerified: true, // Ensure email is verified
    });
    
    console.log('✅ Admin privileges granted successfully!');
    console.log(`   User ID: ${updatedUser.id}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Is Admin: ${updatedUser.isAdmin}`);
    console.log(`   Permissions: ${JSON.stringify(updatedUser.adminPermissions || [])}\n`);

    // Verify admin user
    const verifyUser = await storage.getUserByEmail(normalizedEmail);
    if (verifyUser && verifyUser.isAdmin) {
      console.log('✅ Verification: User has admin privileges and can access admin dashboard\n');
      console.log('📋 Next steps:');
      console.log('   1. User should log out and log back in to refresh their session');
      console.log('   2. User can now access /admin to view the admin dashboard');
      console.log('   3. User has full system access with all permissions\n');
    } else {
      console.error('❌ Verification failed: User not found or not marked as admin\n');
      process.exit(1);
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to grant admin privileges:', error.message);
    console.error(error);
    process.exit(1);
  }
}

grantAdminPrivileges();

