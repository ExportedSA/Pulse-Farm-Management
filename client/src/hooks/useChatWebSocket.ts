import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';

interface WebSocketMessage {
  type: string;
  channelId?: string;
  data?: any;
  timestamp?: string;
  userId?: string;
}

interface UseChatWebSocketOptions {
  onNewMessage?: (channelId: string, message: any) => void;
  onMessageEdited?: (channelId: string, messageId: string, newBody: string, editedAt: string) => void;
  onMessageDeleted?: (channelId: string, messageId: string) => void;
  onTyping?: (channelId: string, userId: string, isTyping: boolean) => void;
  onMessageRead?: (channelId: string, messageId: string, userId: string) => void;
  onUnreadCount?: (channelId: string, count: number) => void;
  onNotification?: (notification: any) => void;
  onUserOnline?: (channelId: string, userId: string) => void;
  onUserOffline?: (channelId: string, userId: string) => void;
  onCallOffer?: (callMessage: any) => void;
  onCallAnswer?: (callMessage: any) => void;
  onCallIceCandidate?: (callMessage: any) => void;
  onCallRing?: (callMessage: any) => void;
  onCallHangup?: (callMessage: any) => void;
  // Animal health record events
  onNewHealthRecord?: (animalId: string, record: any) => void;
  // Generic notification events
  onNewNotification?: (notification: any) => void;
  // Animal record events
  onAnimalAdded?: (animal: any) => void;
  onAnimalUpdated?: (animal: any) => void;
  onAnimalRemoved?: (animalId: string, status: string) => void;
  // Task events
  onTaskAssigned?: (task: any) => void;
  onTaskCreated?: (task: any) => void;
  onTaskUpdated?: (task: any) => void;
  onTaskCompleted?: (task: any) => void;
  // Roster events
  onShiftScheduled?: (rosterEntry: any) => void;
  onRosterUpdated?: (rosterEntry: any) => void;
  // Timesheet events
  onUserClockedIn?: (data: { staffName: string; staffProfileId: string; clockedInAt: string }) => void;
  onUserClockedOut?: (data: { staffName: string; staffProfileId: string; totalHours: string; clockedOutAt: string }) => void;
  // Equipment events
  onEquipmentStatusChanged?: (data: { equipmentId: string; equipment: any; previousStatus: string; newStatus: string }) => void;
  onNewMaintenanceLog?: (data: { equipmentId: string; maintenanceRecord: any; equipment: any }) => void;
  onEquipmentAlert?: (data: { equipmentId: string; equipmentName: string; alertType: string; message: string }) => void;
  // Device events
  onDeviceReading?: (data: { deviceId: string; equipmentId?: string; reading: any; receivedAt: string }) => void;
  onDeviceStatus?: (data: { deviceId: string; equipmentId?: string; status: string; deviceName?: string; changedAt: string }) => void;
}

export function useChatWebSocket(options: UseChatWebSocketOptions = {}) {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedChannelsRef = useRef<Set<string>>(new Set());
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const userId = user?.id || 'demo-user';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/chat?userId=${userId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);

        // Resubscribe to channels
        subscribedChannelsRef.current.forEach(channelId => {
          ws.send(JSON.stringify({ type: 'subscribe', channelId }));
        });

        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setIsConnected(false);
        setConnectionId(null);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[WebSocket] Attempting to reconnect...');
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
    }
  }, [user?.id]);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'connected':
        setConnectionId(message.data?.connectionId || null);
        break;

      case 'new_message':
        if (message.channelId && message.data) {
          options.onNewMessage?.(message.channelId, message.data);
        }
        break;

      case 'message_edited':
        if (message.channelId && message.data) {
          options.onMessageEdited?.(
            message.channelId,
            message.data.messageId,
            message.data.newBody,
            message.data.editedAt
          );
        }
        break;

      case 'message_deleted':
        if (message.channelId && message.data) {
          options.onMessageDeleted?.(message.channelId, message.data.messageId);
        }
        break;

      case 'typing':
        if (message.channelId && message.userId !== undefined) {
          options.onTyping?.(message.channelId, message.userId, message.data?.isTyping ?? false);
        }
        break;

      case 'message_read':
        if (message.channelId && message.data) {
          options.onMessageRead?.(message.channelId, message.data.messageId, message.data.userId);
        }
        break;

      case 'unread_count':
        if (message.channelId && message.data) {
          options.onUnreadCount?.(message.channelId, message.data.unreadCount);
        }
        break;

      case 'notification':
        if (message.data) {
          options.onNotification?.(message.data);
        }
        break;

      case 'user_online':
        if (message.channelId && message.userId) {
          options.onUserOnline?.(message.channelId, message.userId);
        }
        break;

      case 'user_offline':
        if (message.channelId && message.userId) {
          options.onUserOffline?.(message.channelId, message.userId);
        }
        break;

      case 'pong':
        // Heartbeat response, no action needed
        break;

      case 'call-offer':
        if (message.data) {
          options.onCallOffer?.(message.data);
        }
        break;

      case 'call-answer':
        if (message.data) {
          options.onCallAnswer?.(message.data);
        }
        break;

      case 'call-ice-candidate':
        if (message.data) {
          options.onCallIceCandidate?.(message.data);
        }
        break;

      case 'call-ring':
        if (message.data) {
          options.onCallRing?.(message.data);
        }
        break;

      case 'call-hangup':
        if (message.data) {
          options.onCallHangup?.(message.data);
        }
        break;

      // Animal health record events
      case 'NEW_HEALTH_RECORD':
        if (message.data) {
          const animalId = (message as any).animalId || message.data.animalId;
          options.onNewHealthRecord?.(animalId, message.data);
          console.log('[WebSocket] New health record for animal:', animalId);
        }
        break;

      // Generic notification events
      case 'NEW_NOTIFICATION':
        if (message.data) {
          options.onNewNotification?.(message.data);
          console.log('[WebSocket] New notification received:', message.data.title);
        }
        break;

      // Animal record events
      case 'ANIMAL_ADDED':
        if (message.data) {
          options.onAnimalAdded?.(message.data);
          console.log('[WebSocket] Animal added:', message.data.name || message.data.visualId);
        }
        break;

      case 'ANIMAL_UPDATED':
        if (message.data) {
          options.onAnimalUpdated?.(message.data);
          console.log('[WebSocket] Animal updated:', message.data.id);
        }
        break;

      case 'ANIMAL_REMOVED':
        if (message.data) {
          options.onAnimalRemoved?.(message.data.id, message.data.status);
          console.log('[WebSocket] Animal removed:', message.data.id, message.data.status);
        }
        break;

      // Task events
      case 'TASK_ASSIGNED':
        if (message.data) {
          options.onTaskAssigned?.(message.data);
          console.log('[WebSocket] Task assigned:', message.data.title);
        }
        break;

      case 'TASK_CREATED':
        if (message.data) {
          options.onTaskCreated?.(message.data);
          console.log('[WebSocket] Task created:', message.data.title);
        }
        break;

      case 'TASK_UPDATED':
        if (message.data) {
          options.onTaskUpdated?.(message.data);
          console.log('[WebSocket] Task updated:', message.data.id);
        }
        break;

      case 'TASK_COMPLETED':
        if (message.data) {
          options.onTaskCompleted?.(message.data);
          console.log('[WebSocket] Task completed:', message.data.title, 'by', message.data.completedByName);
        }
        break;

      // Roster events
      case 'SHIFT_SCHEDULED':
        if (message.data) {
          options.onShiftScheduled?.(message.data);
          console.log('[WebSocket] Shift scheduled:', message.data.date, message.data.startTime);
        }
        break;

      case 'ROSTER_UPDATED':
        if (message.data) {
          options.onRosterUpdated?.(message.data);
          console.log('[WebSocket] Roster updated:', message.data.id);
        }
        break;

      // Timesheet events
      case 'USER_CLOCKED_IN':
        if (message.data) {
          options.onUserClockedIn?.(message.data);
          console.log('[WebSocket] User clocked in:', message.data.staffName);
        }
        break;

      case 'USER_CLOCKED_OUT':
        if (message.data) {
          options.onUserClockedOut?.(message.data);
          console.log('[WebSocket] User clocked out:', message.data.staffName, 'Total:', message.data.totalHours, 'hrs');
        }
        break;

      // Equipment events
      case 'EQUIPMENT_STATUS_CHANGED':
        if (message.data) {
          options.onEquipmentStatusChanged?.(message.data);
          console.log('[WebSocket] Equipment status changed:', message.data.equipment?.name, 'from', message.data.previousStatus, 'to', message.data.newStatus);
        }
        break;

      case 'NEW_MAINTENANCE_LOG':
        if (message.data) {
          options.onNewMaintenanceLog?.(message.data);
          console.log('[WebSocket] New maintenance log for equipment:', message.data.equipmentId);
        }
        break;

      case 'EQUIPMENT_ALERT':
        if (message.data) {
          options.onEquipmentAlert?.(message.data);
          console.log('[WebSocket] Equipment alert:', message.data.alertType, '-', message.data.message);
        }
        break;

      // Device events
      case 'DEVICE_READING':
        if (message.data) {
          options.onDeviceReading?.(message.data);
          console.log('[WebSocket] Device reading:', message.data.deviceId, message.data.reading);
        }
        break;

      case 'DEVICE_STATUS':
        if (message.data) {
          options.onDeviceStatus?.(message.data);
          console.log('[WebSocket] Device status:', message.data.deviceName || message.data.deviceId, '->', message.data.status);
        }
        break;

      default:
        console.log('[WebSocket] Unknown message type:', message.type);
    }
  }, [options]);

  // Subscribe to a channel
  const subscribeToChannel = useCallback((channelId: string) => {
    subscribedChannelsRef.current.add(channelId);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', channelId }));
    }
  }, []);

  // Unsubscribe from a channel
  const unsubscribeFromChannel = useCallback((channelId: string) => {
    subscribedChannelsRef.current.delete(channelId);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', channelId }));
    }
  }, []);

  // Send typing indicator
  const sendTypingIndicator = useCallback((channelId: string, isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', channelId, isTyping }));
    }
  }, []);

  // Send call signaling message
  const sendCallMessage = useCallback((callMessage: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: callMessage.type, 
        data: callMessage 
      }));
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    connectionId,
    subscribeToChannel,
    unsubscribeFromChannel,
    sendTypingIndicator,
    sendCallMessage,
  };
}
