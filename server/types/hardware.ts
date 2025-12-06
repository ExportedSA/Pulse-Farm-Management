export type BailStatus = {
  actual: number;
  target: number;
  state: number; // 0=IDLE,1=FEEDING,2=DONE,3=JAM
};

export type HardwareStatus = {
  b1?: BailStatus;
  b2?: BailStatus;
};

export type DraftDirection = "left" | "right" | "straight";

export type EidEvent = {
  eid: string;
  timestamp: string;
};
