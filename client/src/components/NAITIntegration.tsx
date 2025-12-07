import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Upload, 
  Download, 
  FileText,
  MapPin,
  Users,
  Calendar,
  Truck,
  Eye,
  Settings,
  RefreshCw,
  Database,
  Cloud,
  Wifi,
  WifiOff
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';

interface NAITAnimal {
  id: string;
  naitId: string;
  type: 'cattle' | 'deer';
  status: 'on_farm' | 'moved' | 'deceased';
  lastMovement?: Date;
  location: string;
}

interface ComplianceRequirement {
  id: string;
  name: string;
  type: 'nait' | 'mpi' | 'regional';
  status: 'compliant' | 'pending' | 'overdue';
  dueDate: Date;
  description: string;
  actionRequired: boolean;
}

interface NAITIntegrationProps {
  farmId: string;
  onSyncComplete?: (results: any) => void;
}

const NAITIntegration: React.FC<NAITIntegrationProps> = ({ farmId, onSyncComplete }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState(new Date(Date.now() - 2 * 60 * 60 * 1000));
  const [selectedMovement, setSelectedMovement] = useState('');

  // Sample NAIT animals data
  const [animals] = useState<NAITAnimal[]>([
    { id: '1', naitId: 'NAIT123456789', type: 'cattle', status: 'on_farm', location: 'Paddock 1' },
    { id: '2', naitId: 'NAIT123456790', type: 'cattle', status: 'moved', lastMovement: new Date(Date.now() - 24 * 60 * 60 * 1000), location: 'Moved to Farm B' },
    { id: '3', naitId: 'NAIT123456791', type: 'deer', status: 'on_farm', location: 'Paddock 3' },
    { id: '4', naitId: 'NAIT123456792', type: 'cattle', status: 'deceased', lastMovement: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), location: 'Recorded' },
  ]);

  // Sample compliance requirements
  const [complianceRequirements] = useState<ComplianceRequirement[]>([
    {
      id: 'nait-movement',
      name: 'NAIT Movement Recording',
      type: 'nait',
      status: 'compliant',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      description: 'All animal movements must be recorded in NAIT within 48 hours',
      actionRequired: false
    },
    {
      id: 'nait-annual',
      name: 'NAIT Annual Return',
      type: 'nait',
      status: 'pending',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      description: 'Annual animal count and movement summary due to NAIT',
      actionRequired: true
    },
    {
      id: 'mpi-grazing',
      name: 'MPI Grazing Certificate',
      type: 'mpi',
      status: 'compliant',
      dueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      description: 'Grazing certificate for off-farm grazing activities',
      actionRequired: false
    },
    {
      id: 'mpi-treatment',
      name: 'Treatment Records',
      type: 'mpi',
      status: 'overdue',
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      description: 'Monthly treatment records must be submitted to MPI',
      actionRequired: true
    },
    {
      id: 'regional-water',
      name: 'Regional Council Water Permit',
      type: 'regional',
      status: 'pending',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      description: 'Water usage monitoring and reporting required',
      actionRequired: true
    }
  ]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncWithNAIT = async () => {
    setSyncStatus('syncing');
    
    // Simulate NAIT sync process
    setTimeout(() => {
      setSyncStatus('success');
      setLastSyncTime(new Date());
      onSyncComplete?.({ synced: true, timestamp: new Date() });
      
      // Reset status after 3 seconds
      setTimeout(() => setSyncStatus('idle'), 3000);
    }, 2000);
  };

  const generateMPIReport = () => {
    // Simulate report generation
    console.log('Generating MPI compliance report...');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-orange-600 bg-orange-50';
      case 'overdue': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'nait': return 'bg-blue-100 text-blue-800';
      case 'mpi': return 'bg-green-100 text-green-800';
      case 'regional': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const overdueCount = complianceRequirements.filter(r => r.status === 'overdue').length;
  const pendingCount = complianceRequirements.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header with NZ Compliance Status */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Shield className="h-5 w-5" />
              NZ Compliance & NAIT Integration
            </CardTitle>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Badge className="bg-green-100 text-green-800">
                  <Wifi className="h-3 w-3 mr-1" />
                  Online
                </Badge>
              ) : (
                <Badge className="bg-orange-100 text-orange-800">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Offline
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={syncWithNAIT}
                disabled={!isOnline || syncStatus === 'syncing'}
              >
                {syncStatus === 'syncing' ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Sync NAIT
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="font-medium text-green-800">Compliant</h4>
              <p className="text-2xl font-bold text-green-600">
                {complianceRequirements.filter(r => r.status === 'compliant').length}
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <h4 className="font-medium text-orange-800">Pending</h4>
              <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h4 className="font-medium text-red-800">Overdue</h4>
              <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="font-medium text-blue-800">Last Sync</h4>
              <p className="text-sm text-blue-600">
                {format(lastSyncTime, 'MMM d, h:mm a')}
              </p>
            </div>
          </div>

          {(overdueCount > 0 || pendingCount > 0) && (
            <Alert className="mt-4 border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>Action Required:</strong> You have {overdueCount} overdue and {pendingCount} pending compliance items. 
                Please address these to maintain NZ regulatory compliance.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="nait" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="nait">NAIT Integration</TabsTrigger>
          <TabsTrigger value="mpi">MPI Compliance</TabsTrigger>
          <TabsTrigger value="animals">Animal Tracking</TabsTrigger>
          <TabsTrigger value="reporting">Reporting</TabsTrigger>
        </TabsList>

        {/* NAIT Integration Tab */}
        <TabsContent value="nait" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                NAIT Database Integration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">NAIT Status</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="text-sm font-medium">Connection Status</span>
                        <Badge className={isOnline ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                          {isOnline ? 'Connected' : 'Offline'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="text-sm font-medium">Last Sync</span>
                        <span className="text-sm">{format(lastSyncTime, 'MMM d, h:mm a')}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="text-sm font-medium">Animals Registered</span>
                        <span className="text-sm">{animals.length}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="text-sm font-medium">Pending Movements</span>
                        <span className="text-sm">1</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Quick Actions</h4>
                    <div className="space-y-3">
                      <Button 
                        onClick={syncWithNAIT}
                        disabled={!isOnline || syncStatus === 'syncing'}
                        className="w-full"
                      >
                        {syncStatus === 'syncing' ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Cloud className="h-4 w-4 mr-2" />
                        )}
                        Sync with NAIT
                      </Button>
                      <Button variant="outline" className="w-full">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Movement Records
                      </Button>
                      <Button variant="outline" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Download NAIT Data
                      </Button>
                      <Button variant="outline" className="w-full">
                        <FileText className="h-4 w-4 mr-2" />
                        Generate NAIT Report
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Movement Recording Form */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Record Animal Movement</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="animal-select">Select Animal</Label>
                      <Select value={selectedMovement} onValueChange={setSelectedMovement}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose animal" />
                        </SelectTrigger>
                        <SelectContent>
                          {animals.filter(a => a.status === 'on_farm').map((animal) => (
                            <SelectItem key={animal.id} value={animal.id}>
                              {animal.naitId} - {animal.type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="movement-type">Movement Type</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Type of movement" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="off_farm">Off-Farm</SelectItem>
                          <SelectItem value="on_farm">Between Paddocks</SelectItem>
                          <SelectItem value="sale">Sale</SelectItem>
                          <SelectItem value="death">Death</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="destination">Destination</Label>
                      <Input placeholder="Farm location or buyer" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button>
                      <Truck className="h-4 w-4 mr-2" />
                      Record Movement
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MPI Compliance Tab */}
        <TabsContent value="mpi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                MPI Compliance Requirements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {complianceRequirements.map((requirement) => (
                  <div key={requirement.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getStatusIcon(requirement.status)}
                        <div className="flex-1">
                          <h4 className="font-medium">{requirement.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {requirement.description}
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            Due: {format(requirement.dueDate, 'MMMM d, yyyy')}
                            {differenceInDays(requirement.dueDate, new Date()) < 0 && (
                              <span className="text-red-600 ml-2">
                                ({Math.abs(differenceInDays(requirement.dueDate, new Date()))} days overdue)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getTypeColor(requirement.type)}>
                          {requirement.type.toUpperCase()}
                        </Badge>
                        <Badge className={getStatusColor(requirement.status)}>
                          {requirement.status}
                        </Badge>
                      </div>
                    </div>
                    {requirement.actionRequired && (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm">
                          <FileText className="h-3 w-3 mr-1" />
                          Complete Now
                        </Button>
                        <Button size="sm" variant="outline">
                          <Calendar className="h-3 w-3 mr-1" />
                          Schedule
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Animal Tracking Tab */}
        <TabsContent value="animals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Animal Tracking & Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800">On Farm</h4>
                    <p className="text-2xl font-bold text-green-600">
                      {animals.filter(a => a.status === 'on_farm').length}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-800">Moved</h4>
                    <p className="text-2xl font-bold text-blue-600">
                      {animals.filter(a => a.status === 'moved').length}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <h4 className="font-medium text-orange-800">Cattle</h4>
                    <p className="text-2xl font-bold text-orange-600">
                      {animals.filter(a => a.type === 'cattle').length}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-medium text-purple-800">Deer</h4>
                    <p className="text-2xl font-bold text-purple-600">
                      {animals.filter(a => a.type === 'deer').length}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Recent Animal Activity</h4>
                  <div className="space-y-2">
                    {animals.map((animal) => (
                      <div key={animal.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-8 rounded-full ${
                            animal.status === 'on_farm' ? 'bg-green-500' :
                            animal.status === 'moved' ? 'bg-blue-500' : 'bg-red-500'
                          }`}></div>
                          <div>
                            <p className="font-medium">{animal.naitId}</p>
                            <p className="text-sm text-muted-foreground">
                              {animal.type.charAt(0).toUpperCase() + animal.type.slice(1)} • {animal.location}
                            </p>
                            {animal.lastMovement && (
                              <p className="text-xs text-muted-foreground">
                                Last moved: {format(animal.lastMovement, 'MMM d, yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{animal.status}</Badge>
                          <Button size="sm" variant="outline">
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reporting Tab */}
        <TabsContent value="reporting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Compliance Reporting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Generate Reports</h4>
                    <div className="space-y-3">
                      <Button className="w-full justify-start">
                        <FileText className="h-4 w-4 mr-2" />
                        NAIT Annual Return
                      </Button>
                      <Button variant="outline" className="w-full justify-start">
                        <FileText className="h-4 w-4 mr-2" />
                        MPI Treatment Records
                      </Button>
                      <Button variant="outline" className="w-full justify-start">
                        <FileText className="h-4 w-4 mr-2" />
                        Grazing Certificate
                      </Button>
                      <Button variant="outline" className="w-full justify-start">
                        <FileText className="h-4 w-4 mr-2" />
                        Animal Movement Summary
                      </Button>
                      <Button variant="outline" className="w-full justify-start">
                        <FileText className="h-4 w-4 mr-2" />
                        Compliance Dashboard
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Recent Reports</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">NAIT Annual Return 2024</p>
                          <p className="text-sm text-muted-foreground">Generated 2 days ago</p>
                        </div>
                        <Button size="sm" variant="outline">
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Monthly Treatment Report</p>
                          <p className="text-sm text-muted-foreground">Generated 1 week ago</p>
                        </div>
                        <Button size="sm" variant="outline">
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Grazing Certificate - Farm B</p>
                          <p className="text-sm text-muted-foreground">Generated 2 weeks ago</p>
                        </div>
                        <Button size="sm" variant="outline">
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>Auto-Submission Available:</strong> Enable automatic submission of compliance 
                    reports to MPI and NAIT to never miss a deadline.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NAITIntegration;
