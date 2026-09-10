/// <reference types="w3c-web-hid" />
import type { Transport } from './types';

export class HidTransport implements Transport {
  private queue: Promise<unknown> = Promise.resolve();
  private invalid = false;
  private pending: {
    resolve: (bytes: Uint8Array) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  constructor(
    readonly device: HIDDevice,
    private outputId: number,
    private inputId: number,
    private timeout = 2500,
  ) {
    device.addEventListener('inputreport', this.onInput);
  }
  private onInput = (event: HIDInputReportEvent) => {
    if (event.reportId !== this.inputId || !this.pending) return;
    const pending = this.pending;
    clearTimeout(pending.timer);
    this.pending = null;
    if (event.data.byteLength !== 32) {
      this.invalid = true;
      pending.reject(Error('通信データの長さが不正です。再接続してください。'));
    } else
      pending.resolve(
        new Uint8Array(event.data.buffer, event.data.byteOffset, 32).slice(),
      );
  };
  request(bytes: number[]): Promise<Uint8Array> {
    const task = this.queue.then(() => {
      if (this.invalid || !this.device.opened)
        throw Error('接続が切れています。キーボードを再接続してください。');
      if (
        bytes.length > 32 ||
        bytes.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
      )
        throw Error('送信データが不正です。');
      return new Promise<Uint8Array>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            this.abort(
              Error(
                'キーボードから応答がありません。Vialなど他の設定アプリを閉じて再接続してください。',
              ),
            ),
          this.timeout,
        );
        this.pending = { resolve, reject, timer };
        const packet = new Uint8Array(32);
        packet.set(bytes);
        Promise.resolve()
          .then(() => this.device.sendReport(this.outputId, packet))
          .catch(() =>
            this.abort(Error('USB通信に失敗しました。再接続してください。')),
          );
      });
    });
    this.queue = task.catch(() => {});
    return task;
  }
  private abort(error: Error) {
    this.invalid = true;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(error);
      this.pending = null;
    }
  }
  async close() {
    this.abort(Error('キーボードとの接続が切れました。'));
    this.device.removeEventListener('inputreport', this.onInput);
    if (this.device.opened) await this.device.close().catch(() => {});
  }
}

function reportBytes(report: HIDReportInfo) {
  return (
    (report.items ?? []).reduce(
      (sum, item) => sum + (item.reportSize ?? 0) * (item.reportCount ?? 0),
      0,
    ) / 8
  );
}
function collections(items: HIDCollectionInfo[]): HIDCollectionInfo[] {
  return items.flatMap((item) => [item, ...collections(item.children ?? [])]);
}
export async function requestKeyboard(): Promise<HidTransport | null> {
  if (!('hid' in navigator) || !window.isSecureContext)
    throw Error(
      'USB接続にはChrome / EdgeのHTTPSまたはlocalhostが必要です。サンプルはこのまま試せます。',
    );
  const devices = await navigator.hid.requestDevice({
    filters: [{ usagePage: 0xff60, usage: 0x61 }],
  });
  const device = devices[0];
  if (!device) return null;
  const collection = collections(device.collections).find(
    (c) => c.usagePage === 0xff60 && c.usage === 0x61,
  );
  const input = collection?.inputReports?.find((r) => reportBytes(r) === 32);
  const output = collection?.outputReports?.find((r) => reportBytes(r) === 32);
  if (
    !input ||
    !output ||
    input.reportId === undefined ||
    output.reportId === undefined
  )
    throw Error('Vial用のUSBインターフェースが見つかりません。');
  if (!device.opened) await device.open();
  return new HidTransport(device, output.reportId, input.reportId);
}
