/**
 * Scheduled Reports Service for Pulse Farm Management
 * 
 * Handles automatic generation and delivery of scheduled reports
 * using node-cron for scheduling and nodemailer for email delivery
 */

import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { excelService } from './excel-service';

// Extend jsPDF type for autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface ScheduledReport {
  id: string;
  name: string;
  reportType: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  recipients: string[];
  format: 'PDF' | 'Excel' | 'Both';
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  cronExpression?: string;
}

interface ReportJob {
  report: ScheduledReport;
  task: cron.ScheduledTask;
}

class ScheduledReportsService {
  private jobs: Map<string, ReportJob> = new Map();
  private transporter: nodemailer.Transporter | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeEmailTransporter();
  }

  /**
   * Initialize email transporter
   */
  private initializeEmailTransporter() {
    // Check for email configuration
    const emailHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
    const emailUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const emailPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (emailHost && emailUser && emailPass) {
      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });
      console.log('[Scheduled Reports] Email transporter initialized');
    } else if (process.env.SENDGRID_API_KEY) {
      // SendGrid configuration
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY,
        },
      });
      console.log('[Scheduled Reports] SendGrid transporter initialized');
    } else {
      console.log('[Scheduled Reports] No email configuration found - emails will be logged only');
    }
  }

  /**
   * Initialize the service and load scheduled reports
   */
  async initialize() {
    if (this.isInitialized) return;

    console.log('[Scheduled Reports] Initializing scheduled reports service...');

    // In production, load scheduled reports from database
    // For now, use default reports
    const defaultReports: ScheduledReport[] = [
      {
        id: 'monthly-nait',
        name: 'Monthly NAIT Compliance Report',
        reportType: 'nait',
        frequency: 'monthly',
        recipients: [],
        format: 'PDF',
        enabled: false, // Disabled by default until configured
      },
      {
        id: 'weekly-herd',
        name: 'Weekly Herd Performance Summary',
        reportType: 'herd-performance',
        frequency: 'weekly',
        recipients: [],
        format: 'Both',
        enabled: false,
      },
      {
        id: 'monthly-financial',
        name: 'Monthly Financial Report',
        reportType: 'financial-summary',
        frequency: 'monthly',
        recipients: [],
        format: 'Excel',
        enabled: false,
      },
    ];

    // Schedule each enabled report
    for (const report of defaultReports) {
      if (report.enabled && report.recipients.length > 0) {
        this.scheduleReport(report);
      }
    }

    this.isInitialized = true;
    console.log('[Scheduled Reports] Service initialized');
  }

  /**
   * Schedule a report
   */
  scheduleReport(report: ScheduledReport): boolean {
    // Remove existing job if present
    this.unscheduleReport(report.id);

    const cronExpression = this.getCronExpression(report.frequency);
    if (!cronExpression) {
      console.error(`[Scheduled Reports] Invalid frequency: ${report.frequency}`);
      return false;
    }

    try {
      const task = cron.schedule(cronExpression, async () => {
        await this.executeReport(report);
      }, {
        scheduled: true,
        timezone: 'Pacific/Auckland', // NZ timezone
      });

      this.jobs.set(report.id, { report, task });
      
      console.log(`[Scheduled Reports] Scheduled "${report.name}" with cron: ${cronExpression}`);
      return true;
    } catch (error) {
      console.error(`[Scheduled Reports] Failed to schedule "${report.name}":`, error);
      return false;
    }
  }

  /**
   * Unschedule a report
   */
  unscheduleReport(reportId: string): boolean {
    const job = this.jobs.get(reportId);
    if (job) {
      job.task.stop();
      this.jobs.delete(reportId);
      console.log(`[Scheduled Reports] Unscheduled report: ${reportId}`);
      return true;
    }
    return false;
  }

  /**
   * Execute a report immediately
   */
  async executeReport(report: ScheduledReport): Promise<{ success: boolean; error?: string }> {
    console.log(`[Scheduled Reports] Executing "${report.name}"...`);

    try {
      // Generate report content
      const reportData = await this.generateReportData(report.reportType);
      
      const attachments: { filename: string; content: Buffer; contentType: string }[] = [];

      // Generate PDF if needed
      if (report.format === 'PDF' || report.format === 'Both') {
        const pdfBuffer = await this.generatePDF(report.reportType, reportData);
        attachments.push({
          filename: `${report.reportType}-report-${new Date().toISOString().slice(0, 10)}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        });
      }

      // Generate Excel if needed
      if (report.format === 'Excel' || report.format === 'Both') {
        const excelBuffer = this.generateExcel(report.reportType, reportData);
        attachments.push({
          filename: `${report.reportType}-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
          content: excelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
      }

      // Send email
      if (report.recipients.length > 0) {
        await this.sendReportEmail(report, attachments);
      }

      // Update last run time
      report.lastRun = new Date();
      report.nextRun = this.calculateNextRun(report.frequency);

      console.log(`[Scheduled Reports] Successfully executed "${report.name}"`);
      return { success: true };
    } catch (error) {
      console.error(`[Scheduled Reports] Failed to execute "${report.name}":`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Generate report data based on type
   */
  private async generateReportData(reportType: string): Promise<any> {
    // In production, fetch real data from database
    // For now, return sample data
    switch (reportType) {
      case 'nait':
        return {
          summary: {
            naitNumber: '12345678',
            totalAnimals: 312,
            movements: 45,
            complianceStatus: '100%',
          },
          movements: [
            { date: new Date(), type: 'Arrival', animalId: 'NZ001234', location: 'Farm A', registered: 'Yes' },
            { date: new Date(), type: 'Departure', animalId: 'NZ001235', location: 'Sale Yards', registered: 'Yes' },
          ],
          animals: [],
        };

      case 'herd-performance':
        return {
          production: [
            { metric: 'Total Milk Solids', current: 118500, previous: 112300, change: 5.5, target: 120000 },
            { metric: 'MS per Cow', current: 395, previous: 374, change: 5.6, target: 400 },
          ],
          reproduction: [
            { metric: '6-Week In-Calf Rate', result: '72%', target: '75%', status: 'Below Target' },
            { metric: 'Empty Rate', result: '9%', target: '10%', status: 'On Track' },
          ],
          health: [
            { metric: 'Bulk SCC', value: 145, industryAvg: 180, status: 'Good' },
            { metric: 'Lameness Rate', value: '5%', industryAvg: '8%', status: 'Good' },
          ],
        };

      case 'financial-summary':
        return {
          summary: {
            totalRevenue: 1200000,
            totalCosts: 850000,
            netProfit: 350000,
            profitMargin: 29.2,
            revenueChange: 5.5,
            costChange: 3.2,
          },
          revenueBreakdown: [
            { category: 'Milk Revenue', amount: 1020000, percentage: 85 },
            { category: 'Livestock Sales', amount: 150000, percentage: 12.5 },
            { category: 'Other', amount: 30000, percentage: 2.5 },
          ],
          costBreakdown: [
            { category: 'Feed', amount: 180000, percentage: 21.2 },
            { category: 'Labour', amount: 150000, percentage: 17.6 },
            { category: 'Animal Health', amount: 48000, percentage: 5.6 },
          ],
          monthlyData: [],
          budgetComparison: [],
        };

      default:
        return {};
    }
  }

  /**
   * Generate PDF report
   */
  private async generatePDF(reportType: string, data: any): Promise<Buffer> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(30, 57, 50);
    doc.text(this.getReportTitle(reportType), pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-NZ')}`, pageWidth / 2, 30, { align: 'center' });

    let y = 45;

    // Add content based on report type
    switch (reportType) {
      case 'nait':
        doc.setFontSize(14);
        doc.text('NAIT Compliance Summary', 20, y);
        y += 10;
        
        doc.autoTable({
          startY: y,
          head: [['Metric', 'Value']],
          body: [
            ['NAIT Number', data.summary.naitNumber],
            ['Total Animals', data.summary.totalAnimals.toString()],
            ['Movements', data.summary.movements.toString()],
            ['Compliance', data.summary.complianceStatus],
          ],
          theme: 'striped',
          headStyles: { fillColor: [30, 57, 50] },
        });
        break;

      case 'herd-performance':
        doc.setFontSize(14);
        doc.text('Production Summary', 20, y);
        y += 10;

        doc.autoTable({
          startY: y,
          head: [['Metric', 'This Season', 'Last Season', 'Change %']],
          body: data.production.map((p: any) => [p.metric, p.current, p.previous, `${p.change}%`]),
          theme: 'striped',
          headStyles: { fillColor: [30, 57, 50] },
        });
        break;

      case 'financial-summary':
        doc.setFontSize(14);
        doc.text('Financial Summary', 20, y);
        y += 10;

        doc.autoTable({
          startY: y,
          head: [['Metric', 'Value']],
          body: [
            ['Total Revenue', `$${data.summary.totalRevenue.toLocaleString()}`],
            ['Total Costs', `$${data.summary.totalCosts.toLocaleString()}`],
            ['Net Profit', `$${data.summary.netProfit.toLocaleString()}`],
            ['Profit Margin', `${data.summary.profitMargin}%`],
          ],
          theme: 'striped',
          headStyles: { fillColor: [30, 57, 50] },
        });
        break;
    }

    // Return as buffer
    return Buffer.from(doc.output('arraybuffer'));
  }

  /**
   * Generate Excel report
   */
  private generateExcel(reportType: string, data: any): Buffer {
    let workbook;

    switch (reportType) {
      case 'nait':
        workbook = excelService.generateNAITReport(data);
        break;
      case 'herd-performance':
        workbook = excelService.generateHerdPerformanceReport(data);
        break;
      case 'financial-summary':
        workbook = excelService.generateFinancialReport(data);
        break;
      default:
        workbook = excelService.generateWorkbook({
          filename: 'Report',
          sheets: [{
            name: 'Data',
            columns: [{ header: 'Info', key: 'info', width: 30 }],
            data: [{ info: 'No data available' }],
          }],
        });
    }

    return excelService.toBuffer(workbook);
  }

  /**
   * Send report email
   */
  private async sendReportEmail(
    report: ScheduledReport,
    attachments: { filename: string; content: Buffer; contentType: string }[]
  ): Promise<void> {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@pulsefarm.co.nz',
      to: report.recipients.join(', '),
      subject: `${report.name} - ${new Date().toLocaleDateString('en-NZ')}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1e3932; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Pulse Farm Management</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <h2>${report.name}</h2>
            <p>Please find attached your scheduled ${report.name}.</p>
            <p>This report was automatically generated on ${new Date().toLocaleString('en-NZ')}.</p>
            <p>Report format: ${report.format}</p>
          </div>
          <div style="padding: 20px; text-align: center; font-size: 12px; color: #666;">
            <p>This is an automated email from Pulse Farm Management System</p>
          </div>
        </div>
      `,
      attachments: attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
    };

    if (this.transporter) {
      await this.transporter.sendMail(mailOptions);
      console.log(`[Scheduled Reports] Email sent to: ${report.recipients.join(', ')}`);
    } else {
      console.log('[Scheduled Reports] Email would be sent (no transporter configured):', {
        to: report.recipients,
        subject: mailOptions.subject,
        attachments: attachments.map(a => a.filename),
      });
    }
  }

  /**
   * Get cron expression for frequency
   */
  private getCronExpression(frequency: string): string | null {
    switch (frequency) {
      case 'daily':
        return '0 6 * * *'; // 6 AM daily
      case 'weekly':
        return '0 6 * * 1'; // 6 AM Monday
      case 'monthly':
        return '0 6 1 * *'; // 6 AM 1st of month
      case 'quarterly':
        return '0 6 1 1,4,7,10 *'; // 6 AM 1st of Jan, Apr, Jul, Oct
      case 'annually':
        return '0 6 1 7 *'; // 6 AM July 1st (NZ financial year)
      default:
        return null;
    }
  }

  /**
   * Calculate next run date
   */
  private calculateNextRun(frequency: string): Date {
    const now = new Date();
    const next = new Date(now);

    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'annually':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }

    return next;
  }

  /**
   * Get report title
   */
  private getReportTitle(reportType: string): string {
    const titles: Record<string, string> = {
      'nait': 'NAIT Compliance Report',
      'herd-performance': 'Herd Performance Report',
      'financial-summary': 'Financial Summary Report',
      'nzfap': 'NZFAP Compliance Report',
      'fwfp': 'Freshwater Farm Plan Report',
    };
    return titles[reportType] || 'Farm Report';
  }

  /**
   * Get all scheduled reports
   */
  getScheduledReports(): ScheduledReport[] {
    return Array.from(this.jobs.values()).map(job => ({
      ...job.report,
      nextRun: this.calculateNextRun(job.report.frequency),
    }));
  }

  /**
   * Shutdown service
   */
  shutdown() {
    console.log('[Scheduled Reports] Shutting down...');
    this.jobs.forEach((job, id) => {
      job.task.stop();
    });
    this.jobs.clear();
  }
}

// Export singleton instance
export const scheduledReportsService = new ScheduledReportsService();
