import { pool } from "../server/db";

(async () => {
  try {
    const r = await pool.query("SELECT 1");
    console.log("✅ DB reachable:", r.rows);
    process.exit(0);
  } catch (e: any) {
    console.error("❌ DB failed:", e.message);
    process.exit(1);
  }
})();
