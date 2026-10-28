import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";

export interface Farm {
  id: string;
  name: string;
  location?: string;
  size?: number;
  sizeUnit?: string;
  type?: string;
  color?: string;
  isDefault?: boolean;
  role?: "owner" | "manager" | "worker" | "viewer";
}

interface FarmContextType {
  farms: Farm[];
  currentFarm: Farm | null;
  isLoading: boolean;
  switchFarm: (farmId: string) => void;
  addFarm: (farm: Omit<Farm, 'id'>) => void;
  updateFarm: (id: string, updates: Partial<Farm>) => void;
  removeFarm: (id: string) => void;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

const CURRENT_FARM_KEY = "pulse_current_farm";
const FARMS_QUERY_KEY = ["/api/farms"];

// Earlier builds kept made-up farms in localStorage; they are not real farms
try {
  localStorage.removeItem("pulse_farms");
} catch {
  // Storage unavailable (private mode); nothing to clean up
}

function getStoredCurrentFarmId(): string | null {
  try {
    return localStorage.getItem(CURRENT_FARM_KEY);
  } catch {
    return null;
  }
}

// Size, type and colour aren't farm columns yet; they live in the farm's settings
function toFarm(row: any, index: number): Farm {
  const settings = row.settings ?? {};
  return {
    id: row.id,
    name: row.name,
    location: row.location ?? undefined,
    size: settings.size,
    sizeUnit: settings.sizeUnit ?? "ha",
    type: settings.type ?? "Dairy",
    color: settings.color ?? "#1a3a2f",
    isDefault: index === 0,
    role: row.role,
  };
}

function toFarmBody(farm: Partial<Farm>) {
  const { id: _id, isDefault: _d, role: _r, size, sizeUnit, type, color, ...fields } = farm;
  const settings = Object.fromEntries(
    Object.entries({ size, sizeUnit, type, color }).filter(([, v]) => v !== undefined),
  );
  return Object.keys(settings).length > 0 ? { ...fields, settings } : fields;
}

export function FarmProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [currentFarmId, setCurrentFarmId] = useState<string | null>(getStoredCurrentFarmId);

  const { data, isLoading } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: FARMS_QUERY_KEY,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  const farms = (data?.data ?? []).map(toFarm);

  // Persist current farm to localStorage
  useEffect(() => {
    try {
      if (currentFarmId) localStorage.setItem(CURRENT_FARM_KEY, currentFarmId);
    } catch {
      // Storage unavailable; the choice just won't be remembered
    }
  }, [currentFarmId]);

  const currentFarm = farms.find(f => f.id === currentFarmId) || farms[0] || null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: FARMS_QUERY_KEY });

  const createMutation = useMutation({
    mutationFn: (farm: Omit<Farm, 'id'>) => apiRequest("/api/farms", "POST", toFarmBody(farm)),
    onSuccess: refresh,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Farm> }) =>
      apiRequest(`/api/farms/${id}`, "PUT", toFarmBody(updates)),
    onSuccess: refresh,
  });
  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/farms/${id}/archive`, "POST", {}),
    onSuccess: refresh,
  });

  const switchFarm = (farmId: string) => {
    const farm = farms.find(f => f.id === farmId);
    if (farm) {
      setCurrentFarmId(farmId);
      window.dispatchEvent(new CustomEvent('farm-switched', { detail: { farmId } }));
    }
  };

  const addFarm = (farmData: Omit<Farm, 'id'>) => {
    createMutation.mutate(farmData);
  };

  const updateFarm = (id: string, updates: Partial<Farm>) => {
    updateMutation.mutate({ id, updates });
  };

  const removeFarm = (id: string) => {
    if (farms.length <= 1) {
      return; // Don't allow removing the last farm
    }
    archiveMutation.mutate(id);
    if (currentFarmId === id) {
      setCurrentFarmId(farms.find(f => f.id !== id)?.id || null);
    }
  };

  const value: FarmContextType = {
    farms,
    currentFarm,
    isLoading,
    switchFarm,
    addFarm,
    updateFarm,
    removeFarm,
  };

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm() {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error("useFarm must be used within FarmProvider");
  }
  return context;
}
