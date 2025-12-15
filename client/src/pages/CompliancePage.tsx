import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';
import { format } from 'date-fns';

interface Hazard {
  id: string;
  title: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
  status: 'open' | 'in_progress' | 'resolved';
  reportedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  type: 'injury' | 'near_miss' | 'property_damage' | 'environmental' | 'other';
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  location?: string;
  status: 'open' | 'investigating' | 'resolved';
  reportedBy: string;
  dateOccurred: string;
  createdAt: string;
  updatedAt: string;
}

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<'hazards' | 'incidents'>('hazards');
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHazardForm, setShowHazardForm] = useState(false);
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  
  const [hazardFormData, setHazardFormData] = useState({
    title: '',
    description: '',
    riskLevel: 'medium' as const,
    location: '',
  });
  
  const [incidentFormData, setIncidentFormData] = useState({
    title: '',
    description: '',
    type: 'near_miss' as const,
    severity: 'minor' as const,
    location: '',
    dateOccurred: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [hazardsData, incidentsData] = await Promise.all([
        apiGet<Hazard[]>('/api/compliance/hazards'),
        apiGet<Incident[]>('/api/compliance/incidents'),
      ]);
      setHazards(hazardsData);
      setIncidents(incidentsData);
    } catch (error) {
      console.error('Failed to fetch compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHazardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/api/compliance/hazards', hazardFormData);
      setHazardFormData({ title: '', description: '', riskLevel: 'medium', location: '' });
      setShowHazardForm(false);
      fetchData();
    } catch (error) {
      console.error('Failed to create hazard:', error);
    }
  };

  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/api/compliance/incidents', incidentFormData);
      setIncidentFormData({ 
        title: '', 
        description: '', 
        type: 'near_miss', 
        severity: 'minor', 
        location: '', 
        dateOccurred: format(new Date(), 'yyyy-MM-dd')
      });
      setShowIncidentForm(false);
      fetchData();
    } catch (error) {
      console.error('Failed to create incident:', error);
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'text-green-600 bg-green-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'text-red-600 bg-red-100';
      case 'in_progress':
      case 'investigating':
        return 'text-yellow-600 bg-yellow-100';
      case 'resolved':
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Compliance & Safety</h1>
        <p className="mt-2 text-gray-600">
          Manage hazards, incidents, and maintain compliance records.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('hazards')}
              className={`py-4 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'hazards'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Hazards ({hazards.length})
            </button>
            <button
              onClick={() => setActiveTab('incidents')}
              className={`py-4 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'incidents'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Incidents ({incidents.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'hazards' ? (
            <div>
              <div className="mb-6 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Hazard Management</h2>
                <button
                  onClick={() => setShowHazardForm(!showHazardForm)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  {showHazardForm ? 'Cancel' : 'Report Hazard'}
                </button>
              </div>

              {showHazardForm && (
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Report New Hazard</h3>
                  <form onSubmit={handleHazardSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="hazardTitle" className="block text-sm font-medium text-gray-700">
                        Title *
                      </label>
                      <input
                        type="text"
                        id="hazardTitle"
                        required
                        value={hazardFormData.title}
                        onChange={(e) => setHazardFormData({ ...hazardFormData, title: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Slippery floor in milking shed"
                      />
                    </div>

                    <div>
                      <label htmlFor="hazardDescription" className="block text-sm font-medium text-gray-700">
                        Description *
                      </label>
                      <textarea
                        id="hazardDescription"
                        required
                        rows={3}
                        value={hazardFormData.description}
                        onChange={(e) => setHazardFormData({ ...hazardFormData, description: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Describe the hazard and potential risks..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="riskLevel" className="block text-sm font-medium text-gray-700">
                          Risk Level *
                        </label>
                        <select
                          id="riskLevel"
                          value={hazardFormData.riskLevel}
                          onChange={(e) => setHazardFormData({ ...hazardFormData, riskLevel: e.target.value as any })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="hazardLocation" className="block text-sm font-medium text-gray-700">
                          Location
                        </label>
                        <input
                          type="text"
                          id="hazardLocation"
                          value={hazardFormData.location}
                          onChange={(e) => setHazardFormData({ ...hazardFormData, location: e.target.value })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., Milking Shed"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        Report Hazard
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {hazards.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">No hazards reported</p>
                  <p className="text-sm mt-2">Report a hazard to maintain workplace safety</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {hazards.map((hazard) => (
                    <div key={hazard.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-medium text-gray-900">{hazard.title}</h3>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskLevelColor(hazard.riskLevel)}`}>
                              {hazard.riskLevel.toUpperCase()}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(hazard.status)}`}>
                              {hazard.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{hazard.description}</p>
                          <div className="text-xs text-gray-500">
                            {hazard.location && <span>Location: {hazard.location} • </span>}
                            Reported by {hazard.reportedBy} on {format(new Date(hazard.createdAt), 'MMM dd, yyyy')}
                          </div>
                        </div>
                        <div className="ml-4">
                          {hazard.status !== 'resolved' && (
                            <button
                              onClick={() => {
                                // TODO: Implement resolve functionality
                                console.log('Resolve hazard:', hazard.id);
                              }}
                              className="text-green-600 hover:text-green-900 text-sm"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-6 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Incident Reporting</h2>
                <button
                  onClick={() => setShowIncidentForm(!showIncidentForm)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  {showIncidentForm ? 'Cancel' : 'Report Incident'}
                </button>
              </div>

              {showIncidentForm && (
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Report New Incident</h3>
                  <form onSubmit={handleIncidentSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="incidentTitle" className="block text-sm font-medium text-gray-700">
                        Title *
                      </label>
                      <input
                        type="text"
                        id="incidentTitle"
                        required
                        value={incidentFormData.title}
                        onChange={(e) => setIncidentFormData({ ...incidentFormData, title: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Minor slip in milking shed"
                      />
                    </div>

                    <div>
                      <label htmlFor="incidentDescription" className="block text-sm font-medium text-gray-700">
                        Description *
                      </label>
                      <textarea
                        id="incidentDescription"
                        required
                        rows={3}
                        value={incidentFormData.description}
                        onChange={(e) => setIncidentFormData({ ...incidentFormData, description: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Describe what happened..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="incidentType" className="block text-sm font-medium text-gray-700">
                          Type *
                        </label>
                        <select
                          id="incidentType"
                          value={incidentFormData.type}
                          onChange={(e) => setIncidentFormData({ ...incidentFormData, type: e.target.value as any })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="injury">Injury</option>
                          <option value="near_miss">Near Miss</option>
                          <option value="property_damage">Property Damage</option>
                          <option value="environmental">Environmental</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="severity" className="block text-sm font-medium text-gray-700">
                          Severity *
                        </label>
                        <select
                          id="severity"
                          value={incidentFormData.severity}
                          onChange={(e) => setIncidentFormData({ ...incidentFormData, severity: e.target.value as any })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="minor">Minor</option>
                          <option value="moderate">Moderate</option>
                          <option value="major">Major</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="dateOccurred" className="block text-sm font-medium text-gray-700">
                          Date Occurred *
                        </label>
                        <input
                          type="date"
                          id="dateOccurred"
                          required
                          value={incidentFormData.dateOccurred}
                          onChange={(e) => setIncidentFormData({ ...incidentFormData, dateOccurred: e.target.value })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="incidentLocation" className="block text-sm font-medium text-gray-700">
                        Location
                      </label>
                      <input
                        type="text"
                        id="incidentLocation"
                        value={incidentFormData.location}
                        onChange={(e) => setIncidentFormData({ ...incidentFormData, location: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Milking Shed"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        Report Incident
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {incidents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">No incidents reported</p>
                  <p className="text-sm mt-2">Report incidents to maintain accurate safety records</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {incidents.map((incident) => (
                    <div key={incident.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-medium text-gray-900">{incident.title}</h3>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              incident.severity === 'minor' ? 'text-green-600 bg-green-100' :
                              incident.severity === 'moderate' ? 'text-yellow-600 bg-yellow-100' :
                              incident.severity === 'major' ? 'text-orange-600 bg-orange-100' :
                              'text-red-600 bg-red-100'
                            }`}>
                              {incident.severity.toUpperCase()}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(incident.status)}`}>
                              {incident.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{incident.description}</p>
                          <div className="text-xs text-gray-500">
                            <span className="capitalize">{incident.type.replace('_', ' ')}</span>
                            {incident.location && <span> • Location: {incident.location}</span>}
                            <span> • Occurred: {format(new Date(incident.dateOccurred), 'MMM dd, yyyy')}</span>
                            <span> • Reported by {incident.reportedBy}</span>
                          </div>
                        </div>
                        <div className="ml-4">
                          {incident.status !== 'resolved' && (
                            <button
                              onClick={() => {
                                // TODO: Implement resolve functionality
                                console.log('Resolve incident:', incident.id);
                              }}
                              className="text-green-600 hover:text-green-900 text-sm"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
