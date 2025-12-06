import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Phone, 
  MapPin, 
  AlertTriangle, 
  CheckCircle, 
  Camera,
  QrCode,
  DoorOpen,
  DoorClosed,
  Shield,
  IdCard,
  Car,
  Truck,
  Construction,
  User,
  Download,
  FileText,
  Signature
} from 'lucide-react';
import QRCodeGenerator from './QRCodeGenerator';

interface PersonOnSite {
  id: string;
  name: string;
  type: 'employee' | 'visitor' | 'contractor';
  company?: string;
  phone: string;
  email?: string;
  emergencyContact: string;
  emergencyPhone: string;
  signInTime: string;
  signOutTime?: string;
  status: 'on_site' | 'off_site';
  inductionCompleted: boolean;
  inductionDate?: string;
  vehicleType?: 'car' | 'truck' | 'motorcycle' | 'other';
  vehicleRegistration?: string;
  accessLevel: 'general' | 'restricted' | 'supervisor';
  photoUrl?: string;
  qrCode?: string;
  siteLocation?: string;
  purpose: string;
  hostEmployee?: string;
}

interface SiteStats {
  totalOnSite: number;
  employees: number;
  visitors: number;
  contractors: number;
  pendingInductions: number;
  emergencyReady: number;
}

const mockPeopleOnSite: PersonOnSite[] = [
  {
    id: '1',
    name: 'John Smith',
    type: 'employee',
    phone: '+64 21 123 4567',
    email: 'john@pulsefarm.nz',
    emergencyContact: 'Mary Smith',
    emergencyPhone: '+64 21 987 6543',
    signInTime: '2024-12-02T07:30:00',
    status: 'on_site',
    inductionCompleted: true,
    inductionDate: '2024-01-15',
    vehicleType: 'truck',
    vehicleRegistration: 'ABC123',
    accessLevel: 'supervisor',
    siteLocation: 'Main Farm',
    purpose: 'Daily farm operations'
  },
  {
    id: '2',
    name: 'Sarah Wilson',
    type: 'visitor',
    company: 'AgriTech Solutions',
    phone: '+64 21 234 5678',
    email: 'sarah@agritech.com',
    emergencyContact: 'David Wilson',
    emergencyPhone: '+64 21 876 5432',
    signInTime: '2024-12-02T09:15:00',
    status: 'on_site',
    inductionCompleted: true,
    inductionDate: '2024-12-02',
    vehicleType: 'car',
    vehicleRegistration: 'XYZ789',
    accessLevel: 'general',
    siteLocation: 'Main Office',
    purpose: 'Equipment demonstration',
    hostEmployee: 'John Smith'
  },
  {
    id: '3',
    name: 'Mike Thompson',
    type: 'contractor',
    company: 'Farm Maintenance Ltd',
    phone: '+64 21 345 6789',
    email: 'mike@farmmaintenance.co.nz',
    emergencyContact: 'Lisa Thompson',
    emergencyPhone: '+64 21 765 4321',
    signInTime: '2024-12-02T08:00:00',
    status: 'on_site',
    inductionCompleted: false,
    vehicleType: 'truck',
    vehicleRegistration: 'MNT456',
    accessLevel: 'restricted',
    siteLocation: 'Workshop',
    purpose: 'Machinery maintenance'
  },
  {
    id: '4',
    name: 'Emma Davis',
    type: 'employee',
    phone: '+64 21 456 7890',
    email: 'emma@pulsefarm.nz',
    emergencyContact: 'Robert Davis',
    emergencyPhone: '+64 21 654 3210',
    signInTime: '2024-12-02T06:45:00',
    signOutTime: '2024-12-02T17:30:00',
    status: 'off_site',
    inductionCompleted: true,
    inductionDate: '2024-02-01',
    vehicleType: 'car',
    vehicleRegistration: 'EMM111',
    accessLevel: 'general',
    siteLocation: 'Dairy Shed',
    purpose: 'Milking operations'
  }
];

export default function DigitalRegistry() {
  const [peopleOnSite, setPeopleOnSite] = useState<PersonOnSite[]>(mockPeopleOnSite);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonOnSite | null>(null);

  // Calculate site statistics
  const siteStats: SiteStats = {
    totalOnSite: peopleOnSite.filter(p => p.status === 'on_site').length,
    employees: peopleOnSite.filter(p => p.type === 'employee' && p.status === 'on_site').length,
    visitors: peopleOnSite.filter(p => p.type === 'visitor' && p.status === 'on_site').length,
    contractors: peopleOnSite.filter(p => p.type === 'contractor' && p.status === 'on_site').length,
    pendingInductions: peopleOnSite.filter(p => !p.inductionCompleted && p.status === 'on_site').length,
    emergencyReady: peopleOnSite.filter(p => p.emergencyContact && p.status === 'on_site').length
  };

  // Filter people based on search and filters
  const filteredPeople = peopleOnSite.filter(person => {
    const matchesSearch = person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         person.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         person.purpose.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || person.type === filterType;
    const matchesStatus = filterStatus === 'all' || person.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleEmergencyRollCall = () => {
    const onSitePeople = peopleOnSite.filter(p => p.status === 'on_site');
    
    // Generate CSV content for emergency services
    const csvHeaders = ['Name', 'Type', 'Company', 'Phone', 'Emergency Contact', 'Emergency Phone', 'Sign In Time', 'Location', 'Vehicle', 'Host'];
    const csvContent = [
      csvHeaders.join(','),
      ...onSitePeople.map(person => [
        person.name,
        person.type,
        person.company || '',
        person.phone,
        person.emergencyContact,
        person.emergencyPhone,
        new Date(person.signInTime).toLocaleString(),
        person.siteLocation || '',
        `${person.vehicleType || ''} (${person.vehicleRegistration || ''})`,
        person.hostEmployee || ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emergency-roll-call-${new Date().toISOString().split('T')[0]}-${new Date().toTimeString().split(' ')[0].replace(/:/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleSignOut = (personId: string) => {
    setPeopleOnSite(prev => prev.map(person => 
      person.id === personId 
        ? { ...person, signOutTime: new Date().toISOString(), status: 'off_site' as const }
        : person
    ));
  };

  const handleSignIn = (personId: string) => {
    setPeopleOnSite(prev => prev.map(person => 
      person.id === personId 
        ? { ...person, signInTime: new Date().toISOString(), signOutTime: undefined, status: 'on_site' as const }
        : person
    ));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'employee': return User;
      case 'visitor': return Users;
      case 'contractor': return Construction;
      default: return User;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'employee': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'visitor': return 'bg-green-100 text-green-800 border-green-200';
      case 'contractor': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on_site': return 'bg-green-100 text-green-800 border-green-200';
      case 'off_site': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getVehicleIcon = (type?: string) => {
    switch (type) {
      case 'car': return Car;
      case 'truck': return Truck;
      default: return Car;
    }
  };

  return (
    <div className="space-y-6">
      {/* Site Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-pulse-forest">{siteStats.totalOnSite}</div>
            <div className="text-sm text-gray-600">On Site</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{siteStats.employees}</div>
            <div className="text-sm text-gray-600">Employees</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{siteStats.visitors}</div>
            <div className="text-sm text-gray-600">Visitors</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{siteStats.contractors}</div>
            <div className="text-sm text-gray-600">Contractors</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{siteStats.pendingInductions}</div>
            <div className="text-sm text-gray-600">Pending Induction</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{siteStats.emergencyReady}</div>
            <div className="text-sm text-gray-600">Emergency Ready</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-pulse-forest" />
              People & Visitor Management
            </CardTitle>
            <div className="flex gap-2">
              <Dialog open={isSignInOpen} onOpenChange={setIsSignInOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-pulse-forest hover:bg-pulse-forest-dark text-white">
                    <DoorOpen className="h-4 w-4 mr-2" />
                    Sign In Person
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Sign In Person to Site</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Full Name *</Label>
                        <Input id="name" placeholder="Enter full name" />
                      </div>
                      <div>
                        <Label htmlFor="type">Person Type *</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employee">Employee</SelectItem>
                            <SelectItem value="visitor">Visitor</SelectItem>
                            <SelectItem value="contractor">Contractor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone">Phone Number *</Label>
                        <Input id="phone" placeholder="+64 21 123 4567" />
                      </div>
                      <div>
                        <Label htmlFor="email">Email Address</Label>
                        <Input id="email" type="email" placeholder="email@example.com" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="company">Company/Organization</Label>
                      <Input id="company" placeholder="Company name (if applicable)" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="emergencyContact">Emergency Contact *</Label>
                        <Input id="emergencyContact" placeholder="Emergency contact name" />
                      </div>
                      <div>
                        <Label htmlFor="emergencyPhone">Emergency Phone *</Label>
                        <Input id="emergencyPhone" placeholder="+64 21 987 6543" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="purpose">Purpose of Visit *</Label>
                      <Input id="purpose" placeholder="Reason for site access" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="vehicleType">Vehicle Type</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vehicle" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="car">Car</SelectItem>
                            <SelectItem value="truck">Truck</SelectItem>
                            <SelectItem value="motorcycle">Motorcycle</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="vehicleReg">Vehicle Registration</Label>
                        <Input id="vehicleReg" placeholder="ABC123" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1 bg-pulse-forest hover:bg-pulse-forest-dark text-white">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Complete Sign In
                      </Button>
                      <Button variant="outline" onClick={() => setIsSignInOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" className="bg-red-50 border-red-200 text-red-600 hover:bg-red-100" onClick={handleEmergencyRollCall}>
                <Download className="h-4 w-4 mr-2" />
                Emergency Roll Call
              </Button>
              <Button variant="outline">
                <QrCode className="h-4 w-4 mr-2" />
                Generate QR Codes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by name, company, or purpose..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="employee">Employees</SelectItem>
                <SelectItem value="visitor">Visitors</SelectItem>
                <SelectItem value="contractor">Contractors</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="on_site">On Site</SelectItem>
                <SelectItem value="off_site">Off Site</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* People List */}
          <div className="space-y-4">
            {filteredPeople.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No people found</p>
                  <p className="text-sm text-gray-400 mt-2">Try adjusting your search or filters</p>
                </CardContent>
              </Card>
            ) : (
              filteredPeople.map(person => {
                const TypeIcon = getTypeIcon(person.type);
                const VehicleIcon = getVehicleIcon(person.vehicleType);
                
                return (
                  <Card key={person.id} className={`${
                    person.status === 'on_site' ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
                  }`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          {/* Avatar/Photo */}
                          <div className="w-12 h-12 bg-pulse-100 rounded-full flex items-center justify-center">
                            {person.photoUrl ? (
                              <img src={person.photoUrl} alt={person.name} className="w-12 h-12 rounded-full object-cover" />
                            ) : (
                              <TypeIcon className="h-6 w-6 text-pulse-forest" />
                            )}
                          </div>
                          
                          {/* Person Details */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900">{person.name}</h3>
                              <Badge className={getTypeColor(person.type)}>
                                {person.type.replace('_', ' ')}
                              </Badge>
                              <Badge className={getStatusColor(person.status)}>
                                {person.status === 'on_site' ? (
                                  <><UserCheck className="h-3 w-3 mr-1" />On Site</>
                                ) : (
                                  <><UserX className="h-3 w-3 mr-1" />Off Site</>
                                )}
                              </Badge>
                              {!person.inductionCompleted && person.status === 'on_site' && (
                                <Badge variant="outline" className="border-red-200 text-red-600">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Pending Induction
                                </Badge>
                              )}
                            </div>
                            
                            {person.company && (
                              <p className="text-sm text-gray-600 mb-2">{person.company}</p>
                            )}
                            
                            <p className="text-sm text-gray-600 mb-3">
                              <strong>Purpose:</strong> {person.purpose}
                              {person.hostEmployee && <span> • <strong>Host:</strong> {person.hostEmployee}</span>}
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                <span>{person.phone}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <span>Emergency: {person.emergencyContact} ({person.emergencyPhone})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>
                                  {person.status === 'on_site' ? 'Signed In' : 'Signed Out'}: 
                                  {' '}{new Date(
                                    person.status === 'on_site' ? person.signInTime : person.signOutTime!
                                  ).toLocaleString()}
                                </span>
                              </div>
                              {person.vehicleType && (
                                <div className="flex items-center gap-2">
                                  <VehicleIcon className="h-4 w-4" />
                                  <span>{person.vehicleType} ({person.vehicleRegistration})</span>
                                </div>
                              )}
                              {person.siteLocation && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4" />
                                  <span>{person.siteLocation}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                <span>Access: {person.accessLevel}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          {person.status === 'on_site' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSignOut(person.id)}
                              className="border-red-200 text-red-600 hover:bg-red-50"
                            >
                              <DoorClosed className="h-4 w-4 mr-2" />
                              Sign Out
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSignIn(person.id)}
                              className="border-green-200 text-green-600 hover:bg-green-50"
                            >
                              <DoorOpen className="h-4 w-4 mr-2" />
                              Sign In
                            </Button>
                          )}
                          <Button size="sm" variant="outline">
                            <Camera className="h-4 w-4 mr-2" />
                            Photo
                          </Button>
                          <Button size="sm" variant="outline">
                            <QrCode className="h-4 w-4 mr-2" />
                            QR Code
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
