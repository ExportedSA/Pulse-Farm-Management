import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Car, 
  Plus, 
  Search, 
  Filter, 
  Wrench, 
  Calendar, 
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  Download
} from 'lucide-react';

// Types
interface Vehicle {
  id: string;
  registration: string;
  make: string;
  model: string;
  year: number;
  typeId: string;
  typeName: string;
  typeCategory: string;
  status: 'active' | 'maintenance' | 'retired' | 'sold';
  location?: string;
  assignedTo?: string;
  nextServiceDue?: string;
  lastServiceDate?: string;
  odometerReading?: number;
  vin?: string;
  engineNumber?: string;
  color?: string;
  fuelType?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currentOwner?: string;
  insuranceCompany?: string;
  insurancePolicyNumber?: string;
  insuranceExpiry?: string;
  registrationExpiry?: string;
  wofExpiry?: string;
  cofExpiry?: string;
  rucExpiry?: string;
  lastWofDate?: string;
  lastCofDate?: string;
  lastRucDate?: string;
  notes?: string;
  createdAt: string;
}

interface VehicleType {
  id: string;
  name: string;
  category: string;
  description?: string;
  inspectionFrequencyDays: number;
}

interface VehicleInspection {
  id: string;
  vehicleId: string;
  overallStatus: 'pass' | 'fail' | 'pass_with_notes';
  inspectionDate: string;
  inspectorId: string;
  defectsFound: number;
  criticalDefects: number;
  notes?: string;
  completedAt?: string;
}

interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  type: 'service' | 'repair' | 'inspection' | 'modification';
  description: string;
  performedBy: string;
  performedDate: string;
  cost?: number;
  odometerReading?: number;
  notes?: string;
}

interface VehicleStats {
  total: number;
  active: number;
  needsInspection: number;
  overdueInspection: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

export default function VehicleRegistryPage() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('vehicles');
  
  // Vehicles state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [vehicleStats, setVehicleStats] = useState<VehicleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Form state
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    registration: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    typeId: '',
    vin: '',
    engineNumber: '',
    color: '',
    fuelType: '',
    odometerReading: '',
    purchaseDate: '',
    purchasePrice: '',
    currentOwner: '',
    insuranceCompany: '',
    insurancePolicyNumber: '',
    insuranceExpiry: '',
    registrationExpiry: '',
    wofExpiry: '',
    cofExpiry: '',
    rucExpiry: '',
    lastServiceDate: '',
    nextServiceDue: '',
    lastWofDate: '',
    lastCofDate: '',
    lastRucDate: '',
    location: '',
    assignedTo: '',
    notes: '',
  });

  // Fetch data
  useEffect(() => {
    fetchVehicles();
    fetchVehicleTypes();
    fetchVehicleStats();
  }, [searchTerm, filterType, filterStatus]);

  const fetchVehicles = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterType) params.append('type', filterType);
      if (filterStatus) params.append('status', filterStatus);
      
      const response = await fetch(`/api/vehicles?${params}`);
      if (response.ok) {
        const data = await response.json();
        setVehicles(data);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicleTypes = async () => {
    try {
      const response = await fetch('/api/vehicles/types');
      if (response.ok) {
        const data = await response.json();
        setVehicleTypes(data);
      }
    } catch (error) {
      console.error('Error fetching vehicle types:', error);
    }
  };

  const fetchVehicleStats = async () => {
    try {
      const response = await fetch('/api/vehicles/stats/overview');
      if (response.ok) {
        const data = await response.json();
        setVehicleStats(data);
      }
    } catch (error) {
      console.error('Error fetching vehicle stats:', error);
    }
  };

  const handleSubmitVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        year: parseInt(formData.year.toString()),
        odometerReading: formData.odometerReading ? parseInt(formData.odometerReading.toString()) : null,
        purchasePrice: formData.purchasePrice ? parseInt(formData.purchasePrice.toString()) : null,
      };

      const url = editingVehicle ? `/api/vehicles/${editingVehicle.id}` : '/api/vehicles';
      const method = editingVehicle ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowAddVehicle(false);
        setEditingVehicle(null);
        setFormData({
          registration: '',
          make: '',
          model: '',
          year: new Date().getFullYear(),
          typeId: '',
          vin: '',
          engineNumber: '',
          color: '',
          fuelType: '',
          odometerReading: '',
          purchaseDate: '',
          purchasePrice: '',
          currentOwner: '',
          insuranceCompany: '',
          insurancePolicyNumber: '',
          insuranceExpiry: '',
          registrationExpiry: '',
          wofExpiry: '',
          cofExpiry: '',
          rucExpiry: '',
          lastServiceDate: '',
          nextServiceDue: '',
          lastWofDate: '',
          lastCofDate: '',
          lastRucDate: '',
          location: '',
          assignedTo: '',
          notes: '',
        });
        fetchVehicles();
        fetchVehicleStats();
      }
    } catch (error) {
      console.error('Error saving vehicle:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'retired': return 'bg-gray-100 text-gray-800';
      case 'sold': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getComplianceStatus = (vehicle: Vehicle) => {
    const today = new Date();
    const checks = [
      { field: 'nextServiceDue', label: 'Service', criticalDays: 0, warningDays: 7 },
      { field: 'wofExpiry', label: 'WOF', criticalDays: 0, warningDays: 14 },
      { field: 'cofExpiry', label: 'COF', criticalDays: 0, warningDays: 14 },
      { field: 'registrationExpiry', label: 'Registration', criticalDays: 0, warningDays: 30 },
      { field: 'rucExpiry', label: 'RUC', criticalDays: 0, warningDays: 7 },
      { field: 'insuranceExpiry', label: 'Insurance', criticalDays: 0, warningDays: 30 },
    ];

    let hasCritical = false;
    let hasWarning = false;
    let criticalItems: string[] = [];
    let warningItems: string[] = [];

    for (const check of checks) {
      const expiryDate = vehicle[check.field as keyof Vehicle];
      if (!expiryDate) continue;

      const expiry = new Date(expiryDate);
      const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil < 0) {
        hasCritical = true;
        criticalItems.push(check.label);
      } else if (daysUntil <= check.warningDays) {
        hasWarning = true;
        warningItems.push(`${check.label} (${daysUntil}d)`);
      }
    }

    if (hasCritical) {
      return { 
        color: 'text-red-600', 
        icon: AlertTriangle, 
        text: 'Critical',
        tooltip: `Expired: ${criticalItems.join(', ')}`
      };
    } else if (hasWarning) {
      return { 
        color: 'text-yellow-600', 
        icon: Clock, 
        text: 'Warning',
        tooltip: `Due soon: ${warningItems.join(', ')}`
      };
    }
    
    return { 
      color: 'text-green-600', 
      icon: CheckCircle, 
      text: 'Compliant',
      tooltip: 'All compliance items up to date'
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Car className="h-8 w-8 text-blue-600" />
            Vehicle Registry
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your farm vehicle fleet, inspections, and maintenance records
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchVehicles()}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={showAddVehicle} onOpenChange={setShowAddVehicle}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingVehicle(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Vehicle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitVehicle} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="registration">Registration *</Label>
                    <Input
                      id="registration"
                      value={formData.registration}
                      onChange={(e) => setFormData({...formData, registration: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="typeId">Vehicle Type *</Label>
                    <Select value={formData.typeId} onValueChange={(value) => setFormData({...formData, typeId: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicleTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name} ({type.category})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="make">Make *</Label>
                    <Input
                      id="make"
                      value={formData.make}
                      onChange={(e) => setFormData({...formData, make: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="model">Model *</Label>
                    <Input
                      id="model"
                      value={formData.model}
                      onChange={(e) => setFormData({...formData, model: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="year">Year *</Label>
                    <Input
                      id="year"
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="vin">VIN</Label>
                    <Input
                      id="vin"
                      value={formData.vin}
                      onChange={(e) => setFormData({...formData, vin: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="color">Color</Label>
                    <Input
                      id="color"
                      value={formData.color}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="fuelType">Fuel Type</Label>
                    <Input
                      id="fuelType"
                      value={formData.fuelType}
                      onChange={(e) => setFormData({...formData, fuelType: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="odometerReading">Odometer Reading</Label>
                    <Input
                      id="odometerReading"
                      type="number"
                      value={formData.odometerReading}
                      onChange={(e) => setFormData({...formData, odometerReading: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="assignedTo">Assigned To</Label>
                    <Input
                      id="assignedTo"
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({...formData, assignedTo: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="registrationExpiry">Registration Expiry</Label>
                    <Input
                      id="registrationExpiry"
                      type="date"
                      value={formData.registrationExpiry}
                      onChange={(e) => setFormData({...formData, registrationExpiry: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="wofExpiry">WOF Expiry</Label>
                    <Input
                      id="wofExpiry"
                      type="date"
                      value={formData.wofExpiry}
                      onChange={(e) => setFormData({...formData, wofExpiry: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cofExpiry">COF Expiry</Label>
                    <Input
                      id="cofExpiry"
                      type="date"
                      value={formData.cofExpiry}
                      onChange={(e) => setFormData({...formData, cofExpiry: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rucExpiry">RUC Expiry</Label>
                    <Input
                      id="rucExpiry"
                      type="date"
                      value={formData.rucExpiry}
                      onChange={(e) => setFormData({...formData, rucExpiry: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastServiceDate">Last Service Date</Label>
                    <Input
                      id="lastServiceDate"
                      type="date"
                      value={formData.lastServiceDate}
                      onChange={(e) => setFormData({...formData, lastServiceDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="nextServiceDue">Next Service Due</Label>
                    <Input
                      id="nextServiceDue"
                      type="date"
                      value={formData.nextServiceDue}
                      onChange={(e) => setFormData({...formData, nextServiceDue: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowAddVehicle(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      {vehicleStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Vehicles</p>
                  <p className="text-2xl font-bold text-blue-600">{vehicleStats.total}</p>
                </div>
                <Car className="h-8 w-8 text-blue-100" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">{vehicleStats.active}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-100" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Need Inspection</p>
                  <p className="text-2xl font-bold text-yellow-600">{vehicleStats.needsInspection}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-100" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Overdue</p>
                  <p className="text-2xl font-bold text-red-600">{vehicleStats.overdueInspection}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-100" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="inspections">Inspections</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by registration, make, or model..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {vehicleTypes.map((type) => (
                      <SelectItem key={type.id} value={type.name}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Vehicles List */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Fleet</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : vehicles.length === 0 ? (
                <div className="text-center py-8">
                  <Car className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No vehicles found</p>
                  <Button className="mt-4" onClick={() => setShowAddVehicle(true)}>
                    Add Your First Vehicle
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Registration</th>
                        <th className="text-left py-3 px-4">Vehicle</th>
                        <th className="text-left py-3 px-4">Type</th>
                        <th className="text-left py-3 px-4">Status</th>
                        <th className="text-left py-3 px-4">Compliance</th>
                        <th className="text-left py-3 px-4">Location</th>
                        <th className="text-left py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicles.map((vehicle) => {
                        const complianceStatus = getComplianceStatus(vehicle);
                        return (
                          <tr key={vehicle.id} className="border-b hover:bg-accent">
                            <td className="py-3 px-4 font-medium">{vehicle.registration}</td>
                            <td className="py-3 px-4">
                              <div>
                                <div className="font-medium">{vehicle.make} {vehicle.model}</div>
                                <div className="text-sm text-gray-600">{vehicle.year}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline">
                                {vehicle.typeName}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={getStatusColor(vehicle.status)}>
                                {vehicle.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1" title={complianceStatus.tooltip}>
                                <complianceStatus.icon className={`h-4 w-4 ${complianceStatus.color}`} />
                                <span className={`text-sm font-medium ${complianceStatus.color}`}>
                                  {complianceStatus.text}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm">{vehicle.location || '-'}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingVehicle(vehicle);
                                    setFormData({
                                      registration: vehicle.registration,
                                      make: vehicle.make,
                                      model: vehicle.model,
                                      year: vehicle.year,
                                      typeId: vehicle.typeId,
                                      vin: vehicle.vin || '',
                                      engineNumber: vehicle.engineNumber || '',
                                      color: vehicle.color || '',
                                      fuelType: vehicle.fuelType || '',
                                      odometerReading: vehicle.odometerReading?.toString() || '',
                                      purchaseDate: vehicle.purchaseDate || '',
                                      purchasePrice: vehicle.purchasePrice?.toString() || '',
                                      currentOwner: vehicle.currentOwner || '',
                                      insuranceCompany: vehicle.insuranceCompany || '',
                                      insurancePolicyNumber: vehicle.insurancePolicyNumber || '',
                                      insuranceExpiry: vehicle.insuranceExpiry || '',
                                      registrationExpiry: vehicle.registrationExpiry || '',
                                      wofExpiry: vehicle.wofExpiry || '',
                                      cofExpiry: vehicle.cofExpiry || '',
                                      rucExpiry: vehicle.rucExpiry || '',
                                      lastServiceDate: vehicle.lastServiceDate || '',
                                      nextServiceDue: vehicle.nextServiceDue || '',
                                      lastWofDate: vehicle.lastWofDate || '',
                                      lastCofDate: vehicle.lastCofDate || '',
                                      lastRucDate: vehicle.lastRucDate || '',
                                      location: vehicle.location || '',
                                      assignedTo: vehicle.assignedTo || '',
                                      notes: vehicle.notes || '',
                                    });
                                    setShowAddVehicle(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setLocation(`/app/operations/vehicles/${vehicle.id}/inspections`)}
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inspections">
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Vehicle Inspections</h3>
              <p className="text-gray-600 mb-4">
                Schedule and manage weekly health & safety inspections for your vehicle fleet
              </p>
              <Button>Schedule Inspection</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardContent className="p-8 text-center">
              <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Maintenance Records</h3>
              <p className="text-gray-600 mb-4">
                Track service history, repairs, and maintenance schedules
              </p>
              <Button>Add Maintenance Record</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
