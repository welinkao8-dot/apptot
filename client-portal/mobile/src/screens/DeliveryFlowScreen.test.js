jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-geolocation-service', () => ({ __esModule: true, default: {} }));
jest.mock('../services/currentLocation', () => ({ getCurrentClientLocation: jest.fn() }));
jest.mock('../components/HereMap', () => {
  const React = require('react');
  globalThis.__deliveryMapMethods = {
    setMarkers: jest.fn(), setUserLocation: jest.fn(), drawRoute: jest.fn(), clearMap: jest.fn(),
  };
  return { __esModule: true, default: React.forwardRef((props, ref) => {
    globalThis.__deliveryFlowMapProps = props;
    React.useImperativeHandle(ref, () => globalThis.__deliveryMapMethods);
    return null;
  }) };
});
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' }, token: 'token' }) }));
jest.mock('../services/socket', () => ({ __esModule: true, default: { connected: true, on: jest.fn(), off: jest.fn(), emit: jest.fn(), timeout: jest.fn(() => ({ emit: jest.fn() })) }, setSocketToken: jest.fn() }));
jest.mock('../services/api', () => ({ __esModule: true, default: {
  get: jest.fn().mockResolvedValue({ data: [] }),
  post: jest.fn(),
  getServices: jest.fn().mockResolvedValue({ data: [{ id: 1, name: 'Estafeta', category: 'delivery' }] }),
} }));
jest.mock('../services/hereService', () => ({ __esModule: true, default: { fetchSuggestions: jest.fn(), reverseGeocode: jest.fn() } }));
jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));

import { normalizeSuggestionSearchResult } from './DeliveryFlowScreen';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput, TouchableOpacity } from 'react-native';
import api from '../services/api';
import socket from '../services/socket';
import hereService from '../services/hereService';
import { getCurrentClientLocation } from '../services/currentLocation';

describe('delivery address search feedback', () => {
  it.each([
    ['no_results', 'Nenhum endereço encontrado', false],
    ['timeout', 'A pesquisa demorou demasiado', true],
    ['offline', 'Sem ligação à internet', true],
    ['rate_limited', 'Muitas pesquisas em pouco tempo', true],
    ['server_error', 'temporariamente indisponível', true],
    ['request_error', 'Não foi possível pesquisar este endereço', false],
  ])('maps %s to a clear message and retry policy', (status, message, retryable) => {
    const result = normalizeSuggestionSearchResult(Object.assign([], { status, retryable }));

    expect(result.status).toBe(status);
    expect(result.message).toContain(message);
    expect(result.retryable).toBe(retryable);
  });

  it('keeps suggestions returned with a retryable failure', () => {
    const suggestions = [{ id: 'known-result', name: 'Talatona' }];
    const result = normalizeSuggestionSearchResult(Object.assign([...suggestions], {
      status: 'offline',
      retryable: true,
    }));

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject(suggestions[0]);
    expect(result.status).toBe('offline');
    expect(result.retryable).toBe(true);
  });
});

describe('delivery submission lifecycle', () => {
  const findTouchableForText = (root, text) => {
    let node = root.findAll((candidate) => candidate.type === 'Text' && candidate.children.join('') === text)[0];
    while (node && node.type !== TouchableOpacity) node = node.parent;
    return node;
  };

  it('emits only one delivery request when submit is triggered twice before rerender', async () => {
    const emitRequest = jest.fn();
    socket.timeout.mockReturnValue({ emit: emitRequest });
    api.post.mockReset().mockResolvedValue({ data: [{
      category: 'delivery', id: 'quote-1', serviceConfigId: 1, distanceMeters: 4000,
      durationSeconds: 600, estimatedFare: 2500, routePolyline: 'route',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }] });
    hereService.fetchSuggestions.mockResolvedValue([{
      id: 'destination-1', name: 'Destino', address: 'Rua Principal', lat: -9.1, lng: 13.5,
    }]);

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(require('./DeliveryFlowScreen').default, {
        navigation: { navigate: jest.fn() },
        route: { params: { pickupCoords: { lat: -8.8, lng: 13.2 } } },
      }));
    });

    await act(async () => renderer.root.findByType(TextInput).props.onChangeText('Destino'));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 550)));
    await act(async () => findTouchableForText(renderer.root, 'Destino').props.onPress());
    const fields = renderer.root.findAllByType(TextInput);
    await act(async () => fields[0].props.onChangeText('Ana Silva'));
    await act(async () => fields[1].props.onChangeText('923456789'));
    await act(async () => fields[2].props.onChangeText('Documentos'));
    await act(async () => findTouchableForText(renderer.root, 'Próximo').props.onPress());
    await act(async () => findTouchableForText(renderer.root, 'Estafeta').props.onPress());

    const submit = findTouchableForText(renderer.root, 'Chamar Entregador');
    await act(async () => {
      submit.props.onPress();
      submit.props.onPress();
    });

    expect(emitRequest).toHaveBeenCalledTimes(1);
    await act(async () => {
      await emitRequest.mock.calls[0][2](new Error('ack timeout'), { error: 'timeout' });
    });
    await act(async () => findTouchableForText(renderer.root, 'Chamar Entregador').props.onPress());
    expect(emitRequest).toHaveBeenCalledTimes(2);
    await act(async () => renderer.unmount());
  });
});

describe('active delivery restoration', () => {
  it('restores an active delivery without a route tripId and restores its origin marker after the map is ready', async () => {
    const trip = {
      id: 'trip-delivery-active', category: 'delivery', status: 'accepted',
      origin_lat: -8.8123, origin_lng: 13.2412,
      origin_address: 'Origem guardada', dest_lat: -9.0321, dest_lng: 13.2678,
      dest_address: 'Destino guardado', estimated_fare: '2500.00', current_fare: '2500.00',
      trip_quotes: { pricing_snapshot: { route: { polyline: 'restored-route' } } },
      delivery_info: { recipient_name: 'Ana', recipient_phone: '923456789', package_description: 'Documentos' },
    };
    api.get.mockReset()
      .mockResolvedValueOnce({ data: [trip] })
      .mockResolvedValueOnce({ data: trip });
    api.getServices.mockResolvedValue({ data: [{ id: 1, name: 'Estafeta', category: 'delivery' }] });
    getCurrentClientLocation.mockReset();
    globalThis.__deliveryMapMethods.setMarkers.mockClear();
    globalThis.__deliveryMapMethods.setUserLocation.mockClear();

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(require('./DeliveryFlowScreen').default, {
        navigation: { navigate: jest.fn() }, route: { params: {} },
      }));
    });

    expect(api.get).toHaveBeenCalledWith('/trips/active/user-1');
    expect(api.get).toHaveBeenCalledWith('/trips/trip-delivery-active');
    expect(getCurrentClientLocation).not.toHaveBeenCalled();

    await act(async () => globalThis.__deliveryFlowMapProps.onMapReady());
    expect(globalThis.__deliveryMapMethods.setMarkers).toHaveBeenCalledWith(
      { lat: -8.8123, lng: 13.2412 }, expect.objectContaining({ lat: -9.0321, lng: 13.2678, address: 'Destino guardado' }),
    );
    expect(globalThis.__deliveryMapMethods.setUserLocation).toHaveBeenCalledWith({ lat: -8.8123, lng: 13.2412 });
    expect(globalThis.__deliveryMapMethods.drawRoute).toHaveBeenCalledWith('restored-route', expect.objectContaining({ bottom: expect.any(Number) }));
    expect(renderer.root.findAll((node) => node.type === 'Text' && node.children.join('').includes('Ana'))).toHaveLength(0);
    await act(async () => renderer.unmount());
  });
});

describe('delivery map tap intent lifecycle', () => {
  const findTouchableForText = (root, text) => {
    let node = root.findAll((candidate) => candidate.type === 'Text' && candidate.children.join('') === text)[0];
    while (node && node.type !== TouchableOpacity) node = node.parent;
    return node;
  };

  const mountDeliveryFlow = async () => {
    api.get.mockResolvedValue({ data: [] });
    api.getServices.mockResolvedValue({ data: [{ id: 1, name: 'Estafeta', category: 'delivery' }] });
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(require('./DeliveryFlowScreen').default, {
        navigation: { navigate: jest.fn() },
        route: { params: { pickupCoords: { lat: -8.8, lng: 13.2 } } },
      }));
    });
    return renderer;
  };

  it('keeps the selected search destination when an earlier map reverse geocode resolves later', async () => {
    let resolveReverseGeocode;
    api.post.mockReset().mockResolvedValue({ data: [] });
    hereService.reverseGeocode.mockReset().mockImplementation(() => new Promise((resolve) => { resolveReverseGeocode = resolve; }));
    hereService.fetchSuggestions.mockResolvedValue([{
      id: 'search-destination', name: 'Destino novo', address: 'Rua Nova', lat: -9.1, lng: 13.5,
    }]);
    const renderer = await mountDeliveryFlow();
    let pendingMapTap;

    await act(async () => {
      pendingMapTap = globalThis.__deliveryFlowMapProps.onMapTap({ lat: -9.0, lng: 13.4 });
    });
    await act(async () => renderer.root.findByType(TextInput).props.onChangeText('Destino novo'));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 550)));
    await act(async () => findTouchableForText(renderer.root, 'Destino novo').props.onPress());

    await act(async () => {
      resolveReverseGeocode('Destino antigo');
      await pendingMapTap;
    });

    const fields = renderer.root.findAllByType(TextInput);
    await act(async () => fields[0].props.onChangeText('Ana Silva'));
    await act(async () => fields[1].props.onChangeText('923456789'));
    await act(async () => fields[2].props.onChangeText('Documentos'));
    await act(async () => findTouchableForText(renderer.root, 'Próximo').props.onPress());

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0][1]).toMatchObject({ destLat: -9.1, destLng: 13.5 });
    await act(async () => renderer.unmount());
  });

  it('ignores a pending destination tap after manual pickup selection starts', async () => {
    let resolveReverseGeocode;
    api.post.mockReset();
    hereService.reverseGeocode.mockReset().mockImplementation(() => new Promise((resolve) => { resolveReverseGeocode = resolve; }));
    const renderer = await mountDeliveryFlow();
    let pendingMapTap;

    await act(async () => {
      pendingMapTap = globalThis.__deliveryFlowMapProps.onMapTap({ lat: -9.0, lng: 13.4 });
    });
    await act(async () => findTouchableForText(renderer.root, 'Definir recolha no mapa').props.onPress());
    await act(async () => {
      resolveReverseGeocode('Destino antigo');
      await pendingMapTap;
    });

    expect(findTouchableForText(renderer.root, 'Toque no mapa para definir recolha')).toBeTruthy();
    expect(renderer.root.findAll((node) => node.type === 'Text' && node.children.join('') === 'DETALHES DA ENTREGA')).toHaveLength(0);
    expect(api.post).not.toHaveBeenCalled();
    await act(async () => renderer.unmount());
  });

  it('ignores a pending destination tap after GPS selects the pickup and falls back to coordinates', async () => {
    let resolveTappedAddress;
    api.post.mockReset();
    getCurrentClientLocation.mockResolvedValue({ status: 'granted', coords: { lat: -8.7, lng: 13.1 } });
    hereService.reverseGeocode.mockReset()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveTappedAddress = resolve; }))
      .mockResolvedValueOnce(null);
    const renderer = await mountDeliveryFlow();

    const pendingTap = globalThis.__deliveryFlowMapProps.onMapTap({ lat: -9.0, lng: 13.4 });
    await act(async () => findTouchableForText(renderer.root, 'Usar minha localização').props.onPress());

    await act(async () => {
      resolveTappedAddress('Destino antigo');
      await pendingTap;
    });

    expect(api.post).not.toHaveBeenCalled();
    expect(globalThis.__deliveryMapMethods.setUserLocation).toHaveBeenCalledWith({ lat: -8.7, lng: 13.1 });
    expect(renderer.root.findAll((node) => node.type === 'Text' && node.children.join('') === 'Destino antigo')).toHaveLength(0);
    await act(async () => renderer.unmount());
  });
});

describe('delivery quote response ordering', () => {
  const findTouchableForText = (root, text) => {
    let node = root.findAll((candidate) => candidate.type === 'Text' && candidate.children.join('') === text)[0];
    while (node && node.type !== TouchableOpacity) node = node.parent;
    return node;
  };

  it('keeps the newest quote when an earlier quote response arrives late', async () => {
    const pendingQuotes = [];
    api.post.mockReset().mockImplementation(() => new Promise((resolve) => pendingQuotes.push(resolve)));
    hereService.fetchSuggestions.mockResolvedValue([{
      id: 'destination-2', name: 'Destino', address: 'Rua Principal', lat: -9.1, lng: 13.5,
    }]);
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(require('./DeliveryFlowScreen').default, {
        navigation: { navigate: jest.fn() },
        route: { params: { pickupCoords: { lat: -8.8, lng: 13.2 } } },
      }));
    });
    await act(async () => renderer.root.findByType(TextInput).props.onChangeText('Destino'));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 550)));
    await act(async () => findTouchableForText(renderer.root, 'Destino').props.onPress());
    const fields = renderer.root.findAllByType(TextInput);
    await act(async () => fields[0].props.onChangeText('Ana Silva'));
    await act(async () => fields[1].props.onChangeText('923456789'));
    await act(async () => fields[2].props.onChangeText('Documentos'));
    const next = findTouchableForText(renderer.root, 'Próximo');
    await act(async () => {
      next.props.onPress();
      next.props.onPress();
    });
    expect(pendingQuotes).toHaveLength(2);

    const makeQuote = (id, fare) => ({
      category: 'delivery', id, serviceConfigId: 1, distanceMeters: 4000,
      durationSeconds: 600, estimatedFare: fare, routePolyline: `route-${id}`,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await act(async () => pendingQuotes[1]({ data: [makeQuote('quote-new', 3600)] }));
    await act(async () => pendingQuotes[0]({ data: [makeQuote('quote-old', 2500)] }));

    expect(renderer.root.findAll((node) => node.type === 'Text' && node.children.join('') === '3600 Kz')).toHaveLength(1);
    expect(renderer.root.findAll((node) => node.type === 'Text' && node.children.join('') === '2500 Kz')).toHaveLength(0);
    await act(async () => renderer.unmount());
  });
});
