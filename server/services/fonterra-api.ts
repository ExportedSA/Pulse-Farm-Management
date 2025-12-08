/**
 * Fonterra API Integration Service
 * 
 * Integrates with Fonterra Connect for:
 * - Milk collection data
 * - Payout statements
 * - Quality results
 * - Season forecasts
 * 
 * Required Environment Variables:
 * - FONTERRA_API_KEY: Fonterra Connect API key
 * - FONTERRA_API_SECRET: API secret
 * - FONTERRA_SUPPLIER_NUMBER: Your supplier number
 * - FONTERRA_API_URL: API endpoint
 */

interface MilkCollection {
  collectionDate: string;
  collectionTime: string;
  vatNumber: string;
  docketNumber: string;
  volume: number; // litres
  temperature: number; // °C
  fatPercent?: number;
  proteinPercent?: number;
  milkSolidsKg?: number;
  grade: 'A' | 'B' | 'C' | 'D';
  deductions?: { reason: string; amount: number }[];
}

interface QualityResult {
  testDate: string;
  sampleType: 'bulk' | 'individual';
  fatPercent: number;
  proteinPercent: number;
  lactosePercent: number;
  somaticCellCount: number; // 000/ml
  bacteriaCount: number; // 000/ml
  freezingPoint: number;
  inhibitorySubstances: boolean;
  thermodurics?: number;
  coliforms?: number;
  grade: 'Premium' | 'Standard' | 'Downgraded';
  penalties?: { type: string; description: string }[];
}

interface PayoutStatement {
  statementDate: string;
  statementPeriod: string;
  milkSolidsKg: number;
  basePrice: number; // $/kg MS
  adjustments: {
    type: string;
    description: string;
    amount: number;
  }[];
  grossPayment: number;
  deductions: {
    type: string;
    description: string;
    amount: number;
  }[];
  netPayment: number;
  paymentDate: string;
}

interface SeasonForecast {
  season: string;
  forecastDate: string;
  farmgatePrice: number; // $/kg MS
  advanceRate: number;
  retentions: number;
  dividendEstimate: number;
  totalForecast: number;
  priceRange: {
    low: number;
    mid: number;
    high: number;
  };
  lastUpdated: string;
}

interface SupplyData {
  date: string;
  dailyVolume: number;
  dailyMilkSolids: number;
  seasonToDateVolume: number;
  seasonToDateMilkSolids: number;
  comparedToLastSeason: number; // %
  peakDayVolume?: number;
  peakDayDate?: string;
}

interface FonterraApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

class FonterraApiService {
  private apiKey: string;
  private apiSecret: string;
  private supplierNumber: string;
  private baseUrl: string;
  private isConfigured: boolean;

  constructor() {
    this.apiKey = process.env.FONTERRA_API_KEY || '';
    this.apiSecret = process.env.FONTERRA_API_SECRET || '';
    this.supplierNumber = process.env.FONTERRA_SUPPLIER_NUMBER || '';
    this.baseUrl = process.env.FONTERRA_API_URL || 'https://api.fonterra.com/v1';
    this.isConfigured = !!(this.apiKey && this.apiSecret && this.supplierNumber);

    if (!this.isConfigured) {
      console.log('[Fonterra API] Not configured - using mock data mode');
    }
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      'X-Supplier-Number': this.supplierNumber,
    };
  }

  /**
   * Get milk collection records
   */
  async getCollections(startDate?: string, endDate?: string): Promise<FonterraApiResponse<MilkCollection[]>> {
    if (!this.isConfigured) {
      return this.mockGetCollections(startDate, endDate);
    }

    try {
      const params = new URLSearchParams({
        supplierNumber: this.supplierNumber,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });

      const response = await fetch(`${this.baseUrl}/collections?${params}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data: data.collections };
    } catch (error) {
      console.error('[Fonterra API] Collections error:', error);
      return { success: false, error: 'Failed to connect to Fonterra API' };
    }
  }

  /**
   * Get latest collection
   */
  async getLatestCollection(): Promise<FonterraApiResponse<MilkCollection>> {
    if (!this.isConfigured) {
      return this.mockGetLatestCollection();
    }

    try {
      const response = await fetch(`${this.baseUrl}/collections/latest?supplierNumber=${this.supplierNumber}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('[Fonterra API] Latest collection error:', error);
      return { success: false, error: 'Failed to connect to Fonterra API' };
    }
  }

  /**
   * Get quality test results
   */
  async getQualityResults(startDate?: string, endDate?: string): Promise<FonterraApiResponse<QualityResult[]>> {
    if (!this.isConfigured) {
      return this.mockGetQualityResults(startDate, endDate);
    }

    try {
      const params = new URLSearchParams({
        supplierNumber: this.supplierNumber,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });

      const response = await fetch(`${this.baseUrl}/quality?${params}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data: data.results };
    } catch (error) {
      console.error('[Fonterra API] Quality results error:', error);
      return { success: false, error: 'Failed to connect to Fonterra API' };
    }
  }

  /**
   * Get payout statements
   */
  async getPayoutStatements(season?: string): Promise<FonterraApiResponse<PayoutStatement[]>> {
    if (!this.isConfigured) {
      return this.mockGetPayoutStatements(season);
    }

    try {
      const params = new URLSearchParams({
        supplierNumber: this.supplierNumber,
        ...(season && { season }),
      });

      const response = await fetch(`${this.baseUrl}/payouts?${params}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data: data.statements };
    } catch (error) {
      console.error('[Fonterra API] Payout statements error:', error);
      return { success: false, error: 'Failed to connect to Fonterra API' };
    }
  }

  /**
   * Get current season forecast
   */
  async getSeasonForecast(): Promise<FonterraApiResponse<SeasonForecast>> {
    if (!this.isConfigured) {
      return this.mockGetSeasonForecast();
    }

    try {
      const response = await fetch(`${this.baseUrl}/forecast/current`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('[Fonterra API] Season forecast error:', error);
      return { success: false, error: 'Failed to connect to Fonterra API' };
    }
  }

  /**
   * Get supply data summary
   */
  async getSupplyData(period?: 'daily' | 'weekly' | 'monthly'): Promise<FonterraApiResponse<SupplyData[]>> {
    if (!this.isConfigured) {
      return this.mockGetSupplyData(period);
    }

    try {
      const params = new URLSearchParams({
        supplierNumber: this.supplierNumber,
        ...(period && { period }),
      });

      const response = await fetch(`${this.baseUrl}/supply?${params}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data: data.supply };
    } catch (error) {
      console.error('[Fonterra API] Supply data error:', error);
      return { success: false, error: 'Failed to connect to Fonterra API' };
    }
  }

  /**
   * Get season-to-date summary
   */
  async getSeasonSummary(): Promise<FonterraApiResponse<{
    season: string;
    totalMilkSolids: number;
    totalVolume: number;
    averageFat: number;
    averageProtein: number;
    averageScc: number;
    qualityGrade: string;
    estimatedPayout: number;
    collectionsCount: number;
    daysSupplied: number;
  }>> {
    if (!this.isConfigured) {
      return this.mockGetSeasonSummary();
    }

    try {
      const response = await fetch(`${this.baseUrl}/season/summary?supplierNumber=${this.supplierNumber}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('[Fonterra API] Season summary error:', error);
      return { success: false, error: 'Failed to connect to Fonterra API' };
    }
  }

  /**
   * Calculate estimated payout
   */
  async calculatePayout(milkSolidsKg: number): Promise<FonterraApiResponse<{
    milkSolidsKg: number;
    basePrice: number;
    estimatedGross: number;
    estimatedDeductions: number;
    estimatedNet: number;
    breakdown: { item: string; amount: number }[];
  }>> {
    const forecastResponse = await this.getSeasonForecast();
    
    if (!forecastResponse.success || !forecastResponse.data) {
      return { success: false, error: 'Could not get forecast data' };
    }

    const forecast = forecastResponse.data;
    const basePrice = forecast.farmgatePrice;
    const estimatedGross = milkSolidsKg * basePrice;
    const levyDeduction = milkSolidsKg * 0.05; // Example levy
    const estimatedNet = estimatedGross - levyDeduction;

    return {
      success: true,
      data: {
        milkSolidsKg,
        basePrice,
        estimatedGross: Math.round(estimatedGross * 100) / 100,
        estimatedDeductions: Math.round(levyDeduction * 100) / 100,
        estimatedNet: Math.round(estimatedNet * 100) / 100,
        breakdown: [
          { item: 'Base Milk Price', amount: estimatedGross },
          { item: 'DairyNZ Levy', amount: -levyDeduction },
        ],
      },
    };
  }

  // ============ Mock Data Methods ============

  private mockGetCollections(startDate?: string, endDate?: string): FonterraApiResponse<MilkCollection[]> {
    const collections: MilkCollection[] = [];
    const now = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const volume = 2800 + Math.random() * 800;
      const fat = 4.2 + Math.random() * 0.8;
      const protein = 3.5 + Math.random() * 0.5;
      
      collections.push({
        collectionDate: date.toISOString().split('T')[0],
        collectionTime: '06:30',
        vatNumber: 'VAT001',
        docketNumber: `DOC${String(30000 + i).padStart(6, '0')}`,
        volume: Math.round(volume),
        temperature: 4 + Math.random() * 2,
        fatPercent: Math.round(fat * 100) / 100,
        proteinPercent: Math.round(protein * 100) / 100,
        milkSolidsKg: Math.round(volume * (fat + protein) / 100 * 10) / 10,
        grade: 'A',
      });
    }
    
    return { success: true, data: collections };
  }

  private mockGetLatestCollection(): FonterraApiResponse<MilkCollection> {
    const volume = 3200;
    const fat = 4.45;
    const protein = 3.72;
    
    return {
      success: true,
      data: {
        collectionDate: new Date().toISOString().split('T')[0],
        collectionTime: '06:30',
        vatNumber: 'VAT001',
        docketNumber: 'DOC030001',
        volume,
        temperature: 4.2,
        fatPercent: fat,
        proteinPercent: protein,
        milkSolidsKg: Math.round(volume * (fat + protein) / 100 * 10) / 10,
        grade: 'A',
      },
    };
  }

  private mockGetQualityResults(startDate?: string, endDate?: string): FonterraApiResponse<QualityResult[]> {
    const results: QualityResult[] = [];
    const now = new Date();
    
    for (let i = 0; i < 10; i++) {
      const date = new Date(now.getTime() - i * 3 * 24 * 60 * 60 * 1000);
      
      results.push({
        testDate: date.toISOString().split('T')[0],
        sampleType: 'bulk',
        fatPercent: 4.3 + Math.random() * 0.5,
        proteinPercent: 3.5 + Math.random() * 0.4,
        lactosePercent: 4.8 + Math.random() * 0.2,
        somaticCellCount: 120 + Math.floor(Math.random() * 80),
        bacteriaCount: 5 + Math.floor(Math.random() * 10),
        freezingPoint: -0.525 - Math.random() * 0.01,
        inhibitorySubstances: false,
        thermodurics: 50 + Math.floor(Math.random() * 50),
        coliforms: Math.floor(Math.random() * 20),
        grade: 'Premium',
      });
    }
    
    return { success: true, data: results };
  }

  private mockGetPayoutStatements(season?: string): FonterraApiResponse<PayoutStatement[]> {
    const statements: PayoutStatement[] = [];
    const months = ['August', 'September', 'October', 'November', 'December'];
    
    months.forEach((month, i) => {
      const ms = 8000 + Math.random() * 4000;
      const basePrice = 8.50;
      const gross = ms * basePrice;
      const deductions = gross * 0.02;
      
      statements.push({
        statementDate: `2024-${String(8 + i).padStart(2, '0')}-20`,
        statementPeriod: `${month} 2024`,
        milkSolidsKg: Math.round(ms),
        basePrice,
        adjustments: [
          { type: 'Quality Premium', description: 'Premium grade bonus', amount: ms * 0.05 },
          { type: 'Volume Incentive', description: 'Peak supply bonus', amount: ms * 0.02 },
        ],
        grossPayment: Math.round(gross * 100) / 100,
        deductions: [
          { type: 'DairyNZ Levy', description: 'Industry levy', amount: ms * 0.036 },
          { type: 'Fonterra Shareholders Fund', description: 'FSF contribution', amount: ms * 0.01 },
        ],
        netPayment: Math.round((gross - deductions) * 100) / 100,
        paymentDate: `2024-${String(8 + i).padStart(2, '0')}-20`,
      });
    });
    
    return { success: true, data: statements };
  }

  private mockGetSeasonForecast(): FonterraApiResponse<SeasonForecast> {
    return {
      success: true,
      data: {
        season: '2024-25',
        forecastDate: new Date().toISOString().split('T')[0],
        farmgatePrice: 8.50,
        advanceRate: 7.80,
        retentions: 0.70,
        dividendEstimate: 0.25,
        totalForecast: 8.75,
        priceRange: {
          low: 8.00,
          mid: 8.50,
          high: 9.00,
        },
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  private mockGetSupplyData(period?: string): FonterraApiResponse<SupplyData[]> {
    const data: SupplyData[] = [];
    const now = new Date();
    let cumulativeVolume = 0;
    let cumulativeMs = 0;
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const volume = 2800 + Math.random() * 800;
      const ms = volume * 0.085;
      cumulativeVolume += volume;
      cumulativeMs += ms;
      
      data.push({
        date: date.toISOString().split('T')[0],
        dailyVolume: Math.round(volume),
        dailyMilkSolids: Math.round(ms * 10) / 10,
        seasonToDateVolume: Math.round(cumulativeVolume),
        seasonToDateMilkSolids: Math.round(cumulativeMs * 10) / 10,
        comparedToLastSeason: 2 + Math.random() * 6,
      });
    }
    
    return { success: true, data };
  }

  private mockGetSeasonSummary(): FonterraApiResponse<any> {
    return {
      success: true,
      data: {
        season: '2024-25',
        totalMilkSolids: 118500,
        totalVolume: 1420000,
        averageFat: 4.52,
        averageProtein: 3.68,
        averageScc: 142,
        qualityGrade: 'Premium',
        estimatedPayout: 1007250,
        collectionsCount: 180,
        daysSupplied: 180,
      },
    };
  }

  /**
   * Check if service is configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Get configuration status
   */
  getStatus(): { configured: boolean; supplierNumber: string } {
    return {
      configured: this.isConfigured,
      supplierNumber: this.supplierNumber || 'Not configured',
    };
  }
}

// Export singleton instance
export const fonterraApiService = new FonterraApiService();

// Export types
export type { MilkCollection, QualityResult, PayoutStatement, SeasonForecast, SupplyData, FonterraApiResponse };
