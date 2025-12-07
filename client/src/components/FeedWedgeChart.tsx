import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FeedWedgeData {
  name: string;
  cover: number;
  target: number;
  status: 'ready' | 'low' | 'high' | 'optimal';
}

interface FeedWedgeChartProps {
  data: FeedWedgeData[];
  targetPreGrazing: number;
  targetPostGrazing: number;
}

const FeedWedgeChart: React.FC<FeedWedgeChartProps> = ({ 
  data, 
  targetPreGrazing, 
  targetPostGrazing 
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return '#10b981'; // green
      case 'optimal': return '#3b82f6'; // blue
      case 'low': return '#f59e0b'; // amber
      case 'high': return '#8b5cf6'; // purple
      default: return '#6b7280'; // gray
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm">Cover: {data.cover} kg DM/ha</p>
          <p className="text-sm">Target: {data.target} kg DM/ha</p>
          <Badge variant="outline" className="mt-1">
            {data.status}
          </Badge>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feed Wedge Analysis</CardTitle>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span>Ready to Graze (≥{targetPreGrazing})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded" />
            <span>Post Grazing Residual (≤{targetPostGrazing})</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis 
              label={{ value: 'Cover (kg DM/ha)', angle: -90, position: 'insideLeft' }}
              domain={[0, 4000]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="cover" name="Current Cover" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
              ))}
            </Bar>
            <Bar 
              dataKey="target" 
              name="Target Cover" 
              fill="#e5e7eb" 
              opacity={0.6}
            />
          </BarChart>
        </ResponsiveContainer>
        
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">
              {data.filter(d => d.status === 'ready').length}
            </p>
            <p className="text-sm text-green-700">Ready Paddocks</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">
              {data.filter(d => d.status === 'optimal').length}
            </p>
            <p className="text-sm text-blue-700">Optimal Paddocks</p>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-lg">
            <p className="text-2xl font-bold text-amber-600">
              {data.filter(d => d.status === 'low').length}
            </p>
            <p className="text-sm text-amber-700">Low Cover</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">
              {data.filter(d => d.status === 'high').length}
            </p>
            <p className="text-sm text-purple-700">High Cover</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeedWedgeChart;
