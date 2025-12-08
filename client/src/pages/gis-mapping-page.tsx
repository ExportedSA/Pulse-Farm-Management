import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Map, Layers, MapPin, Navigation, Ruler, Square, Circle, Pencil,
  Eye, EyeOff, Download, Upload, Settings, ZoomIn, ZoomOut, Locate,
  Droplets, Leaf, AlertTriangle, Fence, Route, Mountain, TreePine,
  Home, Tractor, Warehouse, ChevronRight, Info, Save, Trash2, Edit
} from 'lucide-react';

// Types
interface Paddock {
  id: string;
  name: string;
  area: number; // hectares
  coordinates: [number, number][]; // polygon coordinates
  centroid: [number, number];
  soilType: string;
  landClass: string;
  currentCover: number; // kg DM/ha
  targetCover: number;
  status: 'grazing' | 'resting' | 'silage' | 'cropping' | 'effluent';
  lastGrazed?: string;
  currentMob?: string;
  effluentZone: boolean;
  riparianZone: boolean;
  criticalSourceArea: boolean;
  slope: number; // degrees
  aspect: string;
  elevation: number; // meters
  fenceCondition: 'good' | 'fair' | 'poor';
  waterSource: string[];
}

interface MapLayer {
  id: string;
  name: string;
  type: 'paddocks' | 'soil' | 'contour' | 'water' | 'infrastructure' | 'effluent' | 'riparian' | 'csa';
  visible: boolean;
  opacity: number;
  color?: string;
}

interface Infrastructure {
  id: string;
  type: 'shed' | 'trough' | 'gate' | 'race' | 'bridge' | 'culvert' | 'pump' | 'tank';
  name: string;
  coordinates: [number, number];
  condition: 'good' | 'fair' | 'poor';
  notes?: string;
}

interface WaterFeature {
  id: string;
  type: 'stream' | 'pond' | 'wetland' | 'drain' | 'spring';
  name: string;
  coordinates: [number, number][] | [number, number];
  fenced: boolean;
  riparianWidth?: number;
}

// Mock data
const mockPaddocks: Paddock[] = [
  { id: 'p1', name: 'North Block 1', area: 4.2, coordinates: [[-37.785, 175.275], [-37.783, 175.275], [-37.783, 175.280], [-37.785, 175.280]], centroid: [-37.784, 175.2775], soilType: 'Allophanic', landClass: 'LUC 2', currentCover: 2800, targetCover: 3000, status: 'grazing', currentMob: 'Milking Herd', effluentZone: false, riparianZone: false, criticalSourceArea: false, slope: 5, aspect: 'N', elevation: 45, fenceCondition: 'good', waterSource: ['trough'] },
  { id: 'p2', name: 'North Block 2', area: 3.8, coordinates: [[-37.783, 175.275], [-37.781, 175.275], [-37.781, 175.280], [-37.783, 175.280]], centroid: [-37.782, 175.2775], soilType: 'Allophanic', landClass: 'LUC 2', currentCover: 2400, targetCover: 2800, status: 'resting', lastGrazed: '2024-12-05', effluentZone: false, riparianZone: false, criticalSourceArea: false, slope: 3, aspect: 'NE', elevation: 42, fenceCondition: 'good', waterSource: ['trough'] },
  { id: 'p3', name: 'South Block 1', area: 5.1, coordinates: [[-37.790, 175.275], [-37.788, 175.275], [-37.788, 175.282], [-37.790, 175.282]], centroid: [-37.789, 175.2785], soilType: 'Brown', landClass: 'LUC 3', currentCover: 3200, targetCover: 3000, status: 'resting', lastGrazed: '2024-12-03', effluentZone: true, riparianZone: false, criticalSourceArea: false, slope: 8, aspect: 'S', elevation: 52, fenceCondition: 'fair', waterSource: ['trough', 'stream'] },
  { id: 'p4', name: 'River Flat', area: 6.2, coordinates: [[-37.792, 175.280], [-37.790, 175.280], [-37.790, 175.288], [-37.792, 175.288]], centroid: [-37.791, 175.284], soilType: 'Gley', landClass: 'LUC 4', currentCover: 2600, targetCover: 2800, status: 'grazing', currentMob: 'Dry Cows', effluentZone: false, riparianZone: true, criticalSourceArea: true, slope: 2, aspect: 'E', elevation: 38, fenceCondition: 'good', waterSource: ['stream'] },
  { id: 'p5', name: 'Hill Block', area: 8.5, coordinates: [[-37.780, 175.282], [-37.776, 175.282], [-37.776, 175.290], [-37.780, 175.290]], centroid: [-37.778, 175.286], soilType: 'Brown', landClass: 'LUC 5', currentCover: 2200, targetCover: 2500, status: 'resting', lastGrazed: '2024-12-01', effluentZone: false, riparianZone: false, criticalSourceArea: false, slope: 18, aspect: 'NW', elevation: 85, fenceCondition: 'poor', waterSource: ['spring'] },
  { id: 'p6', name: 'Effluent Block', area: 3.5, coordinates: [[-37.787, 175.270], [-37.785, 175.270], [-37.785, 175.275], [-37.787, 175.275]], centroid: [-37.786, 175.2725], soilType: 'Allophanic', landClass: 'LUC 2', currentCover: 3500, targetCover: 3200, status: 'effluent', effluentZone: true, riparianZone: false, criticalSourceArea: false, slope: 4, aspect: 'W', elevation: 48, fenceCondition: 'good', waterSource: ['trough'] },
];

const mockLayers: MapLayer[] = [
  { id: 'paddocks', name: 'Paddocks', type: 'paddocks', visible: true, opacity: 100 },
  { id: 'soil', name: 'Soil Types', type: 'soil', visible: false, opacity: 70 },
  { id: 'contour', name: 'Contours', type: 'contour', visible: false, opacity: 50 },
  { id: 'water', name: 'Water Features', type: 'water', visible: true, opacity: 100 },
  { id: 'infrastructure', name: 'Infrastructure', type: 'infrastructure', visible: true, opacity: 100 },
  { id: 'effluent', name: 'Effluent Zones', type: 'effluent', visible: false, opacity: 60, color: '#8B4513' },
  { id: 'riparian', name: 'Riparian Zones', type: 'riparian', visible: false, opacity: 60, color: '#228B22' },
  { id: 'csa', name: 'Critical Source Areas', type: 'csa', visible: false, opacity: 60, color: '#FF6347' },
];

const mockInfrastructure: Infrastructure[] = [
  { id: 'i1', type: 'shed', name: 'Milking Shed', coordinates: [-37.786, 175.277], condition: 'good' },
  { id: 'i2', type: 'shed', name: 'Implement Shed', coordinates: [-37.787, 175.276], condition: 'good' },
  { id: 'i3', type: 'trough', name: 'North Trough 1', coordinates: [-37.784, 175.277], condition: 'good' },
  { id: 'i4', type: 'trough', name: 'South Trough 1', coordinates: [-37.789, 175.279], condition: 'fair' },
  { id: 'i5', type: 'gate', name: 'Main Gate', coordinates: [-37.786, 175.274], condition: 'good' },
  { id: 'i6', type: 'pump', name: 'Effluent Pump', coordinates: [-37.786, 175.272], condition: 'good' },
];

export default function GISMappingPage() {
  const [activeTab, setActiveTab] = useState('map');
  const [selectedPaddock, setSelectedPaddock] = useState<Paddock | null>(null);
  const [layers, setLayers] = useState(mockLayers);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-37.786, 175.280]);
  const [mapZoom, setMapZoom] = useState(14);
  const [measureMode, setMeasureMode] = useState<'none' | 'distance' | 'area'>('none');
  const [drawMode, setDrawMode] = useState<'none' | 'polygon' | 'point' | 'line'>('none');
  const [isEditMode, setIsEditMode] = useState(false);
  const [showPaddockDialog, setShowPaddockDialog] = useState(false);

  const totalArea = mockPaddocks.reduce((sum, p) => sum + p.area, 0);
  const grazingArea = mockPaddocks.filter(p => p.status === 'grazing').reduce((sum, p) => sum + p.area, 0);
  const effluentArea = mockPaddocks.filter(p => p.effluentZone).reduce((sum, p) => sum + p.area, 0);
  const riparianArea = mockPaddocks.filter(p => p.riparianZone).reduce((sum, p) => sum + p.area, 0);

  const toggleLayer = (layerId: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l));
  };

  const setLayerOpacity = (layerId: string, opacity: number) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, opacity } : l));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'grazing': return 'bg-green-500';
      case 'resting': return 'bg-blue-500';
      case 'silage': return 'bg-yellow-500';
      case 'cropping': return 'bg-orange-500';
      case 'effluent': return 'bg-amber-700';
      default: return 'bg-gray-500';
    }
  };

  const getCoverStatus = (current: number, target: number) => {
    const ratio = current / target;
    if (ratio >= 1.1) return { color: 'text-green-600', label: 'Above Target' };
    if (ratio >= 0.9) return { color: 'text-blue-600', label: 'On Target' };
    if (ratio >= 0.7) return { color: 'text-yellow-600', label: 'Below Target' };
    return { color: 'text-red-600', label: 'Critical' };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Map className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">GIS Farm Mapping</h1>
                <p className="text-sm text-gray-500">Interactive paddock mapping, soil types & environmental zones</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button size="sm" onClick={() => setIsEditMode(!isEditMode)}>
                <Edit className="h-4 w-4 mr-2" />
                {isEditMode ? 'Done Editing' : 'Edit Map'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Square className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Area</p>
                  <p className="text-xl font-bold">{totalArea.toFixed(1)} ha</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Leaf className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Currently Grazing</p>
                  <p className="text-xl font-bold">{grazingArea.toFixed(1)} ha</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Droplets className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Effluent Area</p>
                  <p className="text-xl font-bold">{effluentArea.toFixed(1)} ha</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TreePine className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Riparian Zones</p>
                  <p className="text-xl font-bold">{riparianArea.toFixed(1)} ha</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map Area */}
          <div className="lg:col-span-3">
            <Card className="h-[600px]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Farm Map</CardTitle>
                  <div className="flex gap-2">
                    {/* Map Tools */}
                    <div className="flex border rounded-lg overflow-hidden">
                      <Button variant={measureMode === 'distance' ? 'default' : 'ghost'} size="sm" className="rounded-none" onClick={() => setMeasureMode(measureMode === 'distance' ? 'none' : 'distance')}>
                        <Ruler className="h-4 w-4" />
                      </Button>
                      <Button variant={measureMode === 'area' ? 'default' : 'ghost'} size="sm" className="rounded-none" onClick={() => setMeasureMode(measureMode === 'area' ? 'none' : 'area')}>
                        <Square className="h-4 w-4" />
                      </Button>
                    </div>
                    {isEditMode && (
                      <div className="flex border rounded-lg overflow-hidden">
                        <Button variant={drawMode === 'polygon' ? 'default' : 'ghost'} size="sm" className="rounded-none" onClick={() => setDrawMode(drawMode === 'polygon' ? 'none' : 'polygon')}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant={drawMode === 'point' ? 'default' : 'ghost'} size="sm" className="rounded-none" onClick={() => setDrawMode(drawMode === 'point' ? 'none' : 'point')}>
                          <MapPin className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex border rounded-lg overflow-hidden">
                      <Button variant="ghost" size="sm" className="rounded-none" onClick={() => setMapZoom(z => Math.min(z + 1, 18))}>
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="rounded-none" onClick={() => setMapZoom(z => Math.max(z - 1, 10))}>
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="rounded-none">
                        <Locate className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="h-[520px] relative">
                {/* Placeholder for actual map - would use Leaflet/Mapbox */}
                <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 rounded-lg relative overflow-hidden">
                  {/* Simulated paddock visualization */}
                  <div className="absolute inset-0 p-4">
                    <svg viewBox="0 0 400 300" className="w-full h-full">
                      {/* Grid lines */}
                      <defs>
                        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
                        </pattern>
                      </defs>
                      <rect width="400" height="300" fill="url(#grid)" />
                      
                      {/* Paddocks */}
                      {mockPaddocks.map((paddock, index) => {
                        const x = 50 + (index % 3) * 110;
                        const y = 30 + Math.floor(index / 3) * 120;
                        const isSelected = selectedPaddock?.id === paddock.id;
                        
                        return (
                          <g key={paddock.id} onClick={() => setSelectedPaddock(paddock)} className="cursor-pointer">
                            <rect
                              x={x}
                              y={y}
                              width={90}
                              height={100}
                              rx={4}
                              fill={paddock.status === 'grazing' ? '#86efac' : paddock.status === 'effluent' ? '#fbbf24' : '#93c5fd'}
                              stroke={isSelected ? '#059669' : '#6b7280'}
                              strokeWidth={isSelected ? 3 : 1}
                              opacity={0.8}
                            />
                            <text x={x + 45} y={y + 20} textAnchor="middle" className="text-xs font-medium fill-gray-700">
                              {paddock.name}
                            </text>
                            <text x={x + 45} y={y + 40} textAnchor="middle" className="text-xs fill-gray-500">
                              {paddock.area} ha
                            </text>
                            <text x={x + 45} y={y + 60} textAnchor="middle" className="text-xs fill-gray-600">
                              {paddock.currentCover} kg/ha
                            </text>
                            {paddock.currentMob && (
                              <text x={x + 45} y={y + 80} textAnchor="middle" className="text-xs fill-green-700 font-medium">
                                🐄 {paddock.currentMob}
                              </text>
                            )}
                            {paddock.effluentZone && (
                              <circle cx={x + 80} cy={y + 10} r={6} fill="#92400e" />
                            )}
                            {paddock.riparianZone && (
                              <circle cx={x + 80} cy={y + 25} r={6} fill="#166534" />
                            )}
                          </g>
                        );
                      })}
                      
                      {/* Infrastructure markers */}
                      {mockInfrastructure.slice(0, 3).map((item, index) => (
                        <g key={item.id}>
                          <circle cx={30 + index * 30} cy={280} r={8} fill="#6366f1" />
                          <text x={30 + index * 30} y={284} textAnchor="middle" className="text-xs fill-white">
                            {item.type === 'shed' ? '🏠' : item.type === 'trough' ? '💧' : '🚪'}
                          </text>
                        </g>
                      ))}
                      
                      {/* Legend */}
                      <g transform="translate(300, 250)">
                        <rect x={0} y={0} width={90} height={45} fill="white" opacity={0.9} rx={4} />
                        <rect x={5} y={8} width={12} height={12} fill="#86efac" />
                        <text x={22} y={17} className="text-xs fill-gray-600">Grazing</text>
                        <rect x={5} y={25} width={12} height={12} fill="#93c5fd" />
                        <text x={22} y={34} className="text-xs fill-gray-600">Resting</text>
                      </g>
                    </svg>
                  </div>
                  
                  {/* Map info overlay */}
                  <div className="absolute bottom-4 left-4 bg-white/90 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-500">Zoom: {mapZoom}x</span>
                    <span className="mx-2">|</span>
                    <span className="text-gray-500">{mockPaddocks.length} paddocks</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Layers Panel */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Map Layers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {layers.map(layer => (
                  <div key={layer.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={layer.visible}
                        onCheckedChange={() => toggleLayer(layer.id)}
                        className="scale-75"
                      />
                      <span className="text-sm">{layer.name}</span>
                    </div>
                    {layer.visible && (
                      <div className="flex items-center gap-1">
                        <Slider
                          value={[layer.opacity]}
                          onValueChange={([v]) => setLayerOpacity(layer.id, v)}
                          max={100}
                          step={10}
                          className="w-16"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Selected Paddock Info */}
            {selectedPaddock && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{selectedPaddock.name}</CardTitle>
                    <Badge className={getStatusColor(selectedPaddock.status)}>
                      {selectedPaddock.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-gray-500">Area</p>
                      <p className="font-medium">{selectedPaddock.area} ha</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Soil Type</p>
                      <p className="font-medium">{selectedPaddock.soilType}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Land Class</p>
                      <p className="font-medium">{selectedPaddock.landClass}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Slope</p>
                      <p className="font-medium">{selectedPaddock.slope}°</p>
                    </div>
                  </div>
                  
                  <div className="border-t pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Pasture Cover</span>
                      <span className={getCoverStatus(selectedPaddock.currentCover, selectedPaddock.targetCover).color}>
                        {selectedPaddock.currentCover} / {selectedPaddock.targetCover} kg/ha
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {selectedPaddock.effluentZone && (
                      <Badge variant="outline" className="text-amber-700 border-amber-700">
                        <Droplets className="h-3 w-3 mr-1" />
                        Effluent
                      </Badge>
                    )}
                    {selectedPaddock.riparianZone && (
                      <Badge variant="outline" className="text-green-700 border-green-700">
                        <TreePine className="h-3 w-3 mr-1" />
                        Riparian
                      </Badge>
                    )}
                    {selectedPaddock.criticalSourceArea && (
                      <Badge variant="outline" className="text-red-700 border-red-700">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        CSA
                      </Badge>
                    )}
                  </div>

                  {selectedPaddock.currentMob && (
                    <div className="bg-green-50 rounded-lg p-2">
                      <p className="text-green-800 font-medium">🐄 {selectedPaddock.currentMob}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" className="flex-1">
                      <Route className="h-3 w-3 mr-1" />
                      Move Stock
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Paddock List */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">All Paddocks</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[300px] overflow-y-auto">
                <div className="space-y-1">
                  {mockPaddocks.map(paddock => (
                    <div
                      key={paddock.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-gray-100 ${selectedPaddock?.id === paddock.id ? 'bg-emerald-50 border border-emerald-200' : ''}`}
                      onClick={() => setSelectedPaddock(paddock)}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(paddock.status)}`} />
                        <span className="text-sm font-medium">{paddock.name}</span>
                      </div>
                      <span className="text-xs text-gray-500">{paddock.area} ha</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
