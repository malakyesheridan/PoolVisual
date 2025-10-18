import axios from 'axios';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import { chromium } from 'playwright';

// Result interfaces
export interface ParsedSizes {
  sheetW?: number;
  sheetH?: number;
  tileW?: number;
  tileH?: number;
  thickness?: number;
  grout?: number;
}

export interface ImageCandidate {
  url: string;
  width?: number;
  height?: number;
  source: string; // 'data-large_image' | 'srcset' | 'src'
}

export interface ParsedProduct {
  name?: string;
  sku?: string;
  price?: number;
  priceRaw?: string;
  imageUrl?: string;
  allImageUrls?: string[];
  sizes: ParsedSizes;
  finish?: string;
  source_url?: string;
  categoryHint?: string;
  unit?: string;
  normalizedPrice?: number;
  priceUnit?: string;
  physical_repeat_m?: number;
  priceSource?: string;
}

// Enhanced regex patterns for WooCommerce parsing
const REGEX_PATTERNS = {
  // Size patterns
  mmPair: /(\d{2,4})\s*[x×]\s*(\d{2,4})\s*mm/gi,
  sheet: /(sheet|sheet size)\s*[:\-]?\s*(\d{2,4})\s*[x×]\s*(\d{2,4})\s*mm/gi,
  tile: /(tile|chip|mosaic|piece)\s*[:\-]?\s*(\d{1,3})\s*[x×]\s*(\d{1,3})\s*mm/gi,
  thickness: /(thickness)\s*[:\-]?\s*(\d{1,2})\s*mm/gi,
  grout: /(grout)\s*[:\-]?\s*(\d{1,2})\s*mm/gi,
  
  // Price patterns
  perM2: /\$?\s*([\d\.,]+)\s*(\/|\s+per\s+)m²/gi,
  perLM: /\$?\s*([\d\.,]+)\s*(\/|\s+per\s+)lm/gi,
  perSheet: /\$?\s*([\d\.,]+)\s*(per|\/)\s*sheet/gi,
  perBox: /\$?\s*([\d\.,]+)\s*(per|\/)\s*box/gi,
  covers: /(covers|box covers)\s*([\d\.,]+)\s*m²/gi,
  
  // Category detection
  waterline: /(waterline|mosaic|glass|border|trim)/i,
  coping: /(coping|bullnose|edge|cap)/i,
  paving: /(paver|deck|outdoor|pathway)/i,
  interior: /(interior|pool finish|plaster)/i,
  fencing: /(fence|fencing|barrier|glass panel)/i,
  
  // Finish patterns
  finish: /(matte|gloss|polished|honed|tumbled|brushed|natural|textured)/gi
};

export class ImportService {
  
  /**
   * Fetch HTML with Playwright fallback for WooCommerce sites
   */
  static async fetchHtml(url: string): Promise<string> {
    try {
      // Try axios first with proper headers
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept-Language': 'en-AU,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Check if we have WooCommerce selectors
      const hasWooGallery = $('.woocommerce-product-gallery').length > 0;
      const hasWooPrice = $('.summary .price').length > 0;
      
      if (hasWooGallery || hasWooPrice) {
        return response.data;
      }
      
      console.log('WooCommerce selectors not found, trying Playwright fallback...');
      
    } catch (error: any) {
      console.log('Axios failed, trying Playwright fallback...', error?.message);
    }
    
    // Playwright fallback
    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // Wait for product title to ensure page is loaded
      await page.waitForSelector('h1.product_title, .product_title, h1.product-title', { timeout: 5000 });
      
      const content = await page.content();
      await browser.close();
      
      return content;
      
    } catch (error: any) {
      throw new Error(`Failed to fetch page content: ${error?.message}`);
    }
  }
  
  /**
   * Parse JSON-LD structured data
   */
  static parseJsonLD($: cheerio.CheerioAPI): Partial<ParsedProduct> {
    const result: Partial<ParsedProduct> = {};
    
    $('script[type="application/ld+json"]').each((_, script) => {
      try {
        const data = JSON.parse($(script).html() || '{}');
        
        if (data['@type'] === 'Product') {
          if (data.name) result.name = data.name;
          if (data.sku) result.sku = data.sku;
          
          // Extract price from offers
          if (data.offers && data.offers.price) {
            result.price = parseFloat(data.offers.price);
            result.priceSource = 'jsonld';
          }
          
          // Extract images
          if (data.image) {
            const images = Array.isArray(data.image) ? data.image : [data.image];
            const imageUrls = images.map((img: any) => typeof img === 'string' ? img : img?.url).filter(Boolean);
            if (imageUrls.length > 0) {
              result.allImageUrls = imageUrls;
              result.imageUrl = imageUrls[0];
            }
          }
        }
      } catch (e) {
        // Ignore invalid JSON-LD
      }
    });
    
    return result;
  }
  
  /**
   * Filter and rank product images
   */
  static filterProductImages($: cheerio.CheerioAPI): ImageCandidate[] {
    const candidates: ImageCandidate[] = [];
    
    // WooCommerce gallery selectors
    const gallerySelectors = [
      '#woocommerce-product-gallery img',
      '.woocommerce-product-gallery__image img',
      '.wp-post-image',
      '.product-image img',
      '.product-gallery img'
    ];
    
    gallerySelectors.forEach(selector => {
      $(selector).each((_, img) => {
        const $img = $(img);
        
        // Get image URLs from various attributes
        const dataLarge = $img.attr('data-large_image');
        const srcset = $img.attr('srcset');
        const src = $img.attr('src');
        
        // Parse srcset to find largest image
        let bestSrcsetUrl = '';
        let bestWidth = 0;
        
        if (srcset) {
          const srcsetEntries = srcset.split(',').map(entry => {
            const [url, widthStr] = entry.trim().split(' ');
            const width = parseInt(widthStr?.replace('w', '') || '0');
            return { url: url.trim(), width };
          });
          
          const largest = srcsetEntries.reduce((best, current) => 
            current.width > best.width ? current : best, 
            { url: '', width: 0 }
          );
          
          if (largest.width > bestWidth && largest.url) {
            bestSrcsetUrl = largest.url;
            bestWidth = largest.width;
          }
        }
        
        // Determine best URL and source
        let imageUrl = '';
        let source = '';
        let width = 0;
        
        if (dataLarge && !this.isLogoOrPlaceholder(dataLarge)) {
          imageUrl = dataLarge;
          source = 'data-large_image';
          width = 1000; // Assume large images are high quality
        } else if (bestSrcsetUrl && !this.isLogoOrPlaceholder(bestSrcsetUrl)) {
          imageUrl = bestSrcsetUrl;
          source = 'srcset';
          width = bestWidth;
        } else if (src && !this.isLogoOrPlaceholder(src)) {
          imageUrl = src;
          source = 'src';
          width = 500; // Default assumption
        }
        
        if (imageUrl && width >= 300) {
          // Note: Relative URLs will be made absolute in the main parsing function
          
          candidates.push({ url: imageUrl, width, source });
        }
      });
    });
    
    // Remove duplicates and sort by width descending
    const uniqueCandidates = candidates.filter((candidate, index, arr) => 
      arr.findIndex(c => c.url === candidate.url) === index
    );
    
    return uniqueCandidates.sort((a, b) => (b.width || 0) - (a.width || 0));
  }
  
  /**
   * Check if image is likely a logo or placeholder
   */
  static isLogoOrPlaceholder(url: string): boolean {
    const filename = url.toLowerCase();
    return filename.includes('logo') || 
           filename.includes('placeholder') || 
           filename.includes('icon') ||
           filename.endsWith('.svg') ||
           filename.includes('woocommerce-placeholder');
  }
  
  /**
   * Parse WooCommerce price with better handling
   */
  static parseWooPrice($: cheerio.CheerioAPI, fullText: string): {
    price?: number;
    priceRaw?: string;
    unit?: string;
    priceSource?: string;
  } {
    // Extract all amounts from price section
    const amounts: number[] = [];
    $('.summary .price .amount, .price .woocommerce-Price-amount').each((_, el) => {
      const text = $(el).text().replace(/[^\d.,]/g, '');
      const num = parseFloat(text.replace(/,/g, ''));
      if (!isNaN(num)) amounts.push(num);
    });
    
    // Use the maximum amount (for variation ranges)
    const wooPrice = amounts.length > 0 ? Math.max(...amounts) : null;
    
    // Check for unit indicators in price area
    $('.summary .price, .product_meta').text();
    
    // Look for specific price patterns in full text
    let price = wooPrice;
    let priceRaw = wooPrice?.toString();
    let unit = '';
    let priceSource = 'woo';
    
    // Per m² patterns
    REGEX_PATTERNS.perM2.lastIndex = 0;
    const perM2Match = REGEX_PATTERNS.perM2.exec(fullText);
    if (perM2Match) {
      price = parseFloat(perM2Match[1].replace(/,/g, ''));
      priceRaw = perM2Match[0];
      unit = 'm2';
      priceSource = 'per-m2';
      return { price, priceRaw, unit, priceSource };
    }
    
    // Per lm patterns
    REGEX_PATTERNS.perLM.lastIndex = 0;
    const perLMMatch = REGEX_PATTERNS.perLM.exec(fullText);
    if (perLMMatch && perLMMatch[1]) {
      price = parseFloat(perLMMatch[1].replace(/,/g, ''));
      priceRaw = perLMMatch[0];
      unit = 'lm';
      priceSource = 'per-lm';
      return { price, priceRaw, unit, priceSource };
    }
    
    // Per sheet patterns (will convert to m² later)
    REGEX_PATTERNS.perSheet.lastIndex = 0;
    const perSheetMatch = REGEX_PATTERNS.perSheet.exec(fullText);
    if (perSheetMatch && perSheetMatch[1]) {
      price = parseFloat(perSheetMatch[1].replace(/,/g, ''));
      priceRaw = perSheetMatch[0];
      unit = 'sheet';
      priceSource = 'per-sheet';
      return { price, priceRaw, unit, priceSource };
    }
    
    // Per box with coverage
    REGEX_PATTERNS.perBox.lastIndex = 0;
    const perBoxMatch = REGEX_PATTERNS.perBox.exec(fullText);
    if (perBoxMatch && perBoxMatch[1]) {
      REGEX_PATTERNS.covers.lastIndex = 0;
      const coversMatch = REGEX_PATTERNS.covers.exec(fullText);
      if (coversMatch && coversMatch[2]) {
        const boxPrice = parseFloat(perBoxMatch[1].replace(/,/g, ''));
        const coverage = parseFloat(coversMatch[2].replace(/,/g, ''));
        price = boxPrice / coverage;
        priceRaw = `${perBoxMatch[0]} (covers ${coverage}m²)`;
        unit = 'm2';
        priceSource = 'per-box-coverage';
        return { price, priceRaw, unit, priceSource };
      }
    }
    
    return { price: wooPrice, priceRaw: wooPrice?.toString(), unit, priceSource };
  }
  
  /**
   * Parse text content to extract product specifications
   */
  static parseProductText(text: string): ParsedSizes & { 
    priceRaw?: string; 
    finish?: string; 
    categoryHint?: string; 
    unit?: string;
    normalizedPrice?: number;
    priceUnit?: string;
  } {
    const result: ParsedSizes & { 
      priceRaw?: string; 
      finish?: string; 
      categoryHint?: string; 
      unit?: string;
      normalizedPrice?: number;
      priceUnit?: string;
    } = {};
    
    // Extract sizes
    let match;
    
    // Sheet size (prioritize this for tiles)
    REGEX_PATTERNS.sheet.lastIndex = 0;
    while ((match = REGEX_PATTERNS.sheet.exec(text)) !== null) {
      if (match[2] && match[3]) {
        result.sheetW = parseInt(match[2]);
        result.sheetH = parseInt(match[3]);
      }
    }
    
    // Tile size
    REGEX_PATTERNS.tile.lastIndex = 0;
    while ((match = REGEX_PATTERNS.tile.exec(text)) !== null) {
      if (match[2] && match[3]) {
        result.tileW = parseInt(match[2]);
        result.tileH = parseInt(match[3]);
      }
    }
    
    // Generic mm pair if no specific size found
    if (!result.sheetW && !result.tileW) {
      REGEX_PATTERNS.mmPair.lastIndex = 0;
      const mmMatch = REGEX_PATTERNS.mmPair.exec(text);
      if (mmMatch && mmMatch[1] && mmMatch[2]) {
        // Assume it's tile size if under 100mm, sheet if larger
        const w = parseInt(mmMatch[1]);
        const h = parseInt(mmMatch[2]);
        if (w <= 100 && h <= 100) {
          result.tileW = w;
          result.tileH = h;
        } else {
          result.sheetW = w;
          result.sheetH = h;
        }
      }
    }
    
    // Thickness
    REGEX_PATTERNS.thickness.lastIndex = 0;
    const thickMatch = REGEX_PATTERNS.thickness.exec(text);
    if (thickMatch && thickMatch[2]) {
      result.thickness = parseInt(thickMatch[2]);
    }
    
    // Grout
    REGEX_PATTERNS.grout.lastIndex = 0;
    const groutMatch = REGEX_PATTERNS.grout.exec(text);
    if (groutMatch && groutMatch[2]) {
      result.grout = parseInt(groutMatch[2]);
    }
    
    // Extract finish
    REGEX_PATTERNS.finish.lastIndex = 0;
    const finishMatch = REGEX_PATTERNS.finish.exec(text);
    if (finishMatch && finishMatch[0]) {
      result.finish = finishMatch[0].toLowerCase();
    }
    
    // Detect category
    if (REGEX_PATTERNS.waterline.test(text)) {
      result.categoryHint = 'waterline_tile';
      result.unit = result.unit || 'm2';
    } else if (REGEX_PATTERNS.coping.test(text)) {
      result.categoryHint = 'coping';
      result.unit = result.unit || 'lm';
    } else if (REGEX_PATTERNS.paving.test(text)) {
      result.categoryHint = 'paving';
      result.unit = result.unit || 'm2';
    } else if (REGEX_PATTERNS.interior.test(text)) {
      result.categoryHint = 'interior';
      result.unit = result.unit || 'm2';
    } else if (REGEX_PATTERNS.fencing.test(text)) {
      result.categoryHint = 'fencing';
      result.unit = result.unit || 'each';
    }
    
    return result;
  }
  
  /**
   * Fetch and parse a product URL with enhanced WooCommerce support
   */
  static async prefillFromUrl(url: string): Promise<ParsedProduct> {
    try {
      // Fetch the page with fallback
      const html = await this.fetchHtml(url);
      const $ = cheerio.load(html);
      
      // Try JSON-LD first
      const jsonLDData = this.parseJsonLD($);
      
      // Extract basic product info with WooCommerce selectors
      let name = jsonLDData.name || '';
      if (!name) {
        const nameSelectors = ['h1.product_title', '.product_title', 'h1.product-title', 'h1.entry-title'];
        for (const selector of nameSelectors) {
          const nameEl = $(selector).first();
          if (nameEl.length) {
            name = nameEl.text().trim();
            break;
          }
        }
      }
      
      // Try to find SKU
      let sku = jsonLDData.sku || '';
      if (!sku) {
        const skuSelectors = ['span.sku', '.product_meta .sku', '.sku'];
        for (const selector of skuSelectors) {
          const skuEl = $(selector).first();
          if (skuEl.length) {
            sku = skuEl.text().trim();
            break;
          }
        }
      }
      
      // Extract description/specs text
      const specsText = [
        $('.woocommerce-Tabs-panel').text(),
        $('.product-short-description').text(),
        $('.woocommerce-product-details__short-description').text(),
        $('.product_meta').text(),
        $('table.woocommerce-product-attributes').text()
      ].join(' ');
      
      const fullText = $('body').text();
      
      // Parse price with WooCommerce awareness
      const priceData = this.parseWooPrice($, fullText + ' ' + specsText);
      
      // Parse specs from combined text
      const parsed = this.parseProductText(fullText + ' ' + specsText);
      
      // Filter and rank product images
      const imageCandidates = this.filterProductImages($);
      const allImageUrls = imageCandidates.map(c => c.url);
      const primaryImage = allImageUrls[0] || jsonLDData.imageUrl;
      
      // Special handling for PoolTile 23mm products
      if (name.includes('23mm') && !parsed.tileW && !parsed.tileH) {
        parsed.tileW = 23;
        parsed.tileH = 23;
      }
      
      // Detect category from URL/breadcrumbs
      let categoryHint = parsed.categoryHint;
      if (!categoryHint) {
        if (url.includes('waterline') || url.includes('mosaic') || $('.breadcrumb, .woocommerce-breadcrumb').text().toLowerCase().includes('waterline')) {
          categoryHint = 'waterline_tile';
        }
      }
      
      // Normalize price
      let normalizedPrice = priceData.price;
      let unit = priceData.unit || parsed.unit;
      let priceUnit = priceData.unit;
      
      // Convert per-sheet to per-m² if we have sheet dimensions
      if (priceData.unit === 'sheet' && parsed.sheetW && parsed.sheetH) {
        const sheetAreaM2 = (parsed.sheetW * parsed.sheetH) / 1000000;
        normalizedPrice = priceData.price! / sheetAreaM2;
        priceUnit = 'm2';
        unit = 'm2';
      }
      
      // Calculate physical repeat
      const physicalRepeatM = this.calculatePhysicalRepeat(parsed);
      
      return {
        name: name || undefined,
        sku: sku || undefined,
        price: normalizedPrice,
        priceRaw: priceData.priceRaw,
        imageUrl: primaryImage,
        allImageUrls: allImageUrls.length > 0 ? allImageUrls : undefined,
        source_url: url,
        sizes: {
          sheetW: parsed.sheetW ?? undefined,
          sheetH: parsed.sheetH ?? undefined,
          tileW: parsed.tileW ?? undefined,
          tileH: parsed.tileH ?? undefined,
          thickness: parsed.thickness ?? undefined,
          grout: parsed.grout ?? undefined
        },
        finish: parsed.finish,
        categoryHint,
        unit,
        normalizedPrice: normalizedPrice ?? undefined,
        priceUnit,
        physical_repeat_m: physicalRepeatM,
        priceSource: priceData.priceSource
      };
      
    } catch (error) {
      console.error('Error fetching URL:', error);
      throw new Error(`Failed to fetch product data from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Download image from URL and return as buffer
   */
  static async downloadImage(imageUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading image:', error);
      throw new Error(`Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Calculate physical repeat from dimensions
   */
  static calculatePhysicalRepeat(sizes: ParsedSizes): number {
    // Priority: sheet width > tile width > default 30cm
    if (sizes.sheetW && sizes.sheetW > 0) {
      return sizes.sheetW / 1000; // Convert mm to meters
    }
    if (sizes.tileW && sizes.tileW > 0) {
      return sizes.tileW / 1000;
    }
    return 0.30; // Default 30cm
  }
}