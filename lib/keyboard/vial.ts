import { decompressDefinition, parseDefinition } from './definition';
import type { KeyboardConfig, KeyChange, Transport } from './types';

export type DeviceInfo = {
  vendorId: number;
  productId: number;
  productName: string;
};
const hex = (n: number, size: number) => n.toString(16).padStart(size, '0');

export class VialClient {
  constructor(
    private transport: Transport,
    private decode: (
      bytes: Uint8Array,
    ) => Promise<unknown> = decompressDefinition,
  ) {}

  private async request(bytes: number[], echo = 0) {
    const result = await this.transport.request(bytes);
    if (
      result.length !== 32 ||
      (echo && bytes.slice(0, echo).some((b, i) => result[i] !== b))
    )
      throw Error('キーボードからの応答が不正です。再接続してください。');
    return result;
  }

  async load(
    device: DeviceInfo,
    progress?: (text: string) => void,
  ): Promise<KeyboardConfig> {
    progress?.('キーボードを確認しています…');
    const via = await this.request([1], 1);
    if (((via[1] << 8) | via[2]) !== 9)
      throw Error(
        'このVIAプロトコルは未対応です。Vial対応の機器を選んでください。',
      );
    const info = await this.request([0xfe, 0]);
    const protocol = new DataView(info.buffer, info.byteOffset).getUint32(
      0,
      true,
    );
    if (protocol > 6)
      throw Error('このVialプロトコルは未対応です。書き込みは行っていません。');
    const id = `${hex(device.vendorId, 4)}:${hex(device.productId, 4)}:${Array.from(info.slice(4, 12), (n) => hex(n, 2)).join('')}`;
    const sizeBytes = await this.request([0xfe, 1]);
    const size = new DataView(sizeBytes.buffer, sizeBytes.byteOffset).getUint32(
      0,
      true,
    );
    if (size < 1 || size > 256 * 1024)
      throw Error('キーボード定義のサイズが不正です。');
    progress?.('キーボードのレイアウトを読み込んでいます…');
    const compressed = new Uint8Array(size);
    for (let offset = 0; offset < size; offset += 32) {
      const block = offset / 32;
      const result = await this.request([
        0xfe,
        2,
        block & 255,
        (block >>> 8) & 255,
        (block >>> 16) & 255,
        (block >>> 24) & 255,
      ]);
      compressed.set(result.slice(0, Math.min(32, size - offset)), offset);
    }
    const definition = parseDefinition(await this.decode(compressed));
    const count = (await this.request([0x11], 1))[1];
    if (count < 1 || count > 32) throw Error('レイヤー数が不正です。');
    const config: KeyboardConfig = {
      ...definition,
      id,
      protocol,
      mode: 'device',
      layers: Array.from({ length: count }, () => []),
    };
    progress?.(`${count}レイヤーの割り当てを読み込んでいます…`);
    return this.read(config);
  }

  async read(config: KeyboardConfig): Promise<KeyboardConfig> {
    // Confirm the firmware ID on every transaction, including Undo after reconnect.
    const info = await this.request([0xfe, 0]);
    const uid = Array.from(info.slice(4, 12), (n) => hex(n, 2)).join('');
    if (!config.id.endsWith(`:${uid}`))
      throw Error('接続先のキーボードが変わっています。');
    const total = config.layers.length * config.rows * config.cols * 2;
    if (total < 2 || total > 65536)
      throw Error('キーマップのサイズが対応範囲外です。');
    const data = new Uint8Array(total);
    for (let offset = 0; offset < total; offset += 28) {
      const length = Math.min(28, total - offset);
      const response = await this.request(
        [0x12, offset >>> 8, offset & 255, length],
        4,
      );
      data.set(response.slice(4, 4 + length), offset);
    }
    const view = new DataView(data.buffer),
      cells = config.rows * config.cols;
    return {
      ...config,
      layers: config.layers.map((_, layer) =>
        Array.from({ length: cells }, (_, i) =>
          view.getUint16((layer * cells + i) * 2, false),
        ),
      ),
    };
  }

  async writeKey(config: KeyboardConfig, change: KeyChange) {
    const { layer, row, col, after } = change;
    if (
      ![layer, row, col, after].every(Number.isInteger) ||
      layer < 0 ||
      layer >= config.layers.length ||
      row < 0 ||
      row >= config.rows ||
      col < 0 ||
      col >= config.cols ||
      after < 0 ||
      after > 0xffff
    )
      throw Error('書き込みデータが範囲外です。');
    await this.request([5, layer, row, col, after >>> 8, after & 255], 6);
  }
}
