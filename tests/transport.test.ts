import { expect, it, vi } from 'vitest';
import { HidTransport } from '../lib/keyboard/transport';

class FakeHid extends EventTarget {
  opened = true;
  packets: number[][] = [];
  sendReport = async (_id: number, bytes: BufferSource) => {
    this.packets.push([...new Uint8Array(bytes as ArrayBuffer)]);
  };
  close = async () => {
    this.opened = false;
  };
  respond(bytes = new Uint8Array(32), reportId = 0) {
    const event = Object.assign(new Event('inputreport'), {
      reportId,
      data: new DataView(bytes.buffer),
      device: this,
    });
    this.dispatchEvent(event);
  }
}
it('serializes requests, pads to 32 bytes, and ignores other report IDs', async () => {
  const device = new FakeHid();
  const transport = new HidTransport(
    device as unknown as HIDDevice,
    0,
    0,
    1000,
  );
  const first = transport.request([1]),
    second = transport.request([0x11]);
  await vi.waitFor(() => expect(device.packets.length).toBe(1));
  expect(device.packets[0]).toEqual([1, ...Array(31).fill(0)]);
  device.respond(new Uint8Array(32), 7);
  expect(device.packets.length).toBe(1);
  device.respond();
  await first;
  await vi.waitFor(() => expect(device.packets.length).toBe(2));
  device.respond();
  await second;
  await transport.close();
});
it('invalidates a timed-out session so late replies cannot satisfy another write', async () => {
  const device = new FakeHid();
  const transport = new HidTransport(device as unknown as HIDDevice, 0, 0, 10);
  await expect(transport.request([1])).rejects.toThrow();
  device.respond();
  await expect(transport.request([5, 0, 0, 0, 0, 4])).rejects.toThrow();
  expect(device.packets.length).toBe(1);
  await transport.close();
});
it('rejects pending reads immediately on disconnect', async () => {
  const device = new FakeHid();
  const transport = new HidTransport(device as unknown as HIDDevice, 0, 0);
  const pending = transport.request([1]);
  const rejection = expect(pending).rejects.toThrow();
  await vi.waitFor(() => expect(device.packets.length).toBe(1));
  await transport.close();
  await rejection;
});
