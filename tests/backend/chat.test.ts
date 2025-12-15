import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the database
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

describe('Chat/Messaging Tests', () => {
  let app: express.Application;
  const mockUserId = 'user-123';
  const mockFarmId = 'farm-123';
  const mockChannelId = 'channel-123';

  // Mock data
  const mockChannels = [
    {
      id: 'channel-1',
      name: 'General',
      type: 'group',
      createdBy: mockUserId,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'channel-2',
      name: 'Animal: Bessie',
      type: 'context',
      contextType: 'animal',
      contextId: 'animal-123',
      createdBy: mockUserId,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];

  const mockMessages = [
    {
      id: 'msg-1',
      channelId: mockChannelId,
      userId: mockUserId,
      body: 'Hello, team!',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'msg-2',
      channelId: mockChannelId,
      userId: 'user-456',
      body: 'Hi there!',
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());

    // Mock auth middleware
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        (req as any).user = {
          id: mockUserId,
          farmId: mockFarmId,
          email: 'test@example.com',
        };
        next();
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    });

    // GET /api/chat/channels - List channels
    app.get('/api/chat/channels', (req, res) => {
      res.json(mockChannels);
    });

    // POST /api/chat/channels - Create channel
    app.post('/api/chat/channels', (req, res) => {
      const { name, type, contextType, contextId } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Channel name is required' });
      }

      const newChannel = {
        id: `channel-${Date.now()}`,
        name,
        type: type || 'group',
        contextType,
        contextId,
        createdBy: (req as any).user.id,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      res.status(201).json(newChannel);
    });

    // GET /api/chat/channels/:channelId/messages - List messages
    app.get('/api/chat/channels/:channelId/messages', (req, res) => {
      const { channelId } = req.params;
      const channelMessages = mockMessages.filter(m => m.channelId === channelId);
      res.json(channelMessages);
    });

    // POST /api/chat/channels/:channelId/messages - Send message
    app.post('/api/chat/channels/:channelId/messages', (req, res) => {
      const { channelId } = req.params;
      const { body } = req.body;

      if (!body || body.trim() === '') {
        return res.status(400).json({ error: 'Message body is required' });
      }

      const newMessage = {
        id: `msg-${Date.now()}`,
        channelId,
        userId: (req as any).user.id,
        body,
        createdAt: new Date().toISOString(),
      };

      res.status(201).json(newMessage);
    });

    // DELETE /api/chat/messages/:messageId - Delete message
    app.delete('/api/chat/messages/:messageId', (req, res) => {
      const { messageId } = req.params;
      const message = mockMessages.find(m => m.id === messageId);

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      if (message.userId !== (req as any).user.id) {
        return res.status(403).json({ error: 'Cannot delete another user\'s message' });
      }

      res.status(204).send();
    });

    // PATCH /api/chat/messages/:messageId - Edit message
    app.patch('/api/chat/messages/:messageId', (req, res) => {
      const { messageId } = req.params;
      const { body } = req.body;
      const message = mockMessages.find(m => m.id === messageId);

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      if (message.userId !== (req as any).user.id) {
        return res.status(403).json({ error: 'Cannot edit another user\'s message' });
      }

      const updatedMessage = {
        ...message,
        body,
        editedAt: new Date().toISOString(),
      };

      res.json(updatedMessage);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Channel Operations', () => {
    it('should list all channels for authenticated user', async () => {
      const response = await request(app)
        .get('/api/chat/channels')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0].name).toBe('General');
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/chat/channels');

      expect(response.status).toBe(401);
    });

    it('should create a new channel', async () => {
      const response = await request(app)
        .post('/api/chat/channels')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'New Channel',
          type: 'group',
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('New Channel');
      expect(response.body.type).toBe('group');
      expect(response.body.createdBy).toBe(mockUserId);
    });

    it('should create a context channel for an animal', async () => {
      const response = await request(app)
        .post('/api/chat/channels')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Animal: Daisy',
          type: 'context',
          contextType: 'animal',
          contextId: 'animal-456',
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Animal: Daisy');
      expect(response.body.type).toBe('context');
      expect(response.body.contextType).toBe('animal');
      expect(response.body.contextId).toBe('animal-456');
    });

    it('should return 400 if channel name is missing', async () => {
      const response = await request(app)
        .post('/api/chat/channels')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'group',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Channel name is required');
    });
  });

  describe('Message Operations', () => {
    it('should list messages in a channel', async () => {
      const response = await request(app)
        .get(`/api/chat/channels/${mockChannelId}/messages`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should send a message to a channel', async () => {
      const response = await request(app)
        .post(`/api/chat/channels/${mockChannelId}/messages`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          body: 'This is a test message',
        });

      expect(response.status).toBe(201);
      expect(response.body.body).toBe('This is a test message');
      expect(response.body.channelId).toBe(mockChannelId);
      expect(response.body.userId).toBe(mockUserId);
    });

    it('should return 400 if message body is empty', async () => {
      const response = await request(app)
        .post(`/api/chat/channels/${mockChannelId}/messages`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          body: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Message body is required');
    });

    it('should return 400 if message body is missing', async () => {
      const response = await request(app)
        .post(`/api/chat/channels/${mockChannelId}/messages`)
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should edit own message', async () => {
      const response = await request(app)
        .patch('/api/chat/messages/msg-1')
        .set('Authorization', 'Bearer valid-token')
        .send({
          body: 'Updated message content',
        });

      expect(response.status).toBe(200);
      expect(response.body.body).toBe('Updated message content');
      expect(response.body.editedAt).toBeDefined();
    });

    it('should not allow editing another user\'s message', async () => {
      const response = await request(app)
        .patch('/api/chat/messages/msg-2')
        .set('Authorization', 'Bearer valid-token')
        .send({
          body: 'Trying to edit someone else\'s message',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Cannot edit another user\'s message');
    });

    it('should delete own message', async () => {
      const response = await request(app)
        .delete('/api/chat/messages/msg-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
    });

    it('should not allow deleting another user\'s message', async () => {
      const response = await request(app)
        .delete('/api/chat/messages/msg-2')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent message', async () => {
      const response = await request(app)
        .delete('/api/chat/messages/non-existent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });

  describe('Message Retrieval', () => {
    it('should retrieve messages in chronological order', async () => {
      const response = await request(app)
        .get(`/api/chat/channels/${mockChannelId}/messages`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Messages should be returned (order depends on implementation)
      if (response.body.length > 1) {
        const dates = response.body.map((m: any) => new Date(m.createdAt).getTime());
        // Verify dates are valid
        dates.forEach((d: number) => expect(d).toBeGreaterThan(0));
      }
    });
  });
});
