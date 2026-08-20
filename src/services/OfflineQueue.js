import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { serverStatus } from '../utils/serverStatus';

/**
 * Generic offline outbox for write actions that must not be lost when a
 * field officer submits with no signal — Collection Visit, Correction
 * requests, and Punch all enqueue here instead of failing outright when the
 * request never reached the server.
 *
 * Each item stores a `kind` (a string) and a plain, JSON-safe `payload` —
 * never a FormData/File/Date instance, so it always survives AsyncStorage.
 * A "replayer" registered per kind (see `registerReplayer`) turns that
 * payload back into whatever the real API call needs (e.g. rebuilding a
 * FormData from stored field values + local photo file:// URIs, which are
 * themselves just strings and re-readable from disk later).
 *
 * Auto-drains on: NetInfo connectivity restored, the app's own
 * request-verified online signal (serverStatus), the app returning to the
 * foreground, once at app start, and once after any live API request
 * succeeds (see startAutoSync / api.js's response interceptor) — in case
 * something was queued during a previous session or a previous attempt.
 *
 * Each item also carries a `status`, retry/backoff bookkeeping, and a
 * `partitionKey` so one permanently-broken item (e.g. a stale/invalid
 * payload) can never block every other queued item forever, while still
 * preserving submission order *within* the same record (never replaying a
 * second visit for a loan before an earlier one for that same loan has
 * resolved). See processQueue() below for the exact rules.
 */
const STORAGE_KEY = '@tas_offline_queue';

// ── Status values ──────────────────────────────────────────────────────────
// PENDING           — queued, not yet attempted (or reset via retryItem()).
// SYNCING           — a replay is in flight right now.
// FAILED_RETRYABLE  — a transient failure (network/5xx/429/401/403); will be
//                      retried automatically once nextRetryAt passes.
// FAILED_PERMANENT  — a non-retryable failure (4xx business/validation) or
//                      MAX_ATTEMPTS exhausted; stays visible, never silently
//                      dropped — only leaves the queue via retryItem() (user
//                      asks to try again) or discardItem() (user dismisses).
export const QUEUE_STATUS = {
  PENDING: 'PENDING',
  SYNCING: 'SYNCING',
  FAILED_RETRYABLE: 'FAILED_RETRYABLE',
  FAILED_PERMANENT: 'FAILED_PERMANENT',
};

const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 5 * 1000;
const CAP_BACKOFF_MS = 30 * 60 * 1000;

let queue = null; // in-memory mirror, lazily hydrated from AsyncStorage
let processing = false;
const replayers = new Map(); // kind -> async (payload) => void  (throws on failure)
const listeners = new Set();
const syncCompleteListeners = new Set();

// "Was this queued during the app session currently running" — the cheap,
// good-enough signal for HIGH priority (an item from the visit the user
// just finished, worth surfacing/retrying ahead of days-old backlog) without
// needing a separate stored field.
const sessionStartTime = Date.now();

function notify() {
  listeners.forEach((fn) => {
    try { fn([...queue]); } catch {}
  });
}

function emitSyncComplete(result) {
  syncCompleteListeners.forEach((fn) => {
    try { fn(result); } catch {}
  });
}

async function hydrate() {
  if (queue !== null) return queue;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    // Migrate items queued by a pre-upgrade build (no status field yet) so
    // an app update mid-flight, with items already on disk, never breaks.
    queue = parsed.map((item) => (item.status ? item : {
      ...item,
      status: QUEUE_STATUS.PENDING,
      idempotencyKey: item.idempotencyKey ?? item.payload?.client_transaction_id ?? item.payload?.clientTransactionId ?? null,
      nextRetryAt: 0,
      errorClass: null,
      partitionKey: item.partitionKey ?? computePartitionKey(item.kind, item.payload),
    }));
  } catch {
    queue = [];
  }
  return queue;
}

// Debounced AsyncStorage write — a multi-item drain can touch several items
// in quick succession; there's no need for a synchronous JSON.stringify of
// the whole queue after each one. persist() itself remains awaitable for
// call sites (enqueue, retryItem, discardItem) that need the write to have
// actually landed before returning.
let persistTimer = null;
let persistWaiters = [];
function schedulePersist() {
  return new Promise((resolve) => {
    persistWaiters.push(resolve);
    if (persistTimer) return;
    persistTimer = setTimeout(async () => {
      persistTimer = null;
      const waiters = persistWaiters;
      persistWaiters = [];
      await persistNow();
      waiters.forEach((w) => w());
    }, 250);
  });
}
async function persistNow() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Best-effort — an AsyncStorage write failure shouldn't block the
    // in-memory queue from still draining this session.
  }
}
// Kept as `persist` for internal call sites that want the debounced path.
const persist = schedulePersist;

/** A stable id for one real-world submission, generated once at the moment
 * the user taps Save and reused unchanged for every attempt of that same
 * submission — the live first try AND every offline-queued retry. Sent to
 * the backend as client_transaction_id so it can tell "this exact visit,
 * resubmitted because the response was lost" apart from "a new visit",
 * even under concurrent retries from hundreds of devices syncing at once
 * (see CollectionUpdate.client_transaction_id server-side). Not a
 * cryptographic UUID — device+timestamp+random is unique enough for this
 * purpose and needs no extra dependency. */
export function generateTransactionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Register how to replay one `kind` of queued item. Call once per kind,
 * typically at module load of the screen/service that owns that flow. */
export function registerReplayer(kind, fn) {
  replayers.set(kind, fn);
}

// Groups queued work by the real-world record it belongs to, so submission
// order is preserved *within* that record (never replay visit #2 for a loan
// before visit #1 for that same loan has resolved) without letting a broken
// item for one record block an unrelated one. Falls back to a shared
// 'default' partition per kind for payloads with no per-record id (e.g. a
// generic punch correction) — those still serialize relative to each other,
// which is the safe default when there's no finer-grained key to use.
function computePartitionKey(kind, payload) {
  const candidates = [payload?.collectionId, payload?.loanId, payload?.loan_id, payload?.collectionRecordId];
  const recordId = candidates.find((v) => v !== undefined && v !== null && v !== '') ?? 'default';
  return `${kind}:${recordId}`;
}

/** Add an item to the outbox. `payload` must be JSON-serializable. Returns
 * the queued item's id. */
export async function enqueue(kind, payload) {
  await hydrate();
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind,
    payload,
    queuedAt: Date.now(),
    attempts: 0,
    lastError: '',
    status: QUEUE_STATUS.PENDING,
    idempotencyKey: payload?.client_transaction_id ?? payload?.clientTransactionId ?? null,
    nextRetryAt: 0,
    errorClass: null,
    partitionKey: computePartitionKey(kind, payload),
  };
  queue.push(item);
  await persist();
  notify();
  return item.id;
}

export async function getQueue() {
  await hydrate();
  return [...queue];
}

export function subscribe(fn) {
  listeners.add(fn);
  hydrate().then(() => fn([...queue]));
  return () => listeners.delete(fn);
}

/** Fires once per drain pass (not once per item) with
 * `{ succeeded: Item[], failed: Item[] }` — the shape that makes "one
 * notification per batch, never per-item spam" hold structurally rather
 * than needing de-duplication logic at the call site. */
export function onSyncComplete(fn) {
  syncCompleteListeners.add(fn);
  return () => syncCompleteListeners.delete(fn);
}

/** Not every failure deserves a retry. A dropped connection or a transient
 * server hiccup should be retried; a payload the backend has permanently
 * rejected (bad data, a business-rule violation) never will be just by
 * trying again — retrying it forever would only ever block whatever's
 * queued behind it in the same partition. */
export function classifyError(err) {
  if (isNetworkError(err)) return 'retryable';
  const status = err?.response?.status;
  if (status >= 500 || status === 429 || status === 408 || status === 401 || status === 403) {
    return 'retryable';
  }
  return 'permanent';
}

function backoffMs(attempts) {
  const raw = Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), CAP_BACKOFF_MS);
  const jitter = 0.85 + Math.random() * 0.3; // spread out simultaneous retries a bit
  return Math.round(raw * jitter);
}

// HIGH: queued this app session (what the user just did). NORMAL: queued in
// the last 24h. LOW: older backlog. Only affects pick *order* among items
// that are otherwise both eligible right now — it never lets old backlog
// starve forever, and it never delays the live, in-the-moment submit path
// at all, since that path calls the API directly and doesn't go through
// this queue until/unless it fails.
function priorityRank(item) {
  if (item.queuedAt >= sessionStartTime) return 0;
  if (Date.now() - item.queuedAt < 24 * 60 * 60 * 1000) return 1;
  return 2;
}

function pickNext(blockedPartitions) {
  const now = Date.now();
  let best = null;
  for (const item of queue) {
    if (item.status === QUEUE_STATUS.FAILED_PERMANENT) continue;
    if (blockedPartitions.has(item.partitionKey)) continue;
    if (item.nextRetryAt && item.nextRetryAt > now) continue;
    if (!best
      || priorityRank(item) < priorityRank(best)
      || (priorityRank(item) === priorityRank(best) && item.queuedAt < best.queuedAt)) {
      best = item;
    }
  }
  return best;
}

/** Drain the queue. Picks the highest-priority eligible item across
 * distinct records (partitions) rather than strict FIFO, so a broken item
 * for one loan never blocks an unrelated loan or a punch — but never
 * replays two items for the *same* record out of order. A retryable
 * failure schedules a backed-off retry and blocks only that record's
 * partition for the rest of this pass; a permanent failure (or exhausted
 * retries) is dead-lettered as FAILED_PERMANENT — kept, visible, never
 * silently dropped — and also blocks its partition until the user retries
 * or discards it. Fires onSyncComplete() once at the end with everything
 * that resolved this pass. */
export async function processQueue() {
  if (processing) return;
  processing = true;
  const succeeded = [];
  const failed = [];
  try {
    await hydrate();
    const blockedPartitions = new Set();
    // Bounded by queue size — each iteration either removes an item or
    // blocks a partition, so this can't loop forever.
    for (let guard = 0; guard < queue.length + 1; guard += 1) {
      const item = pickNext(blockedPartitions);
      if (!item) break;
      const replay = replayers.get(item.kind);
      if (!replay) {
        // No replayer registered for this kind at all — leave it queued
        // rather than dropping it, but don't let it block its partition
        // forever against items that might have a registered replayer.
        blockedPartitions.add(item.partitionKey);
        continue;
      }
      item.status = QUEUE_STATUS.SYNCING;
      notify();
      try {
        await replay(item.payload);
        const idx = queue.indexOf(item);
        if (idx !== -1) queue.splice(idx, 1);
        succeeded.push(item);
        await persist();
        notify();
      } catch (err) {
        item.attempts += 1;
        item.lastError = err?.response?.data?.error || err?.message || 'Sync failed';
        item.errorClass = classifyError(err);
        if (item.errorClass === 'permanent' || item.attempts >= MAX_ATTEMPTS) {
          item.status = QUEUE_STATUS.FAILED_PERMANENT;
          item.nextRetryAt = 0;
          failed.push(item);
        } else {
          item.status = QUEUE_STATUS.FAILED_RETRYABLE;
          item.nextRetryAt = Date.now() + backoffMs(item.attempts);
        }
        blockedPartitions.add(item.partitionKey);
        await persist();
        notify();
      }
    }
  } finally {
    processing = false;
    if (succeeded.length || failed.length) emitSyncComplete({ succeeded, failed });
  }
}

/** User-initiated retry of a dead-lettered item — resets it back to
 * PENDING (attempts/lastError kept for history) and immediately kicks the
 * queue. Never happens automatically; a FAILED_PERMANENT item only leaves
 * that state because a person asked it to. */
export async function retryItem(id) {
  await hydrate();
  const item = queue.find((q) => q.id === id);
  if (!item) return;
  item.status = QUEUE_STATUS.PENDING;
  item.nextRetryAt = 0;
  await persist();
  notify();
  processQueue();
}

/** Explicit, user-acknowledged removal of a dead-lettered item. Never
 * called automatically — a permanent failure stays visible until a person
 * decides to discard it. */
export async function discardItem(id) {
  await hydrate();
  const idx = queue.findIndex((q) => q.id === id);
  if (idx === -1) return;
  queue.splice(idx, 1);
  await persist();
  notify();
}

let autoSyncStarted = false;

/** Wire every automatic drain trigger — call once from the app root.
 * Multiple signals, all funneling into the same processQueue(), which is
 * itself guarded by the single `processing` mutex above, so this can never
 * start a second concurrent drain no matter how many triggers fire close
 * together. */
export function startAutoSync() {
  if (autoSyncStarted) return;
  autoSyncStarted = true;

  // Primary trigger: the app's own request-verified online signal — set by
  // api.js whenever a real request actually reaches the server (or fails
  // to), so it doesn't fire a doomed sync attempt against a captive portal
  // or a radio that's "connected" but not truly reachable the way raw
  // NetInfo state can be.
  serverStatus.subscribe(({ online }) => { if (online) processQueue(); });

  // Secondary trigger: device radio state — cheaper/faster than a round
  // trip, still useful as an earlier signal.
  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      processQueue();
    }
  });

  // Foreground trigger — mirrors the same AppState pattern queryClient.js
  // already uses for react-query's focusManager. Without this, backgrounding
  // the app while offline and returning already-online doesn't redrain
  // unless NetInfo separately fires a change event around the same time.
  AppState.addEventListener('change', (status) => {
    if (status === 'active') processQueue();
  });

  // Also try once at startup, in case items were queued last session and
  // connectivity is already up by the time the app opens.
  processQueue();
}

export function isNetworkError(err) {
  // axios: a request that never got a response (no connectivity, DNS
  // failure, timeout before any server reply) has no `err.response` at
  // all — distinct from a request that reached the server and came back
  // with a 4xx/5xx business error, which does.
  return !err?.response;
}
