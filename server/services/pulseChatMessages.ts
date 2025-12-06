import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function createChatMessage(params: {
  channelId: string;
  userId: string;
  body: string;
  attachmentIds?: string[];
}) {
  const { channelId, userId, body, attachmentIds } = params;

  const member = await prisma.pulseChannelMember.findFirst({
    where: { channelId, userId },
  });

  if (!member) {
    throw new Error("NOT_IN_CHANNEL");
  }

  const message = await prisma.pulseMessage.create({
    data: {
      channelId,
      userId,
      body,
    },
  });

  if (attachmentIds && attachmentIds.length > 0) {
    await prisma.pulseMessageAttachment.createMany({
      data: attachmentIds.map((fileId, order) => ({
        messageId: message.id,
        fileId,
        order,
      })),
    });
  }

  const full = await prisma.pulseMessage.findUnique({
    where: { id: message.id },
    include: {
      attachments: {
        include: { file: true },
        orderBy: { order: "asc" },
      },
      reads: true,
      pins: true,
    },
  });

  return full;
}
