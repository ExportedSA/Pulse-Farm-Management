import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import { verifyToken } from './middleware/auth';
import { initRedis, getInstanceId, publishToRedis, subscribeToRedis, REDIS_CHANNELS, isRedisAvailable } from './config/redis';
import logger from './config/logger';

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

interface RedisMessagePayload {
  type: string;
  channelId?: string;
  data: any;
  userId?: string;
  timestamp?: string;
}

class ChatWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ChatClient> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> Set of connection IDs

  initialize(server: Server) {
    // Initialize Redis for WebSocket scaling
    const redisAvailable = initRedis();
    
    if (redisAvailable) {
      logger.info('Redis initialized for WebSocket scaling');
      
      // Subscribe to Redis channels for message broadcasting
      subscribeToRedis(REDIS_CHANNELS.CHAT_MESSAGES, (data: RedisMessagePayload, originInstanceId: string) => {
        this.handleRedisMessage(data, originInstanceId);
      });
      
      subscribeToRedis(REDIS_CHANNELS.CHAT_TYPING, (data: RedisMessagePayload, originInstanceId: string) => {
        this.handleRedisTyping(data, originInstanceId);
      });
    } else {
      logger.warn('Redis not available, WebSocket server running in single-instance mode');
    }
    
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/chat'
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const connectionId = this.generateConnectionId();
      
      try {
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
      } catch (error) {
        console.error(`[WebSocket] Authentication failed for connection ${connectionId}:`, error);
        // Send AUTH_FAILED message and close connection
        ws.send(JSON.stringify({ type: 'AUTH_FAILED', message: 'Authentication failed' }));
        ws.close(1008, 'Authentication failed');
      }
    });

    console.log('[WebSocket] Chat WebSocket server initialized on /ws/chat');
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractUserId(req: IncomingMessage): string {
    try {
      // Extract token from query string
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (!token) {
        throw new Error('No token provided');
      }
      
      // Verify JWT token
      const payload = verifyToken(token);
      
      if (!payload.userId) {
        throw new Error('Invalid token payload');
      }
      
      return payload.userId;
    } catch (error) {
      console.error('[WebSocket] Authentication failed:', error);
      throw new Error('Authentication failed');
    }
  }

  private handleMessage(connectionId: string, message: any) {
    const client = this.clients.get(connectionId);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        // Subscribe to a channel
        if (message.channelId) {
          client.channels.add(message.channelId);
          logger.debug(`[WebSocket] ${connectionId} subscribed to channel: ${message.channelId}`);
        }
        break;

      case 'unsubscribe':
        // Unsubscribe from a channel
        if (message.channelId) {
          client.channels.delete(message.channelId);
          logger.debug(`[WebSocket] ${connectionId} unsubscribed from channel: ${message.channelId}`);
        }
        break;

      case 'typing':
        // Broadcast typing indicator to channel
        if (isRedisAvailable()) {
          // Publish to Redis for cross-instance broadcasting
          publishToRedis(REDIS_CHANNELS.CHAT_TYPING, {
            type: 'typing',
            channelId: message.channelId,
            userId: client.userId,
            isTyping: message.isTyping
          });
        } else {
          // Local broadcasting only
          this.broadcastToChannel(message.channelId, {
            type: 'typing',
            channelId: message.channelId,
            userId: client.userId,
            isTyping: message.isTyping
          }, connectionId);
        }
        break;

      case 'ping':
        // Respond to ping
        this.sendToClient(connectionId, { type: 'pong' });
        break;

      default:
        logger.debug(`[WebSocket] Unknown message type: ${message.type}`);
    }
  }

  // Handle messages received from Redis
  private handleRedisMessage(data: RedisMessagePayload, originInstanceId: string) {
    // Skip if this message came from the same instance (handled by subscribeToRedis)
    // This check is already done in subscribeToRedis, so we just broadcast
    
    if (data.channelId) {
      this.broadcastToChannel(data.channelId, data);
    }
  }

  // Handle typing indicators received from Redis
  private handleRedisTyping(data: RedisMessagePayload, originInstanceId: string) {
    if (data.channelId) {
      this.broadcastToChannel(data.channelId, data);
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
    if (isRedisAvailable()) {
      // Publish to Redis for cross-instance broadcasting
      publishToRedis(REDIS_CHANNELS.CHAT_MESSAGES, {
        type: 'new_message',
        channelId,
        data: message,
        timestamp: new Date().toISOString()
      });
    } else {
      // Local broadcasting only
      this.broadcastToChannel(channelId, {
        type: 'new_message',
        channelId,
        data: message,
        timestamp: new Date().toISOString()
      });
    }
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

  /**
   * Send a message to all connections for a specific user
   */
  sendToUser(userId: string, message: any) {
    const connections = this.userConnections.get(userId);
    if (!connections) return;
    
    connections.forEach(connectionId => {
      this.sendToClient(connectionId, message);
    });
  }

  private broadcastToChannel(channelId: string, message: any, excludeConnectionId?: string) {
    let sentCount = 0;
    
    this.clients.forEach((client, connectionId) => {
      // Skip excluded connection if specified
      if (excludeConnectionId && connectionId === excludeConnectionId) {
        return;
      }
      
      // Send to clients subscribed to this channel
      if (client.channels.has(channelId) && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          logger.error(`[WebSocket] Failed to send message to ${connectionId}:`, error);
        }
      }
    });
    
    if (sentCount > 0) {
      logger.debug(`[WebSocket] Broadcast message to ${sentCount} clients in channel ${channelId}`);
    }
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

  /**
   * Broadcast a new health record event to users subscribed to an animal's channel
   * @param animalChannelId - The chat channel ID for the animal (e.g., 'animal-{animalId}')
   * @param animalId - The animal ID
   * @param record - The new health record data
   */
  broadcastNewHealthRecord(animalChannelId: string, animalId: string, record: any) {
    const payload = {
      type: 'NEW_HEALTH_RECORD',
      animalId,
      channelId: animalChannelId,
      data: record,
      timestamp: new Date().toISOString()
    };

    if (isRedisAvailable()) {
      // Publish to Redis for cross-instance broadcasting
      publishToRedis(REDIS_CHANNELS.CHAT_MESSAGES, payload);
    } else {
      // Local broadcasting only
      this.broadcastToChannel(animalChannelId, payload);
    }
    
    logger.info(`[WebSocket] Broadcast NEW_HEALTH_RECORD for animal ${animalId}`);
  }

  /**
   * Broadcast a notification to a specific user
   * @param userId - The user ID to send the notification to
   * @param notification - The notification data
   */
  broadcastNotification(userId: string, notification: any) {
    const payload = {
      type: 'NEW_NOTIFICATION',
      data: notification,
      timestamp: new Date().toISOString()
    };

    this.sendToUser(userId, payload);
    logger.debug(`[WebSocket] Sent notification to user ${userId}`);
  }

  /**
   * Broadcast a notification to multiple users
   * @param userIds - Array of user IDs to send the notification to
   * @param notification - The notification data
   */
  broadcastNotificationToUsers(userIds: string[], notification: any) {
    const payload = {
      type: 'NEW_NOTIFICATION',
      data: notification,
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, payload);
    });
    
    logger.debug(`[WebSocket] Broadcast notification to ${userIds.length} users`);
  }

  // ===== ANIMAL RECORD EVENTS =====

  /**
   * Broadcast when a new animal is added to the farm
   * @param userIds - Array of user IDs (farm members) to notify
   * @param animal - The new animal data
   */
  broadcastAnimalAdded(userIds: string[], animal: any) {
    const payload = {
      type: 'ANIMAL_ADDED',
      data: animal,
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, payload);
    });

    logger.info(`[WebSocket] Broadcast ANIMAL_ADDED for animal ${animal.id} to ${userIds.length} users`);
  }

  /**
   * Broadcast when an animal record is updated
   * @param userIds - Array of user IDs (farm members) to notify
   * @param animal - The updated animal data
   */
  broadcastAnimalUpdated(userIds: string[], animal: any) {
    const payload = {
      type: 'ANIMAL_UPDATED',
      data: animal,
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, payload);
    });

    logger.info(`[WebSocket] Broadcast ANIMAL_UPDATED for animal ${animal.id} to ${userIds.length} users`);
  }

  /**
   * Broadcast when an animal is removed (soft-deleted or permanently deleted)
   * @param userIds - Array of user IDs (farm members) to notify
   * @param animalId - The ID of the removed animal
   * @param status - The new status (e.g., 'sold', 'deceased') or 'deleted' for permanent removal
   */
  broadcastAnimalRemoved(userIds: string[], animalId: string, status: string) {
    const payload = {
      type: 'ANIMAL_REMOVED',
      data: { id: animalId, status },
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, payload);
    });

    logger.info(`[WebSocket] Broadcast ANIMAL_REMOVED for animal ${animalId} to ${userIds.length} users`);
  }

  // ===== TASK EVENTS =====

  /**
   * Broadcast when a task is assigned to a user
   * @param assigneeId - The user ID of the assignee
   * @param task - The task data
   */
  broadcastTaskAssigned(assigneeId: string, task: any) {
    const payload = {
      type: 'TASK_ASSIGNED',
      data: task,
      timestamp: new Date().toISOString()
    };

    this.sendToUser(assigneeId, payload);
    logger.info(`[WebSocket] Broadcast TASK_ASSIGNED for task ${task.id} to user ${assigneeId}`);
  }

  /**
   * Broadcast when a new task is created (to managers/farm members)
   * @param userIds - Array of user IDs to notify
   * @param task - The new task data
   */
  broadcastTaskCreated(userIds: string[], task: any) {
    const payload = {
      type: 'TASK_CREATED',
      data: task,
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, payload);
    });

    logger.info(`[WebSocket] Broadcast TASK_CREATED for task ${task.id} to ${userIds.length} users`);
  }

  /**
   * Broadcast when a task is updated
   * @param userIds - Array of user IDs to notify
   * @param task - The updated task data
   */
  broadcastTaskUpdated(userIds: string[], task: any) {
    const payload = {
      type: 'TASK_UPDATED',
      data: task,
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, payload);
    });

    logger.info(`[WebSocket] Broadcast TASK_UPDATED for task ${task.id} to ${userIds.length} users`);
  }

  /**
   * Broadcast when a task is completed
   * @param userIds - Array of user IDs to notify (e.g., manager, creator)
   * @param task - The completed task data
   * @param completedByName - Name of the user who completed the task
   */
  broadcastTaskCompleted(userIds: string[], task: any, completedByName: string) {
    const payload = {
      type: 'TASK_COMPLETED',
      data: { ...task, completedByName },
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, payload);
    });

    logger.info(`[WebSocket] Broadcast TASK_COMPLETED for task ${task.id} to ${userIds.length} users`);
  }

  // ===== ROSTER EVENTS =====

  /**
   * Broadcast when a new shift is scheduled
   * @param staffUserId - The user ID of the staff member assigned to the shift
   * @param rosterEntry - The roster entry data
   */
  broadcastShiftScheduled(staffUserId: string, rosterEntry: any) {
    const payload = {
      type: 'SHIFT_SCHEDULED',
      data: rosterEntry,
      timestamp: new Date().toISOString()
    };

    this.sendToUser(staffUserId, payload);
    logger.info(`[WebSocket] Broadcast SHIFT_SCHEDULED for roster ${rosterEntry.id} to user ${staffUserId}`);
  }

  /**
   * Broadcast roster update to managers
   * @param userIds - Array of manager user IDs
   * @param rosterEntry - The roster entry data
   */
  broadcastRosterUpdated(userIds: string[], rosterEntry: any) {
    const payload = {
      type: 'ROSTER_UPDATED',
      data: rosterEntry,
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, payload);
    });

    logger.info(`[WebSocket] Broadcast ROSTER_UPDATED for roster ${rosterEntry.id} to ${userIds.length} users`);
  }

  // ===== TIMESHEET EVENTS =====

  /**
   * Broadcast when a user clocks in
   * @param userIds - Array of user IDs to notify (e.g., managers)
   * @param staffName - Name of the staff who clocked in
   * @param staffProfileId - Staff profile ID
   */
  broadcastUserClockedIn(userIds: string[], staffName: string, staffProfileId: string) {
    const payload = {
      type: 'USER_CLOCKED_IN',
      data: { staffName, staffProfileId, clockedInAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, payload);
    });

    logger.info(`[WebSocket] Broadcast USER_CLOCKED_IN for ${staffName} to ${userIds.length} users`);
  }

  /**
   * Broadcast when a user clocks out
   * @param userIds - Array of user IDs to notify (e.g., managers)
   * @param staffName - Name of the staff who clocked out
   * @param staffProfileId - Staff profile ID
   * @param totalHours - Total hours worked
   */
  broadcastUserClockedOut(userIds: string[], staffName: string, staffProfileId: string, totalHours: string) {
    const payload = {
      type: 'USER_CLOCKED_OUT',
      data: { staffName, staffProfileId, totalHours, clockedOutAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, payload);
    });

    logger.info(`[WebSocket] Broadcast USER_CLOCKED_OUT for ${staffName} to ${userIds.length} users`);
  }

  // ===== EQUIPMENT & DEVICE EVENTS =====

  /**
   * Broadcast when equipment status changes
   * @param userIds - Array of user IDs to notify (farm users)
   * @param equipment - The updated equipment object
   * @param previousStatus - The previous status before change
   */
  broadcastEquipmentStatusChanged(userIds: string[], equipment: any, previousStatus?: string) {
    const payload = {
      type: 'EQUIPMENT_STATUS_CHANGED',
      data: { 
        equipmentId: equipment.id,
        equipment,
        previousStatus,
        newStatus: equipment.status,
      },
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, payload);
    });

    logger.info(`[WebSocket] Broadcast EQUIPMENT_STATUS_CHANGED for ${equipment.name} (${equipment.id}) to ${userIds.length} users`);
  }

  /**
   * Broadcast when a new maintenance log is added
   * @param userIds - Array of user IDs to notify (farm users)
   * @param equipmentId - Equipment ID
   * @param maintenanceRecord - The new maintenance record
   * @param equipment - The updated equipment object (optional)
   */
  broadcastNewMaintenanceLog(userIds: string[], equipmentId: string, maintenanceRecord: any, equipment?: any) {
    const payload = {
      type: 'NEW_MAINTENANCE_LOG',
      data: { 
        equipmentId,
        maintenanceRecord,
        equipment,
      },
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, payload);
    });

    logger.info(`[WebSocket] Broadcast NEW_MAINTENANCE_LOG for equipment ${equipmentId} to ${userIds.length} users`);
  }

  /**
   * Broadcast device reading/data update
   * @param userIds - Array of user IDs to notify (farm users)
   * @param deviceId - Device ID
   * @param data - The sensor reading data
   * @param equipmentId - Associated equipment ID (optional)
   */
  broadcastDeviceReading(userIds: string[], deviceId: string, data: any, equipmentId?: string) {
    const payload = {
      type: 'DEVICE_READING',
      data: { 
        deviceId,
        equipmentId,
        reading: data,
        receivedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, payload);
    });

    logger.info(`[WebSocket] Broadcast DEVICE_READING for device ${deviceId} to ${userIds.length} users`);
  }

  /**
   * Broadcast device status change (online/offline/error)
   * @param userIds - Array of user IDs to notify (farm users)
   * @param deviceId - Device ID
   * @param status - New device status
   * @param deviceName - Device name for display
   * @param equipmentId - Associated equipment ID (optional)
   */
  broadcastDeviceStatus(userIds: string[], deviceId: string, status: string, deviceName?: string, equipmentId?: string) {
    const payload = {
      type: 'DEVICE_STATUS',
      data: { 
        deviceId,
        equipmentId,
        status,
        deviceName,
        changedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, payload);
    });

    logger.info(`[WebSocket] Broadcast DEVICE_STATUS (${status}) for device ${deviceId} to ${userIds.length} users`);
  }

  /**
   * Broadcast equipment alert (e.g., service overdue, warranty expiring)
   * @param userIds - Array of user IDs to notify (farm users)
   * @param equipment - Equipment object
   * @param alertType - Type of alert (service_overdue, warranty_expiring, etc.)
   * @param message - Alert message
   */
  broadcastEquipmentAlert(userIds: string[], equipment: any, alertType: string, message: string) {
    const payload = {
      type: 'EQUIPMENT_ALERT',
      data: { 
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        alertType,
        message,
      },
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, payload);
    });

    logger.info(`[WebSocket] Broadcast EQUIPMENT_ALERT (${alertType}) for ${equipment.name} to ${userIds.length} users`);
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
