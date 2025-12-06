import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Users, Heart, Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertConditionSchema, insertUserSchema } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";

const conditionFormSchema = insertConditionSchema.extend({
  name: z.string().min(1, "Name is required"),
});

const userFormSchema = insertUserSchema.extend({
  name: z.string().min(1, "Name is required"),
});

export default function SettingsPage() {
  const [conditionDialog, setConditionDialog] = useState(false);
  const [editingCondition, setEditingCondition] = useState<any>(null);
  const [deleteConditionId, setDeleteConditionId] = useState<string | null>(null);
  
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const { toast } = useToast();

  const { data: conditions = [], isLoading: conditionsLoading } = useQuery<any[]>({
    queryKey: ["/api/conditions"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const conditionForm = useForm({
    resolver: zodResolver(conditionFormSchema),
    defaultValues: {
      name: "",
      requiresBodyPart: false,
      bodyPartType: undefined,
    },
  });

  const userForm = useForm({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      role: "worker",
      email: "",
    },
  });

  const createCondition = useMutation({
    mutationFn: (data: any) => apiRequest("/api/conditions", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conditions"] });
      setConditionDialog(false);
      conditionForm.reset();
      toast({ description: "Condition created successfully" });
    },
  });

  const updateCondition = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/conditions/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conditions"] });
      setConditionDialog(false);
      setEditingCondition(null);
      conditionForm.reset();
      toast({ description: "Condition updated successfully" });
    },
  });

  const deleteCondition = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/conditions/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conditions"] });
      setDeleteConditionId(null);
      toast({ description: "Condition deleted successfully" });
    },
  });

  const createUser = useMutation({
    mutationFn: (data: any) => apiRequest("/api/users", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setUserDialog(false);
      userForm.reset();
      toast({ description: "User created successfully" });
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/users/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setUserDialog(false);
      setEditingUser(null);
      userForm.reset();
      toast({ description: "User updated successfully" });
    },
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/users/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteUserId(null);
      toast({ description: "User deleted successfully" });
    },
  });

  const handleConditionSubmit = (data: any) => {
    if (editingCondition) {
      updateCondition.mutate({ id: editingCondition.id, data });
    } else {
      createCondition.mutate(data);
    }
  };

  const handleUserSubmit = (data: any) => {
    if (editingUser) {
      updateUser.mutate({ id: editingUser.id, data });
    } else {
      createUser.mutate(data);
    }
  };

  const openConditionDialog = (condition?: any) => {
    if (condition) {
      setEditingCondition(condition);
      conditionForm.reset({
        name: condition.name,
        requiresBodyPart: condition.requiresBodyPart || false,
        bodyPartType: condition.bodyPartType || undefined,
      });
    } else {
      setEditingCondition(null);
      conditionForm.reset({
        name: "",
        requiresBodyPart: false,
        bodyPartType: undefined,
      });
    }
    setConditionDialog(true);
  };

  const openUserDialog = (user?: any) => {
    if (user) {
      setEditingUser(user);
      userForm.reset({
        name: user.name,
        role: user.role || "worker",
        email: user.email || "",
      });
    } else {
      setEditingUser(null);
      userForm.reset({
        name: "",
        role: "worker",
        email: "",
      });
    }
    setUserDialog(true);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-settings-title">
          Settings
        </h1>
        <p className="text-muted-foreground">Configure your farm management system</p>
      </div>

      <Tabs defaultValue="conditions" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="conditions" data-testid="tab-conditions">
            <Heart className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Conditions
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Users
          </TabsTrigger>
          <TabsTrigger value="farm" data-testid="tab-farm">
            <Building2 className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Farm Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conditions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Health Conditions</CardTitle>
                <Button onClick={() => openConditionDialog()} data-testid="button-add-condition">
                  <Plus className="h-4 w-4 mr-2" strokeWidth={1.5} />
                  Add Condition
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {conditionsLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading...</p>
              ) : conditions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8" data-testid="text-no-conditions">
                  No conditions configured. Add your first condition to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {conditions.map((condition) => (
                    <div
                      key={condition.id}
                      className="flex items-center justify-between p-4 border rounded-md"
                      data-testid={`condition-${condition.id}`}
                    >
                      <div>
                        <p className="font-medium">{condition.name}</p>
                        {condition.requiresBodyPart && (
                          <p className="text-sm text-muted-foreground">
                            Body part: {condition.bodyPartType || "Any"}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openConditionDialog(condition)}
                          data-testid={`button-edit-condition-${condition.id}`}
                        >
                          <Edit className="h-4 w-4" strokeWidth={1.5} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConditionId(condition.id)}
                          data-testid={`button-delete-condition-${condition.id}`}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Staff Members</CardTitle>
                <Button onClick={() => openUserDialog()} data-testid="button-add-user">
                  <Plus className="h-4 w-4 mr-2" strokeWidth={1.5} />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading...</p>
              ) : users.length === 0 ? (
                <p className="text-muted-foreground text-center py-8" data-testid="text-no-users">
                  No users configured. Add your first user to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-md"
                      data-testid={`user-${user.id}`}
                    >
                      <div>
                        <p className="font-medium">{user.name}</p>
                        {user.role && (
                          <p className="text-sm text-muted-foreground">Role: {user.role}</p>
                        )}
                        {user.email && (
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openUserDialog(user)}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Edit className="h-4 w-4" strokeWidth={1.5} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteUserId(user.id)}
                          data-testid={`button-delete-user-${user.id}`}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="farm">
          <Card>
            <CardHeader>
              <CardTitle>Farm Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="farm-name">Farm Name</Label>
                  <Input
                    id="farm-name"
                    placeholder="Enter farm name"
                    defaultValue="My Dairy Farm"
                    data-testid="input-farm-name"
                  />
                </div>
                <div>
                  <Label htmlFor="farm-location">Location</Label>
                  <Input
                    id="farm-location"
                    placeholder="Enter farm location"
                    data-testid="input-farm-location"
                  />
                </div>
                <div>
                  <Label htmlFor="farm-contact">Contact Email</Label>
                  <Input
                    id="farm-contact"
                    type="email"
                    placeholder="contact@farm.com"
                    data-testid="input-farm-contact"
                  />
                </div>
                <Button data-testid="button-save-farm-profile">Save Profile</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={conditionDialog} onOpenChange={setConditionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCondition ? "Edit Condition" : "Add Condition"}
            </DialogTitle>
          </DialogHeader>
          <Form {...conditionForm}>
            <form onSubmit={conditionForm.handleSubmit(handleConditionSubmit)} className="space-y-4">
              <FormField
                control={conditionForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Mastitis" data-testid="input-condition-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={conditionForm.control}
                name="requiresBodyPart"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-requires-body-part"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Requires Body Part</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {conditionForm.watch("requiresBodyPart") && (
                <FormField
                  control={conditionForm.control}
                  name="bodyPartType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Body Part Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-body-part-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="udder">Udder</SelectItem>
                          <SelectItem value="foot">Foot</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConditionDialog(false)}
                  data-testid="button-cancel-condition"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createCondition.isPending || updateCondition.isPending}
                  data-testid="button-save-condition"
                >
                  {editingCondition ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={userDialog} onOpenChange={setUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Add User"}
            </DialogTitle>
          </DialogHeader>
          <Form {...userForm}>
            <form onSubmit={userForm.handleSubmit(handleUserSubmit)} className="space-y-4">
              <FormField
                control={userForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="John Doe" data-testid="input-user-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={userForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "worker"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-user-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="worker">Worker</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={userForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="john@example.com"
                        data-testid="input-user-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setUserDialog(false)}
                  data-testid="button-cancel-user"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createUser.isPending || updateUser.isPending}
                  data-testid="button-save-user"
                >
                  {editingUser ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConditionId !== null} onOpenChange={() => setDeleteConditionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Condition?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the condition.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-condition">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConditionId && deleteCondition.mutate(deleteConditionId)}
              data-testid="button-confirm-delete-condition"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteUserId !== null} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-user">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteUser.mutate(deleteUserId)}
              data-testid="button-confirm-delete-user"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
