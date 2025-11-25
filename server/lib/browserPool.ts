/**
 * Browser Connection Pool
 * Reuses browser instances for better performance in serverless environments
 */

export class BrowserPool {
  private browsers: any[] = [];
  private maxSize: number = 2; // Max browsers in pool
  private currentSize: number = 0;
  private isInitializing: boolean = false;
  private readonly MAX_PAGES_PER_BROWSER = 5;

  /**
   * Get a browser from the pool or create a new one
   */
  async getBrowser(): Promise<any> {
    // Return existing browser if available
    if (this.browsers.length > 0) {
      const browser = this.browsers.pop()!;
      // Verify browser is still connected
      try {
        await browser.version(); // Quick health check
        return browser;
      } catch (error) {
        // Browser disconnected, don't return to pool
        this.currentSize--;
        // Try to get another browser
        return this.getBrowser();
      }
    }

    // Create new browser if under limit
    if (this.currentSize < this.maxSize) {
      return await this.createBrowser();
    }

    // Wait for browser to become available (with timeout)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Browser pool timeout: no browsers available'));
      }, 10000); // 10 second timeout

      const checkInterval = setInterval(() => {
        if (this.browsers.length > 0) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          const browser = this.browsers.pop()!;
          resolve(browser);
        }
      }, 100);
    });
  }

  /**
   * Return browser to pool or close if too many pages
   */
  async releaseBrowser(browser: any): Promise<void> {
    if (!browser) return;

    // Check if browser is still connected
    try {
      const pages = await browser.pages();
      
      // If browser has too many pages or is disconnected, close it
      if (pages.length >= this.MAX_PAGES_PER_BROWSER) {
        await browser.close().catch(() => {});
        this.currentSize--;
        return;
      }

      // Return browser to pool
      this.browsers.push(browser);
    } catch (error) {
      // Browser disconnected, don't return to pool
      this.currentSize--;
    }
  }

  /**
   * Create a new browser instance
   */
  private async createBrowser(): Promise<any> {
    this.currentSize++;
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
    
    try {
      if (isProduction) {
        // Production/Vercel: Use puppeteer-core with @sparticuz/chromium
        const puppeteerCore = await import('puppeteer-core');
        const chromium = await import('@sparticuz/chromium');
        
        if (chromium.default && typeof (chromium.default as any).setGraphicsMode === 'function') {
          (chromium.default as any).setGraphicsMode(false);
        }
        
        const executablePath = await chromium.default.executablePath();
        
        return await puppeteerCore.default.launch({
          args: chromium.default.args,
          defaultViewport: chromium.default.defaultViewport,
          executablePath,
          headless: chromium.default.headless,
        });
      } else {
        // Development: Use regular puppeteer (includes Chrome)
        const puppeteer = await import('puppeteer');
        return await puppeteer.default.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }
    } catch (error) {
      this.currentSize--;
      throw error;
    }
  }

  /**
   * Cleanup all browsers in pool
   */
  async cleanup(): Promise<void> {
    await Promise.all(
      this.browsers.map(browser => 
        browser.close().catch(() => {})
      )
    );
    this.browsers = [];
    this.currentSize = 0;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      poolSize: this.browsers.length,
      currentSize: this.currentSize,
      maxSize: this.maxSize
    };
  }
}

export const browserPool = new BrowserPool();

