import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Cloud,
  CloudRain,
  Sun,
  Wind,
  Droplets,
  Thermometer,
  AlertTriangle,
  Calendar,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Snowflake,
  CloudSun,
  Umbrella,
  Gauge,
  ExternalLink,
} from 'lucide-react';

interface WeatherForecast {
  date: string;
  high: number;
  low: number;
  condition: string;
  precipitation: number;
  icon?: string;
  isRainy?: boolean;
  isBadForOutdoor?: boolean;
}

interface CurrentWeather {
  temperature: number;
  condition: string;
  icon?: string;
  humidity: number;
  windSpeed: number;
  isRainy?: boolean;
}

interface WeatherAlert {
  type: string;
  severity: string;
  title: string;
  message: string;
  icon: string;
  affectedCategories: string[];
  date: string;
}

interface RescheduleSuggestion {
  taskId: string;
  taskTitle: string;
  originalDate: string;
  reason: string;
  weatherOnDate: {
    condition: string;
    icon: string;
    precipitation: number;
    high: number;
    low: number;
  };
  suggestedDate: string | null;
  suggestedWeather: WeatherForecast | null;
  severity: string;
}

interface WeatherDashboardProps {
  tasks?: any[];
  onReschedule?: (taskId: string, newDate: string) => void;
  compact?: boolean;
  showForecast?: boolean;
  showAlerts?: boolean;
  showReschedule?: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
};

export function WeatherDashboard({
  tasks = [],
  onReschedule,
  compact = false,
  showForecast = true,
  showAlerts = true,
  showReschedule = true,
}: WeatherDashboardProps) {
  const queryClient = useQueryClient();
  const [selectedSuggestion, setSelectedSuggestion] = useState<RescheduleSuggestion | null>(null);

  // Fetch weather alerts
  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['weatherAlerts'],
    queryFn: async () => {
      const res = await fetch('/api/weather/task-alerts');
      if (!res.ok) throw new Error('Failed to fetch weather alerts');
      return res.json();
    },
    refetchInterval: 30 * 60 * 1000, // Refresh every 30 minutes
  });

  // Fetch reschedule suggestions
  const { data: rescheduleData, isLoading: rescheduleLoading, refetch: refetchReschedule } = useQuery({
    queryKey: ['rescheduleSuggestions', tasks],
    queryFn: async () => {
      const res = await fetch('/api/weather/reschedule-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
      });
      if (!res.ok) throw new Error('Failed to fetch reschedule suggestions');
      return res.json();
    },
    enabled: tasks.length > 0,
  });

  const currentWeather: CurrentWeather | undefined = alertsData?.currentWeather;
  const forecast: WeatherForecast[] = rescheduleData?.forecast || alertsData?.forecast || [];
  const alerts: WeatherAlert[] = alertsData?.alerts || [];
  const suggestions: RescheduleSuggestion[] = rescheduleData?.suggestions || [];

  const handleAcceptReschedule = (suggestion: RescheduleSuggestion) => {
    if (onReschedule && suggestion.suggestedDate) {
      onReschedule(suggestion.taskId, suggestion.suggestedDate);
      toast.success(`Task rescheduled to ${new Date(suggestion.suggestedDate).toLocaleDateString('en-NZ', { weekday: 'short', month: 'short', day: 'numeric' })}`);
    }
    setSelectedSuggestion(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-NZ', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (compact) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentWeather && (
                <>
                  <span className="text-3xl">{currentWeather.icon || '☁️'}</span>
                  <div>
                    <p className="text-2xl font-bold">{currentWeather.temperature}°C</p>
                    <p className="text-sm text-muted-foreground">{currentWeather.condition}</p>
                  </div>
                </>
              )}
            </div>
            {alerts.length > 0 && (
              <Badge className={SEVERITY_COLORS[alerts[0].severity]}>
                <AlertTriangle className="h-3 w-3 mr-1" />
                {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
              </Badge>
            )}
            {suggestions.length > 0 && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                <Calendar className="h-3 w-3 mr-1" />
                {suggestions.length} Reschedule
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Weather Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Weather & Task Planning
            </CardTitle>
            <a
              href="https://www.yr.no"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              Powered by Yr.no
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardHeader>
        <CardContent>
          {currentWeather ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-5xl">{currentWeather.icon || '☁️'}</span>
                <div>
                  <p className="text-3xl font-bold">{currentWeather.temperature}°C</p>
                  <p className="text-muted-foreground">{currentWeather.condition}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  <span>{currentWeather.humidity}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wind className="h-4 w-4 text-gray-500" />
                  <span>{currentWeather.windSpeed} km/h</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Loading weather data...
            </div>
          )}
        </CardContent>
      </Card>

      {/* 7-Day Forecast */}
      {showForecast && forecast.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">7-Day Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {forecast.map((day, index) => (
                <div
                  key={day.date}
                  className={cn(
                    "flex-shrink-0 w-20 p-2 rounded-lg text-center border",
                    index === 0 && "bg-blue-50 border-blue-200",
                    day.isBadForOutdoor && "bg-orange-50 border-orange-200"
                  )}
                >
                  <p className="text-xs font-medium">{formatDate(day.date)}</p>
                  <p className="text-2xl my-1">{day.icon || '☁️'}</p>
                  <p className="text-sm font-semibold">{day.high}°</p>
                  <p className="text-xs text-muted-foreground">{day.low}°</p>
                  {day.precipitation > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      <Droplets className="h-3 w-3 inline" /> {day.precipitation}mm
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weather Alerts */}
      {showAlerts && alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Weather Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={cn(
                  "p-3 rounded-lg border",
                  SEVERITY_COLORS[alert.severity]
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xl">{alert.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-sm opacity-80">{alert.message}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {alert.affectedCategories.map(cat => (
                        <Badge key={cat} variant="outline" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Reschedule Suggestions */}
      {showReschedule && suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-orange-500" />
                Reschedule Suggestions
                <Badge variant="secondary">{suggestions.length}</Badge>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchReschedule()}
                disabled={rescheduleLoading}
              >
                <RefreshCw className={cn("h-4 w-4", rescheduleLoading && "animate-spin")} />
              </Button>
            </div>
            <CardDescription>
              Weather-based recommendations for outdoor tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-3">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.taskId}
                    className={cn(
                      "p-3 rounded-lg border",
                      suggestion.severity === 'high' ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium">{suggestion.taskTitle}</p>
                        <div className="flex items-center gap-2 mt-1 text-sm">
                          <span className="text-muted-foreground">
                            {formatDate(suggestion.originalDate)}
                          </span>
                          <span>{suggestion.weatherOnDate.icon}</span>
                          <span className="text-red-600">{suggestion.reason}</span>
                        </div>
                        {suggestion.suggestedDate && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-green-700">
                            <ArrowRight className="h-4 w-4" />
                            <span>Suggested: {formatDate(suggestion.suggestedDate)}</span>
                            <span>{suggestion.suggestedWeather?.icon}</span>
                            <span>{suggestion.suggestedWeather?.condition}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {suggestion.suggestedDate && onReschedule && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-300 hover:bg-green-50"
                            onClick={() => setSelectedSuggestion(suggestion)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-500"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* No Issues */}
      {showAlerts && alerts.length === 0 && showReschedule && suggestions.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center">
            <Sun className="h-12 w-12 mx-auto mb-2 text-yellow-500" />
            <p className="font-medium text-green-700">Good Weather Ahead!</p>
            <p className="text-sm text-muted-foreground">
              No weather-related issues for your scheduled tasks
            </p>
          </CardContent>
        </Card>
      )}

      {/* Reschedule Confirmation Dialog */}
      <Dialog open={!!selectedSuggestion} onOpenChange={() => setSelectedSuggestion(null)}>
        <DialogContent>
          {selectedSuggestion && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm Reschedule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{selectedSuggestion.taskTitle}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg bg-red-50 border-red-200">
                    <p className="text-xs text-muted-foreground mb-1">Original Date</p>
                    <p className="font-medium">{formatDate(selectedSuggestion.originalDate)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-2xl">{selectedSuggestion.weatherOnDate.icon}</span>
                      <div className="text-sm">
                        <p>{selectedSuggestion.weatherOnDate.condition}</p>
                        <p className="text-red-600">{selectedSuggestion.weatherOnDate.precipitation}mm rain</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 border rounded-lg bg-green-50 border-green-200">
                    <p className="text-xs text-muted-foreground mb-1">Suggested Date</p>
                    <p className="font-medium">{formatDate(selectedSuggestion.suggestedDate!)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-2xl">{selectedSuggestion.suggestedWeather?.icon}</span>
                      <div className="text-sm">
                        <p>{selectedSuggestion.suggestedWeather?.condition}</p>
                        <p className="text-green-600">
                          {selectedSuggestion.suggestedWeather?.high}°/{selectedSuggestion.suggestedWeather?.low}°
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedSuggestion(null)}>
                  Keep Original
                </Button>
                <Button
                  onClick={() => handleAcceptReschedule(selectedSuggestion)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Reschedule
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Compact weather widget for headers/sidebars
export function WeatherWidget() {
  const { data } = useQuery({
    queryKey: ['weatherWidget'],
    queryFn: async () => {
      const res = await fetch('/api/weather/task-alerts');
      if (!res.ok) throw new Error('Failed to fetch weather');
      return res.json();
    },
    refetchInterval: 30 * 60 * 1000,
  });

  const weather = data?.currentWeather;
  const alerts = data?.alerts || [];

  if (!weather) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Cloud className="h-4 w-4 animate-pulse" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">{weather.icon || '☁️'}</span>
        <span className="font-medium">{weather.temperature}°C</span>
      </div>
      {alerts.length > 0 && (
        <Badge variant="outline" className="text-yellow-600 border-yellow-300">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {alerts.length}
        </Badge>
      )}
    </div>
  );
}

// Best days finder component
export function BestDaysFinder({ taskType }: { taskType: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['bestDays', taskType],
    queryFn: async () => {
      const res = await fetch(`/api/weather/best-days/${taskType}`);
      if (!res.ok) throw new Error('Failed to fetch best days');
      return res.json();
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Finding best days...</div>;
  }

  if (!data) return null;

  const RATING_COLORS: Record<string, string> = {
    excellent: 'bg-green-100 text-green-800',
    good: 'bg-blue-100 text-blue-800',
    fair: 'bg-yellow-100 text-yellow-800',
    poor: 'bg-red-100 text-red-800',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Best Days for {taskType.charAt(0).toUpperCase() + taskType.slice(1)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.allDays?.slice(0, 5).map((day: any) => (
            <div
              key={day.date}
              className="flex items-center justify-between p-2 rounded border"
            >
              <div className="flex items-center gap-2">
                <span>{day.weather.icon}</span>
                <span className="font-medium">{day.dayName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={RATING_COLORS[day.rating]}>
                  {day.rating}
                </Badge>
                <Progress value={day.score} className="w-16 h-2" />
              </div>
            </div>
          ))}
        </div>
        {data.recommendation && (
          <p className="text-sm text-muted-foreground mt-3">
            💡 {data.recommendation}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default WeatherDashboard;
