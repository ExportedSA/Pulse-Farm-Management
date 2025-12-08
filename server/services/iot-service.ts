/**
 * IoT Integration Service for Pulse Farm Management
 * 
 * Integrates with various IoT devices and platforms:
 * - Milk meters (Waikato Milking, DeLaval, Lely)
 * - EID readers (Gallagher, Tru-Test, Allflex)
 * - Weather stations (Davis, Harvest)
 * - Soil sensors (Wildeye, CropX)
 * - Water meters
 * - Electric fence monitors
 * - GPS collars (Halter, eShepherd)
 * 
 * Supports MQTT, REST API, and webhook integrations
 */

interface IoTDevice {
  id: string;
  name: string;
  type: DeviceType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareVersion?: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  lastSeen: Date;
  batteryLevel?: number;
  signalStrength?: number;
  location?: { latitude: number; longitude: number; paddockId?: string };
  config: Record<string, any>;
  metadata: Record<string, any>;
}

type DeviceType = 
  | 'milk_meter'
  | 'eid_reader'
  | 'weather_station'
  | 'soil_sensor'
  | 'water_meter'
  | 'fence_monitor'
  | 'gps_collar'
  | 'camera'
  | 'scale'
  | 'vat_sensor'
  | 'effluent_sensor'
  | 'gate_sensor';

interface MilkMeterReading {
  deviceId: string;
  timestamp: Date;
  animalId?: string;
  eidTag?: string;
  milkYield: number; // litres
  milkingDuration: number; // seconds
  flowRate: number; // litres/min
  conductivity?: number;
  bloodDetected?: boolean;
  kickoffs?: number;
  incomplete?: boolean;
}

interface EIDReading {
  deviceId: string;
  timestamp: Date;
  eidTag: string;
  readType: 'entry' | 'exit' | 'scan' | 'weigh';
  location?: string;
  weight?: number;
  animalId?: string;
}

interface WeatherReading {
  deviceId: string;
  timestamp: Date;
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  windDirection: number;
  pressure: number;
  solarRadiation?: number;
  soilTemperature?: number;
  leafWetness?: number;
}

interface SoilReading {
  deviceId: string;
  timestamp: Date;
  paddockId?: string;
  depth: number; // cm
  moisture: number; // %
  temperature: number;
  ec?: number; // electrical conductivity
  ph?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
}

interface WaterReading {
  deviceId: string;
  timestamp: Date;
  flowRate: number; // litres/min
  totalVolume: number; // litres
  pressure?: number;
  troughId?: string;
  paddockId?: string;
}

interface FenceReading {
  deviceId: string;
  timestamp: Date;
  voltage: number; // kV
  current: number; // mA
  faultDetected: boolean;
  faultLocation?: number; // meters from energizer
  paddockId?: string;
}

interface GPSCollarReading {
  deviceId: string;
  timestamp: Date;
  animalId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  activity?: 'grazing' | 'walking' | 'resting' | 'ruminating';
  temperature?: number;
  heartRate?: number;
  batteryLevel: number;
}

interface VatReading {
  deviceId: string;
  timestamp: Date;
  vatId: string;
  volume: number; // litres
  temperature: number;
  agitatorRunning: boolean;
  coolingActive: boolean;
  lastPickup?: Date;
}

interface IoTAlert {
  id: string;
  deviceId: string;
  deviceName: string;
  type: 'warning' | 'error' | 'critical';
  category: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

class IoTService {
  private devices: Map<string, IoTDevice> = new Map();
  private alerts: IoTAlert[] = [];
  private mqttConnected: boolean = false;
  private webhookEndpoints: Map<string, string> = new Map();

  constructor() {
    this.initializeMockDevices();
    console.log('[IoT Service] Initialized with mock devices');
  }

  /**
   * Initialize mock devices for demo
   */
  private initializeMockDevices() {
    const mockDevices: IoTDevice[] = [
      {
        id: 'mm-001',
        name: 'Milking Shed Meter 1',
        type: 'milk_meter',
        manufacturer: 'Waikato Milking',
        model: 'WM-500',
        serialNumber: 'WM500-2024-001',
        firmwareVersion: '2.4.1',
        status: 'online',
        lastSeen: new Date(),
        location: { latitude: -37.786, longitude: 175.277 },
        config: { autoId: true, conductivityAlert: 8.5 },
        metadata: { installDate: '2023-06-15', lastService: '2024-09-01' },
      },
      {
        id: 'eid-001',
        name: 'Race EID Reader',
        type: 'eid_reader',
        manufacturer: 'Gallagher',
        model: 'HR5',
        serialNumber: 'GAL-HR5-2024-001',
        firmwareVersion: '3.1.0',
        status: 'online',
        lastSeen: new Date(),
        location: { latitude: -37.786, longitude: 175.277 },
        config: { readMode: 'continuous', beepOnRead: true },
        metadata: { installDate: '2023-08-20' },
      },
      {
        id: 'ws-001',
        name: 'Main Weather Station',
        type: 'weather_station',
        manufacturer: 'Davis',
        model: 'Vantage Pro2',
        serialNumber: 'DVP2-2024-001',
        firmwareVersion: '1.2.3',
        status: 'online',
        lastSeen: new Date(),
        batteryLevel: 85,
        signalStrength: 92,
        location: { latitude: -37.785, longitude: 175.280 },
        config: { reportInterval: 300, units: 'metric' },
        metadata: { installDate: '2022-11-10' },
      },
      {
        id: 'soil-001',
        name: 'North Block Soil Sensor',
        type: 'soil_sensor',
        manufacturer: 'Wildeye',
        model: 'SM-100',
        serialNumber: 'WE-SM100-001',
        status: 'online',
        lastSeen: new Date(),
        batteryLevel: 72,
        signalStrength: 78,
        location: { latitude: -37.784, longitude: 175.278, paddockId: 'p1' },
        config: { depth: 30, reportInterval: 3600 },
        metadata: {},
      },
      {
        id: 'soil-002',
        name: 'South Block Soil Sensor',
        type: 'soil_sensor',
        manufacturer: 'Wildeye',
        model: 'SM-100',
        serialNumber: 'WE-SM100-002',
        status: 'online',
        lastSeen: new Date(),
        batteryLevel: 65,
        signalStrength: 71,
        location: { latitude: -37.789, longitude: 175.279, paddockId: 'p3' },
        config: { depth: 30, reportInterval: 3600 },
        metadata: {},
      },
      {
        id: 'water-001',
        name: 'Main Water Meter',
        type: 'water_meter',
        manufacturer: 'Harvest',
        model: 'FlowMaster 200',
        serialNumber: 'HFM-200-001',
        status: 'online',
        lastSeen: new Date(),
        batteryLevel: 90,
        location: { latitude: -37.786, longitude: 175.276 },
        config: { alertThreshold: 1000 },
        metadata: {},
      },
      {
        id: 'fence-001',
        name: 'Main Energizer Monitor',
        type: 'fence_monitor',
        manufacturer: 'Gallagher',
        model: 'i Series',
        serialNumber: 'GAL-IS-001',
        status: 'online',
        lastSeen: new Date(),
        location: { latitude: -37.786, longitude: 175.275 },
        config: { minVoltage: 4.0, alertOnFault: true },
        metadata: {},
      },
      {
        id: 'gps-001',
        name: 'Halter Collar - A001',
        type: 'gps_collar',
        manufacturer: 'Halter',
        model: 'Halter Pro',
        serialNumber: 'HAL-2024-001',
        status: 'online',
        lastSeen: new Date(),
        batteryLevel: 78,
        signalStrength: 85,
        location: { latitude: -37.784, longitude: 175.277 },
        config: { animalId: 'A001', virtualFencing: true },
        metadata: { assignedDate: '2024-08-01' },
      },
      {
        id: 'vat-001',
        name: 'Milk Vat Sensor',
        type: 'vat_sensor',
        manufacturer: 'DeLaval',
        model: 'DXCE',
        serialNumber: 'DL-DXCE-001',
        status: 'online',
        lastSeen: new Date(),
        location: { latitude: -37.786, longitude: 175.277 },
        config: { capacity: 12000, targetTemp: 4 },
        metadata: {},
      },
      {
        id: 'scale-001',
        name: 'Race Weigh Scale',
        type: 'scale',
        manufacturer: 'Tru-Test',
        model: 'XR5000',
        serialNumber: 'TT-XR5000-001',
        status: 'online',
        lastSeen: new Date(),
        location: { latitude: -37.786, longitude: 175.277 },
        config: { autoRecord: true, eidLinked: true },
        metadata: {},
      },
    ];

    mockDevices.forEach(device => this.devices.set(device.id, device));
  }

  // ============ Device Management ============

  /**
   * Get all registered devices
   */
  getDevices(type?: DeviceType): IoTDevice[] {
    const devices = Array.from(this.devices.values());
    return type ? devices.filter(d => d.type === type) : devices;
  }

  /**
   * Get device by ID
   */
  getDevice(deviceId: string): IoTDevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Register a new device
   */
  registerDevice(device: Omit<IoTDevice, 'id' | 'status' | 'lastSeen'>): IoTDevice {
    const newDevice: IoTDevice = {
      ...device,
      id: `${device.type}-${Date.now()}`,
      status: 'offline',
      lastSeen: new Date(),
    };
    this.devices.set(newDevice.id, newDevice);
    return newDevice;
  }

  /**
   * Update device status
   */
  updateDeviceStatus(deviceId: string, status: IoTDevice['status']): boolean {
    const device = this.devices.get(deviceId);
    if (device) {
      device.status = status;
      device.lastSeen = new Date();
      return true;
    }
    return false;
  }

  /**
   * Remove a device
   */
  removeDevice(deviceId: string): boolean {
    return this.devices.delete(deviceId);
  }

  // ============ Data Retrieval (Mock) ============

  /**
   * Get latest milk meter readings
   */
  async getMilkMeterReadings(deviceId?: string, limit: number = 100): Promise<MilkMeterReading[]> {
    const readings: MilkMeterReading[] = [];
    const now = new Date();

    for (let i = 0; i < Math.min(limit, 50); i++) {
      readings.push({
        deviceId: deviceId || 'mm-001',
        timestamp: new Date(now.getTime() - i * 2 * 60 * 1000), // Every 2 mins
        animalId: `A${String(Math.floor(Math.random() * 300) + 1).padStart(3, '0')}`,
        eidTag: `6400012345${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`,
        milkYield: 8 + Math.random() * 12,
        milkingDuration: 300 + Math.random() * 300,
        flowRate: 2 + Math.random() * 2,
        conductivity: 4 + Math.random() * 2,
        bloodDetected: Math.random() > 0.98,
        kickoffs: Math.random() > 0.9 ? Math.floor(Math.random() * 3) : 0,
        incomplete: Math.random() > 0.95,
      });
    }

    return readings;
  }

  /**
   * Get EID readings
   */
  async getEIDReadings(deviceId?: string, limit: number = 100): Promise<EIDReading[]> {
    const readings: EIDReading[] = [];
    const now = new Date();

    for (let i = 0; i < Math.min(limit, 50); i++) {
      readings.push({
        deviceId: deviceId || 'eid-001',
        timestamp: new Date(now.getTime() - i * 30 * 1000),
        eidTag: `6400012345${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`,
        readType: ['entry', 'exit', 'scan', 'weigh'][Math.floor(Math.random() * 4)] as any,
        location: 'Race',
        weight: Math.random() > 0.7 ? 450 + Math.random() * 150 : undefined,
      });
    }

    return readings;
  }

  /**
   * Get weather station readings
   */
  async getWeatherReadings(deviceId?: string, hours: number = 24): Promise<WeatherReading[]> {
    const readings: WeatherReading[] = [];
    const now = new Date();

    for (let i = 0; i < hours; i++) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourOfDay = hour.getHours();
      const tempBase = 12 + Math.sin((hourOfDay - 6) * Math.PI / 12) * 8;

      readings.push({
        deviceId: deviceId || 'ws-001',
        timestamp: hour,
        temperature: tempBase + Math.random() * 2,
        humidity: 60 + Math.random() * 30,
        rainfall: Math.random() > 0.8 ? Math.random() * 5 : 0,
        windSpeed: 5 + Math.random() * 20,
        windDirection: Math.floor(Math.random() * 360),
        pressure: 1010 + Math.random() * 20,
        solarRadiation: hourOfDay >= 6 && hourOfDay <= 20 ? Math.random() * 800 : 0,
        soilTemperature: 14 + Math.random() * 4,
        leafWetness: Math.random() > 0.7 ? Math.random() * 100 : 0,
      });
    }

    return readings;
  }

  /**
   * Get soil sensor readings
   */
  async getSoilReadings(deviceId?: string, days: number = 7): Promise<SoilReading[]> {
    const readings: SoilReading[] = [];
    const now = new Date();
    const device = deviceId ? this.devices.get(deviceId) : null;

    for (let i = 0; i < days * 24; i++) {
      readings.push({
        deviceId: deviceId || 'soil-001',
        timestamp: new Date(now.getTime() - i * 60 * 60 * 1000),
        paddockId: device?.location?.paddockId || 'p1',
        depth: 30,
        moisture: 25 + Math.random() * 20,
        temperature: 14 + Math.random() * 4,
        ec: 0.2 + Math.random() * 0.3,
      });
    }

    return readings;
  }

  /**
   * Get water meter readings
   */
  async getWaterReadings(deviceId?: string, days: number = 7): Promise<WaterReading[]> {
    const readings: WaterReading[] = [];
    const now = new Date();
    let totalVolume = 0;

    for (let i = days * 24 - 1; i >= 0; i--) {
      const flowRate = 50 + Math.random() * 100;
      totalVolume += flowRate * 60; // litres per hour

      readings.push({
        deviceId: deviceId || 'water-001',
        timestamp: new Date(now.getTime() - i * 60 * 60 * 1000),
        flowRate,
        totalVolume,
        pressure: 300 + Math.random() * 100,
      });
    }

    return readings.reverse();
  }

  /**
   * Get fence monitor readings
   */
  async getFenceReadings(deviceId?: string, hours: number = 24): Promise<FenceReading[]> {
    const readings: FenceReading[] = [];
    const now = new Date();

    for (let i = 0; i < hours; i++) {
      const hasFault = Math.random() > 0.95;
      readings.push({
        deviceId: deviceId || 'fence-001',
        timestamp: new Date(now.getTime() - i * 60 * 60 * 1000),
        voltage: hasFault ? 2 + Math.random() * 2 : 6 + Math.random() * 2,
        current: 100 + Math.random() * 50,
        faultDetected: hasFault,
        faultLocation: hasFault ? Math.floor(Math.random() * 5000) : undefined,
      });
    }

    return readings;
  }

  /**
   * Get GPS collar readings
   */
  async getGPSCollarReadings(deviceId?: string, hours: number = 24): Promise<GPSCollarReading[]> {
    const readings: GPSCollarReading[] = [];
    const now = new Date();
    const device = deviceId ? this.devices.get(deviceId) : null;
    let lat = device?.location?.latitude || -37.784;
    let lon = device?.location?.longitude || 175.277;

    for (let i = 0; i < hours * 6; i++) { // Every 10 mins
      // Simulate movement
      lat += (Math.random() - 0.5) * 0.001;
      lon += (Math.random() - 0.5) * 0.001;

      readings.push({
        deviceId: deviceId || 'gps-001',
        timestamp: new Date(now.getTime() - i * 10 * 60 * 1000),
        animalId: device?.config?.animalId || 'A001',
        latitude: lat,
        longitude: lon,
        speed: Math.random() * 3,
        activity: ['grazing', 'walking', 'resting', 'ruminating'][Math.floor(Math.random() * 4)] as any,
        batteryLevel: 78 - Math.floor(i / 10),
      });
    }

    return readings;
  }

  /**
   * Get vat sensor readings
   */
  async getVatReadings(deviceId?: string, hours: number = 48): Promise<VatReading[]> {
    const readings: VatReading[] = [];
    const now = new Date();
    let volume = 0;

    for (let i = hours - 1; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourOfDay = hour.getHours();

      // Simulate milking times (6am and 3pm)
      if (hourOfDay === 6 || hourOfDay === 7) {
        volume += 1500 + Math.random() * 500;
      } else if (hourOfDay === 15 || hourOfDay === 16) {
        volume += 1200 + Math.random() * 400;
      }

      // Simulate pickup (every 2 days at 8am)
      if (hourOfDay === 8 && Math.random() > 0.5) {
        volume = 0;
      }

      readings.push({
        deviceId: deviceId || 'vat-001',
        timestamp: hour,
        vatId: 'VAT-001',
        volume: Math.min(volume, 12000),
        temperature: 4 + Math.random() * 0.5,
        agitatorRunning: volume > 500,
        coolingActive: volume > 100,
        lastPickup: volume === 0 ? hour : undefined,
      });
    }

    return readings;
  }

  // ============ Alerts ============

  /**
   * Get active alerts
   */
  getAlerts(acknowledged?: boolean): IoTAlert[] {
    if (acknowledged === undefined) return this.alerts;
    return this.alerts.filter(a => a.acknowledged === acknowledged);
  }

  /**
   * Create an alert
   */
  createAlert(alert: Omit<IoTAlert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>): IoTAlert {
    const newAlert: IoTAlert = {
      ...alert,
      id: `alert-${Date.now()}`,
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
    };
    this.alerts.unshift(newAlert);
    return newAlert;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, userId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      return true;
    }
    return false;
  }

  // ============ Device Statistics ============

  /**
   * Get device statistics summary
   */
  getDeviceStats(): {
    total: number;
    online: number;
    offline: number;
    error: number;
    byType: Record<string, number>;
    lowBattery: number;
    weakSignal: number;
  } {
    const devices = Array.from(this.devices.values());
    const byType: Record<string, number> = {};

    devices.forEach(d => {
      byType[d.type] = (byType[d.type] || 0) + 1;
    });

    return {
      total: devices.length,
      online: devices.filter(d => d.status === 'online').length,
      offline: devices.filter(d => d.status === 'offline').length,
      error: devices.filter(d => d.status === 'error').length,
      byType,
      lowBattery: devices.filter(d => d.batteryLevel !== undefined && d.batteryLevel < 20).length,
      weakSignal: devices.filter(d => d.signalStrength !== undefined && d.signalStrength < 30).length,
    };
  }

  /**
   * Get dashboard summary data
   */
  async getDashboardData(): Promise<{
    devices: {
      total: number;
      online: number;
      offline: number;
      error: number;
      byType: Record<string, number>;
      lowBattery: number;
      weakSignal: number;
    };
    latestReadings: {
      weather?: WeatherReading;
      vat?: VatReading;
      milkToday?: { total: number; cows: number };
    };
    alerts: IoTAlert[];
  }> {
    const weatherReadings = await this.getWeatherReadings(undefined, 1);
    const vatReadings = await this.getVatReadings(undefined, 1);
    const milkReadings = await this.getMilkMeterReadings(undefined, 300);

    const today = new Date().toDateString();
    const todayMilk = milkReadings.filter(r => r.timestamp.toDateString() === today);

    return {
      devices: this.getDeviceStats(),
      latestReadings: {
        weather: weatherReadings[0],
        vat: vatReadings[vatReadings.length - 1],
        milkToday: {
          total: todayMilk.reduce((sum, r) => sum + r.milkYield, 0),
          cows: todayMilk.length,
        },
      },
      alerts: this.alerts.filter(a => !a.resolved).slice(0, 10),
    };
  }
}

// Export singleton instance
export const iotService = new IoTService();

// Export types
export type {
  IoTDevice,
  DeviceType,
  MilkMeterReading,
  EIDReading,
  WeatherReading,
  SoilReading,
  WaterReading,
  FenceReading,
  GPSCollarReading,
  VatReading,
  IoTAlert,
};
