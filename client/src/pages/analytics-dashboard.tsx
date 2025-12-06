import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Activity, Sprout, Pill, TrendingUp, Heart, Stethoscope, Leaf, Baby, Settings2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function AnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Widget visibility state
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  
  // Fetch user preferences
  const { data: userPrefs } = useQuery({
    queryKey: ['/api/user-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/user-preferences/${user.id}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch preferences');
      return res.json();
    },
    enabled: !!user?.id,
  });
  
  // Update local state when preferences load
  useEffect(() => {
    if (userPrefs?.dashboardWidgets?.hidden) {
      setHiddenWidgets(userPrefs.dashboardWidgets.hidden);
    }
  }, [userPrefs]);
  
  // Save preferences mutation
  const savePreferences = useMutation({
    mutationFn: async (hidden: string[]) => {
      if (!user?.id) return;
      const res = await fetch('/api/user-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          dashboardWidgets: {
            layout: userPrefs?.dashboardWidgets?.layout || [],
            hidden: hidden,
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to save preferences');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-preferences', user?.id] });
    },
  });
  
  // Toggle widget visibility
  const toggleWidget = (widgetId: string) => {
    const newHidden = hiddenWidgets.includes(widgetId)
      ? hiddenWidgets.filter(id => id !== widgetId)
      : [...hiddenWidgets, widgetId];
    setHiddenWidgets(newHidden);
    savePreferences.mutate(newHidden);
  };
  
  // Widget definitions
  const widgets = [
    { id: 'treatment-activity', name: 'Treatment Activity', category: 'medical' },
    { id: 'medicine-usage', name: 'Medicine Usage', category: 'medical' },
    { id: 'pasture-health', name: 'Pasture Health Trends', category: 'pasture' },
    { id: 'round-length', name: 'Paddock Round Length', category: 'pasture' },
    { id: 'growth-estimate', name: 'Pasture Growth Estimates', category: 'pasture' },
    { id: 'animal-movements', name: 'Rotation Activity', category: 'pasture' },
    { id: 'reproduction-metrics', name: 'Reproduction Metrics', category: 'reproduction' },
  ];

  // Fetch all analytics data
  const { data: treatmentActivity = [], isLoading: loadingTreatments } = useQuery<{ date: string; count: number }[]>({
    queryKey: ['/api/analytics/treatment-activity', days],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/treatment-activity?days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch treatment activity');
      return res.json();
    },
  });

  const { data: pastureHealth = [], isLoading: loadingPasture } = useQuery<{ date: string; avgGrazingDays: number; avgRestDays: number; avgSoilQuality: number; avgGrassCover: number }[]>({
    queryKey: ['/api/analytics/pasture-health-trends', days],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/pasture-health-trends?days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch pasture health trends');
      return res.json();
    },
  });

  const { data: medicineUsage = [], isLoading: loadingMedicine } = useQuery<{ date: string; opened: number; emptied: number; meanDaysToEmpty: number }[]>({
    queryKey: ['/api/analytics/medicine-usage', days],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/medicine-usage?days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch medicine usage');
      return res.json();
    },
  });

  const { data: animalMovements = [], isLoading: loadingMovements } = useQuery<{ pastureId: string; pastureName: string; moveCount: number }[]>({
    queryKey: ['/api/analytics/animal-movements', days],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/animal-movements?days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch animal movements');
      return res.json();
    },
  });

  const { data: roundLength = [], isLoading: loadingRoundLength } = useQuery<{ pastureId: string; pastureName: string; roundLengthDays: number; lastRotationDate: string | null }[]>({
    queryKey: ['/api/analytics/pasture-round-length'],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/pasture-round-length`);
      if (!res.ok) throw new Error('Failed to fetch round length');
      return res.json();
    },
  });

  const { data: growthEstimate = [], isLoading: loadingGrowthEstimate } = useQuery<{ pastureId: string; pastureName: string; estimatedGrowthKgPerDay: number; daysRested: number; currentGrassCover: number }[]>({
    queryKey: ['/api/analytics/pasture-growth-estimate'],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/pasture-growth-estimate`);
      if (!res.ok) throw new Error('Failed to fetch growth estimate');
      return res.json();
    },
  });

  const { data: reproMetrics, isLoading: loadingRepro } = useQuery<{ heatCount: number; aiCount: number; pregnancyCount: number; calvingCount: number; avgCalvingInterval: number }>({
    queryKey: ['/api/analytics/reproduction-metrics', days],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/reproduction-metrics?days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch reproduction metrics');
      return res.json();
    },
  });

  const isLoading = loadingTreatments || loadingPasture || loadingMedicine || loadingMovements || loadingRepro;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Farm Analytics</h1>
        
        <div className="flex items-center gap-3">
          {/* Widget visibility controls */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4 mr-2" />
                Customize Widgets
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Show/Hide Widgets</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {widgets.map((widget) => (
                <DropdownMenuCheckboxItem
                  key={widget.id}
                  checked={!hiddenWidgets.includes(widget.id)}
                  onCheckedChange={() => toggleWidget(widget.id)}
                >
                  {widget.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Tabs value={days.toString()} onValueChange={(val) => setDays(parseInt(val))}>
            <TabsList data-testid="tabs-time-range">
              <TabsTrigger value="7" data-testid="tab-7-days">7 Days</TabsTrigger>
              <TabsTrigger value="30" data-testid="tab-30-days">30 Days</TabsTrigger>
              <TabsTrigger value="90" data-testid="tab-90-days">90 Days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* MEDICAL ANALYTICS SECTION */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Stethoscope className="h-6 w-6 text-red-600" />
          <h2 className="text-2xl font-bold tracking-tight">Medical Analytics</h2>
        </div>
        <Separator />
      </div>

      {/* Treatment Activity Chart */}
      {!hiddenWidgets.includes('treatment-activity') && (
      <Card data-testid="card-treatment-activity">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Treatment Activity
          </CardTitle>
          <CardDescription>
            Daily treatment events over the last {days} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTreatments ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : treatmentActivity.length === 0 ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">No treatment data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={treatmentActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="Treatment Events" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      )}

      {/* Medicine Usage Chart */}
      {!hiddenWidgets.includes('medicine-usage') && (
      <Card data-testid="card-medicine-usage">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-blue-600" />
            Medicine Usage Patterns
          </CardTitle>
          <CardDescription>
            Batch consumption over {days} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMedicine ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : medicineUsage.length === 0 ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">No medicine usage data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={medicineUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="opened" stackId="1" stroke="#1e3932" fill="#1e3932" name="Opened" />
                <Area type="monotone" dataKey="emptied" stackId="1" stroke="#b8963e" fill="#b8963e" name="Emptied" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      )}

      {/* PASTURE ANALYTICS SECTION */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center gap-3">
          <Leaf className="h-6 w-6 text-green-600" />
          <h2 className="text-2xl font-bold tracking-tight">Pasture Analytics</h2>
        </div>
        <Separator />
      </div>

      {/* Pasture Health Trends Chart */}
      {!hiddenWidgets.includes('pasture-health') && (
      <Card data-testid="card-pasture-health">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-green-600" />
            Pasture Health Trends
          </CardTitle>
          <CardDescription>
            Average health metrics across all pastures over {days} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPasture ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : pastureHealth.length === 0 ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">No pasture health data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={pastureHealth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avgGrazingDays" stroke="#1e3932" name="Grazing Days" />
                <Line type="monotone" dataKey="avgRestDays" stroke="#3d7550" name="Rest Days" />
                <Line type="monotone" dataKey="avgSoilQuality" stroke="#b8963e" name="Soil Quality" />
                <Line type="monotone" dataKey="avgGrassCover" stroke="#967a52" name="Grass Cover (kg/ha)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      )}

      {/* Pasture Round Length */}
      {!hiddenWidgets.includes('round-length') && (
      <Card data-testid="card-pasture-round-length">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            Paddock Round Length
          </CardTitle>
          <CardDescription>
            Days between rotations back to same pasture
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRoundLength ? (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : roundLength.length === 0 ? (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-muted-foreground">No rotation data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {roundLength.filter(r => r.roundLengthDays > 0).slice(0, 5).map((item) => (
                <div key={item.pastureId} className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div>
                    <p className="font-medium">{item.pastureName}</p>
                    {item.lastRotationDate && (
                      <p className="text-xs text-muted-foreground">Last rotation: {new Date(item.lastRotationDate).toLocaleDateString()}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{item.roundLengthDays}</p>
                    <p className="text-xs text-muted-foreground">days</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Pasture Growth Estimates */}
      {!hiddenWidgets.includes('growth-estimate') && (
      <Card data-testid="card-pasture-growth-estimate">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-emerald-600" />
            Pasture Growth Estimates
          </CardTitle>
          <CardDescription>
            Estimated growth rates based on rest period and soil quality
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingGrowthEstimate ? (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : growthEstimate.length === 0 ? (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-muted-foreground">No growth data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {growthEstimate.slice(0, 5).map((item) => (
                <div key={item.pastureId} className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div className="flex-1">
                    <p className="font-medium">{item.pastureName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.daysRested} days rested • {item.currentGrassCover} kg cover
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{item.estimatedGrowthKgPerDay}</p>
                    <p className="text-xs text-muted-foreground">kg/ha/day</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Animal Movement Frequency Chart */}
      {!hiddenWidgets.includes('animal-movements') && (
      <Card data-testid="card-animal-movements">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            Pasture Rotation Activity
          </CardTitle>
          <CardDescription>
            Animal movements per pasture over {days} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMovements ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : animalMovements.length === 0 ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">No movement data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={animalMovements} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="pastureName" type="category" width={120} />
                <Tooltip />
                <Legend />
                <Bar dataKey="moveCount" fill="hsl(var(--primary))" name="Movements" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      )}

      {/* REPRODUCTION ANALYTICS SECTION */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center gap-3">
          <Baby className="h-6 w-6 text-pink-600" />
          <h2 className="text-2xl font-bold tracking-tight">Reproduction Analytics</h2>
        </div>
        <Separator />
      </div>

      {/* Reproduction Metrics Funnel */}
      {!hiddenWidgets.includes('reproduction-metrics') && (
      <Card data-testid="card-reproduction-metrics">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-600" />
            Reproduction Metrics
          </CardTitle>
          <CardDescription>
            Breeding cycle funnel over {days} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRepro ? (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : !reproMetrics ? (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-muted-foreground">No reproduction data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="flex flex-col items-center gap-2 p-4 bg-muted rounded-lg" data-testid="metric-heat-count">
                <p className="text-sm text-muted-foreground">Heat Detections</p>
                <p className="text-3xl font-bold">{reproMetrics.heatCount}</p>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 bg-muted rounded-lg" data-testid="metric-ai-count">
                <p className="text-sm text-muted-foreground">AI Services</p>
                <p className="text-3xl font-bold">{reproMetrics.aiCount}</p>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 bg-muted rounded-lg" data-testid="metric-pregnancy-count">
                <p className="text-sm text-muted-foreground">Pregnancies</p>
                <p className="text-3xl font-bold">{reproMetrics.pregnancyCount}</p>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 bg-muted rounded-lg" data-testid="metric-calving-count">
                <p className="text-sm text-muted-foreground">Calvings</p>
                <p className="text-3xl font-bold">{reproMetrics.calvingCount}</p>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 bg-muted rounded-lg" data-testid="metric-calving-interval">
                <p className="text-sm text-muted-foreground">Avg Calving Interval</p>
                <p className="text-3xl font-bold">{reproMetrics.avgCalvingInterval || 0}<span className="text-sm text-muted-foreground ml-1">days</span></p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
