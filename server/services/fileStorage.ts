import path from 'path';
import fs from 'fs/promises';
import type { Response } from 'express';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// The one place uploaded files are saved, read and removed.
//
// - Every new file is stored under a farm-prefixed key: `<area>/<farmId>/<unique>-<name>`.
// - Its address is always `/uploads/<key>`, in both modes. That route checks the person is a member of
//   the farm that owns the file before handing it over (server/middleware/farmAccess.ts `uploadsGuard`).
// - With `S3_BUCKET_NAME` set, files go to a **private** S3-compatible bucket (AWS S3, or Cloudflare R2 via
//   `S3_ENDPOINT`) and `/uploads/<key>` redirects to a link signed for a few minutes. Without it, files are
//   kept on local disk (`UPLOADS_DIR`, default `./uploads`) for development.

export const UPLOAD_AREAS = ['attachments', 'photos', 'chat', 'jobs', 'voice-notes'] as const;
export type UploadArea = typeof UPLOAD_AREAS[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Signed links are made for fixed windows, so the same file gets the same link for a while and browsers can
// cache it. A link handed out is good for at least SIGN_WINDOW seconds.
const SIGN_WINDOW = 300;

function uploadsDir(): string {
  return path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'));
}

function bucket(): string | undefined {
  return process.env.S3_BUCKET_NAME || undefined;
}

export function isUsingS3(): boolean {
  return !!bucket();
}

export function getStorageType(): 'local' | 's3' {
  return isUsingS3() ? 's3' : 'local';
}

let client: { key: string; s3: S3Client } | null = null;

function s3(): S3Client {
  const endpoint = process.env.S3_ENDPOINT || undefined;
  const region = process.env.AWS_REGION || (endpoint ? 'auto' : undefined);
  const { AWS_ACCESS_KEY_ID: accessKeyId, AWS_SECRET_ACCESS_KEY: secretAccessKey } = process.env;
  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error('S3_BUCKET_NAME is set but storage credentials are missing. Set AWS_ACCESS_KEY_ID, '
      + 'AWS_SECRET_ACCESS_KEY and AWS_REGION (or S3_ENDPOINT for Cloudflare R2).');
  }
  const key = [endpoint, region, accessKeyId].join('|');
  if (client?.key !== key) {
    client = {
      key,
      s3: new S3Client({
        region,
        endpoint,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === '1',
        credentials: { accessKeyId, secretAccessKey },
      }),
    };
  }
  return client.s3;
}

// Fail at start-up rather than on the first upload
if (isUsingS3()) s3();

/** The bucket, as far as this module needs it */
export interface ObjectStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
  signedGetUrl(key: string, opts: { expiresIn: number; signingDate: Date; cacheControl: string }): Promise<string>;
}

const awsStore: ObjectStore = {
  async put(key, body, contentType) {
    // No ACL: objects stay private (the bucket should also block public access)
    await s3().send(new PutObjectCommand({ Bucket: bucket()!, Key: key, Body: body, ContentType: contentType }));
  },
  async remove(key) {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket()!, Key: key }));
  },
  signedGetUrl(key, { expiresIn, signingDate, cacheControl }) {
    return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket()!, Key: key, ResponseCacheControl: cacheControl }),
      { expiresIn, signingDate });
  },
};

let storeOverride: ObjectStore | null = null;

/** For tests: stand in for the bucket, so nothing is sent anywhere (null puts the real one back) */
export function setObjectStoreForTests(store: ObjectStore | null): void {
  storeOverride = store;
}

function objectStore(): ObjectStore {
  return storeOverride ?? awsStore;
}

function safeName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10);
  const base = path.basename(originalName, path.extname(originalName))
    .normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${base || 'file'}${ext}`;
}

function uniqueName(originalName: string): string {
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName(originalName)}`;
}

const encodeKey = (key: string) => key.split('/').map(encodeURIComponent).join('/');

/** `/uploads/<key>` for a stored key */
export function uploadUrl(storageKey: string): string {
  return `/uploads/${encodeKey(storageKey)}`;
}

/**
 * A key as asked for in a request path, decoded and checked: no empty, `.` or `..` parts, no backslashes or
 * control characters. Null when it isn't a usable key.
 */
export function normaliseKey(raw: string): string | null {
  let key: string;
  try {
    key = decodeURIComponent(raw);
  } catch {
    return null;
  }
  key = key.replace(/^\/+/, '');
  if (!key || key.length > 512 || /[\\\0-\x1f]/.test(key)) return null;
  if (key.split('/').some(p => !p || p === '.' || p === '..')) return null;
  return key;
}

/** The stored key behind an `/uploads/...` address (null for anything else) */
export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const pathname = url.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0];
  if (!pathname.startsWith('/uploads/')) return null;
  return normaliseKey(pathname.slice('/uploads/'.length));
}

/** The farm a key belongs to, for keys saved by this module (`<area>/<farmId>/...`); null for older keys */
export function farmOfKey(storageKey: string): string | null {
  const [area, farmId, ...rest] = storageKey.split('/');
  if (!(UPLOAD_AREAS as readonly string[]).includes(area) || !UUID.test(farmId ?? '') || rest.length === 0) return null;
  return farmId.toLowerCase();
}

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/**
 * Save an uploaded file for a farm. Returns its key and its `/uploads/...` address (what goes in the database).
 */
export async function saveUpload(
  farmId: string,
  area: UploadArea,
  file: UploadedFile,
): Promise<{ storageKey: string; url: string }> {
  if (!UUID.test(farmId ?? '')) throw new Error('A farm is needed to store a file');
  if (!Buffer.isBuffer(file.buffer)) throw new Error('Uploaded file has no contents');
  const storageKey = `${area}/${farmId.toLowerCase()}/${uniqueName(file.originalname)}`;
  const contentType = file.mimetype.split(';')[0].trim().toLowerCase() || 'application/octet-stream';

  if (isUsingS3()) {
    try {
      await objectStore().put(storageKey, file.buffer, contentType);
    } catch (error) {
      console.error('Failed to upload to S3:', error);
      throw new Error('Failed to store the file');
    }
  } else {
    const fullPath = path.join(uploadsDir(), ...storageKey.split('/'));
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.buffer);
  }
  return { storageKey, url: uploadUrl(storageKey) };
}

/** A link to a stored file in the bucket, signed for a short while (S3 mode only) */
export async function getPresignedUrl(storageKey: string, expiresIn: number = 2 * SIGN_WINDOW): Promise<string> {
  if (!isUsingS3()) throw new Error('Signed links are only available with S3 storage');
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % SIGN_WINDOW);
  return objectStore().signedGetUrl(storageKey, {
    expiresIn,
    signingDate: new Date(windowStart * 1000),
    cacheControl: `private, max-age=${SIGN_WINDOW}`,
  });
}

// Stops an uploaded HTML or SVG file from running scripts on our own site
const UPLOAD_CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox";

/**
 * Answer a request (that has already passed the farm check) with a stored file: a redirect to a signed
 * bucket link in S3 mode, the file itself from local disk otherwise. Calls `notFound` when there is no file.
 */
export async function sendStoredFile(storageKey: string, res: Response, notFound: () => void): Promise<void> {
  if (isUsingS3()) {
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.redirect(302, await getPresignedUrl(storageKey));
    return;
  }
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.setHeader('Content-Security-Policy', UPLOAD_CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // `send` decodes the path it's given, so hand it the encoded key
  res.sendFile(encodeKey(storageKey), { root: uploadsDir(), dotfiles: 'deny', cacheControl: false }, (err: any) => {
    if (err && !res.headersSent) notFound();
  });
}

/** Remove a stored file. A missing file is not an error. */
export async function deleteFile(storageKey: string | null | undefined): Promise<void> {
  const key = storageKey ? normaliseKey(encodeKey(storageKey)) : null;
  if (!key) return;
  try {
    if (isUsingS3()) {
      await objectStore().remove(key);
    } else {
      await fs.unlink(path.join(uploadsDir(), ...key.split('/')));
    }
  } catch (error: any) {
    if (error?.code !== 'ENOENT') console.error('Failed to delete stored file:', error);
  }
}

/** Remove the file behind an `/uploads/...` address */
export async function deleteFileByUrl(url: string | null | undefined): Promise<void> {
  await deleteFile(keyFromUrl(url));
}
