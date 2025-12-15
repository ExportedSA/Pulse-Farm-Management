import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import sgMail from "@sendgrid/mail";
import { Twilio } from "twilio";

// Lazy initialization for SendGrid
function getSendGridClient() {
  if (!process.env.SENDGRID_API_KEY) {
    return null;
  }
  
  // Validate API key format
  if (!process.env.SENDGRID_API_KEY.startsWith('SG.')) {
    console.warn('[EMAIL] Invalid SendGrid API key format - should start with "SG."');
    return null;
  }
  
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  return sgMail;
}

// Lazy initialization for Twilio
function getTwilioClient() {
  if (!process.env.TWILIO_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return null;
  }
  
  // Validate SID format
  if (!process.env.TWILIO_SID.startsWith('AC')) {
    console.warn('[SMS] Invalid Twilio SID format - should start with "AC"');
    return null;
  }
  
  return new Twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
}

// Notification interface
interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>;
}

// Email notification function
export async function sendEmailNotification(
  userEmail: string,
  subject: string,
  message: string,
  priority?: 'low' | 'normal' | 'high' | 'urgent'
): Promise<boolean> {
  try {
    // Get SendGrid client with lazy initialization
    const sgClient = getSendGridClient();
    if (!sgClient) {
      console.log(`[EMAIL] Would send email to ${userEmail}:`);
      console.log(`  Subject: ${subject}`);
      console.log(`  Message: ${message}`);
      return true; // Simulate success in development
    }

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@pulsefarm.app';
    
    const msg = {
      to: userEmail,
      from: fromEmail,
      subject: subject,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a3a2f;">${subject}</h2>
          <p style="font-size: 16px; line-height: 1.5;">${message}</p>
          <hr style="border: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            This notification was sent from Pulse Farm Management System.
            <br>
            If you don't want to receive these emails, please update your notification preferences.
          </p>
        </div>
      `,
    };

    await sgClient.send(msg);
    console.log(`[EMAIL] Sent to ${userEmail}: ${subject}`);
    return true;
  } catch (error) {
    console.error("[EMAIL] Failed to send email:", error);
    return false;
  }
}

// SMS notification function
export async function sendSmsNotification(
  userPhone: string,
  message: string,
  priority?: 'low' | 'normal' | 'high' | 'urgent'
): Promise<boolean> {
  try {
    // Get Twilio client with lazy initialization
    const twilioClient = getTwilioClient();
    if (!twilioClient || !process.env.TWILIO_FROM_NUMBER) {
      console.log(`[SMS] Would send SMS to ${userPhone}:`);
      console.log(`  Message: ${message}`);
      return true; // Simulate success in development
    }

    // Format phone number if needed (ensure it starts with +)
    let formattedPhone = userPhone;
    if (!userPhone.startsWith('+')) {
      formattedPhone = `+${userPhone}`;
    }

    const sms = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_FROM_NUMBER,
      to: formattedPhone,
    });

    console.log(`[SMS] Sent to ${userPhone}: ${message} (SID: ${sms.sid})`);
    return true;
  } catch (error) {
    console.error("[SMS] Failed to send SMS:", error);
    return false;
  }
}

// Get user contact information
async function getUserContactInfo(userId: string): Promise<{
  email?: string;
  phone?: string;
  name?: string;
}> {
  try {
    const [user] = await db.select({
      email: users.email,
      name: users.name,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      console.error(`[NOTIFICATIONS] User not found: ${userId}`);
      return {};
    }

    // Note: Phone number would need to be added to the users table
    // For now, we'll use a mock phone number for demonstration
    return {
      email: user.email || undefined,
      phone: user.email ? `+6421${Math.floor(Math.random() * 10000000)}` : undefined,
      name: user.name || undefined,
    };
  } catch (error) {
    console.error("[NOTIFICATIONS] Failed to get user info:", error);
    return {};
  }
}

// Check if notifications should be sent based on quiet hours
function shouldSendNotification(
  priority: 'low' | 'normal' | 'high' | 'urgent',
  quietHours?: { enabled: boolean; start: string; end: string }
): boolean {
  // Always send urgent notifications
  if (priority === 'urgent') return true;

  // If quiet hours are not enabled, always send
  if (!quietHours?.enabled) return true;

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin] = quietHours.start.split(':').map(Number);
  const [endHour, endMin] = quietHours.end.split(':').map(Number);
  
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  // Check if current time is within quiet hours
  if (startTime <= endTime) {
    // Same day (e.g., 22:00 to 07:00)
    return currentTime < startTime || currentTime >= endTime;
  } else {
    // Overnight (e.g., 22:00 to 07:00 next day)
    return currentTime < startTime && currentTime >= endTime;
  }
}

// Main notification delivery function
export async function deliverNotification(
  notificationData: NotificationData,
  preferences?: {
    emailEnabled?: boolean;
    smsEnabled?: boolean;
    quietHours?: { enabled: boolean; start: string; end: string };
  }
): Promise<{ email: boolean; sms: boolean }> {
  const results = { email: false, sms: false };

  // Get user contact information
  const userInfo = await getUserContactInfo(notificationData.userId);
  
  if (!userInfo.email && !userInfo.phone) {
    console.log(`[NOTIFICATIONS] No contact info for user ${notificationData.userId}`);
    return results;
  }

  // Check if we should send based on quiet hours and priority
  if (!shouldSendNotification(notificationData.priority, preferences?.quietHours)) {
    console.log(`[NOTIFICATIONS] Skipping due to quiet hours for user ${notificationData.userId}`);
    return results;
  }

  // Prepare notification content
  const subject = `[Pulse Farm] ${notificationData.title}`;
  const emailBody = `
    Hi ${userInfo.name || 'there'},

    ${notificationData.message}

    ---
    This is an automated notification from Pulse Farm Management System.
  `;

  // SMS should be shorter due to character limits
  const smsBody = `[Pulse] ${notificationData.title}: ${notificationData.message.substring(0, 100)}${notificationData.message.length > 100 ? '...' : ''}`;

  // Send email if enabled and email is available
  if (preferences?.emailEnabled !== false && userInfo.email && process.env.SENDGRID_API_KEY) {
    results.email = await sendEmailNotification(userInfo.email, subject, emailBody, notificationData.priority);
  }

  // Send SMS if enabled, phone is available, and priority is high or urgent
  if (
    preferences?.smsEnabled !== false && 
    userInfo.phone && 
    (notificationData.priority === 'high' || notificationData.priority === 'urgent')
  ) {
    const twilioClient = getTwilioClient();
    if (twilioClient) {
      results.sms = await sendSmsNotification(userInfo.phone, smsBody, notificationData.priority);
    }
  }

  return results;
}

// Batch notification delivery for multiple users
export async function deliverNotificationToUsers(
  notificationData: Omit<NotificationData, 'userId'> & { userIds: string[] },
  preferences?: Record<string, {
    emailEnabled?: boolean;
    smsEnabled?: boolean;
    quietHours?: { enabled: boolean; start: string; end: string };
  }>
): Promise<{ userId: string; results: { email: boolean; sms: boolean } }[]> {
  const results = [];

  for (const userId of notificationData.userIds) {
    const userResults = await deliverNotification(
      { ...notificationData, userId },
      preferences?.[userId]
    );
    results.push({ userId, results: userResults });
  }

  return results;
}

// Helper function to create and deliver a notification
export async function createAndDeliverNotification(
  notificationData: NotificationData,
  preferences?: {
    emailEnabled?: boolean;
    smsEnabled?: boolean;
    quietHours?: { enabled: boolean; start: string; end: string };
  }
): Promise<{ notification: any; delivery: { email: boolean; sms: boolean } }> {
  // Here you would typically save the notification to the database
  // For now, we'll just deliver it
  
  const delivery = await deliverNotification(notificationData, preferences);
  
  return {
    notification: {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...notificationData,
      read: false,
      createdAt: new Date().toISOString(),
    },
    delivery,
  };
}

// Export notification types for use in other modules
export type { NotificationData };
