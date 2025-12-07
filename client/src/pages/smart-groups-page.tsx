import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import { 
  Users, Plus, RefreshCw, Trash2, Edit, Eye, Zap, Filter,
  CheckCircle2, AlertCircle, Loader2, Settings, Play, Sparkles
} from "lucide-react";
import type { Animal, AnimalGroup } from "@shared/schema";

// Rule operators
const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "greater_than", label: "Greater Than" },
  { value: "less_than", label: "Less Than" },
  { value: "in", label: "In List" },
  { value: "not_in", label: "Not In List" },
  { value: "is_null", label: "Is Empty" },
  { value: "is_not_null", label: "Is Not Empty" },
];

// Available fields for rules
const RULE_FIELDS = [
  { value: "status", label: "Status", type: "select", options: ["active", "sold", "deceased"] },
  { value: "sex", label: "Sex", type: "select", options: ["male", "female"] },
  { value: "breed", label: "Breed", type: "text" },
  { value: "ageMonths", label: "Age (Months)", type: "number" },
  { value: "ageDays", label: "Age (Days)", type: "number" },
  { value: "currentPastureId", label: "Current Pasture", type: "pasture" },
  { value: "reproductionStatus", label: "Reproduction Status", type: "select", options: ["open", "bred", "confirmed_pregnant", "dry"] },
  { value: "lactationStatus", label: "Lactation Status", type: "select", options: ["milking", "dry", "never_milked"] },
  { value: "cowId", label: "Cow ID", type: "text" },
  { value: "naitTag", label: "NAIT Tag", type: "text" },
  { value: "sireId", label: "Has Sire", type: "exists" },
  { value: "damId", label: "Has Dam", type: "exists" },
];

// Preset templates for common groups
const GROUP_TEMPLATES = [
  {
    name: "Heifers (Under 24 Months)",
    description: "Female animals under 24 months old",
    criteria: {
      rules: [
        { field: "sex", operator: "equals", value: "female" },
        { field: "ageMonths", operator: "less_than", value: 24 },
      ],
      logic: "and" as const,
    },
  },
  {
    name: "Mature Cows",
    description: "Female animals 24 months or older",
    criteria: {
      rules: [
        { field: "sex", operator: "equals", value: "female" },
        { field: "ageMonths", operator: "greater_than", value: 23 },
      ],
      logic: "and" as const,
    },
  },
  {
    name: "Dry Cows",
    description: "Cows currently not milking",
    criteria: {
      rules: [
        { field: "sex", operator: "equals", value: "female" },
        { field: "lactationStatus", operator: "equals", value: "dry" },
      ],
      logic: "and" as const,
    },
  },
  {
    name: "Pregnant Animals",
    description: "Animals confirmed pregnant",
    criteria: {
      rules: [
        { field: "reproductionStatus", operator: "equals", value: "confirmed_pregnant" },
      ],
      logic: "and" as const,
    },
  },
  {
    name: "Bulls",
    description: "All male animals",
    criteria: {
      rules: [
        { field: "sex", operator: "equals", value: "male" },
      ],
      logic: "and" as const,
    },
  },
  {
    name: "Young Stock (Under 12 Months)",
    description: "Animals under 1 year old",
    criteria: {
      rules: [
        { field: "ageMonths", operator: "less_than", value: 12 },
      ],
      logic: "and" as const,
    },
  },
];

interface Rule {
  field: string;
  operator: string;
  value: any;
}

interface Criteria {
  rules: Rule[];
  logic: "and" | "or";
}

export default function SmartGroupsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State
  const [activeTab, setActiveTab] = useState("groups");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<AnimalGroup | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#4d9f5f",
    criteria: {
      rules: [{ field: "status", operator: "equals", value: "active" }],
      logic: "and" as "and" | "or",
    } as Criteria,
  });
  
  // Preview state
  const [previewResult, setPreviewResult] = useState<{ count: number; animals: Animal[] } | null>(null);

  // Fetch groups
  const { data: groups = [], isLoading: loadingGroups } = useQuery<AnimalGroup[]>({
    queryKey: ["/api/groups"],
    queryFn: async () => {
      const res = await fetch("/api/groups");
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
  });

  // Fetch animals for preview
  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
    queryFn: async () => {
      const res = await fetch("/api/animals");
      if (!res.ok) throw new Error("Failed to fetch animals");
      return res.json();
    },
  });

  // Filter dynamic groups
  const dynamicGroups = useMemo(() => 
    groups.filter(g => g.groupType === "dynamic"),
    [groups]
  );

  const staticGroups = useMemo(() => 
    groups.filter(g => g.groupType === "static"),
    [groups]
  );

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          groupType: "dynamic",
          createdBy: user?.id,
        }),
      });
      if (!res.ok) throw new Error("Failed to create group");
      return res.json();
    },
    onSuccess: async (group) => {
      toast.success("Smart group created");
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setShowCreateDialog(false);
      resetForm();
      // Auto-refresh the new group
      await refreshGroupMutation.mutateAsync(group.id);
    },
    onError: () => toast.error("Failed to create group"),
  });

  // Update group mutation
  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/groups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update group");
      return res.json();
    },
    onSuccess: async (group) => {
      toast.success("Group updated");
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setShowEditDialog(false);
      setSelectedGroup(null);
      // Auto-refresh after update
      await refreshGroupMutation.mutateAsync(group.id);
    },
    onError: () => toast.error("Failed to update group"),
  });

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete group");
    },
    onSuccess: () => {
      toast.success("Group deleted");
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
    },
    onError: () => toast.error("Failed to delete group"),
  });

  // Refresh single group mutation
  const refreshGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/groups/${id}/refresh`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to refresh group");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Refreshed: +${data.added} added, -${data.removed} removed`);
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
    },
    onError: () => toast.error("Failed to refresh group"),
  });

  // Refresh all groups mutation
  const refreshAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/groups/refresh-all-dynamic", { method: "POST" });
      if (!res.ok) throw new Error("Failed to refresh groups");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Refreshed ${data.groupsProcessed} groups`);
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
    },
    onError: () => toast.error("Failed to refresh groups"),
  });

  // Preview criteria mutation
  const previewMutation = useMutation({
    mutationFn: async (criteria: Criteria) => {
      const res = await fetch("/api/groups/preview-criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      });
      if (!res.ok) throw new Error("Failed to preview");
      return res.json();
    },
    onSuccess: (data) => {
      setPreviewResult(data);
      setShowPreviewDialog(true);
    },
    onError: () => toast.error("Failed to preview criteria"),
  });

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      color: "#4d9f5f",
      criteria: {
        rules: [{ field: "status", operator: "equals", value: "active" }],
        logic: "and",
      },
    });
  };

  // Add rule
  const addRule = () => {
    setFormData({
      ...formData,
      criteria: {
        ...formData.criteria,
        rules: [...formData.criteria.rules, { field: "status", operator: "equals", value: "active" }],
      },
    });
  };

  // Remove rule
  const removeRule = (index: number) => {
    if (formData.criteria.rules.length <= 1) return;
    setFormData({
      ...formData,
      criteria: {
        ...formData.criteria,
        rules: formData.criteria.rules.filter((_, i) => i !== index),
      },
    });
  };

  // Update rule
  const updateRule = (index: number, field: keyof Rule, value: any) => {
    const newRules = [...formData.criteria.rules];
    newRules[index] = { ...newRules[index], [field]: value };
    setFormData({
      ...formData,
      criteria: { ...formData.criteria, rules: newRules },
    });
  };

  // Apply template
  const applyTemplate = (template: typeof GROUP_TEMPLATES[0]) => {
    setFormData({
      name: template.name,
      description: template.description,
      color: "#4d9f5f",
      criteria: template.criteria,
    });
  };

  // Open edit dialog
  const openEditDialog = (group: AnimalGroup) => {
    setSelectedGroup(group);
    setFormData({
      name: group.name,
      description: group.description || "",
      color: group.color || "#4d9f5f",
      criteria: (group.criteria as Criteria) || { rules: [], logic: "and" },
    });
    setShowEditDialog(true);
  };

  // Get field config
  const getFieldConfig = (fieldValue: string) => {
    return RULE_FIELDS.find(f => f.value === fieldValue);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-purple-600" />
            Smart Groups
          </h1>
          <p className="text-muted-foreground mt-1">
            Create dynamic groups that automatically update based on rules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => refreshAllMutation.mutate()}
            disabled={refreshAllMutation.isPending}
          >
            {refreshAllMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh All
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Smart Group
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Smart Groups</p>
                <p className="text-2xl font-bold">{dynamicGroups.length}</p>
              </div>
              <Zap className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Static Groups</p>
                <p className="text-2xl font-bold">{staticGroups.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Groups</p>
                <p className="text-2xl font-bold">{groups.length}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Animals</p>
                <p className="text-2xl font-bold">{animals.filter(a => a.status === "active").length}</p>
              </div>
              <Sparkles className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="groups">Smart Groups</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="all">All Groups</TabsTrigger>
        </TabsList>

        {/* Smart Groups Tab */}
        <TabsContent value="groups" className="space-y-4">
          {dynamicGroups.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Zap className="h-12 w-12 mx-auto mb-4 text-purple-500 opacity-50" />
                <p className="text-lg font-medium">No smart groups yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first dynamic group to automatically organize animals
                </p>
                <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Smart Group
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dynamicGroups.map((group) => (
                <Card key={group.id} className="relative">
                  <div 
                    className="absolute top-0 left-0 w-1 h-full rounded-l-lg"
                    style={{ backgroundColor: group.color || "#4d9f5f" }}
                  />
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {group.description || "No description"}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                        <Zap className="h-3 w-3 mr-1" />
                        Dynamic
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {group.criteria && (
                      <div className="text-xs text-muted-foreground mb-3">
                        {(group.criteria as Criteria).rules.length} rule(s) •{" "}
                        {(group.criteria as Criteria).logic.toUpperCase()} logic
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => refreshGroupMutation.mutate(group.id)}
                        disabled={refreshGroupMutation.isPending}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Refresh
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(group)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteGroupMutation.mutate(group.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Start Templates</CardTitle>
              <CardDescription>
                Use these pre-configured templates to quickly create common groups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {GROUP_TEMPLATES.map((template, index) => (
                  <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="pt-4">
                      <h3 className="font-medium">{template.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </p>
                      <div className="text-xs text-muted-foreground mt-2">
                        {template.criteria.rules.length} rule(s)
                      </div>
                      <Button
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() => {
                          applyTemplate(template);
                          setShowCreateDialog(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Groups Tab */}
        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: group.color || "#4d9f5f" }}
                          />
                          <span className="font-medium">{group.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={group.groupType === "dynamic" ? "secondary" : "outline"}>
                          {group.groupType === "dynamic" ? (
                            <><Zap className="h-3 w-3 mr-1" />Dynamic</>
                          ) : (
                            "Static"
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {group.description || "—"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(group.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {group.groupType === "dynamic" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => refreshGroupMutation.mutate(group.id)}
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(group)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteGroupMutation.mutate(group.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Smart Group</DialogTitle>
            <DialogDescription>
              Define rules to automatically group animals
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Group Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Heifers"
                />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#4d9f5f"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
              />
            </div>

            {/* Rules */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Rules</Label>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Logic:</Label>
                  <Select
                    value={formData.criteria.logic}
                    onValueChange={(v: "and" | "or") => setFormData({
                      ...formData,
                      criteria: { ...formData.criteria, logic: v },
                    })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="and">AND</SelectItem>
                      <SelectItem value="or">OR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2 border rounded-md p-3">
                {formData.criteria.rules.map((rule, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={rule.field}
                      onValueChange={(v) => updateRule(index, "field", v)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RULE_FIELDS.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select
                      value={rule.operator}
                      onValueChange={(v) => updateRule(index, "operator", v)}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {!["is_null", "is_not_null"].includes(rule.operator) && (
                      <>
                        {getFieldConfig(rule.field)?.type === "select" ? (
                          <Select
                            value={rule.value}
                            onValueChange={(v) => updateRule(index, "value", v)}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select value" />
                            </SelectTrigger>
                            <SelectContent>
                              {getFieldConfig(rule.field)?.options?.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={getFieldConfig(rule.field)?.type === "number" ? "number" : "text"}
                            value={rule.value || ""}
                            onChange={(e) => updateRule(index, "value", 
                              getFieldConfig(rule.field)?.type === "number" 
                                ? parseInt(e.target.value) || 0 
                                : e.target.value
                            )}
                            placeholder="Value"
                            className="flex-1"
                          />
                        )}
                      </>
                    )}
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeRule(index)}
                      disabled={formData.criteria.rules.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addRule}
                  className="w-full mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => previewMutation.mutate(formData.criteria)}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              Preview
            </Button>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createGroupMutation.mutate(formData)}
              disabled={createGroupMutation.isPending || !formData.name}
            >
              {createGroupMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Group Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {selectedGroup?.groupType === "dynamic" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Rules</Label>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Logic:</Label>
                    <Select
                      value={formData.criteria.logic}
                      onValueChange={(v: "and" | "or") => setFormData({
                        ...formData,
                        criteria: { ...formData.criteria, logic: v },
                      })}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="and">AND</SelectItem>
                        <SelectItem value="or">OR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2 border rounded-md p-3">
                  {formData.criteria.rules.map((rule, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Select
                        value={rule.field}
                        onValueChange={(v) => updateRule(index, "field", v)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RULE_FIELDS.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select
                        value={rule.operator}
                        onValueChange={(v) => updateRule(index, "operator", v)}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPERATORS.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {!["is_null", "is_not_null"].includes(rule.operator) && (
                        <>
                          {getFieldConfig(rule.field)?.type === "select" ? (
                            <Select
                              value={rule.value}
                              onValueChange={(v) => updateRule(index, "value", v)}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select value" />
                              </SelectTrigger>
                              <SelectContent>
                                {getFieldConfig(rule.field)?.options?.map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              type={getFieldConfig(rule.field)?.type === "number" ? "number" : "text"}
                              value={rule.value || ""}
                              onChange={(e) => updateRule(index, "value", 
                                getFieldConfig(rule.field)?.type === "number" 
                                  ? parseInt(e.target.value) || 0 
                                  : e.target.value
                              )}
                              className="flex-1"
                            />
                          )}
                        </>
                      )}
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeRule(index)}
                        disabled={formData.criteria.rules.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addRule}
                    className="w-full mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rule
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            {selectedGroup?.groupType === "dynamic" && (
              <Button
                variant="outline"
                onClick={() => previewMutation.mutate(formData.criteria)}
                disabled={previewMutation.isPending}
              >
                {previewMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                Preview
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedGroup && updateGroupMutation.mutate({ 
                id: selectedGroup.id, 
                data: formData 
              })}
              disabled={updateGroupMutation.isPending || !formData.name}
            >
              {updateGroupMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Preview Results</DialogTitle>
            <DialogDescription>
              {previewResult?.count || 0} animals match your criteria
            </DialogDescription>
          </DialogHeader>
          {previewResult && (
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Sex</TableHead>
                    <TableHead>Breed</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewResult.animals.map((animal) => (
                    <TableRow key={animal.id}>
                      <TableCell className="font-medium">
                        {animal.cowId || animal.naitTag || animal.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>{animal.sex || "—"}</TableCell>
                      <TableCell>{animal.breed || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{animal.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {previewResult.count > 50 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Showing first 50 of {previewResult.count} animals
                </p>
              )}
            </ScrollArea>
          )}
          <DialogFooter>
            <Button onClick={() => setShowPreviewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
