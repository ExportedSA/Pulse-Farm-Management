import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  BarChart3, PieChart, TrendingUp, Download, FileText, 
  Users, Skull, Scale, DollarSign, Calendar, Loader2
} from "lucide-react";

interface HerdComposition {
  total: number;
  byStatus: Record<string, number>;
  bySex: Record<string, number>;
  byBreed: Record<string, number>;
  byHerd: Record<string, number>;
  byAgeGroup: Record<string, number>;
  active: number;
  sold: number;
  deceased: number;
}

interface AgeDistribution {
  chartData: Array<{ label: string; count: number; percentage: number }>;
  stats: {
    averageAgeMonths: number;
    medianAgeMonths: number;
    oldestAnimal: any;
    youngestAnimal: any;
    totalWithDOB: number;
  };
  totalAnimals: number;
}

interface MortalityReport {
  summary: {
    totalDeaths: number;
    periodMonths: number;
    mortalityRate: number;
    annualizedRate: number;
    totalHerdSize: number;
  };
  byCause: Record<string, number>;
  byMonth: Record<string, number>;
  byBreed: Record<string, number>;
  byAgeGroup: Record<string, number>;
  recentDeaths: any[];
}

interface BreedPerformance {
  breeds: Array<{
    breed: string;
    count: number;
    avgWeight: number | null;
    avgBcs: string | null;
    treatmentsPerAnimal: string;
    calvingsPerCow: string;
  }>;
  totalBreeds: number;
  totalAnimals: number;
}

interface FinancialSummary {
  year: number;
  livestock: {
    openingStock: number;
    purchases: { count: number; value: number };
    sales: { count: number; value: number };
    births: { count: number };
    deaths: { count: number };
    closingStock: number;
  };
  byMonth: Array<{
    month: string;
    purchases: number;
    sales: number;
    purchaseValue: number;
    saleValue: number;
  }>;
}

export default function HerdReportsPage() {
  const [activeTab, setActiveTab] = useState("composition");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [mortalityMonths, setMortalityMonths] = useState("12");

  // Fetch herd composition
  const { data: composition, isLoading: loadingComposition } = useQuery<HerdComposition>({
    queryKey: ["/api/reports/herd/composition"],
    queryFn: async () => {
      const res = await fetch("/api/reports/herd/composition");
      if (!res.ok) throw new Error("Failed to fetch composition");
      return res.json();
    },
  });

  // Fetch age distribution
  const { data: ageDistribution, isLoading: loadingAge } = useQuery<AgeDistribution>({
    queryKey: ["/api/reports/herd/age-distribution"],
    queryFn: async () => {
      const res = await fetch("/api/reports/herd/age-distribution");
      if (!res.ok) throw new Error("Failed to fetch age distribution");
      return res.json();
    },
  });

  // Fetch mortality report
  const { data: mortality, isLoading: loadingMortality } = useQuery<MortalityReport>({
    queryKey: ["/api/reports/mortality", mortalityMonths],
    queryFn: async () => {
      const res = await fetch(`/api/reports/mortality?months=${mortalityMonths}`);
      if (!res.ok) throw new Error("Failed to fetch mortality");
      return res.json();
    },
  });

  // Fetch breed performance
  const { data: breedPerformance, isLoading: loadingBreed } = useQuery<BreedPerformance>({
    queryKey: ["/api/reports/breed-performance"],
    queryFn: async () => {
      const res = await fetch("/api/reports/breed-performance");
      if (!res.ok) throw new Error("Failed to fetch breed performance");
      return res.json();
    },
  });

  // Fetch financial summary
  const { data: financial, isLoading: loadingFinancial } = useQuery<FinancialSummary>({
    queryKey: ["/api/reports/financial/summary", selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/reports/financial/summary?year=${selectedYear}`);
      if (!res.ok) throw new Error("Failed to fetch financial summary");
      return res.json();
    },
  });

  // Export handlers
  const handleExport = async (type: string, format: string = 'csv') => {
    try {
      const url = type === 'accountant' 
        ? `/api/reports/export/accountant?year=${selectedYear}&format=${format}`
        : `/api/reports/export/csv?type=${type}&year=${selectedYear}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${type}_report_${selectedYear}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      toast.success("Report exported successfully");
    } catch (error) {
      toast.error("Failed to export report");
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-NZ', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Herd Reports & Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive herd analysis and export tools
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2025, 2024, 2023, 2022].map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => handleExport('accountant', 'csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export for Accountant
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">Total Herd</span>
            </div>
            <p className="text-3xl font-bold mt-2">{composition?.total || 0}</p>
            <p className="text-xs text-muted-foreground">{composition?.active || 0} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Skull className="h-5 w-5 text-red-500" />
              <span className="text-sm text-muted-foreground">Mortality Rate</span>
            </div>
            <p className="text-3xl font-bold mt-2">{mortality?.summary.mortalityRate || 0}%</p>
            <p className="text-xs text-muted-foreground">{mortality?.summary.totalDeaths || 0} deaths ({mortalityMonths}mo)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-muted-foreground">Avg Age</span>
            </div>
            <p className="text-3xl font-bold mt-2">
              {ageDistribution?.stats.averageAgeMonths 
                ? `${Math.floor(ageDistribution.stats.averageAgeMonths / 12)}y ${ageDistribution.stats.averageAgeMonths % 12}m`
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">{breedPerformance?.totalBreeds || 0} breeds</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Net Sales ({selectedYear})</span>
            </div>
            <p className="text-3xl font-bold mt-2">
              {financial ? formatCurrency((financial.livestock.sales.value || 0) - (financial.livestock.purchases.value || 0)) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {financial?.livestock.sales.count || 0} sold, {financial?.livestock.purchases.count || 0} bought
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="composition">Composition</TabsTrigger>
          <TabsTrigger value="age">Age Distribution</TabsTrigger>
          <TabsTrigger value="mortality">Mortality</TabsTrigger>
          <TabsTrigger value="breeds">Breed Performance</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
        </TabsList>

        {/* Composition Tab */}
        <TabsContent value="composition" className="mt-4">
          {loadingComposition ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* By Status */}
              <Card>
                <CardHeader>
                  <CardTitle>By Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(composition?.byStatus || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={status === 'active' ? 'default' : status === 'sold' ? 'secondary' : 'destructive'}>
                          {status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{count}</span>
                        <span className="text-xs text-muted-foreground">
                          ({composition?.total ? Math.round((count / composition.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* By Sex */}
              <Card>
                <CardHeader>
                  <CardTitle>By Sex</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(composition?.bySex || {}).map(([sex, count]) => (
                    <div key={sex} className="flex items-center justify-between">
                      <span className="capitalize">{sex}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={composition?.total ? (count / composition.total) * 100 : 0} className="w-24" />
                        <span className="font-bold w-12 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* By Age Group */}
              <Card>
                <CardHeader>
                  <CardTitle>By Age Group</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(composition?.byAgeGroup || {}).filter(([_, count]) => count > 0).map(([group, count]) => (
                    <div key={group} className="flex items-center justify-between">
                      <span className="capitalize">{group}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={composition?.active ? (count / composition.active) * 100 : 0} className="w-24" />
                        <span className="font-bold w-12 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* By Breed */}
              <Card>
                <CardHeader>
                  <CardTitle>By Breed</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(composition?.byBreed || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([breed, count]) => (
                    <div key={breed} className="flex items-center justify-between">
                      <span>{breed}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={composition?.total ? (count / composition.total) * 100 : 0} className="w-24" />
                        <span className="font-bold w-12 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => handleExport('herd')}>
              <Download className="h-4 w-4 mr-2" />
              Export Herd List
            </Button>
          </div>
        </TabsContent>

        {/* Age Distribution Tab */}
        <TabsContent value="age" className="mt-4">
          {loadingAge ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Age Chart */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Age Distribution Chart</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {ageDistribution?.chartData.map((bucket) => (
                      <div key={bucket.label} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{bucket.label}</span>
                          <span className="font-medium">{bucket.count} ({bucket.percentage}%)</span>
                        </div>
                        <Progress value={bucket.percentage} className="h-6" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Age Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Age Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Average Age</p>
                    <p className="text-2xl font-bold">
                      {ageDistribution?.stats.averageAgeMonths 
                        ? `${Math.floor(ageDistribution.stats.averageAgeMonths / 12)} years ${ageDistribution.stats.averageAgeMonths % 12} months`
                        : "—"}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Median Age</p>
                    <p className="text-xl font-bold">
                      {ageDistribution?.stats.medianAgeMonths 
                        ? `${Math.floor(ageDistribution.stats.medianAgeMonths / 12)}y ${ageDistribution.stats.medianAgeMonths % 12}m`
                        : "—"}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Oldest Animal</p>
                    <p className="font-medium">
                      {ageDistribution?.stats.oldestAnimal?.cowId || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ageDistribution?.stats.oldestAnimal?.ageMonths 
                        ? `${Math.floor(ageDistribution.stats.oldestAnimal.ageMonths / 12)} years old`
                        : ""}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Youngest Animal</p>
                    <p className="font-medium">
                      {ageDistribution?.stats.youngestAnimal?.cowId || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ageDistribution?.stats.youngestAnimal?.ageMonths !== undefined
                        ? `${ageDistribution.stats.youngestAnimal.ageMonths} months old`
                        : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Mortality Tab */}
        <TabsContent value="mortality" className="mt-4">
          <div className="flex justify-end mb-4">
            <Select value={mortalityMonths} onValueChange={setMortalityMonths}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
                <SelectItem value="24">Last 24 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {loadingMortality ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Mortality Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-3xl font-bold text-red-600">{mortality?.summary.totalDeaths || 0}</p>
                      <p className="text-sm text-muted-foreground">Total Deaths</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-3xl font-bold">{mortality?.summary.mortalityRate || 0}%</p>
                      <p className="text-sm text-muted-foreground">Mortality Rate</p>
                    </div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{mortality?.summary.annualizedRate || 0}%</p>
                    <p className="text-sm text-muted-foreground">Annualized Rate</p>
                  </div>
                </CardContent>
              </Card>

              {/* By Cause */}
              <Card>
                <CardHeader>
                  <CardTitle>Deaths by Cause</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(mortality?.byCause || {}).sort((a, b) => b[1] - a[1]).map(([cause, count]) => (
                    <div key={cause} className="flex items-center justify-between">
                      <span>{cause}</span>
                      <Badge variant="destructive">{count}</Badge>
                    </div>
                  ))}
                  {Object.keys(mortality?.byCause || {}).length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No deaths recorded</p>
                  )}
                </CardContent>
              </Card>

              {/* By Age Group */}
              <Card>
                <CardHeader>
                  <CardTitle>Deaths by Age Group</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(mortality?.byAgeGroup || {}).map(([group, count]) => (
                    <div key={group} className="flex items-center justify-between">
                      <span>{group}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent Deaths */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Deaths</CardTitle>
                </CardHeader>
                <CardContent>
                  {mortality?.recentDeaths.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No recent deaths</p>
                  ) : (
                    <div className="space-y-2">
                      {mortality?.recentDeaths.slice(0, 5).map((death) => (
                        <div key={death.id} className="flex justify-between items-center p-2 bg-muted rounded">
                          <div>
                            <p className="font-medium">{death.causeOfDeath || 'Unknown cause'}</p>
                            <p className="text-xs text-muted-foreground">{death.deathDate}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => handleExport('mortality')}>
              <Download className="h-4 w-4 mr-2" />
              Export Mortality Records
            </Button>
          </div>
        </TabsContent>

        {/* Breed Performance Tab */}
        <TabsContent value="breeds" className="mt-4">
          {loadingBreed ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Breed Performance Comparison</CardTitle>
                <CardDescription>
                  Compare key metrics across {breedPerformance?.totalBreeds || 0} breeds
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Breed</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Avg Weight (kg)</TableHead>
                      <TableHead className="text-right">Avg BCS</TableHead>
                      <TableHead className="text-right">Treatments/Animal</TableHead>
                      <TableHead className="text-right">Calvings/Cow</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breedPerformance?.breeds.map((breed) => (
                      <TableRow key={breed.breed}>
                        <TableCell className="font-medium">{breed.breed}</TableCell>
                        <TableCell className="text-right">{breed.count}</TableCell>
                        <TableCell className="text-right">{breed.avgWeight || "—"}</TableCell>
                        <TableCell className="text-right">{breed.avgBcs || "—"}</TableCell>
                        <TableCell className="text-right">{breed.treatmentsPerAnimal}</TableCell>
                        <TableCell className="text-right">{breed.calvingsPerCow}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="mt-4">
          {loadingFinancial ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
          ) : (
            <div className="space-y-6">
              {/* Stock Reconciliation */}
              <Card>
                <CardHeader>
                  <CardTitle>Livestock Stock Reconciliation - {selectedYear}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{financial?.livestock.openingStock || 0}</p>
                      <p className="text-xs text-muted-foreground">Opening Stock</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">+{financial?.livestock.purchases.count || 0}</p>
                      <p className="text-xs text-muted-foreground">Purchases</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">+{financial?.livestock.births.count || 0}</p>
                      <p className="text-xs text-muted-foreground">Births</p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">-{financial?.livestock.sales.count || 0}</p>
                      <p className="text-xs text-muted-foreground">Sales</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">-{financial?.livestock.deaths.count || 0}</p>
                      <p className="text-xs text-muted-foreground">Deaths</p>
                    </div>
                    <div className="text-center p-4 bg-primary/10 rounded-lg">
                      <p className="text-2xl font-bold">{financial?.livestock.closingStock || 0}</p>
                      <p className="text-xs text-muted-foreground">Closing Stock</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-green-600">Purchases</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{formatCurrency(financial?.livestock.purchases.value || 0)}</p>
                    <p className="text-sm text-muted-foreground">{financial?.livestock.purchases.count || 0} head purchased</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-blue-600">Sales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{formatCurrency(financial?.livestock.sales.value || 0)}</p>
                    <p className="text-sm text-muted-foreground">{financial?.livestock.sales.count || 0} head sold</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Net Position</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-3xl font-bold ${(financial?.livestock.sales.value || 0) - (financial?.livestock.purchases.value || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency((financial?.livestock.sales.value || 0) - (financial?.livestock.purchases.value || 0))}
                    </p>
                    <p className="text-sm text-muted-foreground">Sales minus purchases</p>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Purchases</TableHead>
                        <TableHead className="text-right">Purchase Value</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="text-right">Sale Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {financial?.byMonth.map((month) => (
                        <TableRow key={month.month}>
                          <TableCell>{month.month}</TableCell>
                          <TableCell className="text-right">{month.purchases}</TableCell>
                          <TableCell className="text-right">{formatCurrency(month.purchaseValue)}</TableCell>
                          <TableCell className="text-right">{month.sales}</TableCell>
                          <TableCell className="text-right">{formatCurrency(month.saleValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleExport('transactions')}>
              <Download className="h-4 w-4 mr-2" />
              Export Transactions
            </Button>
            <Button onClick={() => handleExport('accountant', 'csv')}>
              <FileText className="h-4 w-4 mr-2" />
              Full Accountant Report
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
