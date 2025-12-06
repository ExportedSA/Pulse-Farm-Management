import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users, 
  UserPlus, 
  Search, 
  Phone, 
  Mail, 
  Calendar, 
  Clock, 
  Award, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Edit,
  Trash2,
  Building2,
  Briefcase,
  DollarSign,
  Filter,
  Download,
  Upload
} from 'lucide-react';
import { pulseGet, pulsePost, pulsePut, pulseDelete } from '@/lib/pulseApi';
import { toast } from 'sonner';

interface StaffMember {
  id: string;
  userId: string;
  employeeId?: string;
  position?: string;
  department?: string;
  phone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  startDate?: string;
  endDate?: string;
  employmentType?: string;
  hourlyRate?: string;
  notes?: string;
  isActive: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  certifications?: Certification[];
}

interface Certification {
  id: string;
  staffProfileId: string;
  name: string;
  type?: string;
  issuingBody?: string;
  certificateNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  documentUrl?: string;
  status?: string;
  reminderDays?: number;
  notes?: string;
}

interface Timesheet {
  id: string;
  staffProfileId: string;
  date: string;
  startTime: string;
  endTime?: string;
  breakMinutes?: number;
  totalHours?: string;
  taskDescription?: string;
  location?: string;
  status: string;
  staffName?: string;
}

export default function StaffManagementPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isAddCertOpen, setIsAddCertOpen] = useState(false);
  const [isTimesheetOpen, setIsTimesheetOpen] = useState(false);

  // Fetch staff
  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff', statusFilter, departmentFilter],
    queryFn: () => pulseGet<StaffMember[]>(`/staff?active=${statusFilter === 'active'}`),
  });

  // Fetch timesheets
  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => pulseGet<Timesheet[]>('/staff/timesheets/all'),
  });

  // Filter staff
  const filteredStaff = staff.filter(s => {
    const matchesSearch = !searchQuery || 
      s.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.position?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDepartment = departmentFilter === 'all' || s.department === departmentFilter;
    
    return matchesSearch && matchesDepartment;
  });

  // Get unique departments
  const departments = Array.from(new Set(staff.map(s => s.department).filter(Boolean)));

  // Stats
  const activeStaff = staff.filter(s => s.isActive).length;
  const pendingTimesheets = timesheets.filter(t => t.status === 'pending').length;
  const expiringCerts = staff.flatMap(s => s.certifications || [])
    .filter(c => {
      if (!c.expiryDate) return false;
      const expiry = new Date(c.expiryDate);
      const daysUntil = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 30 && daysUntil > 0;
    }).length;

  const getEmploymentTypeBadge = (type?: string) => {
    const colors: Record<string, string> = {
      full_time: 'bg-green-100 text-green-800',
      part_time: 'bg-blue-100 text-blue-800',
      casual: 'bg-yellow-100 text-yellow-800',
      seasonal: 'bg-orange-100 text-orange-800',
    };
    const labels: Record<string, string> = {
      full_time: 'Full Time',
      part_time: 'Part Time',
      casual: 'Casual',
      seasonal: 'Seasonal',
    };
    return (
      <Badge className={colors[type || 'full_time'] || 'bg-gray-100 text-gray-800'}>
        {labels[type || 'full_time'] || type}
      </Badge>
    );
  };

  const getCertStatusBadge = (cert: Certification) => {
    if (!cert.expiryDate) return <Badge variant="secondary">No Expiry</Badge>;
    
    const expiry = new Date(cert.expiryDate);
    const daysUntil = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) {
      return <Badge variant="destructive">Expired</Badge>;
    } else if (daysUntil <= 30) {
      return <Badge className="bg-yellow-100 text-yellow-800">Expiring Soon</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">Valid</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-500 mt-1">Manage your farm team, certifications, and timesheets</p>
        </div>
        <Button onClick={() => setIsAddStaffOpen(true)} className="bg-pulse-forest hover:bg-pulse-forest-dark">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Staff Member
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Staff</p>
                <p className="text-2xl font-bold">{activeStaff}</p>
              </div>
              <Users className="h-8 w-8 text-pulse-forest" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Departments</p>
                <p className="text-2xl font-bold">{departments.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Timesheets</p>
                <p className="text-2xl font-bold">{pendingTimesheets}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Expiring Certs</p>
                <p className="text-2xl font-bold">{expiringCerts}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="directory">Staff Directory</TabsTrigger>
          <TabsTrigger value="certifications">Certifications</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
        </TabsList>

        {/* Staff Directory Tab */}
        <TabsContent value="directory" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff..."
                className="pl-10"
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept!}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Staff Grid */}
          {isLoading ? (
            <div className="text-center py-8">Loading staff...</div>
          ) : filteredStaff.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No staff members found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaff.map(member => (
                <Card key={member.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedStaff(member)}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-pulse-forest text-white">
                          {member.user?.name?.charAt(0).toUpperCase() || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900 truncate">{member.user?.name || 'Unknown'}</h3>
                          {getEmploymentTypeBadge(member.employmentType)}
                        </div>
                        <p className="text-sm text-gray-500">{member.position || 'No position'}</p>
                        <p className="text-xs text-gray-400">{member.department || 'No department'}</p>
                        
                        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                          {member.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {member.phone}
                            </span>
                          )}
                          {member.user?.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3" />
                              {member.user.email}
                            </span>
                          )}
                        </div>
                        
                        {member.startDate && (
                          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Started: {new Date(member.startDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Certifications Tab */}
        <TabsContent value="certifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff Certifications & Training</CardTitle>
              <CardDescription>Track licenses, certifications, and training records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {staff.flatMap(s => 
                  (s.certifications || []).map(cert => ({
                    ...cert,
                    staffName: s.user?.name,
                    staffId: s.id,
                  }))
                ).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Award className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p>No certifications recorded yet</p>
                    <p className="text-sm">Add certifications to staff profiles to track them here</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {staff.flatMap(s => 
                      (s.certifications || []).map(cert => (
                        <div key={cert.id} className="py-4 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="bg-pulse-forest/10 p-2 rounded-lg">
                              <Award className="h-5 w-5 text-pulse-forest" />
                            </div>
                            <div>
                              <p className="font-medium">{cert.name}</p>
                              <p className="text-sm text-gray-500">{s.user?.name} • {cert.issuingBody || 'Unknown issuer'}</p>
                              {cert.expiryDate && (
                                <p className="text-xs text-gray-400">
                                  Expires: {new Date(cert.expiryDate).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          {getCertStatusBadge(cert)}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timesheets Tab */}
        <TabsContent value="timesheets" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Timesheet Entries</h3>
              <p className="text-sm text-gray-500">Review and approve staff timesheets</p>
            </div>
            <Button onClick={() => setIsTimesheetOpen(true)}>
              <Clock className="h-4 w-4 mr-2" />
              Add Entry
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              {timesheets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p>No timesheet entries yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium">Staff</th>
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium">Time</th>
                        <th className="pb-3 font-medium">Hours</th>
                        <th className="pb-3 font-medium">Task</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timesheets.map(ts => (
                        <tr key={ts.id} className="border-b">
                          <td className="py-3">{ts.staffName || 'Unknown'}</td>
                          <td className="py-3">{new Date(ts.date).toLocaleDateString()}</td>
                          <td className="py-3">{ts.startTime} - {ts.endTime || 'In progress'}</td>
                          <td className="py-3">{ts.totalHours || '-'}</td>
                          <td className="py-3 max-w-xs truncate">{ts.taskDescription || '-'}</td>
                          <td className="py-3">
                            <Badge className={
                              ts.status === 'approved' ? 'bg-green-100 text-green-800' :
                              ts.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {ts.status}
                            </Badge>
                          </td>
                          <td className="py-3">
                            {ts.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost" className="text-green-600">
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-600">
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Staff Detail Dialog */}
      <Dialog open={!!selectedStaff} onOpenChange={() => setSelectedStaff(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Staff Details</DialogTitle>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-pulse-forest text-white text-xl">
                    {selectedStaff.user?.name?.charAt(0).toUpperCase() || 'S'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-semibold">{selectedStaff.user?.name}</h2>
                  <p className="text-gray-500">{selectedStaff.position}</p>
                  <div className="flex gap-2 mt-2">
                    {getEmploymentTypeBadge(selectedStaff.employmentType)}
                    <Badge variant={selectedStaff.isActive ? 'default' : 'secondary'}>
                      {selectedStaff.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Employee ID</Label>
                  <p>{selectedStaff.employeeId || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Department</Label>
                  <p>{selectedStaff.department || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Email</Label>
                  <p>{selectedStaff.user?.email || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Phone</Label>
                  <p>{selectedStaff.phone || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Start Date</Label>
                  <p>{selectedStaff.startDate ? new Date(selectedStaff.startDate).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Hourly Rate</Label>
                  <p>{selectedStaff.hourlyRate ? `$${selectedStaff.hourlyRate}` : '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Emergency Contact</Label>
                  <p>{selectedStaff.emergencyContact || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Emergency Phone</Label>
                  <p>{selectedStaff.emergencyPhone || '-'}</p>
                </div>
              </div>

              {selectedStaff.notes && (
                <div>
                  <Label className="text-gray-500">Notes</Label>
                  <p className="text-sm">{selectedStaff.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedStaff(null)}>Close</Button>
                <Button className="bg-pulse-forest">Edit Profile</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Staff Dialog */}
      <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Employee ID</Label>
                <Input placeholder="EMP001" />
              </div>
              <div>
                <Label>Position</Label>
                <Input placeholder="Farm Worker" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Department</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="management">Management</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Employment Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input placeholder="021 123 4567" />
              </div>
              <div>
                <Label>Start Date</Label>
                <Input type="date" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hourly Rate ($)</Label>
                <Input type="number" placeholder="25.00" />
              </div>
            </div>
            <div>
              <Label>Emergency Contact</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input placeholder="Contact name" />
                <Input placeholder="Contact phone" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStaffOpen(false)}>Cancel</Button>
            <Button className="bg-pulse-forest" onClick={() => {
              toast.success('Staff member added');
              setIsAddStaffOpen(false);
            }}>Add Staff</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
