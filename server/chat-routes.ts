import { Router } from 'express';
import { z } from 'zod';
import { db } from './db/drizzle';
import { 
  chatChannels, 
  chatChannelMembers, 
  chatMessages, 
  chatMessageReads, 
  chatMessagePins,
  users 
} from '@shared/schema';
import { eq, and, desc, like, or } from 'drizzle-orm';

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
});

const addUserSchema = z.object({
  userId: z.string().uuid(),
});

const searchUsersSchema = z.object({
  query: z.string().min(1),
});

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
      userChannels.map(async ({ channel, member }) => {
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
          members: members.map(m => ({
            userId: m.userId,
            name: m.name,
            avatar: undefined, // Could add avatar field to users table later
            role: m.role,
          })),
          isMuted: member?.isMuted || false,
          pins: pins.map(p => p.messageId),
        };
      })
    );

    const validChannels = channelsWithMembers.filter(Boolean);
    res.json(validChannels);
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
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

    const formattedMessages = messages.map(msg => ({
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
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/chat/messages - Send a message
router.post('/messages', async (req, res) => {
  try {
    const { channelId, body } = sendMessageSchema.parse(req.body);
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

    // Create the message
    const [newMessage] = await db
      .insert(chatMessages)
      .values({
        channelId,
        userId,
        body,
        messageType: 'text',
      })
      .returning();

    // Update channel's last message timestamp
    await db
      .update(chatChannels)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(chatChannels.id, channelId));

    // Get user info for response
    const [userInfo] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const response = {
      id: newMessage.id,
      userId: newMessage.userId,
      userName: userInfo?.name || 'Unknown',
      userAvatar: userInfo?.email,
      body: newMessage.body,
      createdAt: newMessage.createdAt,
      reads: [],
      pins: [],
    };

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
    res.status(500).json({ error: 'Failed to search users' });
  }
});

export default router;
