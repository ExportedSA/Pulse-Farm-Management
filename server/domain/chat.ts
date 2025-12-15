import { db } from '../db';
import { chatChannels, chatChannelMembers, users, type ChatChannel } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Create or get a context channel for a job
 */
export async function getOrCreateJobChannel(
  jobId: string,
  channelName: string,
  farmId: string
): Promise<ChatChannel> {
  // Check if channel already exists
  const [existingChannel] = await db
    .select()
    .from(chatChannels)
    .where(
      and(
        eq(chatChannels.contextType, 'job'),
        eq(chatChannels.contextId, jobId)
      )
    )
    .limit(1);

  if (existingChannel) {
    return existingChannel;
  }

  // Create new channel
  const [newChannel] = await db
    .insert(chatChannels)
    .values({
      id: nanoid(),
      name: channelName,
      type: 'context',
      contextType: 'job',
      contextId: jobId,
      createdBy: 'system', // This should be replaced with actual user ID
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Add all active farm staff to the channel
  await addFarmStaffToChannel(newChannel.id, farmId);

  return newChannel;
}

/**
 * Create or get a context channel for an animal
 */
export async function getOrCreateAnimalChannel(
  animalId: string,
  channelName: string,
  farmId: string
): Promise<ChatChannel> {
  // Check if channel already exists
  const [existingChannel] = await db
    .select()
    .from(chatChannels)
    .where(
      and(
        eq(chatChannels.contextType, 'animal'),
        eq(chatChannels.contextId, animalId)
      )
    )
    .limit(1);

  if (existingChannel) {
    return existingChannel;
  }

  // Create new channel
  const [newChannel] = await db
    .insert(chatChannels)
    .values({
      id: nanoid(),
      name: channelName,
      type: 'context',
      contextType: 'animal',
      contextId: animalId,
      createdBy: 'system', // This should be replaced with actual user ID
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Add all active farm staff to the channel
  await addFarmStaffToChannel(newChannel.id, farmId);

  return newChannel;
}

/**
 * Create or get a context channel for equipment
 */
export async function getOrCreateEquipmentChannel(
  equipmentId: string,
  channelName: string,
  farmId: string
): Promise<ChatChannel> {
  // Check if channel already exists
  const [existingChannel] = await db
    .select()
    .from(chatChannels)
    .where(
      and(
        eq(chatChannels.contextType, 'equipment'),
        eq(chatChannels.contextId, equipmentId)
      )
    )
    .limit(1);

  if (existingChannel) {
    return existingChannel;
  }

  // Create new channel
  const [newChannel] = await db
    .insert(chatChannels)
    .values({
      id: nanoid(),
      name: channelName,
      type: 'context',
      contextType: 'equipment',
      contextId: equipmentId,
      createdBy: 'system', // This should be replaced with actual user ID
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Add all active farm staff to the channel
  await addFarmStaffToChannel(newChannel.id, farmId);

  return newChannel;
}

/**
 * Add all active farm staff to a channel
 */
async function addFarmStaffToChannel(channelId: string, farmId: string): Promise<void> {
  // Get all active users for the farm
  // Note: This is a simplified approach. In a real implementation, you'd have a proper
  // staff profiles table with farm associations
  const farmUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.farmId, farmId));

  // Add each user to the channel
  for (const user of farmUsers) {
    await db
      .insert(chatChannelMembers)
      .values({
        id: nanoid(),
        channelId,
        userId: user.id,
        role: 'member',
        joinedAt: new Date(),
        isMuted: false,
      })
      .onConflictDoNothing(); // Avoid duplicates
  }
}

/**
 * Get a context channel by type and ID
 */
export async function getContextChannel(
  contextType: 'job' | 'animal' | 'equipment',
  contextId: string
): Promise<ChatChannel | null> {
  const [channel] = await db
    .select()
    .from(chatChannels)
    .where(
      and(
        eq(chatChannels.contextType, contextType),
        eq(chatChannels.contextId, contextId)
      )
    )
    .limit(1);

  return channel || null;
}

/**
 * List all context channels for a farm
 */
export async function listContextChannels(farmId: string): Promise<ChatChannel[]> {
  // This is a simplified approach - you'd need to join with users table
  // to filter by farm in a real implementation
  return await db
    .select()
    .from(chatChannels)
    .where(
      and(
        eq(chatChannels.type, 'context'),
        eq(chatChannels.isActive, true)
      )
    )
    .orderBy(chatChannels.lastMessageAt);
}
