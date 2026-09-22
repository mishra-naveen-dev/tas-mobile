/**
 * Legal gate (v1.0 spec §5-§7, §17):
 *  - exact title/subtitle/checkbox copy, nothing preselected,
 *  - "Accept & Continue" stays disabled until every pending doc is ticked,
 *  - the acknowledgement is sent to the server and the app opens only when
 *    the server's own re-check says nothing is pending,
 *  - FAIL CLOSED: an unreachable policy endpoint shows an error + Retry
 *    instead of silently opening the app (§17).
 */
import React from 'react';
import { Text, BackHandler } from 'react-native';
import { create, act } from 'react-test-renderer';
import api, { setLegalRequiredCallback } from '../src/api/api';
import LegalGate, { GATE_TITLE, GATE_SUBTITLE, ACCEPT_LABEL, CHECK_TEXT } from '../src/components/LegalGate';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { getLegalStatus: jest.fn(), acknowledgeLegal: jest.fn() },
  setLegalRequiredCallback: jest.fn(),
  resetLegalRequiredHandler: jest.fn(),
}));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ logout: jest.fn() }) }));
jest.mock('react-native-vector-icons/Feather', () => 'Icon');
jest.mock('react-native-device-info', () => ({ getVersion: () => '1.41' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }) => children }));

jest.setTimeout(60000);

const textOf = (n) => (typeof n === 'string' ? n : (n.children || []).map(textOf).join(''));
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const pressable = (r, needle) =>
  r.root.findAll((n) => typeof n.props.onPress === 'function' && textOf(n).includes(needle))[0];

const DOC1 = {
  id: 1, doc_type: 'TERMS', title: 'Terms & Conditions', version: '1.0',
  content: 'terms body', mandatory: true, status: 'published', acknowledged: false,
};
const DOC2 = {
  id: 2, doc_type: 'LOCATION_TRACKING', title: 'Location & Tracking Notice', version: '1.0',
  content: 'loc body', mandatory: true, status: 'published', acknowledged: false,
};
const PENDING = [DOC1, DOC2];

const status = (pending, extra = {}) => ({
  requires_acknowledgement: pending.length > 0,
  pending,
  documents: PENDING.map((d) => ({ ...d, acknowledged: !pending.some((p) => p.id === d.id) })),
  ...extra,
});

const mount = async () => {
  let r;
  await act(async () => { r = create(<LegalGate><Text>APP</Text></LegalGate>); });
  await flush();
  return r;
};

describe('LegalGate', () => {
  beforeEach(() => jest.clearAllMocks());

  test('exact §5 title/subtitle and §7 checkbox labels are rendered', async () => {
    api.getLegalStatus.mockResolvedValue({ data: status(PENDING) });
    const r = await mount();
    const t = textOf(r.root);
    expect(t).toContain(GATE_TITLE);
    expect(t).toContain(GATE_SUBTITLE);
    expect(t).toContain(CHECK_TEXT.TERMS);
    expect(t).toContain(CHECK_TEXT.LOCATION_TRACKING);
    expect(t).toContain(ACCEPT_LABEL);
    expect(textOf(r.root)).not.toContain('APP');
  });

  test('nothing pending -> the app is shown', async () => {
    api.getLegalStatus.mockResolvedValue({ data: status([]) });
    expect(textOf((await mount()).root)).toContain('APP');
  });

  test('server unreachable -> FAIL CLOSED: error + Retry, app not shown (§17)', async () => {
    api.getLegalStatus.mockRejectedValue(new Error('offline'));
    const r = await mount();
    const t = textOf(r.root);
    expect(t).not.toContain('APP');
    expect(t).toContain('Unable to verify legal document status');
    expect(pressable(r, 'Retry')).toBeTruthy();
  });

  test('a 403 LEGAL_ACKNOWLEDGEMENT_REQUIRED re-opens the gate via the API callback', async () => {
    api.getLegalStatus.mockResolvedValue({ data: status([]) });
    const r = await mount();
    expect(textOf(r.root)).toContain('APP');
    expect(setLegalRequiredCallback).toHaveBeenCalled();

    // mid-session publish -> api.js invokes the callback with the new status
    api.getLegalStatus.mockResolvedValue({ data: status(PENDING) });
    await act(async () => { setLegalRequiredCallback.mock.calls.at(-1)[0](); });
    await flush();
    expect(textOf(r.root)).not.toContain('APP');
    expect(textOf(r.root)).toContain(ACCEPT_LABEL);
  });

  test('Accept & Continue is disabled until every box is ticked, then acknowledges the versions', async () => {
    api.getLegalStatus.mockResolvedValue({ data: status(PENDING) });
    api.acknowledgeLegal.mockResolvedValue({ data: status([]) });
    const r = await mount();

    // nothing preselected (§7)
    expect(pressable(r, ACCEPT_LABEL).props.disabled).toBe(true);

    act(() => { pressable(r, CHECK_TEXT.TERMS).props.onPress(); });
    expect(pressable(r, ACCEPT_LABEL).props.disabled).toBe(true); // one of two not enough
    act(() => { pressable(r, CHECK_TEXT.LOCATION_TRACKING).props.onPress(); });
    expect(pressable(r, ACCEPT_LABEL).props.disabled).toBe(false);

    await act(async () => { pressable(r, ACCEPT_LABEL).props.onPress(); });
    await flush();
    expect(api.acknowledgeLegal).toHaveBeenCalledWith(expect.objectContaining({
      version_ids: [1, 2], app_version: '1.41', platform: expect.any(String),
    }));
    // brief success state (§16), then the app opens
    expect(textOf(r.root)).toContain('All required documents acknowledged.');
    await act(async () => { await new Promise((res) => setTimeout(res, 800)); });
    await flush();
    expect(textOf(r.root)).toContain('APP');
  });

  test('a failed save keeps the gate up and shows the error', async () => {
    api.getLegalStatus.mockResolvedValue({ data: status([DOC1]) });
    api.acknowledgeLegal.mockRejectedValue({ response: { data: { error: 'nope' } } });
    const r = await mount();
    act(() => { pressable(r, CHECK_TEXT.TERMS).props.onPress(); });
    await act(async () => { pressable(r, ACCEPT_LABEL).props.onPress(); });
    await flush();
    expect(textOf(r.root)).toContain('nope');
    expect(textOf(r.root)).not.toContain('APP');
  });

  test('server re-check still pending after save -> stays blocked (never trusts local state)', async () => {
    api.getLegalStatus.mockResolvedValue({ data: status(PENDING) });
    api.acknowledgeLegal.mockResolvedValue({ data: status(PENDING) });
    const r = await mount();
    act(() => { pressable(r, CHECK_TEXT.TERMS).props.onPress(); });
    act(() => { pressable(r, CHECK_TEXT.LOCATION_TRACKING).props.onPress(); });
    await act(async () => { pressable(r, ACCEPT_LABEL).props.onPress(); });
    await flush();
    expect(textOf(r.root)).not.toContain('APP');
    expect(textOf(r.root)).toContain('still require acknowledgement');
  });

  test('Android Back is captured while blocked (must not reach Home)', async () => {
    api.getLegalStatus.mockResolvedValue({ data: status(PENDING) });
    const addSpy = jest.spyOn(BackHandler, 'addEventListener');
    const r = await mount();
    expect(addSpy).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
    const handler = addSpy.mock.calls.at(-1)[1];
    expect(handler()).toBe(true); // stay on the gate
    addSpy.mockRestore();
    await act(async () => { r.unmount(); });
  });

  test('already acknowledged documents show an Acknowledged badge, no checkbox', async () => {
    const acked = { ...DOC1, acknowledged: true };
    api.getLegalStatus.mockResolvedValue({
      data: { requires_acknowledgement: true, pending: [DOC2], documents: [acked, DOC2] },
    });
    const r = await mount();
    const t = textOf(r.root);
    expect(t).toContain('Acknowledged');
    expect(t).not.toContain(CHECK_TEXT.TERMS); // no checkbox for the acked doc
    expect(t).toContain(CHECK_TEXT.LOCATION_TRACKING);
  });
});
