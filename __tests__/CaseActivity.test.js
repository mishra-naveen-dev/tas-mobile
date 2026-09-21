/**
 * Manager Team Collections + Case Activity screens: what they show from the
 * API (current owner vs last updater, ownership history, employee-wise
 * breakdown, timeline) and the actions they send (employee filter, transfer).
 * The backend decides visibility; these tests pin what the screens do with it.
 */
import React from 'react';
import { create, act } from 'react-test-renderer';
import api from '../src/api/api';
import ManagerCollectionsScreen from '../src/screens/Admin/ManagerCollectionsScreen';
import CaseActivityScreen from '../src/screens/Admin/CaseActivityScreen';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: {
    getCollections: jest.fn(),
    getCaseActivity: jest.fn(),
    employeeAutocomplete: jest.fn(),
    transferCase: jest.fn(),
  },
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => require('react').useEffect(() => cb(), []), // eslint-disable-line
}));
jest.mock('react-native-vector-icons/Feather', () => 'Icon');
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
}));

jest.setTimeout(60000); // first run pays for transforming the React Native preset

// All rendered text under a test instance (strings AND numbers, e.g. "{n} visits").
const textOf = (node) => (typeof node === 'string' ? node : (node.children || []).map(textOf).join(''));
const allText = (renderer) => textOf(renderer.root);
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const press = (renderer, matcher) => {
  const node = renderer.root.findAll((n) => typeof n.props.onPress === 'function' && matcher(n))[0];
  if (!node) throw new Error('nothing pressable matched');
  act(() => { node.props.onPress(); });
};
const hasText = (needle) => (n) => textOf(n).includes(needle);
const input = (renderer, placeholder) =>
  renderer.root.findAll((n) => typeof n.props.onChangeText === 'function' && String(n.props.placeholder || '').startsWith(placeholder))[0];

const ROW = {
  id: 7, loan_id: '23906748', customer_name: 'SOLANKI LILABEN', status: 'PARTIALLY_COLLECTED',
  status_display: 'Partially Collected', assigned_employee_name: 'Employee B', assigned_employee_code: 'B',
  last_updated_by_name: 'Employee C', last_updated_by_code: 'C', last_activity_status: 'PARTIALLY_COLLECTED',
  last_activity_amount: '500.00', last_activity_at: '2026-09-20T09:05:00Z', activity_count: 5,
  branch_name: 'Ahmedabad', region_name: 'West',
};

describe('ManagerCollectionsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getCollections.mockResolvedValue({ data: { count: 1, results: [ROW] } });
  });

  test('shows owner, last updater, last activity and activity count — and asks the API for them', async () => {
    let r;
    await act(async () => { r = create(<ManagerCollectionsScreen navigation={{ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true }} />); });
    await flush();
    const t = allText(r);
    expect(t).toContain('Loan 23906748');
    expect(t).toContain('Employee B (B)');           // current owner
    expect(t).toContain('Employee C (C)');           // last updated by — a different person
    expect(t).toContain('₹500');
    expect(t).toContain('5 activities');
    expect(api.getCollections).toHaveBeenCalledWith(expect.objectContaining({ with_activity: 1, page: 1 }));
  });

  test('tapping a case opens its activity', async () => {
    const navigate = jest.fn();
    let r;
    await act(async () => { r = create(<ManagerCollectionsScreen navigation={{ navigate, goBack: jest.fn(), canGoBack: () => true }} />); });
    await flush();
    press(r, hasText('Loan 23906748'));
    expect(navigate).toHaveBeenCalledWith('CaseActivity', { recordId: 7, loanId: '23906748' });
  });

  test('picking an employee filters by that person on the server', async () => {
    jest.useFakeTimers();
    api.employeeAutocomplete.mockResolvedValue({ data: { results: [
      { id: 42, employee_id: '111105', name: 'BHURIYA ISHWARBHAI', designation: 'Recovery Officer', branch: 'XYZ' },
    ] } });
    let r;
    await act(async () => { r = create(<ManagerCollectionsScreen navigation={{ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true }} />); });
    await flush();

    await act(async () => { input(r, 'Employee (owns or worked)').props.onChangeText('bhur'); });
    await act(async () => { jest.advanceTimersByTime(350); });
    await flush();
    expect(api.employeeAutocomplete).toHaveBeenCalledWith('bhur');
    expect(allText(r)).toContain('BHURIYA ISHWARBHAI');
    expect(allText(r)).toContain('111105');

    api.getCollections.mockClear();
    press(r, hasText('BHURIYA ISHWARBHAI'));
    await flush();
    expect(api.getCollections).toHaveBeenCalledWith(expect.objectContaining({ employee: 42 }));
    jest.useRealTimers();
  });
});

const CASE = {
  case: { id: 7, loan_id: '23906748', customer_name: 'SOLANKI LILABEN', cust_id: 'C1', branch: 'Ahmedabad', region: 'West',
    state: 'GJ', status: 'PARTIALLY_COLLECTED', amount_due: '3000.00', collected_amount: '500.00',
    current_owner: { id: 11, employee_id: 'D', name: 'Employee D' } },
  owners: [
    { employee: { id: 8, employee_id: 'A', name: 'Employee A' }, from: '2026-09-20T04:00:00Z', to: '2026-09-20T10:40:00Z', is_current: false, reason: '' },
    { employee: { id: 11, employee_id: 'D', name: 'Employee D' }, from: '2026-09-20T10:40:00Z', to: null, is_current: true, reason: 'Employee unavailable' },
  ],
  breakdown: [
    { user_id: 8, employee_id: 'A', name: 'Employee A', designation: 'Recovery Officer', visits: 2, collections: 1, amount: 2000, last_at: '2026-09-20T06:00:00Z' },
    { user_id: 11, employee_id: 'D', name: 'Employee D', designation: 'Recovery Officer', visits: 1, collections: 1, amount: 1500, last_at: '2026-09-20T11:00:00Z' },
  ],
  totals: { updates: 5, visits: 3, collections: 2, employees: 2, amount: 3500 },
  count: 3, page: 1, page_size: 15,
  results: [
    { kind: 'OWNERSHIP', type: 'TRANSFERRED', id: 2, at: '2026-09-20T10:40:00Z', from: { name: 'Employee A', employee_id: 'A' },
      to: { name: 'Employee D', employee_id: 'D' }, by: { name: 'ACM User', employee_id: 'ACM' }, reason: 'Employee unavailable', ip: '10.0.0.1' },
    { kind: 'ACTIVITY', type: 'COLLECTION', id: 9, at: '2026-09-20T06:00:00Z', status: 'COLLECTED', previous_status: 'VISITED', amount: 2000,
      performed_by: { name: 'Employee A', employee_id: 'A', designation: 'Recovery Officer' }, owner_at_time: { name: 'Employee A', employee_id: 'A' },
      sync_status: 'SYNCED_LATE', synced_at: '2026-09-20T08:00:00Z' },
    { kind: 'OWNERSHIP', type: 'ASSIGNED', id: 1, at: '2026-09-20T04:00:00Z', to: { name: 'Employee A', employee_id: 'A' }, by: { name: 'Admin', employee_id: 'SA' } },
  ],
};

describe('CaseActivityScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getCaseActivity.mockResolvedValue({ data: CASE });
  });
  const mount = async () => {
    let r;
    await act(async () => {
      r = create(<CaseActivityScreen navigation={{ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true }} route={{ params: { recordId: 7 } }} />);
    });
    await flush();
    return r;
  };

  test('owner, ownership history, per-employee breakdown and the timeline are all shown', async () => {
    const t = allText(await mount());
    expect(t).toContain('Employee D (D)');                      // current owner
    expect(t).toContain('· current');
    expect(t).toContain('Employee A (A)');                      // previous owner still listed
    expect(t).toContain('3 visits');                            // totals span both owners
    expect(t).toContain('₹3,500');
    expect(t).toContain('2 visits');                            // A's own breakdown row
    expect(t).toContain('Transferred');
    expect(t).toContain('Employee A (A) → ');
    expect(t).toContain('Reason: Employee unavailable');
    expect(t).toContain('VISITED → COLLECTED');                 // previous → new status
    expect(t).toContain('Recorded offline');                    // synced-late marker
    expect(api.getCaseActivity).toHaveBeenCalledWith(7, expect.objectContaining({ page: 1 }));
  });

  test('transfer needs a new employee and a reason, shows a confirmation, then sends the transfer', async () => {
    jest.useFakeTimers();
    api.employeeAutocomplete.mockResolvedValue({ data: { results: [
      { id: 12, employee_id: 'E', name: 'Employee E', designation: 'Recovery Officer', branch: 'Ahmedabad' },
    ] } });
    api.transferCase.mockResolvedValue({ data: { transferred: 1 } });
    const r = await mount();

    const review = () => r.root.findAll((n) => typeof n.props.onPress === 'function' && textOf(n).includes('Review transfer'))[0];
    expect(review().props.disabled).toBe(true);                 // nothing chosen yet

    await act(async () => { input(r, 'New employee').props.onChangeText('emp'); });
    await act(async () => { jest.advanceTimersByTime(350); });
    await flush();
    press(r, hasText('Employee E'));
    await act(async () => { input(r, 'Reason (required)').props.onChangeText('Employee unavailable'); });
    expect(review().props.disabled).toBe(false);

    press(r, hasText('Review transfer'));
    expect(allText(r)).toContain('Confirm transfer');
    expect(allText(r)).toContain('Current: Employee D (D)');
    expect(allText(r)).toContain('New: Employee E (E)');

    await act(async () => { press(r, hasText('Confirm transfer')); });
    await flush();
    expect(api.transferCase).toHaveBeenCalledWith(7, 12, 'Employee unavailable');
    jest.useRealTimers();
  });

  test('a backend refusal is shown, not swallowed', async () => {
    jest.useFakeTimers();
    api.employeeAutocomplete.mockResolvedValue({ data: { results: [{ id: 12, employee_id: 'E', name: 'Employee E' }] } });
    api.transferCase.mockRejectedValue({ response: { data: { error: 'You do not have permission to assign customers.' } } });
    const r = await mount();
    await act(async () => { input(r, 'New employee').props.onChangeText('emp'); });
    await act(async () => { jest.advanceTimersByTime(350); });
    await flush();
    press(r, hasText('Employee E'));
    await act(async () => { input(r, 'Reason (required)').props.onChangeText('x'); });
    press(r, hasText('Review transfer'));
    await act(async () => { press(r, hasText('Confirm transfer')); });
    await flush();
    expect(allText(r)).toContain('You do not have permission to assign customers.');
    jest.useRealTimers();
  });
});
