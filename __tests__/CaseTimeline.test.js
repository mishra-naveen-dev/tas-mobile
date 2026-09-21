/**
 * Collection Visit "Activity & History": the card must show a case's activity
 * to every user the backend lets see it, and say who did each thing.
 * Regression: the two legacy calls were combined with Promise.all and errors
 * swallowed, so ordinary employees (assignment history -> 404) always saw
 * "No activity recorded for this case yet."
 */
import { loadCaseTimeline, buildCaseTimeline } from '../src/utils/caseTimeline';

const UPDATE = { id: 1, status: 'PARTIALLY_COLLECTED', collected_amount: '500.00', employee_name: 'Employee B', employee_employee_id: 'B', created_at: '2026-09-20T09:00:00Z' };
const notFound = () => Promise.reject({ response: { status: 404 } });

describe('loadCaseTimeline', () => {
  test('uses the case_activity endpoint when the backend has it', async () => {
    const api = { getCaseActivity: jest.fn().mockResolvedValue({ data: { results: [{ kind: 'ACTIVITY', id: 1 }] } }) };
    expect(await loadCaseTimeline(api, 7)).toEqual({ events: [{ kind: 'ACTIVITY', id: 1 }] });
    expect(api.getCaseActivity).toHaveBeenCalledWith(7, { page_size: 20 });
  });

  test('an employee whose assignment-history call is refused still gets the activity (the bug)', async () => {
    const api = {
      getCaseActivity: jest.fn(notFound),                                      // older backend
      getCollectionUpdates: jest.fn().mockResolvedValue({ data: { results: [UPDATE] } }),
      getAssignmentHistory: jest.fn(notFound),                                 // 404 for ordinary employees
    };
    const r = await loadCaseTimeline(api, 7);
    expect(r.updates).toEqual([UPDATE]);
    expect(r.history).toEqual([]);
  });

  test('the reverse also holds — history survives a refused updates call', async () => {
    const api = {
      getCaseActivity: jest.fn(notFound),
      getCollectionUpdates: jest.fn(notFound),
      getAssignmentHistory: jest.fn().mockResolvedValue({ data: [{ id: 5 }] }),
    };
    const r = await loadCaseTimeline(api, 7);
    expect(r).toEqual({ updates: [], history: [{ id: 5 }] });
  });

  test('never throws when everything fails', async () => {
    const api = { getCaseActivity: jest.fn(notFound), getCollectionUpdates: jest.fn(notFound), getAssignmentHistory: jest.fn(notFound) };
    await expect(loadCaseTimeline(api, 7)).resolves.toEqual({ updates: [], history: [] });
  });
});

describe('buildCaseTimeline', () => {
  const rows = buildCaseTimeline([
    { kind: 'OWNERSHIP', type: 'TRANSFERRED', id: 3, at: '2026-09-20T10:00:00Z', from: { name: 'Employee C', employee_id: 'C' },
      to: { name: 'Employee D', employee_id: 'D' }, by: { name: 'ACM User', employee_id: 'ACM' }, reason: 'Employee unavailable' },
    { kind: 'ACTIVITY', type: 'COLLECTION', id: 2, at: '2026-09-20T09:00:00Z', status: 'PARTIALLY_COLLECTED', amount: 500,
      performed_by: { name: 'Employee B', employee_id: 'B' }, sync_status: 'SYNCED_LATE', remarks: 'paid half' },
    { kind: 'ACTIVITY', type: 'VISIT', id: 1, at: '2026-09-20T07:00:00Z', status: 'VISITED', amount: null,
      performed_by: { name: 'Employee A', employee_id: 'A' } },
    { kind: 'OWNERSHIP', type: 'ASSIGNED', id: 1, at: '2026-09-20T04:00:00Z', to: { name: 'Employee A', employee_id: 'A' }, by: { name: 'Admin', employee_id: 'SA' } },
  ]);

  test('every entry says who did it', () => {
    expect(rows[0].title).toBe('Transferred Employee C (C) → Employee D (D)');
    expect(rows[0].detail).toBe('By ACM User (ACM) · Reason: Employee unavailable');
    expect(rows[1].title).toBe('PARTIALLY COLLECTED · ₹500');
    expect(rows[1].detail).toBe('By Employee B (B) · recorded offline · paid half');
    expect(rows[2].detail).toBe('By Employee A (A)');
    expect(rows[3].title).toBe('Assigned to Employee A (A)');
  });

  test('keeps the server order and gives each row a unique key', () => {
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.map((r) => r.id)).toEqual(['OWNERSHIP-3', 'ACTIVITY-2', 'ACTIVITY-1', 'OWNERSHIP-1']);
  });

  test('an amount hidden by field policy shows no amount', () => {
    const [row] = buildCaseTimeline([{ kind: 'ACTIVITY', id: 9, at: '2026-09-20T09:00:00Z', status: 'COLLECTED', amount: null, performed_by: { name: 'X', employee_id: 'X1' } }]);
    expect(row.title).toBe('COLLECTED');
  });
});
