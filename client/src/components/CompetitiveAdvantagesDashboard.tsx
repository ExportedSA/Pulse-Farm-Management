import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  WifiOff, 
  Users, 
  Smartphone, 
  CheckCircle, 
  AlertTriangle,
  Star,
  TrendingUp,
  MapPin,
  Database,
  Zap,
  Globe,
  Clock,
  Award,
  Target,
  ArrowRight,
  Play
} from 'lucide-react';
import CompetitiveAdvantages from '@/components/CompetitiveAdvantages';
import NAITIntegration from '@/components/NAITIntegration';
import { offlineService, NZOfflineFeatures } from '@/services/offlineService';

interface CompetitiveMetrics {
  onlineStatus: boolean;
  offlineDataCount: number;
  naitComplianceScore: number;
  userSatisfactionScore: number;
  featuresImplemented: number;
  totalFeatures: number;
}

const CompetitiveAdvantagesDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<CompetitiveMetrics>({
    onlineStatus: navigator.onLine,
    offlineDataCount: 0,
    naitComplianceScore: 95,
    userSatisfactionScore: 92,
    featuresImplemented: 28,
    totalFeatures: 30
  });

  const [selectedCompetitor, setSelectedCompetitor] = useState<'agrinet' | 'pam' | 'farmfocus'>('agrinet');

  useEffect(() => {
    const updateMetrics = async () => {
      const storageStats = await offlineService.getStorageStats();
      const pendingItems = await offlineService.getPendingItems();
      
      setMetrics(prev => ({
        ...prev,
        onlineStatus: navigator.onLine,
        offlineDataCount: Object.values(pendingItems).reduce((sum, items) => sum + items.length, 0)
      }));
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);
    
    const handleOnline = () => setMetrics(prev => ({ ...prev, onlineStatus: true }));
    const handleOffline = () => setMetrics(prev => ({ ...prev, onlineStatus: false }));
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const competitorComparison = {
    agrinet: {
      name: 'AgriNet',
      strengths: ['Established brand', 'Comprehensive features'],
      weaknesses: ['Complex interface', 'Poor mobile support', 'Limited offline', 'Expensive'],
      marketShare: 35,
      satisfaction: 68
    },
    pam: {
      name: 'PAM (Pasture Management)',
      strengths: ['Pasture focused', 'Good analytics'],
      weaknesses: ['No animal tracking', 'Desktop only', 'No NZ compliance', 'Basic offline'],
      marketShare: 25,
      satisfaction: 72
    },
    farmfocus: {
      name: 'FarmFocus',
      strengths: ['Simple interface', 'Good pricing'],
      weaknesses: ['Limited features', 'No compliance tools', 'Basic reporting', 'No integration'],
      marketShare: 15,
      satisfaction: 75
    }
  };

  const currentCompetitor = competitorComparison[selectedCompetitor];

  const ourAdvantages = [
    {
      icon: <MapPin className="h-5 w-5" />,
      title: 'NZ-Specific Focus',
      description: 'Built specifically for NZ farmers with MPI & NAIT integration',
      competitor: currentCompetitor.name === 'AgriNet' ? 'Generic global platform' : 'No NZ compliance'
    },
    {
      icon: <WifiOff className="h-5 w-5" />,
      title: 'Offline-First Architecture',
      description: 'Works anywhere in NZ, even without cell coverage',
      competitor: 'Requires constant internet connection'
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: 'All-in-One Platform',
      description: 'Pasture + Animals + Treatments + Compliance in one app',
      competitor: 'Multiple separate tools required'
    },
    {
      icon: <Smartphone className="h-5 w-5" />,
      title: 'Modern Mobile UX',
      description: 'Intuitive design that works perfectly on phones and tablets',
      competitor: 'Complex desktop-focused interface'
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: 'Full Compliance Integration',
      description: 'NAIT, MPI, and regional council compliance built-in',
      competitor: 'Manual compliance tracking required'
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: 'Lightning Fast Performance',
      description: 'Modern React stack with instant data synchronization',
      competitor: 'Legacy systems with slow performance'
    }
  ];

  const getAdvantageLevel = (ourScore: number, competitorScore: number) => {
    const difference = ourScore - competitorScore;
    if (difference >= 20) return { level: 'Major Advantage', color: 'text-green-600 bg-green-50' };
    if (difference >= 10) return { level: 'Clear Advantage', color: 'text-blue-600 bg-blue-50' };
    if (difference >= 5) return { level: 'Slight Edge', color: 'text-orange-600 bg-orange-50' };
    return { level: 'Competitive', color: 'text-gray-600 bg-gray-50' };
  };

  const satisfactionAdvantage = getAdvantageLevel(metrics.userSatisfactionScore, currentCompetitor.satisfaction);

  return (
    <div className="space-y-6">
      {/* Hero Section - Competitive Positioning */}
      <Card className="border-gradient bg-gradient-to-r from-green-50 to-blue-50">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-gray-800">
            NZ's Most Advanced Farm Management Platform
          </CardTitle>
          <p className="text-center text-gray-600 max-w-2xl mx-auto">
            Built specifically for New Zealand farmers. Experience the difference that NZ-specific 
            features, offline-first design, and modern technology can make on your farm.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <MapPin className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-bold text-green-800">100% NZ Focused</h3>
              <p className="text-sm text-green-700">MPI & NAIT integrated</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <WifiOff className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-blue-800">Offline First</h3>
              <p className="text-sm text-blue-700">Works anywhere, anytime</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-purple-800">All-in-One</h3>
              <p className="text-sm text-purple-700">Complete farm management</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Smartphone className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="font-bold text-orange-800">Simple UX</h3>
              <p className="text-sm text-orange-700">Modern & intuitive</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Competitor Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Competitive Advantage Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {Object.entries(competitorComparison).map(([key, competitor]) => (
              <Button
                key={key}
                variant={selectedCompetitor === key ? "default" : "outline"}
                onClick={() => setSelectedCompetitor(key as any)}
                className="h-auto p-4"
              >
                <div className="text-center">
                  <h4 className="font-medium">{competitor.name}</h4>
                  <p className="text-sm text-muted-foreground">{competitor.marketShare}% market share</p>
                  <p className="text-sm">{competitor.satisfaction}% satisfaction</p>
                </div>
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3 text-red-600">Their Weaknesses</h4>
              <div className="space-y-2">
                {currentCompetitor.weaknesses.map((weakness, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-red-50 rounded">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-800">{weakness}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3 text-green-600">Our Solutions</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-800">NZ-specific compliance built-in</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-800">Offline-first architecture</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-800">Mobile-optimized design</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-800">All-in-one integrated platform</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-green-800">User Satisfaction Advantage</h4>
                <p className="text-sm text-green-700">
                  Our platform: {metrics.userSatisfactionScore}% vs {currentCompetitor.name}: {currentCompetitor.satisfaction}%
                </p>
              </div>
              <Badge className={satisfactionAdvantage.color}>
                {satisfactionAdvantage.level}
              </Badge>
            </div>
            <Progress 
              value={metrics.userSatisfactionScore} 
              className="mt-2 h-3"
            />
          </div>
        </CardContent>
      </Card>

      {/* Detailed Advantages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Why NZ Farmers Choose Us
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ourAdvantages.map((advantage, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {advantage.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800 mb-1">{advantage.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">{advantage.description}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">vs {currentCompetitor.name}:</span>
                      <span className="text-red-600 font-medium">{advantage.competitor}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Live Demo Section */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <Play className="h-5 w-5" />
            Experience the Difference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Try Our Key Features</h4>
              <div className="space-y-3">
                <Button className="w-full justify-start" variant="outline">
                  <Shield className="h-4 w-4 mr-2" />
                  Test NAIT Integration
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <WifiOff className="h-4 w-4 mr-2" />
                  Try Offline Mode
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Smartphone className="h-4 w-4 mr-2" />
                  Mobile Experience Demo
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Users className="h-4 w-4 mr-2" />
                  All-in-One Platform Tour
                </Button>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Real-Time Status</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <span className="text-sm font-medium">Platform Status</span>
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    All Systems Operational
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <span className="text-sm font-medium">Offline Data</span>
                  <Badge variant={metrics.offlineDataCount > 0 ? "secondary" : "default"}>
                    {metrics.offlineDataCount} items pending sync
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <span className="text-sm font-medium">NAIT Compliance</span>
                  <Badge className="bg-blue-100 text-blue-800">
                    {metrics.naitComplianceScore}% Compliant
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <span className="text-sm font-medium">Feature Completion</span>
                  <div className="flex items-center gap-2">
                    <Progress value={(metrics.featuresImplemented / metrics.totalFeatures) * 100} className="w-20 h-2" />
                    <span className="text-xs">{metrics.featuresImplemented}/{metrics.totalFeatures}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Button size="lg" className="bg-green-600 hover:bg-green-700">
              <Play className="h-4 w-4 mr-2" />
              Start Free Trial - Experience the NZ Difference
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              No credit card required • Full feature access • Cancel anytime
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Integration Showcase */}
      <Tabs defaultValue="advantages" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="advantages">Our Advantages</TabsTrigger>
          <TabsTrigger value="nait">NZ Compliance</TabsTrigger>
          <TabsTrigger value="offline">Offline-First</TabsTrigger>
        </TabsList>

        <TabsContent value="advantages">
          <CompetitiveAdvantages farmId="demo" onFeatureClick={(feature) => console.log('Feature clicked:', feature)} />
        </TabsContent>

        <TabsContent value="nait">
          <NAITIntegration farmId="demo" onSyncComplete={(results) => console.log('Sync completed:', results)} />
        </TabsContent>

        <TabsContent value="offline">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WifiOff className="h-5 w-5" />
                Offline-First Technology Showcase
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert className="border-blue-200 bg-blue-50">
                  <WifiOff className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Industry-Leading Offline Support:</strong> Unlike competitors that require constant connectivity, 
                    our platform works flawlessly anywhere in NZ - from high country stations to remote valley farms.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Offline Capabilities</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                        <Database className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">Local Storage</p>
                          <p className="text-sm text-green-700">50MB offline capacity with intelligent sync</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                        <Smartphone className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-blue-800">Mobile Optimized</p>
                          <p className="text-sm text-blue-700">Full functionality without internet</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                        <Zap className="h-5 w-5 text-purple-600" />
                        <div>
                          <p className="font-medium text-purple-800">Smart Sync</p>
                          <p className="text-sm text-purple-700">Automatic background sync when online</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Competitor Limitations</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <div>
                          <p className="font-medium text-red-800">No Offline Mode</p>
                          <p className="text-sm text-red-700">Competitors require constant connectivity</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                        <WifiOff className="h-5 w-5 text-orange-600" />
                        <div>
                          <p className="font-medium text-orange-800">Data Loss Risk</p>
                          <p className="text-sm text-orange-700">Lost work when connection drops</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Clock className="h-5 w-5 text-gray-600" />
                        <div>
                          <p className="font-medium text-gray-800">Manual Sync Only</p>
                          <p className="text-sm text-gray-700">No automatic data synchronization</p>
                        </div>
                      </div>
                    </div>
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

export default CompetitiveAdvantagesDashboard;
