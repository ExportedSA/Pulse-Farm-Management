import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'wouter';
import { pulseGet, pulsePatch, pulseDelete } from '@/lib/pulseApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Heart,
  Calendar,
  Tag,
  MapPin,
  Activity,
  GitBranch,
  Clock,
  Loader2,
  AlertTriangle,
  Scale,
  Baby,
  Milk,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import AnimalForm from '@/components/AnimalForm';

// Types
interface Animal {
  id: string;
  farmId: string | null;
  visualId: string | null;
  lifetimeId: string | null;
  nationalId: string | null;
  naitTag: string | null;
  eid: string | null;
  name: string | null;
  breed: string | null;
  breedType: string | null;
  origin: string | null;
  dateOfBirth: string | null;
  yearBorn: number | null;
  sex: 'female' | 'male' | null;
  herd: string | null;
  status: 'active' | 'sold' | 'deceased';
  milkStatus: string | null;
  a2Status: string | null;
  bvdStatus: string | null;
  bodyConditionScore: string | null;
  liveWeight: string | null;
  notes: string | null;
  damId: string | null;
  sireId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface HealthRecord {
  id: string;
  animalId: string;
  date: string;
  type: string;
  description: string;
  severity: string | null;
  notes: string | null;
  requiresFollowUp: boolean | null;
  followUpDate: string | null;
  createdAt: string;
}

export default function AnimalDetailPage() {
  const params = useParams<{ id: string }>();
  const animalId = params.id;
  const [, navigate] = useLocation();

  // State
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load animal data
  useEffect(() => {
    if (animalId) {
      loadAnimalData();
    }
  }, [animalId]);

  async function loadAnimalData() {
    setLoading(true);
    setError(null);
    try {
      const [animalData, healthData] = await Promise.all([
        pulseGet<Animal>(`/animals/${animalId}`),
        pulseGet<HealthRecord[]>(`/animals/${animalId}/health`).catch(() => []),
      ]);
      setAnimal(animalData);
      setHealthRecords(healthData);
    } catch (err) {
      console.error('Failed to load animal:', err);
      setError('Failed to load animal details. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!animal) return;
    
    setDeleting(true);
    try {
      await pulseDelete(`/animals/${animal.id}`);
      toast.success('Animal removed successfully');
      navigate('/app/animals');
    } catch (err) {
      console.error('Failed to delete animal:', err);
      toast.error('Failed to remove animal');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  function handleEditSuccess(updatedAnimal: Animal) {
    setAnimal(updatedAnimal);
    setIsEditing(false);
    toast.success('Animal updated successfully');
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'sold':
        return <Badge className="bg-blue-100 text-blue-800">Sold</Badge>;
      case 'deceased':
        return <Badge className="bg-gray-100 text-gray-800">Deceased</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getSexBadge(sex: string | null) {
    if (!sex) return null;
    return sex === 'female' 
      ? <Badge className="bg-pink-100 text-pink-800">Female</Badge>
      : <Badge className="bg-blue-100 text-blue-800">Male</Badge>;
  }

  function calculateAge(dateOfBirth: string | null, yearBorn: number | null): string {
    if (dateOfBirth) {
      const birth = new Date(dateOfBirth);
      const now = new Date();
      const years = now.getFullYear() - birth.getFullYear();
      const months = now.getMonth() - birth.getMonth();
      if (years === 0) {
        return `${months} months`;
      }
      return months < 0 ? `${years - 1} years` : `${years} years`;
    }
    if (yearBorn) {
      return `${new Date().getFullYear() - yearBorn} years`;
    }
    return 'Unknown';
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-NZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-green-600" />
      </div>
    );
  }

  // Error state
  if (error || !animal) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <p>{error || 'Animal not found'}</p>
            </div>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/app/animals')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Animals
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Edit mode
  if (isEditing) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => setIsEditing(false)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel Edit
          </Button>
        </div>
        <AnimalForm
          existingAnimal={animal}
          onSuccess={handleEditSuccess}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/app/animals">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-pulse-green-800">
              {animal.name || animal.visualId || 'Unnamed Animal'}
            </h1>
            <p className="text-gray-500">
              {animal.breed} {animal.breedType && `• ${animal.breedType}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Remove
          </Button>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-2 mb-6">
        {getStatusBadge(animal.status)}
        {getSexBadge(animal.sex)}
        {animal.milkStatus && <Badge variant="outline">{animal.milkStatus}</Badge>}
        {animal.a2Status && <Badge variant="outline">A2: {animal.a2Status}</Badge>}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health Records</TabsTrigger>
          <TabsTrigger value="identification">Identification</TabsTrigger>
          <TabsTrigger value="lineage">Lineage</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium">{animal.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Visual ID</span>
                  <span className="font-medium">{animal.visualId || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Breed</span>
                  <span className="font-medium">{animal.breed || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Breed Type</span>
                  <span className="font-medium">{animal.breedType || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Origin</span>
                  <span className="font-medium">{animal.origin || 'N/A'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Age & Birth */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Age & Birth
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Age</span>
                  <span className="font-medium">{calculateAge(animal.dateOfBirth, animal.yearBorn)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date of Birth</span>
                  <span className="font-medium">{formatDate(animal.dateOfBirth)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Year Born</span>
                  <span className="font-medium">{animal.yearBorn || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sex</span>
                  <span className="font-medium capitalize">{animal.sex || 'N/A'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Health & Condition */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Health & Condition
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Body Condition</span>
                  <span className="font-medium">{animal.bodyConditionScore || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Live Weight</span>
                  <span className="font-medium">
                    {animal.liveWeight ? `${animal.liveWeight} kg` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">BVD Status</span>
                  <span className="font-medium">{animal.bvdStatus || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Herd</span>
                  <span className="font-medium">{animal.herd || 'N/A'}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {animal.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{animal.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Health Records Tab */}
        <TabsContent value="health" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Health Records</h2>
            <Button asChild>
              <Link href={`/app/animals/${animal.id}/health`}>
                <Heart className="h-4 w-4 mr-2" />
                Manage Health Records
              </Link>
            </Button>
          </div>

          {healthRecords.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <Heart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No health records found for this animal.</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href={`/app/animals/${animal.id}/health`}>
                    Add Health Record
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {healthRecords.slice(0, 5).map((record) => (
                <Card key={record.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="capitalize">
                            {record.type}
                          </Badge>
                          {record.severity && (
                            <Badge
                              className={
                                record.severity === 'critical'
                                  ? 'bg-red-100 text-red-800'
                                  : record.severity === 'high'
                                  ? 'bg-orange-100 text-orange-800'
                                  : record.severity === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                              }
                            >
                              {record.severity}
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium">{record.description}</p>
                        {record.notes && (
                          <p className="text-sm text-gray-500 mt-1">{record.notes}</p>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">{formatDate(record.date)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {healthRecords.length > 5 && (
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/app/animals/${animal.id}/health`}>
                    View All {healthRecords.length} Records
                  </Link>
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        {/* Identification Tab */}
        <TabsContent value="identification" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Identification Numbers</CardTitle>
              <CardDescription>Official identification and tracking numbers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Visual ID (VID)</p>
                  <p className="font-mono font-medium text-lg">{animal.visualId || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Lifetime ID (LID)</p>
                  <p className="font-mono font-medium text-lg">{animal.lifetimeId || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">National ID</p>
                  <p className="font-mono font-medium text-lg">{animal.nationalId || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">NAIT Tag</p>
                  <p className="font-mono font-medium text-lg">{animal.naitTag || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Electronic ID (EID)</p>
                  <p className="font-mono font-medium text-lg">{animal.eid || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lineage Tab */}
        <TabsContent value="lineage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Lineage Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-gray-500 mb-2">Dam (Mother)</p>
                  {animal.damId ? (
                    <Link href={`/app/animals/${animal.damId}`} className="text-pulse-green-600 hover:underline">
                      View Dam Record →
                    </Link>
                  ) : (
                    <p className="text-gray-400">Not recorded</p>
                  )}
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-gray-500 mb-2">Sire (Father)</p>
                  {animal.sireId ? (
                    <Link href={`/app/animals/${animal.sireId}`} className="text-pulse-green-600 hover:underline">
                      View Sire Record →
                    </Link>
                  ) : (
                    <p className="text-gray-400">Not recorded</p>
                  )}
                </div>
              </div>
              <Separator />
              <div className="flex justify-center">
                <Button variant="outline" asChild>
                  <Link href={`/app/animals/${animal.id}/lineage`}>
                    <GitBranch className="h-4 w-4 mr-2" />
                    View Full Lineage Tree
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Animal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the animal as removed from the herd. The record will be preserved
              for historical purposes. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Animal'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
