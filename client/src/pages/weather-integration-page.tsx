import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { format, subDays, addDays } from 'date-fns';
import { toast } from 'sonner';
import {
  Cloud, CloudRain, Sun, Thermometer, Wind, Droplets, Snowflake,
  AlertTriangle, TrendingUp, TrendingDown, Calendar, RefreshCw,
  MapPin, Leaf, BarChart3, ArrowUpRight, ArrowDownRight, Eye,
  CloudSun, CloudFog, Umbrella, Gauge, Timer, Sprout, ThermometerSun,
  ThermometerSnowflake, CloudDrizzle, CloudLightning, Info, Bell
} from 'lucide-react';

// Interfaces
interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  pressure: number;
  visibility: number;
  uvIndex: number;
  condition: string;
  icon: string;
  updatedAt: string;
}

interface DailyForecast {
  date: string;
  high: number;
  low: number;
  condition: string;
  icon: string;
  rainChance: number;
  rainfall: number;
  windSpeed: number;
  humidity: number;
}

interface HourlyForecast {
  time: string;
  temperature: number;
  condition: string;
  icon: string;
  rainChance: number;
}

interface RainfallData {
  period: string;
  actual: number;
  average: number;
  variance: number;
}

interface GrowingDegreeDays {
  date: string;
  gdd: number;
  cumulative: number;
  baseTemp: number;
}

interface WeatherAlert {
  id: string;
  type: 'frost' | 'heat' | 'wind' | 'rain' | 'drought';
  severity: 'watch' | 'warning' | 'alert';
  title: string;
  description: string;
  startTime: string;
  endTime?: string;
  active: boolean;
}

interface DroughtIndicator {
  name: string;
  value: number;
  status: 'normal' | 'watch' | 'moderate' | 'severe' | 'extreme';
  description: string;
}

// Mock Data
const currentWeather: CurrentWeather = {
  temperature: 22,
  feelsLike: 24,
  humidity: 65,
  windSpeed: 15,
  windDirection: 'NW',
  pressure: 1015,
  visibility: 20,
  uvIndex: 6,
  condition: 'Partly Cloudy',
  icon: 'cloud-sun',
  updatedAt: new Date().toISOString()
};

const weeklyForecast: DailyForecast[] = [
  { date: format(new Date(), 'yyyy-MM-dd'), high: 24, low: 12, condition: 'Partly Cloudy', icon: 'cloud-sun', rainChance: 20, rainfall: 0, windSpeed: 15, humidity: 65 },
  { date: format(addDays(new Date(), 1), 'yyyy-MM-dd'), high: 26, low: 14, condition: 'Sunny', icon: 'sun', rainChance: 5, rainfall: 0, windSpeed: 10, humidity: 55 },
  { date: format(addDays(new Date(), 2), 'yyyy-MM-dd'), high: 28, low: 16, condition: 'Sunny', icon: 'sun', rainChance: 0, rainfall: 0, windSpeed: 8, humidity: 50 },
  { date: format(addDays(new Date(), 3), 'yyyy-MM-dd'), high: 25, low: 15, condition: 'Cloudy', icon: 'cloud', rainChance: 40, rainfall: 2, windSpeed: 20, humidity: 70 },
  { date: format(addDays(new Date(), 4), 'yyyy-MM-dd'), high: 20, low: 11, condition: 'Rain', icon: 'rain', rainChance: 80, rainfall: 15, windSpeed: 25, humidity: 85 },
  { date: format(addDays(new Date(), 5), 'yyyy-MM-dd'), high: 18, low: 9, condition: 'Showers', icon: 'drizzle', rainChance: 60, rainfall: 8, windSpeed: 18, humidity: 80 },
  { date: format(addDays(new Date(), 6), 'yyyy-MM-dd'), high: 21, low: 10, condition: 'Partly Cloudy', icon: 'cloud-sun', rainChance: 30, rainfall: 1, windSpeed: 12, humidity: 65 },
];

const hourlyForecast: HourlyForecast[] = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, '0')}:00`,
  temperature: Math.round(15 + 8 * Math.sin((i - 6) * Math.PI / 12)),
  condition: i >= 6 && i <= 18 ? 'Partly Cloudy' : 'Clear',
  icon: i >= 6 && i <= 18 ? 'cloud-sun' : 'moon',
  rainChance: Math.max(0, 20 - Math.abs(i - 14) * 2)
}));

const rainfallData: RainfallData[] = [
  { period: 'Today', actual: 0, average: 2.5, variance: -100 },
  { period: 'This Week', actual: 12, average: 18, variance: -33 },
  { period: 'This Month', actual: 45, average: 72, variance: -38 },
  { period: 'Last 3 Months', actual: 180, average: 215, variance: -16 },
  { period: 'Year to Date', actual: 520, average: 680, variance: -24 },
  { period: 'Last 12 Months', actual: 890, average: 950, variance: -6 },
];

const monthlyRainfall = [
  { month: 'Jul', actual: 95, average: 85 },
  { month: 'Aug', actual: 78, average: 80 },
  { month: 'Sep', actual: 62, average: 70 },
  { month: 'Oct', actual: 55, average: 75 },
  { month: 'Nov', actual: 48, average: 65 },
  { month: 'Dec', actual: 32, average: 55 },
  { month: 'Jan', actual: 45, average: 72 },
];

const gddData: GrowingDegreeDays[] = Array.from({ length: 30 }, (_, i) => {
  const date = subDays(new Date(), 29 - i);
  const dailyGdd = Math.max(0, Math.round(8 + Math.random() * 6));
  return {
    date: format(date, 'yyyy-MM-dd'),
    gdd: dailyGdd,
    cumulative: 0,
    baseTemp: 10
  };
}).map((item, idx, arr) => ({
  ...item,
  cumulative: arr.slice(0, idx + 1).reduce((sum, d) => sum + d.gdd, 0)
}));

const weatherAlerts: WeatherAlert[] = [
  { id: 'a1', type: 'frost', severity: 'warning', title: 'Frost Warning', description: 'Ground frost expected overnight. Minimum temperature -2°C. Protect sensitive crops and young stock.', startTime: format(addDays(new Date(), 1), 'yyyy-MM-dd') + 'T02:00:00', endTime: format(addDays(new Date(), 1), 'yyyy-MM-dd') + 'T08:00:00', active: true },
  { id: 'a2', type: 'wind', severity: 'watch', title: 'Strong Wind Watch', description: 'Gusty northwesterly winds expected, reaching 60-70 km/h. Secure loose items and check fencing.', startTime: format(addDays(new Date(), 4), 'yyyy-MM-dd') + 'T12:00:00', active: true },
  { id: 'a3', type: 'drought', severity: 'alert', title: 'Soil Moisture Deficit', description: 'Soil moisture levels 35% below normal. Consider irrigation scheduling and stock management.', startTime: format(subDays(new Date(), 14), 'yyyy-MM-dd'), active: true },
];

const droughtIndicators: DroughtIndicator[] = [
  { name: 'Soil Moisture Index', value: 35, status: 'moderate', description: '35% below normal for this time of year' },
  { name: 'Pasture Growth Rate', value: 45, status: 'watch', description: '25 kg DM/ha/day vs 45 kg DM/ha/day average' },
  { name: 'Days Since Rain (>5mm)', value: 18, status: 'moderate', description: '18 days since significant rainfall' },
  { name: 'Evapotranspiration', value: 6.2, status: 'watch', description: '6.2mm/day - elevated water loss' },
  { name: 'Stream Flow', value: 65, status: 'watch', description: '65% of normal flow rate' },
];

const frostHistory = [
  { date: '2024-01-10', minTemp: -1.5, duration: 4, groundFrost: true },
  { date: '2024-01-05', minTemp: -0.5, duration: 2, groundFrost: true },
  { date: '2023-12-28', minTemp: 0.5, duration: 0, groundFrost: true },
  { date: '2023-12-15', minTemp: -2.0, duration: 5, groundFrost: true },
];

export default function WeatherIntegrationPage() {
  const [activeTab, setActiveTab] = useState('current');
  const [selectedPeriod, setSelectedPeriod] = useState('7d');

  const getWeatherIcon = (icon: string, size: string = 'h-6 w-6') => {
    switch (icon) {
      case 'sun': return <Sun className={`${size} text-yellow-500`} />;
      case 'cloud': return <Cloud className={`${size} text-gray-500`} />;
      case 'cloud-sun': return <CloudSun className={`${size} text-yellow-400`} />;
      case 'rain': return <CloudRain className={`${size} text-blue-500`} />;
      case 'drizzle': return <CloudDrizzle className={`${size} text-blue-400`} />;
      case 'storm': return <CloudLightning className={`${size} text-purple-500`} />;
      case 'fog': return <CloudFog className={`${size} text-gray-400`} />;
      case 'snow': return <Snowflake className={`${size} text-blue-300`} />;
      default: return <Cloud className={`${size} text-gray-500`} />;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'alert': return 'bg-red-100 text-red-800 border-red-300';
      case 'warning': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'watch': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'frost': return <ThermometerSnowflake className="h-5 w-5" />;
      case 'heat': return <ThermometerSun className="h-5 w-5" />;
      case 'wind': return <Wind className="h-5 w-5" />;
      case 'rain': return <CloudRain className="h-5 w-5" />;
      case 'drought': return <Sun className="h-5 w-5" />;
      default: return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getDroughtStatusColor = (status: string) => {
    switch (status) {
      case 'extreme': return 'bg-red-500';
      case 'severe': return 'bg-orange-500';
      case 'moderate': return 'bg-yellow-500';
      case 'watch': return 'bg-blue-500';
      default: return 'bg-green-500';
    }
  };

  const totalGDD = gddData[gddData.length - 1]?.cumulative || 0;
  const avgDailyGDD = Math.round(totalGDD / gddData.length);
  const ytdRainfall = rainfallData.find(r => r.period === 'Year to Date')?.actual || 0;
  const rainfallDeficit = rainfallData.find(r => r.period === 'Year to Date')?.variance || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">{getWeatherIcon(currentWeather.icon, 'h-8 w-8')}</div>
              <div>
                <h1 className="text-2xl font-bold">Weather & Climate</h1>
                <p className="text-sm text-sky-100 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />Waikato Region • Updated {format(new Date(currentWeather.updatedAt), 'h:mm a')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-5xl font-bold">{currentWeather.temperature}°</p>
                <p className="text-sky-100">{currentWeather.condition}</p>
              </div>
              <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0" onClick={() => toast.success('Weather data refreshed')}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Alerts Banner */}
      {weatherAlerts.filter(a => a.active && a.severity !== 'watch').length > 0 && (
        <div className="bg-orange-500 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Active Weather Alerts:</span>
            {weatherAlerts.filter(a => a.active && a.severity !== 'watch').map(alert => (
              <Badge key={alert.id} className="bg-white/20">{alert.title}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="current">Current & Forecast</TabsTrigger>
            <TabsTrigger value="rainfall">Rainfall Tracking</TabsTrigger>
            <TabsTrigger value="gdd">Growing Degree Days</TabsTrigger>
            <TabsTrigger value="frost">Frost Monitoring</TabsTrigger>
            <TabsTrigger value="drought">Drought Indicators</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          {/* Current & Forecast Tab */}
          <TabsContent value="current" className="space-y-6">
            {/* Current Conditions */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              <Card><CardContent className="p-4 text-center"><Thermometer className="h-5 w-5 mx-auto mb-1 text-red-500" /><p className="text-xs text-gray-500">Feels Like</p><p className="text-lg font-bold">{currentWeather.feelsLike}°C</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><Droplets className="h-5 w-5 mx-auto mb-1 text-blue-500" /><p className="text-xs text-gray-500">Humidity</p><p className="text-lg font-bold">{currentWeather.humidity}%</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><Wind className="h-5 w-5 mx-auto mb-1 text-gray-500" /><p className="text-xs text-gray-500">Wind</p><p className="text-lg font-bold">{currentWeather.windSpeed} km/h</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><Gauge className="h-5 w-5 mx-auto mb-1 text-purple-500" /><p className="text-xs text-gray-500">Pressure</p><p className="text-lg font-bold">{currentWeather.pressure} hPa</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><Eye className="h-5 w-5 mx-auto mb-1 text-green-500" /><p className="text-xs text-gray-500">Visibility</p><p className="text-lg font-bold">{currentWeather.visibility} km</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><Sun className="h-5 w-5 mx-auto mb-1 text-yellow-500" /><p className="text-xs text-gray-500">UV Index</p><p className="text-lg font-bold">{currentWeather.uvIndex}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><CloudRain className="h-5 w-5 mx-auto mb-1 text-blue-500" /><p className="text-xs text-gray-500">Rain Today</p><p className="text-lg font-bold">0 mm</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><Umbrella className="h-5 w-5 mx-auto mb-1 text-blue-400" /><p className="text-xs text-gray-500">Rain Chance</p><p className="text-lg font-bold">20%</p></CardContent></Card>
            </div>

            {/* 7-Day Forecast */}
            <Card>
              <CardHeader><CardTitle className="text-lg">7-Day Forecast</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {weeklyForecast.map((day, idx) => (
                    <div key={idx} className={`p-3 rounded-lg text-center ${idx === 0 ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50'}`}>
                      <p className="text-sm font-medium">{idx === 0 ? 'Today' : format(new Date(day.date), 'EEE')}</p>
                      <p className="text-xs text-gray-500">{format(new Date(day.date), 'MMM d')}</p>
                      <div className="my-2">{getWeatherIcon(day.icon, 'h-8 w-8 mx-auto')}</div>
                      <p className="font-bold">{day.high}°</p>
                      <p className="text-sm text-gray-500">{day.low}°</p>
                      <div className="mt-2 flex items-center justify-center gap-1 text-xs text-blue-600">
                        <Droplets className="h-3 w-3" />{day.rainChance}%
                      </div>
                      {day.rainfall > 0 && <p className="text-xs text-blue-500">{day.rainfall}mm</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Hourly Forecast */}
            <Card>
              <CardHeader><CardTitle className="text-lg">24-Hour Forecast</CardTitle></CardHeader>
              <CardContent>
                <div className="flex overflow-x-auto gap-3 pb-2">
                  {hourlyForecast.map((hour, idx) => (
                    <div key={idx} className="flex-shrink-0 w-16 p-2 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-500">{hour.time}</p>
                      <div className="my-1">{getWeatherIcon(hour.icon, 'h-5 w-5 mx-auto')}</div>
                      <p className="font-bold text-sm">{hour.temperature}°</p>
                      {hour.rainChance > 0 && <p className="text-xs text-blue-500">{hour.rainChance}%</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rainfall Tracking Tab */}
          <TabsContent value="rainfall" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="bg-blue-50"><CardContent className="p-4 text-center"><p className="text-sm text-blue-600">YTD Rainfall</p><p className="text-3xl font-bold text-blue-700">{ytdRainfall}mm</p><p className="text-xs text-blue-500">{rainfallDeficit}% vs average</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">This Month</p><p className="text-3xl font-bold">45mm</p><p className="text-xs text-red-500">-38% below avg</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Last 7 Days</p><p className="text-3xl font-bold">12mm</p><p className="text-xs text-red-500">-33% below avg</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Days Since Rain</p><p className="text-3xl font-bold text-orange-600">5</p><p className="text-xs text-gray-500">Last: 8mm on Jan 10</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Rainfall Comparison</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rainfallData.map(data => (
                    <div key={data.period} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{data.period}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm"><span className="font-bold">{data.actual}mm</span> actual</span>
                          <span className="text-sm text-gray-500">{data.average}mm avg</span>
                          <Badge className={data.variance < -20 ? 'bg-red-100 text-red-800' : data.variance < 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                            {data.variance > 0 ? '+' : ''}{data.variance}%
                          </Badge>
                        </div>
                      </div>
                      <div className="flex h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full" style={{ width: `${Math.min(100, (data.actual / data.average) * 100)}%` }} />
                        <div className="bg-blue-200 h-full" style={{ width: `${Math.max(0, 100 - (data.actual / data.average) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Monthly Rainfall (Last 7 Months)</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end justify-between h-48 gap-2">
                  {monthlyRainfall.map(month => (
                    <div key={month.month} className="flex-1 flex flex-col items-center">
                      <div className="flex-1 w-full flex items-end gap-1">
                        <div className="flex-1 bg-blue-500 rounded-t" style={{ height: `${(month.actual / 100) * 100}%` }} title={`${month.actual}mm actual`} />
                        <div className="flex-1 bg-blue-200 rounded-t" style={{ height: `${(month.average / 100) * 100}%` }} title={`${month.average}mm average`} />
                      </div>
                      <p className="text-xs mt-2 font-medium">{month.month}</p>
                      <p className="text-xs text-gray-500">{month.actual}mm</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-500 rounded" /><span className="text-sm">Actual</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-200 rounded" /><span className="text-sm">Average</span></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Growing Degree Days Tab */}
          <TabsContent value="gdd" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="bg-green-50"><CardContent className="p-4 text-center"><p className="text-sm text-green-600">Cumulative GDD</p><p className="text-3xl font-bold text-green-700">{totalGDD}</p><p className="text-xs text-green-500">Base 10°C</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Daily Average</p><p className="text-3xl font-bold">{avgDailyGDD}</p><p className="text-xs text-gray-500">GDD/day</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Yesterday</p><p className="text-3xl font-bold">{gddData[gddData.length - 1]?.gdd || 0}</p><p className="text-xs text-gray-500">GDD</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">vs Last Year</p><p className="text-3xl font-bold text-green-600">+8%</p><p className="text-xs text-green-500">ahead of schedule</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Growing Degree Days - Last 30 Days</CardTitle>
                <CardDescription>Base temperature: 10°C • Cumulative total: {totalGDD} GDD</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-end h-40 gap-1">
                    {gddData.map((day, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center group relative">
                        <div className="w-full bg-green-500 rounded-t transition-all hover:bg-green-600" style={{ height: `${(day.gdd / 15) * 100}%`, minHeight: day.gdd > 0 ? '4px' : '0' }} />
                        <div className="hidden group-hover:block absolute bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                          {format(new Date(day.date), 'MMM d')}: {day.gdd} GDD
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{format(new Date(gddData[0].date), 'MMM d')}</span>
                    <span>{format(new Date(gddData[gddData.length - 1].date), 'MMM d')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Pasture Growth Correlation</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-3"><Sprout className="h-5 w-5 text-green-600" /><span className="font-medium">Pasture Growth Rate</span></div>
                    <p className="text-3xl font-bold text-green-700">28 kg DM/ha/day</p>
                    <p className="text-sm text-gray-600 mt-1">Based on current GDD accumulation</p>
                    <div className="mt-3 text-sm"><span className="text-gray-500">Expected range:</span> <span className="font-medium">25-35 kg DM/ha/day</span></div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-3"><Calendar className="h-5 w-5 text-blue-600" /><span className="font-medium">Growth Stage Predictions</span></div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>Ryegrass heading</span><span className="font-medium">~450 GDD (in 12 days)</span></div>
                      <div className="flex justify-between"><span>Clover flowering</span><span className="font-medium">~600 GDD (in 25 days)</span></div>
                      <div className="flex justify-between"><span>Peak growth</span><span className="font-medium">~800 GDD (in 40 days)</span></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Frost Monitoring Tab */}
          <TabsContent value="frost" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <Card className={weatherAlerts.some(a => a.type === 'frost' && a.active) ? 'bg-blue-50 border-blue-300' : ''}>
                <CardContent className="p-4 text-center">
                  <ThermometerSnowflake className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-sm text-gray-500">Next Frost Risk</p>
                  <p className="text-xl font-bold text-blue-700">Tomorrow</p>
                  <p className="text-xs text-blue-500">-2°C expected</p>
                </CardContent>
              </Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Frost Days (Season)</p><p className="text-3xl font-bold">12</p><p className="text-xs text-gray-500">vs 15 avg</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Last Frost</p><p className="text-xl font-bold">Jan 10</p><p className="text-xs text-gray-500">-1.5°C</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Frost-Free Days</p><p className="text-3xl font-bold text-green-600">5</p><p className="text-xs text-gray-500">since last frost</p></CardContent></Card>
            </div>

            {/* Frost Alert */}
            {weatherAlerts.filter(a => a.type === 'frost' && a.active).map(alert => (
              <Card key={alert.id} className="border-2 border-blue-300 bg-blue-50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-100 rounded-full"><ThermometerSnowflake className="h-8 w-8 text-blue-600" /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-lg text-blue-800">{alert.title}</h3>
                        <Badge className={getAlertColor(alert.severity)}>{alert.severity}</Badge>
                      </div>
                      <p className="text-blue-700 mb-3">{alert.description}</p>
                      <div className="flex items-center gap-4 text-sm text-blue-600">
                        <span><Timer className="h-4 w-4 inline mr-1" />Starts: {format(new Date(alert.startTime), 'MMM d, h:mm a')}</span>
                        {alert.endTime && <span>Ends: {format(new Date(alert.endTime), 'h:mm a')}</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card>
              <CardHeader><CardTitle className="text-lg">Frost History</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium">Date</th>
                      <th className="text-center p-3 text-sm font-medium">Min Temp</th>
                      <th className="text-center p-3 text-sm font-medium">Duration (hrs)</th>
                      <th className="text-center p-3 text-sm font-medium">Ground Frost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {frostHistory.map((frost, idx) => (
                      <tr key={idx} className="hover:bg-accent">
                        <td className="p-3">{format(new Date(frost.date), 'MMM d, yyyy')}</td>
                        <td className="p-3 text-center font-bold text-blue-600">{frost.minTemp}°C</td>
                        <td className="p-3 text-center">{frost.duration}h</td>
                        <td className="p-3 text-center">{frost.groundFrost ? <Badge className="bg-blue-100 text-blue-800">Yes</Badge> : <Badge variant="outline">No</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Drought Indicators Tab */}
          <TabsContent value="drought" className="space-y-6">
            <Card className="border-2 border-yellow-300 bg-yellow-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-100 rounded-full"><Sun className="h-8 w-8 text-yellow-600" /></div>
                    <div>
                      <h3 className="font-bold text-lg text-yellow-800">Drought Status: MODERATE</h3>
                      <p className="text-yellow-700">Soil moisture levels below normal. Monitor pasture and water resources.</p>
                    </div>
                  </div>
                  <Badge className="bg-yellow-200 text-yellow-800 text-lg px-4 py-2">Level 2</Badge>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {droughtIndicators.map(indicator => (
                <Card key={indicator.name}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">{indicator.name}</span>
                      <Badge className={`${getDroughtStatusColor(indicator.status)} text-white`}>{indicator.status}</Badge>
                    </div>
                    <p className="text-3xl font-bold mb-2">
                      {typeof indicator.value === 'number' && indicator.value < 100 ? `${indicator.value}%` : indicator.value}
                    </p>
                    <p className="text-sm text-gray-500">{indicator.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Drought Management Recommendations</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { title: 'Reduce Stocking Rate', description: 'Consider destocking by 10-15% to reduce pasture pressure', priority: 'high' },
                    { title: 'Irrigation Scheduling', description: 'Prioritize high-value paddocks, irrigate during cooler hours', priority: 'high' },
                    { title: 'Supplement Planning', description: 'Secure additional feed supplies, review feed budget', priority: 'medium' },
                    { title: 'Water Management', description: 'Check troughs daily, monitor bore levels', priority: 'medium' },
                  ].map((rec, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border-2 ${rec.priority === 'high' ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{rec.title}</span>
                        <Badge className={rec.priority === 'high' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}>{rec.priority}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">{rec.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Weather Alerts</h2>
              <Button variant="outline"><Bell className="h-4 w-4 mr-2" />Configure Alerts</Button>
            </div>

            <div className="space-y-4">
              {weatherAlerts.map(alert => (
                <Card key={alert.id} className={`border-2 ${getAlertColor(alert.severity).replace('bg-', 'border-').replace('-100', '-300')}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-full ${getAlertColor(alert.severity)}`}>{getAlertIcon(alert.type)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold">{alert.title}</h3>
                          <Badge className={getAlertColor(alert.severity)}>{alert.severity}</Badge>
                          {alert.active && <Badge className="bg-green-100 text-green-800">Active</Badge>}
                        </div>
                        <p className="text-gray-600 mb-3">{alert.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span><Calendar className="h-4 w-4 inline mr-1" />{format(new Date(alert.startTime), 'MMM d, yyyy h:mm a')}</span>
                          {alert.endTime && <span>Until: {format(new Date(alert.endTime), 'h:mm a')}</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Alert Settings</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { type: 'Frost Alerts', description: 'Notify when temperature drops below 2°C', enabled: true },
                    { type: 'Heat Alerts', description: 'Notify when temperature exceeds 30°C', enabled: true },
                    { type: 'Heavy Rain', description: 'Notify when >20mm rain expected in 24hrs', enabled: true },
                    { type: 'Strong Wind', description: 'Notify when gusts exceed 60 km/h', enabled: false },
                    { type: 'Drought Watch', description: 'Notify when soil moisture drops below threshold', enabled: true },
                  ].map((setting, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{setting.type}</p>
                        <p className="text-sm text-gray-500">{setting.description}</p>
                      </div>
                      <Badge className={setting.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>{setting.enabled ? 'Enabled' : 'Disabled'}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
