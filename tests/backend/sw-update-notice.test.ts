// A new version of Pulse is announced in the app, once, and never by reloading the page itself or by a
// browser pop-up (the old confirm() froze the whole tab until answered).
import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi } from 'vitest';
import { watchForUpdates } from '../../client/src/lib/sw-update';

function fakeContainer(controlled: boolean) {
  const listeners = new Set<() => void>();
  return {
    controller: controlled ? ({} as ServiceWorker) : null,
    addEventListener: (_type: string, fn: () => void) => { listeners.add(fn); },
    removeEventListener: (_type: string, fn: () => void) => { listeners.delete(fn); },
    takeOver() { listeners.forEach(fn => fn()); },
    get watching() { return listeners.size; },
  } as any;
}

describe('new version notice', () => {
  it('tells the person once when a new version takes over an open page', () => {
    const sw = fakeContainer(true);
    const onUpdate = vi.fn();
    watchForUpdates(sw, onUpdate);
    sw.takeOver();
    sw.takeOver();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('stays quiet on a first visit, when a worker takes over a page that had none', () => {
    const sw = fakeContainer(false);
    const onUpdate = vi.fn();
    watchForUpdates(sw, onUpdate);
    sw.takeOver();
    expect(onUpdate).not.toHaveBeenCalled();
    // ...but a later update on that same page is announced
    sw.takeOver();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('stops watching when asked', () => {
    const sw = fakeContainer(true);
    const stop = watchForUpdates(sw, vi.fn());
    expect(sw.watching).toBe(1);
    stop();
    expect(sw.watching).toBe(0);
  });

  it('the app no longer asks with a browser pop-up or reloads by itself', () => {
    const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../client/src', p), 'utf8');
    expect(read('registerSW.ts')).not.toMatch(/\bconfirm\(/);
    expect(read('lib/pwa-context.tsx')).not.toMatch(/controllerchange[\s\S]{0,80}location\.reload/);
  });
});
