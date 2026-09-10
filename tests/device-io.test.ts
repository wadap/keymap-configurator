import { describe, expect, it } from 'vitest';
import { createDeviceIO } from '../lib/keyboard/device-io';
import { applyChange } from '../lib/keyboard/transactions';
import type {
  KeyboardConfig,
  Snapshot,
  Transport,
} from '../lib/keyboard/types';
import { VialClient } from '../lib/keyboard/vial';
import { restoreVersion } from '../lib/keyboard/versions';

const device = {
  vendorId: 0x1234,
  productId: 0x5678,
  productName: 'Fixture',
};

function changingTransport() {
  let generation = 0;
  let layers = [[4, 5, 6]];
  const writes: number[][] = [];
  const transport: Transport = {
    request: async (bytes) => {
      const response = new Uint8Array(32);
      if (bytes[0] === 1) response.set([1, 0, 9]);
      else if (bytes[0] === 0xfe && bytes[1] === 0)
        response.set([6, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]);
      else if (bytes[0] === 0xfe && bytes[1] === 1) response.set([1, 0, 0, 0]);
      else if (bytes[0] === 0xfe && bytes[1] === 2) response[0] = generation;
      else if (bytes[0] === 0x11) response.set([0x11, layers.length]);
      else if (bytes[0] === 0x12) {
        response.set(bytes.slice(0, 4));
        const raw = layers.flat().flatMap((code) => [code >>> 8, code & 0xff]);
        const offset = (bytes[1] << 8) | bytes[2];
        response.set(raw.slice(offset, offset + bytes[3]), 4);
      } else if (bytes[0] === 5) {
        writes.push([...bytes]);
        response.set(bytes);
      } else throw Error(`Unexpected command ${bytes.join(',')}`);
      return response;
    },
  };
  const definitions = [
    {
      name: 'Fixture',
      matrix: { rows: 1, cols: 3 },
      layouts: { keymap: [['0,0', '0,1', '0,2']] },
    },
    {
      name: 'Changed fixture',
      matrix: { rows: 1, cols: 4 },
      layouts: { keymap: [['0,0', '0,1', '0,2', '0,3']] },
    },
  ];
  return {
    client: new VialClient(transport, async (bytes) => definitions[bytes[0]]),
    changeMetadata: () => {
      generation = 1;
      layers = [
        [4, 5, 6, 7],
        [8, 9, 10, 11],
      ];
    },
    writes,
  };
}

describe('authoritative device I/O', () => {
  it('reloads definition and layer metadata after backup and aborts before a hardware write', async () => {
    const peripheral = changingTransport();
    const io = createDeviceIO(peripheral.client, device, () => true);
    const current = await io.read();
    const target: KeyboardConfig = structuredClone(current);
    target.layers[0][0] = 7;
    let backups = 0;

    await expect(
      restoreVersion(current, target, {
        ...io,
        backup: async () => {
          backups++;
          peripheral.changeMetadata();
        },
      }),
    ).rejects.toThrow(/変更|再読み込み|互換/);
    expect(backups).toBe(1);
    expect(peripheral.writes).toEqual([]);
  });

  it('revalidates authoritative metadata after an ordinary edit backup', async () => {
    const peripheral = changingTransport();
    const current = await createDeviceIO(
      peripheral.client,
      device,
      () => true,
    ).read();
    const snapshots: Snapshot[] = [];
    const io = {
      ...createDeviceIO(
        peripheral.client,
        device,
        () => true,
        async () => {
          peripheral.changeMetadata();
        },
      ),
      save: (snapshot: Snapshot) => snapshots.push(structuredClone(snapshot)),
    };

    await expect(
      applyChange(
        current,
        { layer: 0, row: 0, col: 0, before: 4, after: 7 },
        io,
      ),
    ).rejects.toThrow(/変更|再読み込み/);
    expect(snapshots.at(-1)?.status).toBe('uncertain');
    expect(peripheral.writes).toEqual([]);
  });
});
