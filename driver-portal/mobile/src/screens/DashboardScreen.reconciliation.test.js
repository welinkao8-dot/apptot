import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import { emitSocketCommand } from '../services/socketCommands';
import DashboardScreen from './DashboardScreen';

jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../services/socket', () => ({ connectSocket: jest.fn(), disconnectSocket: jest.fn() }));
jest.mock('../services/socketCommands', () => ({ emitSocketCommand: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock('react-native-haptic-feedback', () => ({ __esModule: true, default: { trigger: jest.fn() } }));
jest.mock('react-native-reanimated', () => ({
    __esModule: true,
    default: { View: 'View' },
    useSharedValue: () => ({ value: 1 }),
    useAnimatedStyle: () => ({}),
    withRepeat: () => ({}),
    withSequence: () => ({}),
    withTiming: () => ({}),
    interpolate: () => 1,
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => 'Icon' }));
jest.mock('../components/ride/GoingToClientView', () => ({
    __esModule: true,
    default: ({ activeTrip }) => require('react').createElement(require('react-native').Text, null, `ACTIVE:${activeTrip.id}`),
}));
jest.mock('../components/ride/OngoingRideView', () => ({
    __esModule: true,
    default: ({ activeTrip, onFinishRide }) => require('react').createElement(
        require('react-native').View,
        null,
        require('react').createElement(require('react-native').Text, null, `ONGOING:${activeTrip.id}`),
        require('react').createElement(
            require('react-native').TouchableOpacity,
            { onPress: onFinishRide },
            require('react').createElement(require('react-native').Text, null, 'FINISH_RIDE'),
        ),
    ),
}));
jest.mock('../components/ride/AwaitingPaymentView', () => ({
    __esModule: true,
    default: ({ activeTrip, onConfirmPayment }) => require('react').createElement(
        require('react-native').View,
        null,
        require('react').createElement(require('react-native').Text, null, `FINAL_FARE:${activeTrip?.final_fare ?? 'missing'}`),
        require('react').createElement(
            require('react-native').TouchableOpacity,
            { onPress: onConfirmPayment },
            require('react').createElement(require('react-native').Text, null, 'CONFIRM_PAYMENT'),
        ),
    ),
}));

describe('DashboardScreen active ride reconciliation', () => {
    let renderer;
    let handlers;
    let resolveTripRequest;
    let tripRequest;

    beforeEach(() => {
        handlers = new Map();
        tripRequest = new Promise((resolve) => { resolveTripRequest = resolve; });
        connectSocket.mockReturnValue({
            connected: true,
            on: jest.fn((event, handler) => handlers.set(event, handler)),
            off: jest.fn(),
            emit: jest.fn(),
        });
        api.get.mockImplementation((path) => {
            if (path.startsWith('/trips/stats/')) return Promise.resolve({ data: {} });
            if (path === '/trips/trip-1') return tripRequest;
            return Promise.resolve({ data: [] });
        });
    });

    afterEach(() => {
        if (renderer) {
            act(() => renderer.unmount());
            renderer = null;
        }
        jest.clearAllMocks();
    });

    it('does not restore a cached ride when its reconciliation response arrives after cancellation', async () => {
        const cachedTrip = { id: 'trip-1', status: 'accepted', coords: { lat: -8.8, lng: 13.2 } };
        await act(async () => {
            renderer = ReactTestRenderer.create(
                <AuthContext.Provider value={{ user: { id: 'driver-1' }, token: 'token' }}>
                    <DashboardScreen navigation={{ addListener: () => jest.fn() }} />
                </AuthContext.Provider>,
            );
        });

        await act(async () => { handlers.get('restore_ride')(cachedTrip); });
        expect(api.get).toHaveBeenCalledWith('/trips/trip-1');
        await act(async () => { handlers.get('trip_cancelled')(); });

        await act(async () => {
            resolveTripRequest({ data: { ...cachedTrip, driver_id: 'driver-1', status: 'accepted' } });
            await tripRequest;
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(renderer.root.findAllByType(Text).some((node) => node.props.children === 'ACTIVE:trip-1')).toBe(false);
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@tot_active_trip');
    });

    it('keeps a newer restored ride when an older reconciliation response arrives later', async () => {
        let resolveNewTripRequest;
        const newTripRequest = new Promise((resolve) => { resolveNewTripRequest = resolve; });
        api.get.mockImplementation((path) => {
            if (path.startsWith('/trips/stats/')) return Promise.resolve({ data: {} });
            if (path === '/trips/trip-1') return tripRequest;
            if (path === '/trips/trip-2') return newTripRequest;
            return Promise.resolve({ data: [] });
        });
        await act(async () => {
            renderer = ReactTestRenderer.create(
                <AuthContext.Provider value={{ user: { id: 'driver-1' }, token: 'token' }}>
                    <DashboardScreen navigation={{ addListener: () => jest.fn() }} />
                </AuthContext.Provider>,
            );
        });

        await act(async () => { handlers.get('restore_ride')({ id: 'trip-1', status: 'accepted' }); });
        await act(async () => { handlers.get('trip_cancelled')(); });
        await act(async () => { handlers.get('restore_ride')({ id: 'trip-2', status: 'accepted' }); });

        await act(async () => {
            resolveNewTripRequest({ data: { id: 'trip-2', driver_id: 'driver-1', status: 'accepted' } });
            await newTripRequest;
            await Promise.resolve();
            await Promise.resolve();
        });
        await act(async () => {
            resolveTripRequest({ data: { id: 'trip-1', driver_id: 'driver-1', status: 'accepted' } });
            await tripRequest;
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(renderer.root.findAllByType(Text).some((node) => node.props.children === 'ACTIVE:trip-2')).toBe(true);
        expect(renderer.root.findAllByType(Text).some((node) => node.props.children === 'ACTIVE:trip-1')).toBe(false);
    });

    it('runs a newer reconciliation when a fresh socket snapshot arrives for the same trip', async () => {
        let resolveNewTripRequest;
        const newTripRequest = new Promise((resolve) => { resolveNewTripRequest = resolve; });
        let tripFetchCount = 0;
        api.get.mockImplementation((path) => {
            if (path.startsWith('/trips/stats/')) return Promise.resolve({ data: {} });
            if (path === '/trips/trip-1') return tripFetchCount++ === 0 ? tripRequest : newTripRequest;
            return Promise.resolve({ data: [] });
        });
        await act(async () => {
            renderer = ReactTestRenderer.create(
                <AuthContext.Provider value={{ user: { id: 'driver-1' }, token: 'token' }}>
                    <DashboardScreen navigation={{ addListener: () => jest.fn() }} />
                </AuthContext.Provider>,
            );
        });

        await act(async () => { handlers.get('restore_ride')({ id: 'trip-1', status: 'accepted' }); });
        await act(async () => { handlers.get('restore_ride')({ id: 'trip-1', status: 'ongoing' }); });
        expect(tripFetchCount).toBe(2);

        await act(async () => {
            resolveNewTripRequest({ data: { id: 'trip-1', driver_id: 'driver-1', status: 'ongoing' } });
            await newTripRequest;
            await Promise.resolve();
            await Promise.resolve();
        });
        await act(async () => {
            resolveTripRequest({ data: { id: 'trip-1', driver_id: 'driver-1', status: 'accepted' } });
            await tripRequest;
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(renderer.root.findAllByType(Text).some((node) => node.props.children === 'ONGOING:trip-1')).toBe(true);
        expect(renderer.root.findAllByType(Text).some((node) => node.props.children === 'ACTIVE:trip-1')).toBe(false);
    });

    it('does not persist a reconciliation response after the screen unmounts', async () => {
        await act(async () => {
            renderer = ReactTestRenderer.create(
                <AuthContext.Provider value={{ user: { id: 'driver-1' }, token: 'token' }}>
                    <DashboardScreen navigation={{ addListener: () => jest.fn() }} />
                </AuthContext.Provider>,
            );
        });
        await act(async () => { handlers.get('restore_ride')({ id: 'trip-1', status: 'accepted' }); });
        expect(api.get).toHaveBeenCalledWith('/trips/trip-1');

        act(() => {
            renderer.unmount();
            renderer = null;
        });
        AsyncStorage.setItem.mockClear();

        await act(async () => {
            resolveTripRequest({ data: { id: 'trip-1', driver_id: 'driver-1', status: 'accepted' } });
            await tripRequest;
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('loads the persisted final fare after a successful finish ACK before confirming cash payment', async () => {
        let tripFetchCount = 0;
        api.get.mockImplementation((path) => {
            if (path.startsWith('/trips/stats/')) return Promise.resolve({ data: {} });
            if (path === '/trips/trip-1') {
                tripFetchCount += 1;
                return Promise.resolve({ data: tripFetchCount === 1
                    ? { id: 'trip-1', driver_id: 'driver-1', status: 'ongoing', estimated_fare: '700.00', final_fare: null }
                    : { id: 'trip-1', driver_id: 'driver-1', status: 'completed', estimated_fare: '700.00', final_fare: '925.50' } });
            }
            if (path === '/trips/trip-1/payment') return Promise.resolve({ data: { status: 'pending' } });
            return Promise.resolve({ data: [] });
        });

        await act(async () => {
            renderer = ReactTestRenderer.create(
                <AuthContext.Provider value={{ user: { id: 'driver-1' }, token: 'token' }}>
                    <DashboardScreen navigation={{ addListener: () => jest.fn() }} />
                </AuthContext.Provider>,
            );
        });
        await act(async () => {
            handlers.get('restore_ride')({ id: 'trip-1', status: 'ongoing', price: '700.00' });
            await Promise.resolve();
            await Promise.resolve();
        });

        const finishButton = renderer.root.findAllByType(TouchableOpacity)
            .find((node) => node.findAllByType(Text).some((child) => child.props.children === 'FINISH_RIDE'));
        expect(finishButton).toBeDefined();
        await act(async () => { await finishButton.props.onPress(); });

        expect(tripFetchCount).toBe(2);
        expect(renderer.root.findAllByType(Text).some((node) => node.props.children === 'FINAL_FARE:925.50')).toBe(true);
        const confirmButton = renderer.root.findAllByType(TouchableOpacity)
            .find((node) => node.findAllByType(Text).some((child) => child.props.children === 'CONFIRM_PAYMENT'));
        await act(async () => { await confirmButton.props.onPress(); });

        expect(emitSocketCommand).toHaveBeenCalledWith(expect.anything(), 'confirm_cash_payment', {
            tripId: 'trip-1', amount: '925.50',
        });
    });

    it.each([
        ['missing', null],
        ['malformed', 'not-a-fare'],
    ])('does not submit a stale estimate when final_fare is %s', async (_case, finalFare) => {
        api.get.mockImplementation((path) => {
            if (path.startsWith('/trips/stats/')) return Promise.resolve({ data: {} });
            if (path === '/trips/trip-1') return tripRequest;
            if (path === '/trips/trip-1/payment') return Promise.resolve({ data: { status: 'pending' } });
            return Promise.resolve({ data: [] });
        });
        await act(async () => {
            renderer = ReactTestRenderer.create(
                <AuthContext.Provider value={{ user: { id: 'driver-1' }, token: 'token' }}>
                    <DashboardScreen navigation={{ addListener: () => jest.fn() }} />
                </AuthContext.Provider>,
            );
        });

        await act(async () => { handlers.get('restore_ride')({ id: 'trip-1', status: 'completed', price: '700.00' }); });
        await act(async () => {
            resolveTripRequest({ data: {
                id: 'trip-1',
                driver_id: 'driver-1',
                status: 'completed',
                final_fare: finalFare,
                estimated_fare: '850.00',
            } });
            await tripRequest;
            await Promise.resolve();
            await Promise.resolve();
        });

        const confirmButton = renderer.root.findAllByType(TouchableOpacity)
            .find((node) => node.findAllByType(Text).some((child) => child.props.children === 'CONFIRM_PAYMENT'));
        expect(confirmButton).toBeDefined();
        await act(async () => { confirmButton.props.onPress(); });

        expect(emitSocketCommand).not.toHaveBeenCalled();
    });
});
