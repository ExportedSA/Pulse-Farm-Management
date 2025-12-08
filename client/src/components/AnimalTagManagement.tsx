import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Tag, Edit2, History, AlertTriangle, CheckCircle, Plus } from 'lucide-react';
import type { Animal, AnimalTagHistory } from '@shared/schema';

interface AnimalTagManagementProps {
  animal: Animal;
  onUpdate?: () => void;
}

type TagType = 'visual_id' | 'lifetime_id' | 'nait_tag' | 'eid';
type ChangeReason = 'lost' | 'damaged' | 'illegible' | 'replacement' | 'correction' | 'initial' | 'other';

const TAG_LABELS: Record<TagType, { label: string; description: string; color: string }> = {
  visual_id: { 
    label: 'VID (Visual ID)', 
    description: 'Farm management tag - your own numbering system',
    color: 'bg-blue-500'
  },
  lifetime_id: { 
    label: 'LID (Lifetime ID)', 
    description: 'NAIT birth tag - stays with animal for life',
    color: 'bg-green-500'
  },
  nait_tag: { 
    label: 'NAIT Tag (EID)', 
    description: 'Electronic RFID tag for NAIT compliance',
    color: 'bg-purple-500'
  },
  eid: { 
    label: 'EID (Electronic ID)', 
    description: 'Additional electronic identification',
    color: 'bg-orange-500'
  },
};

const CHANGE_REASONS: Record<ChangeReason, string> = {
  lost: 'Tag Lost',
  damaged: 'Tag Damaged',
  illegible: 'Tag Illegible/Faded',
  replacement: 'Scheduled Replacement',
  correction: 'Data Correction',
  initial: 'Initial Tag Assignment',
  other: 'Other',
};

export default function AnimalTagManagement({ animal, onUpdate }: AnimalTagManagementProps) {
  const queryClient = useQueryClient();
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedTagType, setSelectedTagType] = useState<TagType | null>(null);
  const [newTagValue, setNewTagValue] = useState('');
  const [changeReason, setChangeReason] = useState<ChangeReason>('lost');
  const [changeNotes, setChangeNotes] = useState('');

  // Fetch tag history
  const { data: tagHistory = [], isLoading: loadingHistory } = useQuery<AnimalTagHistory[]>({
    queryKey: [`/api/animals/${animal.id}/tag-history`],
    enabled: showHistoryDialog,
  });

  // Update tag mutation
  const updateTagMutation = useMutation({
    mutationFn: async (data: { 
      tagType: TagType; 
      newValue: string; 
      changeReason: ChangeReason; 
      notes?: string 
    }) => {
      const res = await fetch(`/api/animals/${animal.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          changeDate: new Date().toISOString().split('T')[0],
        }),
      });
      if (!res.ok) throw new Error('Failed to update tag');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Tag updated successfully');
      queryClient.invalidateQueries({ queryKey: ['/api/animals'] });
      queryClient.invalidateQueries({ queryKey: [`/api/animals/${animal.id}`] });
      setShowChangeDialog(false);
      resetForm();
      onUpdate?.();
    },
    onError: () => {
      toast.error('Failed to update tag');
    },
  });

  const resetForm = () => {
    setSelectedTagType(null);
    setNewTagValue('');
    setChangeReason('lost');
    setChangeNotes('');
  };

  const openChangeDialog = (tagType: TagType) => {
    setSelectedTagType(tagType);
    setShowChangeDialog(true);
  };

  const handleSubmit = () => {
    if (!selectedTagType || !newTagValue.trim()) {
      toast.error('Please enter a new tag value');
      return;
    }
    updateTagMutation.mutate({
      tagType: selectedTagType,
      newValue: newTagValue.trim(),
      changeReason,
      notes: changeNotes.trim() || undefined,
    });
  };

  const getCurrentTagValue = (tagType: TagType): string | null => {
    switch (tagType) {
      case 'visual_id': return animal.visualId || animal.cowId || null;
      case 'lifetime_id': return animal.lifetimeId || null;
      case 'nait_tag': return animal.naitTag || null;
      case 'eid': return animal.eid || null;
      default: return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle>Tag Identification</CardTitle>
              <CardDescription>Manage VID, LID, and NAIT tags</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowHistoryDialog(true)}>
            <History className="h-4 w-4 mr-2" />
            View History
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.keys(TAG_LABELS) as TagType[]).map((tagType) => {
            const config = TAG_LABELS[tagType];
            const currentValue = getCurrentTagValue(tagType);
            
            return (
              <div 
                key={tagType}
                className="p-4 border rounded-lg hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className={config.color}>{config.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => openChangeDialog(tagType)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3">
                  {currentValue ? (
                    <p className="text-lg font-mono font-semibold">{currentValue}</p>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="text-sm">Not assigned</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="p-0 h-auto text-blue-600"
                        onClick={() => {
                          setSelectedTagType(tagType);
                          setChangeReason('initial');
                          setShowChangeDialog(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* NAIT Compliance Note */}
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">NAIT Compliance</p>
              <p className="text-amber-700">
                Changes to NAIT tags (LID and EID) must be reported to NAIT within 48 hours. 
                Tag changes are automatically queued for NAIT reporting.
              </p>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Change Tag Dialog */}
      <Dialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedTagType && getCurrentTagValue(selectedTagType) 
                ? `Change ${TAG_LABELS[selectedTagType].label}` 
                : `Assign ${selectedTagType ? TAG_LABELS[selectedTagType].label : 'Tag'}`}
            </DialogTitle>
            <DialogDescription>
              {selectedTagType && TAG_LABELS[selectedTagType].description}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedTagType && getCurrentTagValue(selectedTagType) && (
              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-xs text-muted-foreground">Current Tag</Label>
                <p className="font-mono font-semibold">{getCurrentTagValue(selectedTagType)}</p>
              </div>
            )}

            <div>
              <Label htmlFor="newTag">New Tag Number</Label>
              <Input
                id="newTag"
                value={newTagValue}
                onChange={(e) => setNewTagValue(e.target.value.toUpperCase())}
                placeholder={selectedTagType === 'nait_tag' ? 'e.g., 982 000123456789' : 'Enter tag number'}
                className="font-mono"
              />
              {selectedTagType === 'nait_tag' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Format: 15-digit RFID number (e.g., 982 000123456789)
                </p>
              )}
              {selectedTagType === 'lifetime_id' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Format: Birth tag number from NAIT (e.g., 123-2024-0001)
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="reason">Reason for Change</Label>
              <Select value={changeReason} onValueChange={(v) => setChangeReason(v as ChangeReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CHANGE_REASONS) as ChangeReason[]).map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {CHANGE_REASONS[reason]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                placeholder="Add any additional notes about this tag change..."
                rows={2}
              />
            </div>

            {(selectedTagType === 'nait_tag' || selectedTagType === 'lifetime_id') && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    This change will be automatically reported to NAIT
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowChangeDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={updateTagMutation.isPending}>
              {updateTagMutation.isPending ? 'Saving...' : 'Save Tag Change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tag Change History</DialogTitle>
            <DialogDescription>
              Complete history of all tag changes for this animal
            </DialogDescription>
          </DialogHeader>
          
          {loadingHistory ? (
            <div className="py-8 text-center text-muted-foreground">Loading history...</div>
          ) : tagHistory.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No tag changes recorded</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Tag Type</TableHead>
                  <TableHead>Old Value</TableHead>
                  <TableHead>New Value</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>NAIT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tagHistory.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{new Date(record.changeDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {TAG_LABELS[record.tagType as TagType]?.label || record.tagType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {record.oldValue || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {record.newValue}
                    </TableCell>
                    <TableCell className="text-sm">
                      {CHANGE_REASONS[record.changeReason as ChangeReason] || record.changeReason}
                    </TableCell>
                    <TableCell>
                      {(record.tagType === 'nait_tag' || record.tagType === 'lifetime_id') && (
                        record.naitReported ? (
                          <Badge className="bg-green-500">Reported</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">Pending</Badge>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
