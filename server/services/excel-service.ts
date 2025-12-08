/**
 * Excel Export Service for Pulse Farm Management
 * 
 * Generates Excel spreadsheets for:
 * - Financial reports
 * - Animal records
 * - Compliance data
 * - Production analytics
 */

import * as XLSX from 'xlsx';

interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  format?: 'number' | 'currency' | 'percent' | 'date' | 'text';
}

interface ExcelSheetData {
  name: string;
  columns: ExcelColumn[];
  data: Record<string, any>[];
  title?: string;
  subtitle?: string;
}

interface ExcelExportOptions {
  filename: string;
  sheets: ExcelSheetData[];
  author?: string;
  company?: string;
}

class ExcelService {
  /**
   * Generate Excel workbook from data
   */
  generateWorkbook(options: ExcelExportOptions): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new();
    
    // Set workbook properties
    workbook.Props = {
      Title: options.filename,
      Author: options.author || 'Pulse Farm Management',
      Company: options.company || 'Pulse',
      CreatedDate: new Date(),
    };

    // Add each sheet
    options.sheets.forEach(sheet => {
      const worksheet = this.createWorksheet(sheet);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.substring(0, 31)); // Excel sheet name limit
    });

    return workbook;
  }

  /**
   * Create a worksheet from sheet data
   */
  private createWorksheet(sheet: ExcelSheetData): XLSX.WorkSheet {
    const rows: any[][] = [];
    let startRow = 0;

    // Add title if provided
    if (sheet.title) {
      rows.push([sheet.title]);
      startRow++;
    }

    // Add subtitle if provided
    if (sheet.subtitle) {
      rows.push([sheet.subtitle]);
      startRow++;
    }

    // Add empty row after titles
    if (sheet.title || sheet.subtitle) {
      rows.push([]);
      startRow++;
    }

    // Add headers
    const headers = sheet.columns.map(col => col.header);
    rows.push(headers);

    // Add data rows
    sheet.data.forEach(record => {
      const row = sheet.columns.map(col => {
        const value = record[col.key];
        return this.formatValue(value, col.format);
      });
      rows.push(row);
    });

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    worksheet['!cols'] = sheet.columns.map(col => ({
      wch: col.width || 15,
    }));

    return worksheet;
  }

  /**
   * Format cell value based on type
   */
  private formatValue(value: any, format?: string): any {
    if (value === null || value === undefined) return '';
    
    switch (format) {
      case 'currency':
        return typeof value === 'number' ? `$${value.toLocaleString('en-NZ', { minimumFractionDigits: 2 })}` : value;
      case 'percent':
        return typeof value === 'number' ? `${value.toFixed(1)}%` : value;
      case 'date':
        return value instanceof Date ? value.toLocaleDateString('en-NZ') : value;
      case 'number':
        return typeof value === 'number' ? value.toLocaleString('en-NZ') : value;
      default:
        return value;
    }
  }

  /**
   * Export workbook to buffer
   */
  toBuffer(workbook: XLSX.WorkBook): Buffer {
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /**
   * Export workbook to base64
   */
  toBase64(workbook: XLSX.WorkBook): string {
    const buffer = this.toBuffer(workbook);
    return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${buffer.toString('base64')}`;
  }

  // ============ Pre-built Report Templates ============

  /**
   * Generate Financial Summary Excel
   */
  generateFinancialReport(data: {
    summary: any;
    revenueBreakdown: any[];
    costBreakdown: any[];
    monthlyData: any[];
    budgetComparison: any[];
  }): XLSX.WorkBook {
    return this.generateWorkbook({
      filename: 'Financial Report',
      sheets: [
        {
          name: 'Summary',
          title: 'Financial Summary Report',
          subtitle: `Generated: ${new Date().toLocaleDateString('en-NZ')}`,
          columns: [
            { header: 'Metric', key: 'metric', width: 25 },
            { header: 'Value', key: 'value', width: 20, format: 'currency' },
            { header: 'Change', key: 'change', width: 15, format: 'percent' },
          ],
          data: [
            { metric: 'Total Revenue', value: data.summary.totalRevenue, change: data.summary.revenueChange },
            { metric: 'Total Costs', value: data.summary.totalCosts, change: data.summary.costChange },
            { metric: 'Net Profit', value: data.summary.netProfit, change: 0 },
            { metric: 'Profit Margin', value: data.summary.profitMargin, change: 0 },
          ],
        },
        {
          name: 'Revenue Breakdown',
          title: 'Revenue by Category',
          columns: [
            { header: 'Category', key: 'category', width: 25 },
            { header: 'Amount', key: 'amount', width: 18, format: 'currency' },
            { header: 'Percentage', key: 'percentage', width: 15, format: 'percent' },
          ],
          data: data.revenueBreakdown,
        },
        {
          name: 'Cost Breakdown',
          title: 'Costs by Category',
          columns: [
            { header: 'Category', key: 'category', width: 25 },
            { header: 'Amount', key: 'amount', width: 18, format: 'currency' },
            { header: 'Percentage', key: 'percentage', width: 15, format: 'percent' },
          ],
          data: data.costBreakdown,
        },
        {
          name: 'Monthly Data',
          title: 'Monthly Financial Performance',
          columns: [
            { header: 'Month', key: 'month', width: 15 },
            { header: 'Revenue', key: 'revenue', width: 18, format: 'currency' },
            { header: 'Costs', key: 'costs', width: 18, format: 'currency' },
            { header: 'Profit', key: 'profit', width: 18, format: 'currency' },
          ],
          data: data.monthlyData,
        },
        {
          name: 'Budget vs Actual',
          title: 'Budget Comparison',
          columns: [
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Budget', key: 'budget', width: 15, format: 'currency' },
            { header: 'Actual', key: 'actual', width: 15, format: 'currency' },
            { header: 'Variance', key: 'variance', width: 15, format: 'currency' },
            { header: 'Variance %', key: 'variancePercent', width: 12, format: 'percent' },
          ],
          data: data.budgetComparison,
        },
      ],
    });
  }

  /**
   * Generate Animal Records Excel
   */
  generateAnimalRecordsReport(animals: any[]): XLSX.WorkBook {
    return this.generateWorkbook({
      filename: 'Animal Records',
      sheets: [
        {
          name: 'Animals',
          title: 'Animal Register',
          subtitle: `Total Animals: ${animals.length}`,
          columns: [
            { header: 'Tag ID', key: 'tagId', width: 15 },
            { header: 'Name', key: 'name', width: 20 },
            { header: 'Breed', key: 'breed', width: 15 },
            { header: 'Sex', key: 'sex', width: 10 },
            { header: 'Date of Birth', key: 'dateOfBirth', width: 15, format: 'date' },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Group', key: 'group', width: 15 },
            { header: 'Weight (kg)', key: 'weight', width: 12, format: 'number' },
            { header: 'NAIT Number', key: 'naitNumber', width: 18 },
          ],
          data: animals,
        },
      ],
    });
  }

  /**
   * Generate Herd Performance Excel
   */
  generateHerdPerformanceReport(data: {
    production: any[];
    reproduction: any[];
    health: any[];
  }): XLSX.WorkBook {
    return this.generateWorkbook({
      filename: 'Herd Performance',
      sheets: [
        {
          name: 'Production',
          title: 'Production Metrics',
          columns: [
            { header: 'Metric', key: 'metric', width: 25 },
            { header: 'This Season', key: 'current', width: 15 },
            { header: 'Last Season', key: 'previous', width: 15 },
            { header: 'Change %', key: 'change', width: 12, format: 'percent' },
            { header: 'Target', key: 'target', width: 12 },
          ],
          data: data.production,
        },
        {
          name: 'Reproduction',
          title: 'Reproduction Metrics',
          columns: [
            { header: 'Metric', key: 'metric', width: 25 },
            { header: 'Result', key: 'result', width: 15 },
            { header: 'Target', key: 'target', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
          ],
          data: data.reproduction,
        },
        {
          name: 'Health',
          title: 'Health Metrics',
          columns: [
            { header: 'Metric', key: 'metric', width: 25 },
            { header: 'Value', key: 'value', width: 15 },
            { header: 'Industry Avg', key: 'industryAvg', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
          ],
          data: data.health,
        },
      ],
    });
  }

  /**
   * Generate NAIT Compliance Excel
   */
  generateNAITReport(data: {
    summary: any;
    movements: any[];
    animals: any[];
  }): XLSX.WorkBook {
    return this.generateWorkbook({
      filename: 'NAIT Compliance Report',
      sheets: [
        {
          name: 'Summary',
          title: 'NAIT Compliance Summary',
          columns: [
            { header: 'Metric', key: 'metric', width: 25 },
            { header: 'Value', key: 'value', width: 20 },
          ],
          data: [
            { metric: 'NAIT Number', value: data.summary.naitNumber },
            { metric: 'Total Animals', value: data.summary.totalAnimals },
            { metric: 'Movements This Period', value: data.summary.movements },
            { metric: 'Compliance Status', value: data.summary.complianceStatus },
          ],
        },
        {
          name: 'Movements',
          title: 'Animal Movements',
          columns: [
            { header: 'Date', key: 'date', width: 15, format: 'date' },
            { header: 'Type', key: 'type', width: 15 },
            { header: 'Animal ID', key: 'animalId', width: 18 },
            { header: 'From/To', key: 'location', width: 25 },
            { header: 'Registered', key: 'registered', width: 12 },
          ],
          data: data.movements,
        },
        {
          name: 'Animal Register',
          title: 'NAIT Registered Animals',
          columns: [
            { header: 'NAIT Tag', key: 'naitTag', width: 18 },
            { header: 'Visual Tag', key: 'visualTag', width: 15 },
            { header: 'Species', key: 'species', width: 12 },
            { header: 'Birth Date', key: 'birthDate', width: 15, format: 'date' },
            { header: 'Registration Date', key: 'registrationDate', width: 18, format: 'date' },
          ],
          data: data.animals,
        },
      ],
    });
  }

  /**
   * Generate Treatment Records Excel
   */
  generateTreatmentReport(treatments: any[]): XLSX.WorkBook {
    return this.generateWorkbook({
      filename: 'Treatment Records',
      sheets: [
        {
          name: 'Treatments',
          title: 'Animal Treatment Records',
          subtitle: `Total Treatments: ${treatments.length}`,
          columns: [
            { header: 'Date', key: 'date', width: 12, format: 'date' },
            { header: 'Animal ID', key: 'animalId', width: 15 },
            { header: 'Condition', key: 'condition', width: 20 },
            { header: 'Treatment', key: 'treatment', width: 25 },
            { header: 'Product', key: 'product', width: 20 },
            { header: 'Dose', key: 'dose', width: 12 },
            { header: 'Withholding (days)', key: 'withholding', width: 18, format: 'number' },
            { header: 'Administered By', key: 'administeredBy', width: 18 },
            { header: 'Notes', key: 'notes', width: 30 },
          ],
          data: treatments,
        },
      ],
    });
  }

  /**
   * Generate Pasture Walk Excel
   */
  generatePastureWalkReport(walks: any[]): XLSX.WorkBook {
    return this.generateWorkbook({
      filename: 'Pasture Walk Records',
      sheets: [
        {
          name: 'Pasture Walks',
          title: 'Pasture Walk Records',
          columns: [
            { header: 'Date', key: 'date', width: 12, format: 'date' },
            { header: 'Paddock', key: 'paddock', width: 20 },
            { header: 'Cover (kg DM/ha)', key: 'cover', width: 18, format: 'number' },
            { header: 'Growth Rate', key: 'growthRate', width: 15, format: 'number' },
            { header: 'Quality', key: 'quality', width: 12 },
            { header: 'Notes', key: 'notes', width: 30 },
          ],
          data: walks,
        },
      ],
    });
  }

  /**
   * Generate Benchmarking Excel
   */
  generateBenchmarkingReport(data: {
    farmMetrics: any;
    benchmarks: any;
    rankings: any;
  }): XLSX.WorkBook {
    const comparisonData = [];
    
    // Production metrics
    if (data.farmMetrics.production) {
      comparisonData.push(
        { category: 'Production', metric: 'MS per Cow', farm: data.farmMetrics.production.milkSolidsPerCow, average: data.benchmarks.milkSolidsPerCow?.average, top10: data.benchmarks.milkSolidsPerCow?.top10, percentile: data.rankings.milkSolidsPerCow?.percentile },
        { category: 'Production', metric: 'MS per Ha', farm: data.farmMetrics.production.milkSolidsPerHa, average: data.benchmarks.milkSolidsPerHa?.average, top10: data.benchmarks.milkSolidsPerHa?.top10, percentile: data.rankings.milkSolidsPerHa?.percentile },
      );
    }
    
    // Reproduction metrics
    if (data.farmMetrics.reproduction) {
      comparisonData.push(
        { category: 'Reproduction', metric: '6-Week In-Calf Rate', farm: data.farmMetrics.reproduction.sixWeekInCalfRate, average: data.benchmarks.sixWeekInCalfRate?.average, top10: data.benchmarks.sixWeekInCalfRate?.top10, percentile: data.rankings.sixWeekInCalfRate?.percentile },
        { category: 'Reproduction', metric: 'Empty Rate', farm: data.farmMetrics.reproduction.emptyRate, average: data.benchmarks.emptyRate?.average, top10: data.benchmarks.emptyRate?.top10, percentile: data.rankings.emptyRate?.percentile },
      );
    }

    return this.generateWorkbook({
      filename: 'Benchmarking Report',
      sheets: [
        {
          name: 'Comparison',
          title: 'Farm vs Industry Benchmarks',
          subtitle: `Region: ${data.farmMetrics.region || 'National'}`,
          columns: [
            { header: 'Category', key: 'category', width: 15 },
            { header: 'Metric', key: 'metric', width: 25 },
            { header: 'Your Farm', key: 'farm', width: 15 },
            { header: 'Industry Avg', key: 'average', width: 15 },
            { header: 'Top 10%', key: 'top10', width: 12 },
            { header: 'Percentile', key: 'percentile', width: 12 },
          ],
          data: comparisonData,
        },
      ],
    });
  }
}

// Export singleton instance
export const excelService = new ExcelService();

// Export types
export type { ExcelColumn, ExcelSheetData, ExcelExportOptions };
