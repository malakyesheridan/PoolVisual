/**
 * Storage Service - S3 implementation
 * Provides abstraction layer for object storage
 */

import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageService {
  put(path: string, buffer: Buffer, contentType: string): Promise<string>;
  head(path: string): Promise<{ size: number; etag: string; lastModified: Date }>;
  delete(path: string): Promise<void>;
  getSignedUploadUrl(path: string, expiresIn: number): Promise<string>;
}

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  } : undefined
});

const bucket = process.env.S3_BUCKET || 'poolvisual-uploads';

export const storageService: StorageService = {
  async put(path: string, buffer: Buffer, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000, immutable'
    });
    
    await s3.send(command);
    
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${bucket}.s3.${region}.amazonaws.com/${path}`;
  },
  
  async getSignedUploadUrl(path: string, expiresIn: number): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      ContentType: 'image/png'
    });
    
    return getSignedUrl(s3, command, { expiresIn });
  },
  
  async head(path: string) {
    const command = new HeadObjectCommand({
      Bucket: bucket,
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
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: path
    });
    
    await s3.send(command);
  }
};

