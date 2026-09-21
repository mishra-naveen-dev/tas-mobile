/**
 * Legal gate: nothing is pre-selected, Continue stays disabled until every
 * pending document is ticked, the acknowledgement goes to the server, and an
 * unreachable server never locks a field employee out.
 */
import React from 'react';
import { Text } from 'react-native';
import { create, act } from 'react-test-renderer';
import api from '../src/api/api';
import LegalGate from '../src/components/LegalGate';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { getLegalStatus: jest.fn(), acknowledgeLegal: jest.fn() },
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

const PENDING = [
  { id: 1, doc_type: 'TERMS', title: 'Terms & Conditions', version: '1.0', content: 'terms body' },
  { id: 2, doc_type: 'LOCATION_TRACKING', title: 'Location & Tracking Notice', version: '1.0', content: 'loc body' },
];

const mount = async () => {
  let r;
  await act(async () => { r = create(<LegalGate><Text>APP</Text></LegalGate>); });
  await flush();
  return r;
};

describe('LegalGate', () => {
  beforeEach(() => jest.clearAllMocks());

  test('nothing pending -> the app is shown', async () => {
    api.getLegalStatus.mockResolvedValue({ data: { pending: [] } });
    expect(textOf((await mount()).root)).toContain('APP');
  });

  test('server unreachable -> the app is shown (never locked out)', async () => {
    api.getLegalStatus.mockRejectedValue(new Error('offline'));
    expect(textOf((await mount()).root)).toContain('APP');
  });

  test('Continue is disabled until every box is ticked, then acknowledges the versions', async () => {
    api.getLegalStatus.mockResolvedValue({ data: { pending: PENDING } });
    api.acknowledgeLegal.mockResolvedValue({ data: {} });
    const r = await mount();
    expect(textOf(r.root)).not.toContain('APP');
    expect(pressable(r, 'Continue').props.disabled).toBe(true);           // nothing pre-selected

    act(() => { pressable(r, 'Terms & Conditions. (v1.0)').props.onPress(); });
    expect(pressable(r, 'Continue').props.disabled).toBe(true);           // one of two is not enough
    act(() => { pressable(r, 'Tracking Notice. (v1.0)').props.onPress(); });
    expect(pressable(r, 'Continue').props.disabled).toBe(false);

    await act(async () => { pressable(r, 'Continue').props.onPress(); });
    await flush();
    expect(api.acknowledgeLegal).toHaveBeenCalledWith(expect.objectContaining({
      version_ids: [1, 2], app_version: '1.41',
    }));
    expect(textOf(r.root)).toContain('APP');
  });

  test('a failed save keeps the gate up and shows the error', async () => {
    api.getLegalStatus.mockResolvedValue({ data: { pending: [PENDING[0]] } });
    api.acknowledgeLegal.mockRejectedValue({ response: { data: { error: 'nope' } } });
    const r = await mount();
    act(() => { pressable(r, 'Terms & Conditions. (v1.0)').props.onPress(); });
    await act(async () => { pressable(r, 'Continue').props.onPress(); });
    await flush();
    expect(textOf(r.root)).toContain('nope');
    expect(textOf(r.root)).not.toContain('APP');
  });
});
