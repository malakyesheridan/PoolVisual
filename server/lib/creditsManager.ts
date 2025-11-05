/**
 * Credits Manager - Estimate, reserve, and refund credits atomically
 */

export class CreditsManager {
  /**
   * Estimate cost in microdollars
   */
  static estimateCost(params: {
    imageMegapixels: number;
    regionCount: number;
    hasControlNets: boolean;
  }): number {
    const base = 100000; // $0.10
    const perMP = 50000; // $0.05/MP
    const perRegion = 75000; // $0.075/region
    const control = params.hasControlNets ? 100000 : 0;
    
    return base + (params.imageMegapixels * perMP) + (params.regionCount * perRegion) + control;
  }

  /**
   * Reserve credits atomically in transaction
   */
  static async reserveCredits(db: any, tenantId: string, costMicros: number) {
    return db.tx(async (t: any) => {
      const rows = await t.execute(
        `SELECT credits_balance FROM orgs WHERE id = $1 FOR UPDATE`,
        [tenantId]
      );
      
      if (!rows.length) {
        throw new Error('Organization not found');
      }
      
      const bal = Number(rows[0].credits_balance || 0);
      
      if (bal < costMicros) {
        return { reserved: false, newBalance: bal };
      }
      
      const newBal = bal - costMicros;
      
      await t.execute(
        `UPDATE orgs SET credits_balance = $1, credits_updated_at = NOW() WHERE id = $2`,
        [newBal, tenantId]
      );
      
      return { reserved: true, newBalance: newBal };
    });
  }

  /**
   * Refund credits on failure or cancel
   */
  static async refundCredits(db: any, tenantId: string, costMicros: number) {
    await db.execute(
      `UPDATE orgs SET credits_balance = credits_balance + $1, credits_updated_at = NOW() WHERE id = $2`,
      [costMicros, tenantId]
    );
  }
}

