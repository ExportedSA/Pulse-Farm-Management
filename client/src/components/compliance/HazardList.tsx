import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface Hazard {
  id: string;
  title: string;
  description?: string;
  type: string;
  severity: string;
  riskLevel: number;
  status: 'active' | 'resolved' | 'monitoring';
  location?: string;
  reportedBy?: string;
  assignedTo?: string;
  createdAt: string;
  resolvedAt?: string;
}

interface HazardListProps {
  refreshTrigger?: number;
}

export const HazardList: React.FC<HazardListProps> = ({ refreshTrigger }) => {
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchHazards = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<Hazard[]>('/compliance/hazards');
      setHazards(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch hazards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHazards();
  }, [refreshTrigger]);

  const handleResolve = async (hazardId: string) => {
    try {
      setResolving(hazardId);
      await api.post(`/compliance/hazards/${hazardId}/resolve`);
      // Update local state
      setHazards(prev => prev.map(h => 
        h.id === hazardId 
          ? { ...h, status: 'resolved', resolvedAt: new Date().toISOString() }
          : h
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve hazard');
    } finally {
      setResolving(null);
    }
  };

  const getRiskLevelColor = (level: number) => {
    if (level <= 2) return 'text-green-600';
    if (level <= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-red-100 text-red-800',
      resolved: 'bg-green-100 text-green-800',
      monitoring: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || styles.active}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return <div className="p-4">Loading hazards...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
          <button onClick={fetchHazards} className="ml-4 underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (hazards.length === 0) {
    return (
      <div className="p-4 text-gray-500">
        No hazards reported. Great job maintaining a safe environment!
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Farm Hazards</h2>
      </div>
      <div className="divide-y divide-gray-200">
        {hazards.map((hazard) => (
          <div key={hazard.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-medium text-gray-900">
                    {hazard.title}
                  </h3>
                  {getStatusBadge(hazard.status)}
                </div>
                {hazard.description && (
                  <p className="text-sm text-gray-600 mb-2">{hazard.description}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span>Type: {hazard.type}</span>
                  <span>Severity: {hazard.severity}</span>
                  <span className={getRiskLevelColor(hazard.riskLevel)}>
                    Risk Level: {hazard.riskLevel}/5
                  </span>
                  {hazard.location && <span>Location: {hazard.location}</span>}
                  <span>
                    Reported: {new Date(hazard.createdAt).toLocaleDateString()}
                  </span>
                  {hazard.resolvedAt && (
                    <span className="text-green-600">
                      Resolved: {new Date(hazard.resolvedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="ml-4">
                {hazard.status === 'active' && (
                  <button
                    onClick={() => handleResolve(hazard.id)}
                    disabled={resolving === hazard.id}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {resolving === hazard.id ? 'Resolving...' : 'Resolve'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
