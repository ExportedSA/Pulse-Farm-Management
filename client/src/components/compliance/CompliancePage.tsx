import React, { useState } from 'react';
import { HazardList } from './HazardList';
import { HazardForm } from './HazardForm';
import { IncidentList } from './IncidentList';
import { IncidentForm } from './IncidentForm';
import { InductionList } from './InductionList';
import { CheckInForm } from './CheckInForm';

type TabType = 'hazards' | 'incidents' | 'inductions' | 'checkin';

export const CompliancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('hazards');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const tabs = [
    { id: 'hazards' as TabType, label: 'Hazards', icon: '⚠️' },
    { id: 'incidents' as TabType, label: 'Incidents', icon: '🚨' },
    { id: 'inductions' as TabType, label: 'Inductions', icon: '📚' },
    { id: 'checkin' as TabType, label: 'Check-In', icon: '✅' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Compliance & Safety</h1>
        <p className="mt-2 text-gray-600">
          Manage hazards, incidents, safety inductions, and visitor check-ins
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'hazards' && (
          <>
            <HazardForm onSuccess={handleRefresh} />
            <HazardList refreshTrigger={refreshTrigger} />
          </>
        )}

        {activeTab === 'incidents' && (
          <>
            <IncidentForm onSuccess={handleRefresh} />
            <IncidentList refreshTrigger={refreshTrigger} />
          </>
        )}

        {activeTab === 'inductions' && (
          <InductionList />
        )}

        {activeTab === 'checkin' && (
          <CheckInForm onSuccess={() => {
            // Could show a success message or navigate
            console.log('Check-in completed');
          }} />
        )}
      </div>

      {/* Quick Stats */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Hazards
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">2</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">🚨</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Open Incidents
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">1</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">📚</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Pending Inductions
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">3</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
