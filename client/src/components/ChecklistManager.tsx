import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  GripVertical,
  MoreVertical,
  Clock,
  User,
  AlertCircle,
  Camera,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Star,
  Edit2,
  ListChecks,
  CheckCheck,
  XCircle,
  Timer,
  ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChecklistItem {
  id: string;
  text: string;
  required: boolean;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  completedByName?: string;
  notes?: string;
  photoUrl?: string;
  order: number;
}

interface ChecklistManagerProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  onComplete?: (item: ChecklistItem) => void;
  readOnly?: boolean;
  showProgress?: boolean;
  showCompletionDetails?: boolean;
  allowReorder?: boolean;
  allowAddItems?: boolean;
  requirePhotoOnComplete?: boolean;
  requireNotesOnComplete?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  title?: string;
  compact?: boolean;
}

export function ChecklistManager({
  items,
  onChange,
  onComplete,
  readOnly = false,
  showProgress = true,
  showCompletionDetails = true,
  allowReorder = true,
  allowAddItems = true,
  requirePhotoOnComplete = false,
  requireNotesOnComplete = false,
  currentUserId = 'user-1',
  currentUserName = 'Current User',
  title = 'Checklist',
  compact = false,
}: ChecklistManagerProps) {
  const [newItemText, setNewItemText] = useState('');
  const [newItemRequired, setNewItemRequired] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [completionDialog, setCompletionDialog] = useState<{
    item: ChecklistItem;
    notes: string;
    photoUrl: string;
  } | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  // Calculate progress
  const totalItems = items.length;
  const completedItems = items.filter(i => i.completed).length;
  const requiredItems = items.filter(i => i.required);
  const completedRequiredItems = requiredItems.filter(i => i.completed).length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const allRequiredComplete = requiredItems.every(i => i.completed);

  // Add new item
  const addItem = () => {
    if (!newItemText.trim()) return;
    
    const newItem: ChecklistItem = {
      id: `item-${Date.now()}`,
      text: newItemText.trim(),
      required: newItemRequired,
      completed: false,
      order: items.length,
    };
    
    onChange([...items, newItem]);
    setNewItemText('');
    setNewItemRequired(false);
  };

  // Toggle item completion
  const toggleItem = (item: ChecklistItem) => {
    if (readOnly) return;
    
    // If completing and requires notes/photo, show dialog
    if (!item.completed && (requirePhotoOnComplete || requireNotesOnComplete)) {
      setCompletionDialog({ item, notes: '', photoUrl: '' });
      return;
    }
    
    const updatedItems = items.map(i => {
      if (i.id === item.id) {
        const isCompleting = !i.completed;
        return {
          ...i,
          completed: isCompleting,
          completedAt: isCompleting ? new Date().toISOString() : undefined,
          completedBy: isCompleting ? currentUserId : undefined,
          completedByName: isCompleting ? currentUserName : undefined,
        };
      }
      return i;
    });
    
    onChange(updatedItems);
    
    if (!item.completed && onComplete) {
      onComplete({ ...item, completed: true });
    }
  };

  // Complete with notes/photo
  const completeWithDetails = () => {
    if (!completionDialog) return;
    
    const updatedItems = items.map(i => {
      if (i.id === completionDialog.item.id) {
        return {
          ...i,
          completed: true,
          completedAt: new Date().toISOString(),
          completedBy: currentUserId,
          completedByName: currentUserName,
          notes: completionDialog.notes || undefined,
          photoUrl: completionDialog.photoUrl || undefined,
        };
      }
      return i;
    });
    
    onChange(updatedItems);
    
    if (onComplete) {
      onComplete({ ...completionDialog.item, completed: true });
    }
    
    setCompletionDialog(null);
  };

  // Delete item
  const deleteItem = (id: string) => {
    onChange(items.filter(i => i.id !== id));
  };

  // Update item
  const updateItem = (id: string, updates: Partial<ChecklistItem>) => {
    onChange(items.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  // Toggle expanded
  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!allowReorder || readOnly) return;
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    if (!allowReorder || readOnly || !draggedItem || draggedItem === targetId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    if (!allowReorder || readOnly || !draggedItem || draggedItem === targetId) return;
    e.preventDefault();
    
    const draggedIndex = items.findIndex(i => i.id === draggedItem);
    const targetIndex = items.findIndex(i => i.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const newItems = [...items];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, removed);
    
    // Update order
    const reorderedItems = newItems.map((item, index) => ({
      ...item,
      order: index,
    }));
    
    onChange(reorderedItems);
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Sort items by order
  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {/* Header with Progress */}
      {showProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{title}</span>
              <Badge variant="secondary" className="text-xs">
                {completedItems}/{totalItems}
              </Badge>
            </div>
            {!allRequiredComplete && requiredItems.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                {requiredItems.length - completedRequiredItems} required
              </Badge>
            )}
            {allRequiredComplete && requiredItems.length > 0 && (
              <Badge className="bg-green-100 text-green-800 text-xs">
                <CheckCheck className="h-3 w-3 mr-1" />
                All required done
              </Badge>
            )}
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}

      {/* Checklist Items */}
      <div className="space-y-1">
        {sortedItems.map((item) => {
          const isExpanded = expandedItems.has(item.id);
          const hasDetails = item.notes || item.photoUrl || (showCompletionDetails && item.completedAt);
          
          return (
            <div
              key={item.id}
              draggable={allowReorder && !readOnly}
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragOver={(e) => handleDragOver(e, item.id)}
              onDrop={(e) => handleDrop(e, item.id)}
              onDragEnd={handleDragEnd}
              className={cn(
                "group rounded-lg border transition-all",
                item.completed ? "bg-muted/50 border-muted" : "bg-background",
                draggedItem === item.id && "opacity-50",
                !readOnly && "hover:shadow-sm"
              )}
            >
              <div className={cn("flex items-start gap-2 p-3", compact && "p-2")}>
                {/* Drag Handle */}
                {allowReorder && !readOnly && (
                  <div className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                
                {/* Checkbox */}
                <div className="pt-0.5">
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={() => toggleItem(item)}
                    disabled={readOnly}
                    className={cn(
                      "h-5 w-5",
                      item.completed && "bg-green-500 border-green-500"
                    )}
                  />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className={cn(
                        "text-sm",
                        item.completed && "line-through text-muted-foreground"
                      )}>
                        {item.text}
                      </span>
                      {item.required && !item.completed && (
                        <Badge variant="outline" className="ml-2 text-xs text-red-600 border-red-200">
                          Required
                        </Badge>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {hasDetails && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => toggleExpanded(item.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      
                      {!readOnly && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingItem(item)}>
                              <Edit2 className="h-3 w-3 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateItem(item.id, { required: !item.required })}
                            >
                              <Star className="h-3 w-3 mr-2" />
                              {item.required ? 'Make Optional' : 'Make Required'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteItem(item.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-3 w-3 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                  
                  {/* Completion info (inline) */}
                  {item.completed && showCompletionDetails && !isExpanded && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {item.completedByName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.completedByName}
                        </span>
                      )}
                      {item.completedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(item.completedAt)}
                        </span>
                      )}
                      {item.notes && (
                        <MessageSquare className="h-3 w-3" />
                      )}
                      {item.photoUrl && (
                        <ImageIcon className="h-3 w-3" />
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Expanded Details */}
              {isExpanded && hasDetails && (
                <div className="px-3 pb-3 pt-0 ml-9 space-y-2 border-t mt-2 pt-2">
                  {item.completedAt && showCompletionDetails && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Completed
                      </span>
                      {item.completedByName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.completedByName}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(item.completedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  
                  {item.notes && (
                    <div className="bg-muted/50 rounded p-2">
                      <p className="text-xs text-muted-foreground mb-1">Notes:</p>
                      <p className="text-sm">{item.notes}</p>
                    </div>
                  )}
                  
                  {item.photoUrl && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Photo:</p>
                      <img
                        src={item.photoUrl}
                        alt="Completion photo"
                        className="rounded-lg max-h-32 object-cover"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add New Item */}
      {allowAddItems && !readOnly && (
        <div className="flex items-center gap-2 pt-2">
          <Input
            placeholder="Add checklist item..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            className="flex-1"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={newItemRequired ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNewItemRequired(!newItemRequired)}
                  className="px-2"
                >
                  <Star className={cn("h-4 w-4", newItemRequired && "fill-current")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {newItemRequired ? 'Required item' : 'Optional item'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button onClick={addItem} size="sm" disabled={!newItemText.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Empty State */}
      {items.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No checklist items</p>
          {allowAddItems && !readOnly && (
            <p className="text-xs">Add items above to create a checklist</p>
          )}
        </div>
      )}

      {/* Edit Item Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Checklist Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Item Text</label>
                <Input
                  value={editingItem.text}
                  onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editingItem.required}
                  onCheckedChange={(checked) => 
                    setEditingItem({ ...editingItem, required: !!checked })
                  }
                />
                <label className="text-sm">Required item</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button onClick={() => {
              if (editingItem) {
                updateItem(editingItem.id, {
                  text: editingItem.text,
                  required: editingItem.required,
                });
                setEditingItem(null);
              }
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion Dialog (for notes/photo) */}
      <Dialog open={!!completionDialog} onOpenChange={() => setCompletionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Item</DialogTitle>
            <DialogDescription>
              {completionDialog?.item.text}
            </DialogDescription>
          </DialogHeader>
          {completionDialog && (
            <div className="space-y-4 py-4">
              {requireNotesOnComplete && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Notes {requireNotesOnComplete && <span className="text-red-500">*</span>}
                  </label>
                  <Textarea
                    placeholder="Add notes about this task..."
                    value={completionDialog.notes}
                    onChange={(e) => setCompletionDialog({
                      ...completionDialog,
                      notes: e.target.value,
                    })}
                    rows={3}
                  />
                </div>
              )}
              
              {requirePhotoOnComplete && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Photo {requirePhotoOnComplete && <span className="text-red-500">*</span>}
                  </label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload or take a photo
                    </p>
                    <Input
                      type="file"
                      accept="image/*"
                      className="mt-2"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // In real app, upload file and get URL
                          setCompletionDialog({
                            ...completionDialog,
                            photoUrl: URL.createObjectURL(file),
                          });
                        }
                      }}
                    />
                  </div>
                  {completionDialog.photoUrl && (
                    <img
                      src={completionDialog.photoUrl}
                      alt="Preview"
                      className="rounded-lg max-h-32 object-cover"
                    />
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletionDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={completeWithDetails}
              disabled={
                (requireNotesOnComplete && !completionDialog?.notes) ||
                (requirePhotoOnComplete && !completionDialog?.photoUrl)
              }
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Compact checklist for inline use
export function CompactChecklist({
  items,
  onChange,
  readOnly = false,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  readOnly?: boolean;
}) {
  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <ListChecks className="h-3 w-3" />
        <span>{completedCount}/{totalCount} completed</span>
      </div>
      {items.slice(0, 5).map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <Checkbox
            checked={item.completed}
            onCheckedChange={() => {
              if (readOnly) return;
              onChange(items.map(i => 
                i.id === item.id 
                  ? { ...i, completed: !i.completed, completedAt: !i.completed ? new Date().toISOString() : undefined }
                  : i
              ));
            }}
            disabled={readOnly}
            className="h-4 w-4"
          />
          <span className={cn(
            "text-xs",
            item.completed && "line-through text-muted-foreground"
          )}>
            {item.text}
          </span>
          {item.required && !item.completed && (
            <span className="text-red-500 text-xs">*</span>
          )}
        </div>
      ))}
      {items.length > 5 && (
        <p className="text-xs text-muted-foreground">
          +{items.length - 5} more items
        </p>
      )}
    </div>
  );
}

// Checklist Summary Card
export function ChecklistSummary({
  items,
  title = 'Checklist Progress',
}: {
  items: ChecklistItem[];
  title?: string;
}) {
  const totalItems = items.length;
  const completedItems = items.filter(i => i.completed).length;
  const requiredItems = items.filter(i => i.required);
  const completedRequiredItems = requiredItems.filter(i => i.completed).length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Overall Progress</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{completedItems}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">{totalItems - completedItems}</p>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
          </div>
          
          {requiredItems.length > 0 && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-500" />
                  Required Items
                </span>
                <span className={cn(
                  "font-medium",
                  completedRequiredItems === requiredItems.length ? "text-green-600" : "text-orange-600"
                )}>
                  {completedRequiredItems}/{requiredItems.length}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ChecklistManager;
