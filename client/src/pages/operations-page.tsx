import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Wrench,
  UserCheck,
  Car,
  QrCode,
  Users,
  AlertTriangle,
  CheckCircle,
  Calendar,
  TrendingUp,
  Activity,
  FileText,
  Shield,
  Clock,
  MapPin,
  ArrowRight,
  Plus,
  BarChart3
} from 'lucide-react';

interface OperationsStats {
  totalVehicles: number;
  activeVehicles: number;
  vehiclesNeedingInspection: number;
  totalVisitors: number;
  activeVisitors: number;
  todaySignIns: number;
  activeQRCodes: number;
  totalQRCodes: number;
}

export default function OperationsPage() {
  const [location, setLocation] = useLocation();
  const [stats, setStats] = useState<OperationsStats>({
    totalVehicles: 0,
    activeVehicles: 0,
    vehiclesNeedingInspection: 0,
    totalVisitors: 0,
    activeVisitors: 0,
    todaySignIns: 0,
    activeQRCodes: 0,
    totalQRCodes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOperationsStats();
  }, []);

  const fetchOperationsStats = async () => {
    try {
      setLoading(true);
      // Fetch visitor stats
      const visitorResponse = await fetch('/api/visitor/admin/stats');
      const visitorData = await visitorResponse.json();
      
      // Fetch vehicle stats from the actual API
      const vehicleResponse = await fetch('/api/vehicles/stats/overview');
      let vehicleStats = {
        totalVehicles: 0,
        activeVehicles: 0,
        vehiclesNeedingInspection: 0,
      };
      
      if (vehicleResponse.ok) {
        const vehicleData = await vehicleResponse.json();
        vehicleStats = {
          totalVehicles: vehicleData.total || 0,
          activeVehicles: vehicleData.active || 0,
          vehiclesNeedingInspection: vehicleData.needsInspection || 0,
        };
      } else {
        console.warn('Vehicle stats API not available, using zeros');
      }

      // Fetch QR code stats
      const qrResponse = await fetch('/api/visitor/admin/qrcodes');
      const qrData = await qrResponse.json();
      
      setStats({
        totalVehicles: vehicleStats.totalVehicles,
        activeVehicles: vehicleStats.activeVehicles,
        vehiclesNeedingInspection: vehicleStats.vehiclesNeedingInspection,
        totalVisitors: visitorData.stats?.totalVisitors || 0,
        activeVisitors: visitorData.stats?.totalVisitors || 0,
        todaySignIns: visitorData.stats?.todaySignIns || 0,
        activeQRCodes: qrData.qrCodes?.filter((qr: any) => qr.isActive).length || 0,
        totalQRCodes: qrData.qrCodes?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching operations stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const operationCards = [
    {
      title: 'Visitor Management',
      description: 'Manage visitor sign-ins, compliance, and access control',
      icon: UserCheck,
      color: 'bg-green-50 border-green-200',
      iconColor: 'text-green-600',
      stats: {
        active: stats.activeVisitors,
        today: stats.todaySignIns,
        total: stats.totalVisitors,
      },
      actions: [
        { label: 'View Active Visitors', url: '/app/operations/visitors', variant: 'default' as const },
        { label: 'Generate QR Codes', url: '/app/operations/qrcodes', variant: 'outline' as const },
      ],
      alerts: stats.todaySignIns > 0 ? [
        { type: 'info' as const, message: `${stats.todaySignIns} visitors signed in today` }
      ] : [],
    },
    {
      title: 'Vehicle Registry',
      description: 'Track fleet, inspections, and maintenance schedules',
      icon: Car,
      color: 'bg-blue-50 border-blue-200',
      iconColor: 'text-blue-600',
      stats: {
        active: stats.activeVehicles,
        pending: stats.vehiclesNeedingInspection,
        total: stats.totalVehicles,
      },
      actions: [
        { label: 'Manage Vehicles', url: '/app/operations/vehicles', variant: 'default' as const },
        { label: 'Schedule Inspection', url: '/app/operations/vehicles/inspections', variant: 'outline' as const },
      ],
      alerts: stats.vehiclesNeedingInspection > 0 ? [
        { type: 'warning' as const, message: `${stats.vehiclesNeedingInspection} vehicles need inspection` }
      ] : [],
    },
    {
      title: 'QR Code Access',
      description: 'Generate and manage QR codes for visitor access points',
      icon: QrCode,
      color: 'bg-purple-50 border-purple-200',
      iconColor: 'text-purple-600',
      stats: {
        active: stats.activeQRCodes,
        total: stats.totalQRCodes,
      },
      actions: [
        { label: 'Create QR Code', url: '/app/operations/qrcodes', variant: 'default' as const },
        { label: 'View Analytics', url: '/app/operations/qrcodes/analytics', variant: 'outline' as const },
      ],
      alerts: [],
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Wrench className="h-8 w-8 text-green-600" />
            Operations Center
          </h1>
          <p className="text-gray-600 mt-2">
            Manage visitor access, vehicle fleet, and site operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchOperationsStats}>
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setLocation('/app/operations/visitors')}>
            <Plus className="h-4 w-4 mr-2" />
            Quick Actions
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Visitors</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeVisitors}</p>
              </div>
              <Users className="h-8 w-8 text-green-100" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Vehicles</p>
                <p className="text-2xl font-bold text-blue-600">{stats.activeVehicles}</p>
              </div>
              <Car className="h-8 w-8 text-blue-100" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Inspections</p>
                <p className="text-2xl font-bold text-orange-600">{stats.vehiclesNeedingInspection}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-100" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active QR Codes</p>
                <p className="text-2xl font-bold text-purple-600">{stats.activeQRCodes}</p>
              </div>
              <QrCode className="h-8 w-8 text-purple-100" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operation Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {operationCards.map((operation, index) => {
          const Icon = operation.icon;
          
          return (
            <Card key={index} className={`${operation.color} border-2`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-white`}>
                      <Icon className={`h-6 w-6 ${operation.iconColor}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{operation.title}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">{operation.description}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(operation.stats).map(([key, value]) => (
                    <div key={key} className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{value}</p>
                      <p className="text-xs text-gray-600 capitalize">
                        {key === 'active' ? 'Active' : key === 'today' ? "Today's" : key === 'pending' ? 'Pending' : 'Total'}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Alerts */}
                {operation.alerts.length > 0 && (
                  <div className="space-y-2">
                    {operation.alerts.map((alert, alertIndex) => (
                      <div
                        key={alertIndex}
                        className={`p-2 rounded-lg text-xs ${
                          alert.type === 'warning' 
                            ? 'bg-orange-50 text-orange-800 border border-orange-200' 
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {alert.type === 'warning' ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <Calendar className="h-3 w-3" />
                          )}
                          {alert.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2">
                  {operation.actions.map((action, actionIndex) => (
                    <Button
                      key={actionIndex}
                      variant={action.variant}
                      className="w-full justify-start"
                      onClick={() => setLocation(action.url)}
                    >
                      {action.label}
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-600" />
            Recent Operations Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <UserCheck className="h-4 w-4 text-green-600" />
                <div>
                  <p className="font-medium">Visitor Sign-in Completed</p>
                  <p className="text-sm text-gray-600">John Doe - Contractor - Main Entrance</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">2 hours ago</p>
                <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">
                  Completed
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Car className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="font-medium">Vehicle Inspection Scheduled</p>
                  <p className="text-sm text-gray-600">Toyota Hilux - ABC123 - Weekly Safety Check</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">4 hours ago</p>
                <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                  Scheduled
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <QrCode className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="font-medium">QR Code Generated</p>
                  <p className="text-sm text-gray-600">Workshop Access Point - New Location</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">6 hours ago</p>
                <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200">
                  Created
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
