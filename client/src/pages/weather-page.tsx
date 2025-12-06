import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WeatherDashboard, BestDaysFinder } from '@/components/WeatherDashboard';
import { toast } from 'sonner';
import {
  Cloud,
  Sun,
  CloudRain,
  Wind,
  Droplets,
  Thermometer,
  Calendar,
  Tractor,
  Fence,
  Leaf,
  Wrench,
  Sprout,
  ExternalLink,
  RefreshCw,
  MapPin,
  AlertTriangle,
} from 'lucide-react';

export default function WeatherPage() {
  const [selectedTaskType, setSelectedTaskType] = useState('spraying');

  // Fetch jobs for reschedule suggestions
  const { data: jobs = [] } = useQuery({
    queryKey: ['weatherJobs'],
    queryFn: async () => {
      const res = await fetch('/api/jobs');
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    },
  });

  // Fetch recurring tasks
  const { data: recurringTasks = [] } = useQuery({
    queryKey: ['weatherRecurringTasks'],
    queryFn: async () => {
      const res = await fetch('/api/recurring-tasks/instances/upcoming');
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch agricultural weather
  const { data: agriWeather, refetch: refetchAgri } = useQuery({
    queryKey: ['agriculturalWeather'],
    queryFn: async () => {
      const res = await fetch('/api/weather/agricultural/farm');
      if (!res.ok) throw new Error('Failed to fetch agricultural weather');
      return res.json();
    },
  });

  // Fetch weather impact
  const { data: impactData } = useQuery({
    queryKey: ['weatherImpact'],
    queryFn: async () => {
      const res = await fetch('/api/weather/impact/farm');
      if (!res.ok) throw new Error('Failed to fetch weather impact');
      return res.json();
    },
  });

  // Combine all tasks for weather analysis
  const allTasks = [
    ...jobs.map((j: any) => ({
      id: j.id,
      title: j.title,
      date: j.startDate,
      category: j.category,
      weatherSensitive: ['fencing', 'spraying', 'pasture', 'maintenance', 'hay'].includes(j.category?.toLowerCase()),
    })),
    ...recurringTasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      date: t.scheduledDate,
      category: t.category,
      weatherSensitive: t.weatherSensitive,
      skipIfRaining: t.skipIfRaining,
    })),
  ];

  const handleReschedule = async (taskId: string, newDate: string) => {
    // Find if it's a job or recurring task
    const isJob = jobs.find((j: any) => j.id === taskId);
    
    try {
      if (isJob) {
        await fetch(`/api/jobs/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate: newDate }),
        });
      } else {
        await fetch(`/api/recurring-tasks/instances/${taskId}/reschedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newDate }),
        });
      }
      toast.success('Task rescheduled successfully');
    } catch (error) {
      toast.error('Failed to reschedule task');
    }
  };

  const IMPACT_STATUS_COLORS: Record<string, string> = {
    optimal: 'bg-green-100 text-green-800',
    good: 'bg-green-100 text-green-800',
    caution: 'bg-yellow-100 text-yellow-800',
    poor: 'bg-red-100 text-red-800',
  };

  const TASK_TYPES = [
    { value: 'spraying', label: 'Spraying', icon: Sprout },
    { value: 'fencing', label: 'Fencing', icon: Fence },
    { value: 'hay', label: 'Hay Making', icon: Leaf },
    { value: 'pasture', label: 'Pasture Work', icon: Tractor },
    { value: 'maintenance', label: 'Maintenance', icon: Wrench },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Cloud className="h-8 w-8 text-blue-500" />
            Weather & Planning
          </h1>
          <p className="text-muted-foreground mt-1">
            Weather-based task planning and auto-reschedule suggestions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetchAgri()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <a
            href="https://www.yr.no/en/forecast/daily-table/2-6241327/New%20Zealand/Manawatu-Wanganui/Palmerston%20North%20City/Palmerston%20North"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              View on Yr.no
            </Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Weather Dashboard */}
        <div className="lg:col-span-2 space-y-6">
          <WeatherDashboard
            tasks={allTasks}
            onReschedule={handleReschedule}
            showForecast={true}
            showAlerts={true}
            showReschedule={true}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Farm Operations Impact */}
          {impactData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Tractor className="h-4 w-4" />
                  Operations Impact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(impactData.impact || {}).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{key}</span>
                    <Badge className={IMPACT_STATUS_COLORS[value.status]}>
                      {value.status}
                    </Badge>
                  </div>
                ))}
                {impactData.recommendations?.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Recommendations:</p>
                    <ul className="text-xs space-y-1">
                      {impactData.recommendations.map((rec: string, i: number) => (
                        <li key={i} className="flex items-start gap-1">
                          <span>•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Agricultural Conditions */}
          {agriWeather && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-green-600" />
                  Agricultural Conditions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-2 bg-muted rounded">
                    <p className="text-xs text-muted-foreground">Pasture</p>
                    <p className="font-medium text-xs">{agriWeather.agricultural?.pastureConditions}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-xs text-muted-foreground">Spraying</p>
                    <p className="font-medium text-xs">{agriWeather.agricultural?.sprayConditions}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-xs text-muted-foreground">Soil</p>
                    <p className="font-medium text-xs">{agriWeather.agricultural?.soilMoisture}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-xs text-muted-foreground">GDD</p>
                    <p className="font-medium text-xs">{agriWeather.agricultural?.growingDegreeDays}°</p>
                  </div>
                </div>
                
                {(agriWeather.agricultural?.frostRisk || agriWeather.agricultural?.heatStressRisk) && (
                  <div className="flex gap-2">
                    {agriWeather.agricultural?.frostRisk && (
                      <Badge variant="outline" className="text-blue-600 border-blue-300">
                        ❄️ Frost Risk
                      </Badge>
                    )}
                    {agriWeather.agricultural?.heatStressRisk && (
                      <Badge variant="outline" className="text-red-600 border-red-300">
                        🌡️ Heat Stress
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Best Days Finder */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Find Best Days
              </CardTitle>
              <CardDescription className="text-xs">
                Find optimal weather windows for tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedTaskType} onValueChange={setSelectedTaskType}>
                <SelectTrigger className="mb-4">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <BestDaysFinder taskType={selectedTaskType} />
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Weather Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <a
                href="https://www.yr.no"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded hover:bg-muted transition-colors"
              >
                <Cloud className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Yr.no Forecast</span>
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
              <a
                href="https://www.metservice.com/rural"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded hover:bg-muted transition-colors"
              >
                <Sun className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">MetService Rural</span>
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
              <a
                href="https://niwa.co.nz/climate"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded hover:bg-muted transition-colors"
              >
                <Thermometer className="h-4 w-4 text-red-500" />
                <span className="text-sm">NIWA Climate</span>
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
