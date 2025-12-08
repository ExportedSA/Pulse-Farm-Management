/**
 * NAIT API Integration Service
 * 
 * National Animal Identification and Tracing (NAIT) system integration
 * for animal movement registration and compliance tracking.
 * 
 * API Documentation: https://www.nait.co.nz/
 * 
 * Required Environment Variables:
 * - NAIT_API_KEY: API key from NAIT
 * - NAIT_API_SECRET: API secret
 * - NAIT_LOCATION_NUMBER: Your NAIT location number (e.g., 12345678)
 * - NAIT_API_URL: API endpoint (production or sandbox)
 */

interface NAITAnimal {
  naitTag: string;
  visualTag?: string;
  species: 'cattle' | 'deer';
  birthDate?: string;
  sex?: 'male' | 'female';
  breed?: string;
  registrationDate: string;
  status: 'active' | 'deceased' | 'exported';
}

interface NAITMovement {
  id?: string;
  movementType: 'arrival' | 'departure' | 'death' | 'export';
  animalTags: string[];
  movementDate: string;
  fromLocation?: string;
  toLocation?: string;
  transporterName?: string;
  vehicleRego?: string;
  declarationNumber?: string;
  status: 'pending' | 'submitted' | 'confirmed' | 'rejected';
  submittedAt?: string;
  confirmedAt?: string;
  errorMessage?: string;
}

interface NAITLocation {
  locationNumber: string;
  name: string;
  address: string;
  region: string;
  type: 'farm' | 'saleyard' | 'processor' | 'other';
}

interface NAITApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

class NAITApiService {
  private apiKey: string;
  private apiSecret: string;
  private locationNumber: string;
  private baseUrl: string;
  private isConfigured: boolean;

  constructor() {
    this.apiKey = process.env.NAIT_API_KEY || '';
    this.apiSecret = process.env.NAIT_API_SECRET || '';
    this.locationNumber = process.env.NAIT_LOCATION_NUMBER || '';
    this.baseUrl = process.env.NAIT_API_URL || 'https://api.nait.co.nz/v1';
    this.isConfigured = !!(this.apiKey && this.apiSecret && this.locationNumber);

    if (!this.isConfigured) {
      console.log('[NAIT API] Not configured - using mock data mode');
    }
  }

  /**
   * Get authentication headers for NAIT API
   */
  private getAuthHeaders(): Record<string, string> {
    const timestamp = new Date().toISOString();
    // In production, implement proper HMAC signature
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      'X-Timestamp': timestamp,
      'X-Location': this.locationNumber,
    };
  }

  /**
   * Register a new animal in NAIT
   */
  async registerAnimal(animal: {
    naitTag: string;
    visualTag?: string;
    species: 'cattle' | 'deer';
    birthDate: string;
    sex: 'male' | 'female';
    breed?: string;
  }): Promise<NAITApiResponse<NAITAnimal>> {
    if (!this.isConfigured) {
      return this.mockRegisterAnimal(animal);
    }

    try {
      const response = await fetch(`${this.baseUrl}/animals/register`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          locationNumber: this.locationNumber,
          ...animal,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message, errorCode: error.code };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('[NAIT API] Register animal error:', error);
      return { success: false, error: 'Failed to connect to NAIT API' };
    }
  }

  /**
   * Record an animal movement (arrival/departure)
   */
  async recordMovement(movement: {
    movementType: 'arrival' | 'departure';
    animalTags: string[];
    movementDate: string;
    otherLocationNumber: string;
    transporterName?: string;
    vehicleRego?: string;
  }): Promise<NAITApiResponse<NAITMovement>> {
    if (!this.isConfigured) {
      return this.mockRecordMovement(movement);
    }

    try {
      const payload = {
        movementType: movement.movementType,
        animalTags: movement.animalTags,
        movementDate: movement.movementDate,
        fromLocation: movement.movementType === 'arrival' ? movement.otherLocationNumber : this.locationNumber,
        toLocation: movement.movementType === 'arrival' ? this.locationNumber : movement.otherLocationNumber,
        transporterName: movement.transporterName,
        vehicleRego: movement.vehicleRego,
      };

      const response = await fetch(`${this.baseUrl}/movements`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message, errorCode: error.code };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('[NAIT API] Record movement error:', error);
      return { success: false, error: 'Failed to connect to NAIT API' };
    }
  }

  /**
   * Record animal death
   */
  async recordDeath(data: {
    animalTag: string;
    deathDate: string;
    cause?: string;
  }): Promise<NAITApiResponse<NAITMovement>> {
    if (!this.isConfigured) {
      return this.mockRecordDeath(data);
    }

    try {
      const response = await fetch(`${this.baseUrl}/movements/death`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          locationNumber: this.locationNumber,
          animalTag: data.animalTag,
          deathDate: data.deathDate,
          cause: data.cause,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message, errorCode: error.code };
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      console.error('[NAIT API] Record death error:', error);
      return { success: false, error: 'Failed to connect to NAIT API' };
    }
  }

  /**
   * Get animals registered at location
   */
  async getAnimals(filters?: {
    species?: 'cattle' | 'deer';
    status?: 'active' | 'deceased';
    limit?: number;
    offset?: number;
  }): Promise<NAITApiResponse<NAITAnimal[]>> {
    if (!this.isConfigured) {
      return this.mockGetAnimals(filters);
    }

    try {
      const params = new URLSearchParams({
        locationNumber: this.locationNumber,
        ...(filters?.species && { species: filters.species }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.limit && { limit: filters.limit.toString() }),
        ...(filters?.offset && { offset: filters.offset.toString() }),
      });

      const response = await fetch(`${this.baseUrl}/animals?${params}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data: data.animals };
    } catch (error) {
      console.error('[NAIT API] Get animals error:', error);
      return { success: false, error: 'Failed to connect to NAIT API' };
    }
  }

  /**
   * Get movement history
   */
  async getMovements(filters?: {
    startDate?: string;
    endDate?: string;
    movementType?: string;
    limit?: number;
  }): Promise<NAITApiResponse<NAITMovement[]>> {
    if (!this.isConfigured) {
      return this.mockGetMovements(filters);
    }

    try {
      const params = new URLSearchParams({
        locationNumber: this.locationNumber,
        ...(filters?.startDate && { startDate: filters.startDate }),
        ...(filters?.endDate && { endDate: filters.endDate }),
        ...(filters?.movementType && { movementType: filters.movementType }),
        ...(filters?.limit && { limit: filters.limit.toString() }),
      });

      const response = await fetch(`${this.baseUrl}/movements?${params}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data: data.movements };
    } catch (error) {
      console.error('[NAIT API] Get movements error:', error);
      return { success: false, error: 'Failed to connect to NAIT API' };
    }
  }

  /**
   * Validate NAIT tag format
   */
  validateNaitTag(tag: string): { valid: boolean; error?: string } {
    // NAIT tags are 15 digits: 2-digit country code (64 for NZ) + 13-digit unique ID
    const naitTagRegex = /^64\d{13}$/;
    
    if (!tag) {
      return { valid: false, error: 'NAIT tag is required' };
    }
    
    if (!naitTagRegex.test(tag)) {
      return { valid: false, error: 'Invalid NAIT tag format. Must be 15 digits starting with 64' };
    }
    
    return { valid: true };
  }

  /**
   * Search for a location by number
   */
  async searchLocation(locationNumber: string): Promise<NAITApiResponse<NAITLocation>> {
    if (!this.isConfigured) {
      return this.mockSearchLocation(locationNumber);
    }

    try {
      const response = await fetch(`${this.baseUrl}/locations/${locationNumber}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        return { success: false, error: 'Location not found' };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('[NAIT API] Search location error:', error);
      return { success: false, error: 'Failed to connect to NAIT API' };
    }
  }

  /**
   * Get compliance status
   */
  async getComplianceStatus(): Promise<NAITApiResponse<{
    isCompliant: boolean;
    pendingMovements: number;
    overdueRegistrations: number;
    lastAuditDate?: string;
    issues: { type: string; description: string; dueDate?: string }[];
  }>> {
    if (!this.isConfigured) {
      return this.mockGetComplianceStatus();
    }

    try {
      const response = await fetch(`${this.baseUrl}/compliance/${this.locationNumber}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('[NAIT API] Get compliance status error:', error);
      return { success: false, error: 'Failed to connect to NAIT API' };
    }
  }

  // ============ Mock Data Methods ============

  private mockRegisterAnimal(animal: any): NAITApiResponse<NAITAnimal> {
    return {
      success: true,
      data: {
        naitTag: animal.naitTag,
        visualTag: animal.visualTag,
        species: animal.species,
        birthDate: animal.birthDate,
        sex: animal.sex,
        breed: animal.breed,
        registrationDate: new Date().toISOString(),
        status: 'active',
      },
    };
  }

  private mockRecordMovement(movement: any): NAITApiResponse<NAITMovement> {
    return {
      success: true,
      data: {
        id: `MOV-${Date.now()}`,
        movementType: movement.movementType,
        animalTags: movement.animalTags,
        movementDate: movement.movementDate,
        fromLocation: movement.movementType === 'arrival' ? movement.otherLocationNumber : this.locationNumber || '12345678',
        toLocation: movement.movementType === 'arrival' ? this.locationNumber || '12345678' : movement.otherLocationNumber,
        transporterName: movement.transporterName,
        vehicleRego: movement.vehicleRego,
        status: 'confirmed',
        submittedAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
      },
    };
  }

  private mockRecordDeath(data: any): NAITApiResponse<NAITMovement> {
    return {
      success: true,
      data: {
        id: `DEATH-${Date.now()}`,
        movementType: 'death',
        animalTags: [data.animalTag],
        movementDate: data.deathDate,
        status: 'confirmed',
        submittedAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
      },
    };
  }

  private mockGetAnimals(filters?: any): NAITApiResponse<NAITAnimal[]> {
    const mockAnimals: NAITAnimal[] = [
      { naitTag: '640001234567890', visualTag: 'A001', species: 'cattle', birthDate: '2022-08-15', sex: 'female', breed: 'Friesian', registrationDate: '2022-08-20', status: 'active' },
      { naitTag: '640001234567891', visualTag: 'A002', species: 'cattle', birthDate: '2022-09-01', sex: 'female', breed: 'Jersey', registrationDate: '2022-09-05', status: 'active' },
      { naitTag: '640001234567892', visualTag: 'A003', species: 'cattle', birthDate: '2022-07-20', sex: 'male', breed: 'Friesian', registrationDate: '2022-07-25', status: 'active' },
      { naitTag: '640001234567893', visualTag: 'A004', species: 'cattle', birthDate: '2023-08-10', sex: 'female', breed: 'Crossbred', registrationDate: '2023-08-15', status: 'active' },
      { naitTag: '640001234567894', visualTag: 'A005', species: 'cattle', birthDate: '2023-09-05', sex: 'female', breed: 'Friesian', registrationDate: '2023-09-10', status: 'active' },
    ];

    let filtered = mockAnimals;
    if (filters?.species) {
      filtered = filtered.filter(a => a.species === filters.species);
    }
    if (filters?.status) {
      filtered = filtered.filter(a => a.status === filters.status);
    }

    return { success: true, data: filtered };
  }

  private mockGetMovements(filters?: any): NAITApiResponse<NAITMovement[]> {
    const mockMovements: NAITMovement[] = [
      { id: 'MOV-001', movementType: 'arrival', animalTags: ['640001234567890', '640001234567891'], movementDate: '2024-11-15', fromLocation: '87654321', toLocation: '12345678', status: 'confirmed', submittedAt: '2024-11-15T10:00:00Z', confirmedAt: '2024-11-15T10:05:00Z' },
      { id: 'MOV-002', movementType: 'departure', animalTags: ['640001234567892'], movementDate: '2024-11-20', fromLocation: '12345678', toLocation: '11223344', status: 'confirmed', submittedAt: '2024-11-20T14:00:00Z', confirmedAt: '2024-11-20T14:10:00Z' },
      { id: 'MOV-003', movementType: 'death', animalTags: ['640001234567893'], movementDate: '2024-12-01', status: 'confirmed', submittedAt: '2024-12-01T08:00:00Z', confirmedAt: '2024-12-01T08:05:00Z' },
    ];

    return { success: true, data: mockMovements };
  }

  private mockSearchLocation(locationNumber: string): NAITApiResponse<NAITLocation> {
    const mockLocations: Record<string, NAITLocation> = {
      '12345678': { locationNumber: '12345678', name: 'Demo Farm', address: '123 Farm Road, Waikato', region: 'Waikato', type: 'farm' },
      '87654321': { locationNumber: '87654321', name: 'Neighbor Farm', address: '456 Rural Lane, Waikato', region: 'Waikato', type: 'farm' },
      '11223344': { locationNumber: '11223344', name: 'Waikato Sale Yards', address: '789 Sale Road, Hamilton', region: 'Waikato', type: 'saleyard' },
    };

    const location = mockLocations[locationNumber];
    if (location) {
      return { success: true, data: location };
    }
    return { success: false, error: 'Location not found' };
  }

  private mockGetComplianceStatus(): NAITApiResponse<any> {
    return {
      success: true,
      data: {
        isCompliant: true,
        pendingMovements: 0,
        overdueRegistrations: 0,
        lastAuditDate: '2024-06-15',
        issues: [],
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
  getStatus(): { configured: boolean; locationNumber: string } {
    return {
      configured: this.isConfigured,
      locationNumber: this.locationNumber || 'Not configured',
    };
  }
}

// Export singleton instance
export const naitApiService = new NAITApiService();

// Export types
export type { NAITAnimal, NAITMovement, NAITLocation, NAITApiResponse };
