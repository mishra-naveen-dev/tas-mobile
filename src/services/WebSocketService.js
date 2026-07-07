import AsyncStorage from '@react-native-async-storage/async-storage';

const WS_URL = 'wss://api.tas.namracred.co.in/ws/notifications/';
const PING_INTERVAL_MS = 25000;    // keepalive ping every 25s (below most proxy 30s timeouts)
const RECONNECT_BASE_MS = 3000;    // first retry after 3s
const RECONNECT_MULTIPLIER = 1.5;  // exponential back-off
const MAX_RECONNECT_ATTEMPTS = 10;

class WebSocketService {
    constructor() {
        this.ws = null;
        this.listeners = new Map();
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this._pingTimer = null;
        this._reconnectTimer = null;
        this._manualDisconnect = false;
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    async connect() {
        const token = await AsyncStorage.getItem('access');
        if (!token) return;
        this._manualDisconnect = false;
        this._openSocket(token);
    }

    disconnect() {
        this._manualDisconnect = true;
        this._stopPing();
        clearTimeout(this._reconnectTimer);
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this._emit('connection:status', { status: 'disconnected' });
    }

    /**
     * Subscribe to a message type. Returns an unsubscribe function.
     * Pass '*' to receive every message regardless of type.
     */
    on(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType).add(callback);
        return () => this.listeners.get(eventType)?.delete(callback);
    }

    off(eventType, callback) {
        this.listeners.get(eventType)?.delete(callback);
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
        };
    }

    // ─── Convenience helpers (mirror SSEClient API) ───────────────────────

    onCorrection(callback) {
        this.on('correction_approved', callback);
        this.on('correction_rejected', callback);
        this.on('correction_created', callback);
    }

    onAllowance(callback) {
        this.on('allowance_approved', callback);
        this.on('allowance_rejected', callback);
        this.on('allowance_created', callback);
    }

    onPunch(callback) { this.on('punch_created', callback); }
    onNotification(callback) { this.on('notification', callback); }

    // ─── Internal ────────────────────────────────────────────────────────────

    _openSocket(token) {
        try {
            this.ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

            this.ws.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this._startPing();
                this._emit('connection:status', { status: 'connected' });
                if (__DEV__) console.log('[WS] Connected');
            };

            this.ws.onmessage = ({ data }) => {
                try {
                    const msg = JSON.parse(data);
                    if (msg.type === 'pong') return;
                    this._emit(msg.type, msg);
                    this._emit('*', msg);
                } catch {}
            };

            this.ws.onerror = (e) => {
                if (__DEV__) console.warn('[WS] Error:', e.message);
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                this._stopPing();
                if (!this._manualDisconnect) {
                    this._scheduleReconnect();
                }
            };
        } catch (e) {
            if (__DEV__) console.error('[WS] Failed to open socket:', e);
            this._scheduleReconnect();
        }
    }

    _startPing() {
        this._stopPing();
        this._pingTimer = setInterval(() => {
            if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, PING_INTERVAL_MS);
    }

    _stopPing() {
        clearInterval(this._pingTimer);
        this._pingTimer = null;
    }

    _scheduleReconnect() {
        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            this._emit('connection:status', { status: 'failed' });
            if (__DEV__) console.warn('[WS] Max reconnect attempts reached');
            return;
        }
        const delay = RECONNECT_BASE_MS * Math.pow(RECONNECT_MULTIPLIER, this.reconnectAttempts);
        this.reconnectAttempts++;
        if (__DEV__) console.log(`[WS] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})`);
        this._reconnectTimer = setTimeout(async () => {
            const token = await AsyncStorage.getItem('access');
            if (token && !this._manualDisconnect) this._openSocket(token);
        }, delay);
    }

    _emit(eventType, data) {
        this.listeners.get(eventType)?.forEach(cb => {
            try { cb(data); } catch {}
        });
    }
}

export default new WebSocketService();
