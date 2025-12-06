import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the chat router for testing
let mockChannels = [
  {
    id: 'channel-1',
    type: 'direct',
    name: null,
    description: null,
    avatarUrl: null,
    isActive: true,
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    members: [
      { userId: 'demo-user', name: 'You', avatar: undefined, role: 'admin' },
      { userId: 'user-2', name: 'John Farmer', avatar: undefined, role: 'member' }
    ],
    isMuted: false,
    pins: [],
  },
  {
    id: 'channel-2',
    type: 'group',
    name: 'Farm Team',
    description: 'General farm discussions',
    avatarUrl: null,
    isActive: true,
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    members: [
      { userId: 'demo-user', name: 'You', avatar: undefined, role: 'admin' },
      { userId: 'user-3', name: 'Sarah Manager', avatar: undefined, role: 'member' },
      { userId: 'user-4', name: 'Mike Worker', avatar: undefined, role: 'member' }
    ],
    isMuted: false,
    pins: ['message-1'],
  }
];

let mockMessages = [
  {
    id: 'message-1',
    userId: 'user-2',
    userName: 'John Farmer',
    userAvatar: 'john@farm.com',
    body: 'Hey, how are the cows doing today?',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    reads: [{ userId: 'demo-user', readAt: new Date(Date.now() - 3000000).toISOString() }],
    pins: [{ messageId: 'message-1', pinnedAt: new Date(Date.now() - 1800000).toISOString() }],
  },
  {
    id: 'message-2',
    userId: 'demo-user',
    userName: 'You',
    userAvatar: 'demo@farm.com',
    body: 'They\'re doing great! Just finished the morning milking.',
    createdAt: new Date(Date.now() - 3000000).toISOString(),
    reads: [],
    pins: [],
  },
  {
    id: 'message-3',
    userId: 'user-3',
    userName: 'Sarah Manager',
    userAvatar: 'sarah@farm.com',
    body: 'Good to hear! Don\'t forget about the pasture inspection this afternoon.',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    reads: [],
    pins: [],
  }
];

let mockUsers = [
  {
    id: 'user-2',
    name: 'John Farmer',
    email: 'john@farm.com',
    role: 'worker',
  },
  {
    id: 'user-3',
    name: 'Sarah Manager',
    email: 'sarah@farm.com',
    role: 'manager',
  },
  {
    id: 'user-4',
    name: 'Mike Worker',
    email: 'mike@farm.com',
    role: 'worker',
  },
  {
    id: 'user-5',
    name: 'Tom Specialist',
    email: 'tom@farm.com',
    role: 'worker',
  }
];

const mockChatRouter = express.Router();

// GET /chat/channels
mockChatRouter.get('/channels', (req, res) => {
  res.json(mockChannels);
});

// GET /chat/channels/:id/messages
mockChatRouter.get('/channels/:id/messages', (req, res) => {
  const channelId = req.params.id;
  const channelMessages = mockMessages.filter(msg => 
    mockChannels.find(ch => ch.id === channelId)?.members.some(m => m.userId === 'demo-user')
  );
  res.json(channelMessages);
});

// POST /chat/messages
mockChatRouter.post('/messages', (req, res) => {
  const { channelId, body } = req.body;
  
  if (!channelId || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const channel = mockChannels.find(ch => ch.id === channelId);
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  
  const newMessage = {
    id: `message-${mockMessages.length + 1}`,
    userId: 'demo-user',
    userName: 'You',
    userAvatar: 'demo@farm.com',
    body,
    createdAt: new Date().toISOString(),
    reads: [],
    pins: [],
  };
  
  mockMessages.push(newMessage);
  
  // Update channel's last message timestamp
  const channelIndex = mockChannels.findIndex(ch => ch.id === channelId);
  if (channelIndex !== -1) {
    mockChannels[channelIndex].lastMessageAt = new Date().toISOString();
  }
  
  res.status(201).json(newMessage);
});

// POST /chat/channels/:id/messages/:messageId/read
mockChatRouter.post('/channels/:id/messages/:messageId/read', (req, res) => {
  const { id: channelId, messageId } = req.params;
  
  const message = mockMessages.find(msg => msg.id === messageId);
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  const existingRead = message.reads.find(r => r.userId === 'demo-user');
  if (!existingRead) {
    message.reads.push({
      userId: 'demo-user',
      readAt: new Date().toISOString(),
    });
  }
  
  res.json({ message: 'Message marked as read' });
});

// POST /chat/channels/:id/messages/:messageId/pin
mockChatRouter.post('/channels/:id/messages/:messageId/pin', (req, res) => {
  const { id: channelId, messageId } = req.params;
  
  const message = mockMessages.find(msg => msg.id === messageId);
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  const existingPin = message.pins.find(p => p.messageId === messageId);
  if (!existingPin) {
    message.pins.push({
      messageId,
      pinnedAt: new Date().toISOString(),
    });
  }
  
  res.json({ message: 'Message pinned' });
});

// POST /chat/channels/:id/messages/:messageId/unpin
mockChatRouter.post('/channels/:id/messages/:messageId/unpin', (req, res) => {
  const { id: channelId, messageId } = req.params;
  
  const message = mockMessages.find(msg => msg.id === messageId);
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  message.pins = message.pins.filter(p => p.messageId !== messageId);
  
  res.json({ message: 'Message unpinned' });
});

// POST /chat/channels/:id/mute
mockChatRouter.post('/channels/:id/mute', (req, res) => {
  const channelId = req.params.id;
  
  const channel = mockChannels.find(ch => ch.id === channelId);
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  
  channel.isMuted = true;
  
  res.json({ message: 'Channel muted' });
});

// POST /chat/channels/:id/unmute
mockChatRouter.post('/channels/:id/unmute', (req, res) => {
  const channelId = req.params.id;
  
  const channel = mockChannels.find(ch => ch.id === channelId);
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  
  channel.isMuted = false;
  
  res.json({ message: 'Channel unmuted' });
});

// POST /chat/channels/create
mockChatRouter.post('/channels/create', (req, res) => {
  const { name, type, description, userIds } = req.body;
  
  if (!type || !userIds || userIds.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (type === 'direct' && userIds.length !== 1) {
    return res.status(400).json({ error: 'Direct messages must have exactly 1 other user' });
  }
  
  if (type === 'group' && !name) {
    return res.status(400).json({ error: 'Group messages must have a name' });
  }
  
  const newChannel = {
    id: `channel-${mockChannels.length + 1}`,
    type,
    name: type === 'group' ? name : null,
    description,
    avatarUrl: null,
    isActive: true,
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    members: [
      { userId: 'demo-user', name: 'You', avatar: undefined, role: 'admin' },
      ...userIds.map((uid: string) => {
        const user = mockUsers.find(u => u.id === uid);
        return { userId: uid, name: user?.name || 'Unknown', avatar: undefined, role: 'member' };
      })
    ],
    isMuted: false,
    pins: [],
  };
  
  mockChannels.push(newChannel);
  
  res.status(201).json({
    id: newChannel.id,
    name: newChannel.name,
    type: newChannel.type,
    description: newChannel.description,
    createdAt: newChannel.createdAt,
  });
});

// POST /chat/channels/:id/add-user
mockChatRouter.post('/channels/:id/add-user', (req, res) => {
  const { userId } = req.body;
  const channelId = req.params.id;
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }
  
  const channel = mockChannels.find(ch => ch.id === channelId);
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  
  if (channel.type !== 'group') {
    return res.status(400).json({ error: 'Can only add users to group channels' });
  }
  
  if (channel.members.some(m => m.userId === userId)) {
    return res.status(409).json({ error: 'User is already a member' });
  }
  
  const user = mockUsers.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  channel.members.push({
    userId,
    name: user.name,
    avatar: undefined,
    role: 'member',
  });
  
  res.json({ message: 'User added to channel' });
});

// GET /chat/users/search
mockChatRouter.get('/users/search', (req, res) => {
  const { query } = req.query;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter required' });
  }
  
  const searchResults = mockUsers.filter(user =>
    user.name.toLowerCase().includes(query.toLowerCase()) ||
    user.email.toLowerCase().includes(query.toLowerCase())
  );
  
  res.json(searchResults);
});

const app = express();
app.use(express.json());
app.use('/api/chat', mockChatRouter);

describe('Chat Routes', () => {
  beforeEach(async () => {
    // Reset mock data before each test
    mockChannels = [
      {
        id: 'channel-1',
        type: 'direct',
        name: null,
        description: null,
        avatarUrl: null,
        isActive: true,
        lastMessageAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        members: [
          { userId: 'demo-user', name: 'You', avatar: undefined, role: 'admin' },
          { userId: 'user-2', name: 'John Farmer', avatar: undefined, role: 'member' }
        ],
        isMuted: false,
        pins: [],
      },
      {
        id: 'channel-2',
        type: 'group',
        name: 'Farm Team',
        description: 'General farm discussions',
        avatarUrl: null,
        isActive: true,
        lastMessageAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        members: [
          { userId: 'demo-user', name: 'You', avatar: undefined, role: 'admin' },
          { userId: 'user-3', name: 'Sarah Manager', avatar: undefined, role: 'member' },
          { userId: 'user-4', name: 'Mike Worker', avatar: undefined, role: 'member' }
        ],
        isMuted: false,
        pins: ['message-1'],
      }
    ];

    mockMessages = [
      {
        id: 'message-1',
        userId: 'user-2',
        userName: 'John Farmer',
        userAvatar: 'john@farm.com',
        body: 'Hey, how are the cows doing today?',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        reads: [{ userId: 'demo-user', readAt: new Date(Date.now() - 3000000).toISOString() }],
        pins: [{ messageId: 'message-1', pinnedAt: new Date(Date.now() - 1800000).toISOString() }],
      },
      {
        id: 'message-2',
        userId: 'demo-user',
        userName: 'You',
        userAvatar: 'demo@farm.com',
        body: 'They\'re doing great! Just finished the morning milking.',
        createdAt: new Date(Date.now() - 3000000).toISOString(),
        reads: [],
        pins: [],
      },
      {
        id: 'message-3',
        userId: 'user-3',
        userName: 'Sarah Manager',
        userAvatar: 'sarah@farm.com',
        body: 'Good to hear! Don\'t forget about the pasture inspection this afternoon.',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        reads: [],
        pins: [],
      }
    ];

    mockUsers = [
      {
        id: 'user-2',
        name: 'John Farmer',
        email: 'john@farm.com',
        role: 'worker',
      },
      {
        id: 'user-3',
        name: 'Sarah Manager',
        email: 'sarah@farm.com',
        role: 'manager',
      },
      {
        id: 'user-4',
        name: 'Mike Worker',
        email: 'mike@farm.com',
        role: 'worker',
      },
      {
        id: 'user-5',
        name: 'Tom Specialist',
        email: 'tom@farm.com',
        role: 'worker',
      }
    ];
    vi.clearAllMocks();
  });

  describe('GET /api/chat/channels', () => {
    it('should return user\'s chat channels', async () => {
      const response = await request(app)
        .get('/api/chat/channels')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        id: 'channel-1',
        type: 'direct',
        isMuted: false,
      });
      expect(response.body[0].members).toHaveLength(2);
      expect(response.body[1]).toMatchObject({
        id: 'channel-2',
        type: 'group',
        name: 'Farm Team',
        isMuted: false,
      });
    });
  });

  describe('GET /api/chat/channels/:id/messages', () => {
    it('should return messages for a channel', async () => {
      const response = await request(app)
        .get('/api/chat/channels/channel-1/messages')
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body[0]).toMatchObject({
        id: 'message-1',
        userId: 'user-2',
        userName: 'John Farmer',
        body: 'Hey, how are the cows doing today?',
      });
      expect(response.body[0].reads).toHaveLength(1);
      expect(response.body[0].pins).toHaveLength(1);
    });
  });

  describe('POST /api/chat/messages', () => {
    it('should send a new message', async () => {
      const newMessage = {
        channelId: 'channel-1',
        body: 'Test message from unit test',
      };

      const response = await request(app)
        .post('/api/chat/messages')
        .send(newMessage)
        .expect(201);

      expect(response.body).toMatchObject({
        userId: 'demo-user',
        userName: 'You',
        body: 'Test message from unit test',
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body.reads).toHaveLength(0);
    });

    it('should validate required fields', async () => {
      const incompleteMessage = {
        body: 'Missing channelId',
      };

      const response = await request(app)
        .post('/api/chat/messages')
        .send(incompleteMessage)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/chat/channels/:id/messages/:messageId/read', () => {
    it('should mark message as read', async () => {
      const response = await request(app)
        .post('/api/chat/channels/channel-1/messages/message-2/read')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Message marked as read',
      });

      // Verify message was marked as read
      const message = mockMessages.find(m => m.id === 'message-2');
      expect(message?.reads).toHaveLength(1);
      expect(message?.reads[0].userId).toBe('demo-user');
    });

    it('should return 404 for non-existent message', async () => {
      const response = await request(app)
        .post('/api/chat/channels/channel-1/messages/non-existent/read')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/chat/channels/:id/messages/:messageId/pin', () => {
    it('should pin a message', async () => {
      const response = await request(app)
        .post('/api/chat/channels/channel-1/messages/message-2/pin')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Message pinned',
      });

      // Verify message was pinned
      const message = mockMessages.find(m => m.id === 'message-2');
      expect(message?.pins).toHaveLength(1);
    });

    it('should return 404 for non-existent message', async () => {
      const response = await request(app)
        .post('/api/chat/channels/channel-1/messages/non-existent/pin')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/chat/channels/:id/messages/:messageId/unpin', () => {
    it('should unpin a message', async () => {
      const response = await request(app)
        .post('/api/chat/channels/channel-1/messages/message-1/unpin')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Message unpinned',
      });

      // Verify message was unpinned
      const message = mockMessages.find(m => m.id === 'message-1');
      expect(message?.pins).toHaveLength(0);
    });
  });

  describe('POST /api/chat/channels/:id/mute', () => {
    it('should mute a channel', async () => {
      const response = await request(app)
        .post('/api/chat/channels/channel-1/mute')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Channel muted',
      });

      // Verify channel was muted
      const channel = mockChannels.find(c => c.id === 'channel-1');
      expect(channel?.isMuted).toBe(true);
    });
  });

  describe('POST /api/chat/channels/:id/unmute', () => {
    it('should unmute a channel', async () => {
      // First mute the channel
      await request(app)
        .post('/api/chat/channels/channel-1/mute')
        .expect(200);

      // Then unmute it
      const response = await request(app)
        .post('/api/chat/channels/channel-1/unmute')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Channel unmuted',
      });

      // Verify channel was unmuted
      const channel = mockChannels.find(c => c.id === 'channel-1');
      expect(channel?.isMuted).toBe(false);
    });
  });

  describe('POST /api/chat/channels/create', () => {
    it('should create a direct message channel', async () => {
      const newChannel = {
        type: 'direct',
        userIds: ['user-2'],
      };

      const response = await request(app)
        .post('/api/chat/channels/create')
        .send(newChannel)
        .expect(201);

      expect(response.body).toMatchObject({
        type: 'direct',
        name: null,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should create a group channel', async () => {
      const newChannel = {
        type: 'group',
        name: 'Test Group',
        description: 'A test group channel',
        userIds: ['user-3', 'user-4'],
      };

      const response = await request(app)
        .post('/api/chat/channels/create')
        .send(newChannel)
        .expect(201);

      expect(response.body).toMatchObject({
        type: 'group',
        name: 'Test Group',
        description: 'A test group channel',
      });
      expect(response.body).toHaveProperty('id');
    });

    it('should validate direct message requirements', async () => {
      const invalidChannel = {
        type: 'direct',
        name: 'Should not have name',
        userIds: ['user-2', 'user-3'], // Too many users
      };

      const response = await request(app)
        .post('/api/chat/channels/create')
        .send(invalidChannel)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate group message requirements', async () => {
      const invalidChannel = {
        type: 'group',
        // Missing name
        userIds: ['user-3'],
      };

      const response = await request(app)
        .post('/api/chat/channels/create')
        .send(invalidChannel)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/chat/channels/:id/add-user', () => {
    it('should add user to group channel', async () => {
      const response = await request(app)
        .post('/api/chat/channels/channel-2/add-user')
        .send({ userId: 'user-5' })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'User added to channel',
      });

      // Verify user was added
      const channel = mockChannels.find(c => c.id === 'channel-2');
      expect(channel?.members).toHaveLength(4);
      expect(channel?.members.some(m => m.userId === 'user-5')).toBe(true);
    });

    it('should prevent adding users to direct channels', async () => {
      const response = await request(app)
        .post('/api/chat/channels/channel-1/add-user')
        .send({ userId: 'user-5' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Can only add users to group channels');
    });

    it('should prevent adding existing members', async () => {
      const response = await request(app)
        .post('/api/chat/channels/channel-2/add-user')
        .send({ userId: 'user-3' }) // Already a member
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('User is already a member');
    });
  });

  describe('GET /api/chat/users/search', () => {
    it('should search users by name', async () => {
      const response = await request(app)
        .get('/api/chat/users/search?query=John')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: 'user-2',
        name: 'John Farmer',
        email: 'john@farm.com',
      });
    });

    it('should search users by email', async () => {
      const response = await request(app)
        .get('/api/chat/users/search?query=mike@farm.com')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: 'user-4',
        name: 'Mike Worker',
      });
    });

    it('should return multiple results for partial matches', async () => {
      const response = await request(app)
        .get('/api/chat/users/search?query=Man')
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.some((u: any) => u.name.includes('Manager'))).toBe(true);
    });

    it('should validate query parameter', async () => {
      const response = await request(app)
        .get('/api/chat/users/search')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
