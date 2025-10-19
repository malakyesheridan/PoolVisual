// server/bootstrapEnv.ts
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';
import dotenvExpand from 'dotenv-expand';

// Load .env from repo root (same folder as package.json)
const envPath = path.resolve(process.cwd(), '.env');
const result = config({ path: envPath });
dotenvExpand.expand(result);

// Determine if we should run in no-DB mode
// Force no-DB mode if DATABASE_URL is not set or is empty/invalid
const hasValidDatabaseUrl = process.env.DATABASE_URL && 
  process.env.DATABASE_URL.trim() !== '' && 
  process.env.DATABASE_URL !== 'undefined';

const NO_DB_MODE = !hasValidDatabaseUrl && process.env.PV_REQUIRE_DB !== 'true';

// Log startup mode once
console.log(`[BOOT] DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
console.log(`[BOOT] PV_REQUIRE_DB: ${process.env.PV_REQUIRE_DB || 'NOT SET'}`);
console.log(`[BOOT] mode: ${NO_DB_MODE ? 'no-db' : 'db'}`);

// Only exit if explicitly required to have DB
if (!process.env.DATABASE_URL && process.env.PV_REQUIRE_DB === 'true') {
  const exists = fs.existsSync(envPath);
  const firstLine = exists ? (fs.readFileSync(envPath, 'utf8').split(/\r?\n/)[0] ?? '(empty)') : '(no .env found)';
  console.error('FATAL: DATABASE_URL missing and PV_REQUIRE_DB=true.');
  console.error('CWD:', process.cwd());
  console.error('.env present:', exists);
  console.error('.env first line:', firstLine);
  process.exit(1);
}

// Export the mode for use in other modules
process.env.NO_DB_MODE = NO_DB_MODE.toString();
