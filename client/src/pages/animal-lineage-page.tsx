import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  GitBranch, Users, ArrowLeft, Heart, Baby, Crown, 
  Loader2, AlertCircle, ChevronRight, Edit, Link as LinkIcon
} from "lucide-react";
import type { Animal } from "@shared/schema";

interface AnimalSummary {
  id: string;
  cowId: string | null;
  naitTag: string | null;
  breed: string | null;
  sex: string | null;
  dateOfBirth: string | null;
  status: string;
  inSystem?: boolean;
  external?: boolean;
  name?: string;
  registrationNumber?: string;
}

interface LineageNode {
  animal: AnimalSummary;
  dam?: LineageNode;
  sire?: LineageNode | { external: true; info: any };
}

interface OffspringResponse {
  animalId: string;
  animalName: string;
  parentType: string;
  offspringCount: number;
  offspring: Array<AnimalSummary & { relationship: string }>;
}

interface ParentsResponse {
  animalId: string;
  animalName: string;
  dam: AnimalSummary | null;
  sire: AnimalSummary | null;
}

interface SiblingsResponse {
  animalId: string;
  fullSiblings: AnimalSummary[];
  maternalHalfSiblings: AnimalSummary[];
  paternalHalfSiblings: AnimalSummary[];
}

interface BreedingStatsResponse {
  animalId: string;
  animalName: string;
  sex: string | null;
  breeding: {
    totalOffspring: number;
    maleOffspring: number;
    femaleOffspring: number;
    activeOffspring: number;
    calvings: number;
    pregnancyChecks: number;
    aiEvents: number;
  };
  geneticInfo: any;
}

// Pedigree Tree Node Component
function PedigreeNode({ node, depth = 0 }: { node: LineageNode | { external: true; info: any }; depth?: number }) {
  if ('external' in node && node.external) {
    return (
      <div className="p-2 rounded border border-dashed border-gray-300 bg-gray-50 text-sm">
        <div className="flex items-center gap-1">
          <Crown className="h-3 w-3 text-amber-500" />
          <span className="font-medium">{node.info?.name || 'External Sire'}</span>
        </div>
        {node.info?.breed && <p className="text-xs text-muted-foreground">{node.info.breed}</p>}
        {node.info?.registrationNumber && (
          <p className="text-xs text-muted-foreground">Reg: {node.info.registrationNumber}</p>
        )}
      </div>
    );
  }

  const lineageNode = node as LineageNode;
  const animal = lineageNode.animal;
  
  return (
    <div className="flex flex-col items-center">
      <Link href={`/app/animals/${animal.id}/lineage`}>
        <a className={`block p-3 rounded-lg border-2 cursor-pointer hover:shadow-md transition-shadow ${
          animal.sex === 'female' 
            ? 'border-pink-300 bg-pink-50' 
            : 'border-blue-300 bg-blue-50'
        }`}>
          <div className="flex items-center gap-2">
            {animal.sex === 'female' ? (
              <span className="text-pink-600">♀</span>
            ) : (
              <span className="text-blue-600">♂</span>
            )}
            <span className="font-medium">{animal.cowId || animal.naitTag || animal.id.slice(0, 8)}</span>
          </div>
          {animal.breed && <p className="text-xs text-muted-foreground">{animal.breed}</p>}
          {animal.dateOfBirth && (
            <p className="text-xs text-muted-foreground">
              {format(new Date(animal.dateOfBirth), "yyyy")}
            </p>
          )}
          <Badge variant={animal.status === 'active' ? 'default' : 'secondary'} className="mt-1 text-xs">
            {animal.status}
          </Badge>
        </a>
      </Link>
      
      {(lineageNode.dam || lineageNode.sire) && depth < 3 && (
        <div className="mt-4">
          <div className="w-px h-4 bg-gray-300 mx-auto" />
          <div className="flex gap-8">
            {lineageNode.dam && (
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-gray-300" />
                <p className="text-xs text-muted-foreground mb-1">Dam</p>
                <PedigreeNode node={lineageNode.dam} depth={depth + 1} />
              </div>
            )}
            {lineageNode.sire && (
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-gray-300" />
                <p className="text-xs text-muted-foreground mb-1">Sire</p>
                <PedigreeNode node={lineageNode.sire} depth={depth + 1} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnimalLineagePage() {
  const [, params] = useRoute("/app/animals/:animalId/lineage");
  const animalId = params?.animalId;
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("pedigree");
  const [showEditParentsDialog, setShowEditParentsDialog] = useState(false);
  const [selectedDamId, setSelectedDamId] = useState<string>("");
  const [selectedSireId, setSelectedSireId] = useState<string>("");
  const [externalSireName, setExternalSireName] = useState("");
  const [externalSireBreed, setExternalSireBreed] = useState("");
  const [externalSireReg, setExternalSireReg] = useState("");

  // Fetch animal
  const { data: animal, isLoading: loadingAnimal } = useQuery<Animal>({
    queryKey: ["/api/animals", animalId],
    queryFn: async () => {
      const res = await fetch(`/api/animals/${animalId}`);
      if (!res.ok) throw new Error("Failed to fetch animal");
      return res.json();
    },
    enabled: !!animalId,
  });

  // Fetch all animals for selection
  const { data: allAnimals = [] } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
    queryFn: async () => {
      const res = await fetch("/api/animals");
      if (!res.ok) throw new Error("Failed to fetch animals");
      return res.json();
    },
  });

  // Fetch lineage
  const { data: lineageData, isLoading: loadingLineage } = useQuery<{ lineage: LineageNode }>({
    queryKey: ["/api/lineage", animalId],
    queryFn: async () => {
      const res = await fetch(`/api/lineage/${animalId}?depth=3`);
      if (!res.ok) throw new Error("Failed to fetch lineage");
      return res.json();
    },
    enabled: !!animalId,
  });

  // Fetch offspring
  const { data: offspringData } = useQuery<OffspringResponse>({
    queryKey: ["/api/lineage", animalId, "offspring"],
    queryFn: async () => {
      const res = await fetch(`/api/lineage/${animalId}/offspring`);
      if (!res.ok) throw new Error("Failed to fetch offspring");
      return res.json();
    },
    enabled: !!animalId,
  });

  // Fetch parents
  const { data: parentsData } = useQuery<ParentsResponse>({
    queryKey: ["/api/lineage", animalId, "parents"],
    queryFn: async () => {
      const res = await fetch(`/api/lineage/${animalId}/parents`);
      if (!res.ok) throw new Error("Failed to fetch parents");
      return res.json();
    },
    enabled: !!animalId,
  });

  // Fetch siblings
  const { data: siblingsData } = useQuery<SiblingsResponse>({
    queryKey: ["/api/lineage", animalId, "siblings"],
    queryFn: async () => {
      const res = await fetch(`/api/lineage/${animalId}/siblings`);
      if (!res.ok) throw new Error("Failed to fetch siblings");
      return res.json();
    },
    enabled: !!animalId,
  });

  // Fetch breeding stats
  const { data: breedingStats } = useQuery<BreedingStatsResponse>({
    queryKey: ["/api/lineage", animalId, "breeding-stats"],
    queryFn: async () => {
      const res = await fetch(`/api/lineage/${animalId}/breeding-stats`);
      if (!res.ok) throw new Error("Failed to fetch breeding stats");
      return res.json();
    },
    enabled: !!animalId,
  });

  // Update parents mutation
  const updateParentsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/lineage/${animalId}/parents`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update parents");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Parents updated successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/lineage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/animals"] });
      setShowEditParentsDialog(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleUpdateParents = () => {
    const data: any = {};
    
    if (selectedDamId) {
      data.damId = selectedDamId;
    } else {
      data.damId = null;
    }
    
    if (selectedSireId) {
      data.sireId = selectedSireId;
      data.sireInfo = null;
    } else if (externalSireName) {
      data.sireId = null;
      data.sireInfo = {
        name: externalSireName,
        breed: externalSireBreed || undefined,
        registrationNumber: externalSireReg || undefined,
      };
    } else {
      data.sireId = null;
      data.sireInfo = null;
    }
    
    updateParentsMutation.mutate(data);
  };

  const openEditDialog = () => {
    setSelectedDamId(parentsData?.dam?.id || "");
    setSelectedSireId(parentsData?.sire?.id || "");
    if (parentsData?.sire && !parentsData.sire.inSystem) {
      setExternalSireName(parentsData.sire.name || "");
      setExternalSireBreed(parentsData.sire.breed || "");
      setExternalSireReg(parentsData.sire.registrationNumber || "");
    } else {
      setExternalSireName("");
      setExternalSireBreed("");
      setExternalSireReg("");
    }
    setShowEditParentsDialog(true);
  };

  // Filter animals for dam/sire selection
  const femaleAnimals = allAnimals.filter(a => a.sex === 'female' && a.id !== animalId);
  const maleAnimals = allAnimals.filter(a => a.sex === 'male' && a.id !== animalId);

  if (!animalId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p>No animal selected</p>
            <Link href="/app/animals">
              <a><Button className="mt-4">Go to Animals</Button></a>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/app/animals">
          <a><Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button></a>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GitBranch className="h-8 w-8 text-primary" />
            Lineage & Offspring
          </h1>
          <p className="text-muted-foreground mt-1">
            {animal?.cowId || animal?.naitTag || "Loading..."} - Family tree and breeding records
          </p>
        </div>
        <Button variant="outline" onClick={openEditDialog}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Parents
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-500" />
              <span className="text-sm text-muted-foreground">Dam</span>
            </div>
            <p className="font-medium mt-1">
              {parentsData?.dam?.cowId || parentsData?.dam?.naitTag || "Unknown"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Sire</span>
            </div>
            <p className="font-medium mt-1">
              {parentsData?.sire?.cowId || parentsData?.sire?.naitTag || parentsData?.sire?.name || "Unknown"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Baby className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Offspring</span>
            </div>
            <p className="text-2xl font-bold">{offspringData?.offspringCount || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Siblings</span>
            </div>
            <p className="text-2xl font-bold">
              {(siblingsData?.fullSiblings.length || 0) + 
               (siblingsData?.maternalHalfSiblings.length || 0) + 
               (siblingsData?.paternalHalfSiblings.length || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pedigree">Pedigree Tree</TabsTrigger>
          <TabsTrigger value="offspring">Offspring ({offspringData?.offspringCount || 0})</TabsTrigger>
          <TabsTrigger value="siblings">Siblings</TabsTrigger>
          <TabsTrigger value="breeding">Breeding Stats</TabsTrigger>
        </TabsList>

        {/* Pedigree Tab */}
        <TabsContent value="pedigree" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Family Tree</CardTitle>
              <CardDescription>
                View ancestors up to 3 generations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLineage ? (
                <div className="py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                </div>
              ) : lineageData?.lineage ? (
                <ScrollArea className="w-full">
                  <div className="min-w-[600px] p-4 flex justify-center">
                    <PedigreeNode node={lineageData.lineage} />
                  </div>
                </ScrollArea>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No lineage data available</p>
                  <Button className="mt-4" variant="outline" onClick={openEditDialog}>
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Link Parents
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Offspring Tab */}
        <TabsContent value="offspring" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Baby className="h-5 w-5" />
                Offspring List
              </CardTitle>
              <CardDescription>
                All progeny of this animal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {offspringData?.offspring.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Baby className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No offspring recorded</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Sex</TableHead>
                      <TableHead>Breed</TableHead>
                      <TableHead>Born</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {offspringData?.offspring.map((offspring) => (
                      <TableRow key={offspring.id}>
                        <TableCell className="font-medium">
                          {offspring.cowId || offspring.naitTag || offspring.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          {offspring.sex === 'female' ? (
                            <span className="text-pink-600">♀ Female</span>
                          ) : (
                            <span className="text-blue-600">♂ Male</span>
                          )}
                        </TableCell>
                        <TableCell>{offspring.breed || "—"}</TableCell>
                        <TableCell>
                          {offspring.dateOfBirth 
                            ? format(new Date(offspring.dateOfBirth), "MMM d, yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={offspring.status === 'active' ? 'default' : 'secondary'}>
                            {offspring.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link href={`/app/animals/${offspring.id}/lineage`}>
                            <a><Button size="sm" variant="ghost">
                              <ChevronRight className="h-4 w-4" />
                            </Button></a>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Siblings Tab */}
        <TabsContent value="siblings" className="mt-4">
          <div className="space-y-4">
            {/* Full Siblings */}
            <Card>
              <CardHeader>
                <CardTitle>Full Siblings</CardTitle>
                <CardDescription>Same dam and sire</CardDescription>
              </CardHeader>
              <CardContent>
                {siblingsData?.fullSiblings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No full siblings</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {siblingsData?.fullSiblings.map((sibling) => (
                      <Link key={sibling.id} href={`/app/animals/${sibling.id}/lineage`}>
                        <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                          {sibling.sex === 'female' ? '♀' : '♂'} {sibling.cowId || sibling.naitTag || sibling.id.slice(0, 8)}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Maternal Half Siblings */}
            <Card>
              <CardHeader>
                <CardTitle>Maternal Half-Siblings</CardTitle>
                <CardDescription>Same dam, different sire</CardDescription>
              </CardHeader>
              <CardContent>
                {siblingsData?.maternalHalfSiblings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No maternal half-siblings</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {siblingsData?.maternalHalfSiblings.map((sibling) => (
                      <Link key={sibling.id} href={`/app/animals/${sibling.id}/lineage`}>
                        <Badge variant="outline" className="cursor-pointer hover:bg-muted border-pink-200">
                          {sibling.sex === 'female' ? '♀' : '♂'} {sibling.cowId || sibling.naitTag || sibling.id.slice(0, 8)}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Paternal Half Siblings */}
            <Card>
              <CardHeader>
                <CardTitle>Paternal Half-Siblings</CardTitle>
                <CardDescription>Same sire, different dam</CardDescription>
              </CardHeader>
              <CardContent>
                {siblingsData?.paternalHalfSiblings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No paternal half-siblings</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {siblingsData?.paternalHalfSiblings.map((sibling) => (
                      <Link key={sibling.id} href={`/app/animals/${sibling.id}/lineage`}>
                        <Badge variant="outline" className="cursor-pointer hover:bg-muted border-blue-200">
                          {sibling.sex === 'female' ? '♀' : '♂'} {sibling.cowId || sibling.naitTag || sibling.id.slice(0, 8)}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Breeding Stats Tab */}
        <TabsContent value="breeding" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Breeding Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Offspring</span>
                  <span className="font-bold">{breedingStats?.breeding.totalOffspring || 0}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Male Offspring</span>
                  <span className="font-medium text-blue-600">{breedingStats?.breeding.maleOffspring || 0}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Female Offspring</span>
                  <span className="font-medium text-pink-600">{breedingStats?.breeding.femaleOffspring || 0}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Offspring</span>
                  <span className="font-medium text-green-600">{breedingStats?.breeding.activeOffspring || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reproduction Events</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Calvings</span>
                  <span className="font-bold">{breedingStats?.breeding.calvings || 0}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pregnancy Checks</span>
                  <span className="font-medium">{breedingStats?.breeding.pregnancyChecks || 0}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI Events</span>
                  <span className="font-medium">{breedingStats?.breeding.aiEvents || 0}</span>
                </div>
              </CardContent>
            </Card>

            {breedingStats?.geneticInfo && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Genetic Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {breedingStats.geneticInfo.breedingValue && (
                      <div>
                        <p className="text-sm text-muted-foreground">Breeding Value</p>
                        <p className="text-lg font-bold">{breedingStats.geneticInfo.breedingValue}</p>
                      </div>
                    )}
                    {breedingStats.geneticInfo.inbreedingCoefficient && (
                      <div>
                        <p className="text-sm text-muted-foreground">Inbreeding Coefficient</p>
                        <p className="text-lg font-bold">{breedingStats.geneticInfo.inbreedingCoefficient}%</p>
                      </div>
                    )}
                    {breedingStats.geneticInfo.geneticMerit && (
                      <div>
                        <p className="text-sm text-muted-foreground">Genetic Merit</p>
                        <p className="text-lg font-bold">{breedingStats.geneticInfo.geneticMerit}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Parents Dialog */}
      <Dialog open={showEditParentsDialog} onOpenChange={setShowEditParentsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Parents</DialogTitle>
            <DialogDescription>
              Set the dam (mother) and sire (father) for this animal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Dam Selection */}
            <div>
              <Label>Dam (Mother)</Label>
              <Select value={selectedDamId} onValueChange={setSelectedDamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select dam" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {femaleAnimals.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.cowId || a.naitTag || a.id.slice(0, 8)} - {a.breed || "Unknown breed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sire Selection */}
            <div>
              <Label>Sire (Father) - In System</Label>
              <Select value={selectedSireId} onValueChange={(v) => {
                setSelectedSireId(v);
                if (v) {
                  setExternalSireName("");
                  setExternalSireBreed("");
                  setExternalSireReg("");
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sire from herd" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None / External</SelectItem>
                  {maleAnimals.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.cowId || a.naitTag || a.id.slice(0, 8)} - {a.breed || "Unknown breed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* External Sire */}
            {!selectedSireId && (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                <Label className="text-sm font-medium">External Sire (AI, etc.)</Label>
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={externalSireName}
                    onChange={(e) => setExternalSireName(e.target.value)}
                    placeholder="e.g., Premier Sires ABC123"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Breed</Label>
                    <Input
                      value={externalSireBreed}
                      onChange={(e) => setExternalSireBreed(e.target.value)}
                      placeholder="e.g., Holstein"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Registration #</Label>
                    <Input
                      value={externalSireReg}
                      onChange={(e) => setExternalSireReg(e.target.value)}
                      placeholder="e.g., NZ123456"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditParentsDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateParents}
              disabled={updateParentsMutation.isPending}
            >
              {updateParentsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Parents
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
