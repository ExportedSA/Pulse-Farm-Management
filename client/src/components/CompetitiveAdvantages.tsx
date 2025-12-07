import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, 
  Wifi, 
  WifiOff, 
  Cloud, 
  CloudDownload, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Shield,
  Database,
  Smartphone,
  Zap,
  Users,
  FileText,
  Settings
} from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';

interface NZComplianceFeature {
  id: string;
  name: string;
  status: 'compliant' | 'pending' | 'overdue';
  dueDate?: Date;
  description: string;
  naitRequired: boolean;
}

interface OfflineDataStatus {
  measurements: { pending: number; synced: number };
  treatments: { pending: number; synced: number };
  naitRecords: { pending: number; synced: number };
  totalStorage: number;
  maxStorage: number;
}

interface CompetitiveAdvantagesProps {
  farmId: string;
  onFeatureClick?: (feature: string) => void;
}

const CompetitiveAdvantages: React.FC<CompetitiveAdvantagesProps> = ({ 
  farmId, 
  onFeatureClick 
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineStatus, setOfflineStatus] = useState<OfflineDataStatus>({
    measurements: { pending: 3, synced: 145 },
    treatments: { pending: 1, synced: 89 },
    naitRecords: { pending: 2, synced: 234 },
    totalStorage: 12.4,
    maxStorage: 50
  });

  // NZ-Specific compliance features
  const nzComplianceFeatures: NZComplianceFeature[] = [
    {
      id: 'nait-movement',
      name: 'NAIT Animal Movement Recording',
      status: 'compliant',
      description: 'All animal movements recorded and synced with NAIT database',
      naitRequired: true
    },
    {
      id: 'grazing-certificate',
      name: 'Grazing Certificate Management',
      status: 'pending',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      description: 'Annual grazing certificate due for MPI compliance',
      naitRequired: false
    },
    {
      id: 'treatment-records',
      name: 'Animal Treatment Records',
      status: 'compliant',
      description: 'All treatments recorded with MPI compliant documentation',
      naitRequired: true
    },
    {
      id: 'feed-compliance',
      name: 'Feed Budget & Pasture Management',
      status: 'compliant',
      description: 'Pasture measurements meet NZ industry standards',
      naitRequired: false
    },
    {
      id: 'biosecurity',
      name: 'Biosecurity Protocols',
      status: 'overdue',
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      description: 'Biosecurity plan review required by MPI',
      naitRequired: false
    }
  ];

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

  const syncAllData = async () => {
    // Simulate sync process
    setOfflineStatus(prev => ({
      ...prev,
      measurements: { pending: 0, synced: prev.measurements.synced + prev.measurements.pending },
      treatments: { pending: 0, synced: prev.treatments.synced + prev.treatments.pending },
      naitRecords: { pending: 0, synced: prev.naitRecords.synced + prev.naitRecords.pending }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header with Competitive Positioning */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <Shield className="h-5 w-5" />
            NZ's Leading Farm Management Platform
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <MapPin className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="font-medium text-green-800">NZ-Specific</h4>
              <p className="text-sm text-green-700">Built for NZ farmers with MPI & NAIT integration</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <WifiOff className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="font-medium text-blue-800">Offline-First</h4>
              <p className="text-sm text-blue-700">Works anywhere, even without cell coverage</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <h4 className="font-medium text-purple-800">Integrated Platform</h4>
              <p className="text-sm text-purple-700">Pasture + Animals + Treatments + Compliance</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Smartphone className="h-6 w-6 text-orange-600" />
              </div>
              <h4 className="font-medium text-orange-800">Simple UX</h4>
              <p className="text-sm text-orange-700">Modern, mobile-first design anyone can use</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="nz-compliance" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="nz-compliance">NZ Compliance</TabsTrigger>
          <TabsTrigger value="offline-first">Offline-First</TabsTrigger>
          <TabsTrigger value="integrated">Integrated Platform</TabsTrigger>
          <TabsTrigger value="simple-ux">Simple UX</TabsTrigger>
        </TabsList>

        {/* NZ-Specific Compliance Tab */}
        <TabsContent value="nz-compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                NZ Farm Compliance & NAIT Integration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>Fully MPI Compliant:</strong> Our platform meets all NZ agricultural regulations 
                    and integrates directly with NAIT for seamless animal traceability.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Compliance Status
                    </h4>
                    <div className="space-y-2">
                      {nzComplianceFeatures.map((feature) => (
                        <div 
                          key={feature.id}
                          className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                          onClick={() => onFeatureClick?.(feature.id)}
                        >
                          <div className="flex items-center gap-3">
                            {getStatusIcon(feature.status)}
                            <div>
                              <p className="font-medium">{feature.name}</p>
                              <p className="text-sm text-muted-foreground">{feature.description}</p>
                              {feature.dueDate && (
                                <p className="text-xs text-muted-foreground">
                                  Due: {format(feature.dueDate, 'MMM d, yyyy')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {feature.naitRequired && (
                              <Badge variant="outline" className="text-blue-600">
                                NAIT
                              </Badge>
                            )}
                            <Badge className={getStatusColor(feature.status)}>
                              {feature.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      NZ-Specific Features
                    </h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <h5 className="font-medium text-blue-800">NAIT Integration</h5>
                        <p className="text-sm text-blue-700">
                          Direct API integration with NAIT database for real-time animal movement recording
                        </p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <h5 className="font-medium text-green-800">MPI Reporting</h5>
                        <p className="text-sm text-green-700">
                          One-click MPI compliance reports with all required documentation
                        </p>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <h5 className="font-medium text-purple-800">NZ Weather Integration</h5>
                        <p className="text-sm text-purple-700">
                          MetService weather data for accurate pasture growth predictions
                        </p>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <h5 className="font-medium text-orange-800">Local Regulations</h5>
                        <p className="text-sm text-orange-700">
                          Regional council compliance rules automatically applied
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Offline-First Tab */}
        <TabsContent value="offline-first" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isOnline ? <Wifi className="h-5 w-5 text-green-600" /> : <WifiOff className="h-5 w-5 text-orange-600" />}
                Offline-First Capability
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert className={isOnline ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}>
                  {isOnline ? (
                    <>
                      <Wifi className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        <strong>Online:</strong> All data syncing automatically. {offlineStatus.measurements.pending + offlineStatus.treatments.pending + offlineStatus.naitRecords.pending} items pending sync.
                      </AlertDescription>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-800">
                        <strong>Offline Mode:</strong> Continue working without internet. Data will sync when connection is restored.
                      </AlertDescription>
                    </>
                  )}
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Offline Data Status</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">Pasture Measurements</span>
                          <Badge variant={offlineStatus.measurements.pending > 0 ? "secondary" : "default"}>
                            {offlineStatus.measurements.pending} pending
                          </Badge>
                        </div>
                        <Progress value={(offlineStatus.measurements.synced / (offlineStatus.measurements.synced + offlineStatus.measurements.pending)) * 100} />
                        <p className="text-xs text-muted-foreground mt-1">
                          {offlineStatus.measurements.synced} synced, {offlineStatus.measurements.pending} pending
                        </p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">Animal Treatments</span>
                          <Badge variant={offlineStatus.treatments.pending > 0 ? "secondary" : "default"}>
                            {offlineStatus.treatments.pending} pending
                          </Badge>
                        </div>
                        <Progress value={(offlineStatus.treatments.synced / (offlineStatus.treatments.synced + offlineStatus.treatments.pending)) * 100} />
                        <p className="text-xs text-muted-foreground mt-1">
                          {offlineStatus.treatments.synced} synced, {offlineStatus.treatments.pending} pending
                        </p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">NAIT Records</span>
                          <Badge variant={offlineStatus.naitRecords.pending > 0 ? "secondary" : "default"}>
                            {offlineStatus.naitRecords.pending} pending
                          </Badge>
                        </div>
                        <Progress value={(offlineStatus.naitRecords.synced / (offlineStatus.naitRecords.synced + offlineStatus.naitRecords.pending)) * 100} />
                        <p className="text-xs text-muted-foreground mt-1">
                          {offlineStatus.naitRecords.synced} synced, {offlineStatus.naitRecords.pending} pending
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <Button 
                        onClick={syncAllData} 
                        disabled={!isOnline || (offlineStatus.measurements.pending + offlineStatus.treatments.pending + offlineStatus.naitRecords.pending) === 0}
                        className="w-full"
                      >
                        <CloudDownload className="h-4 w-4 mr-2" />
                        Sync All Data
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Offline Capabilities</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                        <Database className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">Local Storage</p>
                          <p className="text-sm text-green-700">
                            {offlineStatus.totalStorage}MB of {offlineStatus.maxStorage}MB used
                          </p>
                          <Progress value={(offlineStatus.totalStorage / offlineStatus.maxStorage) * 100} className="mt-1" />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                        <Smartphone className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-blue-800">Mobile Optimized</p>
                          <p className="text-sm text-blue-700">
                            Full functionality on phones and tablets
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                        <Cloud className="h-5 w-5 text-purple-600" />
                        <div>
                          <p className="font-medium text-purple-800">Auto-Sync</p>
                          <p className="text-sm text-purple-700">
                            Background sync when connection available
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                        <Shield className="h-5 w-5 text-orange-600" />
                        <div>
                          <p className="font-medium text-orange-800">Data Integrity</p>
                          <p className="text-sm text-orange-700">
                            Conflict resolution and backup protection
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrated Platform Tab */}
        <TabsContent value="integrated" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All-in-One Farm Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert className="border-purple-200 bg-purple-50">
                  <Users className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="text-purple-800">
                    <strong>Complete Integration:</strong> Unlike competitors that require multiple apps, 
                    our platform combines pasture management, animal tracking, treatments, and compliance in one seamless system.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Integrated Modules</h4>
                    <div className="space-y-3">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4 text-green-600" />
                            Pasture Management
                          </h5>
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Feed wedge, growth rates, rotation planning, and satellite integration
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium flex items-center gap-2">
                            <Users className="h-4 w-4 text-blue-600" />
                            Animal Management
                          </h5>
                          <Badge className="bg-blue-100 text-blue-800">Active</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          NAIT integration, health records, breeding, and performance tracking
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium flex items-center gap-2">
                            <Shield className="h-4 w-4 text-purple-600" />
                            Treatment Tracking
                          </h5>
                          <Badge className="bg-purple-100 text-purple-800">Active</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Treatment schedules, withdrawal periods, and MPI compliance
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4 text-orange-600" />
                            Compliance & Reporting
                          </h5>
                          <Badge className="bg-orange-100 text-orange-800">Active</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          MPI reports, NAIT compliance, and audit documentation
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Competitive Advantages</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <h5 className="font-medium text-green-800">Single Source of Truth</h5>
                        <p className="text-sm text-green-700">
                          No more data entry across multiple systems - one platform for everything
                        </p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <h5 className="font-medium text-blue-800">Cross-Module Insights</h5>
                        <p className="text-sm text-blue-700">
                          Animal health impacts pasture planning - our system connects the dots
                        </p>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <h5 className="font-medium text-purple-800">Unified Reporting</h5>
                        <p className="text-sm text-purple-700">
                          Generate comprehensive reports combining all farm data in minutes
                        </p>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <h5 className="font-medium text-orange-800">Cost Effective</h5>
                        <p className="text-sm text-orange-700">
                          One subscription vs. multiple tools from different providers
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Simple UX Tab */}
        <TabsContent value="simple-ux" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Modern, User-Friendly Design
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert className="border-orange-200 bg-orange-50">
                  <Smartphone className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    <strong>Designed for Farmers:</strong> Intuitive interface that works on any device. 
                    No complex training required - start using it in minutes, not weeks.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">UX Advantages vs Competitors</h4>
                    <div className="space-y-3">
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium">Learning Curve</h5>
                          <div className="flex gap-1">
                            <div className="w-8 h-2 bg-green-500 rounded"></div>
                            <div className="w-8 h-2 bg-green-500 rounded"></div>
                            <div className="w-8 h-2 bg-green-500 rounded"></div>
                            <div className="w-8 h-2 bg-green-500 rounded"></div>
                            <div className="w-8 h-2 bg-gray-200 rounded"></div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <strong>Our Platform:</strong> 15 minutes to get started
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <strong>AgriNet:</strong> 2-3 days training required
                        </p>
                      </div>

                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium">Mobile Experience</h5>
                          <div className="flex gap-1">
                            <div className="w-8 h-2 bg-green-500 rounded"></div>
                            <div className="w-8 h-2 bg-green-500 rounded"></div>
                            <div className="w-8 h-2 bg-green-500 rounded"></div>
                            <div className="w-8 h-2 bg-green-500 rounded"></div>
                            <div className="w-8 h-2 bg-green-500 rounded"></div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <strong>Our Platform:</strong> Mobile-first responsive design
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <strong>Competitors:</strong> Desktop-focused, poor mobile support
                        </p>
                      </div>

                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium">Data Entry Speed</h5>
                          <div className="flex gap-1">
                            <div className="w-8 h-2 bg-green-500 rounded"></div>
                            <div className="w-8 h-2 bg-green-500 rounded"></div>
                            <div className="w-8 h-2 bg-green-500 rounded"></div>
                            <div className="w-8 h-2 bg-green-500 rounded"></div>
                            <div className="w-8 h-2 bg-gray-200 rounded"></div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <strong>Our Platform:</strong> Quick entry forms, smart defaults
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <strong>Others:</strong> Complex forms, multiple steps
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Modern Features</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                        <Smartphone className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-blue-800">Touch-First Design</p>
                          <p className="text-sm text-blue-700">
                            Large buttons, swipe gestures, and mobile optimization
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                        <Zap className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">Smart Suggestions</p>
                          <p className="text-sm text-green-700">
                            AI-powered recommendations and predictive text
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                        <Settings className="h-5 w-5 text-purple-600" />
                        <div>
                          <p className="font-medium text-purple-800">Customizable Dashboard</p>
                          <p className="text-sm text-purple-700">
                            Show what matters to you, hide what you don't need
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                        <Shield className="h-5 w-5 text-orange-600" />
                        <div>
                          <p className="font-medium text-orange-800">Contextual Help</p>
                          <p className="text-sm text-orange-700">
                            In-app guidance and tooltips when you need them
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-blue-800">Try It Yourself</h4>
                      <p className="text-sm text-blue-700">
                        Experience the difference - start your free trial today
                      </p>
                    </div>
                    <Button>
                      Start Free Trial
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompetitiveAdvantages;
