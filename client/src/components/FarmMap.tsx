import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons by priority
const createCustomIcon = (color: string, size: number = 25) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
};

const priorityColors: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const categoryColors: Record<string, string> = {
  fence_repair: '#8b5cf6',
  water_issue: '#3b82f6',
  animal_check: '#ec4899',
  pasture_maintenance: '#22c55e',
  equipment: '#f59e0b',
  hazard: '#ef4444',
  other: '#6b7280',
};

export interface TaskPin {
  id: string;
  title: string;
  description: string | null;
  latitude: string;
  longitude: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string | null;
  dueDate: string | null;
  assignedTo: string | null;
  pastureId: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface Paddock {
  id: string;
  name: string;
  coordinates: [number, number][];
  color?: string;
  status?: string;
}

interface FarmMapProps {
  taskPins: TaskPin[];
  paddocks?: Paddock[];
  center?: [number, number];
  zoom?: number;
  onPinClick?: (pin: TaskPin) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onPinComplete?: (pinId: string) => void;
  onPinDelete?: (pinId: string) => void;
  isPlacingPin?: boolean;
  showPaddocks?: boolean;
  selectedPinId?: string | null;
}

// Component to handle map click events
function MapClickHandler({ onMapClick, isPlacingPin }: { onMapClick?: (lat: number, lng: number) => void; isPlacingPin?: boolean }) {
  useMapEvents({
    click: (e) => {
      if (isPlacingPin && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Component to recenter map
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function FarmMap({
  taskPins,
  paddocks = [],
  center = [-36.8485, 174.7633], // Default to Auckland, NZ
  zoom = 14,
  onPinClick,
  onMapClick,
  onPinComplete,
  onPinDelete,
  isPlacingPin = false,
  showPaddocks = true,
  selectedPinId,
}: FarmMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  const getMarkerIcon = (pin: TaskPin) => {
    if (pin.status === 'completed') {
      return createCustomIcon('#22c55e', 20); // Green for completed
    }
    return createCustomIcon(priorityColors[pin.priority] || '#6b7280');
  };

  const getPaddockColor = (paddock: Paddock) => {
    if (paddock.color) return paddock.color;
    if (paddock.status === 'grazing') return '#22c55e';
    if (paddock.status === 'resting') return '#eab308';
    if (paddock.status === 'maintenance') return '#ef4444';
    return '#3b82f6';
  };

  return (
    <div className={`relative w-full h-full min-h-[500px] rounded-lg overflow-hidden ${isPlacingPin ? 'cursor-crosshair' : ''}`}>
      {isPlacingPin && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-pulse-forest text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span className="animate-pulse">📍</span>
          Click on the map to place a task pin
        </div>
      )}
      
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Satellite layer option */}
        {/* <TileLayer
          attribution='Tiles &copy; Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        /> */}

        <MapClickHandler onMapClick={onMapClick} isPlacingPin={isPlacingPin} />
        
        {/* Paddock boundaries */}
        {showPaddocks && paddocks.map((paddock) => (
          <Polygon
            key={paddock.id}
            positions={paddock.coordinates}
            pathOptions={{
              color: getPaddockColor(paddock),
              fillColor: getPaddockColor(paddock),
              fillOpacity: 0.2,
              weight: 2,
            }}
          >
            <Popup>
              <div className="font-medium">{paddock.name}</div>
              {paddock.status && (
                <div className="text-sm text-gray-500 capitalize">{paddock.status}</div>
              )}
            </Popup>
          </Polygon>
        ))}

        {/* Task pins */}
        {taskPins.map((pin) => (
          <Marker
            key={pin.id}
            position={[parseFloat(pin.latitude), parseFloat(pin.longitude)]}
            icon={getMarkerIcon(pin)}
            eventHandlers={{
              click: () => onPinClick?.(pin),
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="font-semibold text-base mb-1">{pin.title}</div>
                {pin.description && (
                  <p className="text-sm text-gray-600 mb-2">{pin.description}</p>
                )}
                <div className="flex flex-wrap gap-1 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs text-white ${
                    pin.priority === 'urgent' ? 'bg-red-500' :
                    pin.priority === 'high' ? 'bg-orange-500' :
                    pin.priority === 'medium' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}>
                    {pin.priority}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs bg-gray-200">
                    {pin.category?.replace('_', ' ') || 'Other'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    pin.status === 'completed' ? 'bg-green-100 text-green-800' :
                    pin.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {pin.status.replace('_', ' ')}
                  </span>
                </div>
                {pin.dueDate && (
                  <p className="text-xs text-gray-500 mb-2">
                    Due: {new Date(pin.dueDate).toLocaleDateString()}
                  </p>
                )}
                {pin.assignedTo && (
                  <p className="text-xs text-gray-500 mb-2">
                    Assigned to: {pin.assignedTo}
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  {pin.status !== 'completed' && onPinComplete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPinComplete(pin.id);
                      }}
                      className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Complete
                    </button>
                  )}
                  {onPinDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPinDelete(pin.id);
                      }}
                      className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Map Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-3 text-xs">
        <div className="font-semibold mb-2">Priority Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Urgent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>High</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Low / Completed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
