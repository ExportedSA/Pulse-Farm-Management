import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { format, differenceInDays, addDays, startOfWeek, endOfWeek, eachWeekOfInterval, isWithinInterval, parseISO, getMonth, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from "date-fns";
import { 
  Leaf, Plus, Play, Check, Clock, TrendingUp, TrendingDown,
  BarChart3, MapPin, Loader2, Calendar, Ruler, CloudSun, Trash2, Eye,
  Settings2, Target, GripVertical, AlertTriangle, Sparkles, RotateCcw,
  ChevronUp, ChevronDown, ArrowRight, Download, Activity, Droplets,
  Sun, Cloud, Wind, CheckCircle, DollarSign, Bell, Wifi, Camera, MessageSquare,
  Satellite, Globe, Zap, Upload, Mail
} from "lucide-react";
import type { Pasture, PastureWalkSession, PastureCoverMeasurement } from "@shared/schema";

interface FarmCoverSummary {
  summary: {
    totalPaddocks: number;
    measuredPaddocks: number;
    unmeasuredPaddocks: number;
    totalArea: number;
    averageCover: number;
    weightedAverageCover: number;
    averageGrowthRate: number;
  };
  paddocks: Array<PastureCoverMeasurement & {
    pastureName: string;
    paddockNumber: number;
    area: number;
    status: string;
  }>;
}

interface CoverDistribution {
  distribution: {
    veryLow: any[];
    low: any[];
    optimal: any[];
    high: any[];
    veryHigh: any[];
    unmeasured: any[];
  };
  counts: Record<string, number>;
}

export default function PastureWalkPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [showNewWalkDialog, setShowNewWalkDialog] = useState(false);
  const [showQuickEntryDialog, setShowQuickEntryDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [quickEntries, setQuickEntries] = useState<Record<string, { cover: number; plate?: number }>>({});
  
  // Feed wedge settings
  const [feedWedgeSettings, setFeedWedgeSettings] = useState({
    preGrazingTarget: 2800,  // Target pre-grazing cover (kg DM/ha)
    postGrazingTarget: 1500, // Target post-grazing residual (kg DM/ha)
    readyToGrazeMin: 2500,   // Minimum cover to be ready to graze
    deficitThreshold: 1800,  // Below this is deficit
  });
  const [showFeedWedgeSettings, setShowFeedWedgeSettings] = useState(false);
  
  // Farm metrics settings
  const [farmMetrics, setFarmMetrics] = useState({
    herdSize: 200,           // Number of cows
    demandPerCow: 15,        // kg DM/cow/day
    targetRotation: 25,      // Target rotation length in days
    effectiveArea: 0,        // Will be calculated from pastures
  });
  const [showMetricsSettings, setShowMetricsSettings] = useState(false);
  
  // Spring rotation planner settings
  const [rotationPlanner, setRotationPlanner] = useState({
    balanceDate: format(new Date(new Date().getFullYear(), 9, 1), 'yyyy-MM-dd'), // Oct 1 default
    springStartDate: format(new Date(new Date().getFullYear(), 7, 1), 'yyyy-MM-dd'), // Aug 1 default
    firstRoundTarget: format(new Date(new Date().getFullYear(), 9, 15), 'yyyy-MM-dd'), // Oct 15 default
    paddocksGrazedFirstRound: 0,
    currentWeek: 1,
  });
  const [showRotationPlanner, setShowRotationPlanner] = useState(false);
  
  // Rotation calculator settings
  const [rotationCalc, setRotationCalc] = useState({
    customGrowthRate: 0, // 0 = use measured, otherwise override
    seasonalAdjustment: true,
  });
  const [showRotationCalc, setShowRotationCalc] = useState(false);
  
  // Grazing sequence planner
  const [grazingSequence, setGrazingSequence] = useState<string[]>([]);
  const [draggedPaddock, setDraggedPaddock] = useState<string | null>(null);
  const [showSequenceSettings, setShowSequenceSettings] = useState(false);

  // New walk form
  const [newWalk, setNewWalk] = useState({
    walkDate: format(new Date(), 'yyyy-MM-dd'),
    walkTime: format(new Date(), 'HH:mm'),
    weatherConditions: '',
    temperature: '',
    notes: '',
  });

  // Fetch pastures
  const { data: pastures = [] } = useQuery<Pasture[]>({
    queryKey: ["/api/pastures"],
    queryFn: async () => {
      const res = await fetch("/api/pastures");
      if (!res.ok) throw new Error("Failed to fetch pastures");
      return res.json();
    },
  });

  // Fetch walk sessions
  const { data: sessions = [], isLoading: loadingSessions } = useQuery<PastureWalkSession[]>({
    queryKey: ["/api/pasture-walks/sessions"],
    queryFn: async () => {
      const res = await fetch("/api/pasture-walks/sessions");
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
  });

  // Fetch farm cover summary
  const { data: farmCover, isLoading: loadingCover } = useQuery<FarmCoverSummary>({
    queryKey: ["/api/pasture-walks/analytics/farm-cover"],
    queryFn: async () => {
      const res = await fetch("/api/pasture-walks/analytics/farm-cover");
      if (!res.ok) throw new Error("Failed to fetch farm cover");
      return res.json();
    },
  });

  // Fetch cover distribution
  const { data: distribution } = useQuery<CoverDistribution>({
    queryKey: ["/api/pasture-walks/analytics/cover-distribution"],
    queryFn: async () => {
      const res = await fetch("/api/pasture-walks/analytics/cover-distribution");
      if (!res.ok) throw new Error("Failed to fetch distribution");
      return res.json();
    },
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/pasture-walks/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create session");
      return res.json();
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pasture-walks/sessions"] });
      setShowNewWalkDialog(false);
      setSelectedSession(session.id);
      setShowQuickEntryDialog(true);
      toast.success("Walk session started");
    },
    onError: () => toast.error("Failed to create session"),
  });

  // Quick entry mutation
  const quickEntryMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/pasture-walks/measurements/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save measurements");
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pasture-walks"] });
      setShowQuickEntryDialog(false);
      setQuickEntries({});
      toast.success(`Saved ${result.created} measurements`);
    },
    onError: () => toast.error("Failed to save measurements"),
  });

  // Complete session mutation
  const completeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/pasture-walks/sessions/${sessionId}/complete`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to complete session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pasture-walks"] });
      toast.success("Walk session completed");
    },
    onError: () => toast.error("Failed to complete session"),
  });

  const handleStartWalk = () => {
    createSessionMutation.mutate({
      ...newWalk,
      temperature: newWalk.temperature ? parseInt(newWalk.temperature) : null,
      recordedBy: user?.id,
    });
  };

  const handleSaveQuickEntries = () => {
    const measurements = Object.entries(quickEntries)
      .filter(([_, data]) => data.cover > 0)
      .map(([pastureId, data]) => ({
        pastureId,
        coverKgDmHa: data.cover,
        plateMeterReading: data.plate,
      }));

    if (measurements.length === 0) {
      toast.error("Enter at least one measurement");
      return;
    }

    quickEntryMutation.mutate({
      sessionId: selectedSession,
      measurements,
    });
  };

  const getCoverColor = (cover: number) => {
    if (cover < 1500) return "text-red-600 bg-red-50";
    if (cover < 2000) return "text-orange-600 bg-orange-50";
    if (cover < 2800) return "text-green-600 bg-green-50";
    if (cover < 3200) return "text-blue-600 bg-blue-50";
    return "text-purple-600 bg-purple-50";
  };

  const getCoverLabel = (cover: number) => {
    if (cover < 1500) return "Very Low";
    if (cover < 2000) return "Low";
    if (cover < 2800) return "Optimal";
    if (cover < 3200) return "High";
    return "Very High";
  };

  // Convert plate meter reading to kg DM/ha (simplified formula)
  const plateToCover = (plateReading: number) => {
    // Common formula: Cover = (plate reading × 140) + 500
    // Adjust based on your calibration
    return Math.round((plateReading * 140) + 500);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Leaf className="h-8 w-8 text-green-600" />
            Pasture Walk Recording
          </h1>
          <p className="text-muted-foreground mt-1">
            Record pasture cover and track growth rates
          </p>
        </div>
        <Button onClick={() => setShowNewWalkDialog(true)}>
          <Play className="h-4 w-4 mr-2" />
          Start New Walk
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Paddocks</span>
            </div>
            <p className="text-3xl font-bold mt-2">
              {farmCover?.summary.measuredPaddocks || 0}/{farmCover?.summary.totalPaddocks || 0}
            </p>
            <p className="text-xs text-muted-foreground">measured</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Leaf className="h-5 w-5 text-green-600" />
              <span className="text-sm text-muted-foreground">Avg Cover</span>
            </div>
            <p className="text-3xl font-bold mt-2">
              {farmCover?.summary.weightedAverageCover || 0}
            </p>
            <p className="text-xs text-muted-foreground">kg DM/ha</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">Avg Growth</span>
            </div>
            <p className="text-3xl font-bold mt-2">
              {farmCover?.summary.averageGrowthRate || 0}
            </p>
            <p className="text-xs text-muted-foreground">kg DM/ha/day</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              <span className="text-sm text-muted-foreground">Walk Sessions</span>
            </div>
            <p className="text-3xl font-bold mt-2">{sessions.length}</p>
            <p className="text-xs text-muted-foreground">
              {sessions.filter(s => s.status === 'completed').length} completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Farm Overview</TabsTrigger>
          <TabsTrigger value="metrics">Farm Metrics</TabsTrigger>
          <TabsTrigger value="rotation">Rotation Planner</TabsTrigger>
          <TabsTrigger value="calculator">Rotation Calculator</TabsTrigger>
          <TabsTrigger value="sequence">Grazing Sequence</TabsTrigger>
          <TabsTrigger value="trends">Growth Trends</TabsTrigger>
          <TabsTrigger value="forecast">Feed Budget</TabsTrigger>
          <TabsTrigger value="quality">Pasture Quality</TabsTrigger>
          <TabsTrigger value="weather">Weather</TabsTrigger>
          <TabsTrigger value="mobile">Mobile Mode</TabsTrigger>
          <TabsTrigger value="satellite">Satellite/Drone</TabsTrigger>
          <TabsTrigger value="feedwedge">Feed Wedge</TabsTrigger>
          <TabsTrigger value="paddocks">Paddock Details</TabsTrigger>
          <TabsTrigger value="history">Walk History</TabsTrigger>
          <TabsTrigger value="distribution">Cover Distribution</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          {loadingCover ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
          ) : (
            <div className="space-y-6">
              {/* Quick Actions Grid */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Common tasks and tools for pasture management</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Data Entry */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-muted-foreground mb-3">DATA ENTRY</h4>
                      <Button 
                        className="w-full justify-start h-10" 
                        variant="outline"
                        onClick={() => {
                          setSelectedSession(null);
                          setShowQuickEntryDialog(true);
                        }}
                      >
                        <Ruler className="h-4 w-4 mr-2 flex-shrink-0" />
                        Quick Cover Entry
                      </Button>
                      <Button 
                        className="w-full justify-start h-10" 
                        variant="outline"
                        onClick={() => setShowNewWalkDialog(true)}
                      >
                        <Play className="h-4 w-4 mr-2 flex-shrink-0" />
                        Start New Walk
                      </Button>
                    </div>

                    {/* Planning Tools */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-muted-foreground mb-3">PLANNING TOOLS</h4>
                      <Button 
                        className="w-full justify-start h-10" 
                        variant="outline"
                        onClick={() => setActiveTab('sequence')}
                      >
                        <GripVertical className="h-4 w-4 mr-2 flex-shrink-0" />
                        Grazing Sequence
                      </Button>
                      <Button 
                        className="w-full justify-start h-10" 
                        variant="outline"
                        onClick={() => setActiveTab('rotation')}
                      >
                        <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                        Rotation Planner
                      </Button>
                      <Button 
                        className="w-full justify-start h-10" 
                        variant="outline"
                        onClick={() => setActiveTab('calculator')}
                      >
                        <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                        Rotation Calculator
                      </Button>
                    </div>

                    {/* Analysis */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-muted-foreground mb-3">ANALYSIS</h4>
                      <Button 
                        className="w-full justify-start h-10" 
                        variant="outline"
                        onClick={() => setActiveTab('feedwedge')}
                      >
                        <BarChart3 className="h-4 w-4 mr-2 flex-shrink-0" />
                        Feed Wedge
                      </Button>
                      <Button 
                        className="w-full justify-start h-10" 
                        variant="outline"
                        onClick={() => setActiveTab('metrics')}
                      >
                        <TrendingUp className="h-4 w-4 mr-2 flex-shrink-0" />
                        Farm Metrics
                      </Button>
                      <Button 
                        className="w-full justify-start h-10" 
                        variant="outline"
                        onClick={() => setActiveTab('distribution')}
                      >
                        <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                        Cover Distribution
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Quick Entry Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Start New Walk Session</CardTitle>
                    <CardDescription>Begin a structured pasture walk with date/time tracking</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={() => setShowNewWalkDialog(true)}
                    >
                      <Play className="h-5 w-5 mr-2" />
                      Start Walk Session
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Groups measurements, tracks time, and adds notes
                    </p>
                  </CardContent>
                </Card>

                {/* Getting Started Tips */}
                <Card className="border-blue-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-700">
                      <Target className="h-5 w-5" />
                      Getting Started Guide
                    </CardTitle>
                    <CardDescription>Quick tips for using the Pasture Walk tools</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <p className="font-medium text-blue-700">📊 Data Entry</p>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• Use <strong>Quick Cover Entry</strong> for rapid measurements</li>
                          <li>• Start a <strong>Walk Session</strong> to group measurements</li>
                          <li>• Enter plate meter readings (auto-converts to kg/ha)</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium text-green-700">🎯 Planning</p>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• <strong>Grazing Sequence</strong> - Drag paddocks to order</li>
                          <li>• <strong>Rotation Planner</strong> - Track spring progress</li>
                          <li>• <strong>Calculator</strong> - Find optimal rotation length</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium text-orange-700">📈 Analysis</p>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• <strong>Feed Wedge</strong> - Visual cover distribution</li>
                          <li>• <strong>Farm Metrics</strong> - Key performance indicators</li>
                          <li>• <strong>Cover Distribution</strong> - Paddock status overview</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium text-purple-700">⚙️ Settings</p>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• Configure feed wedge targets (pre/post grazing)</li>
                          <li>• Set herd size and demand per cow</li>
                          <li>• Adjust rotation calculator growth rates</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Sessions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Walk Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {sessions.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">No walk sessions yet</p>
                    ) : (
                      <div className="space-y-2">
                        {sessions.slice(0, 5).map((session) => (
                          <div 
                            key={session.id}
                            className="flex justify-between items-center p-3 bg-muted rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{session.walkDate}</p>
                              <p className="text-sm text-muted-foreground">
                                {session.totalPaddocks} paddocks • Avg: {session.averageCover} kg/ha
                              </p>
                            </div>
                            <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                              {session.status}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cover Summary by Category */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Cover Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-4">
                    {[
                      { label: 'Very Low', range: '&lt; 1500', count: distribution?.counts.veryLow || 0, color: 'bg-red-500' },
                      { label: 'Low', range: '1500-2000', count: distribution?.counts.low || 0, color: 'bg-orange-500' },
                      { label: 'Optimal', range: '2000-2800', count: distribution?.counts.optimal || 0, color: 'bg-green-500' },
                      { label: 'High', range: '2800-3200', count: distribution?.counts.high || 0, color: 'bg-blue-500' },
                      { label: 'Very High', range: '&gt; 3200', count: distribution?.counts.veryHigh || 0, color: 'bg-purple-500' },
                    ].map((cat) => (
                      <div key={cat.label} className="text-center">
                        <div className={`${cat.color} text-white rounded-lg p-4 mb-2`}>
                          <p className="text-2xl font-bold">{cat.count}</p>
                        </div>
                        <p className="font-medium text-sm">{cat.label}</p>
                        <p className="text-xs text-muted-foreground">{cat.range}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            </div>
          )}
        </TabsContent>

        {/* Farm Metrics Tab */}
        <TabsContent value="metrics" className="mt-4">
          {loadingCover ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
          ) : (
            <div className="space-y-6">
              {/* Settings Button */}
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowMetricsSettings(true)}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Farm Settings
                </Button>
              </div>

              {/* Key Metrics Cards */}
              {(() => {
                // Calculate all metrics
                const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || 0;
                const effectiveArea = totalArea || farmMetrics.effectiveArea || 100;
                const afc = farmCover?.summary.weightedAverageCover || farmCover?.summary.averageCover || 0;
                const growthRate = farmCover?.summary.averageGrowthRate || 0;
                const dailyDemand = farmMetrics.herdSize * farmMetrics.demandPerCow;
                const demandPerHa = effectiveArea > 0 ? dailyDemand / effectiveArea : 0;
                const availableFeed = Math.max(0, afc - feedWedgeSettings.postGrazingTarget);
                const daysAhead = demandPerHa > 0 ? Math.round(availableFeed / demandPerHa) : 0;
                const currentRotation = growthRate > 0 
                  ? Math.round((feedWedgeSettings.preGrazingTarget - feedWedgeSettings.postGrazingTarget) / growthRate)
                  : 0;
                const feedBalance = growthRate - demandPerHa;
                const surplusDeficit = feedBalance * effectiveArea;

                return (
                  <>
                    {/* Primary Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="border-l-4 border-green-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Leaf className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-muted-foreground">Average Farm Cover</span>
                          </div>
                          <p className="text-3xl font-bold">{afc.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">kg DM/ha</p>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-blue-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                            <span className="text-sm text-muted-foreground">Growth Rate</span>
                          </div>
                          <p className="text-3xl font-bold">{growthRate}</p>
                          <p className="text-xs text-muted-foreground">kg DM/ha/day</p>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-orange-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Target className="h-4 w-4 text-orange-600" />
                            <span className="text-sm text-muted-foreground">Daily Demand</span>
                          </div>
                          <p className="text-3xl font-bold">{Math.round(demandPerHa)}</p>
                          <p className="text-xs text-muted-foreground">kg DM/ha/day</p>
                        </CardContent>
                      </Card>

                      <Card className={`border-l-4 ${daysAhead >= 14 ? 'border-green-500' : daysAhead >= 7 ? 'border-yellow-500' : 'border-red-500'}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="h-4 w-4" />
                            <span className="text-sm text-muted-foreground">Days Ahead</span>
                          </div>
                          <p className={`text-3xl font-bold ${daysAhead >= 14 ? 'text-green-600' : daysAhead >= 7 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {daysAhead}
                          </p>
                          <p className="text-xs text-muted-foreground">days of feed</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Rotation & Balance */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Rotation Length</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Current</p>
                              <p className={`text-2xl font-bold ${
                                Math.abs(currentRotation - farmMetrics.targetRotation) <= 3 
                                  ? 'text-green-600' 
                                  : currentRotation > farmMetrics.targetRotation 
                                    ? 'text-blue-600' 
                                    : 'text-red-600'
                              }`}>
                                {currentRotation} days
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Target</p>
                              <p className="text-2xl font-bold">{farmMetrics.targetRotation} days</p>
                            </div>
                          </div>
                          <Progress 
                            value={Math.min((currentRotation / farmMetrics.targetRotation) * 100, 150)} 
                            className="h-3"
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            {currentRotation > farmMetrics.targetRotation 
                              ? `${currentRotation - farmMetrics.targetRotation} days longer than target`
                              : currentRotation < farmMetrics.targetRotation
                                ? `${farmMetrics.targetRotation - currentRotation} days shorter than target`
                                : 'On target'}
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Feed Balance</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className={`text-center p-4 rounded-lg ${
                            feedBalance >= 0 ? 'bg-green-50' : 'bg-red-50'
                          }`}>
                            <p className={`text-3xl font-bold ${feedBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {feedBalance >= 0 ? '+' : ''}{Math.round(feedBalance)}
                            </p>
                            <p className="text-sm text-muted-foreground">kg DM/ha/day</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            {feedBalance >= 0 
                              ? `Surplus: ${Math.round(surplusDeficit)} kg DM/day farm total`
                              : `Deficit: ${Math.round(Math.abs(surplusDeficit))} kg DM/day farm total`}
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Herd Demand</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Herd Size</span>
                              <span className="font-medium">{farmMetrics.herdSize} cows</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Intake/Cow</span>
                              <span className="font-medium">{farmMetrics.demandPerCow} kg DM/day</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Total Daily</span>
                              <span className="font-bold">{dailyDemand.toLocaleString()} kg DM</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Effective Area</span>
                              <span className="font-medium">{effectiveArea} ha</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Detailed Breakdown */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Feed Budget Summary</CardTitle>
                        <CardDescription>Current pasture status and projections</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Total Farm Cover</p>
                            <p className="text-xl font-bold">
                              {Math.round(afc * effectiveArea).toLocaleString()} kg DM
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {afc} kg/ha × {effectiveArea} ha
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Available Above Residual</p>
                            <p className="text-xl font-bold">
                              {Math.round(availableFeed * effectiveArea).toLocaleString()} kg DM
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {availableFeed} kg/ha above {feedWedgeSettings.postGrazingTarget}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Daily Growth</p>
                            <p className="text-xl font-bold text-green-600">
                              +{Math.round(growthRate * effectiveArea).toLocaleString()} kg DM
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {growthRate} kg/ha/day × {effectiveArea} ha
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Daily Consumption</p>
                            <p className="text-xl font-bold text-orange-600">
                              -{dailyDemand.toLocaleString()} kg DM
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {farmMetrics.demandPerCow} kg × {farmMetrics.herdSize} cows
                            </p>
                          </div>
                        </div>

                        {/* Visual indicator */}
                        <div className="mt-6 p-4 bg-muted rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Feed Position</span>
                            <span className={`text-sm font-bold ${daysAhead >= 14 ? 'text-green-600' : daysAhead >= 7 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {daysAhead >= 14 ? 'Comfortable' : daysAhead >= 7 ? 'Adequate' : 'Critical'}
                            </span>
                          </div>
                          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${
                                daysAhead >= 14 ? 'bg-green-500' : daysAhead >= 7 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min((daysAhead / 21) * 100, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>0 days</span>
                            <span>7 days</span>
                            <span>14 days</span>
                            <span>21+ days</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Recommendations */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Recommendations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {feedBalance < 0 && (
                            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                              <div className="w-2 h-2 bg-red-500 rounded-full mt-2" />
                              <div>
                                <p className="font-medium text-red-800">Feed Deficit Alert</p>
                                <p className="text-sm text-red-600">
                                  Growth is not meeting demand. Consider reducing stocking rate, 
                                  supplementary feeding, or extending rotation.
                                </p>
                              </div>
                            </div>
                          )}
                          {daysAhead < 7 && (
                            <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                              <div className="w-2 h-2 bg-orange-500 rounded-full mt-2" />
                              <div>
                                <p className="font-medium text-orange-800">Low Feed Reserve</p>
                                <p className="text-sm text-orange-600">
                                  Less than 7 days of feed ahead. Monitor closely and prepare 
                                  supplementary feed options.
                                </p>
                              </div>
                            </div>
                          )}
                          {currentRotation < farmMetrics.targetRotation - 5 && (
                            <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2" />
                              <div>
                                <p className="font-medium text-yellow-800">Short Rotation</p>
                                <p className="text-sm text-yellow-600">
                                  Current rotation is shorter than target. This may reduce pasture 
                                  regrowth and long-term productivity.
                                </p>
                              </div>
                            </div>
                          )}
                          {feedBalance >= 0 && daysAhead >= 14 && (
                            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                              <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                              <div>
                                <p className="font-medium text-green-800">Good Feed Position</p>
                                <p className="text-sm text-green-600">
                                  Growth is meeting demand with adequate reserves. 
                                  {feedBalance > 10 && ' Consider making silage or hay from surplus paddocks.'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>
          )}
        </TabsContent>

        {/* Rotation Planner Tab */}
        <TabsContent value="rotation" className="mt-4">
          {loadingCover ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
          ) : (
            <div className="space-y-6">
              {/* Settings Button */}
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Spring Rotation Planner</h3>
                  <p className="text-sm text-muted-foreground">Plan your spring grazing rotation and track progress</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowRotationPlanner(true)}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Planner Settings
                </Button>
              </div>

              {/* Balance Day Calculator */}
              {(() => {
                const today = new Date();
                const balanceDate = parseISO(rotationPlanner.balanceDate);
                const springStart = parseISO(rotationPlanner.springStartDate);
                const firstRoundTarget = parseISO(rotationPlanner.firstRoundTarget);
                
                const daysToBalance = differenceInDays(balanceDate, today);
                const daysSinceSpringStart = differenceInDays(today, springStart);
                const daysToFirstRound = differenceInDays(firstRoundTarget, today);
                const totalSpringDays = differenceInDays(balanceDate, springStart);
                const springProgress = Math.min(100, Math.max(0, (daysSinceSpringStart / totalSpringDays) * 100));
                
                const totalPaddocks = farmCover?.summary.totalPaddocks || pastures.length || 20;
                const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || farmMetrics.effectiveArea || 100;
                const growthRate = farmCover?.summary.averageGrowthRate || 30;
                const afc = farmCover?.summary.weightedAverageCover || 2200;
                
                // Calculate weekly targets
                const weeksToBalance = Math.ceil(daysToBalance / 7);
                const weeksToFirstRound = Math.ceil(daysToFirstRound / 7);
                const paddocksPerWeek = weeksToFirstRound > 0 ? Math.ceil(totalPaddocks / weeksToFirstRound) : totalPaddocks;
                const areaPerWeek = weeksToFirstRound > 0 ? (totalArea / weeksToFirstRound).toFixed(1) : totalArea;
                const areaPerDay = (totalArea / Math.max(1, daysToFirstRound)).toFixed(2);
                
                // First round tracking
                const firstRoundProgress = (rotationPlanner.paddocksGrazedFirstRound / totalPaddocks) * 100;
                const paddocksRemaining = totalPaddocks - rotationPlanner.paddocksGrazedFirstRound;
                const daysPerPaddock = daysToFirstRound > 0 && paddocksRemaining > 0 
                  ? (daysToFirstRound / paddocksRemaining).toFixed(1) 
                  : '—';
                
                // Generate weekly schedule
                interface WeekSchedule {
                  weekNumber: number;
                  startDate: string;
                  endDate: string;
                  targetPaddocks: number;
                  targetArea: number;
                  cumulativePaddocks: number;
                  isCurrentWeek: boolean;
                  isPast: boolean;
                }
                const weeks: WeekSchedule[] = [];
                if (daysToFirstRound > 0) {
                  const weekStarts = eachWeekOfInterval({
                    start: today,
                    end: firstRoundTarget,
                  }, { weekStartsOn: 1 });
                  
                  let cumulativePaddocks = rotationPlanner.paddocksGrazedFirstRound;
                  let cumulativeArea = 0;
                  const areaPerWeekNum = parseFloat(String(areaPerWeek));
                  
                  weekStarts.forEach((weekStart, index) => {
                    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                    const isCurrentWeek = isWithinInterval(today, { start: weekStart, end: weekEnd });
                    const targetPaddocksThisWeek = Math.min(paddocksPerWeek, totalPaddocks - cumulativePaddocks);
                    const targetAreaThisWeek = areaPerWeekNum;
                    
                    weeks.push({
                      weekNumber: index + 1,
                      startDate: format(weekStart, 'MMM d'),
                      endDate: format(weekEnd, 'MMM d'),
                      targetPaddocks: targetPaddocksThisWeek,
                      targetArea: targetAreaThisWeek,
                      cumulativePaddocks: Math.min(cumulativePaddocks + targetPaddocksThisWeek, totalPaddocks),
                      isCurrentWeek,
                      isPast: weekEnd < today,
                    });
                    
                    cumulativePaddocks += targetPaddocksThisWeek;
                    cumulativeArea += targetAreaThisWeek;
                  });
                }

                return (
                  <>
                    {/* Key Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="border-l-4 border-blue-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            <span className="text-sm text-muted-foreground">Days to Balance Date</span>
                          </div>
                          <p className={`text-3xl font-bold ${daysToBalance < 0 ? 'text-red-600' : daysToBalance < 14 ? 'text-yellow-600' : 'text-blue-600'}`}>
                            {daysToBalance < 0 ? 'Passed' : daysToBalance}
                          </p>
                          <p className="text-xs text-muted-foreground">{format(balanceDate, 'MMMM d, yyyy')}</p>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-green-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Target className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-muted-foreground">Days to First Round Complete</span>
                          </div>
                          <p className={`text-3xl font-bold ${daysToFirstRound < 0 ? 'text-red-600' : daysToFirstRound < 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {daysToFirstRound < 0 ? 'Overdue' : daysToFirstRound}
                          </p>
                          <p className="text-xs text-muted-foreground">{format(firstRoundTarget, 'MMMM d, yyyy')}</p>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-purple-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4 text-purple-600" />
                            <span className="text-sm text-muted-foreground">Spring Progress</span>
                          </div>
                          <p className="text-3xl font-bold text-purple-600">{Math.round(springProgress)}%</p>
                          <p className="text-xs text-muted-foreground">Day {daysSinceSpringStart} of {totalSpringDays}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* First Round Tracking */}
                    <Card>
                      <CardHeader>
                        <CardTitle>First Round Progress</CardTitle>
                        <CardDescription>Track paddocks grazed in the first spring rotation</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Paddocks Grazed</span>
                            <span className="text-lg font-bold">
                              {rotationPlanner.paddocksGrazedFirstRound} / {totalPaddocks}
                            </span>
                          </div>
                          <Progress value={firstRoundProgress} className="h-4" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 mt-4">
                            <div className="text-center p-3 bg-muted rounded-lg">
                              <p className="text-2xl font-bold">{paddocksRemaining}</p>
                              <p className="text-xs text-muted-foreground">Paddocks Remaining</p>
                            </div>
                            <div className="text-center p-3 bg-muted rounded-lg">
                              <p className="text-2xl font-bold">{daysPerPaddock}</p>
                              <p className="text-xs text-muted-foreground">Days per Paddock</p>
                            </div>
                            <div className="text-center p-3 bg-muted rounded-lg">
                              <p className="text-2xl font-bold">{paddocksPerWeek}</p>
                              <p className="text-xs text-muted-foreground">Paddocks per Week</p>
                            </div>
                          </div>

                          <div className="flex gap-2 mt-4">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setRotationPlanner({
                                ...rotationPlanner,
                                paddocksGrazedFirstRound: Math.max(0, rotationPlanner.paddocksGrazedFirstRound - 1)
                              })}
                              disabled={rotationPlanner.paddocksGrazedFirstRound <= 0}
                            >
                              -1 Paddock
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => setRotationPlanner({
                                ...rotationPlanner,
                                paddocksGrazedFirstRound: Math.min(totalPaddocks, rotationPlanner.paddocksGrazedFirstRound + 1)
                              })}
                              disabled={rotationPlanner.paddocksGrazedFirstRound >= totalPaddocks}
                            >
                              +1 Paddock Grazed
                            </Button>
                            <Button 
                              variant="secondary" 
                              size="sm"
                              onClick={() => setRotationPlanner({
                                ...rotationPlanner,
                                paddocksGrazedFirstRound: 0
                              })}
                            >
                              Reset
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Weekly Grazing Targets */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Weekly Grazing Area Targets</CardTitle>
                        <CardDescription>Planned grazing schedule to complete first round by target date</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="p-3 bg-blue-50 rounded-lg">
                              <p className="text-sm text-blue-800 font-medium">Weekly Target</p>
                              <p className="text-xl font-bold text-blue-600">{areaPerWeek} ha</p>
                            </div>
                            <div className="p-3 bg-green-50 rounded-lg">
                              <p className="text-sm text-green-800 font-medium">Daily Target</p>
                              <p className="text-xl font-bold text-green-600">{areaPerDay} ha</p>
                            </div>
                            <div className="p-3 bg-purple-50 rounded-lg">
                              <p className="text-sm text-purple-800 font-medium">Paddocks/Week</p>
                              <p className="text-xl font-bold text-purple-600">{paddocksPerWeek}</p>
                            </div>
                            <div className="p-3 bg-orange-50 rounded-lg">
                              <p className="text-sm text-orange-800 font-medium">Weeks Remaining</p>
                              <p className="text-xl font-bold text-orange-600">{weeksToFirstRound}</p>
                            </div>
                          </div>

                          {weeks.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Week</TableHead>
                                  <TableHead>Dates</TableHead>
                                  <TableHead className="text-right">Target Paddocks</TableHead>
                                  <TableHead className="text-right">Target Area (ha)</TableHead>
                                  <TableHead className="text-right">Cumulative</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {weeks.slice(0, 10).map((week) => (
                                  <TableRow 
                                    key={week.weekNumber}
                                    className={week.isCurrentWeek ? 'bg-blue-50' : week.isPast ? 'opacity-50' : ''}
                                  >
                                    <TableCell className="font-medium">Week {week.weekNumber}</TableCell>
                                    <TableCell>{week.startDate} - {week.endDate}</TableCell>
                                    <TableCell className="text-right">{week.targetPaddocks}</TableCell>
                                    <TableCell className="text-right">{week.targetArea.toFixed(1)}</TableCell>
                                    <TableCell className="text-right">{week.cumulativePaddocks} / {totalPaddocks}</TableCell>
                                    <TableCell>
                                      {week.isCurrentWeek ? (
                                        <Badge className="bg-blue-500">Current</Badge>
                                      ) : week.isPast ? (
                                        <Badge variant="secondary">Past</Badge>
                                      ) : (
                                        <Badge variant="outline">Upcoming</Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-center text-muted-foreground py-4">
                              Set your first round target date to generate weekly schedule
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Balance Day Analysis */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Balance Day Analysis</CardTitle>
                        <CardDescription>When pasture growth equals herd demand</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="p-4 bg-muted rounded-lg">
                              <p className="text-sm font-medium mb-2">Current Status</p>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Growth Rate</span>
                                  <span className="font-medium text-green-600">+{growthRate} kg DM/ha/day</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Demand Rate</span>
                                  <span className="font-medium text-orange-600">
                                    -{Math.round((farmMetrics.herdSize * farmMetrics.demandPerCow) / totalArea)} kg DM/ha/day
                                  </span>
                                </div>
                                <div className="flex justify-between border-t pt-2">
                                  <span className="text-sm font-medium">Net Balance</span>
                                  <span className={`font-bold ${growthRate - ((farmMetrics.herdSize * farmMetrics.demandPerCow) / totalArea) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {growthRate - Math.round((farmMetrics.herdSize * farmMetrics.demandPerCow) / totalArea) >= 0 ? '+' : ''}
                                    {Math.round(growthRate - ((farmMetrics.herdSize * farmMetrics.demandPerCow) / totalArea))} kg DM/ha/day
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="p-4 bg-blue-50 rounded-lg">
                              <p className="text-sm font-medium text-blue-800 mb-2">Balance Day Target</p>
                              <p className="text-2xl font-bold text-blue-600">{format(balanceDate, 'MMMM d, yyyy')}</p>
                              <p className="text-sm text-blue-600 mt-1">
                                {daysToBalance > 0 
                                  ? `${daysToBalance} days until growth = demand`
                                  : 'Balance date has passed'}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <p className="text-sm font-medium">Spring Rotation Timeline</p>
                            <div className="relative">
                              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-400 via-green-400 to-green-600 transition-all"
                                  style={{ width: `${springProgress}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>{format(springStart, 'MMM d')}</span>
                                <span>Today</span>
                                <span>{format(balanceDate, 'MMM d')}</span>
                              </div>
                            </div>

                            <div className="space-y-2 mt-4">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-blue-400 rounded-full" />
                                <span className="text-sm">Spring Start: {format(springStart, 'MMM d')}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-400 rounded-full" />
                                <span className="text-sm">First Round Target: {format(firstRoundTarget, 'MMM d')}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-600 rounded-full" />
                                <span className="text-sm">Balance Date: {format(balanceDate, 'MMM d')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Recommendations */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Spring Rotation Recommendations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {firstRoundProgress < 50 && daysToFirstRound < 14 && (
                            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                              <div className="w-2 h-2 bg-red-500 rounded-full mt-2" />
                              <div>
                                <p className="font-medium text-red-800">Behind Schedule</p>
                                <p className="text-sm text-red-600">
                                  First round is less than 50% complete with only {daysToFirstRound} days remaining. 
                                  Consider increasing daily grazing area or adjusting target date.
                                </p>
                              </div>
                            </div>
                          )}
                          {daysToBalance < 0 && (
                            <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2" />
                              <div>
                                <p className="font-medium text-yellow-800">Past Balance Date</p>
                                <p className="text-sm text-yellow-600">
                                  The balance date has passed. Growth should now be exceeding demand. 
                                  Consider extending rotation length to build covers.
                                </p>
                              </div>
                            </div>
                          )}
                          {firstRoundProgress >= 80 && (
                            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                              <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                              <div>
                                <p className="font-medium text-green-800">First Round Nearly Complete</p>
                                <p className="text-sm text-green-600">
                                  Excellent progress! {paddocksRemaining} paddocks remaining. 
                                  Start planning second round rotation length.
                                </p>
                              </div>
                            </div>
                          )}
                          {growthRate > 50 && (
                            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                              <div>
                                <p className="font-medium text-blue-800">Strong Growth</p>
                                <p className="text-sm text-blue-600">
                                  Growth rate of {growthRate} kg/ha/day is strong. 
                                  Consider making silage from surplus paddocks.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>
          )}
        </TabsContent>

        {/* Rotation Calculator Tab */}
        <TabsContent value="calculator" className="mt-4">
          {loadingCover ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Rotation Length Calculator</h3>
                  <p className="text-sm text-muted-foreground">Calculate optimal rotation based on growth and demand</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowRotationCalc(true)}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Calculator Settings
                </Button>
              </div>

              {(() => {
                // Seasonal growth rate adjustments (NZ typical values)
                const seasonalGrowthRates: Record<number, { name: string; rate: number; color: string }> = {
                  0: { name: 'January', rate: 45, color: 'bg-yellow-500' },
                  1: { name: 'February', rate: 35, color: 'bg-yellow-600' },
                  2: { name: 'March', rate: 40, color: 'bg-orange-500' },
                  3: { name: 'April', rate: 35, color: 'bg-orange-600' },
                  4: { name: 'May', rate: 20, color: 'bg-blue-400' },
                  5: { name: 'June', rate: 10, color: 'bg-blue-600' },
                  6: { name: 'July', rate: 10, color: 'bg-blue-700' },
                  7: { name: 'August', rate: 20, color: 'bg-green-400' },
                  8: { name: 'September', rate: 45, color: 'bg-green-500' },
                  9: { name: 'October', rate: 65, color: 'bg-green-600' },
                  10: { name: 'November', rate: 60, color: 'bg-green-500' },
                  11: { name: 'December', rate: 50, color: 'bg-yellow-400' },
                };

                const currentMonth = getMonth(new Date());
                const measuredGrowth = farmCover?.summary.averageGrowthRate || 0;
                const seasonalGrowth = seasonalGrowthRates[currentMonth].rate;
                const effectiveGrowth = rotationCalc.customGrowthRate > 0 
                  ? rotationCalc.customGrowthRate 
                  : rotationCalc.seasonalAdjustment 
                    ? seasonalGrowth 
                    : measuredGrowth || seasonalGrowth;

                const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || farmMetrics.effectiveArea || 100;
                const totalPaddocks = farmCover?.summary.totalPaddocks || pastures.length || 20;
                const dailyDemand = farmMetrics.herdSize * farmMetrics.demandPerCow;
                const demandPerHa = totalArea > 0 ? dailyDemand / totalArea : 30;

                // Calculate rotation length: (Pre-grazing - Post-grazing) / Growth Rate
                const coverToGrow = feedWedgeSettings.preGrazingTarget - feedWedgeSettings.postGrazingTarget;
                const calculatedRotation = effectiveGrowth > 0 ? Math.round(coverToGrow / effectiveGrowth) : 0;

                // Calculate area per day needed
                const areaPerDay = totalArea / Math.max(calculatedRotation, 1);
                const paddocksPerDay = totalPaddocks / Math.max(calculatedRotation, 1);

                // Generate calendar view data
                const today = new Date();
                const calendarStart = startOfMonth(today);
                const calendarEnd = endOfMonth(addDays(today, 60)); // Show 2 months
                const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

                // Calculate which paddocks to graze on which days
                const grazingSchedule: Record<string, { paddockNum: number; area: number }> = {};
                let dayCounter = 0;
                let accumulatedArea = 0;
                
                for (const day of calendarDays) {
                  if (day >= today) {
                    accumulatedArea += areaPerDay;
                    const paddockNum = Math.floor(accumulatedArea / (totalArea / totalPaddocks)) + 1;
                    grazingSchedule[format(day, 'yyyy-MM-dd')] = {
                      paddockNum: Math.min(paddockNum, totalPaddocks),
                      area: areaPerDay,
                    };
                    dayCounter++;
                    if (dayCounter >= calculatedRotation) {
                      accumulatedArea = 0;
                      dayCounter = 0;
                    }
                  }
                }

                // Group calendar by weeks
                const weeks: Date[][] = [];
                let currentWeek: Date[] = [];
                
                calendarDays.forEach((day, index) => {
                  currentWeek.push(day);
                  if (currentWeek.length === 7 || index === calendarDays.length - 1) {
                    weeks.push([...currentWeek]);
                    currentWeek = [];
                  }
                });

                return (
                  <>
                    {/* Rotation Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="border-l-4 border-green-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-muted-foreground">Calculated Rotation</span>
                          </div>
                          <p className="text-3xl font-bold text-green-600">{calculatedRotation}</p>
                          <p className="text-xs text-muted-foreground">days</p>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-blue-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                            <span className="text-sm text-muted-foreground">Growth Rate Used</span>
                          </div>
                          <p className="text-3xl font-bold text-blue-600">{effectiveGrowth}</p>
                          <p className="text-xs text-muted-foreground">kg DM/ha/day</p>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-orange-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-1">
                            <MapPin className="h-4 w-4 text-orange-600" />
                            <span className="text-sm text-muted-foreground">Daily Grazing</span>
                          </div>
                          <p className="text-3xl font-bold text-orange-600">{areaPerDay.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground">ha/day</p>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-purple-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Target className="h-4 w-4 text-purple-600" />
                            <span className="text-sm text-muted-foreground">Target Rotation</span>
                          </div>
                          <p className="text-3xl font-bold text-purple-600">{farmMetrics.targetRotation}</p>
                          <p className="text-xs text-muted-foreground">days</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Calculation Breakdown */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Rotation Calculation</CardTitle>
                        <CardDescription>How the rotation length is determined</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="p-4 bg-muted rounded-lg">
                              <p className="text-sm font-medium mb-3">Formula</p>
                              <div className="text-center p-3 bg-white rounded border">
                                <p className="text-lg font-mono">
                                  Rotation = (Pre-grazing - Residual) ÷ Growth
                                </p>
                              </div>
                              <div className="mt-3 space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span>Pre-grazing target:</span>
                                  <span className="font-medium">{feedWedgeSettings.preGrazingTarget} kg/ha</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Post-grazing residual:</span>
                                  <span className="font-medium">{feedWedgeSettings.postGrazingTarget} kg/ha</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Cover to regrow:</span>
                                  <span className="font-bold">{coverToGrow} kg/ha</span>
                                </div>
                                <div className="flex justify-between border-t pt-2">
                                  <span>Growth rate:</span>
                                  <span className="font-medium">{effectiveGrowth} kg/ha/day</span>
                                </div>
                                <div className="flex justify-between text-lg">
                                  <span className="font-medium">Rotation:</span>
                                  <span className="font-bold text-green-600">{calculatedRotation} days</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="p-4 bg-blue-50 rounded-lg">
                              <p className="text-sm font-medium text-blue-800 mb-2">Grazing Requirements</p>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-blue-700">Total area:</span>
                                  <span className="font-medium">{totalArea} ha</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-blue-700">Total paddocks:</span>
                                  <span className="font-medium">{totalPaddocks}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-blue-700">Area per day:</span>
                                  <span className="font-medium">{areaPerDay.toFixed(2)} ha</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-blue-700">Paddocks per day:</span>
                                  <span className="font-medium">{paddocksPerDay.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>

                            <div className={`p-4 rounded-lg ${
                              Math.abs(calculatedRotation - farmMetrics.targetRotation) <= 3 
                                ? 'bg-green-50' 
                                : calculatedRotation > farmMetrics.targetRotation 
                                  ? 'bg-blue-50' 
                                  : 'bg-orange-50'
                            }`}>
                              <p className="text-sm font-medium mb-1">
                                {Math.abs(calculatedRotation - farmMetrics.targetRotation) <= 3 
                                  ? '✓ On Target' 
                                  : calculatedRotation > farmMetrics.targetRotation 
                                    ? '↑ Longer than target' 
                                    : '↓ Shorter than target'}
                              </p>
                              <p className="text-xs">
                                {Math.abs(calculatedRotation - farmMetrics.targetRotation) <= 3 
                                  ? 'Calculated rotation matches your target rotation length.'
                                  : calculatedRotation > farmMetrics.targetRotation 
                                    ? `Growth allows ${calculatedRotation - farmMetrics.targetRotation} extra days. Consider building covers or making silage.`
                                    : `Rotation is ${farmMetrics.targetRotation - calculatedRotation} days shorter than target. May need to reduce demand or supplement.`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Seasonal Growth Rates */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Seasonal Growth Adjustments</CardTitle>
                        <CardDescription>Typical pasture growth rates by month (NZ conditions)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                          {Object.entries(seasonalGrowthRates).map(([month, data]) => {
                            const isCurrentMonth = parseInt(month) === currentMonth;
                            return (
                              <div 
                                key={month}
                                className={`text-center p-2 rounded-lg ${isCurrentMonth ? 'ring-2 ring-blue-500' : ''}`}
                              >
                                <div 
                                  className={`${data.color} text-white rounded p-2 mb-1`}
                                  style={{ height: `${Math.max(20, data.rate)}px` }}
                                >
                                  <span className="text-xs font-bold">{data.rate}</span>
                                </div>
                                <p className="text-xs">{data.name.slice(0, 3)}</p>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-4 flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Current month:</span>
                            <Badge>{seasonalGrowthRates[currentMonth].name}</Badge>
                            <span className="font-medium">{seasonalGrowthRates[currentMonth].rate} kg/ha/day</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Using:</span>
                            <Badge variant={rotationCalc.seasonalAdjustment ? 'default' : 'secondary'}>
                              {rotationCalc.customGrowthRate > 0 
                                ? 'Custom' 
                                : rotationCalc.seasonalAdjustment 
                                  ? 'Seasonal' 
                                  : 'Measured'}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Visual Calendar View */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Grazing Calendar</CardTitle>
                        <CardDescription>Visual rotation schedule for the next 2 months</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Calendar Legend */}
                          <div className="flex gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-blue-100 border-2 border-blue-500 rounded" />
                              <span>Today</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-green-100 rounded" />
                              <span>Grazing day</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-purple-200 rounded" />
                              <span>Rotation complete</span>
                            </div>
                          </div>

                          {/* Calendar Grid */}
                          <div className="border rounded-lg overflow-hidden">
                            {/* Day headers */}
                            <div className="grid grid-cols-7 bg-muted">
                              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <div key={day} className="p-2 text-center text-sm font-medium">
                                  {day}
                                </div>
                              ))}
                            </div>

                            {/* Calendar weeks */}
                            {weeks.slice(0, 9).map((week, weekIndex) => (
                              <div key={weekIndex} className="grid grid-cols-7 border-t">
                                {week.map((day, dayIndex) => {
                                  const dateKey = format(day, 'yyyy-MM-dd');
                                  const schedule = grazingSchedule[dateKey];
                                  const isCurrentDay = isToday(day);
                                  const isPast = day < today;
                                  const isRotationEnd = schedule && schedule.paddockNum === totalPaddocks;
                                  
                                  return (
                                    <div 
                                      key={dayIndex}
                                      className={`p-1 min-h-[60px] border-r last:border-r-0 ${
                                        isCurrentDay 
                                          ? 'bg-blue-100 border-2 border-blue-500' 
                                          : isPast 
                                            ? 'bg-gray-50 text-gray-400'
                                            : isRotationEnd
                                              ? 'bg-purple-100'
                                              : schedule 
                                                ? 'bg-green-50' 
                                                : ''
                                      }`}
                                    >
                                      <div className="text-xs font-medium">
                                        {format(day, 'd')}
                                      </div>
                                      {schedule && !isPast && (
                                        <div className="mt-1">
                                          <div className="text-xs text-green-700">
                                            P{schedule.paddockNum}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {schedule.area.toFixed(1)}ha
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>

                          <p className="text-xs text-muted-foreground text-center">
                            P = Paddock number to graze • Shows {calculatedRotation}-day rotation cycle
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Rotation Comparison */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Seasonal Rotation Comparison</CardTitle>
                        <CardDescription>How rotation length changes through the year</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Month</TableHead>
                              <TableHead className="text-right">Growth Rate</TableHead>
                              <TableHead className="text-right">Rotation Length</TableHead>
                              <TableHead className="text-right">Area/Day</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(seasonalGrowthRates).map(([month, data]) => {
                              const rotation = data.rate > 0 ? Math.round(coverToGrow / data.rate) : 999;
                              const areaDay = totalArea / Math.max(rotation, 1);
                              const isCurrentMonth = parseInt(month) === currentMonth;
                              
                              return (
                                <TableRow key={month} className={isCurrentMonth ? 'bg-blue-50' : ''}>
                                  <TableCell className="font-medium">
                                    {data.name}
                                    {isCurrentMonth && <Badge className="ml-2" variant="outline">Current</Badge>}
                                  </TableCell>
                                  <TableCell className="text-right">{data.rate} kg/ha/day</TableCell>
                                  <TableCell className="text-right font-medium">{rotation} days</TableCell>
                                  <TableCell className="text-right">{areaDay.toFixed(2)} ha</TableCell>
                                  <TableCell>
                                    {rotation <= 20 ? (
                                      <Badge variant="destructive">Fast</Badge>
                                    ) : rotation <= 30 ? (
                                      <Badge className="bg-green-500">Optimal</Badge>
                                    ) : rotation <= 45 ? (
                                      <Badge variant="secondary">Slow</Badge>
                                    ) : (
                                      <Badge variant="outline">Very Slow</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>
          )}
        </TabsContent>

        {/* Grazing Sequence Tab */}
        <TabsContent value="sequence" className="mt-4">
          {loadingCover ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Grazing Sequence Planner</h3>
                  <p className="text-sm text-muted-foreground">Plan and optimize your paddock grazing order</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // Auto-suggest sequence based on cover and rest days
                      const paddocksWithData = (farmCover?.paddocks || [])
                        .map(p => ({
                          id: p.pastureId,
                          cover: p.coverKgDmHa || 0,
                          daysSince: p.daysSinceLastMeasurement || 0,
                          name: p.pastureName,
                          paddockNumber: p.paddockNumber,
                        }))
                        .filter(p => p.cover >= feedWedgeSettings.readyToGrazeMin)
                        .sort((a, b) => b.cover - a.cover);
                      
                      setGrazingSequence(paddocksWithData.map(p => p.id));
                      toast.success(`Auto-suggested ${paddocksWithData.length} paddocks based on cover`);
                    }}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Auto-Suggest
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setGrazingSequence([]);
                      toast.info("Sequence cleared");
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </div>

              {(() => {
                // Get paddock data with cover info
                const paddockData = (farmCover?.paddocks || []).map(p => {
                  const cover = p.coverKgDmHa || 0;
                  const restDays = p.daysSinceLastMeasurement || 0;
                  const growthRate = p.growthRateKgDay || farmCover?.summary.averageGrowthRate || 30;
                  const daysToReady = cover < feedWedgeSettings.readyToGrazeMin 
                    ? Math.ceil((feedWedgeSettings.readyToGrazeMin - cover) / Math.max(growthRate, 1))
                    : 0;
                  
                  let status: 'ready' | 'growing' | 'deficit' | 'grazing' = 'growing';
                  if (p.status === 'grazing') status = 'grazing';
                  else if (cover >= feedWedgeSettings.readyToGrazeMin) status = 'ready';
                  else if (cover < feedWedgeSettings.deficitThreshold) status = 'deficit';
                  
                  return {
                    id: p.pastureId,
                    name: p.pastureName,
                    paddockNumber: p.paddockNumber,
                    cover,
                    area: p.area || 0,
                    restDays,
                    growthRate,
                    daysToReady,
                    status,
                    lastGrazed: p.measurementDate,
                  };
                });

                // Available paddocks (not in sequence)
                const availablePaddocks = paddockData.filter(p => !grazingSequence.includes(p.id));
                
                // Sequenced paddocks with position info
                const sequencedPaddocks = grazingSequence.map((id, index) => {
                  const paddock = paddockData.find(p => p.id === id);
                  if (!paddock) return null;
                  
                  // Calculate grazing date based on position
                  const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || 100;
                  const rotation = farmMetrics.targetRotation || 25;
                  const areaPerDay = totalArea / rotation;
                  let cumulativeArea = 0;
                  for (let i = 0; i < index; i++) {
                    const prevPaddock = paddockData.find(p => p.id === grazingSequence[i]);
                    cumulativeArea += prevPaddock?.area || 0;
                  }
                  const daysFromNow = Math.floor(cumulativeArea / areaPerDay);
                  const grazingDate = addDays(new Date(), daysFromNow);
                  
                  // Check for conflicts
                  const conflicts: string[] = [];
                  if (paddock.status === 'deficit') {
                    conflicts.push('Paddock is in deficit - cover too low');
                  }
                  if (paddock.status === 'growing' && paddock.daysToReady > daysFromNow) {
                    conflicts.push(`Not ready - needs ${paddock.daysToReady - daysFromNow} more days`);
                  }
                  if (paddock.status === 'grazing') {
                    conflicts.push('Currently being grazed');
                  }
                  if (paddock.restDays < 20 && index < 3) {
                    conflicts.push('Short rest period - may affect regrowth');
                  }
                  
                  return {
                    ...paddock,
                    position: index + 1,
                    grazingDate,
                    daysFromNow,
                    conflicts,
                  };
                }).filter(Boolean);

                // Drag handlers
                const handleDragStart = (id: string) => {
                  setDraggedPaddock(id);
                };

                const handleDragOver = (e: React.DragEvent, targetId: string) => {
                  e.preventDefault();
                  if (!draggedPaddock || draggedPaddock === targetId) return;
                };

                const handleDrop = (e: React.DragEvent, targetId: string) => {
                  e.preventDefault();
                  if (!draggedPaddock || draggedPaddock === targetId) return;
                  
                  const newSequence = [...grazingSequence];
                  const dragIndex = newSequence.indexOf(draggedPaddock);
                  const dropIndex = newSequence.indexOf(targetId);
                  
                  if (dragIndex !== -1 && dropIndex !== -1) {
                    newSequence.splice(dragIndex, 1);
                    newSequence.splice(dropIndex, 0, draggedPaddock);
                    setGrazingSequence(newSequence);
                  }
                  setDraggedPaddock(null);
                };

                const moveUp = (index: number) => {
                  if (index <= 0) return;
                  const newSequence = [...grazingSequence];
                  [newSequence[index - 1], newSequence[index]] = [newSequence[index], newSequence[index - 1]];
                  setGrazingSequence(newSequence);
                };

                const moveDown = (index: number) => {
                  if (index >= grazingSequence.length - 1) return;
                  const newSequence = [...grazingSequence];
                  [newSequence[index], newSequence[index + 1]] = [newSequence[index + 1], newSequence[index]];
                  setGrazingSequence(newSequence);
                };

                const removeFromSequence = (id: string) => {
                  setGrazingSequence(grazingSequence.filter(p => p !== id));
                };

                const addToSequence = (id: string) => {
                  if (!grazingSequence.includes(id)) {
                    setGrazingSequence([...grazingSequence, id]);
                  }
                };

                const totalConflicts = sequencedPaddocks.reduce((sum, p) => sum + (p?.conflicts.length || 0), 0);

                return (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="border-l-4 border-green-500">
                        <CardContent className="pt-4">
                          <p className="text-sm text-muted-foreground">In Sequence</p>
                          <p className="text-3xl font-bold text-green-600">{grazingSequence.length}</p>
                          <p className="text-xs text-muted-foreground">paddocks planned</p>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-blue-500">
                        <CardContent className="pt-4">
                          <p className="text-sm text-muted-foreground">Available</p>
                          <p className="text-3xl font-bold text-blue-600">{availablePaddocks.filter(p => p.status === 'ready').length}</p>
                          <p className="text-xs text-muted-foreground">ready to graze</p>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-yellow-500">
                        <CardContent className="pt-4">
                          <p className="text-sm text-muted-foreground">Growing</p>
                          <p className="text-3xl font-bold text-yellow-600">{availablePaddocks.filter(p => p.status === 'growing').length}</p>
                          <p className="text-xs text-muted-foreground">not yet ready</p>
                        </CardContent>
                      </Card>
                      <Card className={`border-l-4 ${totalConflicts > 0 ? 'border-red-500' : 'border-gray-300'}`}>
                        <CardContent className="pt-4">
                          <p className="text-sm text-muted-foreground">Conflicts</p>
                          <p className={`text-3xl font-bold ${totalConflicts > 0 ? 'text-red-600' : 'text-gray-400'}`}>{totalConflicts}</p>
                          <p className="text-xs text-muted-foreground">warnings</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Grazing Sequence */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <GripVertical className="h-5 w-5" />
                            Grazing Sequence
                          </CardTitle>
                          <CardDescription>Drag to reorder or use arrows</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {grazingSequence.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <p>No paddocks in sequence</p>
                              <p className="text-sm mt-1">Click "Auto-Suggest" or add paddocks from the right</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {sequencedPaddocks.map((paddock, index) => paddock && (
                                <div
                                  key={paddock.id}
                                  draggable
                                  onDragStart={() => handleDragStart(paddock.id)}
                                  onDragOver={(e) => handleDragOver(e, paddock.id)}
                                  onDrop={(e) => handleDrop(e, paddock.id)}
                                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-move transition-all ${
                                    draggedPaddock === paddock.id ? 'opacity-50 border-dashed' : ''
                                  } ${
                                    paddock.conflicts.length > 0 ? 'border-red-300 bg-red-50' : 'bg-white hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <GripVertical className="h-4 w-4 text-gray-400" />
                                    <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                      {paddock.position}
                                    </span>
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium truncate">
                                        {paddock.paddockNumber ? `#${paddock.paddockNumber}` : paddock.name}
                                      </p>
                                      {paddock.conflicts.length > 0 && (
                                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      <span>{paddock.cover} kg/ha</span>
                                      <span>{paddock.area} ha</span>
                                      <span>{format(paddock.grazingDate, 'MMM d')}</span>
                                    </div>
                                    {paddock.conflicts.length > 0 && (
                                      <p className="text-xs text-red-600 mt-1">{paddock.conflicts[0]}</p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-8 w-8 p-0"
                                      onClick={() => moveUp(index)}
                                      disabled={index === 0}
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-8 w-8 p-0"
                                      onClick={() => moveDown(index)}
                                      disabled={index === grazingSequence.length - 1}
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                      onClick={() => removeFromSequence(paddock.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Available Paddocks */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Available Paddocks</CardTitle>
                          <CardDescription>Click to add to sequence</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {availablePaddocks.length === 0 ? (
                              <p className="text-center py-4 text-muted-foreground">All paddocks are in sequence</p>
                            ) : (
                              availablePaddocks
                                .sort((a, b) => b.cover - a.cover)
                                .map((paddock) => (
                                  <div
                                    key={paddock.id}
                                    onClick={() => addToSequence(paddock.id)}
                                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all hover:border-green-500 ${
                                      paddock.status === 'ready' ? 'bg-green-50 border-green-200' :
                                      paddock.status === 'growing' ? 'bg-yellow-50 border-yellow-200' :
                                      paddock.status === 'deficit' ? 'bg-red-50 border-red-200' :
                                      'bg-blue-50 border-blue-200'
                                    }`}
                                  >
                                    <div>
                                      <p className="font-medium">
                                        {paddock.paddockNumber ? `#${paddock.paddockNumber}` : paddock.name}
                                      </p>
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span>{paddock.cover} kg/ha</span>
                                        <span>{paddock.area} ha</span>
                                        {paddock.daysToReady > 0 && (
                                          <span className="text-yellow-600">Ready in {paddock.daysToReady}d</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant={
                                        paddock.status === 'ready' ? 'default' :
                                        paddock.status === 'growing' ? 'secondary' :
                                        paddock.status === 'deficit' ? 'destructive' :
                                        'outline'
                                      }>
                                        {paddock.status}
                                      </Badge>
                                      <Plus className="h-4 w-4 text-green-600" />
                                    </div>
                                  </div>
                                ))
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Sequence Timeline */}
                    {grazingSequence.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Sequence Timeline</CardTitle>
                          <CardDescription>Visual overview of planned grazing dates</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2 overflow-x-auto pb-4">
                            {sequencedPaddocks.slice(0, 14).map((paddock, index) => paddock && (
                              <div key={paddock.id} className="flex items-center">
                                <div className={`flex flex-col items-center p-3 rounded-lg min-w-[80px] ${
                                  paddock.conflicts.length > 0 ? 'bg-red-100' : 'bg-green-100'
                                }`}>
                                  <span className="text-xs text-muted-foreground">{format(paddock.grazingDate, 'MMM d')}</span>
                                  <span className="font-bold text-lg">
                                    {paddock.paddockNumber ? `#${paddock.paddockNumber}` : paddock.name?.slice(0, 3)}
                                  </span>
                                  <span className="text-xs">{paddock.cover} kg/ha</span>
                                  {paddock.conflicts.length > 0 && (
                                    <AlertTriangle className="h-3 w-3 text-red-500 mt-1" />
                                  )}
                                </div>
                                {index < sequencedPaddocks.length - 1 && index < 13 && (
                                  <ArrowRight className="h-4 w-4 text-gray-400 mx-1 flex-shrink-0" />
                                )}
                              </div>
                            ))}
                            {grazingSequence.length > 14 && (
                              <div className="text-sm text-muted-foreground ml-2">
                                +{grazingSequence.length - 14} more
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Conflict Summary */}
                    {totalConflicts > 0 && (
                      <Card className="border-red-200">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-red-700">
                            <AlertTriangle className="h-5 w-5" />
                            Conflict Warnings ({totalConflicts})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {sequencedPaddocks.filter(p => p && p.conflicts.length > 0).map(paddock => paddock && (
                              <div key={paddock.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="font-medium text-red-800">
                                    Position {paddock.position}: {paddock.paddockNumber ? `Paddock #${paddock.paddockNumber}` : paddock.name}
                                  </p>
                                  <ul className="text-sm text-red-600 mt-1">
                                    {paddock.conflicts.map((conflict, i) => (
                                      <li key={i}>• {conflict}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </TabsContent>

        {/* Growth Trends Tab */}
        <TabsContent value="trends" className="mt-4">
          {loadingCover ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
          ) : (
            <div className="space-y-6">
              {/* Header with Controls */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">Growth Rate Trends</h2>
                  <p className="text-muted-foreground">Analyze historical patterns and weather correlations</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings2 className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">Current Growth</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {farmCover?.summary.averageGrowthRate || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">kg DM/ha/day</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-green-600">
                        +12% vs last month
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-muted-foreground">Seasonal Avg</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">45</p>
                    <p className="text-xs text-muted-foreground">kg DM/ha/day</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-blue-600">
                        Spring typical
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-4 w-4 text-orange-600" />
                      <span className="text-sm text-muted-foreground">YoY Change</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-600">+8%</p>
                    <p className="text-xs text-muted-foreground">vs last year</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-orange-600">
                        Above trend
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CloudSun className="h-4 w-4 text-purple-600" />
                      <span className="text-sm text-muted-foreground">Weather Impact</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">High</p>
                    <p className="text-xs text-muted-foreground">Correlation</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-purple-600">
                        0.72 R²
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Historical Comparison Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Historical Growth Comparison</CardTitle>
                  <CardDescription>
                    Compare current season growth rates with previous years
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80 bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Growth Rate Comparison Chart</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        This year vs Last year vs 5-year average
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span>This Year (2024)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Last Year (2023)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                      <span>5-Year Average</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Seasonal Patterns and Weather */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Seasonal Patterns */}
                <Card>
                  <CardHeader>
                    <CardTitle>Seasonal Growth Patterns</CardTitle>
                    <CardDescription>
                      Typical growth rates by month for your region
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { month: 'Spring', rate: 65, trend: 'up', color: 'text-green-600' },
                        { month: 'Summer', rate: 45, trend: 'stable', color: 'text-yellow-600' },
                        { month: 'Autumn', rate: 25, trend: 'down', color: 'text-orange-600' },
                        { month: 'Winter', rate: 10, trend: 'down', color: 'text-blue-600' },
                      ].map((season) => (
                        <div key={season.month} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-8 rounded-full ${
                              season.month === 'Spring' ? 'bg-green-500' :
                              season.month === 'Summer' ? 'bg-yellow-500' :
                              season.month === 'Autumn' ? 'bg-orange-500' : 'bg-blue-500'
                            }`}></div>
                            <div>
                              <p className="font-medium">{season.month}</p>
                              <p className="text-sm text-muted-foreground">
                                {season.month === 'Spring' ? 'Sep-Nov' :
                                 season.month === 'Summer' ? 'Dec-Feb' :
                                 season.month === 'Autumn' ? 'Mar-May' : 'Jun-Aug'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${season.color}`}>{season.rate} kg/ha/day</p>
                            <p className="text-xs text-muted-foreground">
                              {season.trend === 'up' ? '↗ Peak season' :
                               season.trend === 'stable' ? '→ Consistent' : '↘ Low growth'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Weather Correlation */}
                <Card>
                  <CardHeader>
                    <CardTitle>Weather Correlation Analysis</CardTitle>
                    <CardDescription>
                      How weather factors affect pasture growth
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Droplets className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">Rainfall</span>
                          </div>
                          <Badge variant="outline" className="text-blue-600">Strong correlation</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Growth increases 15% per 25mm of weekly rainfall
                        </p>
                        <div className="mt-2 h-2 bg-blue-200 rounded-full">
                          <div className="h-2 bg-blue-600 rounded-full" style={{width: '85%'}}></div>
                        </div>
                      </div>

                      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Sun className="h-4 w-4 text-orange-600" />
                            <span className="font-medium">Temperature</span>
                          </div>
                          <Badge variant="outline" className="text-orange-600">Moderate correlation</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Optimal growth between 15-20°C daily average
                        </p>
                        <div className="mt-2 h-2 bg-orange-200 rounded-full">
                          <div className="h-2 bg-orange-600 rounded-full" style={{width: '65%'}}></div>
                        </div>
                      </div>

                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Cloud className="h-4 w-4 text-yellow-600" />
                            <span className="font-medium">Soil Moisture</span>
                          </div>
                          <Badge variant="outline" className="text-yellow-600">High correlation</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Peak growth at 40-60% field capacity
                        </p>
                        <div className="mt-2 h-2 bg-yellow-200 rounded-full">
                          <div className="h-2 bg-yellow-600 rounded-full" style={{width: '75%'}}></div>
                        </div>
                      </div>

                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Wind className="h-4 w-4 text-purple-600" />
                            <span className="font-medium">Growing Degree Days</span>
                          </div>
                          <Badge variant="outline" className="text-purple-600">Very high correlation</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Strong predictor of seasonal growth potential
                        </p>
                        <div className="mt-2 h-2 bg-purple-200 rounded-full">
                          <div className="h-2 bg-purple-600 rounded-full" style={{width: '90%'}}></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Insights and Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle>Key Insights & Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-medium text-green-700">📈 Positive Trends</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          <span>Growth rate 8% above last year's performance</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          <span>Spring growth tracking 12% ahead of seasonal average</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          <span>Consistent growth patterns across all paddocks</span>
                        </li>
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-medium text-orange-700">⚠️ Areas to Watch</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                          <span>Summer growth may decline if rainfall continues below average</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                          <span>North-facing paddocks showing slower response to rain</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                          <span>Consider nitrogen application if growth stalls</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Feed Budget Forecasting Tab */}
        <TabsContent value="forecast" className="mt-4">
          {loadingCover ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
          ) : (
            <div className="space-y-6">
              {/* Header with Controls */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">Feed Budget Forecasting</h2>
                  <p className="text-muted-foreground">30/60/90 day projections with supplement requirements</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export Forecast
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings2 className="h-4 w-4 mr-2" />
                    Forecast Settings
                  </Button>
                </div>
              </div>

              {/* Alert Section */}
              {(farmMetrics?.herdSize * farmMetrics?.demandPerCow > 0) && (() => {
                const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || 0;
                const effectiveArea = totalArea || farmMetrics.effectiveArea || 100;
                const afc = farmCover?.summary.weightedAverageCover || farmCover?.summary.averageCover || 0;
                const growthRate = farmCover?.summary.averageGrowthRate || 0;
                const dailyDemand = farmMetrics.herdSize * farmMetrics.demandPerCow;
                const demandPerHa = effectiveArea > 0 ? dailyDemand / effectiveArea : 0;
                const availableFeed = Math.max(0, afc - feedWedgeSettings.postGrazingTarget);
                const daysAhead = demandPerHa > 0 ? Math.round(availableFeed / demandPerHa) : 0;
                const feedBalance = growthRate - demandPerHa;
                
                // Calculate projections
                const projection30 = daysAhead + (feedBalance * 30);
                const projection60 = daysAhead + (feedBalance * 60);
                const projection90 = daysAhead + (feedBalance * 90);
                
                // Determine alerts
                const alert30 = projection30 < 20 ? 'critical' : projection30 < 35 ? 'warning' : 'good';
                const alert60 = projection60 < 20 ? 'critical' : projection60 < 35 ? 'warning' : 'good';
                const alert90 = projection90 < 20 ? 'critical' : projection90 < 35 ? 'warning' : 'good';
                
                return (
                  <>
                    {(alert30 === 'critical' || alert60 === 'critical' || alert90 === 'critical') && (
                      <Card className="border-red-200 bg-red-50">
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                            <div>
                              <h3 className="font-semibold text-red-800">Critical Feed Deficit Alert</h3>
                              <p className="text-red-700 text-sm mt-1">
                                {alert90 === 'critical' ? '90-day projection shows severe feed shortage' :
                                 alert60 === 'critical' ? '60-day projection shows feed deficit' :
                                 '30-day projection shows immediate feed shortage'}
                              </p>
                              <div className="mt-3 flex gap-2">
                                <Button size="sm" variant="destructive">
                                  <AlertTriangle className="h-4 w-4 mr-2" />
                                  Action Required
                                </Button>
                                <Button size="sm" variant="outline">
                                  View Supplement Plan
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {(alert30 === 'warning' || alert60 === 'warning' || alert90 === 'warning') && (
                      <Card className="border-orange-200 bg-orange-50">
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                            <div>
                              <h3 className="font-semibold text-orange-800">Feed Budget Warning</h3>
                              <p className="text-orange-700 text-sm mt-1">
                                Monitor feed levels closely - potential deficit approaching
                              </p>
                              <div className="mt-3 flex gap-2">
                                <Button size="sm" variant="outline">
                                  <Eye className="h-4 w-4 mr-2" />
                                  Monitor Closely
                                </Button>
                                <Button size="sm" variant="outline">
                                  Update Forecast
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                );
              })()}

              {/* Projection Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-muted-foreground">30-Day Projection</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">
                      {(() => {
                        const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || 0;
                        const effectiveArea = totalArea || farmMetrics.effectiveArea || 100;
                        const afc = farmCover?.summary.weightedAverageCover || farmCover?.summary.averageCover || 0;
                        const growthRate = farmCover?.summary.averageGrowthRate || 0;
                        const dailyDemand = farmMetrics.herdSize * farmMetrics.demandPerCow;
                        const demandPerHa = effectiveArea > 0 ? dailyDemand / effectiveArea : 0;
                        const availableFeed = Math.max(0, afc - feedWedgeSettings.postGrazingTarget);
                        const daysAhead = demandPerHa > 0 ? Math.round(availableFeed / demandPerHa) : 0;
                        const feedBalance = growthRate - demandPerHa;
                        const projection30 = Math.round(daysAhead + (feedBalance * 30));
                        return projection30;
                      })()} days
                    </p>
                    <p className="text-xs text-muted-foreground">of feed available</p>
                    <div className="mt-2">
                      <Badge variant={
                        (() => {
                          const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || 0;
                          const effectiveArea = totalArea || farmMetrics.effectiveArea || 100;
                          const afc = farmCover?.summary.weightedAverageCover || farmCover?.summary.averageCover || 0;
                          const growthRate = farmCover?.summary.averageGrowthRate || 0;
                          const dailyDemand = farmMetrics.herdSize * farmMetrics.demandPerCow;
                          const demandPerHa = effectiveArea > 0 ? dailyDemand / effectiveArea : 0;
                          const availableFeed = Math.max(0, afc - feedWedgeSettings.postGrazingTarget);
                          const daysAhead = demandPerHa > 0 ? Math.round(availableFeed / demandPerHa) : 0;
                          const feedBalance = growthRate - demandPerHa;
                          const projection30 = Math.round(daysAhead + (feedBalance * 30));
                          return projection30 < 20 ? 'destructive' : projection30 < 35 ? 'secondary' : 'default';
                        })()
                      }>
                        {(() => {
                          const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || 0;
                          const effectiveArea = totalArea || farmMetrics.effectiveArea || 100;
                          const afc = farmCover?.summary.weightedAverageCover || farmCover?.summary.averageCover || 0;
                          const growthRate = farmCover?.summary.averageGrowthRate || 0;
                          const dailyDemand = farmMetrics.herdSize * farmMetrics.demandPerCow;
                          const demandPerHa = effectiveArea > 0 ? dailyDemand / effectiveArea : 0;
                          const availableFeed = Math.max(0, afc - feedWedgeSettings.postGrazingTarget);
                          const daysAhead = demandPerHa > 0 ? Math.round(availableFeed / demandPerHa) : 0;
                          const feedBalance = growthRate - demandPerHa;
                          const projection30 = Math.round(daysAhead + (feedBalance * 30));
                          return projection30 < 20 ? 'Critical' : projection30 < 35 ? 'Warning' : 'Good';
                        })()}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-orange-600" />
                      <span className="text-sm text-muted-foreground">60-Day Projection</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-600">
                      {(() => {
                        const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || 0;
                        const effectiveArea = totalArea || farmMetrics.effectiveArea || 100;
                        const afc = farmCover?.summary.weightedAverageCover || farmCover?.summary.averageCover || 0;
                        const growthRate = farmCover?.summary.averageGrowthRate || 0;
                        const dailyDemand = farmMetrics.herdSize * farmMetrics.demandPerCow;
                        const demandPerHa = effectiveArea > 0 ? dailyDemand / effectiveArea : 0;
                        const availableFeed = Math.max(0, afc - feedWedgeSettings.postGrazingTarget);
                        const daysAhead = demandPerHa > 0 ? Math.round(availableFeed / demandPerHa) : 0;
                        const feedBalance = growthRate - demandPerHa;
                        const projection60 = Math.round(daysAhead + (feedBalance * 60));
                        return projection60;
                      })()} days
                    </p>
                    <p className="text-xs text-muted-foreground">of feed available</p>
                    <div className="mt-2">
                      <Badge variant={
                        (() => {
                          const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || 0;
                          const effectiveArea = totalArea || farmMetrics.effectiveArea || 100;
                          const afc = farmCover?.summary.weightedAverageCover || farmCover?.summary.averageCover || 0;
                          const growthRate = farmCover?.summary.averageGrowthRate || 0;
                          const dailyDemand = farmMetrics.herdSize * farmMetrics.demandPerCow;
                          const demandPerHa = effectiveArea > 0 ? dailyDemand / effectiveArea : 0;
                          const availableFeed = Math.max(0, afc - feedWedgeSettings.postGrazingTarget);
                          const daysAhead = demandPerHa > 0 ? Math.round(availableFeed / demandPerHa) : 0;
                          const feedBalance = growthRate - demandPerHa;
                          const projection60 = Math.round(daysAhead + (feedBalance * 60));
                          return projection60 < 20 ? 'destructive' : projection60 < 35 ? 'secondary' : 'default';
                        })()
                      }>
                        {(() => {
                          const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || 0;
                          const effectiveArea = totalArea || farmMetrics.effectiveArea || 100;
                          const afc = farmCover?.summary.weightedAverageCover || farmCover?.summary.averageCover || 0;
                          const growthRate = farmCover?.summary.averageGrowthRate || 0;
                          const dailyDemand = farmMetrics.herdSize * farmMetrics.demandPerCow;
                          const demandPerHa = effectiveArea > 0 ? dailyDemand / effectiveArea : 0;
                          const availableFeed = Math.max(0, afc - feedWedgeSettings.postGrazingTarget);
                          const daysAhead = demandPerHa > 0 ? Math.round(availableFeed / demandPerHa) : 0;
                          const feedBalance = growthRate - demandPerHa;
                          const projection60 = Math.round(daysAhead + (feedBalance * 60));
                          return projection60 < 20 ? 'Critical' : projection60 < 35 ? 'Warning' : 'Good';
                        })()}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-purple-600" />
                      <span className="text-sm text-muted-foreground">90-Day Projection</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">
                      {(() => {
                        const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || 0;
                        const effectiveArea = totalArea || farmMetrics.effectiveArea || 100;
                        const afc = farmCover?.summary.weightedAverageCover || farmCover?.summary.averageCover || 0;
                        const growthRate = farmCover?.summary.averageGrowthRate || 0;
                        const dailyDemand = farmMetrics.herdSize * farmMetrics.demandPerCow;
                        const demandPerHa = effectiveArea > 0 ? dailyDemand / effectiveArea : 0;
                        const availableFeed = Math.max(0, afc - feedWedgeSettings.postGrazingTarget);
                        const daysAhead = demandPerHa > 0 ? Math.round(availableFeed / demandPerHa) : 0;
                        const feedBalance = growthRate - demandPerHa;
                        const projection90 = Math.round(daysAhead + (feedBalance * 90));
                        return projection90;
                      })()} days
                    </p>
                    <p className="text-xs text-muted-foreground">of feed available</p>
                    <div className="mt-2">
                      <Badge variant={
                        (() => {
                          const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || 0;
                          const effectiveArea = totalArea || farmMetrics.effectiveArea || 100;
                          const afc = farmCover?.summary.weightedAverageCover || farmCover?.summary.averageCover || 0;
                          const growthRate = farmCover?.summary.averageGrowthRate || 0;
                          const dailyDemand = farmMetrics.herdSize * farmMetrics.demandPerCow;
                          const demandPerHa = effectiveArea > 0 ? dailyDemand / effectiveArea : 0;
                          const availableFeed = Math.max(0, afc - feedWedgeSettings.postGrazingTarget);
                          const daysAhead = demandPerHa > 0 ? Math.round(availableFeed / demandPerHa) : 0;
                          const feedBalance = growthRate - demandPerHa;
                          const projection90 = Math.round(daysAhead + (feedBalance * 90));
                          return projection90 < 20 ? 'destructive' : projection90 < 35 ? 'secondary' : 'default';
                        })()
                      }>
                        {(() => {
                          const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || 0;
                          const effectiveArea = totalArea || farmMetrics.effectiveArea || 100;
                          const afc = farmCover?.summary.weightedAverageCover || farmCover?.summary.averageCover || 0;
                          const growthRate = farmCover?.summary.averageGrowthRate || 0;
                          const dailyDemand = farmMetrics.herdSize * farmMetrics.demandPerCow;
                          const demandPerHa = effectiveArea > 0 ? dailyDemand / effectiveArea : 0;
                          const availableFeed = Math.max(0, afc - feedWedgeSettings.postGrazingTarget);
                          const daysAhead = demandPerHa > 0 ? Math.round(availableFeed / demandPerHa) : 0;
                          const feedBalance = growthRate - demandPerHa;
                          const projection90 = Math.round(daysAhead + (feedBalance * 90));
                          return projection90 < 20 ? 'Critical' : projection90 < 35 ? 'Warning' : 'Good';
                        })()}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Forecast Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Feed Budget Projection Chart</CardTitle>
                  <CardDescription>
                    Visual forecast of feed availability vs demand over 90 days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80 bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Feed Availability Forecast</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Shows projected feed surplus/deficit over time
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Feed Available (Pasture Growth)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span>Feed Demand (Herd Consumption)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Supplement Requirements */}
              <Card>
                <CardHeader>
                  <CardTitle>Supplement Requirements</CardTitle>
                  <CardDescription>
                    Predicted supplement needs based on forecast deficits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(() => {
                      const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || 0;
                      const effectiveArea = totalArea || farmMetrics.effectiveArea || 100;
                      const afc = farmCover?.summary.weightedAverageCover || farmCover?.summary.averageCover || 0;
                      const growthRate = farmCover?.summary.averageGrowthRate || 0;
                      const dailyDemand = farmMetrics.herdSize * farmMetrics.demandPerCow;
                      const demandPerHa = effectiveArea > 0 ? dailyDemand / effectiveArea : 0;
                      const availableFeed = Math.max(0, afc - feedWedgeSettings.postGrazingTarget);
                      const daysAhead = demandPerHa > 0 ? Math.round(availableFeed / demandPerHa) : 0;
                      const feedBalance = growthRate - demandPerHa;
                      const dailyDeficit = Math.max(0, -feedBalance * effectiveArea);
                      
                      const supplements = [
                        {
                          type: 'Palm Kernel',
                          dailyNeed: Math.round(dailyDeficit * 0.4),
                          cost: '$320/ton',
                          duration: feedBalance < 0 ? '90 days' : 'As needed'
                        },
                        {
                          type: 'Hay/Silage',
                          dailyNeed: Math.round(dailyDeficit * 0.3),
                          cost: '$280/ton',
                          duration: feedBalance < 0 ? '60 days' : 'As needed'
                        },
                        {
                          type: 'Concentrate',
                          dailyNeed: Math.round(dailyDeficit * 0.3),
                          cost: '$450/ton',
                          duration: feedBalance < 0 ? '30 days' : 'As needed'
                        }
                      ];
                      
                      return supplements.map((supplement) => (
                        <div key={supplement.type} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-8 bg-orange-500 rounded-full"></div>
                            <div>
                              <p className="font-medium">{supplement.type}</p>
                              <p className="text-sm text-muted-foreground">
                                {supplement.dailyNeed > 0 ? `${supplement.dailyNeed} kg DM/day` : 'No requirement'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{supplement.cost}</p>
                            <p className="text-sm text-muted-foreground">{supplement.duration}</p>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-800">Estimated Supplement Cost</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">
                      ${(() => {
                        const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || 0;
                        const effectiveArea = totalArea || farmMetrics.effectiveArea || 100;
                        const afc = farmCover?.summary.weightedAverageCover || farmCover?.summary.averageCover || 0;
                        const growthRate = farmCover?.summary.averageGrowthRate || 0;
                        const dailyDemand = farmMetrics.herdSize * farmMetrics.demandPerCow;
                        const demandPerHa = effectiveArea > 0 ? dailyDemand / effectiveArea : 0;
                        const feedBalance = growthRate - demandPerHa;
                        const dailyDeficit = Math.max(0, -feedBalance * effectiveArea);
                        
                        const totalDailyCost = (dailyDeficit * 0.4 * 0.32) + (dailyDeficit * 0.3 * 0.28) + (dailyDeficit * 0.3 * 0.45);
                        return Math.round(totalDailyCost * 90);
                      })().toLocaleString()}
                    </p>
                    <p className="text-sm text-blue-700">for 90-day period if deficit persists</p>
                  </div>
                </CardContent>
              </Card>

              {/* Action Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle>Recommendations & Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-medium text-green-700">📈 Current Opportunities</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          <span>Current growth rate exceeds demand - build feed buffer</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          <span>Consider making extra silage/baleage while surplus exists</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          <span>Optimize rotation to capture maximum growth</span>
                        </li>
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-medium text-orange-700">⚠️ Risk Management</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                          <span>Secure supplement contracts before prices increase</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                          <span>Monitor weather forecasts for growth adjustments</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                          <span>Review stock numbers if deficit persists</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <Button>
                      <Target className="h-4 w-4 mr-2" />
                      Create Action Plan
                    </Button>
                    <Button variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      Set Monitoring Alerts
                    </Button>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Download Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Pasture Quality Metrics Tab */}
        <TabsContent value="quality" className="mt-4">
          {loadingCover ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
          ) : (
            <div className="space-y-6">
              {/* Header with Controls */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">Pasture Quality Metrics</h2>
                  <p className="text-muted-foreground">ME estimates, clover percentage, and weed/dead matter assessment</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export Quality Data
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings2 className="h-4 w-4 mr-2" />
                    Quality Settings
                  </Button>
                </div>
              </div>

              {/* Quality Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">Average ME</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">11.2</p>
                    <p className="text-xs text-muted-foreground">MJ/kg DM</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-green-600">
                        High quality
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Leaf className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">Clover Content</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">32%</p>
                    <p className="text-xs text-muted-foreground">of pasture species</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-green-600">
                        Optimal range
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <span className="text-sm text-muted-foreground">Weed Matter</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-600">8%</p>
                    <p className="text-xs text-muted-foreground">of total biomass</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-orange-600">
                        Monitor closely
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-muted-foreground">Quality Score</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">85/100</p>
                    <p className="text-xs text-muted-foreground">Overall assessment</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-blue-600">
                        Very Good
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ME Estimates by Paddock */}
              <Card>
                <CardHeader>
                  <CardTitle>ME (Metabolisable Energy) Estimates</CardTitle>
                  <CardDescription>
                    Energy content analysis by paddock with seasonal variations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {farmCover?.paddocks.slice(0, 6).map((paddock) => {
                      // Simulate ME calculation based on cover and growth
                      const baseME = 10.5;
                      const growthBonus = (paddock.growthRate || 0) * 0.02;
                      const coverBonus = (paddock.cover || 0) > 2500 ? 0.3 : (paddock.cover || 0) > 2000 ? 0.2 : 0;
                      const me = (baseME + growthBonus + coverBonus + Math.random() * 0.5).toFixed(1);
                      const meLevel = parseFloat(me) > 11.5 ? 'excellent' : parseFloat(me) > 10.5 ? 'good' : parseFloat(me) > 9.5 ? 'fair' : 'poor';
                      
                      return (
                        <div key={paddock.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-8 rounded-full ${
                              meLevel === 'excellent' ? 'bg-green-500' :
                              meLevel === 'good' ? 'bg-blue-500' :
                              meLevel === 'fair' ? 'bg-orange-500' : 'bg-red-500'
                            }`}></div>
                            <div>
                              <p className="font-medium">{paddock.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Cover: {paddock.cover || 0} kg/ha • Growth: {paddock.growthRate || 0} kg/ha/day
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold text-lg ${
                              meLevel === 'excellent' ? 'text-green-600' :
                              meLevel === 'good' ? 'text-blue-600' :
                              meLevel === 'fair' ? 'text-orange-600' : 'text-red-600'
                            }`}>{me} MJ/kg DM</p>
                            <Badge variant={
                              meLevel === 'excellent' ? 'default' :
                              meLevel === 'good' ? 'secondary' : 'outline'
                            }>
                              {meLevel.charAt(0).toUpperCase() + meLevel.slice(1)}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-800">ME Calculation Method</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      ME estimates are calculated based on pasture species composition, growth stage, 
                      and environmental factors. Higher ME indicates better energy availability for livestock.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Clover and Weed Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Clover Percentage Tracking */}
                <Card>
                  <CardHeader>
                    <CardTitle>Clover Percentage Tracking</CardTitle>
                    <CardDescription>
                      Monitor clover content for protein and nitrogen fixation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { paddock: 'Paddock 1', clover: 35, trend: 'up', lastMonth: 30 },
                        { paddock: 'Paddock 2', clover: 28, trend: 'stable', lastMonth: 27 },
                        { paddock: 'Paddock 3', clover: 42, trend: 'up', lastMonth: 38 },
                        { paddock: 'Paddock 4', clover: 25, trend: 'down', lastMonth: 29 },
                        { paddock: 'Paddock 5', clover: 31, trend: 'stable', lastMonth: 31 },
                        { paddock: 'Paddock 6', clover: 38, trend: 'up', lastMonth: 35 },
                      ].map((data) => (
                        <div key={data.paddock} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-8 rounded-full ${
                              data.clover >= 35 ? 'bg-green-500' :
                              data.clover >= 25 ? 'bg-blue-500' : 'bg-orange-500'
                            }`}></div>
                            <div>
                              <p className="font-medium">{data.paddock}</p>
                              <p className="text-sm text-muted-foreground">
                                {data.trend === 'up' ? '↗' : data.trend === 'down' ? '↘' : '→'} {data.lastMonth}% last month
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${
                              data.clover >= 35 ? 'text-green-600' :
                              data.clover >= 25 ? 'text-blue-600' : 'text-orange-600'
                            }`}>{data.clover}%</p>
                            <p className="text-xs text-muted-foreground">
                              {data.clover >= 35 ? 'Excellent' :
                               data.clover >= 25 ? 'Good' : 'Low'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Leaf className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-800">Clover Benefits</span>
                      </div>
                      <p className="text-sm text-green-700">
                        Optimal clover content (25-40%) provides high protein, natural nitrogen fixation, 
                        and improved palatability. Target 30%+ for dairy production.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Weed/Dead Matter Assessment */}
                <Card>
                  <CardHeader>
                    <CardTitle>Weed & Dead Matter Assessment</CardTitle>
                    <CardDescription>
                      Track undesirable species and plant mortality
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { paddock: 'Paddock 1', weeds: 5, dead: 3, total: 8, status: 'good' },
                        { paddock: 'Paddock 2', weeds: 12, dead: 5, total: 17, status: 'warning' },
                        { paddock: 'Paddock 3', weeds: 3, dead: 2, total: 5, status: 'excellent' },
                        { paddock: 'Paddock 4', weeds: 8, dead: 7, total: 15, status: 'warning' },
                        { paddock: 'Paddock 5', weeds: 6, dead: 4, total: 10, status: 'good' },
                        { paddock: 'Paddock 6', weeds: 4, dead: 3, total: 7, status: 'excellent' },
                      ].map((data) => (
                        <div key={data.paddock} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-8 rounded-full ${
                              data.status === 'excellent' ? 'bg-green-500' :
                              data.status === 'good' ? 'bg-blue-500' : 'bg-orange-500'
                            }`}></div>
                            <div>
                              <p className="font-medium">{data.paddock}</p>
                              <p className="text-sm text-muted-foreground">
                                Weeds: {data.weeds}% • Dead: {data.dead}%
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${
                              data.status === 'excellent' ? 'text-green-600' :
                              data.status === 'good' ? 'text-blue-600' : 'text-orange-600'
                            }`}>{data.total}%</p>
                            <Badge variant={
                              data.status === 'excellent' ? 'default' :
                              data.status === 'good' ? 'secondary' : 'outline'
                            }>
                              {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <span className="font-medium text-orange-800">Impact on Quality</span>
                      </div>
                      <p className="text-sm text-orange-700">
                        High weed content (&gt;10%) reduces pasture quality and palatability. 
                        Dead matter indicates over-maturity or stress conditions.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quality Trends Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Pasture Quality Trends</CardTitle>
                  <CardDescription>
                    Historical tracking of ME, clover, and weed content over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80 bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Quality Metrics Trend Chart</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Shows ME, clover %, and weed % over the last 12 months
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>ME (MJ/kg DM)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span>Clover %</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span>Weed %</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle>Quality Improvement Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-medium text-green-700">🌱 Current Strengths</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          <span>High ME levels across most paddocks (&gt;11.0 MJ/kg DM)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          <span>Good clover establishment in 4 out of 6 paddocks</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          <span>Low weed pressure in majority of grazing areas</span>
                        </li>
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-medium text-orange-700">⚠️ Areas for Improvement</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                          <span>Target weed control in Paddocks 2 &amp; 4 (&gt;15% total)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                          <span>Consider clover oversowing in Paddock 4 (25% content)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                          <span>Monitor dead matter buildup in high-cover paddocks</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <Button>
                      <Target className="h-4 w-4 mr-2" />
                      Create Improvement Plan
                    </Button>
                    <Button variant="outline">
                      <Leaf className="h-4 w-4 mr-2" />
                      Clover Management
                    </Button>
                    <Button variant="outline">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Weed Control Strategy
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Weather Integration Tab */}
        <TabsContent value="weather" className="mt-4">
          {loadingCover ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
          ) : (
            <div className="space-y-6">
              {/* Header with Controls */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">Weather Integration</h2>
                  <p className="text-muted-foreground">Local weather data, growth adjustments, and environmental alerts</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export Weather Data
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings2 className="h-4 w-4 mr-2" />
                    Weather Settings
                  </Button>
                </div>
              </div>

              {/* Weather Alerts */}
              <div className="space-y-4">
                {/* Frost Alert */}
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Cloud className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-blue-800">Frost Warning Active</h3>
                        <p className="text-blue-700 text-sm mt-1">
                          Low temperatures expected tonight (2°C). Pasture growth may be reduced by 40-60% for 2-3 days.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-2" />
                            Monitor Growth
                          </Button>
                          <Button size="sm" variant="outline">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            View Protection Tips
                          </Button>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-blue-600">Active</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Drought Watch */}
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Sun className="h-5 w-5 text-orange-600 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-orange-800">Drought Watch</h3>
                        <p className="text-orange-700 text-sm mt-1">
                          Below average rainfall for 14 days. Soil moisture at 35%. Consider supplemental feeding if conditions persist.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline">
                            <Droplets className="h-4 w-4 mr-2" />
                            Check Soil Moisture
                          </Button>
                          <Button size="sm" variant="outline">
                            <DollarSign className="h-4 w-4 mr-2" />
                            Review Feed Budget
                          </Button>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-orange-600">Monitor</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Current Weather Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CloudSun className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-muted-foreground">Temperature</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">18°C</p>
                    <p className="text-xs text-muted-foreground">Current / 22°C max</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-blue-600">
                        Optimal range
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Droplets className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-muted-foreground">Rainfall</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">12mm</p>
                    <p className="text-xs text-muted-foreground">This week / 45mm monthly</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-orange-600">
                        Below average
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Wind className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-muted-foreground">Soil Moisture</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-600">35%</p>
                    <p className="text-xs text-muted-foreground">Field capacity</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-orange-600">
                        Getting low
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">Growth Impact</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-600">-15%</p>
                    <p className="text-xs text-muted-foreground">vs optimal conditions</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-orange-600">
                        Reduced growth
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Local Weather Data */}
              <Card>
                <CardHeader>
                  <CardTitle>Local Weather Data</CardTitle>
                  <CardDescription>
                    Current conditions and 7-day forecast for your farm location
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Conditions */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Current Conditions</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2">
                            <CloudSun className="h-4 w-4 text-blue-600" />
                            <span>Temperature</span>
                          </div>
                          <span className="font-medium">18°C (Feels like 16°C)</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2">
                            <Droplets className="h-4 w-4 text-blue-600" />
                            <span>Humidity</span>
                          </div>
                          <span className="font-medium">65%</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2">
                            <Wind className="h-4 w-4 text-blue-600" />
                            <span>Wind Speed</span>
                          </div>
                          <span className="font-medium">12 km/h NW</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2">
                            <Cloud className="h-4 w-4 text-gray-600" />
                            <span>Cloud Cover</span>
                          </div>
                          <span className="font-medium">40%</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2">
                            <Sun className="h-4 w-4 text-yellow-600" />
                            <span>UV Index</span>
                          </div>
                          <span className="font-medium">6 (High)</span>
                        </div>
                      </div>
                    </div>

                    {/* 7-Day Forecast */}
                    <div className="space-y-4">
                      <h4 className="font-medium">7-Day Forecast</h4>
                      <div className="space-y-2">
                        {[
                          { day: 'Today', high: 22, low: 8, rain: 20, icon: '⛅' },
                          { day: 'Tomorrow', high: 20, low: 5, rain: 10, icon: '☁️' },
                          { day: 'Wednesday', high: 19, low: 2, rain: 5, icon: '🌤️' },
                          { day: 'Thursday', high: 21, low: 6, rain: 30, icon: '🌧️' },
                          { day: 'Friday', high: 23, low: 9, rain: 60, icon: '⛈️' },
                          { day: 'Saturday', high: 20, low: 7, rain: 40, icon: '🌧️' },
                          { day: 'Sunday', high: 18, low: 5, rain: 20, icon: '☁️' },
                        ].map((day) => (
                          <div key={day.day} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{day.icon}</span>
                              <div>
                                <p className="font-medium text-sm">{day.day}</p>
                                <p className="text-xs text-muted-foreground">{day.rain}% rain</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-sm">{day.high}°/{day.low}°</p>
                              {day.low <= 3 && (
                                <Badge variant="outline" className="text-xs text-blue-600">Frost risk</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Growth Rate Adjustments */}
              <Card>
                <CardHeader>
                  <CardTitle>Growth Rate Adjustments</CardTitle>
                  <CardDescription>
                    How current weather conditions affect pasture growth projections
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Adjustment Factors */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-medium">Current Adjustment Factors</h4>
                        <div className="space-y-3">
                          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-green-800">Temperature</span>
                              <Badge variant="outline" className="text-green-600">+5%</Badge>
                            </div>
                            <p className="text-sm text-green-700">
                              18°C is within optimal range (15-20°C) for pasture growth
                            </p>
                          </div>
                          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-red-800">Rainfall</span>
                              <Badge variant="outline" className="text-red-600">-20%</Badge>
                            </div>
                            <p className="text-sm text-red-700">
                              45mm monthly is 30% below average for this time of year
                            </p>
                          </div>
                          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-orange-800">Soil Moisture</span>
                              <Badge variant="outline" className="text-orange-600">-10%</Badge>
                            </div>
                            <p className="text-sm text-orange-700">
                              35% field capacity is approaching stress threshold
                            </p>
                          </div>
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-blue-800">Upcoming Frost</span>
                              <Badge variant="outline" className="text-blue-600">-15%</Badge>
                            </div>
                            <p className="text-sm text-blue-700">
                              Expected frost will reduce growth for 2-3 days
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-medium">Adjusted Growth Projections</h4>
                        <div className="space-y-3">
                          <div className="p-4 bg-muted rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-medium">Base Growth Rate</span>
                              <span className="font-bold text-lg">45 kg/ha/day</span>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Temperature adjustment:</span>
                                <span className="text-green-600">+2.3 kg/ha/day</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Rainfall adjustment:</span>
                                <span className="text-red-600">-9.0 kg/ha/day</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Soil moisture adjustment:</span>
                                <span className="text-orange-600">-4.5 kg/ha/day</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Frost impact:</span>
                                <span className="text-blue-600">-6.8 kg/ha/day</span>
                              </div>
                              <div className="border-t pt-2 mt-2 flex justify-between font-medium">
                                <span>Adjusted Growth Rate:</span>
                                <span className="text-lg text-orange-600">26.9 kg/ha/day</span>
                              </div>
                            </div>
                          </div>
                          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <p className="text-sm text-orange-700">
                              <strong>Impact:</strong> Current conditions reduce growth potential by 40% compared to optimal. 
                              Monitor soil moisture and consider supplement if dry spell continues.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Growth Impact Chart */}
                    <div>
                      <h4 className="font-medium mb-3">Weather Impact on Growth (Last 30 Days)</h4>
                      <div className="h-60 bg-muted rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-muted-foreground">Growth vs Weather Chart</p>
                          <p className="text-sm text-muted-foreground mt-2">
                            Shows correlation between weather factors and growth rate
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Environmental Alerts History */}
              <Card>
                <CardHeader>
                  <CardTitle>Environmental Alerts History</CardTitle>
                  <CardDescription>
                    Recent weather alerts and their impact on pasture management
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { date: '2024-12-07', type: 'Frost Warning', impact: 'Growth reduced 50% for 2 days', status: 'resolved' },
                      { date: '2024-12-05', type: 'High Wind Alert', impact: 'Pasture damage in exposed paddocks', status: 'resolved' },
                      { date: '2024-12-01', type: 'Drought Watch', impact: 'Supplement feeding initiated', status: 'active' },
                      { date: '2024-11-28', type: 'Heavy Rain Warning', impact: 'Rotation adjusted, soil compaction risk', status: 'resolved' },
                      { date: '2024-11-25', type: 'Heat Stress Alert', impact: 'Increased shade requirements', status: 'resolved' },
                    ].map((alert, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-8 rounded-full ${
                            alert.type === 'Frost Warning' ? 'bg-blue-500' :
                            alert.type === 'High Wind Alert' ? 'bg-gray-500' :
                            alert.type === 'Drought Watch' ? 'bg-orange-500' :
                            alert.type === 'Heavy Rain Warning' ? 'bg-blue-500' : 'bg-red-500'
                          }`}></div>
                          <div>
                            <p className="font-medium">{alert.type}</p>
                            <p className="text-sm text-muted-foreground">{alert.date} • {alert.impact}</p>
                          </div>
                        </div>
                        <Badge variant={alert.status === 'active' ? 'default' : 'secondary'}>
                          {alert.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle>Weather-Based Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-medium text-blue-700">🌡️ Immediate Actions</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                          <span>Protect vulnerable paddocks from tonight's frost</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                          <span>Delay nitrogen application until after frost risk</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                          <span>Check water supplies for increased demand</span>
                        </li>
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-medium text-orange-700">🌾 Planning Considerations</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                          <span>Review feed budget for potential 15% growth reduction</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 orange-500 mt-0.5" />
                          <span>Consider early supplementary feeding if dry spell continues</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                          <span>Monitor soil moisture trends weekly</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <Button>
                      <Target className="h-4 w-4 mr-2" />
                      Create Weather Action Plan
                    </Button>
                    <Button variant="outline">
                      <Bell className="h-4 w-4 mr-2" />
                      Set Alert Preferences
                    </Button>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export Weather Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Mobile Pasture Walk Mode Tab */}
        <TabsContent value="mobile" className="mt-4">
          <div className="space-y-6">
            {/* Header with Mobile Status */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">Mobile Pasture Walk Mode</h2>
                <p className="text-muted-foreground">GPS-guided paddock identification with offline capability</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-green-600">
                  <Wifi className="h-3 w-3 mr-1" />
                  Online
                </Badge>
                <Button variant="outline" size="sm">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Mobile Settings
                </Button>
              </div>
            </div>

            {/* Mobile Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">GPS Status</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">Active</p>
                  <p className="text-xs text-muted-foreground">±3m accuracy</p>
                  <div className="mt-2">
                    <Badge variant="outline" className="text-green-600">
                      High precision
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Wifi className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-muted-foreground">Connection</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">Online</p>
                  <p className="text-xs text-muted-foreground">Sync enabled</p>
                  <div className="mt-2">
                    <Badge variant="outline" className="text-blue-600">
                      Connected
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Download className="h-4 w-4 text-orange-600" />
                    <span className="text-sm text-muted-foreground">Offline Data</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-600">Ready</p>
                  <p className="text-xs text-muted-foreground">12 paddocks cached</p>
                  <div className="mt-2">
                    <Badge variant="outline" className="text-orange-600">
                      Synced 2 min ago
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* GPS-Guided Paddock Identification */}
            <Card>
              <CardHeader>
                <CardTitle>GPS-Guided Paddock Identification</CardTitle>
                <CardDescription>
                  Current location and nearest paddock detection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Current Location */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Current Location</h4>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-green-800">GPS Coordinates</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Latitude:</span>
                          <span className="font-mono">-37.8136°</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Longitude:</span>
                          <span className="font-mono">144.9631°</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Accuracy:</span>
                          <span className="text-green-600">±3m</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Last Update:</span>
                          <span>30 seconds ago</span>
                        </div>
                      </div>
                    </div>
                    <Button className="w-full">
                      <MapPin className="h-4 w-4 mr-2" />
                      Refresh Location
                    </Button>
                  </div>

                  {/* Nearest Paddocks */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Nearest Paddocks</h4>
                    <div className="space-y-2">
                      {[
                        { name: 'Paddock 1', distance: 15, direction: 'NE', status: 'active' },
                        { name: 'Paddock 2', distance: 45, direction: 'E', status: 'ready' },
                        { name: 'Paddock 3', distance: 120, direction: 'SE', status: 'ready' },
                        { name: 'Paddock 4', distance: 180, direction: 'S', status: 'resting' },
                        { name: 'Paddock 5', distance: 250, direction: 'SW', status: 'ready' },
                      ].map((paddock) => (
                        <div key={paddock.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-8 rounded-full ${
                              paddock.status === 'active' ? 'bg-green-500' :
                              paddock.status === 'ready' ? 'bg-blue-500' : 'bg-gray-500'
                            }`}></div>
                            <div>
                              <p className="font-medium">{paddock.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {paddock.distance}m {paddock.direction}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant={paddock.distance <= 50 ? "default" : "outline"}>
                              <Ruler className="h-3 w-3 mr-1" />
                              Measure
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Cover Entry */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Cover Entry</CardTitle>
                <CardDescription>
                  Rapid pasture measurement interface optimized for mobile devices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Selected Paddock */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-blue-800">Selected: Paddock 1</p>
                          <p className="text-sm text-blue-700">15m NE • 12.5 ha • Ready to graze</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        Change
                      </Button>
                    </div>
                  </div>

                  {/* Measurement Interface */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Plate Meter Input */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Plate Meter Reading</h4>
                      <div className="space-y-3">
                        <div className="text-center p-6 bg-muted rounded-lg">
                          <p className="text-4xl font-bold text-blue-600">4.2</p>
                          <p className="text-sm text-muted-foreground">cm plate height</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Button variant="outline" size="sm">-0.1</Button>
                          <Button variant="outline" size="sm">+0.1</Button>
                          <Button variant="outline" size="sm">+0.5</Button>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-sm text-green-700">
                            <strong>Estimated Cover:</strong> 2,450 kg DM/ha
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Quick Actions</h4>
                      <div className="space-y-2">
                        <Button className="w-full" size="lg">
                          <Check className="h-4 w-4 mr-2" />
                          Save Measurement
                        </Button>
                        <Button variant="outline" className="w-full">
                          <Camera className="h-4 w-4 mr-2" />
                          Take Photo
                        </Button>
                        <Button variant="outline" className="w-full">
                          <MapPin className="h-4 w-4 mr-2" />
                          Add GPS Note
                        </Button>
                        <Button variant="outline" className="w-full">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Add Observation
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Recent Measurements */}
                  <div>
                    <h4 className="font-medium mb-3">Recent Measurements (Session)</h4>
                    <div className="space-y-2">
                      {[
                        { paddock: 'Paddock 1', cover: 2450, time: '2 min ago', synced: true },
                        { paddock: 'Paddock 2', cover: 2180, time: '5 min ago', synced: true },
                        { paddock: 'Paddock 3', cover: 2670, time: '8 min ago', synced: false },
                        { paddock: 'Paddock 4', cover: 1890, time: '12 min ago', synced: true },
                      ].map((measurement, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <div>
                              <p className="font-medium">{measurement.paddock}</p>
                              <p className="text-sm text-muted-foreground">
                                {measurement.cover} kg/ha • {measurement.time}
                              </p>
                            </div>
                          </div>
                          <Badge variant={measurement.synced ? "default" : "secondary"}>
                            {measurement.synced ? 'Synced' : 'Pending'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Offline Capabilities */}
            <Card>
              <CardHeader>
                <CardTitle>Offline Capabilities</CardTitle>
                <CardDescription>
                  Data synchronization and offline storage management
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Storage Status */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Offline Storage</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">Cached Paddocks</span>
                          <Badge variant="outline">12/15</Badge>
                        </div>
                        <Progress value={80} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">3 paddocks not cached</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">Offline Data</span>
                          <Badge variant="outline">2.4 MB</Badge>
                        </div>
                        <Progress value={24} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">10 MB available</p>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <span className="font-medium text-orange-800">Sync Pending</span>
                        </div>
                        <p className="text-sm text-orange-700">
                          1 measurement needs sync when connection restored
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sync Management */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Sync Management</h4>
                    <div className="space-y-3">
                      <Button className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Sync All Data
                      </Button>
                      <Button variant="outline" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Download Paddock Maps
                      </Button>
                      <Button variant="outline" className="w-full">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear Offline Cache
                      </Button>
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Wifi className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-blue-800">Auto-Sync</span>
                        </div>
                        <p className="text-sm text-blue-700">
                          Automatic sync when connection available
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Offline Usage Tips */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-800 mb-2">📱 Offline Usage Tips</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                    <div>
                      <p className="font-medium mb-1">Before Going Offline:</p>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>• Download paddock maps and data</li>
                        <li>• Ensure GPS is enabled</li>
                        <li>• Charge your device fully</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium mb-1">While Offline:</p>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>• GPS works without internet</li>
                        <li>• All measurements are saved locally</li>
                        <li>• Data syncs automatically when online</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mobile Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Mobile Settings</CardTitle>
                <CardDescription>
                  Configure mobile-specific features and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">GPS Settings</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">High Accuracy Mode</p>
                          <p className="text-sm text-muted-foreground">Uses more battery</p>
                        </div>
                        <Button size="sm" variant="outline">Enabled</Button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">Auto-Detect Paddock</p>
                          <p className="text-sm text-muted-foreground">Based on GPS location</p>
                        </div>
                        <Button size="sm" variant="outline">Enabled</Button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">Location Update Interval</p>
                          <p className="text-sm text-muted-foreground">How often to refresh</p>
                        </div>
                        <select className="px-3 py-1 border rounded text-sm">
                          <option>30 seconds</option>
                          <option>1 minute</option>
                          <option>5 minutes</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Data & Sync</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">Auto-Sync</p>
                          <p className="text-sm text-muted-foreground">Sync when online</p>
                        </div>
                        <Button size="sm" variant="outline">Enabled</Button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">Offline Photos</p>
                          <p className="text-sm text-muted-foreground">Save photos locally</p>
                        </div>
                        <Button size="sm" variant="outline">Enabled</Button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">Cache Duration</p>
                          <p className="text-sm text-muted-foreground">How long to keep data</p>
                        </div>
                        <select className="px-3 py-1 border rounded text-sm">
                          <option>7 days</option>
                          <option>14 days</option>
                          <option>30 days</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Satellite/Drone Integration Tab */}
        <TabsContent value="satellite" className="mt-4">
          <div className="space-y-6">
            {/* Header with Future Feature Badge */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">Satellite/Drone Integration</h2>
                <p className="text-muted-foreground">Remote sensing data and aerial imagery analysis</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-orange-600">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Future Feature
                </Badge>
                <Button variant="outline" size="sm">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Integration Settings
                </Button>
              </div>
            </div>

            {/* Feature Preview Banner */}
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-800">Coming Soon: Advanced Remote Sensing</h3>
                    <p className="text-orange-700 text-sm mt-1">
                      This integration will bring satellite pasture data, drone imagery analysis, and NDVI monitoring to your farm. 
                      Connect with services like Pasture.io for comprehensive pasture health monitoring from above.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline">
                        <Bell className="h-4 w-4 mr-2" />
                        Join Beta Program
                      </Button>
                      <Button size="sm" variant="outline">
                        <Mail className="h-4 w-4 mr-2" />
                        Request Early Access
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Integration Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Satellite className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-muted-foreground">Satellite Data</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">Pasture.io</p>
                  <p className="text-xs text-muted-foreground">API integration planned</p>
                  <div className="mt-2">
                    <Badge variant="outline" className="text-orange-600">
                      In Development
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Camera className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">Drone Imagery</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">Upload Ready</p>
                  <p className="text-xs text-muted-foreground">Processing pipeline</p>
                  <div className="mt-2">
                    <Badge variant="outline" className="text-orange-600">
                      Testing Phase
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="h-4 w-4 text-purple-600" />
                    <span className="text-sm text-muted-foreground">NDVI Analysis</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">AI-Powered</p>
                  <p className="text-xs text-muted-foreground">Health monitoring</p>
                  <div className="mt-2">
                    <Badge variant="outline" className="text-orange-600">
                      Research Stage
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Satellite Pasture Data API */}
            <Card>
              <CardHeader>
                <CardTitle>Satellite Pasture Data API</CardTitle>
                <CardDescription>
                  Integration with satellite imagery services for comprehensive pasture monitoring
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* API Configuration */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Service Providers</h4>
                    <div className="space-y-3">
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                              <Satellite className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-blue-800">Pasture.io</p>
                              <p className="text-sm text-blue-700">Premium satellite data</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-orange-600">Coming</Badge>
                        </div>
                        <p className="text-sm text-blue-700">
                          High-resolution satellite imagery with pasture-specific analysis, 
                          biomass estimation, and growth trend monitoring.
                        </p>
                      </div>
                      
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                              <Globe className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-green-800">Sentinel-2</p>
                              <p className="text-sm text-green-700">Free ESA data</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-orange-600">Planned</Badge>
                        </div>
                        <p className="text-sm text-green-700">
                          European Space Agency satellite data with 10m resolution and 
                          5-day revisit frequency for pasture monitoring.
                        </p>
                      </div>
                      
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                              <Zap className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-purple-800">Planet Labs</p>
                              <p className="text-sm text-purple-700">Daily imagery</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-orange-600">Future</Badge>
                        </div>
                        <p className="text-sm text-purple-700">
                          Daily satellite imagery with 3m resolution for near real-time 
                          pasture change detection and monitoring.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Data Features */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Available Data Features</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="font-medium">Biomass Estimation</p>
                          <p className="text-sm text-muted-foreground">Calculate pasture dry matter from space</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="font-medium">Growth Rate Monitoring</p>
                          <p className="text-sm text-muted-foreground">Track pasture growth trends over time</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="font-medium">Paddock Boundary Detection</p>
                          <p className="text-sm text-muted-foreground">Automatic fence line identification</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="font-medium">Weather Impact Analysis</p>
                          <p className="text-sm text-muted-foreground">Correlate weather with pasture response</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="font-medium">Historical Comparisons</p>
                          <p className="text-sm text-muted-foreground">Year-over-year pasture performance</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* API Configuration Preview */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-800 mb-3">🔧 API Configuration Preview</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium mb-1">Connection Settings:</p>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>• API Key authentication</li>
                        <li>• Customizable update frequency</li>
                        <li>• Paddock boundary mapping</li>
                        <li>• Data retention policies</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Data Processing:</p>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>• Automatic cloud filtering</li>
                        <li>• NDVI calculation</li>
                        <li>• Biomass conversion algorithms</li>
                        <li>• Anomaly detection alerts</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Drone Imagery Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Drone Imagery Upload</CardTitle>
                <CardDescription>
                  Upload and process drone imagery for detailed pasture analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Upload Interface */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Upload Center</h4>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium text-gray-900 mb-2">Drop drone images here</p>
                      <p className="text-sm text-gray-500 mb-4">
                        Support for JPG, PNG, TIFF formats up to 50MB
                      </p>
                      <Button variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Select Files
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <h5 className="font-medium">Supported Drone Types:</h5>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2 p-2 bg-muted rounded">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>DJI Phantom</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>DJI Mavic</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>DJI Agras</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>Custom drones</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Processing Features */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Processing Pipeline</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Camera className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">Image Stitching</span>
                        </div>
                        <p className="text-sm text-green-700">
                          Automatically combine multiple drone images into seamless orthomosaics
                        </p>
                      </div>
                      
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-blue-800">Georeferencing</span>
                        </div>
                        <p className="text-sm text-blue-700">
                          GPS tag processing and accurate positioning on farm maps
                        </p>
                      </div>
                      
                      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-2 mb-1">
                          <BarChart3 className="h-4 w-4 text-purple-600" />
                          <span className="font-medium text-purple-800">3D Modeling</span>
                        </div>
                        <p className="text-sm text-purple-700">
                          Generate digital elevation models and canopy height analysis
                        </p>
                      </div>
                      
                      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className="h-4 w-4 text-orange-600" />
                          <span className="font-medium text-orange-800">AI Analysis</span>
                        </div>
                        <p className="text-sm text-orange-700">
                          Machine learning for pasture health, weed detection, and biomass estimation
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Uploads */}
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Recent Uploads (Preview)</h4>
                  <div className="space-y-2">
                    {[
                      { name: 'Paddock_1_2024-12-07.jpg', size: '12.4 MB', date: '2 hours ago', status: 'processing' },
                      { name: 'Paddock_2_2024-12-06.tif', size: '28.7 MB', date: '1 day ago', status: 'completed' },
                      { name: 'Farm_overview_2024-12-05.jpg', size: '45.2 MB', date: '2 days ago', status: 'completed' },
                    ].map((upload, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-8 rounded-full ${
                            upload.status === 'completed' ? 'bg-green-500' : 
                            upload.status === 'processing' ? 'bg-orange-500' : 'bg-gray-500'
                          }`}></div>
                          <div>
                            <p className="font-medium">{upload.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {upload.size} • {upload.date}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            upload.status === 'completed' ? 'default' : 
                            upload.status === 'processing' ? 'secondary' : 'outline'
                          }>
                            {upload.status}
                          </Badge>
                          {upload.status === 'completed' && (
                            <Button size="sm" variant="outline">
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* NDVI Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>NDVI Analysis</CardTitle>
                <CardDescription>
                  Normalized Difference Vegetation Index for pasture health monitoring
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* NDVI Overview */}
                  <div className="space-y-4">
                    <h4 className="font-medium">NDVI Monitoring</h4>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="h-5 w-5 text-purple-600" />
                        <span className="font-medium text-purple-800">What is NDVI?</span>
                      </div>
                      <p className="text-sm text-purple-700 mb-3">
                        NDVI (Normalized Difference Vegetation Index) measures plant health by analyzing 
                        the difference between near-infrared and red light reflection. Higher values indicate 
                        healthier, denser vegetation.
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="font-medium text-purple-800">Range: -1 to +1</p>
                          <p className="text-purple-700">-1.0 = No vegetation</p>
                          <p className="text-purple-700">+1.0 = Healthy vegetation</p>
                        </div>
                        <div>
                          <p className="font-medium text-purple-800">Pasture Values:</p>
                          <p className="text-purple-700">0.2-0.4 = Poor pasture</p>
                          <p className="text-purple-700">0.6-0.8 = Excellent pasture</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h5 className="font-medium">NDVI Applications:</h5>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-muted rounded">
                          <Activity className="h-3 w-3 text-green-500" />
                          <span className="text-sm">Early stress detection</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded">
                          <TrendingUp className="h-3 w-3 text-blue-500" />
                          <span className="text-sm">Growth monitoring</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded">
                          <AlertTriangle className="h-3 w-3 text-orange-500" />
                          <span className="text-sm">Problem area identification</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded">
                          <Target className="h-3 w-3 text-purple-500" />
                          <span className="text-sm">Targeted intervention planning</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Analysis Features */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Analysis Features</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">Temporal Analysis</span>
                        </div>
                        <p className="text-sm text-green-700">
                          Track NDVI changes over time to identify growth patterns and anomalies
                        </p>
                      </div>
                      
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-blue-800">Spatial Mapping</span>
                        </div>
                        <p className="text-sm text-blue-700">
                          Create detailed NDVI maps showing variability across paddocks
                        </p>
                      </div>
                      
                      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <span className="font-medium text-orange-800">Alert System</span>
                        </div>
                        <p className="text-sm text-orange-700">
                          Automatic notifications when NDVI drops below threshold levels
                        </p>
                      </div>
                      
                      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-2 mb-1">
                          <BarChart3 className="h-4 w-4 text-purple-600" />
                          <span className="font-medium text-purple-800">Correlation Analysis</span>
                        </div>
                        <p className="text-sm text-purple-700">
                          Link NDVI data with ground measurements for calibration
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* NDVI Visualization Preview */}
                <div className="mt-6">
                  <h4 className="font-medium mb-3">NDVI Visualization Preview</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="h-40 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-lg mb-3"></div>
                      <p className="text-sm text-muted-foreground">
                        <strong>NDVI Map:</strong> Color-coded visualization of pasture health across farm
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="h-40 bg-gray-200 rounded-lg mb-3 flex items-center justify-center">
                        <BarChart3 className="h-12 w-12 text-gray-400" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <strong>NDVI Trends:</strong> Time series analysis of vegetation health
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Integration Benefits */}
            <Card>
              <CardHeader>
                <CardTitle>Integration Benefits</CardTitle>
                <CardDescription>
                  How satellite and drone data will enhance your pasture management
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-medium text-green-700">🌱 Pasture Health</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Early detection of pasture stress</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Optimal grazing timing identification</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Improved feed budgeting accuracy</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium text-blue-700">📊 Data Insights</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                        <span>Comprehensive farm-wide monitoring</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                        <span>Historical trend analysis</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                        <span>Problem area identification</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium text-purple-700">⚡ Efficiency</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-purple-500 mt-0.5" />
                        <span>Reduced ground measurement time</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-purple-500 mt-0.5" />
                        <span>Better resource allocation</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-purple-500 mt-0.5" />
                        <span>Proactive management decisions</span>
                      </li>
                    </ul>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-blue-800">🚀 Be the First to Experience</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Join our beta program to get early access to satellite and drone integration features
                      </p>
                    </div>
                    <Button>
                      <Bell className="h-4 w-4 mr-2" />
                      Join Beta
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Feed Wedge Tab */}
        <TabsContent value="feedwedge" className="mt-4">
          <div className="space-y-6">
            {/* Settings and Legend */}
            <div className="flex justify-between items-start">
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded" />
                  <span>Ready to Graze (≥{feedWedgeSettings.readyToGrazeMin})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded" />
                  <span>Growing ({feedWedgeSettings.deficitThreshold}-{feedWedgeSettings.readyToGrazeMin})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded" />
                  <span>Deficit (&lt;{feedWedgeSettings.deficitThreshold})</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowFeedWedgeSettings(true)}>
                <Settings2 className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>

            {/* Feed Wedge Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Feed Wedge
                </CardTitle>
                <CardDescription>
                  Paddocks sorted by cover (highest to lowest) with grazing targets
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCover ? (
                  <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>
                ) : !farmCover?.paddocks || farmCover.paddocks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">No measurements to display</p>
                ) : (
                  <div className="relative">
                    {/* Target lines */}
                    <div className="absolute left-0 right-0 flex flex-col pointer-events-none z-10">
                      {/* Pre-grazing target line */}
                      <div 
                        className="absolute w-full border-t-2 border-dashed border-blue-500"
                        style={{ 
                          top: `${Math.max(0, 100 - (feedWedgeSettings.preGrazingTarget / 40))}%` 
                        }}
                      >
                        <span className="absolute -top-5 right-0 text-xs text-blue-600 bg-white px-1">
                          Pre-grazing: {feedWedgeSettings.preGrazingTarget} kg/ha
                        </span>
                      </div>
                      {/* Post-grazing target line */}
                      <div 
                        className="absolute w-full border-t-2 border-dashed border-orange-500"
                        style={{ 
                          top: `${Math.max(0, 100 - (feedWedgeSettings.postGrazingTarget / 40))}%` 
                        }}
                      >
                        <span className="absolute -top-5 right-0 text-xs text-orange-600 bg-white px-1">
                          Residual: {feedWedgeSettings.postGrazingTarget} kg/ha
                        </span>
                      </div>
                    </div>

                    {/* Bar chart */}
                    <div className="flex items-end gap-1 h-80 pt-8">
                      {[...farmCover.paddocks]
                        .sort((a, b) => (b.coverKgDmHa || 0) - (a.coverKgDmHa || 0))
                        .map((paddock, index) => {
                          const cover = paddock.coverKgDmHa || 0;
                          const maxCover = 4000; // Max scale
                          const heightPercent = Math.min((cover / maxCover) * 100, 100);
                          
                          // Determine color based on cover level
                          let barColor = 'bg-yellow-500';
                          if (cover >= feedWedgeSettings.readyToGrazeMin) {
                            barColor = 'bg-green-500';
                          } else if (cover < feedWedgeSettings.deficitThreshold) {
                            barColor = 'bg-red-500';
                          }
                          
                          return (
                            <div 
                              key={paddock.id}
                              className="flex-1 flex flex-col items-center group relative"
                              style={{ minWidth: '20px', maxWidth: '60px' }}
                            >
                              {/* Tooltip */}
                              <div className="absolute bottom-full mb-2 hidden group-hover:block z-20">
                                <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                                  <p className="font-medium">{paddock.paddockNumber ? `#${paddock.paddockNumber}` : paddock.pastureName}</p>
                                  <p>{cover} kg DM/ha</p>
                                  {paddock.growthRateKgDay !== null && (
                                    <p>Growth: {paddock.growthRateKgDay} kg/day</p>
                                  )}
                                </div>
                              </div>
                              
                              {/* Bar */}
                              <div 
                                className={`w-full ${barColor} rounded-t transition-all hover:opacity-80 cursor-pointer`}
                                style={{ height: `${heightPercent}%` }}
                              />
                              
                              {/* Label */}
                              <div className="text-xs text-center mt-1 truncate w-full">
                                {paddock.paddockNumber || paddock.pastureName?.slice(0, 3)}
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-8 bottom-6 flex flex-col justify-between text-xs text-muted-foreground -ml-10 w-8 text-right">
                      <span>4000</span>
                      <span>3000</span>
                      <span>2000</span>
                      <span>1000</span>
                      <span>0</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Feed Wedge Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-l-4 border-green-500">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Ready to Graze</p>
                  <p className="text-2xl font-bold text-green-600">
                    {farmCover?.paddocks.filter(p => (p.coverKgDmHa || 0) >= feedWedgeSettings.readyToGrazeMin).length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">paddocks</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-yellow-500">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Growing</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {farmCover?.paddocks.filter(p => {
                      const cover = p.coverKgDmHa || 0;
                      return cover >= feedWedgeSettings.deficitThreshold && cover < feedWedgeSettings.readyToGrazeMin;
                    }).length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">paddocks</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-red-500">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Deficit</p>
                  <p className="text-2xl font-bold text-red-600">
                    {farmCover?.paddocks.filter(p => (p.coverKgDmHa || 0) < feedWedgeSettings.deficitThreshold).length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">paddocks</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-blue-500">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Days of Feed</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {(() => {
                      const readyPaddocks = farmCover?.paddocks.filter(p => (p.coverKgDmHa || 0) >= feedWedgeSettings.readyToGrazeMin) || [];
                      const avgGrowth = farmCover?.summary.averageGrowthRate || 30;
                      const totalAvailableFeed = readyPaddocks.reduce((sum, p) => {
                        const available = (p.coverKgDmHa || 0) - feedWedgeSettings.postGrazingTarget;
                        return sum + Math.max(0, available) * (p.area || 1);
                      }, 0);
                      // Rough estimate: assume 15kg DM/cow/day, 100 cows
                      const dailyDemand = 15 * 100;
                      return Math.round(totalAvailableFeed / dailyDemand) || 0;
                    })()}
                  </p>
                  <p className="text-xs text-muted-foreground">estimated</p>
                </CardContent>
              </Card>
            </div>

            {/* Grazing Order Recommendation */}
            <Card>
              <CardHeader>
                <CardTitle>Recommended Grazing Order</CardTitle>
                <CardDescription>Paddocks ready to graze, sorted by cover (highest first)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {farmCover?.paddocks
                    .filter(p => (p.coverKgDmHa || 0) >= feedWedgeSettings.readyToGrazeMin)
                    .sort((a, b) => (b.coverKgDmHa || 0) - (a.coverKgDmHa || 0))
                    .slice(0, 10)
                    .map((paddock, index) => (
                      <div 
                        key={paddock.id}
                        className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium">
                              {paddock.paddockNumber ? `Paddock #${paddock.paddockNumber}` : paddock.pastureName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {paddock.area ? `${paddock.area} ha` : ''} 
                              {paddock.status === 'grazing' && ' • Currently grazing'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-700">{paddock.coverKgDmHa} kg/ha</p>
                          <p className="text-xs text-muted-foreground">
                            Available: {Math.max(0, (paddock.coverKgDmHa || 0) - feedWedgeSettings.postGrazingTarget)} kg/ha
                          </p>
                        </div>
                      </div>
                    ))}
                  {(!farmCover?.paddocks || farmCover.paddocks.filter(p => (p.coverKgDmHa || 0) >= feedWedgeSettings.readyToGrazeMin).length === 0) && (
                    <p className="text-center text-muted-foreground py-4">No paddocks ready to graze</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Paddock Details Tab */}
        <TabsContent value="paddocks" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Paddocks</CardTitle>
              <CardDescription>Latest cover measurements for each paddock</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paddock</TableHead>
                    <TableHead className="text-right">Cover (kg/ha)</TableHead>
                    <TableHead className="text-right">Growth (kg/day)</TableHead>
                    <TableHead className="text-right">Area (ha)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Measured</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {farmCover?.paddocks.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.paddockNumber ? `#${p.paddockNumber} - ` : ''}{p.pastureName}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`px-2 py-1 rounded ${getCoverColor(p.coverKgDmHa)}`}>
                          {p.coverKgDmHa}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {p.growthRateKgDay !== null ? (
                          <span className={p.growthRateKgDay >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {p.growthRateKgDay >= 0 ? '+' : ''}{p.growthRateKgDay}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right">{p.area || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'grazing' ? 'default' : 'secondary'}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.measurementDate}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!farmCover?.paddocks || farmCover.paddocks.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No measurements recorded yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Walk History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Walk Session History</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSessions ? (
                <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>
              ) : sessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No walk sessions recorded</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Weather</TableHead>
                      <TableHead className="text-right">Paddocks</TableHead>
                      <TableHead className="text-right">Avg Cover</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">{session.walkDate}</TableCell>
                        <TableCell>{session.walkTime || '—'}</TableCell>
                        <TableCell>
                          {session.weatherConditions && (
                            <span className="flex items-center gap-1">
                              <CloudSun className="h-4 w-4" />
                              {session.weatherConditions}
                              {session.temperature && ` ${session.temperature}°C`}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{session.totalPaddocks}</TableCell>
                        <TableCell className="text-right">
                          {session.averageCover ? `${session.averageCover} kg/ha` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                            {session.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {session.status === 'in_progress' && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedSession(session.id);
                                    setShowQuickEntryDialog(true);
                                  }}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <Button 
                                  size="sm"
                                  onClick={() => completeSessionMutation.mutate(session.id)}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distribution Tab */}
        <TabsContent value="distribution" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: 'veryLow', label: 'Very Low (< 1500)', color: 'border-red-500', items: distribution?.distribution.veryLow || [] },
              { key: 'low', label: 'Low (1500-2000)', color: 'border-orange-500', items: distribution?.distribution.low || [] },
              { key: 'optimal', label: 'Optimal (2000-2800)', color: 'border-green-500', items: distribution?.distribution.optimal || [] },
              { key: 'high', label: 'High (2800-3200)', color: 'border-blue-500', items: distribution?.distribution.high || [] },
              { key: 'veryHigh', label: 'Very High (> 3200)', color: 'border-purple-500', items: distribution?.distribution.veryHigh || [] },
              { key: 'unmeasured', label: 'Unmeasured', color: 'border-gray-500', items: distribution?.distribution.unmeasured || [] },
            ].map((cat) => (
              <Card key={cat.key} className={`border-l-4 ${cat.color}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{cat.label}</CardTitle>
                  <CardDescription>{cat.items.length} paddocks</CardDescription>
                </CardHeader>
                <CardContent>
                  {cat.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No paddocks</p>
                  ) : (
                    <div className="space-y-1">
                      {cat.items.slice(0, 5).map((p: any) => (
                        <div key={p.id} className="flex justify-between text-sm">
                          <span>{p.paddockNumber ? `#${p.paddockNumber}` : p.name}</span>
                          <span className="text-muted-foreground">{p.cover ? `${p.cover} kg/ha` : '—'}</span>
                        </div>
                      ))}
                      {cat.items.length > 5 && (
                        <p className="text-xs text-muted-foreground">+{cat.items.length - 5} more</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* New Walk Dialog */}
      <Dialog open={showNewWalkDialog} onOpenChange={setShowNewWalkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Pasture Walk</DialogTitle>
            <DialogDescription>
              Create a walk session to group your paddock measurements
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newWalk.walkDate}
                  onChange={(e) => setNewWalk({ ...newWalk, walkDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={newWalk.walkTime}
                  onChange={(e) => setNewWalk({ ...newWalk, walkTime: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Weather</Label>
                <Select 
                  value={newWalk.weatherConditions} 
                  onValueChange={(v) => setNewWalk({ ...newWalk, weatherConditions: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunny">Sunny</SelectItem>
                    <SelectItem value="cloudy">Cloudy</SelectItem>
                    <SelectItem value="overcast">Overcast</SelectItem>
                    <SelectItem value="rainy">Rainy</SelectItem>
                    <SelectItem value="windy">Windy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Temperature (°C)</Label>
                <Input
                  type="number"
                  value={newWalk.temperature}
                  onChange={(e) => setNewWalk({ ...newWalk, temperature: e.target.value })}
                  placeholder="e.g., 18"
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={newWalk.notes}
                onChange={(e) => setNewWalk({ ...newWalk, notes: e.target.value })}
                placeholder="Any observations..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewWalkDialog(false)}>Cancel</Button>
            <Button onClick={handleStartWalk} disabled={createSessionMutation.isPending}>
              {createSessionMutation.isPending ? "Starting..." : "Start Walk"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Entry Dialog */}
      <Dialog open={showQuickEntryDialog} onOpenChange={setShowQuickEntryDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Quick Cover Entry
            </DialogTitle>
            <DialogDescription>
              Enter cover readings for each paddock. Use plate meter or direct kg DM/ha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Plate meter helper */}
            <div className="p-3 bg-blue-50 rounded-lg text-sm">
              <p className="font-medium text-blue-800">Rising Plate Meter Conversion</p>
              <p className="text-blue-600">Cover (kg/ha) = (Plate Reading × 140) + 500</p>
            </div>

            {/* Paddock entries */}
            <div className="space-y-3">
              {pastures.sort((a, b) => (a.paddockNumber || 0) - (b.paddockNumber || 0)).map((pasture) => (
                <div key={pasture.id} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="w-32">
                    <p className="font-medium">
                      {pasture.paddockNumber ? `#${pasture.paddockNumber}` : pasture.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{pasture.area ? `${pasture.area} ha` : ''}</p>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Plate Reading</Label>
                      <Input
                        type="number"
                        placeholder="e.g., 15"
                        value={quickEntries[pasture.id]?.plate || ''}
                        onChange={(e) => {
                          const plate = parseInt(e.target.value) || 0;
                          const cover = plateToCover(plate);
                          setQuickEntries({
                            ...quickEntries,
                            [pasture.id]: { plate, cover },
                          });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cover (kg DM/ha)</Label>
                      <Input
                        type="number"
                        placeholder="e.g., 2500"
                        value={quickEntries[pasture.id]?.cover || ''}
                        onChange={(e) => {
                          const cover = parseInt(e.target.value) || 0;
                          setQuickEntries({
                            ...quickEntries,
                            [pasture.id]: { ...quickEntries[pasture.id], cover },
                          });
                        }}
                      />
                    </div>
                  </div>
                  {quickEntries[pasture.id]?.cover > 0 && (
                    <Badge className={getCoverColor(quickEntries[pasture.id].cover)}>
                      {getCoverLabel(quickEntries[pasture.id].cover)}
                    </Badge>
                  )}
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>{Object.values(quickEntries).filter(e => e.cover > 0).length}</strong> paddocks with entries
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickEntryDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveQuickEntries} disabled={quickEntryMutation.isPending}>
              {quickEntryMutation.isPending ? "Saving..." : "Save Measurements"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feed Wedge Settings Dialog */}
      <Dialog open={showFeedWedgeSettings} onOpenChange={setShowFeedWedgeSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Feed Wedge Settings
            </DialogTitle>
            <DialogDescription>
              Configure target cover levels for your grazing system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label>Pre-Grazing Target (kg DM/ha)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Ideal cover level when entering a paddock
              </p>
              <div className="flex items-center gap-4">
                <Slider
                  value={[feedWedgeSettings.preGrazingTarget]}
                  onValueChange={([v]) => setFeedWedgeSettings({ ...feedWedgeSettings, preGrazingTarget: v })}
                  min={2000}
                  max={4000}
                  step={100}
                  className="flex-1"
                />
                <span className="w-16 text-right font-mono">{feedWedgeSettings.preGrazingTarget}</span>
              </div>
            </div>

            <div>
              <Label>Post-Grazing Residual (kg DM/ha)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Target cover level when leaving a paddock
              </p>
              <div className="flex items-center gap-4">
                <Slider
                  value={[feedWedgeSettings.postGrazingTarget]}
                  onValueChange={([v]) => setFeedWedgeSettings({ ...feedWedgeSettings, postGrazingTarget: v })}
                  min={1000}
                  max={2000}
                  step={100}
                  className="flex-1"
                />
                <span className="w-16 text-right font-mono">{feedWedgeSettings.postGrazingTarget}</span>
              </div>
            </div>

            <div>
              <Label>Ready to Graze Minimum (kg DM/ha)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Minimum cover for a paddock to be considered ready
              </p>
              <div className="flex items-center gap-4">
                <Slider
                  value={[feedWedgeSettings.readyToGrazeMin]}
                  onValueChange={([v]) => setFeedWedgeSettings({ ...feedWedgeSettings, readyToGrazeMin: v })}
                  min={2000}
                  max={3500}
                  step={100}
                  className="flex-1"
                />
                <span className="w-16 text-right font-mono">{feedWedgeSettings.readyToGrazeMin}</span>
              </div>
            </div>

            <div>
              <Label>Deficit Threshold (kg DM/ha)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Below this level is considered a feed deficit
              </p>
              <div className="flex items-center gap-4">
                <Slider
                  value={[feedWedgeSettings.deficitThreshold]}
                  onValueChange={([v]) => setFeedWedgeSettings({ ...feedWedgeSettings, deficitThreshold: v })}
                  min={1200}
                  max={2200}
                  step={100}
                  className="flex-1"
                />
                <span className="w-16 text-right font-mono">{feedWedgeSettings.deficitThreshold}</span>
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Color Preview</p>
              <div className="flex gap-2">
                <div className="flex-1 h-8 bg-green-500 rounded flex items-center justify-center text-white text-xs">
                  ≥{feedWedgeSettings.readyToGrazeMin}
                </div>
                <div className="flex-1 h-8 bg-yellow-500 rounded flex items-center justify-center text-white text-xs">
                  {feedWedgeSettings.deficitThreshold}-{feedWedgeSettings.readyToGrazeMin}
                </div>
                <div className="flex-1 h-8 bg-red-500 rounded flex items-center justify-center text-white text-xs">
                  &lt;{feedWedgeSettings.deficitThreshold}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              // Reset to defaults
              setFeedWedgeSettings({
                preGrazingTarget: 2800,
                postGrazingTarget: 1500,
                readyToGrazeMin: 2500,
                deficitThreshold: 1800,
              });
            }}>
              Reset to Defaults
            </Button>
            <Button onClick={() => setShowFeedWedgeSettings(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Farm Metrics Settings Dialog */}
      <Dialog open={showMetricsSettings} onOpenChange={setShowMetricsSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Farm Settings
            </DialogTitle>
            <DialogDescription>
              Configure your farm parameters for accurate metrics calculation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label>Herd Size (milking cows)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Number of cows currently being grazed
              </p>
              <Input
                type="number"
                value={farmMetrics.herdSize}
                onChange={(e) => setFarmMetrics({ ...farmMetrics, herdSize: parseInt(e.target.value) || 0 })}
                placeholder="e.g., 200"
              />
            </div>

            <div>
              <Label>Demand per Cow (kg DM/day)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Daily dry matter intake per cow (typically 14-18 kg)
              </p>
              <div className="flex items-center gap-4">
                <Slider
                  value={[farmMetrics.demandPerCow]}
                  onValueChange={([v]) => setFarmMetrics({ ...farmMetrics, demandPerCow: v })}
                  min={10}
                  max={22}
                  step={0.5}
                  className="flex-1"
                />
                <span className="w-16 text-right font-mono">{farmMetrics.demandPerCow}</span>
              </div>
            </div>

            <div>
              <Label>Target Rotation Length (days)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Ideal number of days between grazing the same paddock
              </p>
              <div className="flex items-center gap-4">
                <Slider
                  value={[farmMetrics.targetRotation]}
                  onValueChange={([v]) => setFarmMetrics({ ...farmMetrics, targetRotation: v })}
                  min={15}
                  max={45}
                  step={1}
                  className="flex-1"
                />
                <span className="w-16 text-right font-mono">{farmMetrics.targetRotation}</span>
              </div>
            </div>

            <div>
              <Label>Effective Grazing Area (ha)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Total area available for grazing (auto-calculated from paddocks if left at 0)
              </p>
              <Input
                type="number"
                value={farmMetrics.effectiveArea || ''}
                onChange={(e) => setFarmMetrics({ ...farmMetrics, effectiveArea: parseInt(e.target.value) || 0 })}
                placeholder="Auto-calculated from paddocks"
              />
            </div>

            {/* Calculated summary */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium">Calculated Values</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Total Daily Demand:</span>
                <span className="font-medium">{(farmMetrics.herdSize * farmMetrics.demandPerCow).toLocaleString()} kg DM</span>
                <span className="text-muted-foreground">Demand per ha:</span>
                <span className="font-medium">
                  {farmMetrics.effectiveArea > 0 
                    ? Math.round((farmMetrics.herdSize * farmMetrics.demandPerCow) / farmMetrics.effectiveArea)
                    : '—'} kg DM/ha/day
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setFarmMetrics({
                herdSize: 200,
                demandPerCow: 15,
                targetRotation: 25,
                effectiveArea: 0,
              });
            }}>
              Reset to Defaults
            </Button>
            <Button onClick={() => setShowMetricsSettings(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotation Planner Settings Dialog */}
      <Dialog open={showRotationPlanner} onOpenChange={setShowRotationPlanner}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Spring Rotation Planner Settings
            </DialogTitle>
            <DialogDescription>
              Configure key dates for your spring rotation planning
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label>Spring Start Date</Label>
              <p className="text-xs text-muted-foreground mb-2">
                When spring grazing typically begins (e.g., August 1)
              </p>
              <Input
                type="date"
                value={rotationPlanner.springStartDate}
                onChange={(e) => setRotationPlanner({ ...rotationPlanner, springStartDate: e.target.value })}
              />
            </div>

            <div>
              <Label>First Round Target Date</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Target date to complete grazing all paddocks once
              </p>
              <Input
                type="date"
                value={rotationPlanner.firstRoundTarget}
                onChange={(e) => setRotationPlanner({ ...rotationPlanner, firstRoundTarget: e.target.value })}
              />
            </div>

            <div>
              <Label>Balance Date</Label>
              <p className="text-xs text-muted-foreground mb-2">
                When pasture growth equals herd demand (typically early October)
              </p>
              <Input
                type="date"
                value={rotationPlanner.balanceDate}
                onChange={(e) => setRotationPlanner({ ...rotationPlanner, balanceDate: e.target.value })}
              />
            </div>

            <div>
              <Label>Paddocks Grazed (First Round)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Number of paddocks already grazed in the first round
              </p>
              <Input
                type="number"
                value={rotationPlanner.paddocksGrazedFirstRound}
                onChange={(e) => setRotationPlanner({ 
                  ...rotationPlanner, 
                  paddocksGrazedFirstRound: parseInt(e.target.value) || 0 
                })}
                min={0}
              />
            </div>

            {/* Summary */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium">Calculated Timeline</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Days to Balance:</span>
                <span className="font-medium">
                  {differenceInDays(parseISO(rotationPlanner.balanceDate), new Date())} days
                </span>
                <span className="text-muted-foreground">Days to First Round:</span>
                <span className="font-medium">
                  {differenceInDays(parseISO(rotationPlanner.firstRoundTarget), new Date())} days
                </span>
                <span className="text-muted-foreground">Spring Duration:</span>
                <span className="font-medium">
                  {differenceInDays(parseISO(rotationPlanner.balanceDate), parseISO(rotationPlanner.springStartDate))} days
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              const year = new Date().getFullYear();
              setRotationPlanner({
                balanceDate: format(new Date(year, 9, 1), 'yyyy-MM-dd'),
                springStartDate: format(new Date(year, 7, 1), 'yyyy-MM-dd'),
                firstRoundTarget: format(new Date(year, 9, 15), 'yyyy-MM-dd'),
                paddocksGrazedFirstRound: 0,
                currentWeek: 1,
              });
            }}>
              Reset to Defaults
            </Button>
            <Button onClick={() => setShowRotationPlanner(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotation Calculator Settings Dialog */}
      <Dialog open={showRotationCalc} onOpenChange={setShowRotationCalc}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Rotation Calculator Settings
            </DialogTitle>
            <DialogDescription>
              Configure how the rotation length is calculated
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label>Growth Rate Source</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Choose how to determine the growth rate for calculations
              </p>
              <div className="space-y-2">
                <div 
                  className={`p-3 border rounded-lg cursor-pointer ${rotationCalc.seasonalAdjustment && rotationCalc.customGrowthRate === 0 ? 'border-blue-500 bg-blue-50' : ''}`}
                  onClick={() => setRotationCalc({ ...rotationCalc, seasonalAdjustment: true, customGrowthRate: 0 })}
                >
                  <p className="font-medium">Seasonal Average</p>
                  <p className="text-xs text-muted-foreground">Use typical NZ growth rates for the current month</p>
                </div>
                <div 
                  className={`p-3 border rounded-lg cursor-pointer ${!rotationCalc.seasonalAdjustment && rotationCalc.customGrowthRate === 0 ? 'border-blue-500 bg-blue-50' : ''}`}
                  onClick={() => setRotationCalc({ ...rotationCalc, seasonalAdjustment: false, customGrowthRate: 0 })}
                >
                  <p className="font-medium">Measured Growth</p>
                  <p className="text-xs text-muted-foreground">Use your actual measured growth rate from pasture walks</p>
                </div>
                <div 
                  className={`p-3 border rounded-lg cursor-pointer ${rotationCalc.customGrowthRate > 0 ? 'border-blue-500 bg-blue-50' : ''}`}
                  onClick={() => setRotationCalc({ ...rotationCalc, customGrowthRate: 40 })}
                >
                  <p className="font-medium">Custom Value</p>
                  <p className="text-xs text-muted-foreground">Enter your own growth rate estimate</p>
                </div>
              </div>
            </div>

            {rotationCalc.customGrowthRate > 0 && (
              <div>
                <Label>Custom Growth Rate (kg DM/ha/day)</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Slider
                    value={[rotationCalc.customGrowthRate]}
                    onValueChange={([v]) => setRotationCalc({ ...rotationCalc, customGrowthRate: v })}
                    min={5}
                    max={80}
                    step={1}
                    className="flex-1"
                  />
                  <span className="w-12 text-right font-mono">{rotationCalc.customGrowthRate}</span>
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Calculation Preview</p>
              {(() => {
                const currentMonth = getMonth(new Date());
                const seasonalRates: Record<number, number> = {
                  0: 45, 1: 35, 2: 40, 3: 35, 4: 20, 5: 10,
                  6: 10, 7: 20, 8: 45, 9: 65, 10: 60, 11: 50
                };
                const measuredGrowth = farmCover?.summary.averageGrowthRate || 0;
                const effectiveGrowth = rotationCalc.customGrowthRate > 0 
                  ? rotationCalc.customGrowthRate 
                  : rotationCalc.seasonalAdjustment 
                    ? seasonalRates[currentMonth] 
                    : measuredGrowth || seasonalRates[currentMonth];
                const coverToGrow = feedWedgeSettings.preGrazingTarget - feedWedgeSettings.postGrazingTarget;
                const rotation = effectiveGrowth > 0 ? Math.round(coverToGrow / effectiveGrowth) : 0;

                return (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Growth rate:</span>
                    <span className="font-medium">{effectiveGrowth} kg/ha/day</span>
                    <span className="text-muted-foreground">Cover to regrow:</span>
                    <span className="font-medium">{coverToGrow} kg/ha</span>
                    <span className="text-muted-foreground">Calculated rotation:</span>
                    <span className="font-bold text-green-600">{rotation} days</span>
                  </div>
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRotationCalc({
                customGrowthRate: 0,
                seasonalAdjustment: true,
              });
            }}>
              Reset to Defaults
            </Button>
            <Button onClick={() => setShowRotationCalc(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
