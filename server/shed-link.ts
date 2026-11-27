// The shed link (docs/shed-link-protocol.md): Stride, on the shed PC, connects out to /ws/shed with its
// link token and keeps the connection open. Pulse sends it the farm's draft list and feed levels, and
// commands from the Shed page; Stride sends back what happened, which is kept in shed_events.
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'http';
import logger from './config/logger';
import { compileSnapshot, farmName, gatewayForToken, markSeen, storeEvents, MAX_EVENTS_PER_MESSAGE } from './domain/shed';

export const SHED_LINK_PATH = '/ws/shed';
const PROTOCOL = 1;
const PING_MS = 30_000;
const REFRESH_MS = 2 * 60_000; // records change without telling the link; look again this often
const COMMAND_TIMEOUT_MS = 10_000;

export type ShedCommand =
  | { action: 'draft'; lane: 'LEFT' | 'RIGHT' | 'STRAIGHT' }
  | { action: 'feed_start'; bail: number; grams: number }
  | { action: 'feed_stop'; bail: number };

export type ShedStatus = {
  gate?: string;
  bails?: { bail: number; actualGrams: number; targetGrams: number; feeding: boolean }[];
  at: string;
};

type Connection = {
  ws: WebSocket;
  gatewayId: string;
  farmId: string;
  alive: boolean;
  snapshotVersion: string | null;
  hello: { app?: string; version?: string; remoteControl?: boolean; hardware?: Record<string, unknown> } | null;
  status: ShedStatus | null;
  pending: Map<string, { resolve: (r: { ok: boolean; error?: string }) => void; timer: NodeJS.Timeout }>;
};

function bearer(req: IncomingMessage): string {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

class ShedLink {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, Connection>(); // by gateway id
  private timers: NodeJS.Timeout[] = [];

  initialize(server: Server) {
    if (this.wss) return;
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
    // Claim only our own path, like the chat and scanner sockets (server/websocket.ts)
    server.on('upgrade', (req, socket, head) => {
      const pathname = new URL(req.url || '', 'http://localhost').pathname;
      if (pathname !== SHED_LINK_PATH) return;
      this.wss!.handleUpgrade(req, socket, head, ws => this.connect(ws, req));
    });
    const ping = setInterval(() => {
      for (const c of Array.from(this.connections.values())) {
        if (!c.alive) { c.ws.terminate(); continue; }
        c.alive = false;
        c.ws.ping();
      }
    }, PING_MS);
    const refresh = setInterval(() => {
      for (const c of Array.from(this.connections.values())) void this.sendSnapshot(c, false);
    }, REFRESH_MS);
    ping.unref();
    refresh.unref();
    this.timers.push(ping, refresh);
  }

  private async connect(ws: WebSocket, req: IncomingMessage) {
    let gateway: Awaited<ReturnType<typeof gatewayForToken>> = null;
    try {
      gateway = await gatewayForToken(bearer(req));
    } catch (err) {
      logger.error({ err }, 'Shed link: could not check a link token');
      ws.close(1011, 'Try again');
      return;
    }
    if (!gateway) return ws.close(4401, 'Link token not recognised');
    if (!gateway.isActive || gateway.kind !== 'stride') return ws.close(4403, 'This gateway is stopped or not a Stride gateway');

    const previous = this.connections.get(gateway.id);
    if (previous) previous.ws.close(4409, 'Replaced by a newer connection');

    const conn: Connection = {
      ws, gatewayId: gateway.id, farmId: gateway.farmId, alive: true,
      snapshotVersion: null, hello: null, status: null, pending: new Map(),
    };
    this.connections.set(gateway.id, conn);
    ws.on('pong', () => { conn.alive = true; });
    ws.on('message', data => void this.receive(conn, data.toString()));
    ws.on('close', () => {
      if (this.connections.get(conn.gatewayId) === conn) this.connections.delete(conn.gatewayId);
      for (const p of Array.from(conn.pending.values())) { clearTimeout(p.timer); p.resolve({ ok: false, error: 'Stride disconnected' }); }
      conn.pending.clear();
    });
    ws.on('error', err => logger.warn({ err, gatewayId: conn.gatewayId }, 'Shed link socket error'));

    void markSeen(conn.gatewayId).catch(() => undefined);
    this.send(conn, {
      type: 'welcome', protocol: PROTOCOL, farmName: await farmName(conn.farmId).catch(() => ''),
      gatewayId: conn.gatewayId, serverTime: new Date().toISOString(),
    });
    await this.sendSnapshot(conn, true);
    logger.info({ gatewayId: conn.gatewayId, farmId: conn.farmId }, 'Stride connected');
  }

  private send(conn: Connection, message: unknown) {
    if (conn.ws.readyState === WebSocket.OPEN) conn.ws.send(JSON.stringify(message));
  }

  /** Sends the farm's current snapshot, or only when it changed since the last one Stride has */
  private async sendSnapshot(conn: Connection, always: boolean) {
    try {
      const snapshot = await compileSnapshot(conn.farmId);
      if (!always && snapshot.version === conn.snapshotVersion) return;
      conn.snapshotVersion = snapshot.version;
      this.send(conn, snapshot);
    } catch (err) {
      logger.error({ err, gatewayId: conn.gatewayId }, 'Shed link: could not build the snapshot');
    }
  }

  private async receive(conn: Connection, text: string) {
    conn.alive = true;
    let msg: any;
    try { msg = JSON.parse(text); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;
    void markSeen(conn.gatewayId).catch(() => undefined);

    switch (msg.type) {
      case 'hello':
        conn.hello = {
          app: typeof msg.app === 'string' ? msg.app.slice(0, 50) : undefined,
          version: typeof msg.version === 'string' ? msg.version.slice(0, 30) : undefined,
          remoteControl: msg.remoteControl === true,
          hardware: msg.hardware && typeof msg.hardware === 'object' ? msg.hardware : undefined,
        };
        if (typeof msg.snapshotVersion === 'string' && msg.snapshotVersion !== conn.snapshotVersion) await this.sendSnapshot(conn, true);
        else if (typeof msg.snapshotVersion === 'string') conn.snapshotVersion = msg.snapshotVersion;
        break;
      case 'events': {
        const events = Array.isArray(msg.events) ? msg.events.slice(0, MAX_EVENTS_PER_MESSAGE) : [];
        if (!events.length) break;
        try {
          const { acked, rejected } = await storeEvents(conn.farmId, conn.gatewayId, events);
          if (rejected) logger.warn({ gatewayId: conn.gatewayId, rejected }, 'Shed link: malformed events skipped');
          this.send(conn, { type: 'events_ack', ids: acked });
        } catch (err) {
          // Not acknowledged, so Stride sends them again later
          logger.error({ err, gatewayId: conn.gatewayId }, 'Shed link: could not store events');
        }
        break;
      }
      case 'status':
        conn.status = {
          gate: typeof msg.gate === 'string' ? msg.gate.slice(0, 20) : undefined,
          bails: Array.isArray(msg.bails) ? msg.bails.slice(0, 20).map((b: any) => ({
            bail: Number(b?.bail) || 0,
            actualGrams: Number(b?.actualGrams) || 0,
            targetGrams: Number(b?.targetGrams) || 0,
            feeding: b?.feeding === true,
          })) : undefined,
          at: new Date().toISOString(),
        };
        break;
      case 'command_result': {
        const pending = typeof msg.id === 'string' ? conn.pending.get(msg.id) : undefined;
        if (pending) {
          clearTimeout(pending.timer);
          conn.pending.delete(msg.id);
          pending.resolve({ ok: msg.ok === true, error: typeof msg.error === 'string' ? msg.error.slice(0, 300) : undefined });
        }
        break;
      }
      case 'snapshot_request':
        await this.sendSnapshot(conn, true);
        break;
      default:
        break; // unknown types are ignored (protocol: either side may add messages)
    }
  }

  isConnected(gatewayId: string): boolean {
    return this.connections.get(gatewayId)?.ws.readyState === WebSocket.OPEN;
  }

  info(gatewayId: string) {
    const c = this.connections.get(gatewayId);
    if (!c) return { connected: false as const };
    return { connected: c.ws.readyState === WebSocket.OPEN, hello: c.hello, status: c.status, snapshotVersion: c.snapshotVersion };
  }

  /** Sends a command to the farm's Stride and waits for its answer */
  sendCommand(gatewayId: string, command: ShedCommand): Promise<{ ok: boolean; error?: string }> {
    const conn = this.connections.get(gatewayId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) return Promise.resolve({ ok: false, error: 'Stride is not connected' });
    const id = crypto.randomUUID();
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        conn.pending.delete(id);
        resolve({ ok: false, error: 'Stride did not answer in time' });
      }, COMMAND_TIMEOUT_MS);
      conn.pending.set(id, { resolve, timer });
      this.send(conn, { type: 'command', id, ...command });
    });
  }

  /** After a change to a farm's rules or levels: send its Stride the new snapshot straight away */
  async refreshFarm(farmId: string) {
    await Promise.all(Array.from(this.connections.values()).filter(c => c.farmId === farmId).map(c => this.sendSnapshot(c, false)));
  }

  /** Tests: drop every connection and timer */
  close() {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    for (const c of Array.from(this.connections.values())) c.ws.terminate();
    this.connections.clear();
    this.wss?.close();
    this.wss = null;
  }
}

export const shedLink = new ShedLink();
