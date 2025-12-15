import React, { useState } from 'react';
import { apiPost } from '../../api';

interface EquipmentFormProps {
  onEquipmentCreated?: () => void;
}

export default function EquipmentForm({ onEquipmentCreated }: EquipmentFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    model: '',
    serialNumber: '',
    manufacturer: '',
    yearManufactured: '',
    purchaseDate: '',
    purchasePrice: '',
    location: '',
    status: 'operational' as const,
    lastServiceDate: '',
    nextServiceDue: '',
    serviceIntervalDays: '',
    warrantyExpiry: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        name: formData.name,
        type: formData.type,
        status: formData.status,
      };

      // Only include non-empty fields
      if (formData.model) payload.model = formData.model;
      if (formData.serialNumber) payload.serialNumber = formData.serialNumber;
      if (formData.manufacturer) payload.manufacturer = formData.manufacturer;
      if (formData.yearManufactured) payload.yearManufactured = parseInt(formData.yearManufactured);
      if (formData.purchaseDate) payload.purchaseDate = formData.purchaseDate;
      if (formData.purchasePrice) payload.purchasePrice = formData.purchasePrice;
      if (formData.location) payload.location = formData.location;
      if (formData.lastServiceDate) payload.lastServiceDate = formData.lastServiceDate;
      if (formData.nextServiceDue) payload.nextServiceDue = formData.nextServiceDue;
      if (formData.serviceIntervalDays) payload.serviceIntervalDays = parseInt(formData.serviceIntervalDays);
      if (formData.warrantyExpiry) payload.warrantyExpiry = formData.warrantyExpiry;
      if (formData.notes) payload.notes = formData.notes;

      await apiPost('/api/farm-equipment', payload);
      
      // Reset form
      setFormData({
        name: '',
        type: '',
        model: '',
        serialNumber: '',
        manufacturer: '',
        yearManufactured: '',
        purchaseDate: '',
        purchasePrice: '',
        location: '',
        status: 'operational',
        lastServiceDate: '',
        nextServiceDue: '',
        serviceIntervalDays: '',
        warrantyExpiry: '',
        notes: '',
      });

      onEquipmentCreated?.();
    } catch (err) {
      setError('Failed to create equipment');
      console.error('Error creating equipment:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Equipment</h3>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Tractor 1"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700">
              Type *
            </label>
            <input
              type="text"
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Tractor, Milk Pump, Drone"
            />
          </div>

          <div>
            <label htmlFor="model" className="block text-sm font-medium text-gray-700">
              Model
            </label>
            <input
              type="text"
              id="model"
              name="model"
              value={formData.model}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., John Deere 5075E"
            />
          </div>

          <div>
            <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700">
              Serial Number
            </label>
            <input
              type="text"
              id="serialNumber"
              name="serialNumber"
              value={formData.serialNumber}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="manufacturer" className="block text-sm font-medium text-gray-700">
              Manufacturer
            </label>
            <input
              type="text"
              id="manufacturer"
              name="manufacturer"
              value={formData.manufacturer}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., John Deere"
            />
          </div>

          <div>
            <label htmlFor="yearManufactured" className="block text-sm font-medium text-gray-700">
              Year Manufactured
            </label>
            <input
              type="number"
              id="yearManufactured"
              name="yearManufactured"
              value={formData.yearManufactured}
              onChange={handleChange}
              min="1900"
              max={new Date().getFullYear()}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700">
              Location
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Main Shed"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="operational">Operational</option>
              <option value="maintenance_due">Maintenance Due</option>
              <option value="in_maintenance">In Maintenance</option>
              <option value="out_of_service">Out of Service</option>
            </select>
          </div>

          <div>
            <label htmlFor="purchaseDate" className="block text-sm font-medium text-gray-700">
              Purchase Date
            </label>
            <input
              type="date"
              id="purchaseDate"
              name="purchaseDate"
              value={formData.purchaseDate}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="purchasePrice" className="block text-sm font-medium text-gray-700">
              Purchase Price
            </label>
            <input
              type="number"
              id="purchasePrice"
              name="purchasePrice"
              value={formData.purchasePrice}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label htmlFor="lastServiceDate" className="block text-sm font-medium text-gray-700">
              Last Service Date
            </label>
            <input
              type="date"
              id="lastServiceDate"
              name="lastServiceDate"
              value={formData.lastServiceDate}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="nextServiceDue" className="block text-sm font-medium text-gray-700">
              Next Service Due
            </label>
            <input
              type="date"
              id="nextServiceDue"
              name="nextServiceDue"
              value={formData.nextServiceDue}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="serviceIntervalDays" className="block text-sm font-medium text-gray-700">
              Service Interval (days)
            </label>
            <input
              type="number"
              id="serviceIntervalDays"
              name="serviceIntervalDays"
              value={formData.serviceIntervalDays}
              onChange={handleChange}
              min="1"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 90"
            />
          </div>

          <div>
            <label htmlFor="warrantyExpiry" className="block text-sm font-medium text-gray-700">
              Warranty Expiry
            </label>
            <input
              type="date"
              id="warrantyExpiry"
              name="warrantyExpiry"
              value={formData.warrantyExpiry}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="Additional notes about this equipment..."
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Add Equipment'}
          </button>
        </div>
      </form>
    </div>
  );
}
