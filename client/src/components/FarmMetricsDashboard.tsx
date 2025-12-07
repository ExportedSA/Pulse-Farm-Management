import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Calendar, 
  MapPin, 
  Users,
  Leaf,
  Activity,
  Target
} from 'lucide-react';

interface FarmMetricsData {
  totalPaddocks: number;
  measuredPaddocks: number;
  averageCover: number;
  averageGrowth: number;
  targetPreGrazing: number;
  targetPostGrazing: number;
  herdSize: number;
  dailyDemand: number;
  grazingArea: number;
  rotationLength: number;
  readyPaddocks: number;
  optimalPaddocks: number;
  lowPaddocks: number;
  highPaddocks: number;
}

interface FarmMetricsDashboardProps {
  data: FarmMetricsData;
  loading?: boolean;
}

const FarmMetricsDashboard: React.FC<FarmMetricsDashboardProps> = ({ 
  data, 
  loading = false 
}) => {
  const getTrendIcon = (current: number, target: number) => {
    if (current >= target * 0.9 && current <= target * 1.1) {
      return <Target className="h-4 w-4 text-green-500" />;
    }
    return current > target ? 
      <TrendingUp className="h-4 w-4 text-blue-500" /> : 
      <TrendingDown className="h-4 w-4 text-orange-500" />;
  };

  const getTrendColor = (current: number, target: number) => {
    if (current >= target * 0.9 && current <= target * 1.1) {
      return 'text-green-600';
    }
    return current > target ? 'text-blue-600' : 'text-orange-600';
  };

  const getProgressColor = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 90 && percentage <= 110) return 'bg-green-500';
    if (percentage > 110) return 'bg-blue-500';
    return 'bg-orange-500';
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Paddocks Measured</p>
                <p className="text-2xl font-bold">
                  {data.measuredPaddocks}/{data.totalPaddocks}
                </p>
                <p className="text-xs text-muted-foreground">
                  {Math.round((data.measuredPaddocks / data.totalPaddocks) * 100)}% complete
                </p>
              </div>
              <MapPin className="h-8 w-8 text-blue-500" />
            </div>
            <Progress 
              value={(data.measuredPaddocks / data.totalPaddocks) * 100} 
              className="mt-3" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Cover</p>
                <p className={`text-2xl font-bold ${getTrendColor(data.averageCover, data.targetPreGrazing)}`}>
                  {data.averageCover.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">kg DM/ha</p>
              </div>
              {getTrendIcon(data.averageCover, data.targetPreGrazing)}
            </div>
            <Progress 
              value={(data.averageCover / data.targetPreGrazing) * 100} 
              className="mt-3"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Growth Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {data.averageGrowth}
                </p>
                <p className="text-xs text-muted-foreground">kg DM/ha/day</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-3">
              <Badge variant="outline" className="text-green-600">
                Healthy growth
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rotation Length</p>
                <p className="text-2xl font-bold text-purple-600">
                  {data.rotationLength}
                </p>
                <p className="text-xs text-muted-foreground">days</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
            <div className="mt-3">
              <Badge variant="outline" className="text-purple-600">
                Optimal timing
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Herd Size</p>
                <p className="text-2xl font-bold text-blue-600">
                  {data.herdSize}
                </p>
                <p className="text-xs text-muted-foreground">animals</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Daily Demand</p>
                <p className="text-2xl font-bold text-orange-600">
                  {(data.dailyDemand * data.herdSize).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">kg DM/day</p>
              </div>
              <Activity className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Grazing Area</p>
                <p className="text-2xl font-bold text-green-600">
                  {data.grazingArea}
                </p>
                <p className="text-xs text-muted-foreground">hectares</p>
              </div>
              <Leaf className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Target Cover</p>
                <p className="text-2xl font-bold text-purple-600">
                  {data.targetPreGrazing}
                </p>
                <p className="text-xs text-muted-foreground">kg DM/ha</p>
              </div>
              <Target className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Paddock Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Paddock Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-green-600">{data.readyPaddocks}</span>
              </div>
              <h4 className="font-medium text-green-700">Ready to Graze</h4>
              <p className="text-sm text-muted-foreground">
                ≥{data.targetPreGrazing} kg DM/ha
              </p>
              <div className="mt-2">
                <Badge variant="outline" className="text-green-600">
                  {Math.round((data.readyPaddocks / data.totalPaddocks) * 100)}%
                </Badge>
              </div>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-blue-600">{data.optimalPaddocks}</span>
              </div>
              <h4 className="font-medium text-blue-700">Optimal Range</h4>
              <p className="text-sm text-muted-foreground">
                {Math.round(data.targetPreGrazing * 0.8)}-{data.targetPreGrazing} kg DM/ha
              </p>
              <div className="mt-2">
                <Badge variant="outline" className="text-blue-600">
                  {Math.round((data.optimalPaddocks / data.totalPaddocks) * 100)}%
                </Badge>
              </div>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-orange-600">{data.lowPaddocks}</span>
              </div>
              <h4 className="font-medium text-orange-700">Low Cover</h4>
              <p className="text-sm text-muted-foreground">
                &lt;{Math.round(data.targetPreGrazing * 0.8)} kg DM/ha
              </p>
              <div className="mt-2">
                <Badge variant="outline" className="text-orange-600">
                  {Math.round((data.lowPaddocks / data.totalPaddocks) * 100)}%
                </Badge>
              </div>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-purple-600">{data.highPaddocks}</span>
              </div>
              <h4 className="font-medium text-purple-700">High Cover</h4>
              <p className="text-sm text-muted-foreground">
                &gt;{Math.round(data.targetPreGrazing * 1.2)} kg DM/ha
              </p>
              <div className="mt-2">
                <Badge variant="outline" className="text-purple-600">
                  {Math.round((data.highPaddocks / data.totalPaddocks) * 100)}%
                </Badge>
              </div>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Overall Farm Readiness</span>
              <span className="text-sm text-muted-foreground">
                {Math.round((data.readyPaddocks / data.totalPaddocks) * 100)}%
              </span>
            </div>
            <Progress 
              value={(data.readyPaddocks / data.totalPaddocks) * 100} 
              className="h-3"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FarmMetricsDashboard;
