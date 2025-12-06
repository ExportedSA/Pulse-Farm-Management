import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { User, Trash2, Pencil, Check, X } from "lucide-react";
import type { User as UserType } from "@shared/schema";

interface UserManagementProps {
  users: UserType[];
  onAdd: (name: string) => void;
  onUpdate: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

export default function UserManagement({ users, onAdd, onUpdate, onRemove }: UserManagementProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onAdd(newName.trim());
    setNewName("");
  };

  const startEdit = (user: UserType) => {
    setEditingId(user.id);
    setEditingName(user.name);
  };

  const saveEdit = () => {
    if (!editingName.trim() || !editingId) return;
    onUpdate(editingId, editingName.trim());
    setEditingId(null);
    setEditingName("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  return (
    <Card data-testid="card-user-management">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Staff Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => setIsStaffDialogOpen(true)} data-testid="button-open-staff-management">
          <User className="w-4 h-4 mr-2" />
          View / Edit Staff ({users.length})
        </Button>

        {/* Staff Management Dialog */}
        <Dialog open={isStaffDialogOpen} onOpenChange={setIsStaffDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Staff Management</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="staff-name">Add Staff Member</Label>
                    <Input
                      id="staff-name"
                      placeholder="e.g., John Smith"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      data-testid="input-staff-name"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" disabled={!newName.trim()} data-testid="button-add-staff">
                      <User className="w-4 h-4 mr-2" />
                      Add
                    </Button>
                  </div>
                </div>
              </form>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Staff Members ({users.length})</h4>
                <div className="space-y-2">
                  {users.map((user) => (
                    <Card key={user.id} className="hover-elevate" data-testid={`card-user-${user.id}`}>
                      <CardContent className="p-3 flex items-center justify-between gap-2">
                        {editingId === user.id ? (
                          <>
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="flex-1"
                              autoFocus
                              data-testid={`input-edit-user-${user.id}`}
                            />
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={saveEdit}
                                data-testid={`button-save-user-${user.id}`}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                                data-testid={`button-cancel-user-${user.id}`}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 font-medium text-sm" data-testid={`text-user-name-${user.id}`}>
                              {user.name}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEdit(user)}
                                data-testid={`button-edit-user-${user.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onRemove(user.id)}
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {users.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No staff members added yet
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsStaffDialogOpen(false)} data-testid="button-done-staff">
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
