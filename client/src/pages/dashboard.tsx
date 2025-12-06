import { useEffect, useState } from "react";
import { Activity, AlertCircle, Pill, Users, Sprout, Heart, TrendingUp as TrendingUpIcon, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Animal, AnimalTreatment, Pasture, ProductBatch } from "@shared/schema";
import { format, addDays, subDays, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";

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
  }, [userPrefs]);

  const savePreferences = useMutation({
    mutationFn: async (hidden: string[]) => {
      if (!user?.id) return;
      const res = await fetch("/api/user-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          dashboardWidgets: {
            layout: userPrefs?.dashboardWidgets?.layout || [],
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

  const toggleWidget = (widgetId: string) => {
    const newHidden = hiddenWidgets.includes(widgetId)
      ? hiddenWidgets.filter((id) => id !== widgetId)
      : [...hiddenWidgets, widgetId];
    setHiddenWidgets(newHidden);
    savePreferences.mutate(newHidden);
  };

  const dashboardWidgets = [
    { id: "metric-treatments", name: "Active Treatments" },
    { id: "metric-expiring-medicines", name: "Expiring Medicines" },
    { id: "metric-animals", name: "Total Animals" },
    { id: "metric-pastures", name: "Active Pastures" },
    { id: "breed-distribution", name: "Top Breeds" },
    { id: "recent-animals", name: "Recent Animals" },
    { id: "health-treatment-success", name: "Treatment Success Rate" },
    { id: "health-vaccination", name: "Vaccination Coverage" },
    { id: "health-body-condition", name: "Average Body Condition" },
    { id: "population-trend", name: "Animal Population Growth" },
    { id: "critical-alerts", name: "Critical Alerts" },
    { id: "quick-actions", name: "Quick Actions" },
  ];

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
    ? (animalsWithScore.reduce((sum, a) => sum + (a.bodyConditionScore || 0), 0) / animalsWithScore.length).toFixed(1)
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

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome to Pulse Farm Management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4 mr-2" />
                Customize Dashboard
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Show/Hide Widgets</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {dashboardWidgets.map((widget) => (
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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {!hiddenWidgets.includes("metric-treatments") && (
          <Card data-testid="card-metric-treatments">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Treatments</CardTitle>
              <Activity className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div className="text-4xl font-bold" data-testid="text-active-treatments">{activeTreatments}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Across all animals</p>
            </CardContent>
          </Card>
        )}

        {!hiddenWidgets.includes("metric-expiring-medicines") && (
          <Card data-testid="card-metric-medicines">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
              <Pill className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div className="text-4xl font-bold" data-testid="text-expiring-medicines">{expiringBatches}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Next 7 days</p>
            </CardContent>
          </Card>
        )}

        {!hiddenWidgets.includes("metric-animals") && (
          <Card data-testid="card-metric-animals">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Animals</CardTitle>
              <Users className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div className="text-4xl font-bold" data-testid="text-total-animals">{totalAnimals}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">In all herds</p>
            </CardContent>
          </Card>
        )}

        {!hiddenWidgets.includes("metric-pastures") && (
          <Card data-testid="card-metric-pastures">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Pastures</CardTitle>
              <Sprout className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div className="text-4xl font-bold" data-testid="text-active-pastures">{activePastures}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Currently in use</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {!hiddenWidgets.includes("breed-distribution") && (
          <Card data-testid="card-breed-distribution">
            <CardHeader>
              <CardTitle>Top Breeds</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : breedDistribution.length > 0 ? (
                <div className="space-y-3">
                  {breedDistribution.map(({ breed, count }) => (
                    <div key={breed} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{breed}</span>
                      <Badge variant="secondary" data-testid={`badge-breed-${breed}`}>
                        {count}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No breed data available</p>
              )}
            </CardContent>
          </Card>
        )}

        {!hiddenWidgets.includes("recent-animals") && (
          <Card data-testid="card-recent-animals">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" strokeWidth={1.5} />
                Recent Animals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentAnimals.length > 0 ? (
                <div className="space-y-3">
                  {recentAnimals.map((animal) => (
                    <div key={animal.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div>
                        <p className="text-sm font-medium">{animal.naitTag || animal.cowId || "No ID"}</p>
                        <p className="text-xs text-muted-foreground">
                          {animal.breed} • {animal.sex}
                        </p>
                      </div>
                      <Badge variant={animal.status === "active" ? "default" : "secondary"}>
                        {animal.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No animals yet</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Herd Health Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {!hiddenWidgets.includes("health-treatment-success") && (
          <Card data-testid="card-health-treatment-success">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Treatment Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div className="text-4xl font-bold" data-testid="text-treatment-success-rate">{treatmentSuccessRate}%</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {completedTreatments} of {treatments.length} completed
              </p>
            </CardContent>
          </Card>
        )}

        {!hiddenWidgets.includes("health-vaccination") && (
          <Card data-testid="card-health-vaccination">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vaccination Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div className="text-4xl font-bold" data-testid="text-vaccination-coverage">{vaccinationCoverage}%</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {vaccinatedAnimals} of {totalAnimals} animals
              </p>
            </CardContent>
          </Card>
        )}

        {!hiddenWidgets.includes("health-body-condition") && (
          <Card data-testid="card-health-body-condition">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Body Condition</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div className="text-4xl font-bold" data-testid="text-avg-body-condition">{avgBodyCondition}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Scale: 1 (thin) - 5 (fat)
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Animal Population Trend */}
      {!hiddenWidgets.includes("population-trend") && (
        <Card data-testid="card-population-trends" className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUpIcon className="h-5 w-5" strokeWidth={1.5} />
              Animal Population Growth (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trendData}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Bar
                    dataKey="animals"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {!hiddenWidgets.includes("critical-alerts") && (
          <Card data-testid="card-alerts">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6" strokeWidth={1.5} />
                Critical Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : displayAlerts.length > 0 ? (
                <div className="space-y-2">
                  {displayAlerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-md border"
                      data-testid={`alert-${alert.type}-${idx}`}
                    >
                      <AlertCircle
                        className={`h-4 w-4 ${
                          alert.severity === "high"
                            ? "text-red-500"
                            : alert.severity === "medium"
                            ? "text-yellow-500"
                            : "text-blue-500"
                        }`}
                      />
                      <span className="text-sm flex-1">{alert.message}</span>
                      <Badge
                        variant={
                          alert.severity === "high"
                            ? "destructive"
                            : alert.severity === "medium"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No active alerts
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!hiddenWidgets.includes("quick-actions") && (
          <Card data-testid="card-quick-actions">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button
                asChild
                variant="outline"
                className="w-full justify-start h-12"
                data-testid="button-quick-record-treatment"
              >
                <Link href="/app/treatments/entry">
                  <Activity className="mr-2 h-5 w-5" strokeWidth={1.5} />
                  Record Treatment
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-start h-12"
                data-testid="button-quick-add-animal"
              >
                <Link href="/app/animals">
                  <Users className="mr-2 h-5 w-5" strokeWidth={1.5} />
                  Add Animal
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-start h-12"
                data-testid="button-quick-record-reproduction"
              >
                <Link href="/app/reproduction">
                  <Heart className="mr-2 h-5 w-5" strokeWidth={1.5} />
                  Record Reproduction Event
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
