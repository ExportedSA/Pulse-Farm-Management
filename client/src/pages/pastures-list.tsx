import { useState, useEffect } from "react";
import { Plus, MapPin, Search, Edit, Trash2, Leaf, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { generatePasturePDF, exportToCSV } from "@/lib/report-utils";
import { useAuth } from "@/lib/auth-context";
import type { Pasture, PastureHealthRecord } from "@/../../shared/schema";
import { insertPastureSchema } from "@/../../shared/schema";
import type { z } from "zod";

type PastureFormData = z.infer<typeof insertPastureSchema>;

const statusColors = {
  available: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  grazing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  resting: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  maintenance: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

export default function PasturesList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPasture, setEditingPasture] = useState<Pasture | null>(null);
  const [deletingPasture, setDeletingPasture] = useState<Pasture | null>(null);

  // Fetch pastures
  const { data: pastures = [], isLoading: isLoadingPastures } = useQuery<Pasture[]>({
    queryKey: ['/api/pastures'],
  });

  // Search pastures
  const { data: searchResults } = useQuery<Pasture[]>({
    queryKey: ['/api/pastures/search', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/pastures/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: searchQuery.length > 0,
  });

  // Create pasture mutation
  const createMutation = useMutation({
    mutationFn: async (data: PastureFormData) => {
      const res = await apiRequest('/api/pastures', 'POST', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pastures'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/pastures/search'], exact: false });
      toast.success('Pasture added successfully');
      setIsCreateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to add pasture: ${error.message}`);
    },
  });

  // Update pasture mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PastureFormData> }) => {
      const res = await apiRequest(`/api/pastures/${id}`, 'PUT', data);
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pastures'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/pastures/search'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/pastures', variables.id, 'health-records'] });
      toast.success('Pasture updated successfully');
      setEditingPasture(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update pasture: ${error.message}`);
    },
  });

  // Delete pasture mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/pastures/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pastures'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/pastures/search'], exact: false });
      toast.success('Pasture deleted successfully');
      setDeletingPasture(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete pasture: ${error.message}`);
    },
  });

  const displayedPastures = searchQuery.length > 0 ? searchResults || [] : pastures;

  const handlePasturePDF = () => {
    if (!displayedPastures.length) {
      toast.error("No pastures to include in report");
      return;
    }

    const data = displayedPastures.map((p) => ({
      name: p.name,
      acres: (p.area ?? 0) * 2.471,
      currentAnimals: p.currentStock ?? 0,
      grazingDays: p.grazingDays ?? 0,
      restPeriodDays: p.restPeriodDays ?? 0,
      soilQuality: p.soilQuality ?? 0,
      grassCoverKg: p.grassCoverKg ?? 0,
    }));

    generatePasturePDF(data);
  };

  const handlePastureCSV = () => {
    if (!displayedPastures.length) {
      toast.error("No pastures to export");
      return;
    }

    const data = displayedPastures.map((p) => ({
      name: p.name,
      paddockNumber: p.paddockNumber ?? "",
      areaHa: p.area ?? "",
      currentStock: p.currentStock ?? 0,
      status: p.status ?? "",
      lastGrazed: p.lastGrazed ?? "",
      grazingDays: p.grazingDays ?? "",
      restPeriodDays: p.restPeriodDays ?? "",
      soilQuality: p.soilQuality ?? "",
      grassCoverKg: p.grassCoverKg ?? "",
    }));

    const today = new Date().toISOString().split("T")[0];
    exportToCSV(data, `pastures-${today}.csv`);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-pastures-title">
            Pastures
          </h1>
          <p className="text-muted-foreground">Manage grazing areas and rotation</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handlePastureCSV}
            disabled={displayedPastures.length === 0}
            data-testid="button-export-pastures-csv"
          >
            <Download className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={handlePasturePDF}
            disabled={displayedPastures.length === 0}
            data-testid="button-export-pastures-pdf"
          >
            <Download className="mr-2 h-4 w-4 rotate-180" strokeWidth={1.5} />
            Pasture PDF
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-pasture">
            <Plus className="mr-2 h-5 w-5" strokeWidth={1.5} />
            Add Pasture
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          <Input
            placeholder="Search by name or paddock number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
            data-testid="input-search-pastures"
          />
        </div>
      </div>

      {isLoadingPastures ? (
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
      ) : displayedPastures.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" strokeWidth={1.5} />
            <p className="text-muted-foreground mb-4" data-testid="text-no-pastures">
              {searchQuery ? 'No pastures found matching your search.' : 'No pastures configured. Add your first pasture to start managing grazing rotation.'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-first-pasture">
                <Plus className="mr-2 h-5 w-5" strokeWidth={1.5} />
                Add Pasture
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedPastures.map((pasture) => (
            <Card key={pasture.id} className="hover-elevate" data-testid={`card-pasture-${pasture.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{pasture.name}</span>
                  <Badge className={statusColors[pasture.status || 'available']} data-testid={`badge-status-${pasture.id}`}>
                    {pasture.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm mb-4">
                  {pasture.paddockNumber && (
                    <div>
                      <span className="text-muted-foreground">Paddock:</span> #{pasture.paddockNumber}
                    </div>
                  )}
                  {pasture.area && (
                    <div>
                      <span className="text-muted-foreground">Area:</span> {pasture.area} ha
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Stock:</span> {pasture.currentStock || 0} animals
                  </div>
                  {pasture.lastGrazed && (
                    <div>
                      <span className="text-muted-foreground">Last Grazed:</span>{" "}
                      {new Date(pasture.lastGrazed).toLocaleDateString()}
                    </div>
                  )}
                  
                  {/* Health Metrics */}
                  {(pasture.soilQuality != null || pasture.grassCoverKg != null || pasture.grazingDays != null || pasture.restPeriodDays != null) && (
                    <div className="pt-2 mt-2 border-t space-y-1">
                      {pasture.soilQuality != null && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Soil Quality:</span>
                          <Badge variant="secondary" data-testid={`badge-soil-${pasture.id}`}>
                            {pasture.soilQuality}/10
                          </Badge>
                        </div>
                      )}
                      {pasture.grassCoverKg != null && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Grass Cover:</span>
                          <Badge variant="secondary" data-testid={`badge-grass-${pasture.id}`}>
                            {pasture.grassCoverKg} kg/ha
                          </Badge>
                        </div>
                      )}
                      {pasture.grazingDays != null && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Grazing Days:</span>
                          <Badge variant="secondary" data-testid={`badge-grazing-${pasture.id}`}>
                            {pasture.grazingDays}
                          </Badge>
                        </div>
                      )}
                      {pasture.restPeriodDays != null && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Rest Period:</span>
                          <Badge variant="secondary" data-testid={`badge-rest-${pasture.id}`}>
                            {pasture.restPeriodDays} days
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setEditingPasture(pasture)}
                    data-testid={`button-edit-pasture-${pasture.id}`}
                  >
                    <Edit className="h-4 w-4 mr-1" strokeWidth={1.5} />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingPasture(pasture)}
                    data-testid={`button-delete-pasture-${pasture.id}`}
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
      <PastureDialog
        isOpen={isCreateDialogOpen || !!editingPasture}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setEditingPasture(null);
        }}
        pasture={editingPasture}
        onSubmit={(data) => {
          if (editingPasture) {
            updateMutation.mutate({ id: editingPasture.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingPasture} onOpenChange={() => setDeletingPasture(null)}>
        <DialogContent data-testid="dialog-delete-pasture">
          <DialogHeader>
            <DialogTitle>Delete Pasture</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this pasture? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingPasture(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingPasture && deleteMutation.mutate(deletingPasture.id)}
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

function PastureDialog({
  isOpen,
  onClose,
  pasture,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  pasture: Pasture | null;
  onSubmit: (data: PastureFormData) => void;
  isSubmitting: boolean;
}) {
  const form = useForm<PastureFormData>({
    resolver: zodResolver(insertPastureSchema),
    defaultValues: pasture ? {
      ...pasture,
      grazingDays: pasture.grazingDays ?? undefined,
      restPeriodDays: pasture.restPeriodDays ?? undefined,
      soilQuality: pasture.soilQuality ?? undefined,
      grassCoverKg: pasture.grassCoverKg ?? undefined,
    } : {
      name: '',
      paddockNumber: undefined,
      area: undefined,
      currentStock: 0,
      status: 'available',
      lastGrazed: '',
      notes: '',
      grazingDays: undefined,
      restPeriodDays: undefined,
      soilQuality: undefined,
      grassCoverKg: undefined,
    },
  });

  useEffect(() => {
    if (pasture) {
      form.reset({
        ...pasture,
        grazingDays: pasture.grazingDays ?? undefined,
        restPeriodDays: pasture.restPeriodDays ?? undefined,
        soilQuality: pasture.soilQuality ?? undefined,
        grassCoverKg: pasture.grassCoverKg ?? undefined,
      });
    } else {
      form.reset({
        name: '',
        paddockNumber: undefined,
        area: undefined,
        currentStock: 0,
        status: 'available',
        lastGrazed: '',
        notes: '',
        grazingDays: undefined,
        restPeriodDays: undefined,
        soilQuality: undefined,
        grassCoverKg: undefined,
      });
    }
  }, [pasture, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-pasture-form">
        <DialogHeader>
          <DialogTitle>{pasture ? 'Edit Pasture' : 'Add Pasture'}</DialogTitle>
          <DialogDescription>
            {pasture ? 'Update pasture information' : 'Add a new pasture to your farm'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paddockNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paddock Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        data-testid="input-paddock-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area (hectares)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        data-testid="input-area"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currentStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Stock</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        value={field.value || 0}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-current-stock"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'available'}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="grazing">Grazing</SelectItem>
                        <SelectItem value="resting">Resting</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastGrazed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Grazed</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" value={field.value || ''} data-testid="input-last-grazed" />
                    </FormControl>
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

            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-start" type="button" data-testid="button-toggle-health">
                  <Leaf className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  Health Tracking (Optional)
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="grazingDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grazing Days</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="Days grazed this rotation"
                            data-testid="input-grazing-days"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="restPeriodDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rest Period Days</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="Days since last grazing"
                            data-testid="input-rest-period-days"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="soilQuality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Soil Quality (1-10)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min="1"
                            max="10"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="1=Poor, 10=Excellent"
                            data-testid="input-soil-quality"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="grassCoverKg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grass Cover (kg/ha)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="Dry matter per hectare"
                            data-testid="input-grass-cover"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-pasture">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-submit-pasture">
                {isSubmitting ? 'Saving...' : pasture ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        {pasture && <PastureHealthHistory pastureId={pasture.id} />}
      </DialogContent>
    </Dialog>
  );
}

function PastureHealthHistory({ pastureId }: { pastureId: string }) {
  const { data: records, isLoading } = useQuery<PastureHealthRecord[]>({
    queryKey: ['/api/pastures', pastureId, 'health-records'],
    enabled: !!pastureId,
  });

  if (isLoading) {
    return (
      <div className="mt-6 space-y-2" data-testid="section-health-history-loading">
        <h3 className="text-sm font-medium">Health History</h3>
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <div className="mt-6" data-testid="section-health-history-empty">
        <h3 className="text-sm font-medium mb-2">Health History</h3>
        <p className="text-sm text-muted-foreground">No health records yet</p>
      </div>
    );
  }

  return (
    <div className="mt-6" data-testid="section-health-history">
      <h3 className="text-sm font-medium mb-3">Health History</h3>
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {records.map((record) => (
          <Card key={record.id} data-testid={`card-health-record-${record.id}`}>
            <CardContent className="pt-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-muted-foreground" data-testid={`text-recorded-at-${record.id}`}>
                  {new Date(record.recordedAt).toLocaleDateString()} at {new Date(record.recordedAt).toLocaleTimeString()}
                </span>
                <span className="text-xs text-muted-foreground" data-testid={`text-recorded-by-${record.id}`}>
                  By: {record.recordedBy}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {record.grazingDays !== null && record.grazingDays !== undefined && (
                  <div data-testid={`text-grazing-days-${record.id}`}>
                    <span className="text-muted-foreground">Grazing Days:</span> {record.grazingDays}
                  </div>
                )}
                {record.restPeriodDays !== null && record.restPeriodDays !== undefined && (
                  <div data-testid={`text-rest-period-${record.id}`}>
                    <span className="text-muted-foreground">Rest Period:</span> {record.restPeriodDays}d
                  </div>
                )}
                {record.soilQuality !== null && record.soilQuality !== undefined && (
                  <div data-testid={`text-soil-quality-${record.id}`}>
                    <span className="text-muted-foreground">Soil Quality:</span> {record.soilQuality}/10
                  </div>
                )}
                {record.grassCoverKg !== null && record.grassCoverKg !== undefined && (
                  <div data-testid={`text-grass-cover-${record.id}`}>
                    <span className="text-muted-foreground">Grass Cover:</span> {record.grassCoverKg} kg/ha
                  </div>
                )}
              </div>
              {record.notes && (
                <p className="text-sm text-muted-foreground mt-2" data-testid={`text-notes-${record.id}`}>
                  {record.notes}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
