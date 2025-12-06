import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Droplets, 
  Sprout, 
  SprayCan, 
  Heart, 
  Leaf, 
  Award,
  FileText,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Microscope,
  Users
} from 'lucide-react';
import EffluentManagementForm from '@/components/EffluentManagementForm';
import FertilizerApplicationForm from '@/components/FertilizerApplicationForm';
import SprayRecordsForm from '@/components/SprayRecordsForm';
import BiosecurityManagement from '@/components/BiosecurityManagement';
import FarmInductionModule from '@/components/FarmInductionModule';

interface ComplianceRecord {
  id: string;
  type: string;
  title: string;
  status: 'compliant' | 'pending' | 'overdue' | 'warning';
  lastUpdated: string;
  nextDue: string;
  regulatoryBody: string[];
}

export default function FarmCompliancePage() {
  const [records, setRecords] = useState<ComplianceRecord[]>([
    {
      id: '1',
      type: 'effluent',
      title: 'Effluent Spreading Record - North Paddock',
      status: 'compliant',
      lastUpdated: '2024-11-28',
      nextDue: '2024-12-05',
      regulatoryBody: ['Regional Council', 'Fonterra', 'Synlait']
    },
    {
      id: '2',
      type: 'fertilizer',
      title: 'Fertilizer Application - Spring 2024',
      status: 'pending',
      lastUpdated: '2024-11-20',
      nextDue: '2024-12-01',
      regulatoryBody: ['AsureQuality', 'Regional Council']
    },
    {
      id: '3',
      type: 'spray',
      title: 'Herbicide Application - Weed Control',
      status: 'compliant',
      lastUpdated: '2024-11-25',
      nextDue: '2024-12-10',
      regulatoryBody: ['AsureQuality', 'NZGAP']
    },
    {
      id: '4',
      type: 'animal_health',
      title: 'Mastitis Treatment Record',
      status: 'warning',
      lastUpdated: '2024-11-15',
      nextDue: '2024-11-30',
      regulatoryBody: ['Fonterra', 'Synlait', 'AsureQuality']
    },
    {
      id: '5',
      type: 'environmental',
      title: 'Water Quality Testing - Stream Monitoring',
      status: 'overdue',
      lastUpdated: '2024-10-15',
      nextDue: '2024-11-15',
      regulatoryBody: ['Regional Council', 'Environmental Protection Authority']
    }
  ]);

  const [activeTab, setActiveTab] = useState('overview');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'warning': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  const getRegulatoryBadgeColor = (body: string) => {
    switch (body) {
      case 'Fonterra': return 'bg-blue-100 text-blue-800';
      case 'Synlait': return 'bg-purple-100 text-purple-800';
      case 'AsureQuality': return 'bg-green-100 text-green-800';
      case 'Regional Council': return 'bg-orange-100 text-orange-800';
      case 'NZGAP': return 'bg-teal-100 text-teal-800';
      case 'Environmental Protection Authority': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const compliantCount = records.filter(r => r.status === 'compliant').length;
  const pendingCount = records.filter(r => r.status === 'pending').length;
  const warningCount = records.filter(r => r.status === 'warning').length;
  const overdueCount = records.filter(r => r.status === 'overdue').length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Farm Compliance Management</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive compliance tracking for AsureQuality, Synlait, Fonterra, and environmental requirements
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{compliantCount}</div>
            <div className="text-sm text-gray-600">Compliant</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{warningCount}</div>
            <div className="text-sm text-gray-600">Warning</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
            <div className="text-sm text-gray-600">Overdue</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview">
            <FileText className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="effluent">
            <Droplets className="h-4 w-4 mr-2" />
            Effluent
          </TabsTrigger>
          <TabsTrigger value="fertilizer">
            <Sprout className="h-4 w-4 mr-2" />
            Fertilizer
          </TabsTrigger>
          <TabsTrigger value="spray">
            <SprayCan className="h-4 w-4 mr-2" />
            Spray Records
          </TabsTrigger>
          <TabsTrigger value="biosecurity">
            <Microscope className="h-4 w-4 mr-2" />
            Biosecurity
          </TabsTrigger>
          <TabsTrigger value="inductions">
            <Users className="h-4 w-4 mr-2" />
            Inductions
          </TabsTrigger>
          <TabsTrigger value="animal_health">
            <Heart className="h-4 w-4 mr-2" />
            Animal Health
          </TabsTrigger>
          <TabsTrigger value="environmental">
            <Leaf className="h-4 w-4 mr-2" />
            Environmental
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Compliance Overview</CardTitle>
                <Button className="bg-pulse-forest hover:bg-pulse-forest-dark text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  New Record
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {records.map(record => (
                  <Card key={record.id} className="border-l-4 border-l-gray-300">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusIcon(record.status)}
                            <h3 className="font-semibold">{record.title}</h3>
                            <Badge className={getStatusColor(record.status)}>
                              {record.status}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {record.regulatoryBody.map(body => (
                              <Badge key={body} className={getRegulatoryBadgeColor(body)}>
                                {body}
                              </Badge>
                            ))}
                          </div>
                          <div className="text-sm text-gray-600">
                            <span>Last updated: {record.lastUpdated}</span>
                            <span className="mx-2">•</span>
                            <span>Next due: {record.nextDue}</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Effluent Management Tab */}
        <TabsContent value="effluent" className="space-y-4 mt-6">
          <EffluentManagementForm />
        </TabsContent>

        {/* Fertilizer Management Tab */}
        <TabsContent value="fertilizer" className="space-y-4 mt-6">
          <FertilizerApplicationForm />
        </TabsContent>

        {/* Spray Records Tab */}
        <TabsContent value="spray" className="space-y-4 mt-6">
          <SprayRecordsForm />
        </TabsContent>

        {/* Biosecurity Tab */}
        <TabsContent value="biosecurity" className="mt-6">
          <BiosecurityManagement />
        </TabsContent>

        {/* Inductions Tab */}
        <TabsContent value="inductions" className="mt-6">
          <FarmInductionModule />
        </TabsContent>

        {/* Animal Health Tab */}
        <TabsContent value="animal_health" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-600" />
                  Animal Health & Treatment Records
                </CardTitle>
                <Button className="bg-pulse-forest hover:bg-pulse-forest-dark text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  New Animal Health Record
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Heart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Animal health and treatment records coming soon</p>
                <p className="text-sm mt-2">Covers: Fonterra, Synlait, AsureQuality milk quality requirements</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Environmental Tab */}
        <TabsContent value="environmental" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Leaf className="h-5 w-5 text-green-600" />
                  Environmental Monitoring
                </CardTitle>
                <Button className="bg-pulse-forest hover:bg-pulse-forest-dark text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  New Environmental Record
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Leaf className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Environmental monitoring and water quality records coming soon</p>
                <p className="text-sm mt-2">Covers: Regional Council, EPA requirements</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quality Assurance Tab */}
        <TabsContent value="quality_assurance" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-600" />
                  Quality Assurance & Audits
                </CardTitle>
                <Button className="bg-pulse-forest hover:bg-pulse-forest-dark text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  New QA Record
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Award className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Quality assurance and audit records coming soon</p>
                <p className="text-sm mt-2">Covers: AsureQuality, NZGAP, processor requirements</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
