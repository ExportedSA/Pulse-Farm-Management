import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { 
  chatChannels, 
  chatChannelMembers, 
  chatMessages, 
  chatMessageReads, 
  chatMessagePins,
  users 
} from '@shared/schema';
import { eq, and, desc, like, or, sql, ne, isNull } from 'drizzle-orm';
import { chatWebSocket } from '../websocket';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'chat');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv|zip/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname || mimetype) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  }
});

const router = Router();

// Validation schemas
const createChannelSchema = z.object({
  name: z.string().optional(),
  type: z.enum(['direct', 'group']).default('direct'),
  description: z.string().optional(),
  userIds: z.array(z.string()).min(1),
});

const sendMessageSchema = z.object({
  channelId: z.string().uuid(),
  body: z.string().min(1),
  mentions: z.array(z.string()).optional(), // Array of user IDs mentioned
});

const editMessageSchema = z.object({
  body: z.string().min(1),
});

const addUserSchema = z.object({
  userId: z.string().uuid(),
});

const searchUsersSchema = z.object({
  query: z.string().min(1),
});

// Helper function to extract @mentions from message body
function extractMentions(body: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(body)) !== null) {
    mentions.push(match[2]); // Extract user ID from @[name](userId)
  }
  return mentions;
}

// GET /api/chat/channels - Get user's chat channels
router.get('/channels', async (req, res) => {
  try {
    const userId = 'demo-user'; // Simplified auth for now
    
    // Get channels where user is a member
    const userChannels = await db
      .select({
        channel: chatChannels,
        member: chatChannelMembers,
      })
      .from(chatChannelMembers)
      .leftJoin(chatChannels, eq(chatChannelMembers.channelId, chatChannels.id))
      .where(eq(chatChannelMembers.userId, userId));

    // Get member details for each channel
    const channelsWithMembers = await Promise.all(
      userChannels.map(async ({ channel, member }: { channel: any; member: any }) => {
        if (!channel) return null;

        const members = await db
          .select({
            userId: chatChannelMembers.userId,
            name: users.name,
            email: users.email,
            role: chatChannelMembers.role,
            joinedAt: chatChannelMembers.joinedAt,
          })
          .from(chatChannelMembers)
          .leftJoin(users, eq(chatChannelMembers.userId, users.id))
          .where(eq(chatChannelMembers.channelId, channel.id));

        const pins = await db
          .select({
            messageId: chatMessagePins.messageId,
          })
          .from(chatMessagePins)
          .where(eq(chatMessagePins.channelId, channel.id));

        return {
          id: channel.id,
          type: channel.type,
          name: channel.name,
          description: channel.description,
          avatarUrl: channel.avatarUrl,
          isActive: channel.isActive,
          lastMessageAt: channel.lastMessageAt,
          createdAt: channel.createdAt,
          updatedAt: channel.updatedAt,
          members: members.map((m: any) => ({
            userId: m.userId,
            name: m.name,
            avatar: undefined, // Could add avatar field to users table later
            role: m.role,
          })),
          isMuted: member?.isMuted || false,
          pins: pins.map((p: any) => p.messageId),
        };
      })
    );

    const validChannels = channelsWithMembers.filter(Boolean);
    res.json(validChannels);
  } catch (error) {
    console.error('Error fetching channels:', error);
    // Return mock data for demo purposes when database is unavailable
    const mockChannels = [
      {
        id: 'demo-channel-1',
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
          { userId: 'user-2', name: 'John Farmer', avatar: undefined, role: 'member' },
          { userId: 'user-3', name: 'Sarah Manager', avatar: undefined, role: 'member' }
        ],
        isMuted: false,
        pins: [],
      },
      {
        id: 'demo-channel-2',
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
          { userId: 'user-4', name: 'Mike Worker', avatar: undefined, role: 'member' }
        ],
        isMuted: false,
        pins: [],
      }
    ];
    res.json(mockChannels);
  }
});

// GET /api/chat/channels/:id/messages - Get messages for a channel
router.get('/channels/:id/messages', async (req, res) => {
  try {
    const channelId = req.params.id;
    const userId = 'demo-user'; // Simplified auth

    // Verify user is a member of the channel
    const membership = await db
      .select()
      .from(chatChannelMembers)
      .where(
        and(
          eq(chatChannelMembers.channelId, channelId),
          eq(chatChannelMembers.userId, userId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await db
      .select({
        id: chatMessages.id,
        userId: chatMessages.userId,
        userName: users.name,
        userAvatar: users.email, // Using email as placeholder for avatar
        body: chatMessages.body,
        messageType: chatMessages.messageType,
        replyToId: chatMessages.replyToId,
        attachments: chatMessages.attachments,
        isEdited: chatMessages.isEdited,
        editedAt: chatMessages.editedAt,
        createdAt: chatMessages.createdAt,
        reads: chatMessageReads.readAt,
        pins: chatMessagePins.pinnedAt,
      })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.userId, users.id))
      .leftJoin(chatMessageReads, 
        and(
          eq(chatMessageReads.messageId, chatMessages.id),
          eq(chatMessageReads.userId, userId)
        )
      )
      .leftJoin(chatMessagePins, eq(chatMessagePins.messageId, chatMessages.id))
      .where(eq(chatMessages.channelId, channelId))
      .orderBy(desc(chatMessages.createdAt));

    const formattedMessages = messages.map((msg: any) => ({
      id: msg.id,
      userId: msg.userId,
      userName: msg.userName,
      userAvatar: msg.userAvatar,
      body: msg.body,
      createdAt: msg.createdAt,
      reads: msg.reads ? [{ userId, readAt: msg.reads }] : [],
      pins: msg.pins ? [{ messageId: msg.id, pinnedAt: msg.pins }] : [],
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    // Return mock messages for demo purposes
    const mockMessages = [
      {
        id: 'msg-1',
        userId: 'user-2',
        userName: 'John Farmer',
        userAvatar: 'john@farm.com',
        body: 'Hey team, how are the animals doing today?',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        reads: [{ userId: 'demo-user', readAt: new Date(Date.now() - 3000000).toISOString() }],
        pins: [],
      },
      {
        id: 'msg-2',
        userId: 'demo-user',
        userName: 'You',
        userAvatar: 'demo@farm.com',
        body: 'All good! Just finished the morning feed.',
        createdAt: new Date(Date.now() - 3000000).toISOString(),
        reads: [],
        pins: [],
      },
      {
        id: 'msg-3',
        userId: 'user-3',
        userName: 'Sarah Manager',
        userAvatar: 'sarah@farm.com',
        body: 'Great! I\'ll check on the pasture rotation this afternoon.',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        reads: [],
        pins: [],
      }
    ];
    res.json(mockMessages);
  }
});

// POST /api/chat/messages - Send a message
router.post('/messages', async (req, res) => {
  try {
    const { channelId, body, mentions } = sendMessageSchema.parse(req.body);
    const userId = 'demo-user'; // Simplified auth

    // Verify user is a member of the channel
    const membershipResult = await db
      .select()
      .from(chatChannelMembers)
      .where(
        and(
          eq(chatChannelMembers.channelId, channelId),
          eq(chatChannelMembers.userId, userId)
        )
      )
      .limit(1);

    if (!Array.isArray(membershipResult) || membershipResult.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create the message
    const insertResult = await db
      .insert(chatMessages)
      .values({
        channelId,
        userId,
        body,
        messageType: 'text',
      })
      .returning();

    const newMessage = Array.isArray(insertResult) ? insertResult[0] : insertResult;

    // Update channel's last message timestamp
    await db
      .update(chatChannels)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(chatChannels.id, channelId));

    // Get user info for response
    const userInfoResult = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const userInfo = Array.isArray(userInfoResult) ? userInfoResult[0] : null;

    const response = {
      id: newMessage.id,
      userId: newMessage.userId,
      userName: userInfo?.name || 'You',
      userAvatar: userInfo?.email,
      body: newMessage.body,
      createdAt: newMessage.createdAt,
      reads: [],
      pins: [],
    };

    // Broadcast new message via WebSocket
    chatWebSocket.broadcastNewMessage(channelId, response);

    // Handle @mentions - notify mentioned users
    const mentionedUserIds = mentions || extractMentions(body);
    if (mentionedUserIds.length > 0) {
      // Get channel name for notification
      const channelResult = await db
        .select({ name: chatChannels.name })
        .from(chatChannels)
        .where(eq(chatChannels.id, channelId))
        .limit(1);
      
      const channelName = Array.isArray(channelResult) && channelResult[0]?.name 
        ? channelResult[0].name 
        : 'a chat';

      mentionedUserIds.forEach(mentionedUserId => {
        chatWebSocket.notifyUser(mentionedUserId, {
          type: 'mention',
          channelId,
          channelName,
          messageId: newMessage.id,
          fromUserId: userId,
          fromUserName: userInfo?.name || 'Someone',
          preview: body.substring(0, 100),
        });
      });
    }

    // Update unread counts for other channel members
    const otherMembersResult = await db
      .select({ userId: chatChannelMembers.userId })
      .from(chatChannelMembers)
      .where(
        and(
          eq(chatChannelMembers.channelId, channelId),
          ne(chatChannelMembers.userId, userId)
        )
      );

    if (Array.isArray(otherMembersResult)) {
      otherMembersResult.forEach(member => {
        // In a real app, you'd calculate actual unread count from DB
        // For now, just notify that there's a new message
        chatWebSocket.broadcastUnreadCount(member.userId, channelId, 1);
      });
    }

    res.status(201).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/chat/channels/:id/messages/:messageId/read - Mark message as read
router.post('/channels/:id/messages/:messageId/read', async (req, res) => {
  try {
    const { id: channelId, messageId } = req.params;
    const userId = 'demo-user'; // Simplified auth

    // Verify user is a member of the channel
    const membership = await db
      .select()
      .from(chatChannelMembers)
      .where(
        and(
          eq(chatChannelMembers.channelId, channelId),
          eq(chatChannelMembers.userId, userId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify message exists in the channel
    const message = await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.id, messageId),
          eq(chatMessages.channelId, channelId)
        )
      )
      .limit(1);

    if (message.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Create or update read receipt
    await db
      .insert(chatMessageReads)
      .values({
        messageId,
        userId,
        readAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [chatMessageReads.messageId, chatMessageReads.userId],
        set: { readAt: new Date() },
      });

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// POST /api/chat/channels/:id/messages/:messageId/pin - Pin a message
router.post('/channels/:id/messages/:messageId/pin', async (req, res) => {
  try {
    const { id: channelId, messageId } = req.params;
    const userId = 'demo-user'; // Simplified auth

    // Verify user is a member of the channel
    const membership = await db
      .select()
      .from(chatChannelMembers)
      .where(
        and(
          eq(chatChannelMembers.channelId, channelId),
          eq(chatChannelMembers.userId, userId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify message exists in the channel
    const message = await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.id, messageId),
          eq(chatMessages.channelId, channelId)
        )
      )
      .limit(1);

    if (message.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Pin the message
    await db
      .insert(chatMessagePins)
      .values({
        channelId,
        messageId,
        pinnedBy: userId,
        pinnedAt: new Date(),
      })
      .onConflictDoNothing();

    res.json({ message: 'Message pinned' });
  } catch (error) {
    console.error('Error pinning message:', error);
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

// POST /api/chat/channels/:id/messages/:messageId/unpin - Unpin a message
router.post('/channels/:id/messages/:messageId/unpin', async (req, res) => {
  try {
    const { id: channelId, messageId } = req.params;
    const userId = 'demo-user'; // Simplified auth

    // Verify user is a member of the channel
    const membership = await db
      .select()
      .from(chatChannelMembers)
      .where(
        and(
          eq(chatChannelMembers.channelId, channelId),
          eq(chatChannelMembers.userId, userId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Unpin the message
    await db
      .delete(chatMessagePins)
      .where(
        and(
          eq(chatMessagePins.channelId, channelId),
          eq(chatMessagePins.messageId, messageId)
        )
      );

    res.json({ message: 'Message unpinned' });
  } catch (error) {
    console.error('Error unpinning message:', error);
    res.status(500).json({ error: 'Failed to unpin message' });
  }
});

// POST /api/chat/channels/:id/mute - Mute a channel
router.post('/channels/:id/mute', async (req, res) => {
  try {
    const channelId = req.params.id;
    const userId = 'demo-user'; // Simplified auth

    await db
      .update(chatChannelMembers)
      .set({ isMuted: true })
      .where(
        and(
          eq(chatChannelMembers.channelId, channelId),
          eq(chatChannelMembers.userId, userId)
        )
      );

    res.json({ message: 'Channel muted' });
  } catch (error) {
    console.error('Error muting channel:', error);
    res.status(500).json({ error: 'Failed to mute channel' });
  }
});

// POST /api/chat/channels/:id/unmute - Unmute a channel
router.post('/channels/:id/unmute', async (req, res) => {
  try {
    const channelId = req.params.id;
    const userId = 'demo-user'; // Simplified auth

    await db
      .update(chatChannelMembers)
      .set({ isMuted: false })
      .where(
        and(
          eq(chatChannelMembers.channelId, channelId),
          eq(chatChannelMembers.userId, userId)
        )
      );

    res.json({ message: 'Channel unmuted' });
  } catch (error) {
    console.error('Error unmuting channel:', error);
    res.status(500).json({ error: 'Failed to unmute channel' });
  }
});

// POST /api/chat/channels/create - Create a new chat
router.post('/channels/create', async (req, res) => {
  try {
    const { name, type, description, userIds } = createChannelSchema.parse(req.body);
    const creatorId = 'demo-user'; // Simplified auth

    // For direct messages, ensure exactly 2 users and no name
    if (type === 'direct') {
      if (userIds.length !== 1) {
        return res.status(400).json({ error: 'Direct messages must have exactly 1 other user' });
      }
      if (name) {
        return res.status(400).json({ error: 'Direct messages cannot have names' });
      }
    }

    // For group messages, ensure at least 2 users and has a name
    if (type === 'group') {
      if (userIds.length < 1) {
        return res.status(400).json({ error: 'Group messages must have at least 1 other user' });
      }
      if (!name) {
        return res.status(400).json({ error: 'Group messages must have a name' });
      }
    }

    // Check if direct message already exists between these users
    if (type === 'direct') {
      const existingChannel = await db
        .select({ channelId: chatChannelMembers.channelId })
        .from(chatChannelMembers)
        .where(
          and(
            eq(chatChannelMembers.userId, creatorId),
            eq(chatChannelMembers.channelId, 
              db.select({ id: chatChannelMembers.channelId })
                .from(chatChannelMembers)
                .where(eq(chatChannelMembers.userId, userIds[0]))
            )
          )
        )
        .limit(1);

      if (existingChannel.length > 0) {
        return res.status(409).json({ error: 'Direct message already exists' });
      }
    }

    // Create the channel
    const [newChannel] = await db
      .insert(chatChannels)
      .values({
        name: type === 'group' ? name : null,
        type,
        description,
        createdBy: creatorId,
      })
      .returning();

    // Add creator as member
    await db
      .insert(chatChannelMembers)
      .values({
        channelId: newChannel.id,
        userId: creatorId,
        role: 'admin',
      });

    // Add other users as members
    for (const userId of userIds) {
      await db
        .insert(chatChannelMembers)
        .values({
          channelId: newChannel.id,
          userId,
          role: 'member',
        });
    }

    res.status(201).json({
      id: newChannel.id,
      name: newChannel.name,
      type: newChannel.type,
      description: newChannel.description,
      createdAt: newChannel.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error creating channel:', error);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// POST /api/chat/channels/:id/add-user - Add user to channel
router.post('/channels/:id/add-user', async (req, res) => {
  try {
    const { userId } = addUserSchema.parse(req.body);
    const channelId = req.params.id;
    const currentUserId = 'demo-user'; // Simplified auth

    // Verify current user is a member of the channel
    const membership = await db
      .select()
      .from(chatChannelMembers)
      .where(
        and(
          eq(chatChannelMembers.channelId, channelId),
          eq(chatChannelMembers.userId, currentUserId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify channel is a group (can't add users to direct messages)
    const [channel] = await db
      .select()
      .from(chatChannels)
      .where(eq(chatChannels.id, channelId))
      .limit(1);

    if (!channel || channel.type !== 'group') {
      return res.status(400).json({ error: 'Can only add users to group channels' });
    }

    // Check if user is already a member
    const existingMembership = await db
      .select()
      .from(chatChannelMembers)
      .where(
        and(
          eq(chatChannelMembers.channelId, channelId),
          eq(chatChannelMembers.userId, userId)
        )
      )
      .limit(1);

    if (existingMembership.length > 0) {
      return res.status(409).json({ error: 'User is already a member' });
    }

    // Add user to channel
    await db
      .insert(chatChannelMembers)
      .values({
        channelId,
        userId,
        role: 'member',
      });

    res.json({ message: 'User added to channel' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error adding user to channel:', error);
    res.status(500).json({ error: 'Failed to add user to channel' });
  }
});

// GET /api/chat/users/search - Search users
router.get('/users/search', async (req, res) => {
  try {
    const { query } = searchUsersSchema.parse(req.query);

    const searchResults = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          or(
            like(users.name, `%${query}%`),
            like(users.email, `%${query}%`)
          )
        )
      )
      .limit(20);

    res.json(searchResults);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameter' });
    }
    console.error('Error searching users:', error);
    // Return mock users for demo purposes when database is not available
    const mockUsers = [
      { id: 'user-1', name: 'John Smith', email: 'john@pulse.farm', role: 'manager' },
      { id: 'user-2', name: 'Sarah Johnson', email: 'sarah@pulse.farm', role: 'staff' },
      { id: 'user-3', name: 'Mike Wilson', email: 'mike@pulse.farm', role: 'staff' },
      { id: 'user-4', name: 'Emily Brown', email: 'emily@pulse.farm', role: 'staff' },
      { id: 'user-5', name: 'David Lee', email: 'david@pulse.farm', role: 'manager' },
    ].filter(user => 
      user.name.toLowerCase().includes(req.query?.query?.toString().toLowerCase() || '') ||
      user.email.toLowerCase().includes(req.query?.query?.toString().toLowerCase() || '')
    ).slice(0, 10);
    
    res.json(mockUsers);
  }
});

// PUT /api/chat/messages/:messageId - Edit a message
router.put('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { body } = editMessageSchema.parse(req.body);
    const userId = 'demo-user'; // Simplified auth

    // Get the message to verify ownership
    const messageResult = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId))
      .limit(1);

    if (!Array.isArray(messageResult) || messageResult.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messageResult[0];

    // Verify user owns the message
    if (message.userId !== userId) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    // Update the message
    const editedAt = new Date();
    await db
      .update(chatMessages)
      .set({ 
        body, 
        isEdited: true, 
        editedAt,
        updatedAt: editedAt 
      })
      .where(eq(chatMessages.id, messageId));

    // Broadcast edit via WebSocket
    chatWebSocket.broadcastMessageEdit(message.channelId, messageId, body, editedAt.toISOString());

    res.json({ 
      message: 'Message updated',
      messageId,
      body,
      isEdited: true,
      editedAt: editedAt.toISOString()
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error editing message:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// DELETE /api/chat/messages/:messageId - Delete a message
router.delete('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = 'demo-user'; // Simplified auth

    // Get the message to verify ownership
    const messageResult = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId))
      .limit(1);

    if (!Array.isArray(messageResult) || messageResult.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messageResult[0];

    // Verify user owns the message (or is admin)
    if (message.userId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    const channelId = message.channelId;

    // Delete the message
    await db
      .delete(chatMessages)
      .where(eq(chatMessages.id, messageId));

    // Broadcast deletion via WebSocket
    chatWebSocket.broadcastMessageDelete(channelId, messageId);

    res.json({ message: 'Message deleted', messageId });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// POST /api/chat/upload - Upload file attachment
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/chat/${req.file.filename}`;
    
    res.json({
      url: fileUrl,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// GET /api/chat/channels/:id/unread - Get unread count for a channel
router.get('/channels/:id/unread', async (req, res) => {
  try {
    const channelId = req.params.id;
    const userId = 'demo-user'; // Simplified auth

    // Get the last read message timestamp for this user in this channel
    const lastReadResult = await db
      .select({ readAt: chatMessageReads.readAt })
      .from(chatMessageReads)
      .innerJoin(chatMessages, eq(chatMessageReads.messageId, chatMessages.id))
      .where(
        and(
          eq(chatMessages.channelId, channelId),
          eq(chatMessageReads.userId, userId)
        )
      )
      .orderBy(desc(chatMessageReads.readAt))
      .limit(1);

    const lastReadAt = Array.isArray(lastReadResult) && lastReadResult[0]?.readAt 
      ? lastReadResult[0].readAt 
      : new Date(0);

    // Count messages after last read that aren't from this user
    const unreadResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.channelId, channelId),
          ne(chatMessages.userId, userId),
          sql`${chatMessages.createdAt} > ${lastReadAt}`
        )
      );

    const unreadCount = Array.isArray(unreadResult) && unreadResult[0]?.count 
      ? Number(unreadResult[0].count) 
      : 0;

    res.json({ channelId, unreadCount });
  } catch (error) {
    console.error('Error getting unread count:', error);
    // Return 0 for demo purposes
    res.json({ channelId: req.params.id, unreadCount: 0 });
  }
});

// GET /api/chat/unread/all - Get unread counts for all channels
router.get('/unread/all', async (req, res) => {
  try {
    const userId = 'demo-user'; // Simplified auth

    // Get all channels the user is a member of
    const channelsResult = await db
      .select({ channelId: chatChannelMembers.channelId })
      .from(chatChannelMembers)
      .where(eq(chatChannelMembers.userId, userId));

    if (!Array.isArray(channelsResult)) {
      return res.json({ channels: {}, totalUnread: 0 });
    }

    const unreadCounts: Record<string, number> = {};
    let totalUnread = 0;

    // For demo, return mock data
    channelsResult.forEach(({ channelId }) => {
      unreadCounts[channelId] = 0;
    });

    res.json({ channels: unreadCounts, totalUnread });
  } catch (error) {
    console.error('Error getting all unread counts:', error);
    res.json({ channels: {}, totalUnread: 0 });
  }
});

export default router;
