import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity, Text } from 'react-native';
import RequestDetailsScreen from './RequestDetailsScreen';

jest.mock('../services/socket', () => ({ getSocket: () => null }));
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));

const makeProps = (offerExpiresAt, onAccept = jest.fn()) => ({
  route: {
    params: {
      trip: {
        id: 'trip-1',
        offerExpiresAt,
        price: 3000,
        pickupAddress: 'Pickup',
        destAddress: 'Destino',
      },
      onAccept,
    },
  },
  navigation: { goBack: jest.fn() },
});

let renderer;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  if (renderer) {
    act(() => renderer.unmount());
    renderer = null;
  }
  jest.useRealTimers();
});

const getAcceptButton = (renderer) => renderer.root
  .findAllByType(TouchableOpacity)
  .find((button) => button.findAllByType(Text).some((text) => text.props.children === 'ACEITAR'));

describe('RequestDetailsScreen offer acceptance', () => {
  it('disables acceptance for an expired offer and never calls the accept handler', async () => {
    const onAccept = jest.fn();
    const props = makeProps(new Date(Date.now() - 1000).toISOString(), onAccept);
    await act(async () => {
      renderer = ReactTestRenderer.create(<RequestDetailsScreen {...props} />);
    });

    expect(getAcceptButton(renderer).props.disabled).toBe(true);
    await act(async () => getAcceptButton(renderer).props.onPress());

    expect(onAccept).not.toHaveBeenCalled();
    expect(props.navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('runs the accept handler only once when the button is tapped repeatedly', async () => {
    const onAccept = jest.fn();
    const props = makeProps(new Date(Date.now() + 60_000).toISOString(), onAccept);
    await act(async () => {
      renderer = ReactTestRenderer.create(<RequestDetailsScreen {...props} />);
    });

    await act(async () => {
      getAcceptButton(renderer).props.onPress();
      getAcceptButton(renderer).props.onPress();
    });

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(props.navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
