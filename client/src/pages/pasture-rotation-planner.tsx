import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Animal, Pasture } from "@shared/schema";
import { MoveIcon, ArrowRightIcon, CheckIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PastureRotationPlanner() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedAnimals, setSelectedAnimals] = useState<Set<string>>(new Set());
  const [targetPasture, setTargetPasture] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [moveReason, setMoveReason] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");

  // Fetch data
  const { data: animals = [], isLoading: animalsLoading } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
  });

  const { data: pastures = [], isLoading: pasturesLoading } = useQuery<Pasture[]>({
    queryKey: ["/api/pastures"],
  });

  // Groups and memberships for group-based filtering
  const { data: groups = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/groups"],
  });

  const { data: memberships = [] } = useQuery<{ groupId: string; animalId: string }[]>({
    queryKey: ["/api/groups/memberships"],
    queryFn: async () => {
      const res = await fetch("/api/groups/memberships");
      if (!res.ok) throw new Error("Failed to fetch group memberships");
      return res.json();
    },
  });

  const isLoading = animalsLoading || pasturesLoading;

  // Filter animals by selected group, if any
  const filteredAnimals = useMemo(() => {
    if (selectedGroupId === "all") return animals;
    const memberSet = new Set(
      memberships
        .filter((m) => m.groupId === selectedGroupId)
        .map((m) => m.animalId)
    );
    return animals.filter((a) => memberSet.has(a.id));
  }, [animals, memberships, selectedGroupId]);

  // Group animals by pasture
  const animalsByPasture = filteredAnimals.reduce((acc, animal) => {
    const pastureId = animal.currentPastureId || "unassigned";
    if (!acc[pastureId]) acc[pastureId] = [];
    acc[pastureId].push(animal);
    return acc;
  }, {} as Record<string, Animal[]>);

  // Move mutation
  const moveMutation = useMutation({
    mutationFn: async ({
      animalIds,
      toPastureId,
      reason,
    }: {
      animalIds: string[];
      toPastureId: string;
      reason?: string;
    }) => {
      return await apiRequest("/api/pasture-movements/bulk", "POST", {
        animalIds,
        toPastureId,
        movedBy: user?.name || user?.id || "unknown",
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/animals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pastures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pasture-movements"] });
      
      toast({
        title: "Animals moved successfully",
        description: `${selectedAnimals.size} animal(s) moved to new pasture`,
      });
      
      setSelectedAnimals(new Set());
      setTargetPasture(null);
      setShowConfirmDialog(false);
      setMoveReason("");
    },
    onError: (error) => {
      toast({
        title: "Failed to move animals",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleAnimalSelection = (animalId: string) => {
    const newSelection = new Set(selectedAnimals);
    if (newSelection.has(animalId)) {
      newSelection.delete(animalId);
    } else {
      newSelection.add(animalId);
    }
    setSelectedAnimals(newSelection);
  };

  const handleMoveClick = () => {
    if (selectedAnimals.size === 0 || !targetPasture) return;
    
    // Prevent no-op moves: check if any selected animal is already in target pasture
    const animalsAlreadyInTarget = Array.from(selectedAnimals).filter(animalId => {
      const animal = animals.find(a => a.id === animalId);
      return animal?.currentPastureId === targetPasture;
    });
    
    if (animalsAlreadyInTarget.length === selectedAnimals.size) {
      toast({
        title: "Animals already in target pasture",
        description: "All selected animals are already in this pasture",
        variant: "destructive",
      });
      return;
    }
    
    setShowConfirmDialog(true);
  };

  const confirmMove = () => {
    if (!targetPasture) return;
    moveMutation.mutate({
      animalIds: Array.from(selectedAnimals),
      toPastureId: targetPasture,
      reason: moveReason.trim() || undefined,
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl" data-testid="page-rotation-planner">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Pasture Rotation Planner</h1>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-muted-foreground">
            Select animals and move them between pastures for optimal rotation management
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Group:</span>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="w-56" data-testid="select-group-filter">
                <SelectValue placeholder="All animals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All animals</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Selection Summary */}
      {selectedAnimals.size > 0 && (
        <Card className="mb-6 border-primary" data-testid="card-selection-summary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Badge variant="default" className="text-lg px-3 py-1" data-testid="badge-selected-count">
                  {selectedAnimals.size} selected
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedAnimals(new Set())}
                  data-testid="button-clear-selection"
                >
                  Clear selection
                </Button>
              </div>
              
              {targetPasture && (
                <div className="flex items-center gap-3">
                  <ArrowRightIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Moving to: {pastures.find(p => p.id === targetPasture)?.name}
                  </span>
                  <Button
                    onClick={handleMoveClick}
                    disabled={moveMutation.isPending}
                    data-testid="button-confirm-move"
                  >
                    <MoveIcon className="h-4 w-4 mr-2" />
                    Move Animals
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pasture Columns */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Unassigned Animals */}
          <Card
            className={`${targetPasture === "unassigned" ? "ring-2 ring-primary" : ""}`}
            data-testid="card-pasture-unassigned"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Unassigned</CardTitle>
                <Badge variant="secondary" data-testid="badge-unassigned-count">
                  {animalsByPasture["unassigned"]?.length || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Holding pen</span>
                <Button
                  variant={targetPasture === "unassigned" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTargetPasture("unassigned")}
                  disabled={selectedAnimals.size === 0 || targetPasture === "unassigned"}
                  data-testid="button-target-unassigned"
                >
                  {targetPasture === "unassigned" ? "Target ✓" : "Set as target"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {animalsByPasture["unassigned"]?.length > 0 ? (
                animalsByPasture["unassigned"].map((animal) => (
                  <div
                    key={animal.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedAnimals.has(animal.id)
                        ? "bg-primary/10 border-primary"
                        : "bg-card hover-elevate active-elevate-2"
                    }`}
                    onClick={() => toggleAnimalSelection(animal.id)}
                    data-testid={`animal-card-${animal.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{animal.cowId || animal.naitTag}</div>
                        {animal.breed && (
                          <div className="text-sm text-muted-foreground">{animal.breed}</div>
                        )}
                      </div>
                      {selectedAnimals.has(animal.id) && (
                        <CheckIcon className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No unassigned animals
                </p>
              )}
            </CardContent>
          </Card>

          {/* Assigned Pastures */}
          {pastures.map((pasture) => (
            <Card
              key={pasture.id}
              className={`${targetPasture === pasture.id ? "ring-2 ring-primary" : ""}`}
              data-testid={`card-pasture-${pasture.id}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{pasture.name}</CardTitle>
                  <Badge variant="secondary" data-testid={`badge-count-${pasture.id}`}>
                    {animalsByPasture[pasture.id]?.length || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status: {pasture.status}</span>
                  <Button
                    variant={targetPasture === pasture.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTargetPasture(pasture.id)}
                    disabled={selectedAnimals.size === 0 || targetPasture === pasture.id}
                    data-testid={`button-target-${pasture.id}`}
                  >
                    {targetPasture === pasture.id ? "Target ✓" : "Set as target"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                {animalsByPasture[pasture.id]?.length > 0 ? (
                  animalsByPasture[pasture.id].map((animal) => (
                    <div
                      key={animal.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedAnimals.has(animal.id)
                          ? "bg-primary/10 border-primary"
                          : "bg-card hover-elevate active-elevate-2"
                      }`}
                      onClick={() => toggleAnimalSelection(animal.id)}
                      data-testid={`animal-card-${animal.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{animal.cowId || animal.naitTag}</div>
                          {animal.breed && (
                            <div className="text-sm text-muted-foreground">{animal.breed}</div>
                          )}
                        </div>
                        {selectedAnimals.has(animal.id) && (
                          <CheckIcon className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No animals in this pasture
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent data-testid="dialog-confirm-move">
          <DialogHeader>
            <DialogTitle>Confirm Animal Movement</DialogTitle>
            <DialogDescription>
              Move {selectedAnimals.size} animal(s) to{" "}
              {pastures.find((p) => p.id === targetPasture)?.name}?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Reason for movement (optional)
              </label>
              <Textarea
                placeholder="e.g., Rotation schedule, Pasture rest, Feed quality..."
                value={moveReason}
                onChange={(e) => setMoveReason(e.target.value)}
                rows={3}
                data-testid="textarea-move-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={moveMutation.isPending}
              data-testid="button-cancel-move"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmMove}
              disabled={moveMutation.isPending}
              data-testid="button-execute-move"
            >
              {moveMutation.isPending ? "Moving..." : "Confirm Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
