import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { format, formatDistanceToNow } from "date-fns";
import { 
  Bell, AlertTriangle, CheckCircle, Clock, Pill, Syringe, 
  Baby, Heart, Calendar, X, RefreshCw, Filter, Check,
  Stethoscope, FlaskConical, Thermometer
} from "lucide-react";

type Alert = {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  animalId: string | null;
  treatmentId: string | null;
  title: string;
  message: string;
  metadata: Record<string, any> | null;
  createdAt: string;
  dismissedAt: string | null;
};

type AlertSummary = {
  total: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byType: Record<string, number>;
};

export default function AlertsNotificationsDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);

  // Fetch alerts
  const { data: alerts = [], isLoading: loadingAlerts, refetch } = useQuery<Alert[]>({
    queryKey: ["/api/alerts", filter, severityFilter],
    queryFn: async () => {
      let url = "/api/alerts?limit=100";
      if (filter !== "all") url += `&type=${filter}`;
      if (severityFilter !== "all") url += `&severity=${severityFilter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch summary
  const { data: summary } = useQuery<AlertSummary>({
    queryKey: ["/api/alerts/summary"],
    queryFn: async () => {
      const res = await fetch("/api/alerts/summary");
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  // Generate alerts mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/alerts/generate", { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate alerts");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast.success(`Generated ${data.total} new alerts`);
    },
    onError: () => toast.error("Failed to generate alerts"),
  });

  // Dismiss alert mutation
  const dismissMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch(`/api/alerts/${alertId}/dismiss`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });
      if (!res.ok) throw new Error("Failed to dismiss alert");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast.success("Alert dismissed");
    },
    onError: () => toast.error("Failed to dismiss alert"),
  });

  // Dismiss all mutation
  const dismissAllMutation = useMutation({
    mutationFn: async (type?: string) => {
      const res = await fetch("/api/alerts/dismiss-all", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, type }),
      });
      if (!res.ok) throw new Error("Failed to dismiss alerts");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setSelectedAlerts([]);
      toast.success("Alerts dismissed");
    },
    onError: () => toast.error("Failed to dismiss alerts"),
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertIcon = (type: string) => {
    if (type.includes('treatment')) return <Pill className="h-4 w-4" />;
    if (type.includes('withholding')) return <Clock className="h-4 w-4" />;
    if (type.includes('calving')) return <Baby className="h-4 w-4" />;
    if (type.includes('vaccination')) return <Syringe className="h-4 w-4" />;
    if (type.includes('health')) return <Heart className="h-4 w-4" />;
    if (type.includes('vet')) return <Stethoscope className="h-4 w-4" />;
    if (type.includes('lab')) return <FlaskConical className="h-4 w-4" />;
    if (type.includes('prescription')) return <Pill className="h-4 w-4" />;
    return <Bell className="h-4 w-4" />;
  };

  const getAlertCategory = (type: string) => {
    if (type.includes('treatment')) return 'Treatment';
    if (type.includes('withholding')) return 'Withholding';
    if (type.includes('calving')) return 'Calving';
    if (type.includes('vaccination')) return 'Vaccination';
    if (type.includes('health')) return 'Health';
    if (type.includes('vet') || type.includes('lab') || type.includes('prescription')) return 'Veterinary';
    if (type.includes('vehicle')) return 'Vehicle';
    return 'Other';
  };

  const toggleAlertSelection = (alertId: string) => {
    setSelectedAlerts(prev => 
      prev.includes(alertId) 
        ? prev.filter(id => id !== alertId)
        : [...prev, alertId]
    );
  };

  const alertCategories = [
    { value: 'all', label: 'All Alerts' },
    { value: 'treatment_due', label: 'Treatment Due' },
    { value: 'treatment_overdue', label: 'Treatment Overdue' },
    { value: 'withholding_milk_ending', label: 'Milk Withholding' },
    { value: 'withholding_meat_ending', label: 'Meat Withholding' },
    { value: 'calving_due', label: 'Calving Due' },
    { value: 'calving_imminent', label: 'Calving Imminent' },
    { value: 'vaccination_due', label: 'Vaccination Due' },
    { value: 'health_check_due', label: 'Health Check' },
    { value: 'vet_visit_reminder', label: 'Vet Visit' },
    { value: 'prescription_ending', label: 'Prescription Ending' },
  ];

  // Group alerts by category
  const groupedAlerts = alerts.reduce((acc, alert) => {
    const category = getAlertCategory(alert.type);
    if (!acc[category]) acc[category] = [];
    acc[category].push(alert);
    return acc;
  }, {} as Record<string, Alert[]>);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8 text-blue-600" />
            Alerts & Notifications
          </h1>
          <p className="text-muted-foreground mt-1">
            Treatment reminders, withholding alerts, and health notifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? "Generating..." : "Generate Alerts"}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className={summary?.bySeverity?.critical ? "border-red-300 bg-red-50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary?.bySeverity?.critical || 0}</div>
          </CardContent>
        </Card>

        <Card className={summary?.bySeverity?.high ? "border-orange-300 bg-orange-50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">High</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summary?.bySeverity?.high || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Medium</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary?.bySeverity?.medium || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low</CardTitle>
            <Bell className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary?.bySeverity?.low || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Active</CardTitle>
            <Bell className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Alert Type" />
              </SelectTrigger>
              <SelectContent>
                {alertCategories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            {selectedAlerts.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  selectedAlerts.forEach(id => dismissMutation.mutate(id));
                  setSelectedAlerts([]);
                }}
              >
                <Check className="h-4 w-4 mr-2" />
                Dismiss Selected ({selectedAlerts.length})
              </Button>
            )}
            {alerts.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => dismissAllMutation.mutate(filter !== 'all' ? filter : undefined)}
              >
                Dismiss All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alert Categories */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">
            All ({alerts.length})
          </TabsTrigger>
          {Object.entries(groupedAlerts).map(([category, categoryAlerts]) => (
            <TabsTrigger key={category} value={category}>
              {category} ({categoryAlerts.length})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {loadingAlerts ? (
            <Skeleton className="h-64 w-full" />
          ) : alerts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium">All Clear!</h3>
                <p className="text-muted-foreground">No active alerts at this time.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <Card key={alert.id} className={`border-l-4 ${getSeverityColor(alert.severity)}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <Checkbox 
                        checked={selectedAlerts.includes(alert.id)}
                        onCheckedChange={() => toggleAlertSelection(alert.id)}
                      />
                      <div className={`p-2 rounded-full ${getSeverityColor(alert.severity)}`}>
                        {getAlertIcon(alert.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{alert.title}</h4>
                            <p className="text-sm text-muted-foreground">{alert.message}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {alert.type.replace(/_/g, ' ')}
                            </Badge>
                            <Badge className={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}</span>
                          {alert.metadata?.cowId && <span>Animal: {alert.metadata.cowId}</span>}
                          {alert.metadata?.dueDate && <span>Due: {alert.metadata.dueDate}</span>}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => dismissMutation.mutate(alert.id)}
                        disabled={dismissMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {Object.entries(groupedAlerts).map(([category, categoryAlerts]) => (
          <TabsContent key={category} value={category} className="space-y-3">
            {categoryAlerts.map((alert) => (
              <Card key={alert.id} className={`border-l-4 ${getSeverityColor(alert.severity)}`}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <Checkbox 
                      checked={selectedAlerts.includes(alert.id)}
                      onCheckedChange={() => toggleAlertSelection(alert.id)}
                    />
                    <div className={`p-2 rounded-full ${getSeverityColor(alert.severity)}`}>
                      {getAlertIcon(alert.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{alert.title}</h4>
                          <p className="text-sm text-muted-foreground">{alert.message}</p>
                        </div>
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}</span>
                        {alert.metadata?.cowId && <span>Animal: {alert.metadata.cowId}</span>}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => dismissMutation.mutate(alert.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>

      {/* Quick Reference Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Pill className="h-4 w-4 text-blue-600" />
              Treatment Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="space-y-1">
              <li>• Treatment due reminders</li>
              <li>• Overdue treatment warnings</li>
              <li>• Next dose alerts</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              Withholding Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="space-y-1">
              <li>• Milk withholding ending</li>
              <li>• Meat withholding ending</li>
              <li>• Clear for sale/milk</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-600" />
              Scheduled Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="space-y-1">
              <li>• Calving due dates</li>
              <li>• Vaccination schedules</li>
              <li>• Health check reminders</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
