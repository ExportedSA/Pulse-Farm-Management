import { useState, useEffect } from "react";
import { Calendar, Plus, Edit, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ReproductionEvent, Animal } from "@/../../shared/schema";
import { insertReproductionEventSchema } from "@/../../shared/schema";
import type { z } from "zod";

type ReproEventFormData = z.infer<typeof insertReproductionEventSchema>;

const eventTypeColors = {
  heat: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100",
  ai: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  pregnancy_check: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  calving: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
};

const eventTypeLabels = {
  heat: "Heat Detected",
  ai: "AI/Mating",
  pregnancy_check: "Pregnancy Check",
  calving: "Calving",
};

export default function ReproductionPlanner() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ReproductionEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<ReproductionEvent | null>(null);

  // Fetch events
  const { data: events = [], isLoading: isLoadingEvents } = useQuery<ReproductionEvent[]>({
    queryKey: ['/api/reproduction-events'],
  });

  // Fetch animals for dropdown
  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ['/api/animals'],
  });

  // Create event mutation
  const createMutation = useMutation({
    mutationFn: async (data: ReproEventFormData) => {
      const res = await apiRequest('/api/reproduction-events', 'POST', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reproduction-events'] });
      toast.success('Event recorded successfully');
      setIsCreateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to record event: ${error.message}`);
    },
  });

  // Update event mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ReproEventFormData> }) => {
      const res = await apiRequest(`/api/reproduction-events/${id}`, 'PUT', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reproduction-events'] });
      toast.success('Event updated successfully');
      setEditingEvent(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update event: ${error.message}`);
    },
  });

  // Delete event mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/reproduction-events/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reproduction-events'] });
      toast.success('Event deleted successfully');
      setDeletingEvent(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete event: ${error.message}`);
    },
  });

  // Filter events
  const filteredEvents = events.filter(event => {
    if (filterType !== 'all' && event.eventType !== filterType) return false;
    if (searchQuery) {
      const animal = animals.find(a => a.id === event.animalId);
      const searchLower = searchQuery.toLowerCase();
      return (
        animal?.naitTag?.toLowerCase().includes(searchLower) ||
        animal?.cowId?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  // Sort by date desc
  const sortedEvents = [...filteredEvents].sort((a, b) => 
    new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-reproduction-title">
            Reproduction Planner
          </h1>
          <p className="text-muted-foreground">Manage heat detection, AI, pregnancy tracking, and calving</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-record-event">
          <Plus className="mr-2 h-5 w-5" strokeWidth={1.5} />
          Record Event
        </Button>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          <Input
            placeholder="Search by animal tag or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
            data-testid="input-search-events"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full md:w-48 h-12" data-testid="select-event-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="heat">Heat Detection</SelectItem>
            <SelectItem value="ai">AI/Mating</SelectItem>
            <SelectItem value="pregnancy_check">Pregnancy Check</SelectItem>
            <SelectItem value="calving">Calving</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoadingEvents ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedEvents.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" strokeWidth={1.5} />
            <p className="text-muted-foreground mb-4" data-testid="text-no-events">
              {searchQuery || filterType !== 'all' ? 'No events found matching your filters.' : 'No reproduction events recorded yet. Start tracking your herd\'s breeding cycle.'}
            </p>
            {!searchQuery && filterType === 'all' && (
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-record-first-event">
                <Plus className="mr-2 h-5 w-5" strokeWidth={1.5} />
                Record First Event
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedEvents.map((event) => {
            const animal = animals.find(a => a.id === event.animalId);
            return (
              <Card key={event.id} className="hover-elevate" data-testid={`card-event-${event.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Badge className={eventTypeColors[event.eventType]} data-testid={`badge-type-${event.id}`}>
                          {eventTypeLabels[event.eventType]}
                        </Badge>
                        <span className="font-mono font-semibold">
                          {animal?.naitTag || animal?.cowId || 'Unknown Animal'}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {new Date(event.eventDate).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {event.eventType === 'ai' && event.aiDetails && (
                        <div className="text-sm space-y-1 mb-2">
                          {event.aiDetails.bullCode && (
                            <div>
                              <span className="text-muted-foreground">Bull Code:</span> {event.aiDetails.bullCode}
                            </div>
                          )}
                          {event.aiDetails.technician && (
                            <div>
                              <span className="text-muted-foreground">Technician:</span> {event.aiDetails.technician}
                            </div>
                          )}
                        </div>
                      )}

                      {event.eventType === 'pregnancy_check' && event.pregnancyDetails && (
                        <div className="text-sm space-y-1 mb-2">
                          <div>
                            <span className="text-muted-foreground">Result:</span> {event.pregnancyDetails.result}
                          </div>
                        </div>
                      )}

                      {event.eventType === 'calving' && event.calvingDetails && (
                        <div className="text-sm space-y-1 mb-2">
                          {event.calvingDetails.calvingSex && (
                            <div>
                              <span className="text-muted-foreground">Calf:</span> {event.calvingDetails.calvingSex}
                            </div>
                          )}
                          {event.calvingDetails.calvingDifficulty && (
                            <div>
                              <span className="text-muted-foreground">Difficulty:</span> {event.calvingDetails.calvingDifficulty}
                            </div>
                          )}
                        </div>
                      )}

                      {event.notes && (
                        <div className="text-sm text-muted-foreground mt-2">
                          {event.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingEvent(event)}
                        data-testid={`button-edit-event-${event.id}`}
                      >
                        <Edit className="h-4 w-4" strokeWidth={1.5} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingEvent(event)}
                        data-testid={`button-delete-event-${event.id}`}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <ReproEventDialog
        isOpen={isCreateDialogOpen || !!editingEvent}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
        animals={animals}
        onSubmit={(data) => {
          if (editingEvent) {
            updateMutation.mutate({ id: editingEvent.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingEvent} onOpenChange={() => setDeletingEvent(null)}>
        <DialogContent data-testid="dialog-delete-event">
          <DialogHeader>
            <DialogTitle>Delete Reproduction Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingEvent(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingEvent && deleteMutation.mutate(deletingEvent.id)}
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

// Reproduction Event Dialog Component
function ReproEventDialog({
  isOpen,
  onClose,
  event,
  animals,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  event: ReproductionEvent | null;
  animals: Animal[];
  onSubmit: (data: ReproEventFormData) => void;
  isSubmitting: boolean;
}) {
  const form = useForm<ReproEventFormData>({
    resolver: zodResolver(insertReproductionEventSchema),
    defaultValues: event || {
      animalId: '',
      eventType: 'heat',
      eventDate: new Date().toISOString().split('T')[0],
      aiDetails: undefined,
      pregnancyDetails: undefined,
      calvingDetails: undefined,
      notes: '',
    },
  });

  const eventType = form.watch('eventType');

  useEffect(() => {
    if (event) {
      form.reset(event);
    } else {
      form.reset({
        animalId: '',
        eventType: 'heat',
        eventDate: new Date().toISOString().split('T')[0],
        aiDetails: undefined,
        pregnancyDetails: undefined,
        calvingDetails: undefined,
        notes: '',
      });
    }
  }, [event, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-event-form">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'Record Reproduction Event'}</DialogTitle>
          <DialogDescription>
            {event ? 'Update event information' : 'Record a new reproduction event'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="animalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Animal *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-animal">
                          <SelectValue placeholder="Select animal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {animals.map((animal) => (
                          <SelectItem key={animal.id} value={animal.id}>
                            {animal.naitTag || animal.cowId || `Animal ${animal.id.slice(0, 8)}`}
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
                name="eventType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-event-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="heat">Heat Detection</SelectItem>
                        <SelectItem value="ai">AI/Mating</SelectItem>
                        <SelectItem value="pregnancy_check">Pregnancy Check</SelectItem>
                        <SelectItem value="calving">Calving</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="eventDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Date *</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-event-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* AI-specific fields */}
            {eventType === 'ai' && (
              <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="font-semibold">AI Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="aiDetails.bullCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bull Code</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value as string | undefined ?? ''} data-testid="input-bull-code" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="aiDetails.technician"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Technician</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value as string | undefined ?? ''} data-testid="input-technician" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Pregnancy check-specific fields */}
            {eventType === 'pregnancy_check' && (
              <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="font-semibold">Pregnancy Check Details</h3>
                <FormField
                  control={form.control}
                  name="pregnancyDetails.result"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Result</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value as string | undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="select-pregnancy-result">
                            <SelectValue placeholder="Select result" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pregnant">Pregnant</SelectItem>
                          <SelectItem value="not_pregnant">Not Pregnant</SelectItem>
                          <SelectItem value="unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Calving-specific fields */}
            {eventType === 'calving' && (
              <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="font-semibold">Calving Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="calvingDetails.calvingSex"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Calf Sex</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value as string | undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-calf-sex">
                              <SelectValue placeholder="Select sex" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="heifer">Heifer</SelectItem>
                            <SelectItem value="bull">Bull</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="calvingDetails.calvingDifficulty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulty</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value as string | undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-calving-difficulty">
                              <SelectValue placeholder="Select difficulty" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="assisted">Assisted</SelectItem>
                            <SelectItem value="difficult">Difficult</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

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
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-event">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-submit-event">
                {isSubmitting ? 'Saving...' : event ? 'Update' : 'Record'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
