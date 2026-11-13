import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'wouter';
import { pulseGet } from '@/lib/pulseApi';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Wrench,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  MapPin,
  Tag,
  DollarSign,
  FileText,
  Plus,
  Pencil,
  History,
  User,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import MaintenanceForm from '@/components/MaintenanceForm';
import EquipmentForm from '@/components/EquipmentForm';

// Types
interface Equipment {
  id: string;
  farmId: string;
  name: string;
  type: string;
  model: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  yearManufactured: number | null;
  purchaseDate: string | null;
  purchasePrice: string | null;
  location: string | null;
  status: 'operational' | 'maintenance_due' | 'in_maintenance' | 'out_of_service';
  lastServiceDate: string | null;
  nextServiceDue: string | null;
  serviceIntervalDays: number | null;
  warrantyExpiry: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  serviceDate: string;
  serviceType: string;
  description: string | null;
  cost: string | null;
  performedBy: string | null;
  nextServiceDue: string | null;
  notes: string | null;
  createdAt: string;
}

interface Device {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  lastSeenAt: string | null;
  lastData: Record<string, any> | null;
}

interface EquipmentWithDevices {
  equipment: Equipment;
  devices: Device[];
}

// Manager roles
const MANAGER_ROLES = ['owner', 'manager', 'admin', 'maintenance'];

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  const isManager = user?.role && MANAGER_ROLES.includes(user.role.toLowerCase());

  // Load equipment and maintenance records
  const loadData = useCallback(async () => {
    if (!params.id) return;
    
    setLoading(true);
    setError(null);
    try {
      const [equipmentData, historyData] = await Promise.all([
        pulseGet<EquipmentWithDevices>(`/farm-equipment/${params.id}`),
        pulseGet<MaintenanceRecord[]>(`/farm-equipment/${params.id}/service-history`),
      ]);
      
      setEquipment(equipmentData.equipment);
      setDevices(equipmentData.devices || []);
      setMaintenanceRecords(historyData);
    } catch (err: any) {
      console.error('Failed to load equipment:', err);
      setError('Failed to load equipment details');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format date
  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  }

  // Get status badge
  function getStatusBadge(status: string) {
    switch (status) {
      case 'operational':
        return (
          <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Operational
          </Badge>
        );
      case 'maintenance_due':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Maintenance Due
          </Badge>
        );
      case 'in_maintenance':
        return (
          <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            In Maintenance
          </Badge>
        );
      case 'out_of_service':
        return (
          <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Out of Service
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  // Get device status badge
  function getDeviceStatusBadge(status: string) {
    switch (status) {
      case 'online':
        return <Badge className="bg-green-100 text-green-800">Online</Badge>;
      case 'offline':
        return <Badge className="bg-gray-100 text-gray-800">Offline</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">Error</Badge>;
      case 'maintenance':
        return <Badge className="bg-blue-100 text-blue-800">Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  // Handle maintenance logged
  function handleMaintenanceLogged(record: MaintenanceRecord, updatedEquipment: Equipment) {
    setMaintenanceRecords(prev => [record, ...prev]);
    setEquipment(updatedEquipment);
    setShowMaintenanceForm(false);
    toast.success('Maintenance logged successfully');
  }

  // Handle equipment updated
  function handleEquipmentUpdated(updatedEquipment: Equipment) {
    setEquipment(updatedEquipment);
    setShowEditForm(false);
    toast.success('Equipment updated successfully');
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-green-600" />
      </div>
    );
  }

  if (error || !equipment) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <p>{error || 'Equipment not found'}</p>
            </div>
            <Link href="/app/equipment">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Equipment List
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/app/equipment">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-pulse-green-800">{equipment.name}</h1>
            <p className="text-gray-500">{equipment.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(equipment.status)}
          {isManager && (
            <Button variant="outline" onClick={() => setShowEditForm(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Equipment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Equipment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {equipment.manufacturer && (
              <div className="flex items-center gap-3">
                <Tag className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Manufacturer</p>
                  <p className="font-medium">{equipment.manufacturer}</p>
                </div>
              </div>
            )}
            {equipment.model && (
              <div className="flex items-center gap-3">
                <Tag className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Model</p>
                  <p className="font-medium">{equipment.model}</p>
                </div>
              </div>
            )}
            {equipment.serialNumber && (
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Serial Number</p>
                  <p className="font-medium">{equipment.serialNumber}</p>
                </div>
              </div>
            )}
            {equipment.yearManufactured && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Year Manufactured</p>
                  <p className="font-medium">{equipment.yearManufactured}</p>
                </div>
              </div>
            )}
            {equipment.location && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium">{equipment.location}</p>
                </div>
              </div>
            )}
            {equipment.purchasePrice && (
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Purchase Price</p>
                  <p className="font-medium">${parseFloat(equipment.purchasePrice).toLocaleString()}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Service Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Service Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Last Service</p>
                <p className="font-medium">{formatDate(equipment.lastServiceDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Next Service Due</p>
                <p className={`font-medium ${
                  equipment.nextServiceDue && new Date(equipment.nextServiceDue) < new Date()
                    ? 'text-red-600'
                    : ''
                }`}>
                  {formatDate(equipment.nextServiceDue)}
                </p>
              </div>
            </div>
            {equipment.serviceIntervalDays && (
              <div className="flex items-center gap-3">
                <Settings className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Service Interval</p>
                  <p className="font-medium">{equipment.serviceIntervalDays} days</p>
                </div>
              </div>
            )}
            {equipment.warrantyExpiry && (
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Warranty Expires</p>
                  <p className={`font-medium ${
                    new Date(equipment.warrantyExpiry) < new Date() ? 'text-red-600' : ''
                  }`}>
                    {formatDate(equipment.warrantyExpiry)}
                  </p>
                </div>
              </div>
            )}

            {isManager && (
              <Button
                onClick={() => setShowMaintenanceForm(true)}
                className="w-full mt-4 bg-pulse-green-600 hover:bg-pulse-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Log Maintenance
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {equipment.notes && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{equipment.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Connected Devices */}
      {devices.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Connected Devices ({devices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {devices.map(device => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{device.name}</p>
                    <p className="text-sm text-gray-500">{device.type}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {device.lastSeenAt && (
                      <span className="text-sm text-gray-500">
                        Last seen {formatDistanceToNow(parseISO(device.lastSeenAt), { addSuffix: true })}
                      </span>
                    )}
                    {getDeviceStatusBadge(device.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maintenance History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Maintenance History ({maintenanceRecords.length})
          </CardTitle>
          <CardDescription>
            Service and maintenance records for this equipment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {maintenanceRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Wrench className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No maintenance records yet</p>
              {isManager && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowMaintenanceForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Log First Maintenance
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {maintenanceRecords.map(record => (
                <div
                  key={record.id}
                  className="p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{record.serviceType}</Badge>
                        <span className="text-sm text-gray-500">
                          {formatDate(record.serviceDate)}
                        </span>
                      </div>
                      {record.description && (
                        <p className="mt-2 text-gray-700">{record.description}</p>
                      )}
                      {record.notes && (
                        <p className="mt-1 text-sm text-gray-500">{record.notes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {record.cost && (
                        <p className="font-medium text-pulse-green-700">
                          ${parseFloat(record.cost).toLocaleString()}
                        </p>
                      )}
                      {record.performedBy && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 justify-end">
                          <User className="h-3 w-3" />
                          {record.performedBy}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Maintenance Form Dialog */}
      <Dialog open={showMaintenanceForm} onOpenChange={setShowMaintenanceForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Maintenance</DialogTitle>
          </DialogHeader>
          <MaintenanceForm
            equipmentId={equipment.id}
            onSuccess={handleMaintenanceLogged}
            onCancel={() => setShowMaintenanceForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Equipment Dialog */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Equipment</DialogTitle>
          </DialogHeader>
          <EquipmentForm
            existingEquipment={equipment}
            onSuccess={handleEquipmentUpdated}
            onCancel={() => setShowEditForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
