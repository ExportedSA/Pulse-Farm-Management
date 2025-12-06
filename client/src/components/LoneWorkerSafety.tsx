import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  UserX, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Phone, 
  MapPin, 
  Calendar, 
  Activity,
  Bell,
  Shield,
  Users,
  Plus,
  Eye,
  PhoneCall
} from 'lucide-react';

interface LoneWorker {
  id: string;
  name: string;
  role: string;
  phone: string;
  emergencyContact: string;
  emergencyPhone: string;
  location: string;
  checkInInterval: number; // minutes
  lastCheckIn: string;
  nextCheckInDue: string;
  status: 'active' | 'overdue' | 'emergency';
  currentTask: string;
  equipment: string[];
  riskLevel: 'Low' | 'Medium' | 'High';
  escalationLevel: number;
  notes: string;
}

interface CheckInRecord {
  id: string;
  workerId: string;
  timestamp: string;
  location: string;
  status: 'ok' | 'help_needed' | 'emergency';
  notes: string;
}

interface EscalationContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  priority: number;
}

export default function LoneWorkerSafety() {
  const [workers, setWorkers] = useState<LoneWorker[]>([
    {
      id: '1',
      name: 'John Smith',
      role: 'Farm Manager',
      phone: '+64 21 123 4567',
      emergencyContact: 'Mary Smith',
      emergencyPhone: '+64 21 987 6543',
      location: 'North Pasture',
      checkInInterval: 60,
      lastCheckIn: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      nextCheckInDue: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      status: 'active',
      currentTask: 'Cattle inspection',
      equipment: ['ATV', 'First Aid Kit', 'Radio'],
      riskLevel: 'Medium',
      escalationLevel: 0,
      notes: 'Working in remote area'
    },
    {
      id: '2',
      name: 'Sarah Wilson',
      role: 'Veterinarian',
      phone: '+64 21 234 5678',
      emergencyContact: 'David Wilson',
      emergencyPhone: '+64 21 876 5432',
      location: 'Dairy Shed',
      checkInInterval: 30,
      lastCheckIn: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      nextCheckInDue: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      status: 'overdue',
      currentTask: 'Animal health check',
      equipment: ['Medical Kit', 'Phone'],
      riskLevel: 'Low',
      escalationLevel: 1,
      notes: 'Overdue for check-in'
    }
  ]);

  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([
    {
      id: '1',
      workerId: '1',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      location: 'North Pasture',
      status: 'ok',
      notes: 'All good, proceeding with inspection'
    }
  ]);

  const [escalationContacts, setEscalationContacts] = useState<EscalationContact[]>([
    {
      id: '1',
      name: 'Tom Brown',
      role: 'Safety Manager',
      phone: '+64 21 345 6789',
      email: 'tom@pulsefarm.nz',
      priority: 1
    },
    {
      id: '2',
      name: 'Emergency Services',
      role: 'Emergency',
      phone: '111',
      email: '',
      priority: 2
    }
  ]);

  const [isWorkerSetupOpen, setIsWorkerSetupOpen] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<LoneWorker | null>(null);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setWorkers(prev => prev.map(worker => {
        const now = new Date();
        const nextDue = new Date(worker.nextCheckInDue);
        
        if (now > nextDue && worker.status === 'active') {
          // Worker is now overdue
          return {
            ...worker,
            status: 'overdue',
            escalationLevel: Math.min(worker.escalationLevel + 1, 3)
          };
        }
        
        return worker;
      }));
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const handleCheckIn = (workerId: string, status: 'ok' | 'help_needed' | 'emergency', notes: string) => {
    const now = new Date();
    const worker = workers.find(w => w.id === workerId);
    
    if (!worker) return;

    const newCheckIn: CheckInRecord = {
      id: Date.now().toString(),
      workerId,
      timestamp: now.toISOString(),
      location: worker.location,
      status,
      notes
    };

    setCheckIns(prev => [newCheckIn, ...prev]);

    // Update worker status
    setWorkers(prev => prev.map(w => {
      if (w.id === workerId) {
        const nextDue = new Date(now.getTime() + w.checkInInterval * 60 * 1000);
        return {
          ...w,
          lastCheckIn: now.toISOString(),
          nextCheckInDue: nextDue.toISOString(),
          status: status === 'emergency' ? 'emergency' : 'active',
          escalationLevel: status === 'emergency' ? 3 : 0
        };
      }
      return w;
    }));

    // Trigger escalation if needed
    if (status === 'emergency') {
      triggerEscalation(workerId);
    }

    setIsCheckInOpen(false);
  };

  const triggerEscalation = (workerId: string) => {
    const worker = workers.find(w => w.id === workerId);
    if (!worker) return;

    // In a real system, this would send notifications
    console.log('EMERGENCY ESCALATION TRIGGERED:', {
      worker: worker.name,
      location: worker.location,
      phone: worker.phone,
      emergencyContact: worker.emergencyContact,
      emergencyPhone: worker.emergencyPhone
    });

    alert(`Emergency escalation triggered for ${worker.name}. Contacting ${worker.emergencyContact} at ${worker.emergencyPhone}`);
  };

  const handleManualCheckIn = () => {
    if (!selectedWorker) return;
    
    handleCheckIn(selectedWorker.id, 'ok', 'Manual check-in completed');
    setSelectedWorker(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'overdue': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'emergency': return 'bg-red-100 text-red-800 border-red-200';
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

  const getEscalationColor = (level: number) => {
    switch (level) {
      case 0: return 'bg-green-100 text-green-800';
      case 1: return 'bg-yellow-100 text-yellow-800';
      case 2: return 'bg-orange-100 text-orange-800';
      case 3: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const activeWorkers = workers.filter(w => w.status === 'active').length;
  const overdueWorkers = workers.filter(w => w.status === 'overdue').length;
  const emergencyWorkers = workers.filter(w => w.status === 'emergency').length;

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{activeWorkers}</div>
            <div className="text-sm text-gray-600">Active Workers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{overdueWorkers}</div>
            <div className="text-sm text-gray-600">Overdue Check-ins</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{emergencyWorkers}</div>
            <div className="text-sm text-gray-600">Emergency</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{workers.length}</div>
            <div className="text-sm text-gray-600">Total Workers</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="workers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="workers">
            <Users className="h-4 w-4 mr-2" />
            Active Workers
          </TabsTrigger>
          <TabsTrigger value="checkins">
            <Activity className="h-4 w-4 mr-2" />
            Check-ins
          </TabsTrigger>
          <TabsTrigger value="escalation">
            <Bell className="h-4 w-4 mr-2" />
            Escalation
          </TabsTrigger>
        </TabsList>

        {/* Active Workers Tab */}
        <TabsContent value="workers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <UserX className="h-5 w-5 text-pulse-forest" />
                  Lone Worker Monitoring
                </CardTitle>
                <div className="flex gap-2">
                  <Dialog open={isWorkerSetupOpen} onOpenChange={setIsWorkerSetupOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-pulse-forest hover:bg-pulse-forest-dark text-white">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Worker
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Setup Lone Worker</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="workerName">Worker Name *</Label>
                            <Input id="workerName" placeholder="Enter worker name" />
                          </div>
                          <div>
                            <Label htmlFor="workerRole">Role *</Label>
                            <Input id="workerRole" placeholder="e.g., Farm Manager, Veterinarian" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="workerPhone">Phone Number *</Label>
                            <Input id="workerPhone" placeholder="+64 21 123 4567" />
                          </div>
                          <div>
                            <Label htmlFor="checkInInterval">Check-in Interval (minutes) *</Label>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="Select interval" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="30">30 minutes</SelectItem>
                                <SelectItem value="60">60 minutes</SelectItem>
                                <SelectItem value="120">120 minutes</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
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
                          <Label htmlFor="currentTask">Current Task</Label>
                          <Input id="currentTask" placeholder="What are they working on?" />
                        </div>
                        <div>
                          <Label htmlFor="location">Current Location</Label>
                          <Input id="location" placeholder="Where are they working?" />
                        </div>
                        <div className="flex gap-2">
                          <Button className="flex-1 bg-pulse-forest hover:bg-pulse-forest-dark text-white">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Setup Worker
                          </Button>
                          <Button variant="outline" onClick={() => setIsWorkerSetupOpen(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <UserX className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No lone workers are currently being monitored</p>
                  </div>
                ) : (
                  workers.map(worker => (
                    <Card key={worker.id} className={`border-l-4 ${
                      worker.status === 'active' ? 'border-l-green-500' : 
                      worker.status === 'overdue' ? 'border-l-orange-500' : 'border-l-red-500'
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{worker.name}</h3>
                              <Badge className={getStatusColor(worker.status)}>
                                {worker.status}
                              </Badge>
                              <Badge className={getRiskColor(worker.riskLevel)}>
                                {worker.riskLevel} Risk
                              </Badge>
                              <Badge className={getEscalationColor(worker.escalationLevel)}>
                                Level {worker.escalationLevel}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                <span>{worker.phone}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                <span>{worker.location}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>Check-in every {worker.checkInInterval}min</span>
                              </div>
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              <strong>Current Task:</strong> {worker.currentTask}
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              <strong>Emergency Contact:</strong> {worker.emergencyContact} ({worker.emergencyPhone})
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>Last check-in: {new Date(worker.lastCheckIn).toLocaleString()}</span>
                              <span>Next due: {new Date(worker.nextCheckInDue).toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedWorker(worker);
                                setIsCheckInOpen(true);
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Check In
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => triggerEscalation(worker.id)}
                            >
                              <PhoneCall className="h-4 w-4 mr-2" />
                              Emergency
                            </Button>
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

        {/* Check-ins Tab */}
        <TabsContent value="checkins" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-pulse-forest" />
                Check-in History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {checkIns.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No check-ins recorded yet</p>
                  </div>
                ) : (
                  checkIns.map(checkIn => {
                    const worker = workers.find(w => w.id === checkIn.workerId);
                    return (
                      <Card key={checkIn.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold">{worker?.name || 'Unknown Worker'}</h3>
                                <Badge variant={
                                  checkIn.status === 'ok' ? 'default' : 
                                  checkIn.status === 'help_needed' ? 'secondary' : 'destructive'
                                }>
                                  {checkIn.status.replace('_', ' ')}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <span>{new Date(checkIn.timestamp).toLocaleString()}</span>
                                <span>{checkIn.location}</span>
                              </div>
                              {checkIn.notes && (
                                <p className="text-sm text-gray-600 mt-2">{checkIn.notes}</p>
                              )}
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
        </TabsContent>

        {/* Escalation Tab */}
        <TabsContent value="escalation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-pulse-forest" />
                Escalation Contacts & Procedures
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {escalationContacts.map(contact => (
                    <Card key={contact.id} className="border-l-4 border-l-purple-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{contact.name}</h3>
                            <p className="text-sm text-gray-600">{contact.role}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                              <span className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                {contact.phone}
                              </span>
                              {contact.email && (
                                <span>{contact.email}</span>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline">
                            Priority {contact.priority}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Escalation Procedures</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div><strong>Level 1:</strong> Worker overdue - SMS notification to supervisor</div>
                    <div><strong>Level 2:</strong> 15 minutes overdue - Phone call to supervisor</div>
                    <div><strong>Level 3:</strong> 30 minutes overdue - Contact emergency services</div>
                    <div><strong>Emergency:</strong> Immediate danger - Call emergency services + emergency contact</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manual Check-in Dialog */}
      <Dialog open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Check-in - {selectedWorker?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select defaultValue="ok">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ok">All OK</SelectItem>
                  <SelectItem value="help_needed">Help Needed</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="checkInNotes">Notes</Label>
              <textarea
                id="checkInNotes"
                className="w-full p-2 border rounded-md"
                rows={3}
                placeholder="Add any notes or observations..."
              />
            </div>
            <div className="flex gap-2">
              <Button 
                className="flex-1 bg-pulse-forest hover:bg-pulse-forest-dark text-white"
                onClick={handleManualCheckIn}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Check-in
              </Button>
              <Button variant="outline" onClick={() => setIsCheckInOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
