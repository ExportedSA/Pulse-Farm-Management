import { useState, useEffect } from "react";
import { Filter, X, Save, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type AnimalGroup = {
  id: string;
  name: string;
  color: string | null;
};

export type AnimalFilters = {
  breeds: string[];
  sexes: string[];
  statuses: string[];
  ageRanges: string[];
  groupIds: string[];
  pastureIds: string[];
};

type FilterPreset = {
  id: string;
  name: string;
  filters: AnimalFilters;
};

type AnimalFiltersProps = {
  filters: AnimalFilters;
  onChange: (filters: AnimalFilters) => void;
  availableBreeds: string[];
  availableGroups: AnimalGroup[];
  availablePastures: { id: string; name: string }[];
};

const STORAGE_KEY = 'pulse_animal_filter_presets';

const SEX_OPTIONS = [
  { value: 'bull', label: 'Bull' },
  { value: 'cow', label: 'Cow' },
  { value: 'heifer', label: 'Heifer' },
  { value: 'steer', label: 'Steer' },
  { value: 'calf', label: 'Calf' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'sold', label: 'Sold' },
  { value: 'deceased', label: 'Deceased' },
];

const AGE_RANGES = [
  { value: '0-6mo', label: '0-6 months' },
  { value: '6-12mo', label: '6-12 months' },
  { value: '1-2yr', label: '1-2 years' },
  { value: '2-5yr', label: '2-5 years' },
  { value: '5yr+', label: '5+ years' },
];

export function AnimalFiltersComponent({ filters, onChange, availableBreeds, availableGroups, availablePastures }: AnimalFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Load presets from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPresets(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load filter presets:', e);
      }
    }
  }, []);

  const savePresets = (newPresets: FilterPreset[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPresets));
    setPresets(newPresets);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }

    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      filters: { ...filters },
    };

    savePresets([...presets, newPreset]);
    toast.success(`Filter preset "${presetName}" saved`);
    setPresetName('');
    setIsSaveDialogOpen(false);
  };

  const handleLoadPreset = (preset: FilterPreset) => {
    onChange(preset.filters);
    setIsLoadDialogOpen(false);
    toast.success(`Loaded filter preset "${preset.name}"`);
  };

  const handleDeletePreset = (id: string) => {
    const preset = presets.find(p => p.id === id);
    savePresets(presets.filter(p => p.id !== id));
    toast.success(`Deleted preset "${preset?.name}"`);
  };

  const toggleArrayFilter = (key: keyof AnimalFilters, value: string) => {
    const current = filters[key] as string[];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: updated });
  };

  const clearAllFilters = () => {
    onChange({
      breeds: [],
      sexes: [],
      statuses: [],
      ageRanges: [],
      groupIds: [],
      pastureIds: [],
    });
  };

  const activeFilterCount = Object.values(filters).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="button-open-filters" className="gap-2">
            <Filter className="h-4 w-4" />
            Advanced Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 max-h-[600px] overflow-y-auto" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Filter Animals</h4>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLoadDialogOpen(true)}
                  disabled={presets.length === 0}
                  data-testid="button-load-preset"
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSaveDialogOpen(true)}
                  disabled={activeFilterCount === 0}
                  data-testid="button-save-preset"
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  disabled={activeFilterCount === 0}
                  data-testid="button-clear-filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Breed Filter */}
            {availableBreeds.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Breed</Label>
                <div className="flex flex-wrap gap-2">
                  {availableBreeds.map((breed) => (
                    <Badge
                      key={breed}
                      variant={filters.breeds.includes(breed) ? "default" : "outline"}
                      className="cursor-pointer hover-elevate"
                      onClick={() => toggleArrayFilter('breeds', breed)}
                      data-testid={`filter-breed-${breed}`}
                    >
                      {breed}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Sex Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Sex</Label>
              <div className="flex flex-wrap gap-2">
                {SEX_OPTIONS.map((option) => (
                  <Badge
                    key={option.value}
                    variant={filters.sexes.includes(option.value) ? "default" : "outline"}
                    className="cursor-pointer hover-elevate"
                    onClick={() => toggleArrayFilter('sexes', option.value)}
                    data-testid={`filter-sex-${option.value}`}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => (
                  <Badge
                    key={option.value}
                    variant={filters.statuses.includes(option.value) ? "default" : "outline"}
                    className="cursor-pointer hover-elevate"
                    onClick={() => toggleArrayFilter('statuses', option.value)}
                    data-testid={`filter-status-${option.value}`}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Age Range Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Age Range</Label>
              <div className="flex flex-wrap gap-2">
                {AGE_RANGES.map((range) => (
                  <Badge
                    key={range.value}
                    variant={filters.ageRanges.includes(range.value) ? "default" : "outline"}
                    className="cursor-pointer hover-elevate"
                    onClick={() => toggleArrayFilter('ageRanges', range.value)}
                    data-testid={`filter-age-${range.value}`}
                  >
                    {range.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Group Filter */}
            {availableGroups.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Groups</Label>
                <div className="flex flex-wrap gap-2">
                  {availableGroups.map((group) => (
                    <Badge
                      key={group.id}
                      variant={filters.groupIds.includes(group.id) ? "default" : "outline"}
                      className="cursor-pointer hover-elevate gap-1"
                      onClick={() => toggleArrayFilter('groupIds', group.id)}
                      style={
                        filters.groupIds.includes(group.id) && group.color
                          ? { backgroundColor: group.color, color: '#ffffff' }
                          : {}
                      }
                      data-testid={`filter-group-${group.id}`}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: group.color || '#1e3932' }}
                      />
                      {group.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Pasture Filter */}
            {availablePastures.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Pasture</Label>
                <div className="flex flex-wrap gap-2">
                  {availablePastures.map((pasture) => (
                    <Badge
                      key={pasture.id}
                      variant={filters.pastureIds.includes(pasture.id) ? "default" : "outline"}
                      className="cursor-pointer hover-elevate"
                      onClick={() => toggleArrayFilter('pastureIds', pasture.id)}
                      data-testid={`filter-pasture-${pasture.id}`}
                    >
                      {pasture.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Save Preset Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter Preset</DialogTitle>
            <DialogDescription>
              Give this filter combination a name to save it for later use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="preset-name">Preset Name</Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g., Breeding Heifers"
                data-testid="input-preset-name"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <strong>Active Filters:</strong>
              <ul className="mt-1 space-y-1">
                {filters.breeds.length > 0 && <li>• Breeds: {filters.breeds.join(', ')}</li>}
                {filters.sexes.length > 0 && <li>• Sexes: {filters.sexes.join(', ')}</li>}
                {filters.statuses.length > 0 && <li>• Statuses: {filters.statuses.join(', ')}</li>}
                {filters.ageRanges.length > 0 && <li>• Ages: {filters.ageRanges.join(', ')}</li>}
                {filters.groupIds.length > 0 && <li>• {filters.groupIds.length} group(s)</li>}
                {filters.pastureIds.length > 0 && <li>• {filters.pastureIds.length} pasture(s)</li>}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreset} data-testid="button-confirm-save-preset">
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Preset Dialog */}
      <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Load Filter Preset</DialogTitle>
            <DialogDescription>
              Select a saved filter preset to apply
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {presets.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No saved presets yet</p>
            ) : (
              presets.map((preset) => (
                <Card key={preset.id} className="p-3 hover-elevate cursor-pointer">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className="flex-1"
                      onClick={() => handleLoadPreset(preset)}
                      data-testid={`preset-${preset.id}`}
                    >
                      <div className="font-medium">{preset.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {Object.values(preset.filters).reduce((sum, arr) => sum + arr.length, 0)} filters
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePreset(preset.id);
                      }}
                      data-testid={`button-delete-preset-${preset.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.breeds.map((breed) => (
            <Badge key={`breed-${breed}`} variant="secondary" className="gap-1">
              Breed: {breed}
              <button onClick={() => toggleArrayFilter('breeds', breed)} className="ml-1">×</button>
            </Badge>
          ))}
          {filters.sexes.map((sex) => (
            <Badge key={`sex-${sex}`} variant="secondary" className="gap-1">
              Sex: {sex}
              <button onClick={() => toggleArrayFilter('sexes', sex)} className="ml-1">×</button>
            </Badge>
          ))}
          {filters.statuses.map((status) => (
            <Badge key={`status-${status}`} variant="secondary" className="gap-1">
              Status: {status}
              <button onClick={() => toggleArrayFilter('statuses', status)} className="ml-1">×</button>
            </Badge>
          ))}
          {filters.ageRanges.map((range) => (
            <Badge key={`age-${range}`} variant="secondary" className="gap-1">
              Age: {AGE_RANGES.find(r => r.value === range)?.label}
              <button onClick={() => toggleArrayFilter('ageRanges', range)} className="ml-1">×</button>
            </Badge>
          ))}
          {filters.groupIds.map((groupId) => {
            const group = availableGroups.find(g => g.id === groupId);
            return (
              <Badge
                key={`group-${groupId}`}
                variant="secondary"
                className="gap-1"
                style={group?.color ? { backgroundColor: group.color, color: '#ffffff' } : {}}
              >
                Group: {group?.name || groupId}
                <button onClick={() => toggleArrayFilter('groupIds', groupId)} className="ml-1">×</button>
              </Badge>
            );
          })}
          {filters.pastureIds.map((pastureId) => {
            const pasture = availablePastures.find(p => p.id === pastureId);
            return (
              <Badge key={`pasture-${pastureId}`} variant="secondary" className="gap-1">
                Pasture: {pasture?.name || pastureId}
                <button onClick={() => toggleArrayFilter('pastureIds', pastureId)} className="ml-1">×</button>
              </Badge>
            );
          })}
        </div>
      )}
    </>
  );
}
