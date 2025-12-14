import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';

interface ChatClient {
  ws: WebSocket;
  userId: string;
  channels: Set<string>;
}

interface ChatMessage {
  type: 'message' | 'typing' | 'read' | 'edit' | 'delete' | 'join' | 'leave' | 'mention';
  channelId: string;
  data: any;
  userId?: string;
  timestamp?: string;
}

class ChatWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ChatClient> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> Set of connection IDs

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/chat'
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const connectionId = this.generateConnectionId();
      const userId = this.extractUserId(req);
      
      console.log(`[WebSocket] New connection: ${connectionId} for user: ${userId}`);

      const client: ChatClient = {
        ws,
        userId,
        channels: new Set()
      };

      this.clients.set(connectionId, client);
      
      // Track user connections
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId)!.add(connectionId);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(connectionId, message);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`[WebSocket] Connection closed: ${connectionId}`);
        this.handleDisconnect(connectionId);
      });

      ws.on('error', (error) => {
        console.error(`[WebSocket] Error on connection ${connectionId}:`, error);
      });

      // Send connection acknowledgment
      this.sendToClient(connectionId, {
        type: 'connected',
        connectionId,
        userId
      });
    });

    console.log('[WebSocket] Chat WebSocket server initialized on /ws/chat');
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractUserId(req: IncomingMessage): string {
    // Extract userId from query string or cookie
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');
    return userId || 'demo-user'; // Fallback for demo
  }

  private handleMessage(connectionId: string, message: any) {
    const client = this.clients.get(connectionId);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        // Subscribe to a channel
        if (message.channelId) {
          client.channels.add(message.channelId);
          console.log(`[WebSocket] ${connectionId} subscribed to channel: ${message.channelId}`);
        }
        break;

      case 'unsubscribe':
        // Unsubscribe from a channel
        if (message.channelId) {
          client.channels.delete(message.channelId);
          console.log(`[WebSocket] ${connectionId} unsubscribed from channel: ${message.channelId}`);
        }
        break;

      case 'typing':
        // Broadcast typing indicator to channel
        this.broadcastToChannel(message.channelId, {
          type: 'typing',
          channelId: message.channelId,
          userId: client.userId,
          isTyping: message.isTyping
        }, connectionId);
        break;

      case 'ping':
        // Respond to ping
        this.sendToClient(connectionId, { type: 'pong' });
        break;

      default:
        console.log(`[WebSocket] Unknown message type: ${message.type}`);
    }
  }

  private handleDisconnect(connectionId: string) {
    const client = this.clients.get(connectionId);
    if (client) {
      // Remove from user connections
      const userConns = this.userConnections.get(client.userId);
      if (userConns) {
        userConns.delete(connectionId);
        if (userConns.size === 0) {
          this.userConnections.delete(client.userId);
        }
      }
      
      // Notify channels that user left
      client.channels.forEach(channelId => {
        this.broadcastToChannel(channelId, {
          type: 'user_offline',
          channelId,
          userId: client.userId
        }, connectionId);
      });
    }
    
    this.clients.delete(connectionId);
  }

  private sendToClient(connectionId: string, data: any) {
    const client = this.clients.get(connectionId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  }

  // Public methods for broadcasting from routes

  /**
   * Broadcast a new message to all subscribers of a channel
   */
  broadcastNewMessage(channelId: string, message: any) {
    this.broadcastToChannel(channelId, {
      type: 'new_message',
      channelId,
      data: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast message edit to all subscribers of a channel
   */
  broadcastMessageEdit(channelId: string, messageId: string, newBody: string, editedAt: string) {
    this.broadcastToChannel(channelId, {
      type: 'message_edited',
      channelId,
      data: { messageId, newBody, editedAt },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast message deletion to all subscribers of a channel
   */
  broadcastMessageDelete(channelId: string, messageId: string) {
    this.broadcastToChannel(channelId, {
      type: 'message_deleted',
      channelId,
      data: { messageId },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast read receipt to all subscribers of a channel
   */
  broadcastReadReceipt(channelId: string, messageId: string, userId: string) {
    this.broadcastToChannel(channelId, {
      type: 'message_read',
      channelId,
      data: { messageId, userId, readAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send notification to specific user (for @mentions)
   */
  notifyUser(userId: string, notification: any) {
    const userConns = this.userConnections.get(userId);
    if (userConns) {
      userConns.forEach(connectionId => {
        this.sendToClient(connectionId, {
          type: 'notification',
          data: notification,
          timestamp: new Date().toISOString()
        });
      });
    }
  }

  /**
   * Broadcast unread count update to a user
   */
  broadcastUnreadCount(userId: string, channelId: string, unreadCount: number) {
    const userConns = this.userConnections.get(userId);
    if (userConns) {
      userConns.forEach(connectionId => {
        this.sendToClient(connectionId, {
          type: 'unread_count',
          channelId,
          data: { unreadCount },
          timestamp: new Date().toISOString()
        });
      });
    }
  }

  private broadcastToChannel(channelId: string, data: any, excludeConnectionId?: string) {
    this.clients.forEach((client, connectionId) => {
      if (client.channels.has(channelId) && connectionId !== excludeConnectionId) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify(data));
        }
      }
    });
  }

  /**
   * Get online users for a channel
   */
  getOnlineUsersInChannel(channelId: string): string[] {
    const users = new Set<string>();
    this.clients.forEach(client => {
      if (client.channels.has(channelId)) {
        users.add(client.userId);
      }
    });
    return Array.from(users);
  }

  /**
   * Check if a user is online
   */
  isUserOnline(userId: string): boolean {
    return this.userConnections.has(userId) && this.userConnections.get(userId)!.size > 0;
  }
}

// Singleton instance
export const chatWebSocket = new ChatWebSocketServer();

// Scanner WebSocket Server for mobile barcode scanning
interface ScannerSession {
  host: WebSocket | null;
  clients: Set<WebSocket>;
}

class ScannerWebSocketServer {
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, ScannerSession> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/scanner'
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const sessionId = url.searchParams.get('session');
      const role = url.searchParams.get('role'); // 'host' for desktop, undefined for mobile

      if (!sessionId) {
        ws.close(1008, 'Session ID required');
        return;
      }

      console.log(`[Scanner WS] Connection: session=${sessionId}, role=${role || 'client'}`);

      // Get or create session
      if (!this.sessions.has(sessionId)) {
        this.sessions.set(sessionId, { host: null, clients: new Set() });
      }
      const session = this.sessions.get(sessionId)!;

      if (role === 'host') {
        // Desktop connecting as host
        session.host = ws;
        console.log(`[Scanner WS] Host connected for session ${sessionId}`);
      } else {
        // Mobile connecting as client
        session.clients.add(ws);
        console.log(`[Scanner WS] Client connected for session ${sessionId}`);
        
        // Notify host that client connected
        if (session.host && session.host.readyState === WebSocket.OPEN) {
          session.host.send(JSON.stringify({ type: 'client_connected' }));
        }
      }

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'barcode' && session.host && session.host.readyState === WebSocket.OPEN) {
            // Forward barcode from mobile to desktop
            session.host.send(JSON.stringify({
              type: 'barcode',
              barcode: message.barcode
            }));
            console.log(`[Scanner WS] Barcode forwarded: ${message.barcode}`);
          }
        } catch (error) {
          console.error('[Scanner WS] Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        if (role === 'host') {
          session.host = null;
          console.log(`[Scanner WS] Host disconnected for session ${sessionId}`);
          // Notify all clients
          session.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'host_disconnected' }));
            }
          });
        } else {
          session.clients.delete(ws);
          console.log(`[Scanner WS] Client disconnected for session ${sessionId}`);
          // Notify host
          if (session.host && session.host.readyState === WebSocket.OPEN) {
            session.host.send(JSON.stringify({ type: 'client_disconnected' }));
          }
        }

        // Clean up empty sessions
        if (!session.host && session.clients.size === 0) {
          this.sessions.delete(sessionId);
          console.log(`[Scanner WS] Session ${sessionId} cleaned up`);
        }
      });

      ws.on('error', (error) => {
        console.error(`[Scanner WS] Error:`, error);
      });
    });

    console.log('[Scanner WS] Scanner WebSocket server initialized on /ws/scanner');
  }
}

export const scannerWebSocket = new ScannerWebSocketServer();
