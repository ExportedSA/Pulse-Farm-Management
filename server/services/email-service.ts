/**
 * Email Service for Pulse Farm Management
 * 
 * This service handles sending emails for:
 * - Scheduled report delivery
 * - Alert notifications
 * - System notifications
 * 
 * In production, integrate with:
 * - SendGrid (recommended for transactional emails)
 * - AWS SES (cost-effective for high volume)
 * - Nodemailer with SMTP (self-hosted option)
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

class EmailService {
  private apiKey: string | undefined;
  private fromEmail: string;
  private isConfigured: boolean;

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY || process.env.EMAIL_API_KEY;
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@pulsefarm.co.nz';
    this.isConfigured = !!this.apiKey;
  }

  /**
   * Send an email
   */
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured) {
      console.log('[Email Service] Not configured - would send email:', {
        to: options.to,
        subject: options.subject,
        hasAttachments: !!options.attachments?.length,
      });
      
      // Return success for development/demo purposes
      return {
        success: true,
        messageId: `demo-${Date.now()}`,
      };
    }

    try {
      // In production, use SendGrid or AWS SES
      // Example with SendGrid:
      /*
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(this.apiKey);
      
      const msg = {
        to: options.to,
        from: this.fromEmail,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments?.map(att => ({
          content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
          filename: att.filename,
          type: att.contentType,
          disposition: 'attachment',
        })),
      };
      
      const response = await sgMail.send(msg);
      return { success: true, messageId: response[0].headers['x-message-id'] };
      */

      // For now, log and return success
      console.log('[Email Service] Sending email:', {
        to: options.to,
        subject: options.subject,
      });

      return {
        success: true,
        messageId: `msg-${Date.now()}`,
      };
    } catch (error) {
      console.error('[Email Service] Error sending email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
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
    return this.isConfigured;
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Export types
export type { EmailOptions, EmailAttachment, ScheduledEmail };
