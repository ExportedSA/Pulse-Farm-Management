// With a storage bucket, /uploads/<file> answers with a redirect to a signed link on the bucket's own
// address. For a picture or voice note to show inside a page, two things must let that through: the site's
// security policy (audio and scripted downloads are limited to named addresses) and the service worker
// (which must not fetch the file itself; its fetch is held to the same policy).
//
// Nothing is sent anywhere: links are signed locally with TEST keys, and the service worker runs against
// stand-ins. No database needed.
import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { storageOrigins, getPresignedUrl } from '../../server/services/fileStorage';
import { cspDirectives } from '../../server/config/helmet';

const KEYS = ['S3_BUCKET_NAME', 'S3_ENDPOINT', 'S3_FORCE_PATH_STYLE', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));

function useStorage(env: Record<string, string>) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
}

const TEST_KEYS = { AWS_ACCESS_KEY_ID: 'TESTKEY', AWS_SECRET_ACCESS_KEY: 'TESTSECRET' };
const FILE = 'photos/00000000-0000-0000-0000-000000000000/TEST.png';

describe('uploaded files shown inside pages', () => {
  afterEach(() => {
    for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });

  it('on local disk the policy names no storage address', () => {
    useStorage({});
    expect(storageOrigins()).toEqual([]);
    expect(cspDirectives().mediaSrc).toEqual(["'self'"]);
  });

  it.each([
    ['Cloudflare R2', { S3_BUCKET_NAME: 'test-bucket', S3_ENDPOINT: 'https://testaccount.r2.example' }],
    ['R2, bucket in the path', { S3_BUCKET_NAME: 'test-bucket', S3_ENDPOINT: 'https://testaccount.r2.example', S3_FORCE_PATH_STYLE: '1' }],
    ['AWS S3', { S3_BUCKET_NAME: 'test-bucket', AWS_REGION: 'ap-southeast-2' }],
    ['AWS S3, bucket in the path', { S3_BUCKET_NAME: 'test-bucket', AWS_REGION: 'ap-southeast-2', S3_FORCE_PATH_STYLE: '1' }],
    ['AWS S3, bucket name with a dot', { S3_BUCKET_NAME: 'test.bucket', AWS_REGION: 'ap-southeast-2' }],
  ])('%s: the policy allows the address signed links point at, for audio and downloads', async (_name, env) => {
    useStorage({ ...env, ...TEST_KEYS });

    const signedLink = new URL(await getPresignedUrl(FILE));
    expect(signedLink.searchParams.get('X-Amz-Signature')).toBeTruthy();
    expect(storageOrigins()).toContain(signedLink.origin);

    const policy = cspDirectives();
    expect(policy.mediaSrc).toContain(signedLink.origin);
    expect(policy.connectSrc).toContain(signedLink.origin);
    // Pictures: any https address is allowed
    expect(policy.imgSrc).toContain('https:');
    expect(signedLink.protocol).toBe('https:');
  });

  it('the service worker leaves /uploads/ to the browser, and still handles other files', () => {
    const code = fs.readFileSync(path.resolve(__dirname, '../../client/public/sw.js'), 'utf8');
    const listeners: Record<string, (event: any) => void> = {};
    const self = {
      location: { origin: 'https://pulse.example' },
      addEventListener: (type: string, fn: (event: any) => void) => { listeners[type] = fn; },
    };
    const never = () => new Promise(() => {});
    new Function('self', 'caches', 'fetch', code)(self, { match: never, open: never, keys: never }, never);

    const ask = (url: string, method = 'GET') => {
      const respondWith = vi.fn();
      listeners.fetch({ request: { url, method }, respondWith });
      return respondWith;
    };

    expect(ask('https://pulse.example/uploads/photos/farm/TEST.png')).not.toHaveBeenCalled();
    expect(ask('https://pulse.example/uploads/voice-notes/farm/TEST.webm')).not.toHaveBeenCalled();
    expect(ask('https://pulse.example/assets/index.js')).toHaveBeenCalledTimes(1);
  });
});
