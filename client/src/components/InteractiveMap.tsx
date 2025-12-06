import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap, useMapEvents } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Map as MapIcon, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  RotateCw,
  MapPin,
  AlertTriangle,
  TreePine,
  Droplets,
  Zap,
  Mountain,
  Home,
  Tractor,
  Fence,
  Navigation
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Paddock {
  id: string;
  name: string;
  boundaries: [number, number][]; // [[lat, lng], [lat, lng], ...]
  area: number; // in hectares
  pastureType: string;
  status: string;
  lastGrazed?: string;
  nextInspection?: string;
}

interface Hazard {
  id: string;
  type: 'chemical' | 'machinery' | 'terrain' | 'water' | 'electrical' | 'biosecurity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location: [number, number]; // [lat, lng]
  createdAt: string;
  resolvedAt?: string;
}

interface InteractiveMapProps {
  center?: [number, number];
  zoom?: number;
  paddocks?: Paddock[];
  hazards?: Hazard[];
  onPaddockClick?: (paddock: Paddock) => void;
  onHazardClick?: (hazard: Hazard) => void;
  onMapClick?: (lat: number, lng: number) => void;
  showPaddocks?: boolean;
  showHazards?: boolean;
  enableDrawing?: boolean;
}

// Custom marker icons for different hazard types
const hazardIcons = {
  chemical: L.divIcon({
    html: '<div class="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold">⚗️</div>',
    className: 'custom-div-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }),
  machinery: L.divIcon({
    html: '<div class="bg-orange-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold">🔧</div>',
    className: 'custom-div-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }),
  terrain: L.divIcon({
    html: '<div class="bg-yellow-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold">⛰️</div>',
    className: 'custom-div-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }),
  water: L.divIcon({
    html: '<div class="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold">💧</div>',
    className: 'custom-div-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }),
  electrical: L.divIcon({
    html: '<div class="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold">⚡</div>',
    className: 'custom-div-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }),
  biosecurity: L.divIcon({
    html: '<div class="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold">🦠</div>',
    className: 'custom-div-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }),
};

const severityColors = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
};

const pastureTypeColors = {
  'pasture': '#1e3932',
  'crop': '#b8963e',
  'fallow': '#6b7280',
  'native': '#3d7550',
};

function MapControls({ map }: { map: L.Map }) {
  const handleZoomIn = () => map.zoomIn();
  const handleZoomOut = () => map.zoomOut();
  const handleReset = () => {
    if (map) {
      map.setView([-40.9006, 174.8860], 13); // Default to New Zealand farm location
    }
  };

  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleZoomIn}
        className="bg-white shadow-md"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleZoomOut}
        className="bg-white shadow-md"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleReset}
        className="bg-white shadow-md"
      >
        <RotateCw className="h-4 w-4" />
      </Button>
    </div>
  );
}

function MapEventHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export default function InteractiveMap({
  center = [-40.9006, 174.8860],
  zoom = 13,
  paddocks = [],
  hazards = [],
  onPaddockClick,
  onHazardClick,
  onMapClick,
  showPaddocks = true,
  showHazards = true,
  enableDrawing = false,
}: InteractiveMapProps) {
  const [map, setMap] = useState<L.Map | null>(null);
  const [activeTab, setActiveTab] = useState('paddocks');
  const [selectedPaddock, setSelectedPaddock] = useState<Paddock | null>(null);
  const [selectedHazard, setSelectedHazard] = useState<Hazard | null>(null);

  useEffect(() => {
    // Import Leaflet CSS dynamically to avoid SSR issues
    import('leaflet/dist/leaflet.css');
  }, []);

  const handlePaddockClick = (paddock: Paddock) => {
    setSelectedPaddock(paddock);
    setSelectedHazard(null);
    onPaddockClick?.(paddock);
  };

  const handleHazardClick = (hazard: Hazard) => {
    setSelectedHazard(hazard);
    setSelectedPaddock(null);
    onHazardClick?.(hazard);
  };

  const stats = {
    totalPaddocks: paddocks.length,
    activePaddocks: paddocks.filter(p => p.status === 'active').length,
    totalHazards: hazards.length,
    criticalHazards: hazards.filter(h => h.severity === 'critical').length,
    highHazards: hazards.filter(h => h.severity === 'high').length,
  };

  return (
    <div className="space-y-4">
      {/* Map Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapIcon className="h-5 w-5 text-green-600" />
              Interactive Farm Map
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Layers className="h-4 w-4 mr-2" />
                Layers
              </Button>
              <Button variant="outline" size="sm">
                <Navigation className="h-4 w-4 mr-2" />
                GPS
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.totalPaddocks}</div>
            <div className="text-sm text-gray-600">Total Paddocks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.activePaddocks}</div>
            <div className="text-sm text-gray-600">Active Paddocks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.totalHazards}</div>
            <div className="text-sm text-gray-600">Total Hazards</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.criticalHazards + stats.highHazards}</div>
            <div className="text-sm text-gray-600">High Priority</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Map */}
      <Card>
        <CardContent className="p-0">
          <div className="relative h-[600px] w-full">
            <MapContainer
              center={center}
              zoom={zoom}
              style={{ height: '100%', width: '100%' }}
              ref={setMap}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              <MapEventHandler onMapClick={onMapClick} />
              
              {/* Paddock Boundaries */}
              {showPaddocks && paddocks.map((paddock) => (
                <Polygon
                  key={paddock.id}
                  positions={paddock.boundaries}
                  pathOptions={{
                    color: pastureTypeColors[paddock.pastureType as keyof typeof pastureTypeColors] || '#1e3932',
                    weight: 2,
                    opacity: 0.8,
                    fillColor: pastureTypeColors[paddock.pastureType as keyof typeof pastureTypeColors] || '#1e3932',
                    fillOpacity: 0.3,
                  }}
                  eventHandlers={{
                    click: () => handlePaddockClick(paddock),
                  }}
                />
              ))}

              {/* Hazard Markers */}
              {showHazards && hazards.map((hazard) => (
                <Marker
                  key={hazard.id}
                  position={hazard.location}
                  icon={hazardIcons[hazard.type]}
                  eventHandlers={{
                    click: () => handleHazardClick(hazard),
                  }}
                >
                  <Popup>
                    <div className="p-2 min-w-[200px]">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{hazard.title}</h4>
                        <Badge className={severityColors[hazard.severity]}>
                          {hazard.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{hazard.description}</p>
                      <div className="text-xs text-gray-500">
                        Type: {hazard.type} • Created: {new Date(hazard.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {map && <MapControls map={map} />}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {/* Details Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Map Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="paddocks">Paddocks</TabsTrigger>
              <TabsTrigger value="hazards">Hazards</TabsTrigger>
              <TabsTrigger value="legend">Legend</TabsTrigger>
            </TabsList>
            
            <TabsContent value="paddocks" className="space-y-4">
              {selectedPaddock ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{selectedPaddock.name}</h4>
                    <Badge variant="outline">{selectedPaddock.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Area:</span>
                      <span className="ml-2 font-medium">{selectedPaddock.area} ha</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Type:</span>
                      <span className="ml-2 font-medium">{selectedPaddock.pastureType}</span>
                    </div>
                    {selectedPaddock.lastGrazed && (
                      <div>
                        <span className="text-gray-600">Last Grazed:</span>
                        <span className="ml-2 font-medium">{new Date(selectedPaddock.lastGrazed).toLocaleDateString()}</span>
                      </div>
                    )}
                    {selectedPaddock.nextInspection && (
                      <div>
                        <span className="text-gray-600">Next Inspection:</span>
                        <span className="ml-2 font-medium">{new Date(selectedPaddock.nextInspection).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Click on a paddock to view details</p>
              )}
            </TabsContent>
            
            <TabsContent value="hazards" className="space-y-4">
              {selectedHazard ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{selectedHazard.title}</h4>
                    <Badge className={severityColors[selectedHazard.severity]}>
                      {selectedHazard.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{selectedHazard.description}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Type:</span>
                      <span className="ml-2 font-medium">{selectedHazard.type}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className="ml-2 font-medium">{selectedHazard.resolvedAt ? 'Resolved' : 'Active'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Created:</span>
                      <span className="ml-2 font-medium">{new Date(selectedHazard.createdAt).toLocaleDateString()}</span>
                    </div>
                    {selectedHazard.resolvedAt && (
                      <div>
                        <span className="text-gray-600">Resolved:</span>
                        <span className="ml-2 font-medium">{new Date(selectedHazard.resolvedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Click on a hazard to view details</p>
              )}
            </TabsContent>
            
            <TabsContent value="legend" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Fence className="h-4 w-4" />
                    Paddock Types
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span>Pasture</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-amber-500 rounded"></div>
                      <span>Crop</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gray-500 rounded"></div>
                      <span>Fallow</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-emerald-600 rounded"></div>
                      <span>Native</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Hazard Severity
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
                      <span>Low</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded"></div>
                      <span>Medium</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-orange-100 border border-orange-200 rounded"></div>
                      <span>High</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
                      <span>Critical</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
