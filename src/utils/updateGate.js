// Coordination hub between UpdatePrompt and the rest of the app.
//
// (1) Launch sequencing: DailyPunchPrompt ("Start your day with first
//     punch") must not appear until the update-check flow has had its
//     say — a mandatory update blocks it indefinitely; anything else
//     (optional update, or none) resolves the gate immediately so normal
//     app flow continues right away.
// (2) Real-time re-check: a push notification telling an already-open,
//     already-logged-in session that a new release just went live should
//     trigger an immediate check instead of waiting for the 20-minute
//     poll interval or the next foreground event.

let gateResolved = false;
let gateListeners = [];
let recheckFn = null;

export function markUpdateGateResolved() {
    if (gateResolved) return;
    gateResolved = true;
    const listeners = gateListeners;
    gateListeners = [];
    listeners.forEach((cb) => cb());
}

export function isUpdateGateResolved() {
    return gateResolved;
}

export function onUpdateGateResolved(cb) {
    if (gateResolved) {
        cb();
        return () => {};
    }
    gateListeners.push(cb);
    return () => {
        gateListeners = gateListeners.filter((l) => l !== cb);
    };
}

export function registerUpdateRecheck(fn) {
    recheckFn = fn;
    return () => {
        if (recheckFn === fn) recheckFn = null;
    };
}

export function triggerUpdateRecheck() {
    if (recheckFn) recheckFn();
}
