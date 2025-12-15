import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';
import { format, isToday, isPast, isFuture } from 'date-fns';

interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: 'morning' | 'afternoon' | 'night' | 'split' | 'custom';
  location?: string;
  tasks?: string[];
  notes?: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  breakMinutes?: number;
  isRecurring?: boolean;
  recurringPattern?: string;
  createdBy?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function RosterPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>('upcoming');
  const [formData, setFormData] = useState({
    staffId: '',
    date: '',
    startTime: '',
    endTime: '',
    shiftType: 'morning' as const,
    location: '',
    notes: '',
    isRecurring: false,
    recurringPattern: '',
  });

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      const data = await apiGet<Shift[]>('/api/roster/shifts');
      setShifts(data);
    } catch (error) {
      console.error('Failed to fetch shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/api/roster/shifts', formData);
      setFormData({
        staffId: '',
        date: '',
        startTime: '',
        endTime: '',
        shiftType: 'morning',
        location: '',
        notes: '',
        isRecurring: false,
        recurringPattern: '',
      });
      setShowForm(false);
      fetchShifts();
    } catch (error) {
      console.error('Failed to create shift:', error);
    }
  };

  const getShiftTypeColor = (type: string) => {
    switch (type) {
      case 'morning':
        return 'text-yellow-600 bg-yellow-100';
      case 'afternoon':
        return 'text-orange-600 bg-orange-100';
      case 'night':
        return 'text-indigo-600 bg-indigo-100';
      case 'split':
        return 'text-purple-600 bg-purple-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'text-blue-600 bg-blue-100';
      case 'confirmed':
        return 'text-green-600 bg-green-100';
      case 'in_progress':
        return 'text-yellow-600 bg-yellow-100';
      case 'completed':
        return 'text-gray-600 bg-gray-100';
      case 'cancelled':
        return 'text-red-600 bg-red-100';
      case 'no_show':
        return 'text-red-800 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredShifts = shifts.filter(shift => {
    const shiftDate = new Date(shift.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (filter) {
      case 'today':
        return isToday(shiftDate);
      case 'upcoming':
        return shiftDate >= today;
      case 'past':
        return shiftDate < today;
      default:
        return true;
    }
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Roster</h1>
          <p className="mt-2 text-gray-600">
            Manage staff schedules and shifts.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Add Shift'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Schedule New Shift</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="staffId" className="block text-sm font-medium text-gray-700">
                  Staff Member *
                </label>
                <select
                  id="staffId"
                  required
                  value={formData.staffId}
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select staff...</option>
                  <option value="staff-1">John Smith</option>
                  <option value="staff-2">Sarah Johnson</option>
                  <option value="staff-3">Mike Wilson</option>
                  <option value="staff-4">Emily Brown</option>
                  <option value="staff-5">David Lee</option>
                </select>
              </div>

              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                  Date *
                </label>
                <input
                  type="date"
                  id="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700">
                  Start Time *
                </label>
                <input
                  type="time"
                  id="startTime"
                  required
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700">
                  End Time *
                </label>
                <input
                  type="time"
                  id="endTime"
                  required
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="shiftType" className="block text-sm font-medium text-gray-700">
                  Shift Type
                </label>
                <select
                  id="shiftType"
                  value={formData.shiftType}
                  onChange={(e) => setFormData({ ...formData, shiftType: e.target.value as any })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="night">Night</option>
                  <option value="split">Split</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Main Shed"
                />
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Notes
              </label>
              <textarea
                id="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Additional notes for this shift..."
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Schedule Shift
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="mb-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="upcoming">Upcoming Shifts</option>
              <option value="today">Today</option>
              <option value="past">Past Shifts</option>
              <option value="all">All Shifts</option>
            </select>
          </div>

          {filteredShifts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No shifts found</p>
              <p className="text-sm mt-2">Schedule your first shift to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredShifts.map((shift) => (
                <div key={shift.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">{shift.staffName}</h3>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getShiftTypeColor(shift.shiftType)}`}>
                          {shift.shiftType}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(shift.status)}`}>
                          {shift.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>
                          {format(new Date(shift.date), 'EEEE, MMMM dd, yyyy')}
                        </p>
                        <p>
                          {shift.startTime} - {shift.endTime}
                          {shift.location && ` at ${shift.location}`}
                        </p>
                        {shift.notes && (
                          <p className="mt-1">{shift.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center space-x-2">
                      {isToday(new Date(shift.date)) && shift.status === 'scheduled' && (
                        <button
                          onClick={() => {
                            // TODO: Implement confirm shift functionality
                            console.log('Confirm shift:', shift.id);
                          }}
                          className="text-green-600 hover:text-green-900 text-sm"
                        >
                          Confirm
                        </button>
                      )}
                      {isToday(new Date(shift.date)) && shift.status === 'confirmed' && (
                        <button
                          onClick={() => {
                            // TODO: Implement start shift functionality
                            console.log('Start shift:', shift.id);
                          }}
                          className="text-blue-600 hover:text-blue-900 text-sm"
                        >
                          Start Shift
                        </button>
                      )}
                      <button
                        onClick={() => {
                          // TODO: Implement edit functionality
                          console.log('Edit shift:', shift.id);
                        }}
                        className="text-gray-600 hover:text-gray-900 text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
