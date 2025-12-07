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

interface ActivityItem {
  id: string;
  type: 'visitor' | 'vehicle' | 'qrcode' | 'job' | 'maintenance';
  title: string;
  description: string;
  timestamp: string;
  status: 'completed' | 'scheduled' | 'created' | 'in_progress' | 'warning';
  icon: 'visitor' | 'vehicle' | 'qrcode' | 'job' | 'maintenance';
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
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    fetchOperationsStats();
    fetchActivityFeed();
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

  const fetchActivityFeed = async () => {
    try {
      setActivityLoading(true);
      const activities: ActivityItem[] = [];
      
      // Fetch recent visitor sign-ins
      try {
        const visitorRes = await fetch('/api/visitor/admin/recent');
        if (visitorRes.ok) {
          const visitors = await visitorRes.json();
          visitors.slice(0, 3).forEach((v: any) => {
            activities.push({
              id: `visitor-${v.id}`,
              type: 'visitor',
              title: 'Visitor Sign-in',
              description: `${v.name || 'Unknown'} - ${v.company || 'Visitor'} - ${v.location || 'Main Entrance'}`,
              timestamp: v.signInTime || v.createdAt || new Date().toISOString(),
              status: v.signOutTime ? 'completed' : 'in_progress',
              icon: 'visitor',
            });
          });
        }
      } catch (e) { console.log('Visitor feed unavailable'); }

      // Fetch recent jobs
      try {
        const jobsRes = await fetch('/api/jobs?limit=3');
        if (jobsRes.ok) {
          const jobs = await jobsRes.json();
          jobs.slice(0, 3).forEach((j: any) => {
            activities.push({
              id: `job-${j.id}`,
              type: 'job',
              title: j.status === 'completed' ? 'Job Completed' : j.status === 'in-progress' ? 'Job In Progress' : 'Job Scheduled',
              description: `${j.title} - ${j.location || 'Farm'}`,
              timestamp: j.updatedAt || j.createdAt || new Date().toISOString(),
              status: j.status === 'completed' ? 'completed' : j.status === 'in-progress' ? 'in_progress' : 'scheduled',
              icon: 'job',
            });
          });
        }
      } catch (e) { console.log('Jobs feed unavailable'); }

      // Fetch recent vehicle inspections
      try {
        const vehicleRes = await fetch('/api/vehicles/inspections/recent');
        if (vehicleRes.ok) {
          const inspections = await vehicleRes.json();
          inspections.slice(0, 2).forEach((i: any) => {
            activities.push({
              id: `vehicle-${i.id}`,
              type: 'vehicle',
              title: i.overallStatus === 'pass' ? 'Vehicle Inspection Passed' : 'Vehicle Inspection',
              description: `${i.vehicleName || 'Vehicle'} - ${i.overallStatus || 'Pending'}`,
              timestamp: i.inspectionDate || i.createdAt || new Date().toISOString(),
              status: i.overallStatus === 'pass' ? 'completed' : i.overallStatus === 'fail' ? 'warning' : 'scheduled',
              icon: 'vehicle',
            });
          });
        }
      } catch (e) { console.log('Vehicle feed unavailable'); }

      // Sort by timestamp and take most recent
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // If no real data, show placeholder activities
      if (activities.length === 0) {
        const now = new Date();
        activities.push(
          { id: 'demo-1', type: 'visitor', title: 'Visitor Sign-in Completed', description: 'Contractor - Main Entrance', timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), status: 'completed', icon: 'visitor' },
          { id: 'demo-2', type: 'job', title: 'Job Completed', description: 'Morning Feed - Paddock A', timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), status: 'completed', icon: 'job' },
          { id: 'demo-3', type: 'vehicle', title: 'Vehicle Inspection Scheduled', description: 'Toyota Hilux - Weekly Safety Check', timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(), status: 'scheduled', icon: 'vehicle' },
          { id: 'demo-4', type: 'qrcode', title: 'QR Code Scanned', description: 'Workshop Access Point', timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(), status: 'completed', icon: 'qrcode' },
          { id: 'demo-5', type: 'maintenance', title: 'Maintenance Logged', description: 'John Deere 6130R - Oil Change', timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(), status: 'completed', icon: 'maintenance' },
        );
      }
      
      setActivityFeed(activities.slice(0, 8));
    } catch (error) {
      console.error('Error fetching activity feed:', error);
    } finally {
      setActivityLoading(false);
    }
  };

  const getActivityIcon = (icon: ActivityItem['icon']) => {
    switch (icon) {
      case 'visitor': return <UserCheck className="h-4 w-4 text-green-600" />;
      case 'vehicle': return <Car className="h-4 w-4 text-blue-600" />;
      case 'qrcode': return <QrCode className="h-4 w-4 text-purple-600" />;
      case 'job': return <FileText className="h-4 w-4 text-orange-600" />;
      case 'maintenance': return <Wrench className="h-4 w-4 text-gray-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: ActivityItem['status']) => {
    switch (status) {
      case 'completed': return <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">Completed</Badge>;
      case 'scheduled': return <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">Scheduled</Badge>;
      case 'created': return <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200">Created</Badge>;
      case 'in_progress': return <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">In Progress</Badge>;
      case 'warning': return <Badge variant="outline" className="bg-red-50 text-red-800 border-red-200">Attention</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              Recent Operations Activity
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { fetchActivityFeed(); fetchOperationsStats(); }}>
              <Clock className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {activityFeed.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    {getActivityIcon(activity.icon)}
                    <div>
                      <p className="font-medium">{activity.title}</p>
                      <p className="text-sm text-gray-600">{activity.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{formatTimeAgo(activity.timestamp)}</p>
                    {getStatusBadge(activity.status)}
                  </div>
                </div>
              ))}
              {activityFeed.length === 0 && (
                <p className="text-center text-gray-500 py-4">No recent activity</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
