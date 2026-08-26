/**
 * Covers the "isActive restore" distance calculation in PunchContext.js's
 * fetchTodayPunches() — on app restart while still punched in, the base
 * distance fed to LocationService must be last punch-in's
 * total_distance_day PLUS the in-progress LiveSession's total_distance
 * (everything walked since that punch-in), not the live session's total
 * alone. Reading only the live session silently drops every earlier,
 * already-closed session's distance from the same day — the exact bug
 * behind an employee who punched in/out more than once showing far less
 * distance than they actually traveled after a restart.
 */
import React from 'react';
import { create, act } from 'react-test-renderer';
import { PunchProvider } from '../src/context/PunchContext';
import api from '../src/api/api';
import LocationService from '../src/services/LocationService';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    getActiveLiveSession: jest.fn(),
    getLastAutoClosure: jest.fn(() => Promise.resolve({ data: { pending: false } })),
  },
}));

jest.mock('../src/services/LocationService', () => ({
  __esModule: true,
  default: {
    setBaseDistance: jest.fn(),
    getTotalDistance: jest.fn(() => 0),
  },
}));

jest.mock('../src/services/GeocodingService', () => ({ reverseGeocode: jest.fn() }));
jest.mock('../src/services/LiveTrackingService', () => ({}));
jest.mock('../src/hooks/useFieldActivityLocation', () => ({ captureFieldActivityLocation: jest.fn() }));
jest.mock('../src/services/OfflineQueue', () => ({
  enqueue: jest.fn(),
  isNetworkError: jest.fn(() => false),
  registerReplayer: jest.fn(),
  generateTransactionId: jest.fn(() => 'txn-test'),
}));

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('PunchContext fetchTodayPunches distance restore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getLastAutoClosure.mockResolvedValue({ data: { pending: false } });
  });

  test('sums punch-chain snapshot with the active LiveSession distance, not just the live one', async () => {
    api.get.mockResolvedValue({
      data: [{
        id: 1,
        punch_type: 'PUNCH_IN',
        punched_at: new Date().toISOString(),
        total_distance_day: 12.3, // distance already banked as of punch-in
      }],
    });
    api.getActiveLiveSession.mockResolvedValue({
      data: { active: true, session: { total_distance: 4.7 } }, // walked since punch-in
    });

    await act(async () => {
      create(<PunchProvider><></></PunchProvider>);
    });
    await flush();

    // First call seeds the punch-chain snapshot alone (pre-live-session read).
    expect(LocationService.setBaseDistance).toHaveBeenCalledWith(12.3);
    // Second call must be the SUM (12.3 + 4.7), not 4.7 alone.
    const calls = LocationService.setBaseDistance.mock.calls.map(c => c[0]);
    expect(calls[calls.length - 1]).toBeCloseTo(17.0, 5);
  });

  test('no active LiveSession: base distance stays the punch-chain snapshot', async () => {
    api.get.mockResolvedValue({
      data: [{
        id: 2,
        punch_type: 'PUNCH_IN',
        punched_at: new Date().toISOString(),
        total_distance_day: 8.0,
      }],
    });
    api.getActiveLiveSession.mockResolvedValue({ data: { active: false } });

    await act(async () => {
      create(<PunchProvider><></></PunchProvider>);
    });
    await flush();

    const calls = LocationService.setBaseDistance.mock.calls.map(c => c[0]);
    expect(calls[calls.length - 1]).toBe(8.0);
  });

  test('not currently punched in: base distance resets to 0', async () => {
    api.get.mockResolvedValue({
      data: [{
        id: 3,
        punch_type: 'PUNCH_OUT',
        punched_at: new Date().toISOString(),
        total_distance_day: 20.0,
      }],
    });

    await act(async () => {
      create(<PunchProvider><></></PunchProvider>);
    });
    await flush();

    expect(LocationService.setBaseDistance).toHaveBeenCalledWith(0);
    expect(api.getActiveLiveSession).not.toHaveBeenCalled();
  });
});
