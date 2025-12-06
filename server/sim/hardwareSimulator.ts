import { HardwareStatus, BailStatus, DraftDirection, EidEvent } from "../types/hardware";

const SIM_TICK_MS = 300;
const SIM_EID_INTERVAL_MS = 2000;
const SIM_DRAFT_INTERVAL_MS = 5000;

let simStatus: HardwareStatus = {
  b1: { actual: 0, target: 0, state: 0 },
  b2: { actual: 0, target: 0, state: 0 },
};

let eidBuffer: EidEvent[] = [];
let lastDraft: { direction: DraftDirection; at: string } | null = null;

const EID_POOL: string[] = [
  "982123456789012",
  "982123456789013",
  "982123456789014",
  "982123456789015",
];

function nowIso() {
  return new Date().toISOString();
}

function simulateTick() {
  const bump = (b?: BailStatus) => {
    if (!b) return;
    if (b.state === 1 && b.actual < b.target) {
      b.actual += 5;
      if (b.actual >= b.target) {
        b.actual = b.target;
        b.state = 2;
      }
    }
  };
  bump(simStatus.b1);
  bump(simStatus.b2);
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function simGetStatus(): HardwareStatus {
  return simStatus;
}

export function simStartFeed(bail: number, grams: number) {
  const target = Math.max(grams, 0);
  const key = bail === 2 ? "b2" : "b1";
  const b = simStatus[key] ?? { actual: 0, target: 0, state: 0 };
  b.actual = 0;
  b.target = target;
  b.state = 1;
  simStatus[key] = b;
  return { ok: true, sim: true };
}

export function simStopFeed(bail: number) {
  const key = bail === 2 ? "b2" : "b1";
  const b = simStatus[key];
  if (b) {
    b.state = 0;
    b.target = 0;
    b.actual = 0;
  }
  return { ok: true, sim: true };
}

export function simGetHealth() {
  return { ok: true, sim: true };
}

export function simGetRecentEids(): EidEvent[] {
  return eidBuffer;
}

export function simExecuteDraft(direction: DraftDirection) {
  lastDraft = { direction, at: nowIso() };
  return { ok: true, sim: true, lastDraft };
}

export function simGetLastDraft() {
  return lastDraft;
}

export function startHardwareSimulator() {
  // status tick
  setInterval(simulateTick, SIM_TICK_MS);

  // EID events
  setInterval(() => {
    const eid = randomFrom(EID_POOL);
    const evt: EidEvent = { eid, timestamp: nowIso() };
    eidBuffer.unshift(evt);
    if (eidBuffer.length > 200) eidBuffer.pop();
  }, SIM_EID_INTERVAL_MS);

  // sample draft noise
  setInterval(() => {
    const dirs: DraftDirection[] = ["left", "right", "straight"];
    lastDraft = { direction: randomFrom(dirs), at: nowIso() };
  }, SIM_DRAFT_INTERVAL_MS);

  // eslint-disable-next-line no-console
  console.log("[SIM] Hardware simulator started");
}
