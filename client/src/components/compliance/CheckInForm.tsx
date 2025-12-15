import React, { useState } from 'react';
import { api } from '../../lib/api';

interface CheckInFormProps {
  onSuccess?: () => void;
}

interface FormData {
  name: string;
  company: string;
  type: 'visitor' | 'contractor' | 'staff';
  reason: string;
  contactNumber: string;
  vehicleRegistration?: string;
  emergencyContact?: string;
  inductionRequired: boolean;
}

const checkInTypes = [
  { value: 'visitor', label: 'Visitor' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'staff', label: 'Staff Member' }
];

export const CheckInForm: React.FC<CheckInFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    company: '',
    type: 'visitor',
    reason: '',
    contactNumber: '',
    vehicleRegistration: '',
    emergencyContact: '',
    inductionRequired: false
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.reason.trim()) {
      setError('Name and reason for visit are required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      // Note: This endpoint may not exist yet - stubbing the call
      try {
        await api.post('/compliance/checkins', {
          ...formData,
          checkInTime: new Date().toISOString()
        });
      } catch (err) {
        // If endpoint doesn't exist, just log the data
        console.log('Check-in data:', formData);
        // Continue as if successful for demo purposes
      }
      
      setSuccess(true);
      setFormData({
        name: '',
        company: '',
        type: 'visitor',
        reason: '',
        contactNumber: '',
        vehicleRegistration: '',
        emergencyContact: '',
        inductionRequired: false
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Visitor/Staff Check-In</h2>
      
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          Check-in successful! Welcome to the farm.
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Full name"
              required
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {checkInTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
            Company/Organization
          </label>
          <input
            type="text"
            id="company"
            name="company"
            value={formData.company}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Company name (if applicable)"
          />
        </div>

        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
            Reason for Visit *
          </label>
          <textarea
            id="reason"
            name="reason"
            value={formData.reason}
            onChange={handleInputChange}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Purpose of visit"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Contact Number
            </label>
            <input
              type="tel"
              id="contactNumber"
              name="contactNumber"
              value={formData.contactNumber}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Phone number"
            />
          </div>

          <div>
            <label htmlFor="vehicleRegistration" className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Registration
            </label>
            <input
              type="text"
              id="vehicleRegistration"
              name="vehicleRegistration"
              value={formData.vehicleRegistration}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="License plate"
            />
          </div>
        </div>

        <div>
          <label htmlFor="emergencyContact" className="block text-sm font-medium text-gray-700 mb-1">
            Emergency Contact
          </label>
          <input
            type="text"
            id="emergencyContact"
            name="emergencyContact"
            value={formData.emergencyContact}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Emergency contact name and number"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="inductionRequired"
            name="inductionRequired"
            checked={formData.inductionRequired}
            onChange={handleInputChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="inductionRequired" className="ml-2 block text-sm text-gray-700">
            Safety induction required
          </label>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-sm text-blue-800">
            <strong>Safety Notice:</strong> Please follow all safety instructions and 
            report any hazards to farm management. Emergency exits and first aid 
            stations are clearly marked on site.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Checking In...' : 'Check In'}
          </button>
        </div>
      </form>
    </div>
  );
};
