import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';
import { format } from 'date-fns';

interface Animal {
  id: string;
  visualId?: string;
  lifetimeId?: string;
  name?: string;
  breed?: string;
  dateOfBirth?: string;
  yearBorn?: number;
  sex?: 'female' | 'male';
  herd?: string;
  status: 'active' | 'sold' | 'deceased';
  milkStatus?: string;
  a2Status?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AnimalsPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [formData, setFormData] = useState({
    visualId: '',
    lifetimeId: '',
    name: '',
    breed: '',
    dateOfBirth: '',
    yearBorn: '',
    sex: '',
    herd: '',
    status: 'active' as const,
    milkStatus: '',
    a2Status: '',
    notes: '',
  });

  useEffect(() => {
    fetchAnimals();
  }, [filter]);

  const fetchAnimals = async () => {
    try {
      const url = filter === 'all' ? '/api/animals' : `/api/animals?status=${filter}`;
      const data = await apiGet<Animal[]>(url);
      setAnimals(data);
    } catch (error) {
      console.error('Failed to fetch animals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (value) {
          if (key === 'yearBorn') {
            payload[key] = parseInt(value);
          } else {
            payload[key] = value;
          }
        }
      });
      
      await apiPost('/api/animals', payload);
      setFormData({
        visualId: '',
        lifetimeId: '',
        name: '',
        breed: '',
        dateOfBirth: '',
        yearBorn: '',
        sex: '',
        herd: '',
        status: 'active',
        milkStatus: '',
        a2Status: '',
        notes: '',
      });
      setShowForm(false);
      fetchAnimals();
    } catch (error) {
      console.error('Failed to create animal:', error);
    }
  };

  const getAge = (dateOfBirth?: string, yearBorn?: number) => {
    if (dateOfBirth) {
      const birth = new Date(dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        return age - 1;
      }
      return age;
    }
    if (yearBorn) {
      return new Date().getFullYear() - yearBorn;
    }
    return null;
  };

  const filteredAnimals = animals.filter(animal => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      animal.visualId?.toLowerCase().includes(searchLower) ||
      animal.name?.toLowerCase().includes(searchLower) ||
      animal.lifetimeId?.toLowerCase().includes(searchLower) ||
      animal.breed?.toLowerCase().includes(searchLower)
    );
  });

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
          <h1 className="text-3xl font-bold text-gray-900">Animal Records</h1>
          <p className="mt-2 text-gray-600">
            Manage your livestock and track their information.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Add Animal'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Register New Animal</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="visualId" className="block text-sm font-medium text-gray-700">
                  Visual ID / Tag
                </label>
                <input
                  type="text"
                  id="visualId"
                  value={formData.visualId}
                  onChange={(e) => setFormData({ ...formData, visualId: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 1234"
                />
              </div>

              <div>
                <label htmlFor="lifetimeId" className="block text-sm font-medium text-gray-700">
                  Lifetime ID / NAIT Tag
                </label>
                <input
                  type="text"
                  id="lifetimeId"
                  value={formData.lifetimeId}
                  onChange={(e) => setFormData({ ...formData, lifetimeId: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Bessie"
                />
              </div>

              <div>
                <label htmlFor="breed" className="block text-sm font-medium text-gray-700">
                  Breed
                </label>
                <input
                  type="text"
                  id="breed"
                  value={formData.breed}
                  onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Holstein-Friesian"
                />
              </div>

              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">
                  Date of Birth
                </label>
                <input
                  type="date"
                  id="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="yearBorn" className="block text-sm font-medium text-gray-700">
                  Year Born
                </label>
                <input
                  type="number"
                  id="yearBorn"
                  value={formData.yearBorn}
                  onChange={(e) => setFormData({ ...formData, yearBorn: e.target.value })}
                  min="1900"
                  max={new Date().getFullYear()}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="sex" className="block text-sm font-medium text-gray-700">
                  Sex
                </label>
                <select
                  id="sex"
                  value={formData.sex}
                  onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>

              <div>
                <label htmlFor="herd" className="block text-sm font-medium text-gray-700">
                  Herd
                </label>
                <input
                  type="text"
                  id="herd"
                  value={formData.herd}
                  onChange={(e) => setFormData({ ...formData, herd: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Register Animal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by tag, name, or breed..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Animals</option>
              <option value="active">Active</option>
              <option value="sold">Sold</option>
              <option value="deceased">Deceased</option>
            </select>
          </div>

          {filteredAnimals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No animals found</p>
              <p className="text-sm mt-2">Register your first animal to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tag/ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Breed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sex
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Age
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAnimals.map((animal) => (
                    <tr key={animal.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {animal.visualId || animal.lifetimeId || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {animal.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {animal.breed || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {animal.sex || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getAge(animal.dateOfBirth, animal.yearBorn) ? 
                          `${getAge(animal.dateOfBirth, animal.yearBorn)} years` : 
                          '-'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          animal.status === 'active' ? 'text-green-600 bg-green-100' :
                          animal.status === 'sold' ? 'text-blue-600 bg-blue-100' :
                          'text-gray-600 bg-gray-100'
                        }`}>
                          {animal.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            // TODO: Implement edit functionality
                            console.log('Edit animal:', animal.id);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
