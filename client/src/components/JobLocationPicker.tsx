import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Fix for default markers in Leaflet with React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface JobLocationPickerProps {
  latitude?: number;
  longitude?: number;
  onLocationChange: (lat: number, lng: number) => void;
  className?: string;
}

interface LocationState {
  latitude: number;
  longitude: number;
  isUserLocation: boolean;
  isLoading: boolean;
  error: string | null;
}

// Cache location in localStorage to avoid repeated geolocation requests
const CACHE_KEY = 'pulse_user_location';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function getCachedLocation(): { lat: number; lng: number } | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const { timestamp, location } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return location;
  } catch {
    return null;
  }
}

function setCachedLocation(lat: number, lng: number) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      location: { lat, lng }
    }));
  } catch {
    // Ignore cache errors
  }
}

async function getUserLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCachedLocation(latitude, longitude);
        resolve({ lat: latitude, lng: longitude });
      },
      (error) => {
        let message = 'Unable to get your location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please enable location access or click on the map to set location manually.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable. Please click on the map to set location manually.';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out. Please try again or click on the map to set location manually.';
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: CACHE_DURATION
      }
    );
  });
}

export function JobLocationPicker({ 
  latitude = -40.9006, // Default to New Zealand dairy region
  longitude = 175.6466,
  onLocationChange,
  className = ""
}: JobLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [locationState, setLocationState] = useState<LocationState>({
    latitude,
    longitude,
    isUserLocation: false,
    isLoading: false,
    error: null
  });

  // Initialize location on component mount
  useEffect(() => {
    const initializeLocation = async () => {
      // Check cache first
      const cachedLocation = getCachedLocation();
      if (cachedLocation) {
        setLocationState({
          latitude: cachedLocation.lat,
          longitude: cachedLocation.lng,
          isUserLocation: true,
          isLoading: false,
          error: null
        });
        onLocationChange(cachedLocation.lat, cachedLocation.lng);
        return;
      }

      // Try to get user location
      setLocationState(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
        const userLocation = await getUserLocation();
        setLocationState({
          latitude: userLocation.lat,
          longitude: userLocation.lng,
          isUserLocation: true,
          isLoading: false,
          error: null
        });
        onLocationChange(userLocation.lat, userLocation.lng);
      } catch (error) {
        // Fall back to default location
        setLocationState({
          latitude,
          longitude,
          isUserLocation: false,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to get location'
        });
        onLocationChange(latitude, longitude);
      }
    };

    initializeLocation();
  }, []); // Remove dependencies to prevent infinite re-renders

  const handleUseMyLocation = async () => {
    setLocationState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const userLocation = await getUserLocation();
      setLocationState({
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        isUserLocation: true,
        isLoading: false,
        error: null
      });
      onLocationChange(userLocation.lat, userLocation.lng);
    } catch (error) {
      setLocationState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to get location'
      }));
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map with initial coordinates
    const map = L.map(mapRef.current).setView([locationState.latitude, locationState.longitude], 13);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add initial marker if coordinates exist
    if (locationState.latitude && locationState.longitude) {
      const marker = L.marker([locationState.latitude, locationState.longitude]).addTo(map);
      markerRef.current = marker;
    }

    // Handle map clicks to set location
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      
      // Remove existing marker
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }
      
      // Add new marker
      const marker = L.marker([lat, lng]).addTo(map);
      markerRef.current = marker;
      
      // Update location state and parent
      setLocationState(prev => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        isUserLocation: false,
        error: null
      }));
      onLocationChange(lat, lng);
    });

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
    };
  }, []); // Only initialize once

  // Update map view and marker when location changes (but not for manual clicks)
  useEffect(() => {
    if (mapInstanceRef.current && locationState.latitude && locationState.longitude) {
      // Only update if it's not a manual click (user location or initial load)
      if (locationState.isUserLocation || !locationState.error) {
        mapInstanceRef.current.setView([locationState.latitude, locationState.longitude], 13);
        
        if (markerRef.current) {
          markerRef.current.setLatLng([locationState.latitude, locationState.longitude]);
        } else {
          const marker = L.marker([locationState.latitude, locationState.longitude]).addTo(mapInstanceRef.current);
          markerRef.current = marker;
        }
      }
    }
  }, [locationState.latitude, locationState.longitude, locationState.isUserLocation, locationState.error]);

  return (
    <div className={`relative ${className}`}>
      <div className="absolute top-2 right-2 z-10 bg-white rounded-lg shadow-md p-3 text-xs max-w-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3 text-pulse-forest" />
            <p className="text-gray-600 font-medium">
              {locationState.isUserLocation ? 'Your Location' : 'Click to set location'}
            </p>
          </div>
          {!locationState.isUserLocation && !locationState.isLoading && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleUseMyLocation}
              className="h-6 px-2 text-xs border-pulse-300 text-pulse-forest hover:bg-pulse-50"
            >
              <Crosshair className="h-3 w-3 mr-1" />
              Use My Location
            </Button>
          )}
        </div>
        
        {locationState.isLoading && (
          <p className="text-blue-600">Getting your location...</p>
        )}
        
        {locationState.error && (
          <p className="text-red-600 text-xs">{locationState.error}</p>
        )}
        
        {locationState.latitude && locationState.longitude && !locationState.isLoading && (
          <p className="text-gray-800 font-medium">
            {locationState.latitude.toFixed(6)}, {locationState.longitude.toFixed(6)}
          </p>
        )}
      </div>
      
      {locationState.isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 rounded-lg border border-gray-300 flex items-center justify-center z-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pulse-forest mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Getting location...</p>
          </div>
        </div>
      )}
      
      <div 
        ref={mapRef} 
        className="w-full h-64 rounded-lg border border-gray-300"
      />
    </div>
  );
}
