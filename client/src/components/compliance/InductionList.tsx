import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface InductionModule {
  id: string;
  title: string;
  description?: string;
  type: 'safety' | 'equipment' | 'biosecurity' | 'general';
  isMandatory: boolean;
  estimatedDuration?: number; // in minutes
  createdAt: string;
  updatedAt: string;
}

interface InductionCompletion {
  id: string;
  moduleId: string;
  userId: string;
  completedAt: string;
  score?: number;
}

interface InductionListProps {
  userId?: string;
}

export const InductionList: React.FC<InductionListProps> = ({ userId }) => {
  const [modules, setModules] = useState<InductionModule[]>([]);
  const [completions, setCompletions] = useState<InductionCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInductions = async () => {
    try {
      setLoading(true);
      setError(null);
      const [modulesResponse, completionsResponse] = await Promise.all([
        api.get<InductionModule[]>('/compliance/inductions'),
        userId ? api.get<InductionCompletion[]>(`/compliance/inductions/completions?userId=${userId}`) : []
      ]);
      setModules(modulesResponse);
      setCompletions(completionsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch induction modules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInductions();
  }, [userId]);

  const getTypeColor = (type: string) => {
    const colors = {
      safety: 'text-red-600',
      equipment: 'text-blue-600',
      biosecurity: 'text-green-600',
      general: 'text-gray-600',
    };
    return colors[type as keyof typeof colors] || 'text-gray-600';
  };

  const isCompleted = (moduleId: string) => {
    return completions.some(c => c.moduleId === moduleId);
  };

  const getCompletionDate = (moduleId: string) => {
    const completion = completions.find(c => c.moduleId === moduleId);
    return completion ? new Date(completion.completedAt).toLocaleDateString() : null;
  };

  if (loading) {
    return <div className="p-4">Loading induction modules...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
          <button onClick={fetchInductions} className="ml-4 underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="p-4 text-gray-500">
        No induction modules available.
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Induction Modules</h2>
      </div>
      <div className="divide-y divide-gray-200">
        {modules.map((module) => {
          const completed = isCompleted(module.id);
          const completionDate = getCompletionDate(module.id);
          
          return (
            <div key={module.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-medium text-gray-900">
                      {module.title}
                    </h3>
                    {module.isMandatory && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        Mandatory
                      </span>
                    )}
                    {completed && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Completed
                      </span>
                    )}
                  </div>
                  {module.description && (
                    <p className="text-sm text-gray-600 mb-2">{module.description}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                    <span className={getTypeColor(module.type)}>
                      Type: {module.type.charAt(0).toUpperCase() + module.type.slice(1)}
                    </span>
                    {module.estimatedDuration && (
                      <span>Duration: {module.estimatedDuration} minutes</span>
                    )}
                    <span>
                      Created: {new Date(module.createdAt).toLocaleDateString()}
                    </span>
                    {completionDate && (
                      <span className="text-green-600">
                        Completed: {completionDate}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-4">
                  {!completed && (
                    <button
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={() => {
                        // TODO: Navigate to induction module or open modal
                        alert(`Opening induction module: ${module.title}`);
                      }}
                    >
                      Start
                    </button>
                  )}
                  {completed && (
                    <button
                      className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      onClick={() => {
                        // TODO: View completion details or retake
                        alert(`Viewing completion details for: ${module.title}`);
                      }}
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
