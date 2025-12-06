import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  MapPin, 
  Calendar, 
  Clock, 
  User, 
  Truck, 
  Eye,
  FileText,
  Plus,
  Download,
  Activity
} from 'lucide-react';

interface BiosecurityCheck {
  id: string;
  visitorName: string;
  vehicleRegistration: string;
  originLocation: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  checksPassed: string[];
  redFlags: string[];
  standDownPeriod?: number;
  checkInTime: string;
  checkedBy: string;
  status: 'Cleared' | 'Flagged' | 'Stand Down';
  notes: string;
}

interface BiosecurityZone {
  id: string;
  name: string;
  type: 'Restricted' | 'Controlled' | 'Clean';
  description: string;
  accessRequirements: string[];
  currentOccupants: number;
  maxCapacity: number;
  lastInspection: string;
}

interface MovementLog {
  id: string;
  personName: string;
  fromZone: string;
  toZone: string;
  purpose: string;
  timestamp: string;
  approved: boolean;
  riskAssessment: string;
}

const biosecurityChecks = [
  { id: 'vehicle_clean', label: 'Vehicle cleaned and disinfected', required: true },
  { id: 'footwear', label: 'Appropriate footwear provided/cleaned', required: true },
  { id: 'equipment', label: 'Equipment inspected and approved', required: false },
  { id: 'recent_travel', label: 'No recent high-risk farm visits', required: true },
  { id: 'animal_contact', label: 'No recent animal contact from other farms', required: true },
  { id: 'health_clearance', label: 'Health clearance certificate provided', required: false }
];

const riskFactors = [
  { factor: 'International Travel', risk: 'High', standDown: 7 },
  { factor: 'Recent Farm Visit', risk: 'Medium', standDown: 3 },
  { factor: 'Animal Transport', risk: 'High', standDown: 5 },
  { factor: 'Equipment from Other Farm', risk: 'Medium', standDown: 2 },
  { factor: 'Local Visitor', risk: 'Low', standDown: 0 }
];

export default function BiosecurityManagement() {
  const [checks, setChecks] = useState<BiosecurityCheck[]>([
    {
      id: '1',
      visitorName: 'John Smith',
      vehicleRegistration: 'ABC123',
      originLocation: 'Christchurch',
      riskLevel: 'Low',
      checksPassed: ['vehicle_clean', 'footwear'],
      redFlags: [],
      checkInTime: new Date().toISOString(),
      checkedBy: 'Sarah Johnson',
      status: 'Cleared',
      notes: 'Regular delivery driver, no concerns'
    },
    {
      id: '2',
      visitorName: 'Mike Wilson',
      vehicleRegistration: 'XYZ789',
      originLocation: 'Australia',
      riskLevel: 'High',
      checksPassed: ['vehicle_clean'],
      redFlags: ['recent_travel', 'animal_contact'],
      standDownPeriod: 7,
      checkInTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      checkedBy: 'Tom Brown',
      status: 'Stand Down',
      notes: 'International visitor requires 7-day stand down'
    }
  ]);

  const [zones, setZones] = useState<BiosecurityZone[]>([
    {
      id: '1',
      name: 'Animal Housing',
      type: 'Restricted',
      description: 'High biosecurity zone for livestock areas',
      accessRequirements: ['Disinfectant bath', 'Protective clothing', 'No recent animal contact'],
      currentOccupants: 3,
      maxCapacity: 10,
      lastInspection: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Feed Storage',
      type: 'Controlled',
      description: 'Medium biosecurity zone for feed and equipment',
      accessRequirements: ['Clean footwear', 'Vehicle inspection'],
      currentOccupants: 2,
      maxCapacity: 5,
      lastInspection: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    }
  ]);

  const [movementLogs, setMovementLogs] = useState<MovementLog[]>([
    {
      id: '1',
      personName: 'Sarah Johnson',
      fromZone: 'Main Office',
      toZone: 'Animal Housing',
      purpose: 'Health check',
      timestamp: new Date().toISOString(),
      approved: true,
      riskAssessment: 'Low'
    }
  ]);

  const [isCheckOpen, setIsCheckOpen] = useState(false);
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [selectedChecks, setSelectedChecks] = useState<string[]>([]);

  const handleCheckToggle = (checkId: string, checked: boolean) => {
    setSelectedChecks(prev => 
      checked 
        ? [...prev, checkId]
        : prev.filter(id => id !== checkId)
    );
  };

  const calculateRiskLevel = (origin: string, vehicleReg: string, selectedChecks: string[]): { level: 'Low' | 'Medium' | 'High', redFlags: string[], standDown?: number } => {
    const redFlags: string[] = [];
    let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
    let standDown = 0;

    // Check for international visitors
    if (origin.toLowerCase().includes('australia') || origin.toLowerCase().includes('international')) {
      redFlags.push('International travel detected');
      riskLevel = 'High';
      standDown = 7;
    }

    // Check for missing required checks
    const requiredChecks = biosecurityChecks.filter(check => check.required);
    const missingRequired = requiredChecks.filter(check => !selectedChecks.includes(check.id));
    
    if (missingRequired.length > 0) {
      redFlags.push(`Missing required checks: ${missingRequired.map(c => c.label).join(', ')}`);
      riskLevel = 'High';
    }

    // Check for high-risk patterns
    if (vehicleReg && !selectedChecks.includes('vehicle_clean')) {
      redFlags.push('Vehicle not cleaned');
      riskLevel = 'Medium';
    }

    return { level: riskLevel, redFlags, standDown };
  };

  const handleBiosecurityCheck = (visitorData: any) => {
    const riskAssessment = calculateRiskLevel(
      visitorData.originLocation,
      visitorData.vehicleRegistration,
      selectedChecks
    );

    const newCheck: BiosecurityCheck = {
      id: Date.now().toString(),
      visitorName: visitorData.visitorName,
      vehicleRegistration: visitorData.vehicleRegistration,
      originLocation: visitorData.originLocation,
      riskLevel: riskAssessment.level,
      checksPassed: selectedChecks,
      redFlags: riskAssessment.redFlags,
      standDownPeriod: riskAssessment.standDown,
      checkInTime: new Date().toISOString(),
      checkedBy: 'Current User',
      status: riskAssessment.redFlags.length > 0 ? 'Flagged' : 'Cleared',
      notes: visitorData.notes || ''
    };

    setChecks(prev => [newCheck, ...prev]);
    setSelectedChecks([]);
    setIsCheckOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Cleared': return 'bg-green-100 text-green-800 border-green-200';
      case 'Flagged': return 'bg-red-100 text-red-800 border-red-200';
      case 'Stand Down': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'bg-green-100 text-green-800 border-green-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'High': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getZoneColor = (type: string) => {
    switch (type) {
      case 'Restricted': return 'bg-red-100 text-red-800 border-red-200';
      case 'Controlled': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Clean': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const generateBiosecurityReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      totalChecks: checks.length,
      clearedCount: checks.filter(c => c.status === 'Cleared').length,
      flaggedCount: checks.filter(c => c.status === 'Flagged').length,
      standDownCount: checks.filter(c => c.status === 'Stand Down').length,
      activeZones: zones.length,
      recentMovements: movementLogs.length
    };

    const csvContent = [
      ['Biosecurity Report', ''],
      ['Generated At', new Date().toLocaleString()],
      ['Total Checks', reportData.totalChecks.toString()],
      ['Cleared', reportData.clearedCount.toString()],
      ['Flagged', reportData.flaggedCount.toString()],
      ['Stand Down', reportData.standDownCount.toString()],
      ['', ''],
      ['Recent Checks', ''],
      ['Name', 'Risk Level', 'Status', 'Time'],
      ...checks.slice(0, 10).map(check => [
        check.visitorName,
        check.riskLevel,
        check.status,
        new Date(check.checkInTime).toLocaleString()
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `biosecurity-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{checks.filter(c => c.status === 'Cleared').length}</div>
            <div className="text-sm text-gray-600">Cleared Today</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{checks.filter(c => c.status === 'Flagged').length}</div>
            <div className="text-sm text-gray-600">Flagged</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{checks.filter(c => c.status === 'Stand Down').length}</div>
            <div className="text-sm text-gray-600">Stand Down</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{zones.length}</div>
            <div className="text-sm text-gray-600">Active Zones</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="checks" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="checks">
            <Shield className="h-4 w-4 mr-2" />
            Biosecurity Checks
          </TabsTrigger>
          <TabsTrigger value="zones">
            <MapPin className="h-4 w-4 mr-2" />
            Zone Management
          </TabsTrigger>
          <TabsTrigger value="movement">
            <Activity className="h-4 w-4 mr-2" />
            Movement Tracking
          </TabsTrigger>
        </TabsList>

        {/* Biosecurity Checks Tab */}
        <TabsContent value="checks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-pulse-forest" />
                  Biosecurity Checks & Clearances
                </CardTitle>
                <div className="flex gap-2">
                  <Dialog open={isCheckOpen} onOpenChange={setIsCheckOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-pulse-forest hover:bg-pulse-forest-dark text-white">
                        <Plus className="h-4 w-4 mr-2" />
                        New Biosecurity Check
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Complete Biosecurity Check</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="visitorName">Visitor Name *</Label>
                            <Input id="visitorName" placeholder="Enter visitor name" />
                          </div>
                          <div>
                            <Label htmlFor="vehicleReg">Vehicle Registration</Label>
                            <Input id="vehicleReg" placeholder="ABC123" />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="originLocation">Origin Location *</Label>
                          <Input id="originLocation" placeholder="Where are they coming from?" />
                        </div>
                        <div>
                          <Label>Biosecurity Checks Required</Label>
                          <div className="space-y-2 mt-2">
                            {biosecurityChecks.map(check => (
                              <div key={check.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={check.id}
                                  checked={selectedChecks.includes(check.id)}
                                  onCheckedChange={(checked) => handleCheckToggle(check.id, checked as boolean)}
                                />
                                <Label htmlFor={check.id} className="text-sm">
                                  {check.label}
                                  {check.required && <span className="text-red-500 ml-1">*</span>}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="notes">Additional Notes</Label>
                          <Textarea id="notes" placeholder="Any additional observations or concerns" />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            className="flex-1 bg-pulse-forest hover:bg-pulse-forest-dark text-white"
                            onClick={() => handleBiosecurityCheck({
                              visitorName: (document.getElementById('visitorName') as HTMLInputElement)?.value,
                              vehicleRegistration: (document.getElementById('vehicleReg') as HTMLInputElement)?.value,
                              originLocation: (document.getElementById('originLocation') as HTMLInputElement)?.value,
                              notes: (document.getElementById('notes') as HTMLTextAreaElement)?.value
                            })}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Complete Check
                          </Button>
                          <Button variant="outline" onClick={() => setIsCheckOpen(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="outline" onClick={generateBiosecurityReport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {checks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No biosecurity checks completed yet</p>
                  </div>
                ) : (
                  checks.map(check => (
                    <Card key={check.id} className={`border-l-4 ${
                      check.status === 'Cleared' ? 'border-l-green-500' : 
                      check.status === 'Flagged' ? 'border-l-red-500' : 'border-l-orange-500'
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{check.visitorName}</h3>
                              <Badge className={getStatusColor(check.status)}>
                                {check.status}
                              </Badge>
                              <Badge className={getRiskColor(check.riskLevel)}>
                                {check.riskLevel} Risk
                              </Badge>
                              {check.standDownPeriod && (
                                <Badge variant="outline" className="text-orange-600">
                                  {check.standDownPeriod} day stand down
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                <span>{check.vehicleRegistration || 'No vehicle'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                <span>{check.originLocation}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>{new Date(check.checkInTime).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <span>Checked by {check.checkedBy}</span>
                              </div>
                            </div>
                            {check.redFlags.length > 0 && (
                              <div className="mb-3">
                                <div className="flex items-center gap-2 text-red-600 text-sm">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span>Red Flags:</span>
                                </div>
                                <ul className="text-sm text-red-600 ml-6">
                                  {check.redFlags.map((flag, index) => (
                                    <li key={index}>• {flag}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {check.notes && (
                              <p className="text-sm text-gray-600">
                                <strong>Notes:</strong> {check.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Zone Management Tab */}
        <TabsContent value="zones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-pulse-forest" />
                Biosecurity Zone Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {zones.map(zone => (
                  <Card key={zone.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{zone.name}</h3>
                          <Badge className={getZoneColor(zone.type)}>
                            {zone.type} Zone
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Occupancy</div>
                          <div className="font-semibold">{zone.currentOccupants}/{zone.maxCapacity}</div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{zone.description}</p>
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Access Requirements:</div>
                        <ul className="text-sm text-gray-600 ml-4">
                          {zone.accessRequirements.map((req, index) => (
                            <li key={index}>• {req}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        Last inspected: {new Date(zone.lastInspection).toLocaleDateString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Movement Tracking Tab */}
        <TabsContent value="movement" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-pulse-forest" />
                  Movement Tracking & Traceability
                </CardTitle>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Log Movement
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {movementLogs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No movements logged today</p>
                  </div>
                ) : (
                  movementLogs.map(movement => (
                    <Card key={movement.id} className="border-l-4 border-l-purple-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{movement.personName}</h3>
                              <Badge variant={movement.approved ? 'default' : 'outline'}>
                                {movement.approved ? 'Approved' : 'Pending'}
                              </Badge>
                              <Badge variant="outline">
                                {movement.riskAssessment} Risk
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span>{movement.fromZone} → {movement.toZone}</span>
                              <span>Purpose: {movement.purpose}</span>
                              <span>{new Date(movement.timestamp).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
