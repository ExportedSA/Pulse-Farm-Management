import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Filter, Edit, Trash2, FolderTree, Download, Baby } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Animal, Pasture } from "@/../../shared/schema";
import { insertAnimalSchema } from "@/../../shared/schema";
import type { z } from "zod";
import { AnimalFiltersComponent, type AnimalFilters } from "@/components/AnimalFilters";
import { prepareAnimalsForExport, exportAnimalsToCSV, downloadCSV, generateFilename } from "@/lib/csv-export";
import AnimalDetailDialog from "@/components/AnimalDetailDialog";

type AnimalGroup = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  groupType: 'static' | 'dynamic';
  sortOrder: number;
  memberCount: number;
};

type AnimalFormData = z.infer<typeof insertAnimalSchema>;

// Helper to calculate age from dateOfBirth
function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  const now = new Date();
  const diffMs = now.getTime() - birth.getTime();
  const ageMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  return ageMonths;
}

function matchesAgeRange(ageMonths: number | null, range: string): boolean {
  if (ageMonths === null) return false;
  
  switch (range) {
    case '0-6mo':
      return ageMonths >= 0 && ageMonths < 6;
    case '6-12mo':
      return ageMonths >= 6 && ageMonths < 12;
    case '1-2yr':
      return ageMonths >= 12 && ageMonths < 24;
    case '2-5yr':
      return ageMonths >= 24 && ageMonths < 60;
    case '5yr+':
      return ageMonths >= 60;
    default:
      return false;
  }
}

export default function AnimalsList() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [deletingAnimal, setDeletingAnimal] = useState<Animal | null>(null);
  const [viewingAnimal, setViewingAnimal] = useState<Animal | null>(null);
  const [excludeHistoric, setExcludeHistoric] = useState(false);

  // Initialize filters from URL params
  const [filters, setFilters] = useState<AnimalFilters>(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      breeds: params.get('breeds')?.split(',').filter(Boolean) || [],
      sexes: params.get('sexes')?.split(',').filter(Boolean) || [],
      statuses: params.get('statuses')?.split(',').filter(Boolean) || [],
      ageRanges: params.get('ageRanges')?.split(',').filter(Boolean) || [],
      groupIds: params.get('groupIds')?.split(',').filter(Boolean) || [],
      pastureIds: params.get('pastureIds')?.split(',').filter(Boolean) || [],
    };
  });

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.breeds.length) params.set('breeds', filters.breeds.join(','));
    if (filters.sexes.length) params.set('sexes', filters.sexes.join(','));
    if (filters.statuses.length) params.set('statuses', filters.statuses.join(','));
    if (filters.ageRanges.length) params.set('ageRanges', filters.ageRanges.join(','));
    if (filters.groupIds.length) params.set('groupIds', filters.groupIds.join(','));
    if (filters.pastureIds.length) params.set('pastureIds', filters.pastureIds.join(','));
    
    const newUrl = params.toString() ? `/app/animals?${params.toString()}` : '/app/animals';
    window.history.replaceState({}, '', newUrl);
  }, [filters]);

  // Fetch animals
  const { data: animals = [], isLoading: isLoadingAnimals } = useQuery<Animal[]>({
    queryKey: ['/api/animals'],
  });

  // Fetch pastures for the dropdown
  const { data: pastures = [] } = useQuery<Pasture[]>({
    queryKey: ['/api/pastures'],
  });

  // Fetch groups for quick-add dropdown
  const { data: groups = [] } = useQuery<AnimalGroup[]>({
    queryKey: ['/api/groups'],
  });

  // Fetch all group memberships using efficient bulk endpoint
  const { data: allMemberships = [], isLoading: isLoadingMemberships } = useQuery<{groupId: string; animalId: string}[]>({
    queryKey: ['/api/groups/memberships'],
    queryFn: async () => {
      const res = await fetch('/api/groups/memberships');
      if (!res.ok) throw new Error('Failed to fetch group memberships');
      return res.json();
    },
  });

  // Helper to get groups for a specific animal
  const getAnimalGroups = (animalId: string) => {
    const memberGroupIds = allMemberships
      .filter(m => m.animalId === animalId)
      .map(m => m.groupId);
    return groups.filter(g => memberGroupIds.includes(g.id));
  };

  // Search animals
  const { data: searchResults } = useQuery<Animal[]>({
    queryKey: ['/api/animals/search', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/animals/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: searchQuery.length > 0,
  });

  // Create animal mutation
  const createMutation = useMutation({
    mutationFn: async (data: AnimalFormData) => {
      const res = await apiRequest('/api/animals', 'POST', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/animals'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/animals/search'], exact: false });
      toast.success('Animal added successfully');
      setIsCreateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to add animal: ${error.message}`);
    },
  });

  // Update animal mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AnimalFormData> }) => {
      const res = await apiRequest(`/api/animals/${id}`, 'PUT', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/animals'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/animals/search'], exact: false });
      toast.success('Animal updated successfully');
      setEditingAnimal(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update animal: ${error.message}`);
    },
  });

  // Delete animal mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/animals/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/animals'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/animals/search'], exact: false });
      toast.success('Animal deleted successfully');
      setDeletingAnimal(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete animal: ${error.message}`);
    },
  });

  // Add animal to group mutation
  const addToGroupMutation = useMutation({
    mutationFn: async ({ groupId, animalId }: { groupId: string; animalId: string }) => {
      await apiRequest(`/api/groups/${groupId}/members`, 'POST', { animalId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/memberships'] });
      toast.success('Animal added to group');
    },
    onError: (error: Error) => {
      if (error.message.includes('409')) {
        toast.error('Animal is already in this group');
      } else {
        toast.error(`Failed to add to group: ${error.message}`);
      }
    },
  });

  // Remove animal from group mutation
  const removeFromGroupMutation = useMutation({
    mutationFn: async ({ groupId, animalId }: { groupId: string; animalId: string }) => {
      await apiRequest(`/api/groups/${groupId}/members/${animalId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/memberships'] });
      toast.success('Animal removed from group');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove from group: ${error.message}`);
    },
  });

  // Get unique breeds from animals for filter
  const availableBreeds = useMemo(() => {
    const breeds = new Set(animals.map(a => a.breed).filter(Boolean) as string[]);
    return Array.from(breeds).sort();
  }, [animals]);

  // Apply filters to animals
  const filteredAnimals = useMemo(() => {
    let result = searchQuery.length > 0 ? searchResults || [] : animals;

    // Exclude historic/deceased if checkbox is checked
    if (excludeHistoric) {
      result = result.filter(a => a.status === 'active');
    }

    // Breed filter
    if (filters.breeds.length > 0) {
      result = result.filter(a => a.breed && filters.breeds.includes(a.breed));
    }

    // Sex filter
    if (filters.sexes.length > 0) {
      result = result.filter(a => a.sex && filters.sexes.includes(a.sex));
    }

    // Status filter
    if (filters.statuses.length > 0) {
      result = result.filter(a => filters.statuses.includes(a.status));
    }

    // Age range filter
    if (filters.ageRanges.length > 0) {
      result = result.filter(a => {
        const ageMonths = calculateAge(a.dateOfBirth);
        return filters.ageRanges.some(range => matchesAgeRange(ageMonths, range));
      });
    }

    // Group filter - only apply when memberships have loaded
    if (filters.groupIds.length > 0 && !isLoadingMemberships) {
      result = result.filter(a => {
        const animalGroupIds = getAnimalGroups(a.id).map(g => g.id);
        return filters.groupIds.some(gid => animalGroupIds.includes(gid));
      });
    }

    // Pasture filter
    if (filters.pastureIds.length > 0) {
      result = result.filter(a => a.currentPastureId && filters.pastureIds.includes(a.currentPastureId));
    }

    return result;
  }, [animals, searchResults, searchQuery, filters, allMemberships, groups, isLoadingMemberships]);

  const displayedAnimals = filteredAnimals;

  // Handle CSV export
  const handleExportCSV = () => {
    try {
      const animalsForExport = prepareAnimalsForExport(
        displayedAnimals,
        groups,
        pastures,
        allMemberships
      );
      
      const csvContent = exportAnimalsToCSV(animalsForExport, {
        includeGroups: true,
        includePasture: true,
        includeNotes: true,
        includeTimestamps: true,
      });
      
      const filename = generateFilename('animals', displayedAnimals.length);
      downloadCSV(csvContent, filename);
      
      toast.success(`Exported ${displayedAnimals.length} animals to CSV`);
    } catch (error) {
      toast.error('Failed to export animals');
      console.error('Export error:', error);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-animals-title">
            Animals
          </h1>
          <p className="text-muted-foreground">Manage your herd</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleExportCSV} 
            variant="outline"
            disabled={displayedAnimals.length === 0}
            data-testid="button-export-csv"
          >
            <Download className="mr-2 h-5 w-5" strokeWidth={1.5} />
            Export CSV
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-animal">
            <Plus className="mr-2 h-5 w-5" strokeWidth={1.5} />
            Add Animal
          </Button>
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <Input
              placeholder="Search by NAIT tag, cow ID, or breed..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12"
              data-testid="input-search-animals"
            />
          </div>
          <AnimalFiltersComponent
            filters={filters}
            onChange={setFilters}
            availableBreeds={availableBreeds}
            availableGroups={groups}
            availablePastures={pastures}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="exclude-historic"
            checked={excludeHistoric}
            onCheckedChange={(checked) => setExcludeHistoric(!!checked)}
            data-testid="checkbox-exclude-historic"
          />
          <label
            htmlFor="exclude-historic"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Exclude historic/deceased animals
          </label>
        </div>
      </div>

      {isLoadingAnimals ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-10 w-full mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : displayedAnimals.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground mb-4" data-testid="text-no-animals">
              {searchQuery ? 'No animals found matching your search.' : 'No animals yet. Add your first animal to get started.'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-first-animal">
                <Plus className="mr-2 h-5 w-5" strokeWidth={1.5} />
                Add Animal
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedAnimals.map((animal) => (
            <Card 
              key={animal.id} 
              className="hover-elevate cursor-pointer" 
              onClick={() => setViewingAnimal(animal)}
              data-testid={`card-animal-${animal.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="font-mono text-lg font-semibold mb-1">
                      {animal.naitTag || animal.cowId || "No ID"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {animal.breed || "Unknown breed"}
                    </div>
                    {(animal as any).eid && (
                      <div className="text-xs text-muted-foreground mt-1">
                        EID: {(animal as any).eid}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" data-testid={`badge-status-${animal.id}`}>
                    {animal.status}
                  </Badge>
                </div>
                {animal.herd && (
                  <div className="text-sm mb-2">
                    <span className="text-muted-foreground">Herd:</span> {animal.herd}
                  </div>
                )}
                {animal.currentPastureId && (
                  <div className="text-sm mb-2">
                    <span className="text-muted-foreground">Pasture:</span>{' '}
                    {pastures.find(p => p.id === animal.currentPastureId)?.name || animal.currentPastureId}
                  </div>
                )}
                {/* Group badges */}
                {getAnimalGroups(animal.id).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {getAnimalGroups(animal.id).map((group) => (
                      <Badge
                        key={group.id}
                        variant="secondary"
                        className="gap-1"
                        style={{ 
                          backgroundColor: group.color || undefined,
                          color: group.color ? '#ffffff' : undefined,
                          borderColor: group.color || undefined,
                        }}
                        data-testid={`badge-group-${group.id}`}
                      >
                        {group.name}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromGroupMutation.mutate({ groupId: group.id, animalId: animal.id });
                          }}
                          className="ml-1 hover:opacity-70"
                          title={`Remove from ${group.name}`}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingAnimal(animal);
                    }}
                    data-testid={`button-edit-animal-${animal.id}`}
                  >
                    <Edit className="h-4 w-4 mr-1" strokeWidth={1.5} />
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`button-add-to-group-${animal.id}`}
                      >
                        <FolderTree className="h-4 w-4" strokeWidth={1.5} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Add to Group</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {groups.filter(g => !getAnimalGroups(animal.id).some(ag => ag.id === g.id)).length === 0 ? (
                        <DropdownMenuItem disabled>
                          Already in all groups
                        </DropdownMenuItem>
                      ) : (
                        groups
                          .filter(g => !getAnimalGroups(animal.id).some(ag => ag.id === g.id))
                          .map((group) => (
                            <DropdownMenuItem
                              key={group.id}
                              onClick={() => addToGroupMutation.mutate({ groupId: group.id, animalId: animal.id })}
                              data-testid={`menu-add-to-${group.id}`}
                            >
                              <span
                                className="inline-block h-3 w-3 rounded-full mr-2"
                                style={{ backgroundColor: group.color || '#1e3932' }}
                              />
                              {group.name}
                            </DropdownMenuItem>
                          ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingAnimal(animal);
                    }}
                    data-testid={`button-delete-animal-${animal.id}`}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <AnimalDialog
        isOpen={isCreateDialogOpen || !!editingAnimal}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setEditingAnimal(null);
        }}
        animal={editingAnimal}
        pastures={pastures}
        onSubmit={(data) => {
          if (editingAnimal) {
            updateMutation.mutate({ id: editingAnimal.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* Animal Detail Dialog */}
      <AnimalDetailDialog
        animal={viewingAnimal}
        onClose={() => setViewingAnimal(null)}
        onEdit={(animal) => {
          setViewingAnimal(null);
          setEditingAnimal(animal);
        }}
        groups={getAnimalGroups(viewingAnimal?.id || '')}
        pasture={pastures.find(p => p.id === viewingAnimal?.currentPastureId)}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingAnimal} onOpenChange={() => setDeletingAnimal(null)}>
        <DialogContent data-testid="dialog-delete-animal">
          <DialogHeader>
            <DialogTitle>Delete Animal</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this animal? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingAnimal(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingAnimal && deleteMutation.mutate(deletingAnimal.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Separate Animal Dialog Component
function AnimalDialog({
  isOpen,
  onClose,
  animal,
  pastures,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  animal: Animal | null;
  pastures: Pasture[];
  onSubmit: (data: AnimalFormData) => void;
  isSubmitting: boolean;
}) {
  const form = useForm<AnimalFormData>({
    resolver: zodResolver(insertAnimalSchema),
    defaultValues: animal || {
      naitTag: '',
      eid: '',
      cowId: '',
      birthId: undefined,
      breed: '',
      dateOfBirth: '',
      sex: 'female',
      herd: '',
      currentPastureId: undefined,
      status: 'active',
      notes: '',
    },
  });

  // Reset form when animal changes
  useEffect(() => {
    if (animal) {
      form.reset(animal);
    } else {
      form.reset({
        naitTag: '',
        eid: '',
        cowId: '',
        birthId: undefined,
        breed: '',
        dateOfBirth: '',
        sex: 'female',
        herd: '',
        currentPastureId: undefined,
        status: 'active',
        notes: '',
      });
    }
  }, [animal, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-animal-form">
        <DialogHeader>
          <DialogTitle>{animal ? 'Edit Animal' : 'Add Animal'}</DialogTitle>
          <DialogDescription>
            {animal ? 'Update animal information' : 'Add a new animal to your herd'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="naitTag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NAIT Tag</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} placeholder="Official NAIT tag" data-testid="input-nait-tag" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EID (Electronic ID)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} placeholder="RFID tag number" data-testid="input-eid" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cowId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visual ID (Cow Number)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} placeholder="Visual tag number" data-testid="input-cow-id" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-end">
                <p className="text-sm text-muted-foreground">Use this to retag or assign first-time visual ID</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="breed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Breed</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} placeholder="e.g., Holstein, Jersey" data-testid="input-breed" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sex</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'female'}>
                      <FormControl>
                        <SelectTrigger data-testid="select-sex">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" value={field.value || ''} data-testid="input-date-of-birth" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="herd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Herd</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} placeholder="e.g., Milking Mob, Dry Cows" data-testid="input-herd" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Birth ID Section for Calf Recording */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Baby className="h-4 w-4" />
                <h3 className="text-sm font-medium">Calf Birth ID (Optional)</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Enter permanent birth identification for calves born on farm
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="birthId.participantCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Participant Code</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ''} 
                          placeholder="e.g., ABC123" 
                          data-testid="input-birth-participant-code"
                          onChange={(e) => {
                            const currentBirthId = form.getValues('birthId') as { participantCode?: string; year?: string; number?: string } | undefined;
                            form.setValue('birthId', {
                              participantCode: e.target.value,
                              year: currentBirthId?.year || '',
                              number: currentBirthId?.number || ''
                            });
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="birthId.year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Year</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ''} 
                          placeholder="e.g., 2024" 
                          data-testid="input-birth-year"
                          onChange={(e) => {
                            const currentBirthId = form.getValues('birthId') as { participantCode?: string; year?: string; number?: string } | undefined;
                            form.setValue('birthId', {
                              participantCode: currentBirthId?.participantCode || '',
                              year: e.target.value,
                              number: currentBirthId?.number || ''
                            });
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="birthId.number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Number</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ''} 
                          placeholder="e.g., 001" 
                          data-testid="input-birth-number"
                          onChange={(e) => {
                            const currentBirthId = form.getValues('birthId') as { participantCode?: string; year?: string; number?: string } | undefined;
                            form.setValue('birthId', {
                              participantCode: currentBirthId?.participantCode || '',
                              year: currentBirthId?.year || '',
                              number: e.target.value
                            });
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currentPastureId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Pasture</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === 'none' ? undefined : value)} 
                      value={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-pasture">
                          <SelectValue placeholder="Select pasture" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {pastures.map((pasture) => (
                          <SelectItem key={pasture.id} value={pasture.id}>
                            {pasture.name} {pasture.paddockNumber ? `(#${pasture.paddockNumber})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'active'}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="sold">Sold</SelectItem>
                        <SelectItem value="deceased">Deceased</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ''} rows={3} data-testid="textarea-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-animal">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-submit-animal">
                {isSubmitting ? 'Saving...' : animal ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
