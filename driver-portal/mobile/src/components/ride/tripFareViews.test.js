import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import AwaitingPaymentView from './AwaitingPaymentView';
import OngoingRideView from './OngoingRideView';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

describe('ride fare views', () => {
    let renderer;

    afterEach(() => {
        if (renderer) {
            act(() => renderer.unmount());
            renderer = null;
        }
    });

    it('disables payment confirmation when server final fare is malformed despite cached quotes', () => {
        const onConfirmPayment = jest.fn();
        act(() => {
            renderer = ReactTestRenderer.create(
                <AwaitingPaymentView
                    activeTrip={{ final_fare: 'broken', current_fare: '850.00', price: '800.00' }}
                    onConfirmPayment={onConfirmPayment}
                />,
            );
        });

        const text = renderer.root.findAllByType(Text).map((node) => node.props.children);
        const confirmButton = renderer.root.findByType(TouchableOpacity);
        expect(text).toContain('Indisponível');
        expect(confirmButton.props.disabled).toBe(true);
        expect(text).not.toContain('850.00');
        expect(text).not.toContain('800.00');
    });

    it('requires a persisted final fare before enabling payment confirmation', () => {
        act(() => {
            renderer = ReactTestRenderer.create(
                <AwaitingPaymentView activeTrip={{ final_fare: null, current_fare: '850.00', price: '800.00' }} />,
            );
        });

        const text = renderer.root.findAllByType(Text).map((node) => node.props.children);
        expect(text).toContain('Indisponível');
        expect(renderer.root.findByType(TouchableOpacity).props.disabled).toBe(true);
    });

    it('does not show a stale or zero amount in the ongoing ride view when final fare is malformed', () => {
        act(() => {
            renderer = ReactTestRenderer.create(
                <OngoingRideView
                    activeTrip={{ final_fare: 'Infinity', current_fare: '850.00', price: '800.00' }}
                />,
            );
        });

        const text = renderer.root.findAllByType(Text).map((node) => node.props.children);
        expect(text).toContain('Indisponível');
        expect(text.some((value) => typeof value === 'string' && value.startsWith('Kz '))).toBe(false);
        expect(text).not.toContain('NaN');
    });

    it('shows the persisted final fare in both views instead of stale quote values', () => {
        const activeTrip = { final_fare: '1250.50', current_fare: '850.00', price: '800.00' };
        act(() => {
            renderer = ReactTestRenderer.create(<AwaitingPaymentView activeTrip={activeTrip} />);
        });
        expect(renderer.root.findAllByType(Text).map((node) => node.props.children)).toContain('1250.50');
        act(() => renderer.unmount());
        renderer = null;

        act(() => {
            renderer = ReactTestRenderer.create(<OngoingRideView activeTrip={activeTrip} />);
        });
        expect(renderer.root.findAllByType(Text).map((node) => node.props.children)).toContain('Kz 1.250,50');
    });
});
