// The app's one offline queue (client/src/lib/outbox.ts, build guide F4): a save made without signal is
// kept with its request id and sent later in order, with the same id on every try, so the server can
// do it once. A save still being saved, or one sent while signed out, waits; one the server refuses
// is flagged for the person.
//
// Runs under Node with a stand-in for the browser's localStorage and connection state (the repo's
// browser test setup needs jsdom, which isn't installed).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { send, flushOutbox, retryOutboxItem } from '../../client/src/lib/outbox';

const store = new Map<string, string>();
const storage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

const read = () => JSON.parse(localStorage.getItem('pulse-outbox') ?? '[]');
const answer = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let online = true;

describe('the offline queue', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage);
    localStorage.clear();
    online = true;
    vi.stubGlobal('navigator', { get onLine() { return online; } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps a save made without signal, and sends it once back online with the same request id', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    online = false;
    const kept = await send('POST', '/api/treatments', { cowId: '12' }, { label: 'Treatment for cow 12' }).catch(e => e);
    expect(kept.queued).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(read()).toMatchObject([{ id: kept.requestId, method: 'POST', url: '/api/treatments', body: { cowId: '12' }, state: 'pending' }]);

    online = true;
    // The connection drops on the way: kept, in order
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await flushOutbox();
    expect(read()).toHaveLength(1);
    // Then it goes
    fetchMock.mockResolvedValueOnce(answer(201, { id: 't1' }));
    await flushOutbox();
    expect(read()).toEqual([]);
    const keys = fetchMock.mock.calls.map(c => (c[1].headers as Record<string, string>)['Idempotency-Key']);
    expect(keys).toEqual([kept.requestId, kept.requestId]);
  });

  it('keeps a save the connection dropped on the way, without losing it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const kept = await send('POST', '/api/compliance/hazards', { title: 'Tomo' }, { label: 'Hazard: Tomo' }).catch(e => e);
    expect(kept.queued).toBe(true);
    expect(read()).toHaveLength(1);
  });

  it('sends in order and waits, without flagging, while a save is still being saved or the person is signed out', async () => {
    online = false;
    await send('POST', '/api/a', {}, { label: 'first' }).catch(() => {});
    await send('POST', '/api/b', {}, { label: 'second' }).catch(() => {});
    online = true;
    const fetchMock = vi.fn().mockResolvedValueOnce(answer(409, { code: 'request_in_progress', error: 'This is still being saved' }));
    vi.stubGlobal('fetch', fetchMock);
    await flushOutbox();
    expect(fetchMock).toHaveBeenCalledTimes(1); // the second waits behind the first
    expect(read().map((i: any) => i.state)).toEqual(['pending', 'pending']);

    fetchMock.mockResolvedValueOnce(answer(401, { error: 'Sign in' }));
    await flushOutbox();
    expect(read()[0]).toMatchObject({ state: 'pending', note: 'Sign in again to send this' });

    fetchMock.mockResolvedValueOnce(answer(201)).mockResolvedValueOnce(answer(201));
    await flushOutbox();
    expect(read()).toEqual([]);
    expect(fetchMock.mock.calls.slice(-2).map(c => c[0])).toEqual(['/api/a', '/api/b']);
  });

  it('flags a save the server refuses, and can try it again', async () => {
    online = false;
    await send('POST', '/api/groups', {}, { label: 'Mob' }).catch(() => {});
    online = true;
    const fetchMock = vi.fn().mockResolvedValueOnce(answer(400, { error: 'Name is required' }));
    vi.stubGlobal('fetch', fetchMock);
    await flushOutbox();
    expect(read()[0]).toMatchObject({ state: 'failed', error: 'Name is required' });

    fetchMock.mockResolvedValueOnce(answer(201));
    retryOutboxItem(read()[0].id);
    await vi.waitFor(() => expect(read()).toEqual([]));
  });

  it('brings farm map jobs queued before every form shared the queue', async () => {
    localStorage.setItem('pulse-application-outbox', JSON.stringify([
      { id: 'old-1', method: 'POST', url: '/api/applications', body: {}, label: 'New job', createdAt: '2026-11-01T00:00:00Z', state: 'pending' },
    ]));
    const fetchMock = vi.fn().mockResolvedValue(answer(201));
    vi.stubGlobal('fetch', fetchMock);
    await flushOutbox();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('pulse-application-outbox')).toBeNull();
    expect(read()).toEqual([]);
  });
});
