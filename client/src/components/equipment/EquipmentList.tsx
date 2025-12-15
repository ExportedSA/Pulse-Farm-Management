import React, { useState, useEffect } from 'react';
import { apiGet } from '../../api';
import { format } from 'date-fns';

interface Equipment {
  id: string;
  name: string;
  type: string;
  model?: string;
  serialNumber?: string;
  manufacturer?: string;
  location?: string;
  status: 'operational' | 'maintenance_due' | 'in_maintenance' | 'out_of_service';
  lastServiceDate?: string;
  nextServiceDue?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface EquipmentListProps {
  onEquipmentUpdated?: () => void;
}

export default function EquipmentList({ onEquipmentUpdated }: EquipmentListProps) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchEquipment();
  }, [filter]);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const url = filter === 'all' ? '/api/farm-equipment' : `/api/farm-equipment?status=${filter}`;
      const data = await apiGet<Equipment[]>(url);
      setEquipment(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch equipment');
      console.error('Error fetching equipment:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'text-green-600 bg-green-100';
      case 'maintenance_due':
        return 'text-yellow-600 bg-yellow-100';
      case 'in_maintenance':
        return 'text-blue-600 bg-blue-100';
      case 'out_of_service':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const isOverdue = (nextServiceDue?: string) => {
    if (!nextServiceDue) return false;
    return new Date(nextServiceDue) < new Date();
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
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Equipment</h2>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Equipment</option>
            <option value="operational">Operational</option>
            <option value="maintenance_due">Maintenance Due</option>
            <option value="in_maintenance">In Maintenance</option>
            <option value="out_of_service">Out of Service</option>
          </select>
        </div>
      </div>

      {equipment.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No equipment found</p>
          <p className="text-sm mt-2">Add your first piece of equipment to get started</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next Service Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {equipment.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      {item.model && (
                        <div className="text-sm text-gray-500">{item.model}</div>
                      )}
                      {item.serialNumber && (
                        <div className="text-xs text-gray-400">S/N: {item.serialNumber}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.location || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {item.nextServiceDue ? (
                      <div className={isOverdue(item.nextServiceDue) ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                        {format(new Date(item.nextServiceDue), 'MMM dd, yyyy')}
                        {isOverdue(item.nextServiceDue) && (
                          <span className="ml-2 text-xs">OVERDUE</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => {
                        // TODO: Implement edit functionality
                        console.log('Edit equipment:', item.id);
                      }}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm(`Are you sure you want to mark ${item.name} as serviced?`)) {
                          // TODO: Implement mark as serviced functionality
                          console.log('Mark as serviced:', item.id);
                        }
                      }}
                      className="text-green-600 hover:text-green-900"
                    >
                      Service
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
