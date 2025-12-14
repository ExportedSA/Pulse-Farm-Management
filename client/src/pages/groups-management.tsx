import { useState } from "react";
import { Link } from "wouter";
import { Plus, Edit, Trash2, Users, Filter, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertAnimalGroupSchema } from "@/../../shared/schema";
import type { z } from "zod";

type AnimalGroup = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  groupType: 'static' | 'dynamic';
  sortOrder: number;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type Animal = {
  id: string;
  tagNumber: string;
  name: string | null;
  breed: string | null;
  status: string;
};

type AnimalGroupMember = {
  id: string;
  groupId: string;
  animalId: string;
  addedAt: Date;
  notes: string | null;
};

type GroupFormData = z.infer<typeof insertAnimalGroupSchema>;

const COLOR_PRESETS = [
  { name: "Forest", value: "#1e3932" },
  { name: "Green", value: "#3d7550" },
  { name: "Brown", value: "#b8963e" },
  { name: "Tan", value: "#967a52" },
  { name: "Sage", value: "#6b9a78" },
  { name: "Olive", value: "#5a6b3d" },
  { name: "Gray", value: "#6b7280" },
  { name: "Slate", value: "#475569" },
];

export default function GroupsManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AnimalGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<AnimalGroup | null>(null);
  const [managingGroup, setManagingGroup] = useState<AnimalGroup | null>(null);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);

  // Fetch groups
  const { data: groups = [], isLoading: isLoadingGroups } = useQuery<AnimalGroup[]>({
    queryKey: ['/api/groups'],
  });

  // Fetch all animals for member management
  const { data: allAnimals = [] } = useQuery<Animal[]>({
    queryKey: ['/api/animals'],
  });

  // Fetch group members when managing a group
  const { data: groupDetails } = useQuery<{ group: AnimalGroup; members: Animal[] }>({
    queryKey: ['/api/groups', managingGroup?.id, 'details'],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${managingGroup?.id}`);
      if (!res.ok) throw new Error('Failed to fetch group details');
      return res.json();
    },
    enabled: !!managingGroup,
  });

  // Create group mutation
  const createMutation = useMutation({
    mutationFn: async (data: GroupFormData) => {
      const res = await apiRequest('/api/groups', 'POST', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'], exact: false });
      toast.success('Group created successfully');
      setIsCreateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create group: ${error.message}`);
    },
  });

  // Update group mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<GroupFormData> }) => {
      const res = await apiRequest(`/api/groups/${id}`, 'PUT', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'], exact: false });
      toast.success('Group updated successfully');
      setEditingGroup(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update group: ${error.message}`);
    },
  });

  // Delete group mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/groups/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'], exact: false });
      toast.success('Group deleted successfully');
      setDeletingGroup(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete group: ${error.message}`);
    },
  });

  // Add members mutation
  const addMembersMutation = useMutation({
    mutationFn: async ({ groupId, animalIds }: { groupId: string; animalIds: string[] }) => {
      const promises = animalIds.map(animalId =>
        apiRequest(`/api/groups/${groupId}/members`, 'POST', { animalId })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'], exact: false });
      toast.success('Animals added to group');
      setSelectedAnimalIds([]);
    },
    onError: (error: Error) => {
      if (error.message.includes('409')) {
        toast.error('Some animals are already members of this group');
      } else {
        toast.error(`Failed to add animals: ${error.message}`);
      }
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async ({ groupId, animalId }: { groupId: string; animalId: string }) => {
      await apiRequest(`/api/groups/${groupId}/members/${animalId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'], exact: false });
      toast.success('Animal removed from group');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove animal: ${error.message}`);
    },
  });

  const GroupForm = ({ group, onClose }: { group?: AnimalGroup | null; onClose: () => void }) => {
    const form = useForm<GroupFormData>({
      resolver: zodResolver(insertAnimalGroupSchema),
      defaultValues: {
        name: group?.name || "",
        description: group?.description || "",
        color: group?.color || "#1e3932",
        sortOrder: group?.sortOrder || 0,
      },
    });

    const onSubmit = (data: GroupFormData) => {
      if (group) {
        updateMutation.mutate({ id: group.id, data });
      } else {
        createMutation.mutate(data);
      }
    };

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Group Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Dry Cows, Heifers, Culling" {...field} data-testid="input-group-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Describe the purpose of this group..." 
                    {...field} 
                    value={field.value || ""} 
                    data-testid="input-group-description"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Badge Color</FormLabel>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={`h-8 w-8 rounded-md border-2 ${
                        field.value === preset.value ? 'border-foreground' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: preset.value }}
                      onClick={() => field.onChange(preset.value)}
                      title={preset.name}
                      data-testid={`color-${preset.name.toLowerCase()}`}
                    />
                  ))}
                  <Input
                    type="color"
                    {...field}
                    value={field.value || "#1e3932"}
                    className="h-8 w-16"
                    data-testid="input-group-color"
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sortOrder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sort Order</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} 
                    data-testid="input-group-sort-order"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-group">
              {group ? 'Update' : 'Create'} Group
            </Button>
          </DialogFooter>
        </form>
      </Form>
    );
  };

  const MemberManagementDialog = ({ group }: { group: AnimalGroup }) => {
    const currentMembers = groupDetails?.members || [];
    const availableAnimals = allAnimals.filter(
      animal => !currentMembers.some(member => member.id === animal.id)
    );

    return (
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Members: {group.name}</DialogTitle>
          <DialogDescription>
            Add or remove animals from this group
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6">
          {/* Current Members */}
          <div>
            <h3 className="font-semibold mb-3 text-sm">Current Members ({currentMembers.length})</h3>
            {currentMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No animals in this group yet</p>
            ) : (
              <div className="space-y-2">
                {currentMembers.map((animal) => (
                  <div
                    key={animal.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                  >
                    <div>
                      <span className="font-medium">{animal.tagNumber}</span>
                      {animal.name && <span className="text-muted-foreground ml-2">({animal.name})</span>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMemberMutation.mutate({ groupId: group.id, animalId: animal.id })}
                      data-testid={`button-remove-${animal.tagNumber}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Members */}
          <div>
            <h3 className="font-semibold mb-3 text-sm">Add Animals</h3>
            {availableAnimals.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">All animals are already in this group</p>
            ) : (
              <>
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (value && !selectedAnimalIds.includes(value)) {
                      setSelectedAnimalIds([...selectedAnimalIds, value]);
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-add-animal">
                    <SelectValue placeholder="Select animals to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAnimals.map((animal) => (
                      <SelectItem key={animal.id} value={animal.id}>
                        {animal.tagNumber} {animal.name ? `(${animal.name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedAnimalIds.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {selectedAnimalIds.map((id) => {
                        const animal = allAnimals.find(a => a.id === id);
                        if (!animal) return null;
                        return (
                          <Badge key={id} variant="secondary" className="gap-1">
                            {animal.tagNumber}
                            <button
                              onClick={() => setSelectedAnimalIds(selectedAnimalIds.filter(aid => aid !== id))}
                              className="ml-1"
                            >
                              ×
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                    <Button
                      onClick={() => addMembersMutation.mutate({ groupId: group.id, animalIds: selectedAnimalIds })}
                      disabled={addMembersMutation.isPending}
                      size="sm"
                      data-testid="button-add-selected"
                    >
                      Add {selectedAnimalIds.length} Animal{selectedAnimalIds.length !== 1 ? 's' : ''}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-groups-title">
            Animal Groups
          </h1>
          <p className="text-muted-foreground">Organize your herd into custom groups</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/smart-groups">
            <Button variant="outline" data-testid="button-custom-reports">
              <Filter className="h-4 w-4 mr-2" />
              Custom Reports
            </Button>
          </Link>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-group">
                <Plus className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Group</DialogTitle>
              <DialogDescription>
                Create a custom group to organize your animals
              </DialogDescription>
            </DialogHeader>
            <GroupForm onClose={() => setIsCreateDialogOpen(false)} />
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Groups Grid */}
      {isLoadingGroups ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No groups yet</p>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-group">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card key={group.id} data-testid={`card-group-${group.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: group.color || '#1e3932' }}
                      />
                      {group.name}
                    </CardTitle>
                    {group.description && (
                      <CardDescription className="mt-2">{group.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Dialog
                      open={editingGroup?.id === group.id}
                      onOpenChange={(open) => !open && setEditingGroup(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingGroup(group)}
                          data-testid={`button-edit-${group.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Group</DialogTitle>
                        </DialogHeader>
                        <GroupForm group={group} onClose={() => setEditingGroup(null)} />
                      </DialogContent>
                    </Dialog>

                    <Dialog
                      open={deletingGroup?.id === group.id}
                      onOpenChange={(open) => !open && setDeletingGroup(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingGroup(group)}
                          data-testid={`button-delete-${group.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete Group</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete "{group.name}"? Animals will not be deleted, only the group.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDeletingGroup(null)} data-testid="button-cancel-delete">
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => deleteMutation.mutate(group.id)}
                            disabled={deleteMutation.isPending}
                            data-testid="button-confirm-delete"
                          >
                            Delete Group
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" data-testid={`badge-member-count-${group.id}`}>
                    <Users className="h-3 w-3 mr-1" />
                    {group.memberCount} {group.memberCount === 1 ? 'animal' : 'animals'}
                  </Badge>
                  <Dialog
                    open={managingGroup?.id === group.id}
                    onOpenChange={(open) => {
                      if (!open) {
                        setManagingGroup(null);
                        setSelectedAnimalIds([]);
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setManagingGroup(group)}
                        data-testid={`button-manage-${group.id}`}
                      >
                        Manage Members
                      </Button>
                    </DialogTrigger>
                    {managingGroup && <MemberManagementDialog group={managingGroup} />}
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
