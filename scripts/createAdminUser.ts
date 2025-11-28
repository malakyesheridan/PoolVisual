/**
 * Create Admin User Script
 * 
 * Creates or updates the hard-coded admin user with full system access.
 * This script should be run after migration 019_admin_system.sql
 */

import { config } from 'dotenv';
import { storage } from '../server/storage.js';
import { PasswordService } from '../server/lib/passwordService.js';

config();

const ADMIN_EMAIL = 'malakye@easyflow.au';
const ADMIN_PASSWORD = 'Sainters12';
const ADMIN_USERNAME = 'admin';

async function createAdminUser() {
  try {
    console.log('\n🔐 Creating admin user...\n');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Username: ${ADMIN_USERNAME}\n`);

    // Normalize email to lowercase
    const normalizedEmail = ADMIN_EMAIL.toLowerCase().trim();

    // Check if admin user already exists
    const existingUser = await storage.getUserByEmail(normalizedEmail);
    
    if (existingUser) {
      console.log('⚠️  Admin user already exists. Updating...\n');
      
      // Hash password
      const hashedPassword = await PasswordService.hashPassword(ADMIN_PASSWORD);
      
      // Update user to be admin
      const updatedUser = await storage.updateUser(existingUser.id, {
        isAdmin: true,
        adminPermissions: ['*'], // All permissions
        emailVerified: true,
        isActive: true,
        password: hashedPassword, // Update password in case it changed
      });
      
      console.log('✅ Admin user updated successfully!');
      console.log(`   User ID: ${updatedUser.id}`);
      console.log(`   Email: ${updatedUser.email}`);
      console.log(`   Is Admin: ${updatedUser.isAdmin}`);
      console.log(`   Permissions: ${JSON.stringify(updatedUser.adminPermissions)}\n`);
    } else {
      console.log('📝 Creating new admin user...\n');
      
      // Hash password
      const hashedPassword = await PasswordService.hashPassword(ADMIN_PASSWORD);
      
      // Create admin user
      const newUser = await storage.createUser({
        email: normalizedEmail,
        username: ADMIN_USERNAME,
        password: hashedPassword,
        isAdmin: true,
        adminPermissions: ['*'], // All permissions
        emailVerified: true,
        isActive: true,
        failedLoginAttempts: 0,
        loginCount: 0,
      });
      
      console.log('✅ Admin user created successfully!');
      console.log(`   User ID: ${newUser.id}`);
      console.log(`   Email: ${newUser.email}`);
      console.log(`   Username: ${newUser.username}`);
      console.log(`   Is Admin: ${newUser.isAdmin}`);
      console.log(`   Permissions: ${JSON.stringify(newUser.adminPermissions)}\n`);
    }

    // Verify admin user
    const verifyUser = await storage.getUserByEmail(normalizedEmail);
    if (verifyUser && verifyUser.isAdmin) {
      console.log('✅ Verification: Admin user is active and has admin privileges\n');
    } else {
      console.error('❌ Verification failed: Admin user not found or not marked as admin\n');
      process.exit(1);
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to create admin user:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createAdminUser();

