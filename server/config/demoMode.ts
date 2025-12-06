const initial = process.env.PULSE_SIM_MODE === "1";

let demoMode = initial;

export function isDemoMode(): boolean {
  return demoMode;
}

export function setDemoMode(value: boolean): void {
  demoMode = value;
}
