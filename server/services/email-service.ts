/**
 * Email Service for Pulse Farm Management
 * 
 * This service handles sending emails for:
 * - Scheduled report delivery
 * - Alert notifications
 * - System notifications
 * 
 * Sent through whichever provider is set up (checked on every send):
 * - Mailtrap, when MAILTRAP_API_TOKEN is set. Uses its HTTPS API (Railway's Hobby plan blocks SMTP).
 *   With MAILTRAP_SANDBOX_ID also set, emails are caught in that Mailtrap sandbox and never delivered,
 *   which is what you want while building. Without it they are really sent (needs a verified domain).
 * - SendGrid, when SENDGRID_API_KEY is set.
 * - Neither: in development the email is written to the server log; live, it is reported as not sent.
 * EMAIL_FROM is the sender address for both.
 */

interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
}

interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

interface ScheduledEmail {
  id: string;
  reportId: string;
  recipients: string[];
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  nextRun: Date;
  lastRun?: Date;
  status: 'active' | 'paused' | 'failed';
  format: 'PDF' | 'Excel' | 'CSV';
}

// Email templates
const EMAIL_TEMPLATES = {
  scheduledReport: (reportName: string, farmName: string) => ({
    subject: `${reportName} - ${farmName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1e3932; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 10px 20px; background: #1e3932; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Pulse Farm Management</h1>
          </div>
          <div class="content">
            <h2>${reportName}</h2>
            <p>Hi,</p>
            <p>Please find attached your scheduled ${reportName} for ${farmName}.</p>
            <p>This report was automatically generated on ${new Date().toLocaleDateString('en-NZ')}.</p>
            <p>If you have any questions about this report, please contact your farm administrator.</p>
          </div>
          <div class="footer">
            <p>This email was sent by Pulse Farm Management System</p>
            <p>To manage your email preferences, visit your account settings.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  alertNotification: (alertTitle: string, alertMessage: string, severity: string) => ({
    subject: `[${severity.toUpperCase()}] Farm Alert: ${alertTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${severity === 'critical' ? '#dc2626' : severity === 'warning' ? '#f59e0b' : '#1e3932'}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .alert-box { padding: 15px; background: ${severity === 'critical' ? '#fef2f2' : severity === 'warning' ? '#fffbeb' : '#f0fdf4'}; border-left: 4px solid ${severity === 'critical' ? '#dc2626' : severity === 'warning' ? '#f59e0b' : '#22c55e'}; margin: 15px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 10px 20px; background: #1e3932; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Farm Alert</h1>
          </div>
          <div class="content">
            <h2>${alertTitle}</h2>
            <div class="alert-box">
              <p>${alertMessage}</p>
            </div>
            <p>Time: ${new Date().toLocaleString('en-NZ')}</p>
            <p style="margin-top: 20px;">
              <a href="#" class="button">View in Pulse</a>
            </p>
          </div>
          <div class="footer">
            <p>This is an automated alert from Pulse Farm Management System</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  complianceReminder: (taskName: string, dueDate: string, category: string) => ({
    subject: `Compliance Reminder: ${taskName} due ${dueDate}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1e3932; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .task-box { padding: 15px; background: #fff; border: 1px solid #ddd; border-radius: 5px; margin: 15px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 10px 20px; background: #1e3932; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Compliance Reminder</h1>
          </div>
          <div class="content">
            <h2>Task Due Soon</h2>
            <div class="task-box">
              <p><strong>Task:</strong> ${taskName}</p>
              <p><strong>Category:</strong> ${category}</p>
              <p><strong>Due Date:</strong> ${dueDate}</p>
            </div>
            <p>Please ensure this compliance task is completed before the due date to maintain your certification status.</p>
            <p style="margin-top: 20px;">
              <a href="#" class="button">Complete Task</a>
            </p>
          </div>
          <div class="footer">
            <p>This reminder was sent by Pulse Farm Management System</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),
};

type EmailProvider = 'mailtrap' | 'sendgrid' | null;
type SendResult = { success: boolean; messageId?: string; error?: string; logged?: boolean };

const base64 = (content: Buffer | string) =>
  (typeof content === 'string' ? Buffer.from(content) : content).toString('base64');

class EmailService {
  private get fromEmail(): string {
    return process.env.EMAIL_FROM || 'noreply@pulsefarm.co.nz';
  }

  /** Which provider is set up right now (Mailtrap wins when both are) */
  provider(): EmailProvider {
    if (process.env.MAILTRAP_API_TOKEN) return 'mailtrap';
    if (process.env.SENDGRID_API_KEY || process.env.EMAIL_API_KEY) return 'sendgrid';
    return null;
  }

  /**
   * Send an email
   */
  async sendEmail(options: EmailOptions): Promise<SendResult> {
    const provider = this.provider();
    if (!provider) {
      // Live, an email that can't go is a failure the caller must show. In development the
      // email is written to the server log instead (with its text, so links can be followed).
      if (process.env.NODE_ENV === 'production') {
        console.error('[Email Service] No email provider is set up (MAILTRAP_API_TOKEN or SENDGRID_API_KEY); email not sent:', options.subject);
        return { success: false, error: 'Email is not set up on this server' };
      }
      console.log('[Email Service] Not configured, so not sent. Would send:', {
        to: options.to,
        subject: options.subject,
        hasAttachments: !!options.attachments?.length,
      });
      if (options.text) console.log(`[Email Service] Text:\n${options.text}`);
      return { success: true, messageId: `logged-${Date.now()}`, logged: true };
    }

    try {
      return provider === 'mailtrap' ? await this.sendWithMailtrap(options) : await this.sendWithSendGrid(options);
    } catch (error) {
      console.error('[Email Service] Error sending email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async sendWithMailtrap(options: EmailOptions): Promise<SendResult> {
    const sandboxId = (process.env.MAILTRAP_SANDBOX_ID || '').trim();
    if (sandboxId && !/^\d+$/.test(sandboxId)) {
      return { success: false, error: 'MAILTRAP_SANDBOX_ID must be the sandbox number' };
    }
    const url = sandboxId
      ? `https://sandbox.api.mailtrap.io/api/send/${sandboxId}`
      : 'https://send.api.mailtrap.io/api/send';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MAILTRAP_API_TOKEN}`,
        'Content-Type': 'application/json',
        // Mailtrap may block requests without an ordinary User-Agent
        'User-Agent': 'Pulse-Farm-Management/1.0',
      },
      body: JSON.stringify({
        from: { email: this.fromEmail, name: process.env.EMAIL_FROM_NAME || 'Pulse' },
        to: (Array.isArray(options.to) ? options.to : [options.to]).map(email => ({ email })),
        subject: options.subject,
        ...(options.text ? { text: options.text } : {}),
        ...(options.html ? { html: options.html } : {}),
        ...(options.attachments?.length ? {
          attachments: options.attachments.map(att => ({
            content: base64(att.content),
            filename: att.filename,
            type: att.contentType,
            disposition: 'attachment',
          })),
        } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body: any = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) {
      const reason = Array.isArray(body.errors) ? body.errors.join('; ') : body.errors || body.error || `HTTP ${response.status}`;
      console.error(`[Email Service] Mailtrap refused the email (${response.status}): ${reason}`);
      return { success: false, error: `Mailtrap: ${reason}` };
    }
    return { success: true, messageId: String(body.message_ids?.[0] ?? '') };
  }

  private async sendWithSendGrid(options: EmailOptions): Promise<SendResult> {
    const { default: sgMail } = await import('@sendgrid/mail');
    sgMail.setApiKey((process.env.SENDGRID_API_KEY || process.env.EMAIL_API_KEY)!);
    const [response] = await sgMail.send({
      to: options.to,
      from: this.fromEmail,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments?.map(att => ({
        content: base64(att.content),
        filename: att.filename,
        type: att.contentType,
        disposition: 'attachment',
      })),
    } as any);
    return { success: true, messageId: String(response.headers['x-message-id'] ?? '') };
  }

  /**
   * Send a scheduled report email
   */
  async sendScheduledReport(
    recipients: string[],
    reportName: string,
    farmName: string,
    pdfBuffer: Buffer
  ): Promise<{ success: boolean; error?: string }> {
    const template = EMAIL_TEMPLATES.scheduledReport(reportName, farmName);
    
    return this.sendEmail({
      to: recipients,
      subject: template.subject,
      html: template.html,
      attachments: [
        {
          filename: `${reportName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  /**
   * Send an alert notification
   */
  async sendAlertNotification(
    recipients: string[],
    alertTitle: string,
    alertMessage: string,
    severity: 'info' | 'warning' | 'critical'
  ): Promise<{ success: boolean; error?: string }> {
    const template = EMAIL_TEMPLATES.alertNotification(alertTitle, alertMessage, severity);
    
    return this.sendEmail({
      to: recipients,
      subject: template.subject,
      html: template.html,
    });
  }

  /**
   * Send a compliance reminder
   */
  async sendComplianceReminder(
    recipients: string[],
    taskName: string,
    dueDate: string,
    category: string
  ): Promise<{ success: boolean; error?: string }> {
    const template = EMAIL_TEMPLATES.complianceReminder(taskName, dueDate, category);
    
    return this.sendEmail({
      to: recipients,
      subject: template.subject,
      html: template.html,
    });
  }

  /**
   * Check if email service is configured
   */
  isReady(): boolean {
    return this.provider() !== null;
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Export types
export type { EmailOptions, EmailAttachment, ScheduledEmail };
