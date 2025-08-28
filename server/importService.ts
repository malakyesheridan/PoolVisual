import axios from 'axios';
import * as cheerio from 'cheerio';
import { z } from 'zod';

// Parsing schemas
const ImportPrefillSchema = z.object({
  url: z.string().url()
});

const TextParseSchema = z.object({
  text: z.string().min(1)
});

// Result interfaces
export interface ParsedSizes {
  sheetW?: number;
  sheetH?: number;
  tileW?: number;
  tileH?: number;
  thickness?: number;
  grout?: number;
}

export interface ParsedProduct {
  name?: string;
  sku?: string;
  priceRaw?: string;
  imageUrl?: string;
  sizes: ParsedSizes;
  finish?: string;
  source_url?: string;
  category?: string;
  unit?: string;
  normalizedPrice?: number;
  priceUnit?: string;
}

// Regex patterns for parsing
const REGEX_PATTERNS = {
  // Size patterns
  mmPair: /(\d{2,4})\s*[x×]\s*(\d{2,4})\s*mm/gi,
  sheet: /(sheet|sheet size)\s*[:\-]?\s*(\d{2,4})\s*[x×]\s*(\d{2,4})\s*mm/gi,
  tile: /(tile|chip|piece)\s*[:\-]?\s*(\d{2,4})\s*[x×]\s*(\d{2,4})\s*mm/gi,
  thickness: /(thickness|thick)\s*[:\-]?\s*(\d{1,2})\s*mm/gi,
  grout: /(grout|gap)\s*[:\-]?\s*(\d{1,2})\s*mm/gi,
  
  // Price patterns
  priceM2: /\$?\s*([\d\.,]+)\s*\/\s*m[²2]/gi,
  pricePerM2: /\$?\s*([\d\.,]+)\s*(per|\/)\s*m[²2]/gi,
  priceSheet: /\$?\s*([\d\.,]+)\s*(per|\/)\s*sheet/gi,
  priceBox: /\$?\s*([\d\.,]+)\s*(per|\/)\s*box/gi,
  priceLm: /\$?\s*([\d\.,]+)\s*\/\s*l?m/gi,
  priceEach: /\$?\s*([\d\.,]+)\s*(per|\/)\s*(piece|each)/gi,
  
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
   * Parse text content to extract product specifications
   */
  static parseProductText(text: string): ParsedSizes & { 
    priceRaw?: string; 
    finish?: string; 
    category?: string; 
    unit?: string;
    normalizedPrice?: number;
    priceUnit?: string;
  } {
    const result: ParsedSizes & { 
      priceRaw?: string; 
      finish?: string; 
      category?: string; 
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
    
    // Extract prices
    REGEX_PATTERNS.priceM2.lastIndex = 0;
    const priceM2Match = REGEX_PATTERNS.priceM2.exec(text);
    if (priceM2Match && priceM2Match[1]) {
      result.priceRaw = priceM2Match[1];
      result.normalizedPrice = parseFloat(priceM2Match[1].replace(/,/g, ''));
      result.priceUnit = 'm2';
      result.unit = 'm2';
    }
    
    if (!result.priceRaw) {
      REGEX_PATTERNS.pricePerM2.lastIndex = 0;
      const perM2Match = REGEX_PATTERNS.pricePerM2.exec(text);
      if (perM2Match && perM2Match[1]) {
        result.priceRaw = perM2Match[1];
        result.normalizedPrice = parseFloat(perM2Match[1].replace(/,/g, ''));
        result.priceUnit = 'm2';
        result.unit = 'm2';
      }
    }
    
    if (!result.priceRaw) {
      REGEX_PATTERNS.priceSheet.lastIndex = 0;
      const sheetMatch = REGEX_PATTERNS.priceSheet.exec(text);
      if (sheetMatch && sheetMatch[1]) {
        result.priceRaw = `${sheetMatch[1]} per sheet`;
        const sheetPrice = parseFloat(sheetMatch[1].replace(/,/g, ''));
        // Convert to m² if we have sheet dimensions
        if (result.sheetW && result.sheetH) {
          const sheetAreaM2 = (result.sheetW * result.sheetH) / 1000000;
          result.normalizedPrice = sheetPrice / sheetAreaM2;
          result.priceUnit = 'm2';
          result.unit = 'm2';
        }
      }
    }
    
    if (!result.priceRaw) {
      REGEX_PATTERNS.priceLm.lastIndex = 0;
      const lmMatch = REGEX_PATTERNS.priceLm.exec(text);
      if (lmMatch && lmMatch[1]) {
        result.priceRaw = lmMatch[1];
        result.normalizedPrice = parseFloat(lmMatch[1].replace(/,/g, ''));
        result.priceUnit = 'lm';
        result.unit = 'lm';
      }
    }
    
    if (!result.priceRaw) {
      REGEX_PATTERNS.priceEach.lastIndex = 0;
      const eachMatch = REGEX_PATTERNS.priceEach.exec(text);
      if (eachMatch && eachMatch[1]) {
        result.priceRaw = `${eachMatch[1]} each`;
        result.normalizedPrice = parseFloat(eachMatch[1].replace(/,/g, ''));
        result.priceUnit = 'each';
        result.unit = 'each';
      }
    }
    
    // Extract finish
    REGEX_PATTERNS.finish.lastIndex = 0;
    const finishMatch = REGEX_PATTERNS.finish.exec(text);
    if (finishMatch && finishMatch[0]) {
      result.finish = finishMatch[0].toLowerCase();
    }
    
    // Detect category
    if (REGEX_PATTERNS.waterline.test(text)) {
      result.category = 'waterline_tile';
      result.unit = result.unit || 'm2';
    } else if (REGEX_PATTERNS.coping.test(text)) {
      result.category = 'coping';
      result.unit = result.unit || 'lm';
    } else if (REGEX_PATTERNS.paving.test(text)) {
      result.category = 'paving';
      result.unit = result.unit || 'm2';
    } else if (REGEX_PATTERNS.interior.test(text)) {
      result.category = 'interior';
      result.unit = result.unit || 'm2';
    } else if (REGEX_PATTERNS.fencing.test(text)) {
      result.category = 'fencing';
      result.unit = result.unit || 'each';
    }
    
    return result;
  }
  
  /**
   * Fetch and parse a product URL
   */
  static async prefillFromUrl(url: string): Promise<ParsedProduct> {
    try {
      // Fetch the page
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const fullText = $.text();
      
      // Extract basic product info
      let name = $('h1').first().text().trim();
      if (!name) {
        name = $('title').text().trim();
      }
      
      // Try to find SKU
      let sku = '';
      const skuSelectors = ['[data-sku]', '.sku', '.product-code', '.item-code'];
      for (const selector of skuSelectors) {
        const skuEl = $(selector).first();
        if (skuEl.length) {
          sku = skuEl.text().trim();
          break;
        }
      }
      
      // Extract main image
      let imageUrl = '';
      const imgSelectors = [
        '.product-image img',
        '.main-image img', 
        '.hero-image img',
        'img[data-main]',
        '.gallery img:first',
        'img'
      ];
      for (const selector of imgSelectors) {
        const img = $(selector).first();
        if (img.length) {
          let src = img.attr('src') || img.attr('data-src') || img.attr('data-lazy');
          if (src) {
            if (src.startsWith('/')) {
              const urlObj = new URL(url);
              src = `${urlObj.protocol}//${urlObj.host}${src}`;
            }
            imageUrl = src;
            break;
          }
        }
      }
      
      // Parse the full text for specifications
      const parsed = this.parseProductText(fullText);
      
      return {
        name: name || undefined,
        sku: sku || undefined,
        imageUrl: imageUrl || undefined,
        source_url: url,
        sizes: {
          sheetW: parsed.sheetW,
          sheetH: parsed.sheetH,
          tileW: parsed.tileW,
          tileH: parsed.tileH,
          thickness: parsed.thickness,
          grout: parsed.grout
        },
        finish: parsed.finish,
        category: parsed.category,
        unit: parsed.unit,
        priceRaw: parsed.priceRaw,
        normalizedPrice: parsed.normalizedPrice,
        priceUnit: parsed.priceUnit
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