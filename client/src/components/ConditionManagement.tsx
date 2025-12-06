import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Stethoscope, Trash2, Pencil, Check, X } from "lucide-react";
import type { Condition } from "@shared/schema";

interface ConditionManagementProps {
  conditions: Condition[];
  onAdd: (condition: { name: string; requiresBodyPart?: boolean; bodyPartType?: 'udder' | 'foot' }) => void;
  onUpdate: (id: string, condition: { name: string; requiresBodyPart?: boolean; bodyPartType?: 'udder' | 'foot' }) => void;
  onRemove: (id: string) => void;
}

export default function ConditionManagement({ conditions, onAdd, onUpdate, onRemove }: ConditionManagementProps) {
  const [newName, setNewName] = useState("");
  const [newRequiresBodyPart, setNewRequiresBodyPart] = useState(false);
  const [newBodyPartType, setNewBodyPartType] = useState<'udder' | 'foot'>('udder');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingRequiresBodyPart, setEditingRequiresBodyPart] = useState(false);
  const [editingBodyPartType, setEditingBodyPartType] = useState<'udder' | 'foot'>('udder');
  const [isConditionDialogOpen, setIsConditionDialogOpen] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onAdd({
      name: newName.trim(),
      requiresBodyPart: newRequiresBodyPart,
      bodyPartType: newRequiresBodyPart ? newBodyPartType : undefined,
    });
    setNewName("");
    setNewRequiresBodyPart(false);
    setNewBodyPartType('udder');
  };

  const startEdit = (condition: Condition) => {
    setEditingId(condition.id);
    setEditingName(condition.name);
    setEditingRequiresBodyPart(condition.requiresBodyPart || false);
    setEditingBodyPartType(condition.bodyPartType || 'udder');
  };

  const saveEdit = () => {
    if (!editingName.trim() || !editingId) return;
    onUpdate(editingId, {
      name: editingName.trim(),
      requiresBodyPart: editingRequiresBodyPart,
      bodyPartType: editingRequiresBodyPart ? editingBodyPartType : undefined,
    });
    setEditingId(null);
    setEditingName("");
    setEditingRequiresBodyPart(false);
    setEditingBodyPartType('udder');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingRequiresBodyPart(false);
    setEditingBodyPartType('udder');
  };

  return (
    <Card data-testid="card-condition-management">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5" />
          Condition Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => setIsConditionDialogOpen(true)} data-testid="button-open-condition-management">
          <Stethoscope className="w-4 h-4 mr-2" />
          View / Edit Conditions ({conditions.length})
        </Button>

        {/* Condition Management Dialog */}
        <Dialog open={isConditionDialogOpen} onOpenChange={setIsConditionDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Condition Management</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="condition-name">Add Condition / Diagnosis</Label>
                  <Input
                    id="condition-name"
                    placeholder="e.g., Pneumonia"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    data-testid="input-condition-name"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="requires-body-part"
                    checked={newRequiresBodyPart}
                    onCheckedChange={(checked) => setNewRequiresBodyPart(checked as boolean)}
                    data-testid="checkbox-requires-body-part"
                  />
                  <Label htmlFor="requires-body-part" className="cursor-pointer">
                    Requires body part selection
                  </Label>
                </div>

                {newRequiresBodyPart && (
                  <div className="space-y-2">
                    <Label>Body Part Type</Label>
                    <Select
                      value={newBodyPartType}
                      onValueChange={(value) => setNewBodyPartType(value as 'udder' | 'foot')}
                    >
                      <SelectTrigger data-testid="select-body-part-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="udder">Udder Quarter</SelectItem>
                        <SelectItem value="foot">Foot</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button type="submit" disabled={!newName.trim()} data-testid="button-add-condition">
                  <Stethoscope className="w-4 h-4 mr-2" />
                  Add Condition
                </Button>
              </form>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Conditions ({conditions.length})</h4>
                <div className="space-y-2">
                  {conditions.map((condition) => (
                    <Card key={condition.id} className="hover-elevate" data-testid={`card-condition-${condition.id}`}>
                      <CardContent className="p-3 space-y-2">
                        {editingId === condition.id ? (
                          <>
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              placeholder="Condition name"
                              autoFocus
                              data-testid={`input-edit-condition-${condition.id}`}
                            />
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`edit-requires-body-part-${condition.id}`}
                                checked={editingRequiresBodyPart}
                                onCheckedChange={(checked) => setEditingRequiresBodyPart(checked as boolean)}
                                data-testid={`checkbox-edit-requires-body-part-${condition.id}`}
                              />
                              <Label htmlFor={`edit-requires-body-part-${condition.id}`} className="cursor-pointer text-sm">
                                Requires body part
                              </Label>
                            </div>
                            {editingRequiresBodyPart && (
                              <Select
                                value={editingBodyPartType}
                                onValueChange={(value) => setEditingBodyPartType(value as 'udder' | 'foot')}
                              >
                                <SelectTrigger data-testid={`select-edit-body-part-type-${condition.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="udder">Udder Quarter</SelectItem>
                                  <SelectItem value="foot">Foot</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={saveEdit}
                                data-testid={`button-save-condition-${condition.id}`}
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                                data-testid={`button-cancel-condition-${condition.id}`}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-medium text-sm" data-testid={`text-condition-name-${condition.id}`}>
                                {condition.name}
                              </div>
                              {condition.requiresBodyPart && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Requires: {condition.bodyPartType === 'udder' ? 'Udder Quarter' : 'Foot'} selection
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEdit(condition)}
                                data-testid={`button-edit-condition-${condition.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onRemove(condition.id)}
                                data-testid={`button-delete-condition-${condition.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {conditions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No conditions added yet
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsConditionDialogOpen(false)} data-testid="button-done-condition">
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
