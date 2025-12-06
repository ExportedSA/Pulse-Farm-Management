import { useEffect, useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, MonitorDown, Bell, BellRing, CloudOff, CheckCircle, Settings, Filter, Plus, Package, AlertCircle, Menu, Syringe, Clock, Home as HomeIcon } from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";
import AddRecordForm from "@/components/AddRecordForm";
import StockList from "@/components/StockList";
import ProductManagement from "@/components/ProductManagement";
import UserManagement from "@/components/UserManagement";
import ConditionManagement from "@/components/ConditionManagement";
import SettingsPanel from "@/components/SettingsPanel";
import AlertsList from "@/components/AlertsList";
import TreatmentPanel from "@/components/TreatmentPanel";
import AnimalTreatmentForm from "@/components/AnimalTreatmentForm";
import CurrentTreatments from "@/components/CurrentTreatments";
import CompletedTreatments from "@/components/CompletedTreatments";
import Alerts from "@/pages/alerts";
import { uid, load, save, today, toCSV, parseCSV, download, requestNotificationPermission, showLocalNotification, addDays, daysUntil } from "@/lib/utils";
import type { RecordItem, Product, User, ReminderSettings, Condition, AnimalTreatment, InsertAnimalTreatment } from "@shared/schema";

export type TreatmentPhase = 'awaiting' | 'treatment' | 'withholding' | 'monitoring' | 'returnToVat';

export const getTreatmentPhase = (treatment: AnimalTreatment): TreatmentPhase => {
  if (treatment.awaitingTreatment) return 'awaiting';
  if (treatment.monitoring) {
    const monitoringEnd = treatment.monitoringEndDate;
    const daysRemaining = daysUntil(monitoringEnd);
    if (monitoringEnd && daysRemaining !== undefined && daysRemaining <= 0) {
      return 'returnToVat';
    }
    return 'monitoring';
  }
  
  const dosesGiven = treatment.dosesGiven || 0;
  const totalDoses = treatment.totalDoses || 1;
  
  if (dosesGiven < totalDoses) return 'treatment';
  
  const withdrawalEnd = treatment.milkWithdrawalEndDate;
  const withdrawalDays = daysUntil(withdrawalEnd);
  if (withdrawalEnd && withdrawalDays !== undefined && withdrawalDays > 0) {
    return 'withholding';
  }
  
  return 'returnToVat';
};

export default function Home() {
  const params = useParams<{ section?: string }>();
  const [, setLocation] = useLocation();
  const section = params.section || 'treatments';

  const [records, setRecords] = useState<RecordItem[]>(() => load("dairy_records", [] as RecordItem[]));
  const [products, setProducts] = useState<Product[]>(() =>
    load("dairy_products", [
      { id: uid(), name: "Metacam 100 ml", withdrawalDays: 10, treatmentPlan: "1 ml per 45 kg body weight, subcutaneous injection, once daily for 3-5 days" },
      { id: uid(), name: "Penicillin LA 250 ml", withdrawalDays: 4, treatmentPlan: "1 ml per 25 kg body weight, intramuscular injection, repeat after 48 hours if required" },
      { id: uid(), name: "Oxytetracycline LA 100 ml", withdrawalDays: 7, treatmentPlan: "1 ml per 10 kg body weight, deep intramuscular injection, single dose or repeat after 72 hours" },
      { id: uid(), name: "Flunixin 100 ml", withdrawalDays: 4, treatmentPlan: "2.2 mg/kg (2 ml per 45 kg), intravenous injection, once daily for up to 3 days" },
      { id: uid(), name: "Ketol 500 ml", withdrawalDays: 0, treatmentPlan: "Drench 250-500 ml orally, administer after calving or at first signs of milk fever" },
    ] as Product[])
  );
  const [users, setUsers] = useState<User[]>(() =>
    load("dairy_users", [
      { id: uid(), name: "Mark" },
      { id: uid(), name: "Bella" },
      { id: uid(), name: "Staff" },
    ] as User[])
  );
  const [settings, setSettings] = useState<ReminderSettings>(() =>
    load("dairy_settings", {
      enabled: false,
      leadExpiryDays: 7,
      leadUseByDays: 7,
      dailySummaryHour: 7,
      treatmentAlertBufferHours: 0.5,
    } as ReminderSettings)
  );
  const [conditions, setConditions] = useState<Condition[]>(() =>
    load("dairy_conditions", [
      { id: uid(), name: "Mastitis", requiresBodyPart: true, bodyPartType: 'udder' },
      { id: uid(), name: "Lameness", requiresBodyPart: true, bodyPartType: 'foot' },
      { id: uid(), name: "Milk Fever", requiresBodyPart: false },
      { id: uid(), name: "Retained Membrane", requiresBodyPart: false },
      { id: uid(), name: "Injury / Abscess", requiresBodyPart: false },
    ] as Condition[])
  );
  const [animalTreatments, setAnimalTreatments] = useState<AnimalTreatment[]>(() =>
    load("dairy_animal_treatments", [] as AnimalTreatment[])
  );

  // Fetch products from backend API and cache to localStorage for offline fallback
  const { data: apiProducts } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  // Fetch conditions from backend API and cache to localStorage for offline fallback
  const { data: apiConditions } = useQuery<Condition[]>({
    queryKey: ['/api/conditions'],
  });

  // Fetch users from backend API and cache to localStorage for offline fallback
  const { data: apiUsers } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Sync API data to state when loaded (localStorage save happens in useEffect below)
  useEffect(() => {
    if (apiProducts) {
      setProducts(apiProducts);
    }
  }, [apiProducts]);

  useEffect(() => {
    if (apiConditions) {
      setConditions(apiConditions);
    }
  }, [apiConditions]);

  useEffect(() => {
    if (apiUsers) {
      setUsers(apiUsers);
    }
  }, [apiUsers]);

  // Mutations for creating/updating/deleting products
  const addProductMutation = useMutation({
    mutationFn: (product: { name: string; withdrawalDays?: number; milkWithdrawalDays?: number; meatWithdrawalDays?: number; useByDays?: number; treatmentPlan?: string; barcode?: string }) =>
      apiRequest('/api/products', { method: 'POST', body: product }),
    onMutate: async (product) => {
      // Capture snapshot and optimistically update local state
      let previousProducts: Product[] = [];
      const tempProduct: Product = {
        ...product,
        id: uid(),
        createdAt: new Date(new Date().toISOString()) as any, // Store as Date but from ISO string
        updatedAt: new Date(new Date().toISOString()) as any,
        deletedAt: null,
        withdrawalDays: product.withdrawalDays ?? null,
        milkWithdrawalDays: product.milkWithdrawalDays ?? null,
        meatWithdrawalDays: product.meatWithdrawalDays ?? null,
        useByDays: product.useByDays ?? null,
        treatmentPlan: product.treatmentPlan ?? null,
        barcode: product.barcode ?? null,
        stockQuantity: null,
        stockExpiryDate: null,
      };
      setProducts((ps) => {
        previousProducts = [...ps];
        return [...ps, tempProduct];
      });
      return { previousProducts };
    },
    onSuccess: (response) => {
      // Only invalidate on true success (not 202 queued)
      const isQueued = response?.status === 202;
      if (!isQueued) {
        queryClient.invalidateQueries({ queryKey: ['/api/products'] });
        toast.success('Product added');
      } else {
        toast.success('Product queued - will sync when online');
      }
    },
    onError: (_error, _variables, context) => {
      // Roll back optimistic update only on true errors
      if (context?.previousProducts) {
        setProducts(context.previousProducts);
      }
      toast.error('Failed to add product');
    }
  });

  const addUserMutation = useMutation({
    mutationFn: (userData: { name: string }) =>
      apiRequest('/api/users', { method: 'POST', body: userData }),
    onMutate: async (userData) => {
      // Capture snapshot and optimistically update local state
      let previousUsers: User[] = [];
      const tempUser: User = {
        id: uid(),
        name: userData.name,
        createdAt: new Date(new Date().toISOString()) as any,
        updatedAt: new Date(new Date().toISOString()) as any,
        role: null,
        email: null,
        passwordHash: null,
      };
      setUsers((us) => {
        previousUsers = [...us];
        return [...us, tempUser];
      });
      return { previousUsers };
    },
    onSuccess: (response) => {
      const isQueued = response?.status === 202;
      if (!isQueued) {
        queryClient.invalidateQueries({ queryKey: ['/api/users'] });
        toast.success('Staff member added');
      } else {
        toast.success('Staff member queued - will sync when online');
      }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousUsers) {
        setUsers(context.previousUsers);
      }
      toast.error('Failed to add staff member');
    }
  });

  const addConditionMutation = useMutation({
    mutationFn: (condition: { name: string; requiresBodyPart?: boolean; bodyPartType?: 'udder' | 'foot' }) =>
      apiRequest('/api/conditions', { method: 'POST', body: condition }),
    onMutate: async (condition) => {
      // Capture snapshot and optimistically update local state
      let previousConditions: Condition[] = [];
      const tempCondition: Condition = {
        ...condition,
        id: uid(),
        createdAt: new Date(new Date().toISOString()) as any,
        updatedAt: new Date(new Date().toISOString()) as any,
        requiresBodyPart: condition.requiresBodyPart ?? null,
        bodyPartType: condition.bodyPartType ?? null,
      };
      setConditions((cs) => {
        previousConditions = [...cs];
        return [...cs, tempCondition];
      });
      return { previousConditions };
    },
    onSuccess: (response) => {
      const isQueued = response?.status === 202;
      if (!isQueued) {
        queryClient.invalidateQueries({ queryKey: ['/api/conditions'] });
        toast.success('Condition added');
      } else {
        toast.success('Condition queued - will sync when online');
      }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousConditions) {
        setConditions(context.previousConditions);
      }
      toast.error('Failed to add condition');
    }
  });

  const [showScanner, setShowScanner] = useState(false);
  const [filterOpenOnly, setFilterOpenOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => save("dairy_records", records), [records]);
  useEffect(() => save("dairy_products", products), [products]);
  useEffect(() => save("dairy_users", users), [users]);
  useEffect(() => save("dairy_settings", settings), [settings]);
  useEffect(() => save("dairy_conditions", conditions), [conditions]);
  useEffect(() => save("dairy_animal_treatments", animalTreatments), [animalTreatments]);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!settings.enabled) return;
    runReminderCheck("boot");
    const id = setInterval(() => runReminderCheck("interval"), 6 * 60 * 60 * 1000);
    const hourly = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      const lastSum = load<string | null>("dairy_last_summary_date", null);
      const todayStr = today();
      if (hour === settings.dailySummaryHour && lastSum !== todayStr) {
        runReminderCheck("daily-summary");
        save("dairy_last_summary_date", todayStr);
      }
    }, 60 * 1000 * 5);
    return () => {
      clearInterval(id);
      clearInterval(hourly);
    };
  }, [settings.enabled, settings.leadExpiryDays, settings.leadUseByDays, settings.dailySummaryHour, records, products]);

  function buildReminderItems() {
    const items: { kind: "expiry" | "useby" | "withhold"; r: RecordItem; msg: string }[] = [];
    for (const r of records) {
      if (r.emptiedDate) continue;
      const expIn = daysUntil(r.expiryDate);
      const useIn = daysUntil(r.useByDate);
      const product = products.find((p) => p.name === r.productName);
      const wd = product?.withdrawalDays ?? 0;
      const withholdUntil = wd && r.dateOpened ? addDays(r.dateOpened.slice(0, 10), wd) : undefined;
      const withholdDays = withholdUntil ? daysUntil(withholdUntil) : undefined;

      if (expIn !== undefined && expIn <= settings.leadExpiryDays) {
        items.push({
          kind: "expiry",
          r,
          msg: `${r.productName} (batch ${r.batchNo}) expires in ${expIn} day(s)`,
        });
      }
      if (useIn !== undefined && useIn <= settings.leadUseByDays) {
        items.push({
          kind: "useby",
          r,
          msg: `${r.productName} (batch ${r.batchNo}) use-by in ${useIn} day(s)`,
        });
      }
      if (withholdDays !== undefined && withholdDays >= 0) {
        items.push({
          kind: "withhold",
          r,
          msg: `${r.productName} withholding in effect until ${withholdUntil}`,
        });
      }
    }
    return items;
  }

  async function runReminderCheck(source: "boot" | "interval" | "daily-summary") {
    if (!settings.enabled) return;
    const permitted = await requestNotificationPermission();
    if (!permitted) return;

    const items = buildReminderItems();
    if (!items.length) return;

    const key = `dairy_notified_${today()}`;
    const notifiedIds = new Set<string>(load<string[]>(key, []));

    if (source === "daily-summary") {
      await showLocalNotification("Dairy Stock Summary", {
        body:
          items
            .slice(0, 4)
            .map((i) => `• ${i.msg}`)
            .join("\n") + (items.length > 4 ? `\n• +${items.length - 4} more…` : ""),
        tag: "dairy-summary",
      });
      return;
    }

    for (const it of items) {
      if (notifiedIds.has(it.r.id + it.kind)) continue;
      await showLocalNotification("Dairy Stock Alert", {
        body: it.msg,
        tag: `${it.r.id}-${it.kind}`,
      });
      notifiedIds.add(it.r.id + it.kind);
    }
    save(key, Array.from(notifiedIds));
  }

  const handleScan = (code: string) => {
    const mapped = products.find((p) => p.barcode && p.barcode === code);
    if (mapped) {
      toast.success(`Barcode mapped to ${mapped.name}`);
    }
    toast.success("Barcode captured");
  };

  const addRecord = (record: Omit<RecordItem, "id" | "emptiedDate">) => {
    const item: RecordItem = {
      ...record,
      id: uid(),
      dateOpened: record.dateOpened ? new Date(record.dateOpened).toISOString() : new Date().toISOString(),
    };
    setRecords((r) => [item, ...r]);
    toast.success("Record added");
  };

  const saveBarcode = (productName: string, batchNo: string) => {
    if (!productName) {
      toast.error("Product name required");
      return;
    }
    if (!batchNo) {
      toast.error("Batch number required for barcode mapping");
      return;
    }
    setProducts((ps) => {
      const idx = ps.findIndex((p) => p.name === productName);
      if (idx >= 0) {
        const updated = [...ps];
        updated[idx] = { ...updated[idx], barcode: batchNo };
        toast.success("Barcode mapping saved");
        return updated;
      } else {
        const np: Product = { 
          id: uid(), 
          name: productName, 
          barcode: batchNo,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          withdrawalDays: null,
          milkWithdrawalDays: null,
          meatWithdrawalDays: null,
          useByDays: null,
          treatmentPlan: null,
          stockQuantity: null,
          stockExpiryDate: null,
        };
        toast.success("New product added with barcode");
        return [...ps, np];
      }
    });
  };

  const markEmptied = (id: string) => {
    setRecords((r) => r.map((x) => (x.id === id ? { ...x, emptiedDate: today() } : x)));
    toast.success("Marked as emptied");
  };

  const removeRecord = (id: string) => {
    setRecords((r) => r.filter((x) => x.id !== id));
    toast.success("Record deleted");
  };

  const addProduct = (product: { name: string; withdrawalDays?: number; milkWithdrawalDays?: number; meatWithdrawalDays?: number; useByDays?: number; treatmentPlan?: string; barcode?: string }) => {
    addProductMutation.mutate(product);
  };

  const updateProduct = (id: string, product: { name: string; withdrawalDays?: number; milkWithdrawalDays?: number; meatWithdrawalDays?: number; useByDays?: number; treatmentPlan?: string; barcode?: string }) => {
    setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, ...product } : p)));
    toast.success("Product updated");
  };

  const removeProduct = (id: string) => {
    setProducts((ps) => ps.filter((p) => p.id !== id));
    toast.success("Product removed");
  };

  const addUser = (name: string) => {
    addUserMutation.mutate({ name });
  };

  const updateUser = (id: string, name: string) => {
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, name } : u)));
    toast.success("Staff member updated");
  };

  const removeUser = (id: string) => {
    setUsers((us) => us.filter((u) => u.id !== id));
    toast.success("Staff member removed");
  };

  const addAnimalTreatment = async (treatment: InsertAnimalTreatment & { id?: string }) => {
    // If updating an existing treatment (has ID), update it instead of creating new
    if (treatment.id && selectedTreatmentForEdit) {
      const product = treatment.productId 
        ? products.find(p => p.id === treatment.productId)
        : products.find(p => p.name === treatment.treatmentType);
      const milkWithdrawalDays = product?.milkWithdrawalDays ?? product?.withdrawalDays ?? 0;
      const totalDoses = treatment.totalDoses || 1;
      const lastDoseDate = treatment.dateTime?.slice(0, 10);
      const milkWithdrawalEndDate = milkWithdrawalDays > 0 && lastDoseDate
        ? addDays(lastDoseDate, milkWithdrawalDays)
        : undefined;

      setAnimalTreatments((treatments) =>
        treatments.map((t) => {
          if (t.id === treatment.id) {
            return {
              ...t,
              ...treatment,
              awaitingTreatment: false,
              dosesGiven: 0,
              totalDoses,
              productId: product?.id,
              milkWithdrawalDays,
              milkWithdrawalEndDate,
              lastDoseDate,
            };
          }
          return t;
        })
      );
      
      setSelectedTreatmentForEdit(null);
      setActiveTab("treatment-current");
      toast.success("Treatment plan added - cow moved to treatment list");
      return;
    }

    if (treatment.awaitingTreatment) {
      const item: AnimalTreatment = {
        ...treatment,
        id: uid(),
        status: 'active' as const,
        condition: treatment.condition || '',
        bodyPart: treatment.bodyPart || undefined,
        treatmentType: '',
        treatmentPlan: '',
        awaitingTreatment: true,
      };
      setAnimalTreatments((t) => [item, ...t]);
      toast.success("Cow added to awaiting treatment list");
      return;
    }

    if (treatment.monitoring && treatment.monitoringDays) {
      const monitoringStart = treatment.dateTime.slice(0, 10);
      const monitoringEnd = addDays(monitoringStart, treatment.monitoringDays);
      const item: AnimalTreatment = {
        ...treatment,
        id: uid(),
        status: 'active' as const,
        condition: treatment.condition || '',
        treatmentType: treatment.treatmentType || '',
        treatmentPlan: treatment.treatmentPlan || '',
        monitoring: true,
        monitoringStartDate: monitoringStart,
        monitoringEndDate: monitoringEnd,
      };
      setAnimalTreatments((t) => [item, ...t]);
      toast.success("Cow added to monitoring");
      return;
    }
    
    // Regular treatment creation - persist to backend API when online
    const product = treatment.productId 
      ? products.find(p => p.id === treatment.productId)
      : products.find(p => p.name === treatment.treatmentType);
    const milkWithdrawalDays = product?.milkWithdrawalDays ?? product?.withdrawalDays ?? 0;
    const totalDoses = treatment.totalDoses || 1;
    
    try {
      // Attempt to post to backend API (Service Worker handles offline queueing)
      const response = await fetch('/api/treatments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(treatment),
      });
      
      if (response.status === 202) {
        // Offline - queued by Service Worker for background sync
        const result = await response.json();
        if (result.queued) {
          const item: AnimalTreatment = {
            ...treatment,
            id: uid(), // Temporary local ID until sync completes
            status: 'active' as const,
            condition: treatment.condition || '',
            treatmentType: treatment.treatmentType || '',
            treatmentPlan: treatment.treatmentPlan || '',
            productId: product?.id,
            dosesGiven: 0,
            totalDoses,
            milkWithdrawalDays,
            milkWithdrawalEndDate: milkWithdrawalDays > 0 ? addDays(treatment.dateTime.slice(0, 10), milkWithdrawalDays) : undefined,
          };
          setAnimalTreatments((t) => [item, ...t]);
          toast.success("Treatment queued for sync when online");
          return;
        }
      }
      
      if (!response.ok) {
        // Server error (4xx/5xx) - surface error to user
        const error = await response.json().catch(() => ({ error: 'Failed to create treatment' }));
        toast.error(error.error || 'Failed to create treatment');
        console.error('Treatment creation failed:', response.status, error);
        return;
      }
      
      // Success (2xx) - use backend response with authoritative ID and lifecycle event
      const apiTreatment = await response.json();
      const enrichedTreatment: AnimalTreatment = {
        ...apiTreatment,
        status: 'active' as const,
        dosesGiven: 0,
        totalDoses,
        milkWithdrawalDays,
        milkWithdrawalEndDate: milkWithdrawalDays > 0 ? addDays(apiTreatment.administeredDate || apiTreatment.dateTime?.slice(0, 10) || treatment.dateTime.slice(0, 10), milkWithdrawalDays) : undefined,
      };
      setAnimalTreatments((t) => [enrichedTreatment, ...t]);
      toast.success("Treatment recorded");
    } catch (error: any) {
      // Network error - fallback to local storage with error toast
      console.error('Network error creating treatment:', error);
      const item: AnimalTreatment = {
        ...treatment,
        id: uid(),
        status: 'active' as const,
        condition: treatment.condition || '',
        treatmentType: treatment.treatmentType || '',
        treatmentPlan: treatment.treatmentPlan || '',
        productId: product?.id,
        dosesGiven: 0,
        totalDoses,
        milkWithdrawalDays,
        milkWithdrawalEndDate: milkWithdrawalDays > 0 ? addDays(treatment.dateTime.slice(0, 10), milkWithdrawalDays) : undefined,
      };
      setAnimalTreatments((t) => [item, ...t]);
      toast.error("Network error - treatment saved locally");
    }
  };

  const administerDose = (treatmentId: string) => {
    let administered = false;
    setAnimalTreatments((treatments) =>
      treatments.map((t) => {
        if (t.id === treatmentId) {
          const dosesGiven = t.dosesGiven || 0;
          const totalDoses = t.totalDoses || 1;
          
          if (dosesGiven >= totalDoses) {
            toast.warning("All doses already administered");
            return t;
          }
          
          administered = true;
          return {
            ...t,
            dosesGiven: dosesGiven + 1,
            lastDoseDate: new Date().toISOString(),
          };
        }
        return t;
      })
    );
    if (administered) {
      toast.success("Dose administered");
    }
  };

  const retreatCow = (treatmentId: string, reason: string) => {
    const oldTreatment = animalTreatments.find(t => t.id === treatmentId);
    if (!oldTreatment) return;

    setAnimalTreatments((treatments) =>
      treatments.map((t) => {
        if (t.id === treatmentId) {
          return {
            ...t,
            status: 'completed' as const,
            completedDate: new Date().toISOString(),
            retreatmentReason: reason,
            clinicalNotes: `${t.clinicalNotes || ''}\n\nRetreated: ${reason}`.trim(),
          };
        }
        return t;
      })
    );

    setActiveTab("treatment-entry");
    toast.info(`Previous treatment recorded with retreat reason. Enter new treatment for this cow (remember to note this is a retreat in clinical notes).`);
  };

  const returnToVat = (treatmentId: string) => {
    setAnimalTreatments((treatments) =>
      treatments.map((t) => {
        if (t.id === treatmentId) {
          return {
            ...t,
            status: 'completed' as const,
            completedDate: new Date().toISOString(),
          };
        }
        return t;
      })
    );
    toast.success("Cow returned to milking mob");
  };

  const returnToHerd = (treatmentId: string, notes: string) => {
    const trimmedNotes = notes.trim();
    if (!trimmedNotes) {
      toast.error("Observation notes are required");
      return;
    }
    
    setAnimalTreatments((treatments) =>
      treatments.map((t) => {
        if (t.id === treatmentId) {
          return {
            ...t,
            status: 'completed' as const,
            completedDate: new Date().toISOString(),
            returnedToHerd: true,
            returnToHerdNotes: trimmedNotes,
            awaitingTreatment: false,
            treatmentType: '',
            treatmentPlan: '',
            productId: undefined,
            dosesGiven: 0,
            totalDoses: undefined,
            lastDoseDate: undefined,
            milkWithdrawalDays: undefined,
            milkWithdrawalEndDate: undefined,
            monitoring: false,
            monitoringDays: undefined,
            monitoringStartDate: undefined,
            monitoringEndDate: undefined,
          };
        }
        return t;
      })
    );
    toast.success("Cow returned to herd");
  };

  const resumeTreatment = (treatmentId: string) => {
    const treatment = animalTreatments.find(t => t.id === treatmentId);
    if (!treatment) {
      toast.error("Treatment not found");
      return;
    }

    // If the treatment is awaiting (no treatment plan yet), navigate to entry form to add treatment
    if (treatment.awaitingTreatment) {
      setSelectedTreatmentForEdit(treatment);
      setActiveTab("treatment");
      return;
    }

    // For monitoring treatments, convert to active treatment
    setAnimalTreatments((treatments) =>
      treatments.map((t) => {
        if (t.id === treatmentId) {
          if (t.monitoring) {
            return {
              ...t,
              monitoring: false,
              dosesGiven: 0,
              clinicalNotes: `${t.clinicalNotes || ''}\n\nConverted from monitoring to active treatment`.trim(),
            };
          }
          return {
            ...t,
            awaitingTreatment: false,
          };
        }
        return t;
      })
    );
    
    if (treatment.monitoring) {
      toast.success("Cow moved from monitoring to active treatment");
    } else {
      toast.success("Ready to complete treatment plan");
    }
  };

  const startMonitoring = (treatmentId: string, days: number) => {
    if (!days || days < 1) {
      toast.error("Monitoring days must be at least 1");
      return;
    }

    const treatment = animalTreatments.find(t => t.id === treatmentId);
    if (!treatment) {
      toast.error("Treatment not found");
      return;
    }

    const monitoringStart = treatment.dateTime.slice(0, 10);
    const monitoringEnd = addDays(monitoringStart, days);
    
    setAnimalTreatments((treatments) =>
      treatments.map((t) => {
        if (t.id === treatmentId) {
          return {
            ...t,
            monitoring: true,
            monitoringDays: days,
            monitoringStartDate: monitoringStart,
            monitoringEndDate: monitoringEnd,
            awaitingTreatment: false,
            clinicalNotes: `${t.clinicalNotes || ''}\n\nMonitoring started: ${days} days until ${monitoringEnd}`.trim(),
          };
        }
        return t;
      })
    );
    toast.success(`Cow added to monitoring for ${days} days`);
  };

  const completeMonitoring = (treatmentId: string) => {
    const treatment = animalTreatments.find(t => t.id === treatmentId);
    if (!treatment) {
      toast.error("Treatment not found");
      return;
    }

    setAnimalTreatments((treatments) =>
      treatments.map((t) => {
        if (t.id === treatmentId) {
          return {
            ...t,
            status: 'completed' as const,
            completedDate: new Date().toISOString(),
            monitoring: false,
            clinicalNotes: `${t.clinicalNotes || ''}\n\nMonitoring completed: ${t.monitoringDays || 0} days, returned to milking mob`.trim(),
          };
        }
        return t;
      })
    );
    toast.success("Monitoring completed, cow returned to milking mob");
  };

  const addCondition = (condition: { name: string; requiresBodyPart?: boolean; bodyPartType?: 'udder' | 'foot' }) => {
    addConditionMutation.mutate(condition);
  };

  const updateCondition = (id: string, condition: { name: string; requiresBodyPart?: boolean; bodyPartType?: 'udder' | 'foot' }) => {
    setConditions((cs) => cs.map((c) => (c.id === id ? { ...c, ...condition } : c)));
    toast.success("Condition updated");
  };

  const removeCondition = (id: string) => {
    setConditions((cs) => cs.filter((c) => c.id !== id));
    toast.success("Condition removed");
  };

  const exportCSV = () => {
    download(`dairy-treatment-records-${today()}.csv`, toCSV(records));
    toast.success("CSV exported");
  };

  const importCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = parseCSV(String(reader.result));
        setRecords((r) => [...incoming, ...r]);
        toast.success(`Imported ${incoming.length} rows`);
      } catch (e) {
        console.error(e);
        toast.error("Import failed");
      }
    };
    reader.readAsText(file);
  };

  const pwaInstall = async () => {
    if (!installPrompt) {
      toast.info("Install prompt not available yet");
      return;
    }
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") toast.success("App installed");
    setInstallPrompt(null);
  };

  const enableReminders = async () => {
    const ok = await requestNotificationPermission();
    if (!ok) {
      toast.error("Notifications blocked by browser");
      return;
    }
    setSettings((s) => ({ ...s, enabled: true }));
    toast.success("Reminders enabled");
    runReminderCheck("boot");
  };

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filterOpenOnly && r.emptiedDate) return false;
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        r.productName.toLowerCase().includes(q) ||
        r.batchNo.toLowerCase().includes(q) ||
        (r.openedBy || "").toLowerCase().includes(q)
      );
    });
  }, [records, filterOpenOnly, search]);

  // Map section parameter to navigation mode
  const getNavigationMode = (section: string): 'treatments' | 'traceability' => {
    switch (section) {
      case 'traceability':
      case 'medicine':
      case 'stock':
        return 'traceability';
      case 'treatments':
      case 'current':
      case 'alerts':
      default:
        return 'treatments';
    }
  };

  // Map section parameter to activeTab state
  const getSectionTab = (section: string): string => {
    switch (section) {
      // Traceability mode sections
      case 'traceability':
        return 'alerts'; // Medicine alerts for traceability mode
      case 'stock':
        return 'stock';
      case 'medicine':
      case 'entry':
        return 'new'; // Stock entry form
      // Treatments mode sections
      case 'alerts':
        return 'treatment-alerts';
      case 'current':
        return 'treatment-current';
      case 'awaiting':
        return 'treatment-current'; // Awaiting now accessed via phase dropdown in Current view
      case 'treatment':
        return 'treatment';
      case 'history':
        return 'treatment-history';
      case 'manage':
        return 'manage';
      // Default
      case 'treatments':
      default:
        return 'treatment-current'; // Default to current treatments
    }
  };

  const [activeTab, setActiveTab] = useState(() => getSectionTab(section));
  const [showMenu, setShowMenu] = useState(false);
  const [showTraceabilityMenu, setShowTraceabilityMenu] = useState(false);
  const [navigationMode, setNavigationMode] = useState<'treatments' | 'traceability'>(() => getNavigationMode(section));
  const [selectedTreatmentForEdit, setSelectedTreatmentForEdit] = useState<AnimalTreatment | null>(null);

  // Update activeTab and navigationMode when section parameter changes (for direct URL navigation)
  useEffect(() => {
    setActiveTab(getSectionTab(section));
    setNavigationMode(getNavigationMode(section));
  }, [section]);

  // Main layout for tablet-optimized view
  return (
    <div className="h-full flex flex-col">
      <div className="p-6 md:p-8 border-b border-border bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold" data-testid="text-treatments-title">
                {navigationMode === 'treatments' ? 'Animal Treatments' : 'Medicine Traceability'}
              </h1>
              <p className="text-muted-foreground mt-2">
                {navigationMode === 'treatments' 
                  ? 'Track treatment workflows and withholding periods' 
                  : 'Manage medicine inventory and stock records'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!isOnline && (
                <Badge variant="outline" className="gap-2">
                  <CloudOff className="h-4 w-4" />
                  Offline Mode
                </Badge>
              )}
              {settings.enabled && (
                <Badge variant="outline" className="gap-2">
                  <BellRing className="h-4 w-4" />
                  Reminders On
                </Badge>
              )}
            </div>
          </div>
          
          {navigationMode === 'treatments' ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeTab === "treatment-current" ? "default" : "outline"}
                onClick={() => setActiveTab("treatment-current")}
                data-testid="button-tab-current"
                className="h-11"
              >
                <Syringe className="mr-2 h-5 w-5" strokeWidth={1.5} />
                Current Treatments
              </Button>
              <Button
                variant={activeTab === "treatment-alerts" ? "default" : "outline"}
                onClick={() => setActiveTab("treatment-alerts")}
                data-testid="button-tab-alerts"
                className="h-11"
              >
                <AlertCircle className="mr-2 h-5 w-5" strokeWidth={1.5} />
                Alerts
              </Button>
              <Button
                variant={activeTab === "treatment" ? "default" : "outline"}
                onClick={() => setActiveTab("treatment")}
                data-testid="button-tab-entry"
                className="h-11"
              >
                <Plus className="mr-2 h-5 w-5" strokeWidth={1.5} />
                New Treatment
              </Button>
              <Button
                variant={activeTab === "treatment-history" ? "default" : "outline"}
                onClick={() => setActiveTab("treatment-history")}
                data-testid="button-tab-history"
                className="h-11"
              >
                <Clock className="mr-2 h-5 w-5" strokeWidth={1.5} />
                History
              </Button>
              <Button
                variant={activeTab === "manage" ? "default" : "outline"}
                onClick={() => setActiveTab("manage")}
                data-testid="button-tab-manage"
                className="h-11"
              >
                <Settings className="mr-2 h-5 w-5" strokeWidth={1.5} />
                Manage
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeTab === "stock" ? "default" : "outline"}
                onClick={() => setActiveTab("stock")}
                data-testid="button-tab-stock"
                className="h-11"
              >
                <Package className="mr-2 h-5 w-5" strokeWidth={1.5} />
                Stock List
              </Button>
              <Button
                variant={activeTab === "alerts" ? "default" : "outline"}
                onClick={() => setActiveTab("alerts")}
                data-testid="button-tab-stock-alerts"
                className="h-11"
              >
                <AlertCircle className="mr-2 h-5 w-5" strokeWidth={1.5} />
                Alerts
              </Button>
              <Button
                variant={activeTab === "new" ? "default" : "outline"}
                onClick={() => setActiveTab("new")}
                data-testid="button-tab-new-entry"
                className="h-11"
              >
                <Plus className="mr-2 h-5 w-5" strokeWidth={1.5} />
                New Entry
              </Button>
              <Button
                variant={activeTab === "manage" ? "default" : "outline"}
                onClick={() => setActiveTab("manage")}
                data-testid="button-tab-manage-stock"
                className="h-11"
              >
                <Settings className="mr-2 h-5 w-5" strokeWidth={1.5} />
                Manage
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" data-testid="tabs-main">

          <TabsContent value="treatment" className="mt-4">
            <AnimalTreatmentForm
              products={products}
              users={users}
              conditions={conditions}
              onSubmit={addAnimalTreatment}
              prefillTreatment={selectedTreatmentForEdit}
            />
          </TabsContent>

          <TabsContent value="treatment-alerts" className="mt-4">
            <AlertsList records={records} products={products} settings={settings} />
          </TabsContent>

          <TabsContent value="treatment-current" className="mt-4">
            <CurrentTreatments
              treatments={animalTreatments}
              products={products}
              onAdministerDose={administerDose}
              onRetreat={retreatCow}
              onReturnToVat={returnToVat}
              onResumeTreatment={resumeTreatment}
              onStartMonitoring={startMonitoring}
              onCompleteMonitoring={completeMonitoring}
              onReturnToHerd={returnToHerd}
              initialPhase={section === 'awaiting' ? 'awaiting' : 'treatment'}
            />
          </TabsContent>

          <TabsContent value="treatment-entry" className="mt-4">
            <AnimalTreatmentForm
              users={users}
              products={products}
              conditions={conditions}
              onSubmit={addAnimalTreatment}
            />
          </TabsContent>

          <TabsContent value="treatment-history" className="mt-4 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Animal Treatment History</h2>
              <CompletedTreatments treatments={animalTreatments} />
            </div>
            
            <div className="pt-4 border-t">
              <h2 className="text-lg font-semibold mb-4">Medicine Stock History</h2>
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search products, batches, staff..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    data-testid="input-search"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="filter-open-history"
                    checked={filterOpenOnly}
                    onCheckedChange={(checked) => setFilterOpenOnly(checked as boolean)}
                    data-testid="checkbox-filter-open"
                  />
                  <Label htmlFor="filter-open-history" className="cursor-pointer">
                    <Filter className="w-4 h-4 inline mr-1" />
                    Open only
                  </Label>
                </div>
              </div>
              <StockList
                records={filtered}
                products={products}
                onMarkEmptied={markEmptied}
                onRemove={removeRecord}
                leadExpiryDays={settings.leadExpiryDays}
                leadUseByDays={settings.leadUseByDays}
              />
            </div>
          </TabsContent>

          <TabsContent value="treatment-awaiting" className="mt-4">
            <Card data-testid="card-awaiting">
              <CardContent className="p-6">
                <p className="text-muted-foreground text-center">
                  Awaiting treatments feature coming soon...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="new" className="mt-4">
            <AddRecordForm
              products={products}
              users={users}
              onAdd={addRecord}
              onScan={() => setShowScanner(true)}
              onSaveBarcode={saveBarcode}
            />
          </TabsContent>

          <TabsContent value="stock" className="mt-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search products, batches, staff..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="filter-open"
                  checked={filterOpenOnly}
                  onCheckedChange={(checked) => setFilterOpenOnly(checked as boolean)}
                  data-testid="checkbox-filter-open"
                />
                <Label htmlFor="filter-open" className="cursor-pointer">
                  <Filter className="w-4 h-4 inline mr-1" />
                  Open only
                </Label>
              </div>
            </div>
            <StockList
              records={filtered}
              products={products}
              onMarkEmptied={markEmptied}
              onRemove={removeRecord}
              leadExpiryDays={settings.leadExpiryDays}
              leadUseByDays={settings.leadUseByDays}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-4 space-y-6">
            <SettingsPanel settings={settings} onUpdate={setSettings} onEnableReminders={enableReminders} />
            <UserManagement users={users} onAdd={addUser} onUpdate={updateUser} onRemove={removeUser} />
          </TabsContent>

          <TabsContent value="manage-products" className="mt-4 space-y-6">
            <ProductManagement products={products} onAdd={addProduct} onUpdate={updateProduct} onRemove={removeProduct} />
            <ConditionManagement conditions={conditions} onAdd={addCondition} onUpdate={updateCondition} onRemove={removeCondition} />
          </TabsContent>

          <TabsContent value="alerts" className="mt-4">
            <AlertsList records={records} products={products} settings={settings} />
          </TabsContent>

          {/* Full-page Treatment Alerts (accessed from landing page) */}
          <TabsContent value="treatment-alerts-full" className="mt-0 -mx-4 -my-4">
            <Alerts treatments={animalTreatments} settings={settings} />
          </TabsContent>

          {/* Full-page Current Treatments */}
          <TabsContent value="treatment-current-full" className="mt-0 -mx-4">
            <div className="border-b border-border p-3 flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/app/treatments/alerts")}
                data-testid="button-back-to-alerts"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Alerts
              </Button>
              <h1 className="text-lg font-bold">Current Treatments</h1>
              <div className="w-20" />
            </div>
            <div className="px-4">
              <CurrentTreatments
                treatments={animalTreatments}
                products={products}
                onAdministerDose={administerDose}
                onRetreat={retreatCow}
                onReturnToVat={returnToVat}
                onResumeTreatment={resumeTreatment}
                onStartMonitoring={startMonitoring}
                onCompleteMonitoring={completeMonitoring}
                onReturnToHerd={returnToHerd}
              />
            </div>
          </TabsContent>

        </Tabs>
        </div>
      </div>

      {showScanner && (
        <BarcodeScanner onDetected={handleScan} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
