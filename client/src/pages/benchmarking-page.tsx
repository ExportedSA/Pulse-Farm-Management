import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, TrendingUp, TrendingDown, Target, Award, 
  Users, Droplets, Heart, Scale, DollarSign, AlertTriangle,
  CheckCircle2, ArrowUp, ArrowDown, Minus, Info
} from "lucide-react";
import type { Animal, AnimalTreatment, WeightRecord } from "@shared/schema";

// Industry benchmarks for NZ dairy/beef farming
const INDUSTRY_BENCHMARKS = {
  dairy: {
    milkProduction: { value: 4500, unit: "L/cow/year", label: "Milk Production" },
    somaticCellCount: { value: 150000, unit: "cells/mL", label: "Somatic Cell Count", lowerIsBetter: true },
    calvingRate: { value: 90, unit: "%", label: "Calving Rate" },
    reproductionRate: { value: 78, unit: "%", label: "6-Week In-Calf Rate" },
    emptyRate: { value: 10, unit: "%", label: "Empty Rate", lowerIsBetter: true },
    treatmentRate: { value: 15, unit: "%", label: "Treatment Rate", lowerIsBetter: true },
    mortalityRate: { value: 3, unit: "%", label: "Mortality Rate", lowerIsBetter: true },
    lamenessRate: { value: 5, unit: "%", label: "Lameness Rate", lowerIsBetter: true },
    mastitisRate: { value: 8, unit: "%", label: "Mastitis Rate", lowerIsBetter: true },
    bodyConditionScore: { value: 5.0, unit: "BCS", label: "Avg Body Condition" },
    replacementRate: { value: 22, unit: "%", label: "Replacement Rate" },
    costPerKgMS: { value: 4.50, unit: "$/kg MS", label: "Cost per kg Milksolids", lowerIsBetter: true },
  },
  beef: {
    weaningWeight: { value: 250, unit: "kg", label: "Weaning Weight" },
    averageDailyGain: { value: 1.2, unit: "kg/day", label: "Average Daily Gain" },
    calvingRate: { value: 92, unit: "%", label: "Calving Rate" },
    weaningRate: { value: 88, unit: "%", label: "Weaning Rate" },
    mortalityRate: { value: 2, unit: "%", label: "Mortality Rate", lowerIsBetter: true },
    treatmentRate: { value: 10, unit: "%", label: "Treatment Rate", lowerIsBetter: true },
    bodyConditionScore: { value: 3.0, unit: "BCS (1-5)", label: "Avg Body Condition" },
    daysToFinish: { value: 450, unit: "days", label: "Days to Finish", lowerIsBetter: true },
    carcassWeight: { value: 300, unit: "kg", label: "Avg Carcass Weight" },
    killoutPercent: { value: 54, unit: "%", label: "Kill-out %" },
  },
};

// Performance rating thresholds
const getPerformanceRating = (actual: number, benchmark: number, lowerIsBetter: boolean = false) => {
  const ratio = lowerIsBetter ? benchmark / actual : actual / benchmark;
  if (ratio >= 1.1) return { rating: "excellent", color: "text-green-600", bg: "bg-green-100" };
  if (ratio >= 0.95) return { rating: "good", color: "text-blue-600", bg: "bg-blue-100" };
  if (ratio >= 0.8) return { rating: "average", color: "text-yellow-600", bg: "bg-yellow-100" };
  return { rating: "below", color: "text-red-600", bg: "bg-red-100" };
};

export default function BenchmarkingPage() {
  const [farmType, setFarmType] = useState<"dairy" | "beef">("dairy");
  const [timeRange, setTimeRange] = useState("12months");

  // Fetch animals
  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
    queryFn: async () => {
      const res = await fetch("/api/animals");
      if (!res.ok) throw new Error("Failed to fetch animals");
      return res.json();
    },
  });

  // Fetch treatments
  const { data: treatments = [] } = useQuery<AnimalTreatment[]>({
    queryKey: ["/api/treatments"],
    queryFn: async () => {
      const res = await fetch("/api/treatments");
      if (!res.ok) throw new Error("Failed to fetch treatments");
      return res.json();
    },
  });

  // Fetch weight records
  const { data: weightRecords = [] } = useQuery<WeightRecord[]>({
    queryKey: ["/api/weight/records"],
    queryFn: async () => {
      const res = await fetch("/api/weight/records");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch health scores
  const { data: healthScores = [] } = useQuery({
    queryKey: ["/api/health-monitoring/scores"],
    queryFn: async () => {
      const res = await fetch("/api/health-monitoring/scores");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch mortality records
  const { data: mortalityRecords = [] } = useQuery({
    queryKey: ["/api/health-monitoring/mortality"],
    queryFn: async () => {
      const res = await fetch("/api/health-monitoring/mortality");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Calculate farm metrics
  const totalAnimals = animals.filter(a => a.status === "active").length;
  const treatedAnimals = new Set(treatments.map(t => t.animalId)).size;
  const treatmentRate = totalAnimals > 0 ? (treatedAnimals / totalAnimals) * 100 : 0;
  const mortalityRate = totalAnimals > 0 ? (mortalityRecords.length / (totalAnimals + mortalityRecords.length)) * 100 : 0;
  
  // Calculate average BCS
  const avgBCS = healthScores.length > 0 
    ? healthScores.reduce((sum: number, s: any) => sum + (parseFloat(s.bodyConditionScore) || 0), 0) / healthScores.length
    : 0;

  // Calculate lameness rate (animals with lameness score > 2)
  const lameAnimals = healthScores.filter((s: any) => parseInt(s.lamenessScore) > 2).length;
  const lamenessRate = totalAnimals > 0 ? (lameAnimals / totalAnimals) * 100 : 0;

  // Calculate mastitis rate (treatments for mastitis)
  const mastitisTreatments = treatments.filter(t => 
    t.condition?.toLowerCase().includes("mastitis")
  );
  const mastitisRate = totalAnimals > 0 ? (new Set(mastitisTreatments.map(t => t.animalId)).size / totalAnimals) * 100 : 0;

  // Calculate average daily gain from weight records
  const avgDailyGain = weightRecords.length > 0 
    ? weightRecords.reduce((sum: number, w: any) => sum + (parseFloat(w.averageDailyGain) || 0), 0) / weightRecords.length
    : 0;

  // Build farm metrics object
  const farmMetrics: Record<string, number> = {
    treatmentRate,
    mortalityRate,
    bodyConditionScore: avgBCS,
    lamenessRate,
    mastitisRate,
    averageDailyGain: avgDailyGain,
    // Placeholder values - in production these would come from actual data
    milkProduction: 4200,
    somaticCellCount: 180000,
    calvingRate: 88,
    reproductionRate: 75,
    emptyRate: 12,
    replacementRate: 20,
    costPerKgMS: 4.80,
    weaningWeight: 240,
    weaningRate: 85,
    daysToFinish: 480,
    carcassWeight: 290,
    killoutPercent: 52,
  };

  const benchmarks = INDUSTRY_BENCHMARKS[farmType] as Record<string, { value: number; unit: string; label: string; lowerIsBetter?: boolean }>;

  // Calculate overall performance score
  const calculateOverallScore = () => {
    const metrics = Object.entries(benchmarks);
    let totalScore = 0;
    let count = 0;

    metrics.forEach(([key, benchmark]) => {
      const actual = farmMetrics[key];
      if (actual !== undefined && actual > 0) {
        const ratio = benchmark.lowerIsBetter 
          ? benchmark.value / actual 
          : actual / benchmark.value;
        totalScore += Math.min(ratio, 1.5) * 100; // Cap at 150%
        count++;
      }
    });

    return count > 0 ? Math.round(totalScore / count) : 0;
  };

  const overallScore = calculateOverallScore();

  // Render metric comparison card
  const MetricCard = ({ 
    metricKey, 
    benchmark 
  }: { 
    metricKey: string; 
    benchmark: { value: number; unit: string; label: string; lowerIsBetter?: boolean } 
  }) => {
    const actual = farmMetrics[metricKey];
    const hasData = actual !== undefined && actual > 0;
    const performance = hasData 
      ? getPerformanceRating(actual, benchmark.value, benchmark.lowerIsBetter)
      : { rating: "no-data", color: "text-gray-400", bg: "bg-gray-100" };
    
    const percentOfBenchmark = hasData 
      ? benchmark.lowerIsBetter 
        ? (benchmark.value / actual) * 100
        : (actual / benchmark.value) * 100
      : 0;

    const diff = hasData ? actual - benchmark.value : 0;
    const diffPercent = hasData ? ((diff / benchmark.value) * 100).toFixed(1) : 0;

    return (
      <Card className={`${performance.bg} border-l-4 ${
        performance.rating === "excellent" ? "border-l-green-500" :
        performance.rating === "good" ? "border-l-blue-500" :
        performance.rating === "average" ? "border-l-yellow-500" :
        performance.rating === "below" ? "border-l-red-500" : "border-l-gray-300"
      }`}>
        <CardContent className="pt-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{benchmark.label}</p>
              <p className={`text-2xl font-bold ${performance.color}`}>
                {hasData ? (
                  metricKey.includes("Rate") || metricKey.includes("Percent") 
                    ? `${actual.toFixed(1)}%`
                    : actual.toFixed(metricKey === "somaticCellCount" ? 0 : 1)
                ) : "—"}
              </p>
            </div>
            <Badge variant="outline" className={performance.color}>
              {performance.rating === "excellent" && <Award className="h-3 w-3 mr-1" />}
              {performance.rating.charAt(0).toUpperCase() + performance.rating.slice(1)}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Industry Benchmark</span>
              <span className="font-medium">
                {benchmark.value} {benchmark.unit}
              </span>
            </div>
            
            {hasData && (
              <>
                <Progress 
                  value={Math.min(percentOfBenchmark, 150)} 
                  className="h-2"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className={`flex items-center gap-1 ${
                    (benchmark.lowerIsBetter ? diff < 0 : diff > 0) 
                      ? "text-green-600" 
                      : diff === 0 
                        ? "text-gray-500"
                        : "text-red-600"
                  }`}>
                    {diff > 0 ? <ArrowUp className="h-3 w-3" /> : 
                     diff < 0 ? <ArrowDown className="h-3 w-3" /> : 
                     <Minus className="h-3 w-3" />}
                    {Math.abs(diff).toFixed(1)} {benchmark.unit} ({diffPercent}%)
                  </span>
                  <span className="text-muted-foreground">
                    {percentOfBenchmark.toFixed(0)}% of benchmark
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-indigo-600" />
            Farm Benchmarking
          </h1>
          <p className="text-muted-foreground mt-1">
            Compare your farm performance against industry standards
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={farmType} onValueChange={(v) => setFarmType(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dairy">Dairy</SelectItem>
              <SelectItem value="beef">Beef</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="12months">Last 12 Months</SelectItem>
              <SelectItem value="alltime">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overall Performance Score */}
      <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100">Overall Performance Score</p>
              <p className="text-5xl font-bold mt-2">{overallScore}%</p>
              <p className="text-indigo-200 mt-1">
                {overallScore >= 100 ? "Exceeding industry benchmarks" :
                 overallScore >= 90 ? "Meeting industry standards" :
                 overallScore >= 75 ? "Room for improvement" :
                 "Below industry standards"}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{totalAnimals}</p>
                  <p className="text-indigo-200 text-sm">Total Animals</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold">{treatments.length}</p>
                  <p className="text-indigo-200 text-sm">Treatments</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Treatment Rate</p>
                <p className="text-2xl font-bold">{treatmentRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">
                  Benchmark: {benchmarks.treatmentRate?.value || 15}%
                </p>
              </div>
              <Heart className={`h-8 w-8 ${
                treatmentRate <= (benchmarks.treatmentRate?.value || 15) 
                  ? "text-green-500" : "text-red-500"
              }`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Mortality Rate</p>
                <p className="text-2xl font-bold">{mortalityRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">
                  Benchmark: {benchmarks.mortalityRate?.value || 3}%
                </p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${
                mortalityRate <= (benchmarks.mortalityRate?.value || 3) 
                  ? "text-green-500" : "text-red-500"
              }`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Body Condition</p>
                <p className="text-2xl font-bold">{avgBCS > 0 ? avgBCS.toFixed(1) : "—"}</p>
                <p className="text-xs text-muted-foreground">
                  Benchmark: {benchmarks.bodyConditionScore?.value || 5.0}
                </p>
              </div>
              <Scale className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Herd Size</p>
                <p className="text-2xl font-bold">{totalAnimals}</p>
                <p className="text-xs text-muted-foreground">
                  Active animals
                </p>
              </div>
              <Users className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Benchmarks */}
      <Tabs defaultValue="health" className="space-y-4">
        <TabsList>
          <TabsTrigger value="health">Health & Welfare</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="reproduction">Reproduction</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard metricKey="treatmentRate" benchmark={benchmarks.treatmentRate} />
            <MetricCard metricKey="mortalityRate" benchmark={benchmarks.mortalityRate} />
            <MetricCard metricKey="bodyConditionScore" benchmark={benchmarks.bodyConditionScore} />
            {farmType === "dairy" && (
              <>
                <MetricCard metricKey="lamenessRate" benchmark={benchmarks.lamenessRate} />
                <MetricCard metricKey="mastitisRate" benchmark={benchmarks.mastitisRate} />
                <MetricCard metricKey="somaticCellCount" benchmark={benchmarks.somaticCellCount} />
              </>
            )}
            {farmType === "beef" && (
              <MetricCard metricKey="averageDailyGain" benchmark={benchmarks.averageDailyGain} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="production" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {farmType === "dairy" ? (
              <>
                <MetricCard metricKey="milkProduction" benchmark={benchmarks.milkProduction} />
                <MetricCard metricKey="somaticCellCount" benchmark={benchmarks.somaticCellCount} />
              </>
            ) : (
              <>
                <MetricCard metricKey="weaningWeight" benchmark={benchmarks.weaningWeight} />
                <MetricCard metricKey="averageDailyGain" benchmark={benchmarks.averageDailyGain} />
                <MetricCard metricKey="daysToFinish" benchmark={benchmarks.daysToFinish} />
                <MetricCard metricKey="carcassWeight" benchmark={benchmarks.carcassWeight} />
                <MetricCard metricKey="killoutPercent" benchmark={benchmarks.killoutPercent} />
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="reproduction" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard metricKey="calvingRate" benchmark={benchmarks.calvingRate} />
            {farmType === "dairy" ? (
              <>
                <MetricCard metricKey="reproductionRate" benchmark={benchmarks.reproductionRate} />
                <MetricCard metricKey="emptyRate" benchmark={benchmarks.emptyRate} />
                <MetricCard metricKey="replacementRate" benchmark={benchmarks.replacementRate} />
              </>
            ) : (
              <MetricCard metricKey="weaningRate" benchmark={benchmarks.weaningRate} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {farmType === "dairy" && (
              <MetricCard metricKey="costPerKgMS" benchmark={benchmarks.costPerKgMS} />
            )}
          </div>
          
          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Financial Performance Summary
              </CardTitle>
              <CardDescription>
                Cost and revenue benchmarks for your operation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Treatment Costs</p>
                    <p className="text-sm text-muted-foreground">
                      Based on {treatments.length} treatments recorded
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      ${treatments.reduce((sum, t) => sum + (parseFloat(t.totalCost as any) || 0), 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total treatment costs</p>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Benchmark Insights</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Industry benchmarks are based on DairyNZ and Beef + Lamb NZ data. 
                        Your actual performance may vary based on region, farm system, and seasonal conditions.
                        Connect more data sources for accurate benchmarking.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Improvement Recommendations
          </CardTitle>
          <CardDescription>
            Areas where your farm can improve based on benchmark analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {treatmentRate > (benchmarks.treatmentRate?.value || 15) && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">High Treatment Rate</p>
                  <p className="text-sm text-yellow-700">
                    Your treatment rate ({treatmentRate.toFixed(1)}%) is above the industry benchmark. 
                    Consider reviewing preventive health protocols and identifying common conditions.
                  </p>
                </div>
              </div>
            )}
            
            {mortalityRate > (benchmarks.mortalityRate?.value || 3) && (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Elevated Mortality Rate</p>
                  <p className="text-sm text-red-700">
                    Your mortality rate ({mortalityRate.toFixed(1)}%) exceeds the benchmark. 
                    Review mortality causes and implement targeted prevention strategies.
                  </p>
                </div>
              </div>
            )}

            {treatmentRate <= (benchmarks.treatmentRate?.value || 15) && 
             mortalityRate <= (benchmarks.mortalityRate?.value || 3) && (
              <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">Good Performance</p>
                  <p className="text-sm text-green-700">
                    Your key health metrics are meeting or exceeding industry benchmarks. 
                    Continue current management practices and monitor for any changes.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800">Data Quality</p>
                <p className="text-sm text-blue-700">
                  For more accurate benchmarking, ensure all treatments, health scores, and 
                  production data are recorded consistently. More data leads to better insights.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
