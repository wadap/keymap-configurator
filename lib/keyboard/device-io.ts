import { sameMap } from './transactions';
import type { KeyboardConfig, TransactionIO } from './types';
import type { DeviceInfo } from './vial';
import { VialClient } from './vial';

export function createDeviceIO(
  client: VialClient,
  device: DeviceInfo,
  isCurrent: () => boolean,
  checkpoint?: (config: KeyboardConfig) => Promise<void>,
): Pick<TransactionIO, 'read' | 'write'> {
  const assertCurrent = () => {
    if (!isCurrent())
      throw Error('接続が切れています。キーボードを再接続してください。');
  };
  const read = async () => {
    assertCurrent();
    const config = await client.load(device);
    assertCurrent();
    return config;
  };
  return {
    read,
    write: async (config, change) => {
      if (checkpoint) {
        await checkpoint(config);
        const latest = await read();
        if (!sameMap(config, latest))
          throw Error(
            '保存中にキーマップが変わりました。再読み込みして差分を確認してください。',
          );
      }
      assertCurrent();
      await client.writeKey(config, change);
      assertCurrent();
    },
  };
}
