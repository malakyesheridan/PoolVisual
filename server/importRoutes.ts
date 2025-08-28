import type { Express } from "express";
import { z } from "zod";
import { ImportService } from "./importService";
import { textureProcessor } from "./textureProcessor";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

const ImportPrefillSchema = z.object({
  url: z.string().url()
});

const TextParseSchema = z.object({
  text: z.string().min(1)
});

const ImageUrlSchema = z.object({
  imageUrl: z.string().url()
});

export function registerImportRoutes(app: Express) {
  
  // Prefill material data from URL
  app.get("/api/import/prefill", async (req, res) => {
    try {
      const validation = ImportPrefillSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid URL", 
          details: validation.error.issues 
        });
      }

      const { url } = validation.data;
      const result = await ImportService.prefillFromUrl(url);
      
      res.json(result);

    } catch (error) {
      console.error('Prefill error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to prefill data' 
      });
    }
  });

  // Parse product text for specifications
  app.post("/api/import/parse-text", async (req, res) => {
    try {
      const validation = TextParseSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid text", 
          details: validation.error.issues 
        });
      }

      const { text } = validation.data;
      const result = ImportService.parseProductText(text);
      
      res.json(result);

    } catch (error) {
      console.error('Parse text error:', error);
      res.status(500).json({ 
        error: 'Failed to parse text' 
      });
    }
  });

  // Upload texture from URL
  app.post("/api/materials/upload-texture-from-url", async (req, res) => {
    try {
      const validation = ImageUrlSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid image URL", 
          details: validation.error.issues 
        });
      }

      const { imageUrl } = validation.data;
      
      // Download the image
      const imageBuffer = await ImportService.downloadImage(imageUrl);
      
      // Save to temporary file
      const tempDir = 'uploads/temp';
      await fs.mkdir(tempDir, { recursive: true });
      
      const tempFilePath = path.join(tempDir, `${randomUUID()}.jpg`);
      await fs.writeFile(tempFilePath, imageBuffer);
      
      try {
        // Process through texture pipeline
        const textureResult = await textureProcessor.processTexture(tempFilePath, {
          makeSeamless: true // Default to seamless for URL imports
        });

        // Cleanup temp file
        await textureProcessor.cleanup(tempFilePath);

        res.json({
          textureUrl: textureResult.textureUrl,
          thumbnailUrl: textureResult.thumbnailUrl,
          physicalRepeatM: textureResult.physicalRepeatM
        });

      } catch (processingError) {
        // Cleanup temp file on error
        await textureProcessor.cleanup(tempFilePath);
        throw processingError;
      }

    } catch (error) {
      console.error('Upload texture from URL error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to process image from URL' 
      });
    }
  });
}