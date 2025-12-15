import React, { useState } from 'react';
import { api } from '../../lib/api';

interface IncidentFormProps {
  onSuccess?: () => void;
}

interface FormData {
  type: string;
  description: string;
  occurredAt: string;
  severity: 'minor' | 'major' | 'critical';
  location: string;
}

const incidentTypes = [
  'injury',
  'near miss',
  'property damage',
  'equipment failure',
  'chemical exposure',
  'animal related',
  'vehicle incident',
  'fire',
  'theft',
  'other'
];

export const IncidentForm: React.FC<IncidentFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState<FormData>({
    type: 'other',
    description: '',
    occurredAt: new Date().toISOString().slice(0, 16), // Format for datetime-local input
    severity: 'minor',
    location: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.description.trim()) {
      setError('Description is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      await api.post('/compliance/incidents', {
        ...formData,
        occurredAt: new Date(formData.occurredAt).toISOString()
      });
      
      setSuccess(true);
      setFormData({
        type: 'other',
        description: '',
        occurredAt: new Date().toISOString().slice(0, 16),
        severity: 'minor',
        location: ''
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to report incident');
    } finally {
      setSubmitting(false);
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

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Report New Incident</h2>
      
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          Incident reported successfully!
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Incident Type
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {incidentTypes.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="severity" className="block text-sm font-medium text-gray-700 mb-1">
              Severity
            </label>
            <select
              id="severity"
              name="severity"
              value={formData.severity}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${getSeverityColor(formData.severity)}`}
            >
              <option value="minor">Minor</option>
              <option value="major">Major</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe what happened in detail"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="occurredAt" className="block text-sm font-medium text-gray-700 mb-1">
              Date & Time Occurred
            </label>
            <input
              type="datetime-local"
              id="occurredAt"
              name="occurredAt"
              value={formData.occurredAt}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Where did this happen?"
            />
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="text-sm text-yellow-800">
            <strong>Important:</strong> For serious injuries or emergencies, 
            call emergency services immediately. This form is for documentation purposes.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Reporting...' : 'Report Incident'}
          </button>
        </div>
      </form>
    </div>
  );
};
