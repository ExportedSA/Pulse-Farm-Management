import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, ChevronLeft, ChevronRight, RotateCcw, Play, Check } from 'lucide-react';
import { format, addDays, startOfWeek, addWeeks, isSameDay, isToday } from 'date-fns';

interface Paddock {
  id: string;
  name: string;
  area: number;
  cover: number;
  status: 'ready' | 'grazing' | 'resting' | 'growing';
  lastGrazed?: Date;
  nextGrazeDue?: Date;
}

interface RotationCalendarProps {
  paddocks: Paddock[];
  rotationLength: number;
  onDateChange?: (date: Date) => void;
  onPaddockClick?: (paddock: Paddock) => void;
}

const RotationCalendar: React.FC<RotationCalendarProps> = ({
  paddocks,
  rotationLength,
  onDateChange,
  onPaddockClick,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  const weekStart = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-500';
      case 'grazing': return 'bg-blue-500';
      case 'resting': return 'bg-orange-500';
      case 'growing': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready': return <Badge className="bg-green-100 text-green-800">Ready</Badge>;
      case 'grazing': return <Badge className="bg-blue-100 text-blue-800">Grazing</Badge>;
      case 'resting': return <Badge className="bg-orange-100 text-orange-800">Resting</Badge>;
      case 'growing': return <Badge className="bg-purple-100 text-purple-800">Growing</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getCoverColor = (cover: number, target: number = 2800) => {
    if (cover >= target) return 'text-green-600';
    if (cover >= target * 0.8) return 'text-blue-600';
    if (cover >= target * 0.6) return 'text-orange-600';
    return 'text-red-600';
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' ? addWeeks(currentDate, -1) : addWeeks(currentDate, 1);
    setCurrentDate(newDate);
    onDateChange?.(newDate);
  };

  const resetToToday = () => {
    setCurrentDate(new Date());
    onDateChange?.(new Date());
  };

  // Simulate rotation schedule
  const getRotationSchedule = (date: Date) => {
    const dayIndex = Math.floor((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    const paddocksPerDay = Math.ceil(paddocks.length / rotationLength);
    const startIndex = (dayIndex + rotationLength) % paddocks.length;
    
    return paddocks.slice(startIndex, startIndex + paddocksPerDay);
  };

  return (
    <div className="space-y-6">
      {/* Calendar Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Rotation Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'week' ? 'month' : 'week')}
              >
                {viewMode === 'week' ? 'Month View' : 'Week View'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetToToday}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Today
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <h3 className="text-lg font-semibold">
              {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </h3>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Week View */}
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, index) => {
              const dayPaddocks = getRotationSchedule(day);
              const isCurrentDay = isToday(day);
              
              return (
                <div
                  key={index}
                  className={`border rounded-lg p-3 min-h-32 ${
                    isCurrentDay ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="text-center mb-2">
                    <p className="text-sm font-medium">
                      {format(day, 'EEE')}
                    </p>
                    <p className={`text-lg font-bold ${
                      isCurrentDay ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {format(day, 'd')}
                    </p>
                    {isCurrentDay && (
                      <Badge variant="outline" className="text-xs mt-1">
                        Today
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    {dayPaddocks.slice(0, 3).map((paddock) => (
                      <div
                        key={paddock.id}
                        className="text-xs p-1 rounded cursor-pointer hover:bg-gray-100"
                        onClick={() => onPaddockClick?.(paddock)}
                      >
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(paddock.status)}`} />
                          <span className="font-medium truncate">{paddock.name}</span>
                        </div>
                        <p className={`text-xs ${getCoverColor(paddock.cover)}`}>
                          {paddock.cover} kg/ha
                        </p>
                      </div>
                    ))}
                    {dayPaddocks.length > 3 && (
                      <p className="text-xs text-gray-500 text-center">
                        +{dayPaddocks.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Paddock Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Paddock Rotation Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paddocks.map((paddock) => (
              <div
                key={paddock.id}
                className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => onPaddockClick?.(paddock)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium">{paddock.name}</h4>
                    <p className="text-sm text-muted-foreground">{paddock.area} ha</p>
                  </div>
                  {getStatusBadge(paddock.status)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Cover:</span>
                    <span className={`text-sm font-medium ${getCoverColor(paddock.cover)}`}>
                      {paddock.cover} kg/ha
                    </span>
                  </div>
                  
                  {paddock.lastGrazed && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Last grazed:</span>
                      <span className="text-sm">
                        {format(paddock.lastGrazed, 'MMM d')}
                      </span>
                    </div>
                  )}
                  
                  {paddock.nextGrazeDue && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Due:</span>
                      <span className="text-sm font-medium">
                        {format(paddock.nextGrazeDue, 'MMM d')}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Play className="h-3 w-3 mr-1" />
                    Start Grazing
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Check className="h-3 w-3 mr-1" />
                    Complete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rotation Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Rotation Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-700">Ready Paddocks</h4>
              <p className="text-2xl font-bold text-green-600">
                {paddocks.filter(p => p.status === 'ready').length}
              </p>
              <p className="text-sm text-green-600">
                Available for grazing
              </p>
            </div>
            
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-700">Currently Grazing</h4>
              <p className="text-2xl font-bold text-blue-600">
                {paddocks.filter(p => p.status === 'grazing').length}
              </p>
              <p className="text-sm text-blue-600">
                Active rotation
              </p>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <h4 className="font-medium text-orange-700">Resting</h4>
              <p className="text-2xl font-bold text-orange-600">
                {paddocks.filter(p => p.status === 'resting').length}
              </p>
              <p className="text-sm text-orange-600">
                Recovery period
              </p>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <h4 className="font-medium text-purple-700">Growing</h4>
              <p className="text-2xl font-bold text-purple-600">
                {paddocks.filter(p => p.status === 'growing').length}
              </p>
              <p className="text-sm text-purple-600">
                Building cover
              </p>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">Rotation Efficiency</h4>
                <p className="text-sm text-muted-foreground">
                  Based on {rotationLength}-day rotation target
                </p>
              </div>
              <Badge variant="outline" className="text-green-600">
                Optimal
              </Badge>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-sm mb-1">
                <span>Utilization Rate</span>
                <span>85%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RotationCalendar;
