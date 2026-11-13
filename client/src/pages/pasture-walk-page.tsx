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
    seasonalAdjustment: false, // not offered: there's no source for "typical" monthly growth
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
          <TabsTrigger value="forecast">Feed Budget</TabsTrigger>
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
                const effectiveArea = totalArea || farmMetrics.effectiveArea || 0;
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
                
                const totalPaddocks = farmCover?.summary.totalPaddocks || pastures.length || 0;
                const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || farmMetrics.effectiveArea || 0;
                const growthRate = farmCover?.summary.averageGrowthRate || 30;
                const afc = farmCover?.summary.weightedAverageCover || 2200;
                
                // Calculate weekly targets
                const weeksToBalance = Math.ceil(daysToBalance / 7);
                const weeksToFirstRound = Math.ceil(daysToFirstRound / 7);
                const paddocksPerWeek = weeksToFirstRound > 0 ? Math.ceil(totalPaddocks / weeksToFirstRound) : totalPaddocks;
                const areaPerWeek = weeksToFirstRound > 0 ? (totalArea / weeksToFirstRound).toFixed(1) : totalArea;
                const areaPerDay = (totalArea / Math.max(1, daysToFirstRound)).toFixed(2);
                
                // First round tracking
                const firstRoundProgress = totalPaddocks > 0 ? (rotationPlanner.paddocksGrazedFirstRound / totalPaddocks) * 100 : 0;
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
                                    -{Math.round((totalArea > 0 ? (farmMetrics.herdSize * farmMetrics.demandPerCow) / totalArea : 0))} kg DM/ha/day
                                  </span>
                                </div>
                                <div className="flex justify-between border-t pt-2">
                                  <span className="text-sm font-medium">Net Balance</span>
                                  <span className={`font-bold ${growthRate - ((totalArea > 0 ? (farmMetrics.herdSize * farmMetrics.demandPerCow) / totalArea : 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {growthRate - Math.round((totalArea > 0 ? (farmMetrics.herdSize * farmMetrics.demandPerCow) / totalArea : 0)) >= 0 ? '+' : ''}
                                    {Math.round(growthRate - ((totalArea > 0 ? (farmMetrics.herdSize * farmMetrics.demandPerCow) / totalArea : 0)))} kg DM/ha/day
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
                // The farm's measured growth (pasture walks), unless the farmer enters their own rate.
                // There's no assumed monthly table: growth varies too much by district.
                const measuredGrowth = farmCover?.summary.averageGrowthRate || 0;
                const effectiveGrowth = rotationCalc.customGrowthRate > 0 ? rotationCalc.customGrowthRate : measuredGrowth;

                const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || farmMetrics.effectiveArea || 0;
                const totalPaddocks = farmCover?.summary.totalPaddocks || pastures.length || 0;
                const dailyDemand = farmMetrics.herdSize * farmMetrics.demandPerCow;
                const demandPerHa = totalArea > 0 ? dailyDemand / totalArea : 0;

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
                  if (day >= today && totalPaddocks > 0 && calculatedRotation > 0) {
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
                    {effectiveGrowth === 0 && (
                      <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-900">
                        No growth rate yet. Record covers on two pasture walks to measure growth, or enter your own rate in Calculator Settings.
                      </div>
                    )}
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
                  const totalArea = farmCover?.paddocks.reduce((sum, p) => sum + (p.area || 0), 0) || farmMetrics.effectiveArea || 0;
                  const rotation = farmMetrics.targetRotation || 25;
                  const areaPerDay = totalArea / rotation;
                  let cumulativeArea = 0;
                  for (let i = 0; i < index; i++) {
                    const prevPaddock = paddockData.find(p => p.id === grazingSequence[i]);
                    cumulativeArea += prevPaddock?.area || 0;
                  }
                  const daysFromNow = areaPerDay > 0 ? Math.floor(cumulativeArea / areaPerDay) : 0;
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
                const effectiveArea = totalArea || farmMetrics.effectiveArea || 0;
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
                        const effectiveArea = totalArea || farmMetrics.effectiveArea || 0;
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
                          const effectiveArea = totalArea || farmMetrics.effectiveArea || 0;
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
                          const effectiveArea = totalArea || farmMetrics.effectiveArea || 0;
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
                        const effectiveArea = totalArea || farmMetrics.effectiveArea || 0;
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
                          const effectiveArea = totalArea || farmMetrics.effectiveArea || 0;
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
                          const effectiveArea = totalArea || farmMetrics.effectiveArea || 0;
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
                        const effectiveArea = totalArea || farmMetrics.effectiveArea || 0;
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
                          const effectiveArea = totalArea || farmMetrics.effectiveArea || 0;
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
                          const effectiveArea = totalArea || farmMetrics.effectiveArea || 0;
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
                      const effectiveArea = totalArea || farmMetrics.effectiveArea || 0;
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
                        const effectiveArea = totalArea || farmMetrics.effectiveArea || 0;
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
                  className={`p-3 border rounded-lg cursor-pointer ${rotationCalc.customGrowthRate === 0 ? 'border-blue-500 bg-blue-50' : ''}`}
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
                  <p className="text-xs text-muted-foreground">Enter your own growth rate, e.g. from your district's growth data</p>
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
                const measuredGrowth = farmCover?.summary.averageGrowthRate || 0;
                const effectiveGrowth = rotationCalc.customGrowthRate > 0 ? rotationCalc.customGrowthRate : measuredGrowth;
                const coverToGrow = feedWedgeSettings.preGrazingTarget - feedWedgeSettings.postGrazingTarget;
                const rotation = effectiveGrowth > 0 ? Math.round(coverToGrow / effectiveGrowth) : 0;

                return (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Growth rate:</span>
                    <span className="font-medium">{effectiveGrowth} kg/ha/day</span>
                    <span className="text-muted-foreground">Cover to regrow:</span>
                    <span className="font-medium">{coverToGrow} kg/ha</span>
                    <span className="text-muted-foreground">Calculated rotation:</span>
                    <span className="font-bold text-green-600">{rotation ? `${rotation} days` : 'needs a growth rate'}</span>
                  </div>
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRotationCalc({
                customGrowthRate: 0,
                seasonalAdjustment: false,
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
