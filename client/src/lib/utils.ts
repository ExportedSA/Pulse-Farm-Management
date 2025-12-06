import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { RecordItem, Product } from "@shared/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const uid = () => Math.random().toString(36).slice(2, 11);

export const today = () => new Date().toISOString().slice(0, 10);

export const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const startOfDay = (d = new Date()) => 
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const load = <T,>(key: string, def: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return def;
    return JSON.parse(raw) as T;
  } catch {
    return def;
  }
};

export const save = (key: string, value: any) => 
  localStorage.setItem(key, JSON.stringify(value));

export function daysUntil(dateStr?: string) {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  const now = startOfDay();
  const tgt = startOfDay(new Date(d));
  const diff = Math.ceil((tgt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function download(filename: string, content: string, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function toCSV(records: RecordItem[]) {
  const header = [
    "id", "productName", "batchNo", "expiryDate", "useByDate", 
    "dateOpened", "openedBy", "emptiedDate", "notes"
  ];
  const rows = records.map((r) =>
    [
      r.id, r.productName, r.batchNo, r.expiryDate ?? "", r.useByDate ?? "",
      r.dateOpened, r.openedBy ?? "", r.emptiedDate ?? "",
      (r.notes ?? "").replaceAll("\n", " ")
    ]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`)
      .join(",")
  );
  return [header.join(","), ...rows].join("\n");
}

export function parseCSV(text: string): RecordItem[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(",").map((h) => h.replace(/^\"|\"$/g, ""));
  const idx = (k: string) => header.indexOf(k);
  const out: RecordItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/"(?:[^"]|"")*"|[^,]+/g) || [];
    const cell = (n: number) => 
      (cols[n]?.replace(/^\"|\"$/g, "").replaceAll('""', '"') ?? "");
    const dateO = cell(idx("dateOpened"));
    out.push({
      id: cell(idx("id")) || uid(),
      productName: cell(idx("productName")),
      batchNo: cell(idx("batchNo")),
      expiryDate: cell(idx("expiryDate")) || undefined,
      useByDate: cell(idx("useByDate")) || undefined,
      dateOpened: dateO ? new Date(dateO).toISOString() : new Date().toISOString(),
      openedBy: cell(idx("openedBy")) || undefined,
      emptiedDate: cell(idx("emptiedDate")) || undefined,
      notes: cell(idx("notes")) || undefined,
    });
  }
  return out;
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

export async function showLocalNotification(title: string, options?: NotificationOptions) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg && reg.showNotification) {
      await reg.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch (e) {
    console.warn("notify fail", e);
  }
}

export function getStatusBadge(record: RecordItem, products: Product[], leadExpiryDays = 7, leadUseByDays = 7) {
  if (record.emptiedDate) {
    return { variant: "secondary" as const, label: "Emptied", icon: "check" };
  }

  const expIn = daysUntil(record.expiryDate);
  const useIn = daysUntil(record.useByDate);

  if (expIn !== undefined && expIn < 0) {
    return { variant: "destructive" as const, label: "Expired", icon: "alert" };
  }

  if (useIn !== undefined && useIn < 0) {
    return { variant: "destructive" as const, label: "Past Use-By", icon: "alert" };
  }

  if (useIn !== undefined && useIn <= leadUseByDays) {
    return { variant: "default" as const, label: `Use-by ${useIn}d`, icon: "bell" };
  }

  if (expIn !== undefined && expIn <= leadExpiryDays) {
    return { variant: "default" as const, label: `Expires ${expIn}d`, icon: "bell" };
  }

  return { variant: "outline" as const, label: "Active", icon: "check" };
}
