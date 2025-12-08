/**
 * Multi-Farm Management Service for Pulse Farm Management
 * 
 * Enables management of multiple farms from a single account:
 * - Farm portfolio management
 * - Cross-farm analytics and benchmarking
 * - Consolidated reporting
 * - User access control per farm
 * - Data aggregation and comparison
 */

interface Farm {
  id: string;
  name: string;
  code: string; // Short code for quick reference
  type: 'dairy' | 'beef' | 'sheep' | 'mixed' | 'cropping';
  status: 'active' | 'inactive' | 'archived';
  
  // Location
  address: string;
  region: string;
  district: string;
  latitude: number;
  longitude: number;
  
  // Size and capacity
  totalArea: number; // hectares
  effectiveArea: number;
  paddockCount: number;
  
  // Stock
  peakCows?: number;
  currentStock?: number;
  stockingRate?: number;
  
  // Identifiers
  naitLocationNumber?: string;
  fonterraSupplierNumber?: string;
  licHerdNumber?: string;
  
  // Ownership
  ownerId: string;
  ownerName: string;
  managerId?: string;
  managerName?: string;
  
  // Settings
  timezone: string;
  currency: string;
  financialYearStart: number; // Month (1-12)
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt?: Date;
}

interface FarmUser {
  id: string;
  farmId: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: 'owner' | 'manager' | 'staff' | 'contractor' | 'viewer' | 'accountant';
  permissions: string[];
  isActive: boolean;
  invitedAt: Date;
  acceptedAt?: Date;
  lastAccessAt?: Date;
}

interface FarmGroup {
  id: string;
  name: string;
  description?: string;
  farmIds: string[];
  ownerId: string;
  createdAt: Date;
}

interface FarmMetrics {
  farmId: string;
  farmName: string;
  period: string;
  
  // Production
  totalMilkSolids?: number;
  milkSolidsPerCow?: number;
  milkSolidsPerHa?: number;
  
  // Financial
  totalRevenue?: number;
  totalCosts?: number;
  netProfit?: number;
  profitPerHa?: number;
  costPerKgMs?: number;
  
  // Efficiency
  labourEfficiency?: number;
  feedConversion?: number;
  pastureUtilization?: number;
  
  // Health
  sccAverage?: number;
  reproRate?: number;
  emptyRate?: number;
  mortalityRate?: number;
}

interface CrossFarmComparison {
  metric: string;
  unit: string;
  farms: {
    farmId: string;
    farmName: string;
    value: number;
    rank: number;
    percentile: number;
  }[];
  average: number;
  best: number;
  worst: number;
}

interface ConsolidatedReport {
  reportDate: Date;
  period: string;
  farms: Farm[];
  
  // Aggregated totals
  totalArea: number;
  totalStock: number;
  totalMilkSolids: number;
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  
  // Averages
  averageMsPerCow: number;
  averageMsPerHa: number;
  averageProfitPerHa: number;
  
  // Per-farm breakdown
  farmMetrics: FarmMetrics[];
  
  // Comparisons
  comparisons: CrossFarmComparison[];
}

class MultiFarmService {
  private farms: Map<string, Farm> = new Map();
  private farmUsers: Map<string, FarmUser[]> = new Map();
  private farmGroups: Map<string, FarmGroup> = new Map();

  constructor() {
    this.initializeMockData();
    console.log('[Multi-Farm Service] Initialized with mock data');
  }

  /**
   * Initialize mock farms for demo
   */
  private initializeMockData() {
    const mockFarms: Farm[] = [
      {
        id: 'farm-001',
        name: 'Greenfields Dairy',
        code: 'GFD',
        type: 'dairy',
        status: 'active',
        address: '123 Farm Road, Morrinsville',
        region: 'Waikato',
        district: 'Matamata-Piako',
        latitude: -37.6567,
        longitude: 175.5294,
        totalArea: 180,
        effectiveArea: 165,
        paddockCount: 45,
        peakCows: 450,
        currentStock: 420,
        stockingRate: 2.55,
        naitLocationNumber: '12345678',
        fonterraSupplierNumber: 'F001234',
        licHerdNumber: '54321',
        ownerId: 'user-001',
        ownerName: 'John Smith',
        managerId: 'user-002',
        managerName: 'Sarah Johnson',
        timezone: 'Pacific/Auckland',
        currency: 'NZD',
        financialYearStart: 6,
        createdAt: new Date('2020-01-15'),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      },
      {
        id: 'farm-002',
        name: 'Riverside Farm',
        code: 'RSF',
        type: 'dairy',
        status: 'active',
        address: '456 River Lane, Cambridge',
        region: 'Waikato',
        district: 'Waipa',
        latitude: -37.8897,
        longitude: 175.4697,
        totalArea: 220,
        effectiveArea: 200,
        paddockCount: 52,
        peakCows: 520,
        currentStock: 495,
        stockingRate: 2.48,
        naitLocationNumber: '23456789',
        fonterraSupplierNumber: 'F002345',
        licHerdNumber: '65432',
        ownerId: 'user-001',
        ownerName: 'John Smith',
        timezone: 'Pacific/Auckland',
        currency: 'NZD',
        financialYearStart: 6,
        createdAt: new Date('2021-03-20'),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      },
      {
        id: 'farm-003',
        name: 'Hilltop Station',
        code: 'HTS',
        type: 'mixed',
        status: 'active',
        address: '789 Hill Road, Te Awamutu',
        region: 'Waikato',
        district: 'Waipa',
        latitude: -38.0069,
        longitude: 175.3247,
        totalArea: 350,
        effectiveArea: 280,
        paddockCount: 65,
        peakCows: 380,
        currentStock: 350,
        stockingRate: 1.25,
        naitLocationNumber: '34567890',
        fonterraSupplierNumber: 'F003456',
        licHerdNumber: '76543',
        ownerId: 'user-001',
        ownerName: 'John Smith',
        managerId: 'user-003',
        managerName: 'Mike Williams',
        timezone: 'Pacific/Auckland',
        currency: 'NZD',
        financialYearStart: 6,
        createdAt: new Date('2019-08-10'),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      },
      {
        id: 'farm-004',
        name: 'Southland Dairy',
        code: 'SLD',
        type: 'dairy',
        status: 'active',
        address: '321 Plains Road, Invercargill',
        region: 'Southland',
        district: 'Invercargill',
        latitude: -46.4132,
        longitude: 168.3538,
        totalArea: 280,
        effectiveArea: 260,
        paddockCount: 58,
        peakCows: 680,
        currentStock: 650,
        stockingRate: 2.50,
        naitLocationNumber: '45678901',
        fonterraSupplierNumber: 'F004567',
        licHerdNumber: '87654',
        ownerId: 'user-004',
        ownerName: 'David Brown',
        timezone: 'Pacific/Auckland',
        currency: 'NZD',
        financialYearStart: 6,
        createdAt: new Date('2022-01-05'),
        updatedAt: new Date(),
      },
    ];

    mockFarms.forEach(farm => this.farms.set(farm.id, farm));

    // Create a farm group
    this.farmGroups.set('group-001', {
      id: 'group-001',
      name: 'Waikato Operations',
      description: 'All Waikato region farms',
      farmIds: ['farm-001', 'farm-002', 'farm-003'],
      ownerId: 'user-001',
      createdAt: new Date('2021-06-01'),
    });
  }

  // ============ Farm Management ============

  /**
   * Get all farms for a user
   */
  getFarmsForUser(userId: string): Farm[] {
    return Array.from(this.farms.values()).filter(
      farm => farm.ownerId === userId || farm.managerId === userId
    );
  }

  /**
   * Get farm by ID
   */
  getFarm(farmId: string): Farm | undefined {
    return this.farms.get(farmId);
  }

  /**
   * Get all farms
   */
  getAllFarms(): Farm[] {
    return Array.from(this.farms.values());
  }

  /**
   * Create a new farm
   */
  createFarm(farm: Omit<Farm, 'id' | 'createdAt' | 'updatedAt'>): Farm {
    const newFarm: Farm = {
      ...farm,
      id: `farm-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.farms.set(newFarm.id, newFarm);
    return newFarm;
  }

  /**
   * Update a farm
   */
  updateFarm(farmId: string, updates: Partial<Farm>): Farm | null {
    const farm = this.farms.get(farmId);
    if (!farm) return null;

    const updatedFarm = {
      ...farm,
      ...updates,
      id: farmId, // Prevent ID change
      updatedAt: new Date(),
    };
    this.farms.set(farmId, updatedFarm);
    return updatedFarm;
  }

  /**
   * Archive a farm
   */
  archiveFarm(farmId: string): boolean {
    const farm = this.farms.get(farmId);
    if (!farm) return false;

    farm.status = 'archived';
    farm.updatedAt = new Date();
    return true;
  }

  // ============ Farm Groups ============

  /**
   * Get farm groups for a user
   */
  getFarmGroups(userId: string): FarmGroup[] {
    return Array.from(this.farmGroups.values()).filter(g => g.ownerId === userId);
  }

  /**
   * Create a farm group
   */
  createFarmGroup(group: Omit<FarmGroup, 'id' | 'createdAt'>): FarmGroup {
    const newGroup: FarmGroup = {
      ...group,
      id: `group-${Date.now()}`,
      createdAt: new Date(),
    };
    this.farmGroups.set(newGroup.id, newGroup);
    return newGroup;
  }

  /**
   * Get farms in a group
   */
  getFarmsInGroup(groupId: string): Farm[] {
    const group = this.farmGroups.get(groupId);
    if (!group) return [];

    return group.farmIds
      .map(id => this.farms.get(id))
      .filter((f): f is Farm => f !== undefined);
  }

  // ============ Cross-Farm Analytics ============

  /**
   * Get metrics for multiple farms
   */
  async getFarmMetrics(farmIds: string[], period: string = 'current-season'): Promise<FarmMetrics[]> {
    return farmIds.map(farmId => {
      const farm = this.farms.get(farmId);
      if (!farm) return null;

      // Generate mock metrics
      const peakCows = farm.peakCows || 400;
      const effectiveArea = farm.effectiveArea || 150;
      const msPerCow = 380 + Math.random() * 80;
      const totalMs = msPerCow * peakCows;
      const msPerHa = totalMs / effectiveArea;
      const revenue = totalMs * 8.5;
      const costs = revenue * (0.65 + Math.random() * 0.1);

      return {
        farmId,
        farmName: farm.name,
        period,
        totalMilkSolids: Math.round(totalMs),
        milkSolidsPerCow: Math.round(msPerCow),
        milkSolidsPerHa: Math.round(msPerHa),
        totalRevenue: Math.round(revenue),
        totalCosts: Math.round(costs),
        netProfit: Math.round(revenue - costs),
        profitPerHa: Math.round((revenue - costs) / effectiveArea),
        costPerKgMs: Math.round((costs / totalMs) * 100) / 100,
        sccAverage: 120 + Math.floor(Math.random() * 80),
        reproRate: 65 + Math.floor(Math.random() * 15),
        emptyRate: 8 + Math.floor(Math.random() * 6),
        mortalityRate: 1 + Math.random() * 2,
      };
    }).filter((m): m is NonNullable<typeof m> => m !== null) as FarmMetrics[];
  }

  /**
   * Compare farms across a metric
   */
  async compareFarms(farmIds: string[], metrics: string[]): Promise<CrossFarmComparison[]> {
    const farmMetrics = await this.getFarmMetrics(farmIds);
    const comparisons: CrossFarmComparison[] = [];

    const metricConfig: Record<string, { unit: string; key: keyof FarmMetrics }> = {
      'Milk Solids/Cow': { unit: 'kg MS', key: 'milkSolidsPerCow' },
      'Milk Solids/Ha': { unit: 'kg MS', key: 'milkSolidsPerHa' },
      'Profit/Ha': { unit: '$', key: 'profitPerHa' },
      'Cost/kg MS': { unit: '$', key: 'costPerKgMs' },
      'SCC Average': { unit: '000/ml', key: 'sccAverage' },
      'Reproduction Rate': { unit: '%', key: 'reproRate' },
    };

    for (const metric of metrics) {
      const config = metricConfig[metric];
      if (!config) continue;

      const values = farmMetrics
        .map(fm => ({
          farmId: fm.farmId,
          farmName: fm.farmName,
          value: (fm[config.key] as number) || 0,
        }))
        .sort((a, b) => b.value - a.value);

      const total = values.reduce((sum, v) => sum + v.value, 0);
      const avg = total / values.length;

      comparisons.push({
        metric,
        unit: config.unit,
        farms: values.map((v, i) => ({
          ...v,
          rank: i + 1,
          percentile: Math.round(((values.length - i) / values.length) * 100),
        })),
        average: Math.round(avg * 100) / 100,
        best: values[0]?.value || 0,
        worst: values[values.length - 1]?.value || 0,
      });
    }

    return comparisons;
  }

  /**
   * Generate consolidated report
   */
  async generateConsolidatedReport(farmIds: string[], period: string): Promise<ConsolidatedReport> {
    const farms = farmIds
      .map(id => this.farms.get(id))
      .filter((f): f is Farm => f !== undefined);

    const farmMetrics = await this.getFarmMetrics(farmIds, period);
    const comparisons = await this.compareFarms(farmIds, [
      'Milk Solids/Cow',
      'Milk Solids/Ha',
      'Profit/Ha',
      'Cost/kg MS',
      'SCC Average',
      'Reproduction Rate',
    ]);

    // Calculate totals
    const totalArea = farms.reduce((sum, f) => sum + f.effectiveArea, 0);
    const totalStock = farms.reduce((sum, f) => sum + (f.currentStock || 0), 0);
    const totalMs = farmMetrics.reduce((sum, m) => sum + (m.totalMilkSolids || 0), 0);
    const totalRevenue = farmMetrics.reduce((sum, m) => sum + (m.totalRevenue || 0), 0);
    const totalCosts = farmMetrics.reduce((sum, m) => sum + (m.totalCosts || 0), 0);

    return {
      reportDate: new Date(),
      period,
      farms,
      totalArea,
      totalStock,
      totalMilkSolids: totalMs,
      totalRevenue,
      totalCosts,
      totalProfit: totalRevenue - totalCosts,
      averageMsPerCow: Math.round(totalMs / totalStock),
      averageMsPerHa: Math.round(totalMs / totalArea),
      averageProfitPerHa: Math.round((totalRevenue - totalCosts) / totalArea),
      farmMetrics,
      comparisons,
    };
  }

  // ============ User Access Management ============

  /**
   * Get users for a farm
   */
  getFarmUsers(farmId: string): FarmUser[] {
    return this.farmUsers.get(farmId) || [];
  }

  /**
   * Add user to farm
   */
  addUserToFarm(farmUser: Omit<FarmUser, 'id' | 'invitedAt'>): FarmUser {
    const newUser: FarmUser = {
      ...farmUser,
      id: `fu-${Date.now()}`,
      invitedAt: new Date(),
    };

    const users = this.farmUsers.get(farmUser.farmId) || [];
    users.push(newUser);
    this.farmUsers.set(farmUser.farmId, users);

    return newUser;
  }

  /**
   * Update user role
   */
  updateUserRole(farmId: string, userId: string, role: FarmUser['role']): boolean {
    const users = this.farmUsers.get(farmId);
    if (!users) return false;

    const user = users.find(u => u.userId === userId);
    if (!user) return false;

    user.role = role;
    return true;
  }

  /**
   * Remove user from farm
   */
  removeUserFromFarm(farmId: string, userId: string): boolean {
    const users = this.farmUsers.get(farmId);
    if (!users) return false;

    const index = users.findIndex(u => u.userId === userId);
    if (index === -1) return false;

    users.splice(index, 1);
    return true;
  }

  /**
   * Check user permission
   */
  hasPermission(farmId: string, userId: string, permission: string): boolean {
    const users = this.farmUsers.get(farmId);
    if (!users) return false;

    const user = users.find(u => u.userId === userId);
    if (!user || !user.isActive) return false;

    // Owner and manager have all permissions
    if (user.role === 'owner' || user.role === 'manager') return true;

    return user.permissions.includes(permission);
  }

  // ============ Dashboard Data ============

  /**
   * Get portfolio dashboard data
   */
  async getPortfolioDashboard(userId: string): Promise<{
    farms: Farm[];
    totalArea: number;
    totalStock: number;
    farmsByRegion: Record<string, number>;
    recentActivity: { farmId: string; farmName: string; action: string; timestamp: Date }[];
    alerts: { farmId: string; farmName: string; type: string; message: string }[];
    performanceSummary: FarmMetrics[];
  }> {
    const farms = this.getFarmsForUser(userId);
    const farmIds = farms.map(f => f.id);
    const metrics = await this.getFarmMetrics(farmIds);

    const farmsByRegion: Record<string, number> = {};
    farms.forEach(f => {
      farmsByRegion[f.region] = (farmsByRegion[f.region] || 0) + 1;
    });

    return {
      farms,
      totalArea: farms.reduce((sum, f) => sum + f.totalArea, 0),
      totalStock: farms.reduce((sum, f) => sum + (f.currentStock || 0), 0),
      farmsByRegion,
      recentActivity: [
        { farmId: 'farm-001', farmName: 'Greenfields Dairy', action: 'Herd test completed', timestamp: new Date() },
        { farmId: 'farm-002', farmName: 'Riverside Farm', action: 'Milk pickup recorded', timestamp: new Date(Date.now() - 3600000) },
        { farmId: 'farm-003', farmName: 'Hilltop Station', action: 'Treatment recorded', timestamp: new Date(Date.now() - 7200000) },
      ],
      alerts: [
        { farmId: 'farm-001', farmName: 'Greenfields Dairy', type: 'warning', message: 'SCC trending up - 3 cows above 400k' },
        { farmId: 'farm-002', farmName: 'Riverside Farm', type: 'info', message: 'Vaccination due in 7 days' },
      ],
      performanceSummary: metrics,
    };
  }
}

// Export singleton instance
export const multiFarmService = new MultiFarmService();

// Export types
export type {
  Farm,
  FarmUser,
  FarmGroup,
  FarmMetrics,
  CrossFarmComparison,
  ConsolidatedReport,
};
