import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Activity, Calendar, Download, BarChart3 } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';

interface GrowthRateData {
  date: string;
  growth_rate: number;
  target_rate: number;
  temperature: number;
  rainfall: number;
  measurement_count: number;
}

interface GrowthRateTrendProps {
  data: GrowthRateData[];
  targetGrowthRate: number;
  loading?: boolean;
  onExport?: () => void;
}

const GrowthRateTrend: React.FC<GrowthRateTrendProps> = ({
  data,
  targetGrowthRate,
  loading = false,
  onExport,
}) => {
  const getTrendIcon = (current: number, target: number) => {
    if (current >= target * 0.9) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    }
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const getTrendColor = (current: number, target: number) => {
    if (current >= target * 0.9) return 'text-green-600';
    if (current >= target * 0.7) return 'text-orange-600';
    return 'text-red-600';
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border rounded-lg shadow-lg min-w-48">
          <p className="font-semibold mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="font-medium">Growth Rate:</span>{' '}
              <span className={getTrendColor(data.growth_rate, targetGrowthRate)}>
                {data.growth_rate} kg DM/ha/day
              </span>
            </p>
            <p className="text-sm">
              <span className="font-medium">Target:</span> {data.target_rate} kg DM/ha/day
            </p>
            <p className="text-sm">
              <span className="font-medium">Temperature:</span> {data.temperature}°C
            </p>
            <p className="text-sm">
              <span className="font-medium">Rainfall:</span> {data.rainfall}mm
            </p>
            <p className="text-sm">
              <span className="font-medium">Measurements:</span> {data.measurement_count}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Calculate statistics
  const latestGrowthRate = data[data.length - 1]?.growth_rate || 0;
  const averageGrowthRate = data.reduce((sum, d) => sum + d.growth_rate, 0) / data.length;
  const maxGrowthRate = Math.max(...data.map(d => d.growth_rate));
  const minGrowthRate = Math.min(...data.map(d => d.growth_rate));

  // Calculate trend (last 7 days vs previous 7 days)
  const recentWeek = data.slice(-7);
  const previousWeek = data.slice(-14, -7);
  const recentAvg = recentWeek.reduce((sum, d) => sum + d.growth_rate, 0) / recentWeek.length;
  const previousAvg = previousWeek.reduce((sum, d) => sum + d.growth_rate, 0) / previousWeek.length;
  const trendPercentage = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 rounded-lg mb-4"></div>
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Growth Rate Trends
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Growth</p>
                <p className={`text-2xl font-bold ${getTrendColor(latestGrowthRate, targetGrowthRate)}`}>
                  {latestGrowthRate}
                </p>
                <p className="text-xs text-muted-foreground">kg DM/ha/day</p>
              </div>
              {getTrendIcon(latestGrowthRate, targetGrowthRate)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average (30d)</p>
                <p className="text-2xl font-bold text-blue-600">
                  {averageGrowthRate.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">kg DM/ha/day</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Peak Growth</p>
                <p className="text-2xl font-bold text-green-600">
                  {maxGrowthRate}
                </p>
                <p className="text-xs text-muted-foreground">kg DM/ha/day</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">7-Day Trend</p>
                <p className={`text-2xl font-bold ${
                  trendPercentage > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {trendPercentage > 0 ? '+' : ''}{trendPercentage.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">vs previous week</p>
              </div>
              {trendPercentage > 0 ? (
                <TrendingUp className="h-8 w-8 text-green-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Growth Rate Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Growth Rate Over Time</CardTitle>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-blue-500 rounded"></div>
              <span>Actual Growth</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-gray-400 rounded"></div>
              <span>Target Rate ({targetGrowthRate} kg/ha/day)</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#9ca3af" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                label={{ value: 'Growth Rate (kg DM/ha/day)', angle: -90, position: 'insideLeft' }}
                domain={[0, 'dataMax + 10']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="growth_rate"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorGrowth)"
                name="Actual Growth"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="target_rate"
                stroke="#9ca3af"
                fillOpacity={1}
                fill="url(#colorTarget)"
                name="Target Rate"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Environmental Factors */}
      <Card>
        <CardHeader>
          <CardTitle>Environmental Factors Impact</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Rainfall (mm)', angle: 90, position: 'insideRight' }} />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="temperature"
                stroke="#ef4444"
                name="Temperature"
                strokeWidth={2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="rainfall"
                stroke="#06b6d4"
                name="Rainfall"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Growth Analysis Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Performance Indicators</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium">Target Achievement</span>
                  <Badge className="bg-green-100 text-green-800">
                    {Math.round((averageGrowthRate / targetGrowthRate) * 100)}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium">Growth Consistency</span>
                  <Badge className="bg-blue-100 text-blue-800">
                    {Math.min(100, Math.round((1 - (maxGrowthRate - minGrowthRate) / maxGrowthRate) * 100))}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <span className="text-sm font-medium">Data Quality</span>
                  <Badge className="bg-purple-100 text-purple-800">
                    High
                  </Badge>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Recommendations</h4>
              <div className="space-y-2 text-sm">
                {averageGrowthRate < targetGrowthRate * 0.8 && (
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-orange-800">
                      <strong>Low Growth Detected:</strong> Consider fertilizer application or review grazing pressure
                    </p>
                  </div>
                )}
                {trendPercentage < -10 && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-red-800">
                      <strong>Declining Trend:</strong> Monitor soil moisture and consider supplemental feeding
                    </p>
                  </div>
                )}
                {averageGrowthRate >= targetGrowthRate && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-800">
                      <strong>Excellent Growth:</strong> Current management practices are working well
                    </p>
                  </div>
                )}
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-blue-800">
                    <strong>Continue Monitoring:</strong> Maintain regular measurements for optimal management
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GrowthRateTrend;
