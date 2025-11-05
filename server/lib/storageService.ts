/**
 * Storage Service - Vercel Blob Storage (primary) with S3 fallback
 * Provides abstraction layer for object storage
 */

import { put as blobPut } from '@vercel/blob';
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageService {
  put(path: string, buffer: Buffer, contentType: string): Promise<string>;
  head(path: string): Promise<{ size: number; etag: string; lastModified: Date }>;
  delete(path: string): Promise<void>;
  getSignedUploadUrl(path: string, expiresIn: number): Promise<string>;
}

// S3 client for fallback (only initialized if AWS credentials are present)
let s3Client: S3Client | null = null;
const s3Bucket = process.env.S3_BUCKET || 'poolvisual-uploads';

function getS3Client(): S3Client | null {
  if (!s3Client && process.env.AWS_ACCESS_KEY_ID) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });
  }
  return s3Client;
}

export const storageService: StorageService = {
  async put(path: string, buffer: Buffer, contentType: string): Promise<string> {
    // Try Vercel Blob first (recommended for Vercel deployments)
    if (process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL) {
      try {
        const blob = await blobPut(path, buffer, {
          access: 'public',
          contentType: contentType,
          addRandomSuffix: false,
        });
        console.log('[Storage] Uploaded to Vercel Blob:', blob.url);
        return blob.url;
      } catch (blobError) {
        console.warn('[Storage] Vercel Blob upload failed, trying S3 fallback:', blobError);
        // Fall through to S3
      }
    }

    // Fallback to S3 if AWS credentials are available
    const s3 = getS3Client();
    if (s3) {
      const command = new PutObjectCommand({
        Bucket: s3Bucket,
        Key: path,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000, immutable'
      });
      
      await s3.send(command);
      
      const region = process.env.AWS_REGION || 'us-east-1';
      const url = `https://${s3Bucket}.s3.${region}.amazonaws.com/${path}`;
      console.log('[Storage] Uploaded to S3:', url);
      return url;
    }

    // If neither is available, throw error
    throw new Error('No storage service configured. Set BLOB_READ_WRITE_TOKEN or AWS credentials.');
  },
  
  async getSignedUploadUrl(path: string, expiresIn: number): Promise<string> {
    // Try S3 first for signed URLs
    const s3 = getS3Client();
    if (s3) {
      const command = new PutObjectCommand({
        Bucket: s3Bucket,
        Key: path,
        ContentType: 'image/png'
      });
      
      return getSignedUrl(s3, command, { expiresIn });
    }

    // Vercel Blob doesn't support signed URLs in the same way
    // Return a direct upload URL instead
    throw new Error('Signed URLs require S3. Use direct upload instead.');
  },
  
  async head(path: string) {
    // For now, S3 only - Vercel Blob doesn't have head operation
    const s3 = getS3Client();
    if (!s3) {
      throw new Error('Head operation requires S3 credentials');
    }

    const command = new HeadObjectCommand({
      Bucket: s3Bucket,
      Key: path
    });
    
    const response = await s3.send(command);
    
    return {
      size: Number(response.ContentLength || 0),
      etag: String(response.ETag || ''),
      lastModified: response.LastModified || new Date()
    };
  },
  
  async delete(path: string): Promise<void> {
    // Vercel Blob deletion would require blob ID, not path
    // For now, S3 only
    const s3 = getS3Client();
    if (!s3) {
      throw new Error('Delete operation requires S3 credentials');
    }

    const command = new DeleteObjectCommand({
      Bucket: s3Bucket,
      Key: path
    });
    
    await s3.send(command);
  }
};

