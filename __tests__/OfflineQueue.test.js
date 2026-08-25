/**
 * Unit coverage for OfflineQueue.js's pure drain/retry logic — the part of
 * the enterprise offline-sync rollout that's genuinely automatable (no
 * native GPS/AsyncStorage-across-process-restart/real NetInfo involved).
 * Each test re-requires the module fresh (jest.resetModules) since it holds
 * module-level singleton state (the in-memory queue, the `processing`
 * mutex), exactly the same reset discipline a real app restart gives it.
 */

const networkError = () => { const e = new Error('Network Error'); return e; }; // no .response
const httpError = (status, data) => { const e = new Error(`HTTP ${status}`); e.response = { status, data }; return e; };

function loadFreshQueue() {
  jest.resetModules();
  // eslint-disable-next-line global-require
  return require('../src/services/OfflineQueue');
}

describe('OfflineQueue', () => {
  test('enqueue() produces the full item shape, including partitionKey and idempotencyKey', async () => {
    const Q = loadFreshQueue();
    const id = await Q.enqueue('COLLECTION_VISIT', { collectionId: 42, client_transaction_id: 'ctx-1' });
    const queue = await Q.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      id,
      kind: 'COLLECTION_VISIT',
      status: 'PENDING',
      attempts: 0,
      idempotencyKey: 'ctx-1',
      partitionKey: 'COLLECTION_VISIT:42',
    });
  });

  test('enqueue() derives idempotencyKey/partitionKey for CORRECTION_REQUEST and COLLECTION_CORRECTION payloads', async () => {
    const Q = loadFreshQueue();
    const crId = await Q.enqueue('CORRECTION_REQUEST', { client_transaction_id: 'ctx-cr-1' });
    const ccId = await Q.enqueue('COLLECTION_CORRECTION', { clientTransactionId: 'ctx-cc-1', correctionId: 7 });
    const queue = await Q.getQueue();
    const cr = queue.find((q) => q.id === crId);
    const cc = queue.find((q) => q.id === ccId);
    expect(cr.idempotencyKey).toBe('ctx-cr-1');
    expect(cc.idempotencyKey).toBe('ctx-cc-1');
    // correctionId is the finer-grained key for an edit-mode payload, which
    // has no collectionRecordId to partition on.
    expect(cc.partitionKey).toBe('COLLECTION_CORRECTION:7');
  });

  test('PUNCH_OUT falls to a shared default partition, same as PUNCH_IN', async () => {
    const Q = loadFreshQueue();
    const id = await Q.enqueue('PUNCH_OUT', { client_transaction_id: 'ctx-po-1' });
    const queue = await Q.getQueue();
    expect(queue.find((q) => q.id === id).partitionKey).toBe('PUNCH_OUT:default');
  });

  test('classifyError: network failure and 5xx/429/401/403 are retryable; other 4xx are permanent', () => {
    const Q = loadFreshQueue();
    expect(Q.classifyError(networkError())).toBe('retryable');
    expect(Q.classifyError(httpError(500))).toBe('retryable');
    expect(Q.classifyError(httpError(503))).toBe('retryable');
    expect(Q.classifyError(httpError(429))).toBe('retryable');
    expect(Q.classifyError(httpError(401))).toBe('retryable');
    expect(Q.classifyError(httpError(403))).toBe('retryable');
    expect(Q.classifyError(httpError(400))).toBe('permanent');
    expect(Q.classifyError(httpError(404))).toBe('permanent');
    expect(Q.classifyError(httpError(422))).toBe('permanent');
  });

  test('a retryable failure schedules a future nextRetryAt and does not remove the item', async () => {
    const Q = loadFreshQueue();
    Q.registerReplayer('COLLECTION_VISIT', async () => { throw networkError(); });
    await Q.enqueue('COLLECTION_VISIT', { collectionId: 1 });
    await Q.processQueue();
    const queue = await Q.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('RETRY_PENDING');
    expect(queue[0].attempts).toBe(1);
    expect(queue[0].nextRetryAt).toBeGreaterThan(Date.now());
  });

  test('backoff grows across repeated retryable failures', async () => {
    const Q = loadFreshQueue();
    Q.registerReplayer('COLLECTION_VISIT', async () => { throw httpError(500); });
    await Q.enqueue('COLLECTION_VISIT', { collectionId: 1 });

    const delays = [];
    for (let i = 0; i < 4; i += 1) {
      const before = Date.now();
      // Force the item eligible immediately regardless of the previous
      // backoff, so this test isn't at the mercy of real wall-clock time.
      const queue = await Q.getQueue();
      if (queue[0]) queue[0].nextRetryAt = 0;
      // eslint-disable-next-line no-await-in-loop
      await Q.processQueue();
      const after = await Q.getQueue();
      delays.push(after[0].nextRetryAt - before);
    }
    // Each successive backoff should be at least as large as the previous
    // (jitter can shrink it slightly within one step, but the overall trend
    // across 2x/4x/8x must be clearly increasing).
    expect(delays[3]).toBeGreaterThan(delays[0]);
    expect(delays[2]).toBeGreaterThan(delays[0]);
  });

  test('a permanent (400) failure dead-letters the item as FAILED, never retried automatically', async () => {
    const Q = loadFreshQueue();
    Q.registerReplayer('COLLECTION_VISIT', async () => { throw httpError(400, { error: 'Invalid payload' }); });
    await Q.enqueue('COLLECTION_VISIT', { collectionId: 1 });
    await Q.processQueue();
    const queue = await Q.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('FAILED');

    // A second drain pass must not touch it again — it's excluded from
    // pickNext entirely once permanent.
    const attemptsBefore = queue[0].attempts;
    await Q.processQueue();
    const after = await Q.getQueue();
    expect(after[0].attempts).toBe(attemptsBefore);
  });

  test('exhausting MAX_ATTEMPTS on a retryable error eventually dead-letters it too', async () => {
    const Q = loadFreshQueue();
    Q.registerReplayer('COLLECTION_VISIT', async () => { throw networkError(); });
    await Q.enqueue('COLLECTION_VISIT', { collectionId: 1 });

    for (let i = 0; i < 8; i += 1) {
      const queue = await Q.getQueue();
      if (queue[0]) queue[0].nextRetryAt = 0; // skip real backoff wait in the test
      // eslint-disable-next-line no-await-in-loop
      await Q.processQueue();
    }
    const queue = await Q.getQueue();
    expect(queue[0].status).toBe('FAILED');
    expect(queue[0].attempts).toBeGreaterThanOrEqual(8);
  });

  test('a broken item in one partition does not block a different partition in the same pass', async () => {
    const Q = loadFreshQueue();
    const replayed = [];
    Q.registerReplayer('COLLECTION_VISIT', async (payload) => {
      if (payload.collectionId === 1) throw httpError(400);
      replayed.push(payload.collectionId);
    });
    await Q.enqueue('COLLECTION_VISIT', { collectionId: 1 }); // will permanently fail
    await Q.enqueue('COLLECTION_VISIT', { collectionId: 2 }); // unrelated, should still succeed
    await Q.processQueue();

    expect(replayed).toEqual([2]);
    const queue = await Q.getQueue();
    // Item #1 (FAILED) is still present; item #2 succeeded and is either
    // SYNCED (awaiting prune) or already pruned — either way it's gone from
    // pickNext's eligible set, so only the failed item remains visible here.
    expect(queue.filter((q) => q.status === 'FAILED')).toHaveLength(1);
    expect(queue.find((q) => q.status === 'FAILED').payload.collectionId).toBe(1);
  });

  test('same-partition ordering is preserved: item #2 for a record is never replayed before item #1 for that same record resolves', async () => {
    const Q = loadFreshQueue();
    const replayed = [];
    Q.registerReplayer('COLLECTION_VISIT', async (payload) => {
      replayed.push(payload.seq);
      if (payload.seq === 1) throw httpError(500); // retryable — should block #2 this pass
    });
    await Q.enqueue('COLLECTION_VISIT', { collectionId: 1, seq: 1 });
    await Q.enqueue('COLLECTION_VISIT', { collectionId: 1, seq: 2 });
    await Q.processQueue();

    // Only #1 should have been attempted — #2 stays blocked behind it.
    expect(replayed).toEqual([1]);
    const queue = await Q.getQueue();
    expect(queue).toHaveLength(2);
  });

  test('an item is only marked SYNCED after replay() resolves — never optimistically — then pruned', async () => {
    const Q = loadFreshQueue();
    let resolveReplay;
    Q.registerReplayer('COLLECTION_VISIT', () => new Promise((resolve) => { resolveReplay = resolve; }));
    await Q.enqueue('COLLECTION_VISIT', { collectionId: 1 });

    const seenStatuses = [];
    const unsubscribe = Q.subscribe((items) => { if (items[0]) seenStatuses.push(items[0].status); });

    const drainPromise = Q.processQueue();
    // The SYNCING transition now does a forced persistNow() (an awaited
    // AsyncStorage call) before replay() is invoked, so a single await
    // isn't reliably enough microtask hops to reach it — poll instead of
    // assuming one tick suffices.
    for (let i = 0; i < 20 && typeof resolveReplay !== 'function'; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
    expect(typeof resolveReplay).toBe('function');

    // Mid-flight: still queued, marked SYNCING.
    const midFlight = await Q.getQueue();
    expect(midFlight).toHaveLength(1);
    expect(midFlight[0].status).toBe('SYNCING');

    resolveReplay();
    await drainPromise;
    unsubscribe();

    // Terminal-success is visible as SYNCED before it's pruned — a
    // subscribed UI (the "Pending Sync" section) gets a render tick to show
    // "just synced" rather than the item vanishing instantly.
    expect(seenStatuses).toContain('SYNCED');
    const justSynced = await Q.getQueue();
    expect(justSynced).toHaveLength(1);
    expect(justSynced[0].status).toBe('SYNCED');

    // Age it past SYNCED_PRUNE_DELAY_MS (getQueue() items are references
    // into the real in-memory queue, so this mutates the actual item) and
    // trigger another pass — pruneSynced() runs at the start of every
    // processQueue() call, so this doesn't depend on the setTimeout
    // follow-up prune or on real/fake wall-clock waiting.
    justSynced[0].syncedAt = Date.now() - 10000;
    await Q.processQueue();
    const afterPrune = await Q.getQueue();
    expect(afterPrune).toHaveLength(0);
  });

  test('a SYNCING item found on hydrate (app killed mid-replay) is reconciled to PENDING', async () => {
    // Safe specifically because every queue kind now carries a
    // client_transaction_id — a resumed replay that actually already landed
    // server-side is recognized as a duplicate by that endpoint's dedup
    // logic rather than creating a second record.
    jest.resetModules();
    // eslint-disable-next-line global-require
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem('@tas_offline_queue', JSON.stringify([
      {
        id: 'stuck-1',
        kind: 'PUNCH_IN',
        payload: { client_transaction_id: 'ctx-stuck' },
        queuedAt: Date.now(),
        attempts: 1,
        lastError: '',
        status: 'SYNCING',
        idempotencyKey: 'ctx-stuck',
        nextRetryAt: 0,
        errorClass: null,
        partitionKey: 'PUNCH_IN:default',
      },
    ]));
    // eslint-disable-next-line global-require
    const Q = require('../src/services/OfflineQueue');
    const queue = await Q.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('PENDING');
    expect(queue[0].nextRetryAt).toBe(0);
  });

  test('a stale SYNCED item found on hydrate is dropped rather than waiting for a prune sweep', async () => {
    jest.resetModules();
    // eslint-disable-next-line global-require
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem('@tas_offline_queue', JSON.stringify([
      {
        id: 'synced-1',
        kind: 'PUNCH_IN',
        payload: { client_transaction_id: 'ctx-synced' },
        queuedAt: Date.now(),
        attempts: 1,
        lastError: '',
        status: 'SYNCED',
        syncedAt: Date.now(),
        idempotencyKey: 'ctx-synced',
        nextRetryAt: 0,
        errorClass: null,
        partitionKey: 'PUNCH_IN:default',
      },
    ]));
    // eslint-disable-next-line global-require
    const Q = require('../src/services/OfflineQueue');
    const queue = await Q.getQueue();
    expect(queue).toHaveLength(0);
  });

  test('onSyncComplete fires once per drain pass with succeeded/failed, not once per item', async () => {
    const Q = loadFreshQueue();
    Q.registerReplayer('COLLECTION_VISIT', async (payload) => {
      if (payload.collectionId === 2) throw httpError(400);
    });
    await Q.enqueue('COLLECTION_VISIT', { collectionId: 1 });
    await Q.enqueue('COLLECTION_VISIT', { collectionId: 2 });
    await Q.enqueue('COLLECTION_VISIT', { collectionId: 3 });

    const calls = [];
    const unsubscribe = Q.onSyncComplete((result) => calls.push(result));
    await Q.processQueue();
    unsubscribe();

    expect(calls).toHaveLength(1);
    expect(calls[0].succeeded).toHaveLength(2);
    expect(calls[0].failed).toHaveLength(1);
  });

  test('retryItem() resets a dead-lettered item back to PENDING and lets it be picked up again', async () => {
    const Q = loadFreshQueue();
    let shouldFail = true;
    Q.registerReplayer('COLLECTION_VISIT', async () => {
      if (shouldFail) throw httpError(400);
    });
    const id = await Q.enqueue('COLLECTION_VISIT', { collectionId: 1 });
    await Q.processQueue();
    expect((await Q.getQueue())[0].status).toBe('FAILED');

    shouldFail = false;
    await Q.retryItem(id);
    // retryItem() kicks its own processQueue() internally; give it a tick.
    await new Promise((r) => setTimeout(r, 0));
    const queue = await Q.getQueue();
    // Succeeded — now SYNCED (terminal, briefly visible), not yet pruned.
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('SYNCED');
  });

  test('syncNow() clears a pending backoff wait and retries immediately, instead of waiting out the scheduled delay', async () => {
    // The exact reported bug: a field employee comes back online, but a
    // previously-failed item is still waiting out its exponential backoff
    // (up to 30 minutes) — from their perspective "I'm online but nothing
    // is syncing." syncNow() (wired to the reconnect triggers in
    // startAutoSync, and to a manual "tap to sync" banner action) must
    // clear that wait and retry immediately.
    const Q = loadFreshQueue();
    let shouldFail = true;
    const attempts = [];
    Q.registerReplayer('COLLECTION_VISIT', async () => {
      attempts.push(Date.now());
      if (shouldFail) throw new Error('Network Error'); // no .response -> retryable
    });
    await Q.enqueue('COLLECTION_VISIT', { collectionId: 1 });
    await Q.processQueue(); // first attempt fails, schedules a future retry

    const queued = await Q.getQueue();
    expect(queued[0].status).toBe('RETRY_PENDING');
    expect(queued[0].nextRetryAt).toBeGreaterThan(Date.now());

    // A plain processQueue() call right now (simulating some unrelated
    // trigger) must NOT retry yet — it's still within the backoff window.
    await Q.processQueue();
    expect(attempts).toHaveLength(1);

    // But syncNow() (the reconnect path) clears the wait and retries now.
    shouldFail = false;
    await Q.syncNow();
    expect(attempts).toHaveLength(2);
    const afterSync = await Q.getQueue();
    expect(afterSync).toHaveLength(1);
    expect(afterSync[0].status).toBe('SYNCED'); // succeeded, awaiting prune
  });

  test('discardItem() removes a dead-lettered item without ever retrying it', async () => {
    const Q = loadFreshQueue();
    Q.registerReplayer('COLLECTION_VISIT', async () => { throw httpError(400); });
    const id = await Q.enqueue('COLLECTION_VISIT', { collectionId: 1 });
    await Q.processQueue();
    expect(await Q.getQueue()).toHaveLength(1);

    await Q.discardItem(id);
    expect(await Q.getQueue()).toHaveLength(0);
  });

  test('a legacy item with no status field (pre-upgrade build) is migrated to PENDING on hydrate, not dropped', async () => {
    // jest.resetModules() (inside loadFreshQueue) also resets the mocked
    // AsyncStorage module's own in-memory storage — so the write and the
    // OfflineQueue require must both come from the SAME fresh module
    // registry, in that order, not a require() before the reset.
    jest.resetModules();
    // eslint-disable-next-line global-require
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem('@tas_offline_queue', JSON.stringify([
      { id: 'legacy-1', kind: 'PUNCH_IN', payload: { loan_id: '' }, queuedAt: Date.now(), attempts: 0, lastError: '' },
    ]));
    // eslint-disable-next-line global-require
    const Q = require('../src/services/OfflineQueue');
    const queue = await Q.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('PENDING');
    expect(queue[0].partitionKey).toBe('PUNCH_IN:default');
  });
});
