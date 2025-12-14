import { useEffect, useState, useCallback } from "react";
import { Activity, AlertCircle, Pill, Users, Sprout, Heart, TrendingUp as TrendingUpIcon, Settings2, Wrench, UserCheck, Car, QrCode, AlertTriangle, Briefcase, Warehouse, Package, DollarSign, Clock, Shield, ChevronRight, Skull, TrendingDown, GripVertical, Eye, EyeOff, X, LayoutDashboard, Leaf, Calendar, FileText, BarChart3, Droplets, Thermometer, Target, Zap, ChevronUp, ChevronDown, Search, Sun, Cloud, CloudRain, Wind, Sunrise, MapPin, Bell, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Animal, AnimalTreatment, Pasture, ProductBatch } from "@shared/schema";
import { format, addDays, subDays, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from "recharts";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { Reorder, useDragControls, motion } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  // Fetch data
  const { data: animals = [], isLoading: isLoadingAnimals } = useQuery<Animal[]>({
    queryKey: ['/api/animals'],
  });

  const { data: treatments = [], isLoading: isLoadingTreatments } = useQuery<AnimalTreatment[]>({
    queryKey: ['/api/animal-treatments'],
  });

  const { data: pastures = [], isLoading: isLoadingPastures } = useQuery<Pasture[]>({
    queryKey: ['/api/pastures'],
  });

  const { data: batches = [], isLoading: isLoadingBatches } = useQuery<ProductBatch[]>({
    queryKey: ['/api/product-batches'],
  });

  const isLoading = isLoadingAnimals || isLoadingTreatments || isLoadingPastures || isLoadingBatches;

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);

  const { data: userPrefs } = useQuery({
    queryKey: ["/api/user-preferences", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/user-preferences/${user.id}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (userPrefs?.dashboardWidgets?.hidden) {
      setHiddenWidgets(userPrefs.dashboardWidgets.hidden);
    }
    if (userPrefs?.dashboardWidgets?.layout && userPrefs.dashboardWidgets.layout.length > 0) {
      // Merge saved layout with any new sections that weren't in the saved preferences
      const savedLayout = userPrefs.dashboardWidgets.layout as string[];
      const newSections = defaultSectionOrder.filter(id => !savedLayout.includes(id));
      setSectionOrder([...savedLayout, ...newSections]);
    }
  }, [userPrefs]);

  const savePreferences = useMutation({
    mutationFn: async ({ hidden, layout }: { hidden: string[]; layout: string[] }) => {
      if (!user?.id) return;
      const res = await fetch("/api/user-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          dashboardWidgets: {
            layout,
            hidden,
          },
          notificationSettings: userPrefs?.notificationSettings ?? undefined,
          theme: userPrefs?.theme ?? undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-preferences", user?.id] });
    },
  });

  const toggleSection = (sectionId: string) => {
    const newHidden = hiddenWidgets.includes(sectionId)
      ? hiddenWidgets.filter((id) => id !== sectionId)
      : [...hiddenWidgets, sectionId];
    setHiddenWidgets(newHidden);
    savePreferences.mutate({ hidden: newHidden, layout: sectionOrder });
  };

  const handleReorder = (newOrder: string[]) => {
    setSectionOrder(newOrder);
    savePreferences.mutate({ hidden: hiddenWidgets, layout: newOrder });
  };

  const resetToDefaults = () => {
    setHiddenWidgets([]);
    setSectionOrder(defaultSectionOrder);
    savePreferences.mutate({ hidden: [], layout: defaultSectionOrder });
  };

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    const currentIndex = sectionOrder.indexOf(sectionId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= sectionOrder.length) return;
    
    const newOrder = [...sectionOrder];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
    setSectionOrder(newOrder);
    savePreferences.mutate({ hidden: hiddenWidgets, layout: newOrder });
  };

  // Define all dashboard sections with their categories
  const allSections = [
    { id: "key-metrics", name: "Key Metrics", icon: BarChart3, category: "overview", description: "Active treatments, animals, pastures" },
    { id: "critical-alerts", name: "Critical Alerts", icon: AlertCircle, category: "overview", description: "Urgent items needing attention" },
    { id: "quick-actions", name: "Quick Actions", icon: Zap, category: "actions", description: "Common tasks and shortcuts" },
    { id: "recent-activity", name: "Recent Activity", icon: Calendar, category: "overview", description: "Latest farm events and changes" },
    { id: "pasture-wedge", name: "Pasture Wedge", icon: Leaf, category: "feed", description: "Feed wedge and grazing covers" },
    { id: "breed-distribution", name: "Herd Composition", icon: Users, category: "animals", description: "Breed distribution and counts" },
    { id: "health-metrics", name: "Health Metrics", icon: Heart, category: "health", description: "Treatment success, vaccination, BCS" },
    { id: "population-trend", name: "Population Trends", icon: TrendingUpIcon, category: "animals", description: "Animal population over time" },
    { id: "operations-hub", name: "Operations Hub", icon: Wrench, category: "operations", description: "Quick links to farm operations" },
    { id: "mortality-tracking", name: "Mortality & Culling", icon: Skull, category: "health", description: "Death and cull rate tracking" },
    { id: "weather-summary", name: "Weather Summary", icon: Thermometer, category: "environment", description: "Current conditions and forecast" },
    { id: "milk-production", name: "Milk Production", icon: Droplets, category: "production", description: "Daily production metrics" },
    { id: "upcoming-tasks", name: "Upcoming Tasks", icon: Target, category: "actions", description: "Scheduled jobs and reminders" },
  ];

  // Default section order
  const defaultSectionOrder = [
    "key-metrics",
    "critical-alerts", 
    "quick-actions",
    "recent-activity",
    "pasture-wedge",
    "health-metrics",
    "breed-distribution",
    "population-trend",
    "operations-hub",
    "mortality-tracking",
  ];

  // Section order state
  const [sectionOrder, setSectionOrder] = useState<string[]>(defaultSectionOrder);
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Get visible sections in order
  const visibleSections = sectionOrder.filter(id => !hiddenWidgets.includes(id));

  // Calculate metrics
  const activeTreatments = treatments.filter(t => t.status === 'active').length;
  const totalAnimals = animals.length;
  const activePastures = pastures.filter(p => p.status === 'available').length;
  
  // Batches expiring in next 7 days
  const sevenDaysFromNow = addDays(new Date(), 7);
  const expiringBatches = batches.filter(b => {
    if (!b.expiryDate) return false;
    const expiry = new Date(b.expiryDate);
    return expiry <= sevenDaysFromNow && expiry >= new Date();
  }).length;

  // Recent activity (last 5 animals)
  const recentAnimals = [...animals]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Breed distribution (top 5)
  const breedDistribution = Object.entries(
    animals.reduce((acc, a) => {
      const breed = a.breed || 'Unknown';
      acc[breed] = (acc[breed] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([breed, count]) => ({ breed, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Critical alerts
  const now = new Date();
  const criticalAlerts: Array<{ type: string; message: string; severity: 'high' | 'medium' | 'low' }> = [];

  // Withhold ending soon (within 24 hours)
  treatments.forEach(t => {
    if (t.status === 'active' && t.milkWithdrawalEndDate) {
      const withholdEnd = new Date(t.milkWithdrawalEndDate);
      const hoursUntilEnd = (withholdEnd.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilEnd > 0 && hoursUntilEnd <= 24) {
        criticalAlerts.push({
          type: 'withhold',
          message: `${t.cowId || 'Animal'}: Withhold ending in ${Math.round(hoursUntilEnd)}h`,
          severity: 'high'
        });
      }
    }
  });

  // Expiring medicines (within 3 days)
  const threeDaysFromNow = addDays(now, 3);
  batches.forEach(b => {
    if (b.expiryDate) {
      const expiry = new Date(b.expiryDate);
      if (expiry <= threeDaysFromNow && expiry >= now) {
        criticalAlerts.push({
          type: 'expiry',
          message: `Batch expiring: ${format(expiry, 'MMM d')}`,
          severity: 'medium'
        });
      }
    }
  });

  // Low stock batches (emptied batches)
  const emptyingBatches = batches.filter(b => b.status === 'emptied').length;
  if (emptyingBatches > 5) {
    criticalAlerts.push({
      type: 'stock',
      message: `${emptyingBatches} batches recently emptied`,
      severity: 'low'
    });
  }

  // Overdue treatments (active treatments without doses given in last 7 days)
  const sevenDaysAgo = subDays(now, 7);
  treatments.forEach(t => {
    if (t.status === 'active' && t.lastDoseDate) {
      const lastDose = new Date(t.lastDoseDate);
      if (lastDose < sevenDaysAgo) {
        criticalAlerts.push({
          type: 'overdue',
          message: `${t.cowId || 'Animal'}: Treatment overdue (last dose ${format(lastDose, 'MMM d')})`,
          severity: 'high'
        });
      }
    } else if (t.status === 'active' && !t.lastDoseDate) {
      const treatmentStart = new Date(t.dateTime);
      if (treatmentStart < sevenDaysAgo) {
        criticalAlerts.push({
          type: 'overdue',
          message: `${t.cowId || 'Animal'}: Treatment not started (awaiting ${Math.round((now.getTime() - treatmentStart.getTime()) / (1000 * 60 * 60 * 24))}d)`,
          severity: 'high'
        });
      }
    }
  });

  // Sort by severity and limit to 5
  const displayAlerts = criticalAlerts
    .sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .slice(0, 5);

  // Health metrics
  const completedTreatments = treatments.filter(t => t.status === 'completed').length;
  const treatmentSuccessRate = treatments.length > 0 
    ? Math.round((completedTreatments / treatments.length) * 100)
    : 0;
  
  // Vaccination coverage (estimate based on recent treatments with "vaccination" in condition)
  const vaccinatedAnimals = new Set(
    treatments.filter(t => 
      t.condition?.toLowerCase().includes('vaccin') || 
      t.condition?.toLowerCase().includes('immuniz')
    ).map(t => t.animalId)
  ).size;
  const vaccinationCoverage = totalAnimals > 0 
    ? Math.round((vaccinatedAnimals / totalAnimals) * 100)
    : 0;
  
  // Average body condition score (1-5 scale)
  const animalsWithScore = animals.filter(a => a.bodyConditionScore !== null && a.bodyConditionScore !== undefined);
  const avgBodyCondition = animalsWithScore.length > 0
    ? (animalsWithScore.reduce((sum, a) => sum + Number(a.bodyConditionScore || 0), 0) / animalsWithScore.length).toFixed(1)
    : 'N/A';

  // Trend data: Animal population growth (last 30 days)
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(startOfDay(now), (6 - i) * 5); // 5-day intervals for 30-day view
    const animalCount = animals.filter(a => {
      const createdDate = new Date(a.createdAt);
      return createdDate <= date;
    }).length;
    return {
      date: format(date, 'MMM d'),
      animals: animalCount
    };
  });

  // Time-based greeting
  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Mock weather data (in production, this would come from an API)
  const weatherData = {
    temp: 18,
    condition: 'Partly Cloudy',
    humidity: 65,
    wind: 12,
    sunrise: '6:42 AM',
    sunset: '8:15 PM',
    forecast: [
      { day: 'Today', high: 22, low: 14, condition: 'sunny' },
      { day: 'Wed', high: 20, low: 13, condition: 'cloudy' },
      { day: 'Thu', high: 18, low: 11, condition: 'rain' },
      { day: 'Fri', high: 21, low: 12, condition: 'sunny' },
    ]
  };

  // Sparkline data for metric cards
  const herdSparkline = Array.from({ length: 7 }, (_, i) => ({ value: totalAnimals - (6 - i) * 3 + Math.floor(Math.random() * 5) }));
  const treatmentSparkline = Array.from({ length: 7 }, (_, i) => ({ value: Math.max(0, treatments.length - (6 - i) * 2 + Math.floor(Math.random() * 3)) }));

  // Mock pasture wedge data
  const pastureWedgeData = [
    { paddock: 'P1', cover: 3200, target: 2900 },
    { paddock: 'P2', cover: 2800, target: 2900 },
    { paddock: 'P3', cover: 2600, target: 2900 },
    { paddock: 'P4', cover: 2400, target: 2900 },
    { paddock: 'P5', cover: 2200, target: 2900 },
    { paddock: 'P6', cover: 2000, target: 2900 },
    { paddock: 'P7', cover: 1800, target: 2900 },
    { paddock: 'P8', cover: 1600, target: 1500 },
  ];

  // Mock recent activity data
  const recentActivityData = [
    { id: 1, type: 'treatment', description: 'Recorded 12 liveweights', user: 'Sam', time: '04:45pm', date: 'Today' },
    { id: 2, type: 'approved', description: 'Approved 96 remove animals', user: 'Sam', time: '04:45pm', date: 'Today' },
    { id: 3, type: 'recorded', description: 'Recorded 144 liveweights', user: 'Sam', time: '04:30pm', date: 'Today' },
    { id: 4, type: 'calving', description: 'Added 3 calving events', user: 'Admin', time: '02:15pm', date: 'Today' },
    { id: 5, type: 'health', description: 'Updated health records', user: 'Rhys', time: '11:00am', date: 'Yesterday' },
  ];

  // Render section content based on section ID
  const renderSection = (sectionId: string) => {
    const section = allSections.find(s => s.id === sectionId);
    if (!section) return null;

    switch (sectionId) {
      case 'key-metrics':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Treatments</CardTitle>
                <Activity className="h-6 w-6 text-primary" strokeWidth={1.5} />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold">{activeTreatments}</div>}
                <p className="text-xs text-muted-foreground">Across all animals</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
                <Pill className="h-6 w-6 text-orange-500" strokeWidth={1.5} />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold">{expiringBatches}</div>}
                <p className="text-xs text-muted-foreground">Next 7 days</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Animals</CardTitle>
                <Users className="h-6 w-6 text-primary" strokeWidth={1.5} />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold">{totalAnimals}</div>}
                <p className="text-xs text-muted-foreground">In all herds</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Pastures</CardTitle>
                <Sprout className="h-6 w-6 text-green-600" strokeWidth={1.5} />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold">{activePastures}</div>}
                <p className="text-xs text-muted-foreground">Currently in use</p>
              </CardContent>
            </Card>
          </div>
        );

      case 'critical-alerts':
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Critical Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : displayAlerts.length > 0 ? (
                <div className="space-y-2">
                  {displayAlerts.map((alert, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors">
                      <AlertCircle className={`h-4 w-4 flex-shrink-0 ${alert.severity === 'high' ? 'text-red-500' : alert.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'}`} />
                      <span className="text-sm flex-1">{alert.message}</span>
                      <Badge variant={alert.severity === 'high' ? 'destructive' : alert.severity === 'medium' ? 'default' : 'secondary'} className="text-xs">
                        {alert.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No active alerts</p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'quick-actions':
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Link href="/app/treatments/entry">
                  <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-accent hover:border-primary">
                    <Activity className="h-6 w-6 text-primary" />
                    <span className="text-sm">Record Treatment</span>
                  </Button>
                </Link>
                <Link href="/app/animals">
                  <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-accent hover:border-primary">
                    <Users className="h-6 w-6 text-primary" />
                    <span className="text-sm">Add Animal</span>
                  </Button>
                </Link>
                <Link href="/app/reproduction">
                  <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-accent hover:border-primary">
                    <Heart className="h-6 w-6 text-primary" />
                    <span className="text-sm">Reproduction</span>
                  </Button>
                </Link>
                <Link href="/app/pastures">
                  <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-accent hover:border-primary">
                    <Leaf className="h-6 w-6 text-primary" />
                    <span className="text-sm">Pasture Cover</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        );

      case 'recent-activity':
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivityData.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.user}</p>
                      <p className="text-sm text-muted-foreground">{activity.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
                  </div>
                ))}
              </div>
              <Link href="/app/activity">
                <Button variant="ghost" size="sm" className="w-full mt-4">
                  View All Activity <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        );

      case 'pasture-wedge':
        return (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Leaf className="h-5 w-5 text-green-600" />
                  Pasture Wedge
                </CardTitle>
                <div className="text-right">
                  <p className="text-sm font-medium">Avg Cover: 2,432 kg DM/ha</p>
                  <p className="text-xs text-muted-foreground">Target: 2,900 kg DM/ha</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pastureWedgeData} layout="vertical">
                  <XAxis type="number" domain={[0, 3500]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="paddock" tick={{ fontSize: 11 }} width={30} />
                  <Tooltip />
                  <Bar dataKey="cover" radius={[0, 4, 4, 0]}>
                    {pastureWedgeData.map((entry, index) => (
                      <Cell key={index} fill={entry.cover >= entry.target ? 'hsl(var(--primary))' : entry.cover >= entry.target * 0.8 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <Link href="/app/pastures">
                <Button variant="ghost" size="sm" className="w-full mt-2">
                  View Full Wedge <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        );

      case 'health-metrics':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Treatment Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-primary">{treatmentSuccessRate}%</div>}
                <p className="text-xs text-muted-foreground">{completedTreatments} of {treatments.length} completed</p>
                <Progress value={treatmentSuccessRate} className="mt-2 h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Vaccination Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-green-600">{vaccinationCoverage}%</div>}
                <p className="text-xs text-muted-foreground">{vaccinatedAnimals} of {totalAnimals} animals</p>
                <Progress value={vaccinationCoverage} className="mt-2 h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Body Condition</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold">{avgBodyCondition}</div>}
                <p className="text-xs text-muted-foreground">Scale: 1 (thin) - 5 (fat)</p>
                <Progress value={typeof avgBodyCondition === 'number' ? (avgBodyCondition / 5) * 100 : 60} className="mt-2 h-2" />
              </CardContent>
            </Card>
          </div>
        );

      case 'breed-distribution':
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Herd Composition
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : breedDistribution.length > 0 ? (
                <div className="space-y-3">
                  {breedDistribution.map(({ breed, count }) => (
                    <div key={breed} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{breed}</span>
                          <span className="text-sm text-muted-foreground">{count}</span>
                        </div>
                        <Progress value={(count / totalAnimals) * 100} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No breed data available</p>
              )}
            </CardContent>
          </Card>
        );

      case 'population-trend':
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUpIcon className="h-5 w-5 text-primary" />
                Population Trends (30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-48 w-full" /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={trendData}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} />
                    <Area type="monotone" dataKey="animals" fill="hsl(var(--primary))" fillOpacity={0.2} stroke="hsl(var(--primary))" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        );

      case 'operations-hub':
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wrench className="h-5 w-5 text-primary" />
                Operations Hub
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  { href: '/app/operations', icon: Wrench, label: 'Operations' },
                  { href: '/app/operations/visitors', icon: UserCheck, label: 'Visitors' },
                  { href: '/app/operations/vehicles', icon: Car, label: 'Vehicles' },
                  { href: '/app/jobs', icon: Briefcase, label: 'Jobs' },
                  { href: '/app/shed', icon: Warehouse, label: 'Shed' },
                  { href: '/app/farm-finance', icon: DollarSign, label: 'Finance' },
                ].map(item => (
                  <Link key={item.href} href={item.href}>
                    <div className="flex flex-col items-center p-3 rounded-lg border hover:bg-accent hover:border-primary transition-colors cursor-pointer">
                      <div className="p-2 bg-primary/10 rounded-full mb-2">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-xs font-medium text-center">{item.label}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case 'mortality-tracking':
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Skull className="h-5 w-5 text-red-600" />
                Mortality & Culling
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-destructive/10 rounded-lg text-center">
                  <p className="text-xs text-destructive">Deaths (YTD)</p>
                  <p className="text-2xl font-bold text-destructive">5</p>
                  <p className="text-xs text-destructive/70">1.6% rate</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg text-center">
                  <p className="text-xs text-orange-700">Culled (YTD)</p>
                  <p className="text-2xl font-bold text-orange-700">12</p>
                  <p className="text-xs text-orange-600">3.8% rate</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Preventable</p>
                  <p className="text-2xl font-bold">2</p>
                  <p className="text-xs text-muted-foreground">40% of deaths</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg text-center">
                  <p className="text-xs text-primary">vs Last Year</p>
                  <p className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                    <TrendingDown className="h-4 w-4" />-15%
                  </p>
                </div>
              </div>
              <Link href="/app/animal-performance">
                <Button variant="ghost" size="sm" className="w-full">
                  View Full Dashboard <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Header Section */}
      <div className="border-b bg-background/50">
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          {/* Top Row: Greeting & Actions */}
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="hidden md:flex h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 items-center justify-center shadow-lg shadow-emerald-500/25">
                <Sunrise className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-emerald-800" data-testid="text-dashboard-title">
                  {getGreeting()}, {user?.name?.split(' ')[0] || 'Farmer'}
                </h1>
                <p className="text-muted-foreground flex items-center gap-2 mt-2">
                  <Calendar className="h-4 w-4" />
                  {format(now, 'EEEE, MMMM d, yyyy')}
                  <span className="text-muted-foreground/50">•</span>
                  <MapPin className="h-4 w-4" />
                  Your farm at a glance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Bell className="h-4 w-4" />
                <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">3</Badge>
              </Button>
              <Sheet open={isCustomizing} onOpenChange={setIsCustomizing}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings2 className="h-4 w-4 mr-2" />
                    Customize
                  </Button>
                </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <LayoutDashboard className="h-5 w-5" />
                  Customize Dashboard
                </SheetTitle>
                <SheetDescription>
                  Drag sections to reorder. Toggle visibility with the switch.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium">Sections</span>
                  <Button variant="ghost" size="sm" onClick={resetToDefaults}>
                    Reset to Default
                  </Button>
                </div>
                <ScrollArea className="h-[calc(100vh-200px)]">
                  <Reorder.Group axis="y" values={sectionOrder} onReorder={handleReorder} className="space-y-2 pr-4">
                    {sectionOrder.map((sectionId) => {
                      const section = allSections.find(s => s.id === sectionId);
                      if (!section) return null;
                      const IconComponent = section.icon;
                      return (
                        <Reorder.Item
                          key={sectionId}
                          value={sectionId}
                          className="flex items-center gap-2 p-3 bg-card border rounded-lg cursor-grab active:cursor-grabbing select-none"
                          whileDrag={{ 
                            scale: 1.02, 
                            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                            backgroundColor: "hsl(var(--accent))"
                          }}
                          dragConstraints={{ top: 0, bottom: 0 }}
                          dragElastic={0.1}
                        >
                          {/* Move buttons */}
                          <div className="flex flex-col gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 p-0"
                              onClick={(e) => { e.stopPropagation(); moveSection(sectionId, 'up'); }}
                              disabled={sectionOrder.indexOf(sectionId) === 0}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 p-0"
                              onClick={(e) => { e.stopPropagation(); moveSection(sectionId, 'down'); }}
                              disabled={sectionOrder.indexOf(sectionId) === sectionOrder.length - 1}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0 hover:text-primary" />
                          <div className="p-2 bg-primary/10 rounded">
                            <IconComponent className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{section.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{section.description}</p>
                          </div>
                          <Switch
                            checked={!hiddenWidgets.includes(sectionId)}
                            onCheckedChange={() => toggleSection(sectionId)}
                          />
                        </Reorder.Item>
                      );
                    })}
                  </Reorder.Group>
                  
                  {/* Sections not in order (new/hidden) */}
                  {allSections.filter(s => !sectionOrder.includes(s.id)).length > 0 && (
                    <div className="mt-6 pt-4 border-t">
                      <p className="text-sm font-medium mb-3 text-muted-foreground">Available Sections</p>
                      <div className="space-y-2">
                        {allSections.filter(s => !sectionOrder.includes(s.id)).map((section) => {
                          const IconComponent = section.icon;
                          return (
                            <div
                              key={section.id}
                              className="flex items-center gap-3 p-3 bg-muted/50 border rounded-lg"
                            >
                              <div className="p-2 bg-muted rounded">
                                <IconComponent className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{section.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{section.description}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSectionOrder([...sectionOrder, section.id]);
                                  savePreferences.mutate({ hidden: hiddenWidgets, layout: [...sectionOrder, section.id] });
                                }}
                              >
                                Add
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </SheetContent>
          </Sheet>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-xl mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search animals, paddocks, records..." 
              className="pl-12 h-12 bg-white/70 backdrop-blur-md border-emerald-200/50 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 rounded-xl shadow-sm"
            />
          </div>

          {/* Alert Banner */}
          {displayAlerts.length > 0 && (
            <Link href="/app/treatments">
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/10 border border-amber-500/30 backdrop-blur-sm cursor-pointer hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <span className="font-semibold text-amber-800 text-lg">
                      {activeTreatments} treatments due today
                    </span>
                    <p className="text-amber-600/70 text-sm mt-1">Tap to view and manage</p>
                  </div>
                </div>
                <ChevronRight className="h-6 w-6 text-amber-600" />
              </motion.div>
            </Link>
          )}

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
            {/* Herd Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="overflow-hidden hover:shadow-xl focus-within:shadow-xl focus-within:ring-2 focus-within:ring-emerald-400/50 transition-all duration-300 cursor-pointer group bg-gradient-to-br from-white to-emerald-50/30 border-emerald-100/50" tabIndex={0} role="button" aria-label="View herd details">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 group-hover:shadow-xl group-hover:shadow-emerald-500/30 transition-all duration-300">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold px-2 py-1">
                      <ArrowUpRight className="h-3 w-3 mr-1" />+12
                    </Badge>
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-bold text-gray-900">{isLoading ? <Skeleton className="h-9 w-20" /> : totalAnimals}</p>
                    <p className="text-sm text-gray-600 font-medium">Herd</p>
                  </div>
                  {/* Mini sparkline */}
                  <div className="h-10 mt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={herdSparkline}>
                        <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Treatments Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="overflow-hidden hover:shadow-xl focus-within:shadow-xl focus-within:ring-2 focus-within:ring-rose-400/50 transition-all duration-300 cursor-pointer group bg-gradient-to-br from-white to-rose-50/30 border-rose-100/50" tabIndex={0} role="button" aria-label="View treatment details">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-lg shadow-rose-500/25 group-hover:shadow-xl group-hover:shadow-rose-500/30 transition-all duration-300">
                      <Heart className="h-6 w-6 text-white" />
                    </div>
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 font-semibold px-2 py-1">
                      <Minus className="h-3 w-3 mr-1" />3 due
                    </Badge>
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-bold text-gray-900">{isLoading ? <Skeleton className="h-9 w-16" /> : activeTreatments}</p>
                    <p className="text-sm text-gray-600 font-medium">Treatments</p>
                  </div>
                  <div className="h-10 mt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={treatmentSparkline}>
                        <Area type="monotone" dataKey="value" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.15} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Pastures Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="overflow-hidden hover:shadow-xl focus-within:shadow-xl focus-within:ring-2 focus-within:ring-emerald-400/50 transition-all duration-300 cursor-pointer group bg-gradient-to-br from-white to-emerald-50/30 border-emerald-100/50" tabIndex={0} role="button" aria-label="View pasture details">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/25 group-hover:shadow-xl group-hover:shadow-emerald-500/30 transition-all duration-300">
                      <Sprout className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-bold text-gray-900">{isLoading ? <Skeleton className="h-9 w-16" /> : activePastures}</p>
                    <p className="text-sm text-gray-600 font-medium">Pastures</p>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                      <span>Avg: 2,432 kg/ha</span>
                    </div>
                    <Progress value={78} className="h-2 mt-2 bg-emerald-100" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Weather Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="overflow-hidden hover:shadow-xl focus-within:shadow-xl focus-within:ring-2 focus-within:ring-sky-400/50 transition-all duration-300 cursor-pointer group bg-gradient-to-br from-sky-50 via-blue-50 to-white border-sky-100/50" tabIndex={0} role="button" aria-label="View weather details">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-500/25 group-hover:shadow-xl group-hover:shadow-sky-500/30 transition-all duration-300">
                      <Sun className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xs text-gray-600 font-medium bg-white/60 px-2 py-1 rounded-lg">{weatherData.condition}</span>
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-bold text-gray-900">{weatherData.temp}°C</p>
                    <p className="text-sm text-gray-600 font-medium">Weather</p>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
                    <span className="flex items-center gap-1 font-medium">
                      <Wind className="h-4 w-4 text-sky-500" /> {weatherData.wind} km/h
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Droplets className="h-4 w-4 text-blue-500" /> {weatherData.humidity}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 md:p-8 max-w-7xl mx-auto bg-white/40 backdrop-blur-sm rounded-t-3xl mt-2">
        {/* Quick Actions Row */}
        <div className="mb-10">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100">
              <Zap className="h-5 w-5 text-emerald-600" />
            </div>
            Quick Actions
          </h3>
          <div className="flex flex-wrap gap-3">
            <Link href="/app/animals">
              <Button variant="outline" size="sm" className="gap-2 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/25 focus-visible:bg-emerald-500 focus-visible:text-white focus-visible:border-emerald-500 focus-visible:shadow-lg focus-visible:shadow-emerald-500/25 transition-all duration-300 bg-white border-emerald-200 text-emerald-700 font-medium" aria-label="Find animal">
                <Search className="h-4 w-4" />
                Find Animal
              </Button>
            </Link>
            <Link href="/app/treatments/entry">
              <Button variant="outline" size="sm" className="gap-2 hover:bg-rose-500 hover:text-white hover:border-rose-500 hover:shadow-lg hover:shadow-rose-500/25 focus-visible:bg-rose-500 focus-visible:text-white focus-visible:border-rose-500 focus-visible:shadow-lg focus-visible:shadow-rose-500/25 transition-all duration-300 bg-white border-rose-200 text-rose-700 font-medium" aria-label="Record treatment">
                <Heart className="h-4 w-4" />
                Record Treatment
              </Button>
            </Link>
            <Link href="/app/reproduction">
              <Button variant="outline" size="sm" className="gap-2 hover:bg-purple-500 hover:text-white hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/25 focus-visible:bg-purple-500 focus-visible:text-white focus-visible:border-purple-500 focus-visible:shadow-lg focus-visible:shadow-purple-500/25 transition-all duration-300 bg-white border-purple-200 text-purple-700 font-medium" aria-label="Record mating">
                <Activity className="h-4 w-4" />
                Record Mating
              </Button>
            </Link>
            <Link href="/app/pastures">
              <Button variant="outline" size="sm" className="gap-2 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/25 focus-visible:bg-emerald-500 focus-visible:text-white focus-visible:border-emerald-500 focus-visible:shadow-lg focus-visible:shadow-emerald-500/25 transition-all duration-300 bg-white border-emerald-200 text-emerald-700 font-medium" aria-label="Start pasture walk">
                <Sprout className="h-4 w-4" />
                Pasture Walk
              </Button>
            </Link>
          </div>
        </div>

        {/* Upcoming Section */}
        {displayAlerts.filter(a => a.type === 'calving').length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-100">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              Upcoming
            </h3>
            <Link href="/app/reproduction">
              <div className="flex items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200/50 hover:border-purple-300/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/25 group-hover:shadow-xl group-hover:shadow-purple-500/30 transition-all duration-300">
                    <Heart className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <span className="text-gray-900 font-semibold text-lg">
                      <strong>{displayAlerts.filter(a => a.type === 'calving').length || 3} animals</strong> due to calve this week
                    </span>
                    <p className="text-gray-600 text-sm mt-1">Monitor reproductive schedule</p>
                  </div>
                </div>
                <ChevronRight className="h-6 w-6 text-purple-600 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </Link>
          </motion.div>
        )}

        <Separator className="my-8 bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />

        {/* Dynamic Section Rendering */}
        <div className="space-y-8">
          {visibleSections.map((sectionId) => (
            <motion.div
              key={sectionId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-emerald-100/50 shadow-sm"
            >
              {renderSection(sectionId)}
            </motion.div>
          ))}
        </div>

        {/* Empty state when no sections visible */}
        {visibleSections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white/60 backdrop-blur-sm rounded-2xl border border-emerald-100/50">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 mb-6">
              <LayoutDashboard className="h-12 w-12 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-3">No widgets visible</h3>
            <p className="text-gray-600 mb-6 max-w-md">
              Click "Customize" to add widgets to your dashboard and personalize your farm overview
            </p>
            <Button onClick={() => setIsCustomizing(true)} className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 focus-visible:from-emerald-600 focus-visible:to-teal-700 text-white font-medium shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 focus-visible:shadow-xl focus-visible:shadow-emerald-500/30 transition-all duration-300" aria-label="Customize dashboard layout">
              <Settings2 className="h-4 w-4 mr-2" />
              Customize Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
