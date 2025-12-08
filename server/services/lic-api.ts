/**
 * LIC (Livestock Improvement Corporation) API Integration
 * 
 * Integrates with LIC MINDA for:
 * - Herd test data import
 * - Breeding values (BW, PW, LW)
 * - Sire information
 * - AB technician records
 * 
 * Required Environment Variables:
 * - LIC_API_KEY: LIC API key
 * - LIC_API_SECRET: LIC API secret
 * - LIC_HERD_NUMBER: Your LIC herd number
 * - LIC_API_URL: API endpoint
 */

interface HerdTestResult {
  testDate: string;
  animalId: string;
  naitTag?: string;
  visualTag?: string;
  milkVolume: number; // litres
  fatPercent: number;
  proteinPercent: number;
  milkSolids: number; // kg
  somaticCellCount: number; // 000/ml
  lactationNumber: number;
  daysInMilk: number;
  calvingDate?: string;
  expectedCalvingDate?: string;
}

interface HerdTestSummary {
  testDate: string;
  herdNumber: string;
  cowsTested: number;
  totalMilkVolume: number;
  averageFat: number;
  averageProtein: number;
  totalMilkSolids: number;
  herdAverageScc: number;
  highSccCount: number; // > 250,000
}

interface BreedingValue {
  animalId: string;
  naitTag?: string;
  breedingWorth: number; // BW
  productionWorth: number; // PW
  lactationWorth: number; // LW
  reliability: number; // %
  milkBV: number;
  fatBV: number;
  proteinBV: number;
  somaticCellBV: number;
  fertilityBV: number;
  liveweightBV: number;
  lastUpdated: string;
}

interface SireInfo {
  sireCode: string;
  sireName: string;
  breed: string;
  breedingWorth: number;
  productionWorth: number;
  reliability: number;
  milkBV: number;
  fatBV: number;
  proteinBV: number;
  somaticCellBV: number;
  fertilityBV: number;
  status: 'active' | 'retired' | 'limited';
  availableStraws?: number;
}

interface ABRecord {
  date: string;
  animalId: string;
  naitTag?: string;
  sireCode: string;
  sireName: string;
  technicianId: string;
  technicianName: string;
  inseminationType: 'standard' | 'sexed' | 'beef';
  heatStrength?: 'weak' | 'moderate' | 'strong';
  notes?: string;
}

interface LICApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

class LICApiService {
  private apiKey: string;
  private apiSecret: string;
  private herdNumber: string;
  private baseUrl: string;
  private isConfigured: boolean;

  constructor() {
    this.apiKey = process.env.LIC_API_KEY || '';
    this.apiSecret = process.env.LIC_API_SECRET || '';
    this.herdNumber = process.env.LIC_HERD_NUMBER || '';
    this.baseUrl = process.env.LIC_API_URL || 'https://api.lic.co.nz/v1';
    this.isConfigured = !!(this.apiKey && this.apiSecret && this.herdNumber);

    if (!this.isConfigured) {
      console.log('[LIC API] Not configured - using mock data mode');
    }
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      'X-Herd-Number': this.herdNumber,
    };
  }

  /**
   * Import latest herd test results
   */
  async getHerdTestResults(testDate?: string): Promise<LICApiResponse<HerdTestResult[]>> {
    if (!this.isConfigured) {
      return this.mockGetHerdTestResults(testDate);
    }

    try {
      const params = new URLSearchParams({
        herdNumber: this.herdNumber,
        ...(testDate && { testDate }),
      });

      const response = await fetch(`${this.baseUrl}/herdtests?${params}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data: data.results };
    } catch (error) {
      console.error('[LIC API] Herd test error:', error);
      return { success: false, error: 'Failed to connect to LIC API' };
    }
  }

  /**
   * Get herd test summary
   */
  async getHerdTestSummary(testDate?: string): Promise<LICApiResponse<HerdTestSummary>> {
    if (!this.isConfigured) {
      return this.mockGetHerdTestSummary(testDate);
    }

    try {
      const params = new URLSearchParams({
        herdNumber: this.herdNumber,
        ...(testDate && { testDate }),
      });

      const response = await fetch(`${this.baseUrl}/herdtests/summary?${params}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('[LIC API] Herd test summary error:', error);
      return { success: false, error: 'Failed to connect to LIC API' };
    }
  }

  /**
   * Get breeding values for animals
   */
  async getBreedingValues(animalIds?: string[]): Promise<LICApiResponse<BreedingValue[]>> {
    if (!this.isConfigured) {
      return this.mockGetBreedingValues(animalIds);
    }

    try {
      const params = new URLSearchParams({
        herdNumber: this.herdNumber,
        ...(animalIds && { animalIds: animalIds.join(',') }),
      });

      const response = await fetch(`${this.baseUrl}/breeding-values?${params}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data: data.values };
    } catch (error) {
      console.error('[LIC API] Breeding values error:', error);
      return { success: false, error: 'Failed to connect to LIC API' };
    }
  }

  /**
   * Search for sire information
   */
  async searchSires(query: string): Promise<LICApiResponse<SireInfo[]>> {
    if (!this.isConfigured) {
      return this.mockSearchSires(query);
    }

    try {
      const params = new URLSearchParams({ query });

      const response = await fetch(`${this.baseUrl}/sires/search?${params}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data: data.sires };
    } catch (error) {
      console.error('[LIC API] Sire search error:', error);
      return { success: false, error: 'Failed to connect to LIC API' };
    }
  }

  /**
   * Get sire details
   */
  async getSireDetails(sireCode: string): Promise<LICApiResponse<SireInfo>> {
    if (!this.isConfigured) {
      return this.mockGetSireDetails(sireCode);
    }

    try {
      const response = await fetch(`${this.baseUrl}/sires/${sireCode}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('[LIC API] Sire details error:', error);
      return { success: false, error: 'Failed to connect to LIC API' };
    }
  }

  /**
   * Get AB (artificial breeding) records
   */
  async getABRecords(startDate?: string, endDate?: string): Promise<LICApiResponse<ABRecord[]>> {
    if (!this.isConfigured) {
      return this.mockGetABRecords(startDate, endDate);
    }

    try {
      const params = new URLSearchParams({
        herdNumber: this.herdNumber,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });

      const response = await fetch(`${this.baseUrl}/ab-records?${params}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data: data.records };
    } catch (error) {
      console.error('[LIC API] AB records error:', error);
      return { success: false, error: 'Failed to connect to LIC API' };
    }
  }

  /**
   * Get herd test history
   */
  async getHerdTestHistory(season?: string): Promise<LICApiResponse<HerdTestSummary[]>> {
    if (!this.isConfigured) {
      return this.mockGetHerdTestHistory(season);
    }

    try {
      const params = new URLSearchParams({
        herdNumber: this.herdNumber,
        ...(season && { season }),
      });

      const response = await fetch(`${this.baseUrl}/herdtests/history?${params}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data: data.tests };
    } catch (error) {
      console.error('[LIC API] Herd test history error:', error);
      return { success: false, error: 'Failed to connect to LIC API' };
    }
  }

  /**
   * Get recommended sires based on herd genetics
   */
  async getRecommendedSires(criteria?: {
    minBW?: number;
    minPW?: number;
    breed?: string;
    traits?: string[];
  }): Promise<LICApiResponse<SireInfo[]>> {
    if (!this.isConfigured) {
      return this.mockGetRecommendedSires(criteria);
    }

    try {
      const response = await fetch(`${this.baseUrl}/sires/recommended`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          herdNumber: this.herdNumber,
          ...criteria,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data: data.sires };
    } catch (error) {
      console.error('[LIC API] Recommended sires error:', error);
      return { success: false, error: 'Failed to connect to LIC API' };
    }
  }

  // ============ Mock Data Methods ============

  private mockGetHerdTestResults(testDate?: string): LICApiResponse<HerdTestResult[]> {
    const results: HerdTestResult[] = [];
    const date = testDate || new Date().toISOString().split('T')[0];
    
    // Generate mock results for 300 cows
    for (let i = 1; i <= 300; i++) {
      const lactation = Math.floor(Math.random() * 6) + 1;
      const dim = Math.floor(Math.random() * 250) + 30;
      const milkVolume = 18 + Math.random() * 12 - (dim > 200 ? 5 : 0);
      const fat = 4.2 + Math.random() * 1.2;
      const protein = 3.4 + Math.random() * 0.6;
      
      results.push({
        testDate: date,
        animalId: `A${String(i).padStart(3, '0')}`,
        naitTag: `6400012345${String(i).padStart(5, '0')}`,
        visualTag: `${String(i).padStart(3, '0')}`,
        milkVolume: Math.round(milkVolume * 10) / 10,
        fatPercent: Math.round(fat * 100) / 100,
        proteinPercent: Math.round(protein * 100) / 100,
        milkSolids: Math.round(milkVolume * (fat + protein) / 100 * 100) / 100,
        somaticCellCount: Math.floor(50 + Math.random() * 200),
        lactationNumber: lactation,
        daysInMilk: dim,
      });
    }
    
    return { success: true, data: results };
  }

  private mockGetHerdTestSummary(testDate?: string): LICApiResponse<HerdTestSummary> {
    return {
      success: true,
      data: {
        testDate: testDate || new Date().toISOString().split('T')[0],
        herdNumber: this.herdNumber || '12345',
        cowsTested: 295,
        totalMilkVolume: 6785,
        averageFat: 4.52,
        averageProtein: 3.68,
        totalMilkSolids: 556.8,
        herdAverageScc: 142,
        highSccCount: 18,
      },
    };
  }

  private mockGetBreedingValues(animalIds?: string[]): LICApiResponse<BreedingValue[]> {
    const values: BreedingValue[] = [];
    const ids = animalIds || ['A001', 'A002', 'A003', 'A004', 'A005'];
    
    ids.forEach(id => {
      values.push({
        animalId: id,
        naitTag: `640001234567${id.slice(-3)}`,
        breedingWorth: 150 + Math.floor(Math.random() * 100),
        productionWorth: 180 + Math.floor(Math.random() * 120),
        lactationWorth: 200 + Math.floor(Math.random() * 150),
        reliability: 70 + Math.floor(Math.random() * 25),
        milkBV: 400 + Math.floor(Math.random() * 300),
        fatBV: 15 + Math.floor(Math.random() * 20),
        proteinBV: 12 + Math.floor(Math.random() * 15),
        somaticCellBV: -0.2 + Math.random() * 0.4,
        fertilityBV: 2 + Math.floor(Math.random() * 6),
        liveweightBV: 20 + Math.floor(Math.random() * 30),
        lastUpdated: new Date().toISOString(),
      });
    });
    
    return { success: true, data: values };
  }

  private mockSearchSires(query: string): LICApiResponse<SireInfo[]> {
    const sires: SireInfo[] = [
      { sireCode: 'LIC001', sireName: 'Donaghys Dozer', breed: 'Friesian', breedingWorth: 285, productionWorth: 320, reliability: 99, milkBV: 850, fatBV: 42, proteinBV: 35, somaticCellBV: -0.15, fertilityBV: 5.2, status: 'active', availableStraws: 5000 },
      { sireCode: 'LIC002', sireName: 'Greenwell Donalds', breed: 'Jersey', breedingWorth: 265, productionWorth: 290, reliability: 98, milkBV: 620, fatBV: 55, proteinBV: 42, somaticCellBV: -0.22, fertilityBV: 4.8, status: 'active', availableStraws: 3500 },
      { sireCode: 'LIC003', sireName: 'Meander Donut', breed: 'Crossbred', breedingWorth: 275, productionWorth: 305, reliability: 97, milkBV: 720, fatBV: 48, proteinBV: 38, somaticCellBV: -0.18, fertilityBV: 5.5, status: 'active', availableStraws: 4200 },
      { sireCode: 'LIC004', sireName: 'Donaghys Dozer II', breed: 'Friesian', breedingWorth: 295, productionWorth: 335, reliability: 95, milkBV: 920, fatBV: 45, proteinBV: 38, somaticCellBV: -0.12, fertilityBV: 4.5, status: 'active', availableStraws: 6000 },
      { sireCode: 'LIC005', sireName: 'Donaghys Dozer III', breed: 'Friesian', breedingWorth: 310, productionWorth: 350, reliability: 92, milkBV: 980, fatBV: 48, proteinBV: 40, somaticCellBV: -0.10, fertilityBV: 4.2, status: 'active', availableStraws: 8000 },
    ];
    
    const filtered = sires.filter(s => 
      s.sireName.toLowerCase().includes(query.toLowerCase()) ||
      s.sireCode.toLowerCase().includes(query.toLowerCase())
    );
    
    return { success: true, data: filtered };
  }

  private mockGetSireDetails(sireCode: string): LICApiResponse<SireInfo> {
    return {
      success: true,
      data: {
        sireCode,
        sireName: 'Donaghys Dozer',
        breed: 'Friesian',
        breedingWorth: 285,
        productionWorth: 320,
        reliability: 99,
        milkBV: 850,
        fatBV: 42,
        proteinBV: 35,
        somaticCellBV: -0.15,
        fertilityBV: 5.2,
        status: 'active',
        availableStraws: 5000,
      },
    };
  }

  private mockGetABRecords(startDate?: string, endDate?: string): LICApiResponse<ABRecord[]> {
    const records: ABRecord[] = [];
    const sires = ['LIC001', 'LIC002', 'LIC003', 'LIC004'];
    const sireNames = ['Donaghys Dozer', 'Greenwell Donalds', 'Meander Donut', 'Donaghys Dozer II'];
    
    for (let i = 0; i < 50; i++) {
      const sireIndex = Math.floor(Math.random() * sires.length);
      records.push({
        date: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        animalId: `A${String(Math.floor(Math.random() * 300) + 1).padStart(3, '0')}`,
        sireCode: sires[sireIndex],
        sireName: sireNames[sireIndex],
        technicianId: 'TECH001',
        technicianName: 'John Smith',
        inseminationType: Math.random() > 0.8 ? 'sexed' : 'standard',
        heatStrength: ['weak', 'moderate', 'strong'][Math.floor(Math.random() * 3)] as any,
      });
    }
    
    return { success: true, data: records };
  }

  private mockGetHerdTestHistory(season?: string): LICApiResponse<HerdTestSummary[]> {
    const history: HerdTestSummary[] = [];
    const now = new Date();
    
    for (let i = 0; i < 10; i++) {
      const testDate = new Date(now.getTime() - i * 30 * 24 * 60 * 60 * 1000);
      history.push({
        testDate: testDate.toISOString().split('T')[0],
        herdNumber: this.herdNumber || '12345',
        cowsTested: 290 + Math.floor(Math.random() * 20),
        totalMilkVolume: 6500 + Math.floor(Math.random() * 1000),
        averageFat: 4.3 + Math.random() * 0.5,
        averageProtein: 3.5 + Math.random() * 0.4,
        totalMilkSolids: 520 + Math.floor(Math.random() * 80),
        herdAverageScc: 130 + Math.floor(Math.random() * 50),
        highSccCount: 10 + Math.floor(Math.random() * 15),
      });
    }
    
    return { success: true, data: history };
  }

  private mockGetRecommendedSires(criteria?: any): LICApiResponse<SireInfo[]> {
    return this.mockSearchSires('');
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
  getStatus(): { configured: boolean; herdNumber: string } {
    return {
      configured: this.isConfigured,
      herdNumber: this.herdNumber || 'Not configured',
    };
  }
}

// Export singleton instance
export const licApiService = new LICApiService();

// Export types
export type { HerdTestResult, HerdTestSummary, BreedingValue, SireInfo, ABRecord, LICApiResponse };
