import { useState } from "react";
import { useFarm, Farm } from "@/lib/farm-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Building2, 
  ChevronDown, 
  Plus, 
  Settings, 
  Check,
  MapPin,
  Ruler,
  Trash2,
  Edit,
} from "lucide-react";
import { toast } from "sonner";

const FARM_COLORS = [
  "#1a3a2f", "#2563eb", "#16a34a", "#dc2626", "#9333ea",
  "#ea580c", "#0891b2", "#4f46e5", "#be185d", "#65a30d"
];

const FARM_TYPES = [
  "Dairy",
  "Beef",
  "Sheep",
  "Mixed Livestock",
  "Cropping",
  "Horticulture",
  "Other"
];

export function FarmSwitcher() {
  const { farms, currentFarm, switchFarm, addFarm, updateFarm, removeFarm } = useFarm();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  
  const [newFarm, setNewFarm] = useState({
    name: "",
    location: "",
    size: "",
    sizeUnit: "ha",
    type: "Dairy",
    color: FARM_COLORS[0],
  });

  const handleAddFarm = () => {
    if (!newFarm.name.trim()) {
      toast.error("Please enter a farm name");
      return;
    }
    
    addFarm({
      name: newFarm.name.trim(),
      location: newFarm.location.trim() || undefined,
      size: newFarm.size ? parseFloat(newFarm.size) : undefined,
      sizeUnit: newFarm.sizeUnit,
      type: newFarm.type,
      color: newFarm.color,
    });
    
    setNewFarm({
      name: "",
      location: "",
      size: "",
      sizeUnit: "ha",
      type: "Dairy",
      color: FARM_COLORS[farms.length % FARM_COLORS.length],
    });
    setIsAddDialogOpen(false);
    toast.success("Farm added successfully");
  };

  const handleUpdateFarm = () => {
    if (!editingFarm) return;
    
    updateFarm(editingFarm.id, editingFarm);
    setEditingFarm(null);
    toast.success("Farm updated");
  };

  const handleDeleteFarm = (id: string) => {
    if (farms.length <= 1) {
      toast.error("Cannot delete the only farm");
      return;
    }
    removeFarm(id);
    toast.success("Farm removed");
  };

  const handleSwitchFarm = (farmId: string) => {
    switchFarm(farmId);
    toast.success(`Switched to ${farms.find(f => f.id === farmId)?.name}`);
  };

  if (!currentFarm) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 h-9 px-3 font-medium"
          >
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: currentFarm.color || FARM_COLORS[0] }}
            />
            <span className="max-w-[150px] truncate">{currentFarm.name}</span>
            {farms.length > 1 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {farms.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Your Farms
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {farms.map(farm => (
            <DropdownMenuItem
              key={farm.id}
              onClick={() => handleSwitchFarm(farm.id)}
              className="flex items-center gap-3 py-2 cursor-pointer"
            >
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: farm.color || FARM_COLORS[0] }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{farm.name}</p>
                {farm.location && (
                  <p className="text-xs text-muted-foreground truncate">{farm.location}</p>
                )}
              </div>
              {farm.id === currentFarm.id && (
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={() => setIsAddDialogOpen(true)}
            className="flex items-center gap-2 text-primary cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add New Farm
          </DropdownMenuItem>
          
          <DropdownMenuItem
            onClick={() => setIsManageDialogOpen(true)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Settings className="h-4 w-4" />
            Manage Farms
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add Farm Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Farm</DialogTitle>
            <DialogDescription>
              Add another property to manage from this account
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Farm Name *</Label>
              <Input
                value={newFarm.name}
                onChange={(e) => setNewFarm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., North Block, Home Farm"
              />
            </div>
            
            <div>
              <Label>Location</Label>
              <Input
                value={newFarm.location}
                onChange={(e) => setNewFarm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., Waikato, New Zealand"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Size</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={newFarm.size}
                    onChange={(e) => setNewFarm(prev => ({ ...prev, size: e.target.value }))}
                    placeholder="450"
                    className="flex-1"
                  />
                  <Select 
                    value={newFarm.sizeUnit} 
                    onValueChange={(v) => setNewFarm(prev => ({ ...prev, sizeUnit: v }))}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ha">ha</SelectItem>
                      <SelectItem value="acres">acres</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label>Farm Type</Label>
                <Select 
                  value={newFarm.type} 
                  onValueChange={(v) => setNewFarm(prev => ({ ...prev, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FARM_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {FARM_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewFarm(prev => ({ ...prev, color }))}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      newFarm.color === color ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddFarm}>
              Add Farm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Farms Dialog */}
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Farms</DialogTitle>
            <DialogDescription>
              Edit or remove your farm properties
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {farms.map(farm => (
              <div 
                key={farm.id}
                className="flex items-center gap-3 p-3 border rounded-lg"
              >
                {editingFarm?.id === farm.id ? (
                  <div className="flex-1 space-y-2">
                    <Input
                      value={editingFarm.name}
                      onChange={(e) => setEditingFarm({ ...editingFarm, name: e.target.value })}
                      placeholder="Farm name"
                    />
                    <Input
                      value={editingFarm.location || ''}
                      onChange={(e) => setEditingFarm({ ...editingFarm, location: e.target.value })}
                      placeholder="Location"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleUpdateFarm}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingFarm(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: farm.color || FARM_COLORS[0] }}
                    >
                      {farm.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium flex items-center gap-2">
                        {farm.name}
                        {farm.id === currentFarm.id && (
                          <Badge variant="secondary" className="text-xs">Current</Badge>
                        )}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {farm.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {farm.location}
                          </span>
                        )}
                        {farm.size && (
                          <span className="flex items-center gap-1">
                            <Ruler className="h-3 w-3" />
                            {farm.size} {farm.sizeUnit}
                          </span>
                        )}
                        {farm.type && (
                          <Badge variant="outline" className="text-xs">{farm.type}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => setEditingFarm(farm)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {farms.length > 1 && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDeleteFarm(farm.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Farm
            </Button>
            <Button onClick={() => setIsManageDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
