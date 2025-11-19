// server/routes/export.ts
import type { Express } from 'express';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'poolvisual-exports';

export function registerExportRoutes(app: Express): void {
  // POST /api/export/presigned-url - Get presigned PUT URL for upload
  app.post('/api/export/presigned-url', async (req, res) => {
    try {
      const { filename, contentType, expirationHours = 24, passwordProtected, allowDownload, allowView } = req.body;
      
      if (!filename || !contentType) {
        return res.status(400).json({ message: 'filename and contentType are required' });
      }
      
      const shareId = randomUUID();
      const key = `exports/${shareId}/${filename}`;
      const expiresIn = expirationHours * 3600; // Convert to seconds
      
      // Generate presigned PUT URL for upload
      const putCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType,
      });
      
      const uploadUrl = await getSignedUrl(s3Client, putCommand, { expiresIn });
      
      // Generate presigned GET URL for viewing
      const getCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });
      
      const viewUrl = await getSignedUrl(s3Client, getCommand, { expiresIn });
      
      const expiresAt = Date.now() + (expirationHours * 3600 * 1000);
      
      // TODO: Store share metadata in database (shareId, expiresAt, passwordProtected, etc.)
      
      return res.json({
        uploadUrl,
        shareId,
        expiresAt,
        viewUrl,
        shortUrl: `/share/${shareId}`, // Short URL for sharing
      });
    } catch (error: any) {
      console.error('[Export] Failed to generate presigned URL:', error);
      return res.status(500).json({ message: error.message || 'Failed to generate presigned URL' });
    }
  });
  
  // GET /api/export/share/:shareId - Get share link info
  app.get('/api/export/share/:shareId', async (req, res) => {
    try {
      const { shareId } = req.params;
      
      // TODO: Load share metadata from database
      // For now, return basic info
      return res.json({
        shareId,
        exists: true,
        expiresAt: Date.now() + (24 * 3600 * 1000), // 24 hours from now
      });
    } catch (error: any) {
      console.error('[Export] Failed to get share info:', error);
      return res.status(500).json({ message: error.message || 'Failed to get share info' });
    }
  });
}

