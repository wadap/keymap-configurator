export type PhysicalKey = {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  originX: number;
  originY: number;
};

export type KeyboardConfig = {
  id: string;
  name: string;
  rows: number;
  cols: number;
  protocol: number;
  keys: PhysicalKey[];
  layers: number[][];
  layoutWarning: string | null;
  mode: 'sample' | 'device';
};

export type KeyChange = {
  layer: number;
  row: number;
  col: number;
  before: number;
  after: number;
};
export type Snapshot = {
  version: 1;
  id: string;
  createdAt: string;
  before: KeyboardConfig;
  change: KeyChange;
  status: 'prepared' | 'applied' | 'uncertain' | 'restored';
};
export interface Transport {
  request(bytes: number[]): Promise<Uint8Array>;
}
export interface TransactionIO {
  read(): Promise<KeyboardConfig>;
  write(config: KeyboardConfig, change: KeyChange): Promise<void>;
  save(snapshot: Snapshot): void;
}
