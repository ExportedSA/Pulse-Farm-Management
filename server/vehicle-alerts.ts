import { storage } from './storage';
import { alerts, users } from '@shared/schema';

interface VehicleAlertConfig {
  daysBefore: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
}

export class VehicleAlertService {
  private static alertConfigs: Record<string, VehicleAlertConfig> = {
    // Service alerts
    vehicle_service_overdue: {
      daysBefore: 0,
      severity: 'high',
      title: 'Vehicle Service Overdue',
      message: 'Vehicle service is overdue and requires immediate attention',
    },
    vehicle_service_due: {
      daysBefore: 7,
      severity: 'medium',
      title: 'Vehicle Service Due Soon',
      message: 'Vehicle service is due within 7 days',
    },
    
    // WOF alerts
    vehicle_wof_expired: {
      daysBefore: 0,
      severity: 'critical',
      title: 'WOF Expired',
      message: 'Warrant of Fitness has expired - vehicle cannot be used',
    },
    vehicle_wof_expiring: {
      daysBefore: 14,
      severity: 'high',
      title: 'WOF Expiring Soon',
      message: 'Warrant of Fitness expires within 14 days',
    },
    
    // COF alerts
    vehicle_cof_expired: {
      daysBefore: 0,
      severity: 'critical',
      title: 'COF Expired',
      message: 'Certificate of Fitness has expired - vehicle cannot be used',
    },
    vehicle_cof_expiring: {
      daysBefore: 14,
      severity: 'high',
      title: 'COF Expiring Soon',
      message: 'Certificate of Fitness expires within 14 days',
    },
    
    // Registration alerts
    vehicle_registration_expired: {
      daysBefore: 0,
      severity: 'critical',
      title: 'Registration Expired',
      message: 'Vehicle registration has expired - illegal to operate',
    },
    vehicle_registration_expiring: {
      daysBefore: 30,
      severity: 'high',
      title: 'Registration Expiring Soon',
      message: 'Vehicle registration expires within 30 days',
    },
    
    // RUC alerts
    vehicle_ruc_expired: {
      daysBefore: 0,
      severity: 'high',
      title: 'RUC Expired',
      message: 'Road User Charges have expired - update required',
    },
    vehicle_ruc_expiring: {
      daysBefore: 7,
      severity: 'medium',
      title: 'RUC Expiring Soon',
      message: 'Road User Charges expire within 7 days',
    },
    
    // Insurance alerts
    vehicle_insurance_expired: {
      daysBefore: 0,
      severity: 'critical',
      title: 'Insurance Expired',
      message: 'Vehicle insurance has expired - no coverage',
    },
    vehicle_insurance_expiring: {
      daysBefore: 30,
      severity: 'high',
      title: 'Insurance Expiring Soon',
      message: 'Vehicle insurance expires within 30 days',
    },
  };

  /**
   * Generate alerts for all vehicles based on compliance dates
   */
  static async generateVehicleAlerts(): Promise<void> {
    try {
      console.log('Starting vehicle compliance alert generation...');
      
      // Get all active vehicles
      const vehicles = await storage.getVehicles({ status: 'active' });
      
      for (const vehicle of vehicles) {
        await this.checkVehicleCompliance(vehicle);
      }
      
      console.log(`Vehicle alert generation completed for ${vehicles.length} vehicles`);
    } catch (error) {
      console.error('Error generating vehicle alerts:', error);
      throw error;
    }
  }

  /**
   * Check compliance for a single vehicle and create alerts as needed
   */
  private static async checkVehicleCompliance(vehicle: any): Promise<void> {
    const today = new Date();
    const checks = [
      { field: 'nextServiceDue', typePrefix: 'vehicle_service' },
      { field: 'wofExpiry', typePrefix: 'vehicle_wof' },
      { field: 'cofExpiry', typePrefix: 'vehicle_cof' },
      { field: 'registrationExpiry', typePrefix: 'vehicle_registration' },
      { field: 'rucExpiry', typePrefix: 'vehicle_ruc' },
      { field: 'insuranceExpiry', typePrefix: 'vehicle_insurance' },
    ];

    for (const check of checks) {
      const expiryDate = vehicle[check.field];
      if (!expiryDate) continue;

      await this.checkDateAlert(vehicle, expiryDate, check.typePrefix);
    }
  }

  /**
   * Check a specific date and create appropriate alerts
   */
  private static async checkDateAlert(
    vehicle: any, 
    expiryDate: string, 
    typePrefix: string
  ): Promise<void> {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Determine alert type based on days until expiry
    let alertType: string;
    if (daysUntil < 0) {
      alertType = `${typePrefix}_expired`;
    } else if (daysUntil <= this.getWarningThreshold(typePrefix)) {
      alertType = `${typePrefix}_expiring`;
    } else {
      return; // No alert needed
    }

    const config = this.alertConfigs[alertType];
    if (!config) return;

    // Check if alert already exists
    const existingAlerts = await storage.getAlerts({
      vehicleId: vehicle.id,
      type: alertType,
    });

    const hasActiveAlert = existingAlerts.some((alert: any) => !alert.dismissedAt);
    if (hasActiveAlert) return; // Alert already exists

    // Create new alert
    await storage.createAlert({
      type: alertType as any,
      severity: config.severity as any,
      vehicleId: vehicle.id,
      title: `${config.title}: ${vehicle.registration}`,
      message: `${config.message}. Vehicle: ${vehicle.make} ${vehicle.model} (${vehicle.registration})`,
      metadata: {
        vehicleId: vehicle.id,
        registration: vehicle.registration,
        make: vehicle.make,
        model: vehicle.model,
        expiryDate: expiryDate,
        daysUntil,
        alertType,
      },
    });
  }

  /**
   * Get warning threshold for different alert types
   */
  private static getWarningThreshold(typePrefix: string): number {
    switch (typePrefix) {
      case 'vehicle_service':
        return 7;
      case 'vehicle_wof':
      case 'vehicle_cof':
        return 14;
      case 'vehicle_registration':
      case 'vehicle_insurance':
        return 30;
      case 'vehicle_ruc':
        return 7;
      default:
        return 7;
    }
  }

  /**
   * Get real-time compliance status for a vehicle
   */
  static async getVehicleComplianceStatus(vehicleId: string): Promise<{
    status: 'compliant' | 'warning' | 'critical';
    alerts: Array<{
      type: string;
      severity: string;
      title: string;
      message: string;
      daysUntil: number;
    }>;
  }> {
    try {
      const vehicle = await storage.getVehicleById(vehicleId);
      if (!vehicle) {
        throw new Error('Vehicle not found');
      }

      const today = new Date();
      const alerts: any[] = [];
      let overallStatus: 'compliant' | 'warning' | 'critical' = 'compliant';

      const checks = [
        { field: 'nextServiceDue', label: 'Service', typePrefix: 'vehicle_service' },
        { field: 'wofExpiry', label: 'WOF', typePrefix: 'vehicle_wof' },
        { field: 'cofExpiry', label: 'COF', typePrefix: 'vehicle_cof' },
        { field: 'registrationExpiry', label: 'Registration', typePrefix: 'vehicle_registration' },
        { field: 'rucExpiry', label: 'RUC', typePrefix: 'vehicle_ruc' },
        { field: 'insuranceExpiry', label: 'Insurance', typePrefix: 'vehicle_insurance' },
      ];

      for (const check of checks) {
        const expiryDate = vehicle[check.field];
        if (!expiryDate) continue;

        const expiry = new Date(expiryDate);
        const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let alertType: string;
        let severity: string;
        let status: 'compliant' | 'warning' | 'critical';

        if (daysUntil < 0) {
          alertType = `${check.typePrefix}_expired`;
          severity = 'critical';
          status = 'critical';
        } else if (daysUntil <= this.getWarningThreshold(check.typePrefix)) {
          alertType = `${check.typePrefix}_expiring`;
          severity = daysUntil <= 7 ? 'high' : 'medium';
          status = 'warning';
        } else {
          continue; // No alert needed
        }

        const config = this.alertConfigs[alertType];
        if (!config) continue;

        alerts.push({
          type: alertType,
          severity,
          title: `${check.label} ${daysUntil < 0 ? 'Expired' : 'Expiring Soon'}`,
          message: config.message,
          daysUntil,
        });

        if (status === 'critical' || overallStatus === 'compliant') {
          overallStatus = status;
        }
      }

      return {
        status: overallStatus,
        alerts,
      };
    } catch (error) {
      console.error('Error getting vehicle compliance status:', error);
      throw error;
    }
  }

  /**
   * Get upcoming compliance items for all vehicles
   */
  static async getUpcomingComplianceItems(days: number = 30): Promise<{
    vehicle: any;
    items: Array<{
      type: string;
      label: string;
      expiryDate: string;
      daysUntil: number;
      severity: string;
    }>;
  }[]> {
    try {
      const vehicles = await storage.getVehicles({ status: 'active' });
      const today = new Date();
      const cutoffDate = new Date(today.getTime() + (days * 24 * 60 * 60 * 1000));

      const results: any[] = [];

      for (const vehicle of vehicles) {
        const items: any[] = [];
        
        const checks = [
          { field: 'nextServiceDue', label: 'Service' },
          { field: 'wofExpiry', label: 'WOF' },
          { field: 'cofExpiry', label: 'COF' },
          { field: 'registrationExpiry', label: 'Registration' },
          { field: 'rucExpiry', label: 'RUC' },
          { field: 'insuranceExpiry', label: 'Insurance' },
        ];

        for (const check of checks) {
          const expiryDate = vehicle[check.field];
          if (!expiryDate) continue;

          const expiry = new Date(expiryDate);
          if (expiry <= cutoffDate && expiry >= today) {
            const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            let severity: string;
            if (daysUntil <= 7) {
              severity = 'high';
            } else if (daysUntil <= 14) {
              severity = 'medium';
            } else {
              severity = 'low';
            }

            items.push({
              type: check.field,
              label: check.label,
              expiryDate,
              daysUntil,
              severity,
            });
          }
        }

        if (items.length > 0) {
          results.push({
            vehicle,
            items: items.sort((a, b) => a.daysUntil - b.daysUntil),
          });
        }
      }

      return results.sort((a, b) => {
        const aMinDays = Math.min(...a.items.map((item: any) => item.daysUntil));
        const bMinDays = Math.min(...b.items.map((item: any) => item.daysUntil));
        return aMinDays - bMinDays;
      });
    } catch (error) {
      console.error('Error getting upcoming compliance items:', error);
      throw error;
    }
  }
}
