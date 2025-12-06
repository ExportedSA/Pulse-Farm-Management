import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Droplets, 
  Plus, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Thermometer,
  CheckCircle,
  Activity,
  Calendar,
  DollarSign,
  BarChart3,
  Target,
  Trash2
} from 'lucide-react';

interface MilkRecord {
  id: string;
  date: string;
  herdId: string | null;
  totalVolume: string;
  averageFat: string | null;
  averageProtein: string | null;
  averageSomaticCellCount: string | null;
  milkPrice: string | null;
  totalValue: string | null;
  milkingTime: string | null;
  temperature: string | null;
  notes: string | null;
  createdAt: string;
}

interface MilkQualityAlert {
  id: string;
  date: string;
  alertType: string;
  severity: string;
  message: string;
  value: string | null;
  threshold: string | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
}

const MILKING_TIMES = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'combined', label: 'Combined (24h)' },
];

const ALERT_SEVERITY_COLORS = {
  low: 'bg-yellow-100 text-yellow-800',
  medium: 'bg-orange-100 text-orange-800',
  high: 'bg-red-100 text-red-800',
  critical: 'bg-red-200 text-red-900',
};

export default function MilkProductionPage() {
  const queryClient = useQueryClient();
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split('T')[0],
    totalVolume: '',
    averageFat: '',
    averageProtein: '',
    averageSomaticCellCount: '',
    milkPrice: '0.85',
    milkingTime: 'combined',
    temperature: '',
    notes: '',
  });

  // Fetch milk records
  const { data: records = [] } = useQuery<MilkRecord[]>({
    queryKey: ['milkRecords'],
    queryFn: async () => {
      const response = await fetch('/api/milk/records?limit=30');
      if (!response.ok) throw new Error('Failed to fetch milk records');
      return response.json();
    },
  });

  // Fetch milk summary
  const { data: summary } = useQuery({
    queryKey: ['milkSummary'],
    queryFn: async () => {
      const response = await fetch('/api/milk/summary');
      if (!response.ok) throw new Error('Failed to fetch milk summary');
      return response.json();
    },
  });

  // Fetch milk trends
  const { data: trends = [] } = useQuery({
    queryKey: ['milkTrends'],
    queryFn: async () => {
      const response = await fetch('/api/milk/trends?days=30');
      if (!response.ok) throw new Error('Failed to fetch milk trends');
      return response.json();
    },
  });

  // Fetch quality alerts
  const { data: alerts = [] } = useQuery<MilkQualityAlert[]>({
    queryKey: ['milkAlerts'],
    queryFn: async () => {
      const response = await fetch('/api/milk/alerts?acknowledged=false&limit=10');
      if (!response.ok) throw new Error('Failed to fetch milk quality alerts');
      return response.json();
    },
  });

  // Create milk record mutation
  const createRecordMutation = useMutation({
    mutationFn: async (data: typeof newRecord) => {
      const processedData = {
        ...data,
        totalVolume: parseFloat(data.totalVolume) || 0,
        averageFat: data.averageFat ? parseFloat(data.averageFat) : null,
        averageProtein: data.averageProtein ? parseFloat(data.averageProtein) : null,
        averageSomaticCellCount: data.averageSomaticCellCount ? parseInt(data.averageSomaticCellCount) : null,
        milkPrice: data.milkPrice ? parseFloat(data.milkPrice) : null,
        temperature: data.temperature ? parseFloat(data.temperature) : null,
      };
      
      const response = await fetch('/api/milk/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processedData),
      });
      if (!response.ok) throw new Error('Failed to create milk record');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milkRecords'] });
      queryClient.invalidateQueries({ queryKey: ['milkSummary'] });
      queryClient.invalidateQueries({ queryKey: ['milkAlerts'] });
      setIsRecordDialogOpen(false);
      setNewRecord({
        date: new Date().toISOString().split('T')[0],
        totalVolume: '',
        averageFat: '',
        averageProtein: '',
        averageSomaticCellCount: '',
        milkPrice: '0.85',
        milkingTime: 'combined',
        temperature: '',
        notes: '',
      });
    },
  });

  // Acknowledge alert mutation
  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/milk/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'current-user' }),
      });
      if (!response.ok) throw new Error('Failed to acknowledge alert');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milkAlerts'] });
    },
  });

  const formatVolume = (value: string | number | null) => {
    if (!value) return '0 L';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `${num.toFixed(1)} L`;
  };

  const formatPercentage = (value: string | number | null) => {
    if (!value) return '0.0%';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `${num.toFixed(2)}%`;
  };

  const formatScc = (value: string | number | null) => {
    if (!value) return '0';
    const num = typeof value === 'string' ? parseInt(value) : value;
    return num.toLocaleString();
  };

  const formatCurrency = (value: string | number | null) => {
    if (!value) return '$0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(num);
  };

  const getMilkingTimeLabel = (time: string | null) => {
    const option = MILKING_TIMES.find(t => t.value === time);
    return option?.label || time || 'Unknown';
  };

  const getAlertTypeLabel = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Milk Production</h1>
          <p className="text-muted-foreground">Track milk volume, quality, and production metrics</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Volume</p>
                <p className="text-2xl font-bold text-blue-600">{formatVolume(summary?.totalVolume)}</p>
              </div>
              <Droplets className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average Fat</p>
                <p className="text-2xl font-bold text-green-600">{formatPercentage(summary?.averageFat)}</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg SCC</p>
                <p className="text-2xl font-bold text-orange-600">{formatScc(summary?.averageScc)}</p>
              </div>
              <Activity className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(summary?.totalValue)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quality Alerts */}
      {alerts.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Quality Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={ALERT_SEVERITY_COLORS[alert.severity as keyof typeof ALERT_SEVERITY_COLORS]}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                    <div>
                      <p className="font-medium">{getAlertTypeLabel(alert.alertType)}</p>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Acknowledge
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="records" className="space-y-4">
        <TabsList>
          <TabsTrigger value="records">Milk Records</TabsTrigger>
          <TabsTrigger value="trends">Production Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Milk Records</h2>
            <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Record Milk
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Record Milk Production</DialogTitle>
                  <DialogDescription>Enter today's milk production data</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="milkDate">Date</Label>
                      <Input
                        id="milkDate"
                        type="date"
                        value={newRecord.date}
                        onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Milking Time</Label>
                      <Select
                        value={newRecord.milkingTime}
                        onValueChange={(value) => setNewRecord({ ...newRecord, milkingTime: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MILKING_TIMES.map((time) => (
                            <SelectItem key={time.value} value={time.value}>
                              {time.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="totalVolume">Total Volume (Litres)</Label>
                      <Input
                        id="totalVolume"
                        type="number"
                        step="0.1"
                        value={newRecord.totalVolume}
                        onChange={(e) => setNewRecord({ ...newRecord, totalVolume: e.target.value })}
                        placeholder="0.0"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="temperature">Temperature (°C)</Label>
                      <Input
                        id="temperature"
                        type="number"
                        step="0.1"
                        value={newRecord.temperature}
                        onChange={(e) => setNewRecord({ ...newRecord, temperature: e.target.value })}
                        placeholder="4.0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="averageFat">Fat (%)</Label>
                      <Input
                        id="averageFat"
                        type="number"
                        step="0.01"
                        value={newRecord.averageFat}
                        onChange={(e) => setNewRecord({ ...newRecord, averageFat: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="averageProtein">Protein (%)</Label>
                      <Input
                        id="averageProtein"
                        type="number"
                        step="0.01"
                        value={newRecord.averageProtein}
                        onChange={(e) => setNewRecord({ ...newRecord, averageProtein: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="averageSomaticCellCount">SCC (cells/ml)</Label>
                      <Input
                        id="averageSomaticCellCount"
                        type="number"
                        value={newRecord.averageSomaticCellCount}
                        onChange={(e) => setNewRecord({ ...newRecord, averageSomaticCellCount: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="milkPrice">Milk Price ($/L)</Label>
                    <Input
                      id="milkPrice"
                      type="number"
                      step="0.01"
                      value={newRecord.milkPrice}
                      onChange={(e) => setNewRecord({ ...newRecord, milkPrice: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="milkNotes">Notes</Label>
                    <Textarea
                      id="milkNotes"
                      value={newRecord.notes}
                      onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRecordDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createRecordMutation.mutate(newRecord)}
                    disabled={!newRecord.totalVolume || createRecordMutation.isPending}
                  >
                    {createRecordMutation.isPending ? 'Saving...' : 'Save Record'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              {records.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Droplets className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No milk records found</p>
                  <p className="text-sm">Record your first milk production to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {records.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Droplets className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-medium">{formatVolume(record.totalVolume)} - {getMilkingTimeLabel(record.milkingTime)}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{new Date(record.date).toLocaleDateString()}</span>
                            {record.averageFat && (
                              <>
                                <span>•</span>
                                <span>Fat: {formatPercentage(record.averageFat)}</span>
                              </>
                            )}
                            {record.averageProtein && (
                              <>
                                <span>•</span>
                                <span>Protein: {formatPercentage(record.averageProtein)}</span>
                              </>
                            )}
                            {record.averageSomaticCellCount && (
                              <>
                                <span>•</span>
                                <span>SCC: {formatScc(record.averageSomaticCellCount)}</span>
                              </>
                            )}
                            {record.temperature && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Thermometer className="h-3 w-3" />
                                  {record.temperature}°C
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-green-600">
                          {formatCurrency(record.totalValue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>30-Day Production Trends</CardTitle>
              <CardDescription>Daily milk volume and quality metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {trends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trend data available</p>
                  <p className="text-sm">Record some milk production to see trends</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-64 flex items-center justify-center border rounded-lg bg-muted/20">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Chart visualization coming soon</p>
                      <p className="text-sm text-muted-foreground">
                        {trends.length} data points available
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Average Daily Volume</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatVolume(summary?.averageVolume)}
                      </p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Quality Score</p>
                      <p className="text-2xl font-bold text-green-600">
                        {summary?.averageFat && summary?.averageProtein 
                          ? ((parseFloat(summary.averageFat) + parseFloat(summary.averageProtein)) / 2).toFixed(2)
                          : '0.00'
                        }%
                      </p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Price per Litre</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {summary?.totalValue && summary?.totalVolume 
                          ? formatCurrency(parseFloat(summary.totalValue) / parseFloat(summary.totalVolume))
                          : '$0.00'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
