import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, Activity, 
  AlertTriangle, CheckCircle, Pill, Heart, Thermometer, Users,
  Calendar, Target, ArrowUp, ArrowDown, Minus
} from "lucide-react";

type HealthSummary = {
  totalAnimals: number;
  treatmentsThisPeriod: number;
  mortalityThisPeriod: number;
  vetVisitsThisPeriod: number;
  activePrescriptions: number;
  averageScores: {
    lameness: number | null;
    bcs: number | null;
    temperature: number | null;
  };
  periodDays: number;
};

type TreatmentCosts = {
  totalTreatments: number;
  totalEstimatedCost: number;
  byCategory: { category: string; count: number; estimatedCost: number }[];
  byCondition: { condition: string; count: number; estimatedCost: number }[];
  topAnimalsByCost: { animalId: string; animalName: string; count: number; estimatedCost: number }[];
  periodDays: number;
};

type DiseaseIncidence = {
  conditions: { condition: string; count: number; incidenceRate: string }[];
  monthlyTrends: Record<string, any>[];
  totalAnimals: number;
  periodDays: number;
};

type AntibioticUsage = {
  totalAntibioticTreatments: number;
  uniqueAnimalsTreated: number;
  treatmentRate: string;
  byRoute: { route: string; count: number }[];
  byCondition: { condition: string; count: number }[];
  monthlyTrend: { month: string; count: number }[];
  totalAnimals: number;
  periodDays: number;
};

type SeasonalTrends = {
  monthlyTrends: Record<string, any>[];
  yearlyTotals: { year: string; count: number }[];
  seasonalDistribution: { season: string; count: number }[];
  yearOverYearChange: string | null;
  peakSeason: string;
};

type Benchmarks = {
  farmMetrics: {
    treatmentsPerAnimal: number;
    mortalityRate: number;
    lamenessPrevalence: number;
    mastitisIncidence: number;
  };
  industryBenchmarks: Record<string, { industry: number; label: string }>;
  comparison: Record<string, { value: number; benchmark: number; status: string }>;
  totalAnimals: number;
  periodDays: number;
};

export default function HealthAnalyticsDashboard() {
  const [period, setPeriod] = useState("30");

  // Fetch health summary
  const { data: summary, isLoading: loadingSummary } = useQuery<HealthSummary>({
    queryKey: ["/api/analytics/health/summary", period],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/health/summary?days=${period}`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  // Fetch treatment costs
  const { data: costs, isLoading: loadingCosts } = useQuery<TreatmentCosts>({
    queryKey: ["/api/analytics/health/treatment-costs", period],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/health/treatment-costs?days=${period}`);
      if (!res.ok) throw new Error("Failed to fetch costs");
      return res.json();
    },
  });

  // Fetch disease incidence
  const { data: incidence, isLoading: loadingIncidence } = useQuery<DiseaseIncidence>({
    queryKey: ["/api/analytics/health/disease-incidence"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/health/disease-incidence?days=365");
      if (!res.ok) throw new Error("Failed to fetch incidence");
      return res.json();
    },
  });

  // Fetch antibiotic usage
  const { data: antibiotics, isLoading: loadingAntibiotics } = useQuery<AntibioticUsage>({
    queryKey: ["/api/analytics/health/antibiotic-usage"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/health/antibiotic-usage?days=365");
      if (!res.ok) throw new Error("Failed to fetch antibiotic usage");
      return res.json();
    },
  });

  // Fetch seasonal trends
  const { data: seasonal, isLoading: loadingSeasonal } = useQuery<SeasonalTrends>({
    queryKey: ["/api/analytics/health/seasonal-trends"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/health/seasonal-trends");
      if (!res.ok) throw new Error("Failed to fetch seasonal trends");
      return res.json();
    },
  });

  // Fetch benchmarks
  const { data: benchmarks, isLoading: loadingBenchmarks } = useQuery<Benchmarks>({
    queryKey: ["/api/analytics/health/benchmarks"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/health/benchmarks?days=365");
      if (!res.ok) throw new Error("Failed to fetch benchmarks");
      return res.json();
    },
  });

  const getStatusIcon = (status: string) => {
    if (status === 'good') return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <AlertTriangle className="h-4 w-4 text-orange-500" />;
  };

  const getChangeIcon = (change: string | null) => {
    if (!change) return <Minus className="h-4 w-4 text-gray-400" />;
    const val = parseFloat(change);
    if (val > 0) return <ArrowUp className="h-4 w-4 text-red-500" />;
    if (val < 0) return <ArrowDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Health Analytics & Reporting
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive health insights, cost analysis, and industry benchmarking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Period:</span>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="365">1 year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Health Dashboard Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Animals</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{summary?.totalAnimals || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Active herd</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Treatments</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{summary?.treatmentsThisPeriod || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Last {period} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mortality</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{summary?.mortalityThisPeriod || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Last {period} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vet Visits</CardTitle>
            <Heart className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-purple-600">{summary?.vetVisitsThisPeriod || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Rx</CardTitle>
            <Pill className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-orange-600">{summary?.activePrescriptions || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Prescriptions</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="costs" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="costs">
            <DollarSign className="h-4 w-4 mr-1" />
            Costs
          </TabsTrigger>
          <TabsTrigger value="diseases">
            <Activity className="h-4 w-4 mr-1" />
            Diseases
          </TabsTrigger>
          <TabsTrigger value="antibiotics">
            <Pill className="h-4 w-4 mr-1" />
            Antibiotics
          </TabsTrigger>
          <TabsTrigger value="trends">
            <TrendingUp className="h-4 w-4 mr-1" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="benchmarks">
            <Target className="h-4 w-4 mr-1" />
            Benchmarks
          </TabsTrigger>
        </TabsList>

        {/* Treatment Costs Tab */}
        <TabsContent value="costs" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Cost by Condition</CardTitle>
                <CardDescription>Treatment costs breakdown by health condition</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCosts ? (
                  <Skeleton className="h-64 w-full" />
                ) : !costs?.byCondition?.length ? (
                  <p className="text-muted-foreground text-center py-8">No treatment cost data available</p>
                ) : (
                  <div className="space-y-3">
                    {costs.byCondition.slice(0, 10).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">{item.condition}</span>
                            <span className="text-sm text-muted-foreground">{item.count} treatments</span>
                          </div>
                          <Progress 
                            value={(item.count / (costs.totalTreatments || 1)) * 100} 
                            className="h-2"
                          />
                        </div>
                        <div className="ml-4 text-right min-w-[80px]">
                          <span className="font-medium">${item.estimatedCost.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingCosts ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-3xl font-bold text-green-600">
                        ${costs?.totalEstimatedCost?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Estimated Cost</div>
                    </div>
                    <div className="space-y-2">
                      {costs?.byCategory?.map((cat, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="capitalize">{cat.category}</span>
                          <span className="font-medium">${cat.estimatedCost.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Animals by Treatment Cost</CardTitle>
              <CardDescription>Animals with highest treatment expenses</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCosts ? (
                <Skeleton className="h-32 w-full" />
              ) : !costs?.topAnimalsByCost?.length ? (
                <p className="text-muted-foreground text-center py-4">No data available</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {costs.topAnimalsByCost.map((animal, idx) => (
                    <div key={idx} className="p-3 border rounded-lg text-center">
                      <div className="font-medium">{animal.animalName}</div>
                      <div className="text-lg font-bold text-green-600">${animal.estimatedCost.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{animal.count} treatments</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Disease Incidence Tab */}
        <TabsContent value="diseases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Disease Incidence Report</CardTitle>
              <CardDescription>Condition frequency and incidence rates (last 12 months)</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingIncidence ? (
                <Skeleton className="h-64 w-full" />
              ) : !incidence?.conditions?.length ? (
                <p className="text-muted-foreground text-center py-8">No disease incidence data available</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {incidence.conditions.slice(0, 12).map((item, idx) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">{item.condition}</span>
                        <Badge variant={parseFloat(item.incidenceRate) > 10 ? "destructive" : "secondary"}>
                          {item.incidenceRate}%
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold">{item.count}</div>
                      <div className="text-xs text-muted-foreground">cases recorded</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Antibiotic Usage Tab */}
        <TabsContent value="antibiotics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Antibiotic Treatments</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAntibiotics ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{antibiotics?.totalAntibioticTreatments || 0}</div>
                )}
                <p className="text-xs text-muted-foreground">Last 12 months</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Animals Treated</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAntibiotics ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{antibiotics?.uniqueAnimalsTreated || 0}</div>
                )}
                <p className="text-xs text-muted-foreground">Unique animals</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Treatment Rate</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAntibiotics ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{antibiotics?.treatmentRate || 0}%</div>
                )}
                <p className="text-xs text-muted-foreground">Of herd treated</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Usage by Route</CardTitle>
                <CardDescription>Administration method breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAntibiotics ? (
                  <Skeleton className="h-32 w-full" />
                ) : !antibiotics?.byRoute?.length ? (
                  <p className="text-muted-foreground text-center py-4">No data available</p>
                ) : (
                  <div className="space-y-3">
                    {antibiotics.byRoute.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="capitalize">{item.route}</span>
                        <Badge variant="outline">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage by Condition</CardTitle>
                <CardDescription>Conditions requiring antibiotics</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAntibiotics ? (
                  <Skeleton className="h-32 w-full" />
                ) : !antibiotics?.byCondition?.length ? (
                  <p className="text-muted-foreground text-center py-4">No data available</p>
                ) : (
                  <div className="space-y-3">
                    {antibiotics.byCondition.slice(0, 8).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span>{item.condition}</span>
                        <Badge variant="outline">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-blue-600" />
                AMR Compliance Note
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-800">
                Antimicrobial resistance (AMR) is a growing concern. Monitor antibiotic usage patterns 
                and ensure treatments follow veterinary guidance. Consider implementing antibiotic 
                stewardship programs to reduce unnecessary usage.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Seasonal Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Year-over-Year Change</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSeasonal ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="flex items-center gap-2">
                    {getChangeIcon(seasonal?.yearOverYearChange || null)}
                    <span className="text-2xl font-bold">
                      {seasonal?.yearOverYearChange ? `${seasonal.yearOverYearChange}%` : 'N/A'}
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Treatment volume change</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Peak Season</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSeasonal ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold capitalize">{seasonal?.peakSeason || 'N/A'}</div>
                )}
                <p className="text-xs text-muted-foreground">Highest treatment volume</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Data Period</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2 Years</div>
                <p className="text-xs text-muted-foreground">Historical analysis</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Seasonal Distribution</CardTitle>
                <CardDescription>Treatment volume by season (Southern Hemisphere)</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSeasonal ? (
                  <Skeleton className="h-32 w-full" />
                ) : !seasonal?.seasonalDistribution?.length ? (
                  <p className="text-muted-foreground text-center py-4">No data available</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {seasonal.seasonalDistribution.map((item, idx) => (
                      <div key={idx} className="p-4 border rounded-lg text-center">
                        <div className="text-sm text-muted-foreground capitalize">{item.season}</div>
                        <div className="text-2xl font-bold">{item.count}</div>
                        <div className="text-xs text-muted-foreground">treatments</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Yearly Comparison</CardTitle>
                <CardDescription>Total treatments by year</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSeasonal ? (
                  <Skeleton className="h-32 w-full" />
                ) : !seasonal?.yearlyTotals?.length ? (
                  <p className="text-muted-foreground text-center py-4">No data available</p>
                ) : (
                  <div className="space-y-3">
                    {seasonal.yearlyTotals.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="font-medium">{item.year}</span>
                        <div className="flex-1 mx-4">
                          <Progress 
                            value={(item.count / Math.max(...seasonal.yearlyTotals.map(y => y.count))) * 100}
                            className="h-3"
                          />
                        </div>
                        <span className="font-bold">{item.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Benchmarks Tab */}
        <TabsContent value="benchmarks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Industry Benchmarking</CardTitle>
              <CardDescription>Compare your farm metrics against industry standards</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingBenchmarks ? (
                <Skeleton className="h-64 w-full" />
              ) : !benchmarks?.comparison ? (
                <p className="text-muted-foreground text-center py-8">No benchmark data available</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(benchmarks.comparison).map(([key, data]) => {
                    const benchmark = benchmarks.industryBenchmarks[key];
                    const percentage = (data.value / data.benchmark) * 100;
                    return (
                      <div key={key} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-medium">{benchmark?.label || key}</div>
                            <div className="text-xs text-muted-foreground">
                              Industry benchmark: {data.benchmark}
                            </div>
                          </div>
                          {getStatusIcon(data.status)}
                        </div>
                        <div className="flex items-end gap-4">
                          <div>
                            <div className="text-3xl font-bold">
                              {typeof data.value === 'number' ? data.value.toFixed(2) : data.value}
                            </div>
                            <div className="text-xs text-muted-foreground">Your farm</div>
                          </div>
                          <div className="flex-1">
                            <Progress 
                              value={Math.min(percentage, 100)} 
                              className={`h-3 ${data.status === 'good' ? '[&>div]:bg-green-500' : '[&>div]:bg-orange-500'}`}
                            />
                            <div className="text-xs text-right text-muted-foreground mt-1">
                              {percentage.toFixed(0)}% of benchmark
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-5 w-5" />
                  Areas of Strength
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingBenchmarks ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <ul className="space-y-2 text-sm text-green-800">
                    {benchmarks?.comparison && Object.entries(benchmarks.comparison)
                      .filter(([_, data]) => data.status === 'good')
                      .map(([key]) => (
                        <li key={key} className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          {benchmarks.industryBenchmarks[key]?.label || key}
                        </li>
                      ))}
                    {(!benchmarks?.comparison || Object.entries(benchmarks.comparison).filter(([_, d]) => d.status === 'good').length === 0) && (
                      <li className="text-muted-foreground">Collect more data to identify strengths</li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="bg-orange-50 border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <AlertTriangle className="h-5 w-5" />
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingBenchmarks ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <ul className="space-y-2 text-sm text-orange-800">
                    {benchmarks?.comparison && Object.entries(benchmarks.comparison)
                      .filter(([_, data]) => data.status === 'attention')
                      .map(([key]) => (
                        <li key={key} className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          {benchmarks.industryBenchmarks[key]?.label || key}
                        </li>
                      ))}
                    {(!benchmarks?.comparison || Object.entries(benchmarks.comparison).filter(([_, d]) => d.status === 'attention').length === 0) && (
                      <li className="text-muted-foreground">All metrics within acceptable range</li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
