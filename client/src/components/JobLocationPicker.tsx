import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SATELLITE_TILES, SATELLITE_ATTRIBUTION, DEFAULT_CENTER } from '@/components/records/AreaDrawer';

interface JobLocationPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onLocationChange: (lat: number | null, lng: number | null) => void;
  // Where to look when the job has no pin yet, e.g. the middle of the farm's other jobs
  center?: [number, number];
  readOnly?: boolean;
  className?: string;
}

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#e8590c;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

/**
 * Satellite map to pin where a job is: tap the map, drag the pin, or use the phone's location
 */
export function JobLocationPicker({ latitude, longitude, onLocationChange, center, readOnly = false, className = '' }: JobLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const changeRef = useRef(onLocationChange);
  changeRef.current = onLocationChange;
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPin = latitude != null && longitude != null;

  useEffect(() => {
    if (!containerRef.current) return;
    const start: [number, number] = hasPin ? [latitude!, longitude!] : center ?? DEFAULT_CENTER;
    const map = L.map(containerRef.current, { zoomControl: !readOnly, dragging: !readOnly, scrollWheelZoom: !readOnly })
      .setView(start, hasPin ? 17 : 15);
    L.tileLayer(SATELLITE_TILES, { attribution: SATELLITE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    if (!readOnly) {
      map.on('click', (e: L.LeafletMouseEvent) => changeRef.current(Number(e.latlng.lat.toFixed(7)), Number(e.latlng.lng.toFixed(7))));
    }
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; the pin follows the props below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!hasPin) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const at: [number, number] = [latitude!, longitude!];
    if (markerRef.current) {
      markerRef.current.setLatLng(at);
    } else {
      const marker = L.marker(at, { icon: pinIcon, draggable: !readOnly }).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        changeRef.current(Number(p.lat.toFixed(7)), Number(p.lng.toFixed(7)));
      });
      markerRef.current = marker;
      map.setView(at, Math.max(map.getZoom(), 16));
    }
  }, [hasPin, latitude, longitude, readOnly]);

  // Centre on the farm once its location is known, if nothing is pinned yet
  useEffect(() => {
    if (!hasPin && center) mapRef.current?.setView(center, 15);
  }, [center?.[0], center?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("This device can't share its location. Tap the map instead.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(7));
        const lng = Number(pos.coords.longitude.toFixed(7));
        changeRef.current(lat, lng);
        mapRef.current?.setView([lat, lng], 17);
      },
      () => {
        setLocating(false);
        setError("Couldn't get your location. Tap the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div ref={containerRef} className={readOnly ? 'h-full min-h-[12rem] w-full' : 'h-64 w-full rounded-md border'} />
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button type="button" size="sm" variant="outline" onClick={useMyLocation} disabled={locating}>
            <Crosshair className="h-4 w-4 mr-1" />{locating ? 'Finding you…' : 'Use my location'}
          </Button>
          {hasPin ? (
            <>
              <span className="text-muted-foreground tabular-nums">{latitude!.toFixed(5)}, {longitude!.toFixed(5)}</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => onLocationChange(null, null)}>
                <X className="h-4 w-4 mr-1" />Clear pin
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground">Tap the map where the job is.</span>
          )}
          {error && <span className="text-red-700 w-full">{error}</span>}
        </div>
      )}
    </div>
  );
}
