import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { format } from 'date-fns';
import { 
  ClipboardList, 
  AlertTriangle, 
  Users, 
  Calendar, 
  Wrench, 
  Activity,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface DashboardSummary {
  jobs: {
    openCount: number;
    nextJob: {
      id: string;
      title: string;
      due_date: string;
      status: string;
    } | null;
  };
  hazards: {
    activeCount: number;
    topHazards: Array<{
      id: string;
      title: string;
      risk_level: string;
      location: string;
    }>;
  };
  incidents: {
    recentCount: number;
  };
  animals: {
    activeCount: number;
  };
  equipment: {
    needsAttentionCount: number;
    needsAttention: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      next_service_due: string;
    }>;
  };
  roster: {
    todayShiftsCount: number;
    nextShift: {
      id: string;
      staff_id: string;
      date: string;
      start_time: string;
      end_time: string;
      shift_type: string;
    } | null;
  };
  generatedAt: string;
}

export default function DashboardOverview() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlineStaff, setOnlineStaff] = useState<number>(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch summary data
      const response = await fetch('/api/summary', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const data = await response.json();
      setSummary(data);
      
      // Try to fetch presence data for online staff count
      try {
        const presenceResponse = await fetch('/api/presence/online', {
          credentials: 'include',
        });
        if (presenceResponse.ok) {
          const presenceData = await presenceResponse.json();
          setOnlineStaff(presenceData.length || 0);
        }
      } catch {
        // Presence endpoint might not exist, that's okay
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'maintenance_due':
        return 'text-yellow-600 bg-yellow-100';
      case 'out_of_service':
        return 'text-red-600 bg-red-100';
      case 'operational':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
          <button 
            onClick={fetchDashboardData}
            className="ml-4 text-red-600 underline hover:text-red-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome to Pulse. Here's an overview of your farm operations.
        </p>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Jobs Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ClipboardList className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900">Tasks</h3>
            </div>
            <Link href="/app/jobs">
              <a className="text-blue-600 hover:text-blue-800 text-sm flex items-center">
                View All <ChevronRight className="h-4 w-4 ml-1" />
              </a>
            </Link>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {summary?.jobs.openCount || 0}
          </div>
          <p className="text-sm text-gray-500 mb-4">Open jobs/tasks</p>
          {summary?.jobs.nextJob && (
            <div className="border-t pt-4">
              <p className="text-xs text-gray-500 uppercase mb-1">Next Due</p>
              <p className="text-sm font-medium text-gray-900 truncate">
                {summary.jobs.nextJob.title}
              </p>
              {summary.jobs.nextJob.due_date && (
                <p className="text-xs text-gray-500">
                  Due: {format(new Date(summary.jobs.nextJob.due_date), 'MMM dd, yyyy')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Hazards Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className={`p-2 rounded-lg ${summary?.hazards.activeCount ? 'bg-yellow-100' : 'bg-green-100'}`}>
                <AlertTriangle className={`h-6 w-6 ${summary?.hazards.activeCount ? 'text-yellow-600' : 'text-green-600'}`} />
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900">Hazards</h3>
            </div>
            <Link href="/app/safety">
              <a className="text-blue-600 hover:text-blue-800 text-sm flex items-center">
                View All <ChevronRight className="h-4 w-4 ml-1" />
              </a>
            </Link>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {summary?.hazards.activeCount || 0}
          </div>
          <p className="text-sm text-gray-500 mb-4">Unresolved hazards</p>
          {summary?.hazards.topHazards && summary.hazards.topHazards.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-xs text-gray-500 uppercase mb-1">Top Priority</p>
              {summary.hazards.topHazards.slice(0, 2).map((hazard) => (
                <div key={hazard.id} className="flex items-center justify-between">
                  <p className="text-sm text-gray-900 truncate flex-1">{hazard.title}</p>
                  <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded ${getRiskLevelColor(hazard.risk_level)}`}>
                    {hazard.risk_level}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staff/Roster Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900">Staff</h3>
            </div>
            <Link href="/app/roster">
              <a className="text-blue-600 hover:text-blue-800 text-sm flex items-center">
                View Roster <ChevronRight className="h-4 w-4 ml-1" />
              </a>
            </Link>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold text-gray-900">{onlineStaff}</span>
            <span className="text-sm text-gray-500">online now</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            {summary?.roster.todayShiftsCount || 0} shifts scheduled today
          </p>
          {summary?.roster.nextShift && (
            <div className="border-t pt-4">
              <p className="text-xs text-gray-500 uppercase mb-1">Next Shift</p>
              <div className="flex items-center text-sm">
                <Clock className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-gray-900">
                  {summary.roster.nextShift.date} at {summary.roster.nextShift.start_time}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Animals Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900">Animals</h3>
            </div>
            <Link href="/app/animals">
              <a className="text-blue-600 hover:text-blue-800 text-sm flex items-center">
                View All <ChevronRight className="h-4 w-4 ml-1" />
              </a>
            </Link>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {summary?.animals.activeCount || 0}
          </div>
          <p className="text-sm text-gray-500">Active animals in herd</p>
        </div>

        {/* Equipment Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className={`p-2 rounded-lg ${summary?.equipment.needsAttentionCount ? 'bg-orange-100' : 'bg-green-100'}`}>
                <Wrench className={`h-6 w-6 ${summary?.equipment.needsAttentionCount ? 'text-orange-600' : 'text-green-600'}`} />
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900">Equipment</h3>
            </div>
            <Link href="/app/equipment">
              <a className="text-blue-600 hover:text-blue-800 text-sm flex items-center">
                View All <ChevronRight className="h-4 w-4 ml-1" />
              </a>
            </Link>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {summary?.equipment.needsAttentionCount || 0}
          </div>
          <p className="text-sm text-gray-500 mb-4">Items needing attention</p>
          {summary?.equipment.needsAttention && summary.equipment.needsAttention.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-xs text-gray-500 uppercase mb-1">Needs Service</p>
              {summary.equipment.needsAttention.slice(0, 2).map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <p className="text-sm text-gray-900 truncate flex-1">{item.name}</p>
                  <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(item.status)}`}>
                    {item.status?.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Incidents Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className={`p-2 rounded-lg ${summary?.incidents.recentCount ? 'bg-red-100' : 'bg-green-100'}`}>
                <AlertCircle className={`h-6 w-6 ${summary?.incidents.recentCount ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900">Incidents</h3>
            </div>
            <Link href="/app/safety">
              <a className="text-blue-600 hover:text-blue-800 text-sm flex items-center">
                View All <ChevronRight className="h-4 w-4 ml-1" />
              </a>
            </Link>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {summary?.incidents.recentCount || 0}
          </div>
          <p className="text-sm text-gray-500">Incidents in last 7 days</p>
          {summary?.incidents.recentCount === 0 && (
            <div className="mt-4 flex items-center text-green-600">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              <span className="text-sm">No recent incidents</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/app/jobs">
            <a className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <ClipboardList className="h-8 w-8 text-blue-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Create Job</span>
            </a>
          </Link>
          <Link href="/app/safety">
            <a className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <AlertTriangle className="h-8 w-8 text-yellow-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Report Hazard</span>
            </a>
          </Link>
          <Link href="/app/animals">
            <a className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Activity className="h-8 w-8 text-green-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Add Animal</span>
            </a>
          </Link>
          <Link href="/app/chat">
            <a className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Users className="h-8 w-8 text-purple-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Team Chat</span>
            </a>
          </Link>
        </div>
      </div>

      {/* Last Updated */}
      {summary?.generatedAt && (
        <p className="mt-6 text-xs text-gray-400 text-center">
          Last updated: {format(new Date(summary.generatedAt), 'MMM dd, yyyy HH:mm:ss')}
          <button 
            onClick={fetchDashboardData}
            className="ml-2 text-blue-500 hover:text-blue-700 underline"
          >
            Refresh
          </button>
        </p>
      )}
    </div>
  );
}
