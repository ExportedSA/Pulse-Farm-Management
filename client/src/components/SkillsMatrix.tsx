import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock,
  Award,
  Filter,
  Download,
  Eye,
  Calendar,
  Target,
  TrendingUp,
  UserCheck
} from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  category: string;
  required: boolean;
  description: string;
}

interface WorkerSkill {
  workerId: string;
  skillId: string;
  competencyLevel: 'competent' | 'needs_training' | 'not_assessed' | 'expired';
  lastAssessed: string;
  nextAssessment: string;
  assessor: string;
  notes: string;
}

interface Worker {
  id: string;
  name: string;
  role: string;
  department: string;
  startDate: string;
  status: 'active' | 'inactive' | 'contractor';
}

interface SkillsMatrixProps {
  workers?: Worker[];
  skills?: Skill[];
  workerSkills?: WorkerSkill[];
}

export default function SkillsMatrix({ 
  workers = [],
  skills = [],
  workerSkills = []
}: SkillsMatrixProps) {
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // Sample data for demonstration
  const sampleWorkers: Worker[] = [
    { id: '1', name: 'Sarah Wilson', role: 'Farm Worker', department: 'Dairy', startDate: '2024-11-15', status: 'active' },
    { id: '2', name: 'Tom Brown', role: 'Farm Manager', department: 'Dairy', startDate: '2023-03-10', status: 'active' },
    { id: '3', name: 'Mike Johnson', role: 'Electrician', department: 'Maintenance', startDate: '2024-01-20', status: 'contractor' },
    { id: '4', name: 'Lisa Chen', role: 'Milker', department: 'Dairy', startDate: '2024-06-01', status: 'active' },
    { id: '5', name: 'James Smith', role: 'General Hand', department: 'Mixed', startDate: '2024-09-15', status: 'active' }
  ];

  const sampleSkills: Skill[] = [
    { id: 'atv', name: 'ATV Operation', category: 'Machinery', required: true, description: 'Safe operation of quad bikes' },
    { id: 'tractor', name: 'Tractor Operation', category: 'Machinery', required: true, description: 'Basic tractor and PTO operation' },
    { id: 'animal', name: 'Animal Handling', category: 'Livestock', required: true, description: 'Cattle handling and yard work' },
    { id: 'milking', name: 'Milking Procedures', category: 'Dairy', required: true, description: 'Dairy shed operation and hygiene' },
    { id: 'chemical', name: 'Chemical Safety', category: 'Safety', required: true, description: 'Safe chemical handling and PPE' },
    { id: 'first_aid', name: 'First Aid', category: 'Safety', required: false, description: 'Basic first aid response' },
    { id: 'electrical', name: 'Electrical Safety', category: 'Safety', required: false, description: 'Basic electrical awareness' },
    { id: 'effluent', name: 'Effluent Management', category: 'Environmental', required: true, description: 'Effluent system operation' }
  ];

  const sampleWorkerSkills: WorkerSkill[] = [
    { workerId: '1', skillId: 'atv', competencyLevel: 'competent', lastAssessed: '2024-11-15', nextAssessment: '2025-05-15', assessor: 'Tom Brown', notes: 'Good active riding technique' },
    { workerId: '1', skillId: 'animal', competencyLevel: 'needs_training', lastAssessed: '2024-11-16', nextAssessment: '2024-12-16', assessor: 'Tom Brown', notes: 'Needs more practice with difficult cattle' },
    { workerId: '1', skillId: 'chemical', competencyLevel: 'not_assessed', lastAssessed: '', nextAssessment: '', assessor: '', notes: '' },
    { workerId: '2', skillId: 'atv', competencyLevel: 'competent', lastAssessed: '2023-03-15', nextAssessment: '2024-03-15', assessor: 'External', notes: 'Expert level' },
    { workerId: '2', skillId: 'tractor', competencyLevel: 'competent', lastAssessed: '2023-03-20', nextAssessment: '2024-03-20', assessor: 'External', notes: 'All attachments certified' },
    { workerId: '2', skillId: 'animal', competencyLevel: 'competent', lastAssessed: '2023-04-01', nextAssessment: '2024-04-01', assessor: 'External', notes: 'Expert handler' },
    { workerId: '3', skillId: 'electrical', competencyLevel: 'competent', lastAssessed: '2024-11-28', nextAssessment: '2025-11-28', assessor: 'Self', notes: 'Licensed electrician' },
    { workerId: '4', skillId: 'milking', competencyLevel: 'competent', lastAssessed: '2024-06-01', nextAssessment: '2025-06-01', assessor: 'Tom Brown', notes: 'Excellent hygiene standards' },
    { workerId: '4', skillId: 'animal', competencyLevel: 'competent', lastAssessed: '2024-06-02', nextAssessment: '2025-06-02', assessor: 'Tom Brown', notes: 'Gentle handling' },
    { workerId: '5', skillId: 'atv', competencyLevel: 'expired', lastAssessed: '2023-09-15', nextAssessment: '2024-09-15', assessor: 'Previous', notes: 'Requires reassessment' }
  ];

  const workersData = workers.length > 0 ? workers : sampleWorkers;
  const skillsData = skills.length > 0 ? skills : sampleSkills;
  const workerSkillsData = workerSkills.length > 0 ? workerSkills : sampleWorkerSkills;

  const departments = ['all', ...Array.from(new Set(workersData.map(w => w.department)))];
  const categories = ['all', ...Array.from(new Set(skillsData.map(s => s.category)))];

  const filteredWorkers = workersData.filter(worker => {
    const matchesDepartment = selectedDepartment === 'all' || worker.department === selectedDepartment;
    const matchesSearch = worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         worker.role.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDepartment && matchesSearch;
  });

  const getWorkerSkill = (workerId: string, skillId: string): WorkerSkill | undefined => {
    return workerSkillsData.find(ws => ws.workerId === workerId && ws.skillId === skillId);
  };

  const getCompetencyColor = (level: string) => {
    switch (level) {
      case 'competent': return 'bg-green-100 text-green-800 border-green-200';
      case 'needs_training': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'not_assessed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'expired': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCompetencyIcon = (level: string) => {
    switch (level) {
      case 'competent': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'needs_training': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'not_assessed': return <XCircle className="h-4 w-4 text-gray-600" />;
      case 'expired': return <Clock className="h-4 w-4 text-red-600" />;
      default: return <XCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatistics = () => {
    const total = filteredWorkers.length * skillsData.length;
    const competent = workerSkillsData.filter(ws => ws.competencyLevel === 'competent').length;
    const needsTraining = workerSkillsData.filter(ws => ws.competencyLevel === 'needs_training').length;
    const notAssessed = workerSkillsData.filter(ws => ws.competencyLevel === 'not_assessed').length;
    const expired = workerSkillsData.filter(ws => ws.competencyLevel === 'expired').length;

    return { total, competent, needsTraining, notAssessed, expired };
  };

  const stats = getStatistics();

  const exportMatrix = () => {
    // In production, this would generate and download an Excel/CSV file
    alert('Skills matrix exported to Excel!');
  };

  const TableView = () => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-200 p-3 text-left font-semibold">Worker</th>
            <th className="border border-gray-200 p-3 text-left font-semibold">Role</th>
            {skillsData.map(skill => (
              <th key={skill.id} className="border border-gray-200 p-3 text-center font-semibold min-w-[120px]">
                <div>
                  <div className="text-sm">{skill.name}</div>
                  {skill.required && <Badge variant="outline" className="text-xs mt-1">Required</Badge>}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredWorkers.map(worker => (
            <tr key={worker.id} className="hover:bg-gray-50">
              <td className="border border-gray-200 p-3 font-medium">{worker.name}</td>
              <td className="border border-gray-200 p-3">
                <div>
                  <div className="text-sm">{worker.role}</div>
                  <Badge variant="outline" className="text-xs">{worker.department}</Badge>
                </div>
              </td>
              {skillsData.map(skill => {
                const workerSkill = getWorkerSkill(worker.id, skill.id);
                return (
                  <td key={skill.id} className="border border-gray-200 p-2 text-center">
                    {workerSkill ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className={getCompetencyColor(workerSkill.competencyLevel)}>
                          {getCompetencyIcon(workerSkill.competencyLevel)}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {workerSkill.competencyLevel.replace('_', ' ')}
                        </Badge>
                        {workerSkill.lastAssessed && (
                          <div className="text-xs text-gray-500">
                            {new Date(workerSkill.lastAssessed).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <div className={getCompetencyColor('not_assessed')}>
                          {getCompetencyIcon('not_assessed')}
                        </div>
                        <Badge variant="outline" className="text-xs">Not assessed</Badge>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const GridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredWorkers.map(worker => (
        <Card key={worker.id} className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{worker.name}</CardTitle>
              <Badge variant="outline">{worker.department}</Badge>
            </div>
            <p className="text-sm text-gray-600">{worker.role}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {skillsData.map(skill => {
                const workerSkill = getWorkerSkill(worker.id, skill.id);
                return (
                  <div key={skill.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      {getCompetencyIcon(workerSkill?.competencyLevel || 'not_assessed')}
                      <span className="text-xs font-medium">{skill.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {workerSkill?.competencyLevel?.replace('_', ' ') || 'N/A'}
                    </Badge>
                  </div>
                );
              })}
            </div>
            <div className="pt-2 border-t">
              <Button variant="outline" size="sm" className="w-full">
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{filteredWorkers.length}</div>
            <div className="text-sm text-gray-600">Workers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.competent}</div>
            <div className="text-sm text-gray-600">Competent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.needsTraining}</div>
            <div className="text-sm text-gray-600">Needs Training</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.notAssessed}</div>
            <div className="text-sm text-gray-600">Not Assessed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
            <div className="text-sm text-gray-600">Expired</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Skills Matrix
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportMatrix}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <div className="flex gap-1 border rounded">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  Table
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  Grid
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search workers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48"
              />
            </div>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>
                    {dept === 'all' ? 'All Departments' : dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Skill Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mb-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Competent</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span>Needs Training</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-gray-600" />
              <span>Not Assessed</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-600" />
              <span>Expired</span>
            </div>
          </div>

          {/* Skills Matrix Display */}
          {filteredWorkers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No workers found matching your filters</p>
            </div>
          ) : (
            viewMode === 'table' ? <TableView /> : <GridView />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
