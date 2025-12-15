import React, { useState } from 'react';
import EquipmentForm from '../components/equipment/EquipmentForm';
import EquipmentList from '../components/equipment/EquipmentList';

export default function EquipmentPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEquipmentUpdated = () => {
    // Force re-render of the equipment list
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Equipment Management</h1>
        <p className="mt-2 text-gray-600">
          Track and manage your farm equipment, maintenance schedules, and service history.
        </p>
      </div>

      <EquipmentForm onEquipmentCreated={handleEquipmentUpdated} />
      <EquipmentList key={refreshKey} onEquipmentUpdated={handleEquipmentUpdated} />
    </div>
  );
}
