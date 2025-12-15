import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface Incident {
  id: string;
  type: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  occurredAt: string;
  reportedBy?: string;
  assignedTo?: string;
  location?: string;
  createdAt: string;
  resolvedAt?: string;
}

interface IncidentListProps {
  refreshTrigger?: number;
}

export const IncidentList: React.FC<IncidentListProps> = ({ refreshTrigger }) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<Incident[]>('/compliance/incidents');
      setIncidents(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch incidents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [refreshTrigger]);

  const handleStatusUpdate = async (incidentId: string, newStatus: string) => {
    try {
      setUpdating(incidentId);
      await api.patch(`/compliance/incidents/${incidentId}/status`, { status: newStatus });
      // Update local state
      setIncidents(prev => prev.map(i => 
        i.id === incidentId 
          ? { 
              ...i, 
              status: newStatus as Incident['status'],
              resolvedAt: (newStatus === 'resolved' || newStatus === 'closed') 
                ? new Date().toISOString() 
                : i.resolvedAt
            }
          : i
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update incident');
    } finally {
      setUpdating(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      minor: 'text-green-600',
      major: 'text-orange-600',
      critical: 'text-red-600',
    };
    return colors[severity as keyof typeof colors] || 'text-gray-600';
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      open: 'bg-red-100 text-red-800',
      investigating: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || styles.open}`}>
        {status}
      </span>
    );
  };

  const statusOptions = [
    { value: 'open', label: 'Open' },
    { value: 'investigating', label: 'Investigating' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
  ];

  if (loading) {
    return <div className="p-4">Loading incidents...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
          <button onClick={fetchIncidents} className="ml-4 underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="p-4 text-gray-500">
        No incidents reported. Safety is our priority!
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Incidents</h2>
      </div>
      <div className="divide-y divide-gray-200">
        {incidents.map((incident) => (
          <div key={incident.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-medium text-gray-900">
                    {incident.type.charAt(0).toUpperCase() + incident.type.slice(1)} Incident
                  </h3>
                  {getStatusBadge(incident.status)}
                </div>
                <p className="text-sm text-gray-600 mb-2">{incident.description}</p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span className={getSeverityColor(incident.severity)}>
                    Severity: {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
                  </span>
                  {incident.location && <span>Location: {incident.location}</span>}
                  <span>
                    Occurred: {new Date(incident.occurredAt).toLocaleDateString()}
                  </span>
                  <span>
                    Reported: {new Date(incident.createdAt).toLocaleDateString()}
                  </span>
                  {incident.resolvedAt && (
                    <span className="text-green-600">
                      Resolved: {new Date(incident.resolvedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="ml-4">
                <select
                  value={incident.status}
                  onChange={(e) => handleStatusUpdate(incident.id, e.target.value)}
                  disabled={updating === incident.id}
                  className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {updating === incident.id && (
                  <div className="text-xs text-gray-500 mt-1">Updating...</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
