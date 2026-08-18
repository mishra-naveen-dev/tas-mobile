import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

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
 * Auto-drains whenever NetInfo reports connectivity restored (see
 * `startAutoSync`, called once from App.jsx) and once more on app start, in
 * case something was queued during a previous session.
 */
const STORAGE_KEY = '@tas_offline_queue';

let queue = null; // in-memory mirror, lazily hydrated from AsyncStorage
let processing = false;
const replayers = new Map(); // kind -> async (payload) => void  (throws on failure)
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => {
    try { fn([...queue]); } catch {}
  });
}

async function hydrate() {
  if (queue !== null) return queue;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    queue = raw ? JSON.parse(raw) : [];
  } catch {
    queue = [];
  }
  return queue;
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Best-effort — an AsyncStorage write failure shouldn't block the
    // in-memory queue from still draining this session.
  }
}

/** Register how to replay one `kind` of queued item. Call once per kind,
 * typically at module load of the screen/service that owns that flow. */
export function registerReplayer(kind, fn) {
  replayers.set(kind, fn);
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

/** Drain the queue in order (oldest first). Stops at the first item that
 * still fails so later items don't jump ahead of an earlier one for the
 * same record — the item stays queued and is retried next trigger. A
 * connectivity-only failure (no server response at all) is treated the
 * same way: stop, don't burn through the rest against a dead connection. */
export async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    await hydrate();
    while (queue.length > 0) {
      const item = queue[0];
      const replay = replayers.get(item.kind);
      if (!replay) {
        // No replayer registered (e.g. app restarted and that screen's
        // module never loaded) — leave it queued rather than dropping it.
        break;
      }
      try {
        await replay(item.payload);
        queue.shift();
        await persist();
        notify();
      } catch (err) {
        item.attempts += 1;
        item.lastError = err?.response?.data?.error || err?.message || 'Sync failed';
        await persist();
        notify();
        break; // keep it first-in-line, try again on the next trigger
      }
    }
  } finally {
    processing = false;
  }
}

let autoSyncStarted = false;

/** Wire NetInfo so the queue drains automatically the moment connectivity
 * comes back — call once from the app root. */
export function startAutoSync() {
  if (autoSyncStarted) return;
  autoSyncStarted = true;
  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      processQueue();
    }
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
