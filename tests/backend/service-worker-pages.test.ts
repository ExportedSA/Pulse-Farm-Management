// The service worker must fetch pages from the server first, so a deploy shows on the next load
// (it used to serve its cached copy of the page first, so the first load after each deploy was the old app).
// Its kept copy is only for when there's no connection. Runs client/public/sw.js against stand-ins.
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

function loadWorker(fetchImpl: (req: any) => Promise<any>) {
  const code = fs.readFileSync(path.resolve(__dirname, '../../client/public/sw.js'), 'utf8');
  const listeners: Record<string, (event: any) => void> = {};
  const store = new Map<string, any>([['/', { body: 'OLD page' }], ['/offline.html', { body: 'offline page' }]]);
  const cache = {
    async match(key: any) { return store.get(typeof key === 'string' ? key : new URL(key.url).pathname); },
    async put(key: string, value: any) { store.set(key, value); },
  };
  const caches = { open: async () => cache, match: async (req: any) => cache.match(req), keys: async () => [] };
  const self = {
    location: { origin: 'https://pulse.example' },
    addEventListener: (type: string, fn: (event: any) => void) => { listeners[type] = fn; },
  };
  new Function('self', 'caches', 'fetch', 'Response', code)(self, caches, fetchImpl, { error: () => ({ body: 'error' }) });

  const navigate = async (url: string) => {
    let answer: Promise<any> | undefined;
    listeners.fetch({ request: { url, method: 'GET', mode: 'navigate' }, respondWith: (p: Promise<any>) => { answer = p; } });
    expect(answer).toBeDefined();
    return answer!;
  };
  return { navigate, store };
}

const page = (body: string) => ({ ok: true, type: 'basic', body, clone() { return { body }; } });

describe('service worker and pages', () => {
  it('serves the page from the server even when an older copy is kept, and keeps the new one', async () => {
    const { navigate, store } = loadWorker(async () => page('NEW page'));
    expect((await navigate('https://pulse.example/app/farm-map')).body).toBe('NEW page');
    expect(store.get('/').body).toBe('NEW page');
  });

  it('with no connection, shows the kept page, or the offline page if none', async () => {
    const offline = async () => { throw new TypeError('Failed to fetch'); };
    const first = loadWorker(offline);
    expect((await first.navigate('https://pulse.example/app')).body).toBe('OLD page');
    first.store.delete('/');
    expect((await first.navigate('https://pulse.example/app')).body).toBe('offline page');
  });

  it("doesn't keep a redirect or an error page", async () => {
    const { navigate, store } = loadWorker(async () => ({ ok: false, type: 'basic', body: 'server error', clone() { return this; } }));
    expect((await navigate('https://pulse.example/app')).body).toBe('server error');
    expect(store.get('/').body).toBe('OLD page');
  });
});
