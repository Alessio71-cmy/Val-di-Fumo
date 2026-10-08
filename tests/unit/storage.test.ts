import { beforeEach, describe, expect, it } from 'vitest';
import { __resetStorageForTests, isVolatileStorage, kvDel, kvGet, kvSet } from '../../src/storage/idb';

describe('archivio locale (ripiego in memoria senza IndexedDB)', () => {
  beforeEach(() => __resetStorageForTests());
  it('set/get/del', async () => {
    expect(await kvGet('a')).toBeUndefined();
    await kvSet('a', { x: 1 });
    expect(await kvGet('a')).toEqual({ x: 1 });
    await kvDel('a');
    expect(await kvGet('a')).toBeUndefined();
  });
  it('segnala che il salvataggio è volatile quando IndexedDB non c\'è', async () => {
    await kvSet('k', 1);
    expect(await isVolatileStorage()).toBe(true);
  });
});
