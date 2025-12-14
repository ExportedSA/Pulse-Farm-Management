import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

export interface Farm {
  id: string;
  name: string;
  location?: string;
  size?: number;
  sizeUnit?: string;
  type?: string;
  color?: string;
  isDefault?: boolean;
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

const STORAGE_KEY = "pulse_farms";
const CURRENT_FARM_KEY = "pulse_current_farm";

// Default farms for demo
const DEFAULT_FARMS: Farm[] = [
  {
    id: "farm-1",
    name: "Pulse Farm Management",
    location: "Waikato, New Zealand",
    size: 450,
    sizeUnit: "ha",
    type: "Dairy",
    color: "#1a3a2f",
    isDefault: true,
  },
];

function getStoredFarms(): Farm[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_FARMS;
  } catch {
    return DEFAULT_FARMS;
  }
}

function getStoredCurrentFarmId(): string | null {
  try {
    return localStorage.getItem(CURRENT_FARM_KEY);
  } catch {
    return null;
  }
}

export function FarmProvider({ children }: { children: ReactNode }) {
  const [farms, setFarms] = useState<Farm[]>(getStoredFarms);
  const [currentFarmId, setCurrentFarmId] = useState<string | null>(
    getStoredCurrentFarmId() || (getStoredFarms()[0]?.id ?? null)
  );

  // Persist farms to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(farms));
  }, [farms]);

  // Persist current farm to localStorage
  useEffect(() => {
    if (currentFarmId) {
      localStorage.setItem(CURRENT_FARM_KEY, currentFarmId);
    }
  }, [currentFarmId]);

  const currentFarm = farms.find(f => f.id === currentFarmId) || farms[0] || null;

  const switchFarm = (farmId: string) => {
    const farm = farms.find(f => f.id === farmId);
    if (farm) {
      setCurrentFarmId(farmId);
      // Optionally trigger a page reload or data refresh here
      window.dispatchEvent(new CustomEvent('farm-switched', { detail: { farmId } }));
    }
  };

  const addFarm = (farmData: Omit<Farm, 'id'>) => {
    const newFarm: Farm = {
      ...farmData,
      id: `farm-${Date.now()}`,
    };
    setFarms(prev => [...prev, newFarm]);
    return newFarm;
  };

  const updateFarm = (id: string, updates: Partial<Farm>) => {
    setFarms(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFarm = (id: string) => {
    if (farms.length <= 1) {
      return; // Don't allow removing the last farm
    }
    setFarms(prev => prev.filter(f => f.id !== id));
    if (currentFarmId === id) {
      setCurrentFarmId(farms.find(f => f.id !== id)?.id || null);
    }
  };

  const value: FarmContextType = {
    farms,
    currentFarm,
    isLoading: false,
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
