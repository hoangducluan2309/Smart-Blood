import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MemoryStore } from '../../backend/src/shared/memory-store.js';

describe('memory-store', () => {
  it('should store and retrieve values before TTL expires', () => {
    const store = new MemoryStore(60_000);
    store.set('otp:vault:req-1', { value: '123456', ttlSeconds: 60 });
    assert.equal(store.get<string>('otp:vault:req-1'), '123456');
    store.dispose();
  });

  it('should return null when entry TTL has expired', async () => {
    const store = new MemoryStore(60_000);
    store.set('otp:reset:test', { value: '654321', ttlSeconds: 0.02 });
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(store.get<string>('otp:reset:test'), null);
    store.dispose();
  });

  it('should purge expired entries and keep active ones', async () => {
    const store = new MemoryStore(60_000);
    store.set('expired-key', { value: 1, ttlSeconds: 0.01 });
    store.set('active-key', { value: 2, ttlSeconds: 60 });
    await new Promise((resolve) => setTimeout(resolve, 30));

    const purged = store.purgeExpired();
    assert.equal(purged, 1);
    assert.equal(store.get<number>('active-key'), 2);
    assert.equal(store.size(), 1);
    store.dispose();
  });
});
