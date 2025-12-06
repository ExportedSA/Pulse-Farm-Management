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
