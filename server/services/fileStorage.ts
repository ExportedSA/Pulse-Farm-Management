import path from 'path';
import fs from 'fs/promises';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Configuration
const uploadsDir = path.join(process.cwd(), 'uploads');
const isS3Enabled = !!process.env.S3_BUCKET_NAME;

// Ensure uploads directory exists for local storage
async function ensureUploadsDir() {
  if (!isS3Enabled) {
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }
  }
}

// Initialize S3 client if configured
let s3Client: S3Client | null = null;
if (isS3Enabled) {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
    throw new Error('S3_BUCKET_NAME is set but AWS credentials are missing. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION.');
  }
  
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

// Generate unique filename
function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1E9);
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext);
  return `${timestamp}-${random}-${name}${ext}`;
}

// Save file buffer to storage (local or S3)
export async function saveFileBuffer(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
  subfolder?: string
): Promise<{ storageKey: string; publicUrl: string }> {
  await ensureUploadsDir();
  
  const filename = generateUniqueFilename(originalName);
  const storageKey = subfolder ? `${subfolder}/${filename}` : filename;
  
  if (isS3Enabled && s3Client) {
    // Upload to S3
    try {
      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
        ACL: 'public-read', // Make file publicly accessible
      });
      
      await s3Client.send(command);
      
      const publicUrl = getS3PublicUrl(storageKey);
      return { storageKey, publicUrl };
    } catch (error) {
      console.error('Failed to upload to S3:', error);
      throw new Error('Failed to upload file to S3');
    }
  } else {
    // Save to local filesystem
    try {
      const fullPath = path.join(uploadsDir, storageKey);
      
      // Create subdirectory if needed
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(fullPath, buffer);
      
      const publicUrl = getLocalPublicUrl(storageKey);
      return { storageKey, publicUrl };
    } catch (error) {
      console.error('Failed to save file locally:', error);
      throw new Error('Failed to save file locally');
    }
  }
}

// Get public URL for a file
export function getPublicUrl(storageKey: string): string {
  if (isS3Enabled) {
    return getS3PublicUrl(storageKey);
  } else {
    return getLocalPublicUrl(storageKey);
  }
}

// Get S3 public URL
function getS3PublicUrl(storageKey: string): string {
  const bucket = process.env.S3_BUCKET_NAME!;
  const region = process.env.AWS_REGION!;
  
  // Format: https://bucket.s3.region.amazonaws.com/key
  return `https://${bucket}.s3.${region}.amazonaws.com/${storageKey}`;
}

// Get local public URL
function getLocalPublicUrl(storageKey: string): string {
  // In development, we might serve files through a static route
  // For now, return a relative path that can be served by the frontend
  return `/uploads/${storageKey}`;
}

// Generate a pre-signed URL for private files (if needed in future)
export async function getPresignedUrl(storageKey: string, expiresIn: number = 3600): Promise<string> {
  if (!isS3Enabled || !s3Client) {
    throw new Error('Pre-signed URLs are only available for S3 storage');
  }
  
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: storageKey,
    });
    
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error('Failed to generate pre-signed URL:', error);
    throw new Error('Failed to generate pre-signed URL');
  }
}

// Delete a file from storage
export async function deleteFile(storageKey: string): Promise<void> {
  if (isS3Enabled && s3Client) {
    // Delete from S3
    // Implementation would require DeleteObjectCommand
    // For now, we'll leave this as a TODO
    console.log('S3 delete not implemented yet');
  } else {
    // Delete from local filesystem
    try {
      const fullPath = path.join(uploadsDir, storageKey);
      await fs.unlink(fullPath);
    } catch (error) {
      console.error('Failed to delete local file:', error);
      // Don't throw error for missing files
    }
  }
}

// Check if S3 is configured
export function isUsingS3(): boolean {
  return isS3Enabled;
}

// Get storage type for debugging
export function getStorageType(): 'local' | 's3' {
  return isS3Enabled ? 's3' : 'local';
}
