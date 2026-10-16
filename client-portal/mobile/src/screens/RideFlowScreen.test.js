import fs from 'fs';
import path from 'path';
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-geolocation-service', () => ({ __esModule: true, default: {} }));
jest.mock('../services/currentLocation', () => ({ getCurrentClientLocation: jest.fn() }));
jest.mock('../components/HereMap', () => {
  const React = jest.requireActual('react');
  const map = {
    clearMap: jest.fn(), drawRoute: jest.fn(), setMarkers: jest.fn(), setUserLocation: jest.fn(),
  };
  return {
    __esModule: true,
    default: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => map);
      globalThis.__rideFlowMap = map;
      globalThis.__rideFlowMapProps = props;
      return null;
    }),
  };
});
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' }, token: 'token' }) }));
jest.mock('../services/socket', () => ({ __esModule: true, default: { connected: true, on: jest.fn(), off: jest.fn(), emit: jest.fn(), timeout: jest.fn(() => ({ emit: jest.fn() })) }, setSocketToken: jest.fn() }));
jest.mock('../services/api', () => ({ __esModule: true, default: {
  get: jest.fn().mockResolvedValue({ data: [] }),
  post: jest.fn(),
  getServices: jest.fn().mockResolvedValue({ data: [{ id: 1, name: 'Carro', category: 'ride' }] }),
} }));
jest.mock('../services/hereService', () => ({ __esModule: true, default: { fetchSuggestions: jest.fn(), reverseGeocode: jest.fn().mockResolvedValue('Luanda') } }));
jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));
import { normalizeSuggestionSearchResult } from './RideFlowScreen';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Animated, TextInput, TouchableOpacity } from 'react-native';
import api from '../services/api';
import hereService from '../services/hereService';
import socket from '../services/socket';
import { getCurrentClientLocation } from '../services/currentLocation';

describe('RideFlowScreen imports', () => {
  it('imports SafeAreaView before rendering it in the ride flow', () => {
    const source = fs.readFileSync(path.join(__dirname, 'RideFlowScreen.js'), 'utf8');

    expect(source).toMatch(/import\s*\{[^}]*\bSafeAreaView\b[^}]*\}\s*from\s*['"]react-native-safe-area-context['"]/s);
  });
});

describe('ride address search feedback', () => {
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

describe('ride quote lifecycle', () => {
  const quote = (id) => ({
    category: 'ride', id, serviceConfigId: 1,
    distanceMeters: 10000, durationSeconds: 600, estimatedFare: 2000,
    routePolyline: `route-${id}`, expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });

  const findTouchableForText = (root, text) => {
    let node = root.findAll((candidate) => candidate.type === 'Text' && candidate.children.join('') === text)[0];
    while (node && node.type !== TouchableOpacity) node = node.parent;
    return node;
  };

  it('keeps the quoted route drawn after opening service selection', async () => {
    api.get.mockReset().mockResolvedValue({ data: [] });
    api.post.mockReset().mockResolvedValue({ data: [quote('map-route')] });

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(require('./RideFlowScreen').default, {
        navigation: { navigate: jest.fn() },
        route: { params: { initialStep: 'home', pickupCoords: { lat: -8.8, lng: 13.2 } } },
      }));
    });
    await act(async () => globalThis.__rideFlowMapProps.onMapReady());
    await act(async () => globalThis.__rideFlowMapProps.onMapTap({ lat: -8.9, lng: 13.3 }));
    await act(async () => findTouchableForText(renderer.root, 'Ver Preços').props.onPress());

    expect(globalThis.__rideFlowMap.drawRoute).toHaveBeenLastCalledWith('route-map-route');
    expect(globalThis.__rideFlowMap.drawRoute.mock.invocationCallOrder.at(-1))
      .toBeGreaterThan(globalThis.__rideFlowMap.setMarkers.mock.invocationCallOrder.at(-1));
    await act(async () => renderer.unmount());
  });

  it('does not keep a previous quote selectable while the changed destination is being quoted', async () => {
    let resolveSecondQuote;
    api.post.mockReset()
      .mockResolvedValueOnce({ data: [quote('quote-1')] })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecondQuote = resolve; }));

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(require('./RideFlowScreen').default, {
        navigation: { navigate: jest.fn() },
        route: { params: { initialStep: 'home', pickupCoords: { lat: -8.8, lng: 13.2 } } },
      }));
    });

    await act(async () => {
      await globalThis.__rideFlowMapProps.onMapTap({ lat: -8.9, lng: 13.3 });
    });
    expect(api.post).toHaveBeenCalledTimes(1);

    await act(async () => {
      findTouchableForText(renderer.root, 'Ver Preços').props.onPress();
    });
    expect(findTouchableForText(renderer.root, 'Carro')).toBeTruthy();
    await act(async () => findTouchableForText(renderer.root, 'Carro').props.onPress());

    const headerText = renderer.root.findAll((node) => node.type === 'Text' && node.children.join('') === 'SELECIONE UMA VIAGEM')[0];
    const headerButtons = headerText.parent.parent.findAll((node) => node.type === TouchableOpacity);
    expect(headerButtons).toHaveLength(1);
    await act(async () => headerButtons[0].props.onPress());

    await act(async () => {
      await globalThis.__rideFlowMapProps.onMapTap({ lat: -9.0, lng: 13.4 });
    });
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(globalThis.__rideFlowMap.drawRoute).toHaveBeenLastCalledWith(null);

    await act(async () => {
      findTouchableForText(renderer.root, 'Ver Preços').props.onPress();
    });

    expect(renderer.root.findAll((node) => node.type === 'Text' && node.children.join('') === 'Carro')).toHaveLength(0);

    await act(async () => resolveSecondQuote({ data: [] }));
    await act(async () => renderer.unmount());
  });

  it('ignores a successful trip acknowledgement after leaving the quote screen', async () => {
    jest.spyOn(Animated, 'loop').mockReturnValue({ start: jest.fn(), stop: jest.fn() });
    let acknowledgeTrip;
    socket.timeout.mockReturnValue({
      emit: jest.fn((event, payload, callback) => { acknowledgeTrip = callback; }),
    });
    api.post.mockReset().mockResolvedValue({ data: [quote('quote-pending')] });
    hereService.reverseGeocode.mockResolvedValue('Destino selecionado');

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(require('./RideFlowScreen').default, {
        navigation: { navigate: jest.fn() },
        route: { params: { initialStep: 'home', pickupCoords: { lat: -8.8, lng: 13.2 } } },
      }));
    });

    await act(async () => globalThis.__rideFlowMapProps.onMapTap({ lat: -8.9, lng: 13.3 }));
    await act(async () => findTouchableForText(renderer.root, 'Ver Preços').props.onPress());
    await act(async () => findTouchableForText(renderer.root, 'Carro').props.onPress());
    await act(async () => findTouchableForText(renderer.root, 'Continuar').props.onPress());
    expect(acknowledgeTrip).toEqual(expect.any(Function));

    try {
      const headerText = renderer.root.findAll((node) => node.type === 'Text' && node.children.join('') === 'SELECIONE UMA VIAGEM')[0];
      const backButton = headerText.parent.parent.findAll((node) => node.type === TouchableOpacity)[0];
      await act(async () => backButton.props.onPress());
      expect(findTouchableForText(renderer.root, 'Ver Preços')).toBeTruthy();

      await act(async () => acknowledgeTrip(null, { success: true, tripId: 'trip-late' }));

      expect(findTouchableForText(renderer.root, 'Ver Preços')).toBeTruthy();
      expect(renderer.root.findAll((node) => node.type === 'Text' && node.children.join('') === 'Procurando motorista...')).toHaveLength(0);
    } finally {
      await act(async () => renderer.unmount());
      jest.restoreAllMocks();
    }
  });
});

describe('active ride restoration', () => {
  it('draws the persisted route after the map becomes ready', async () => {
    const trip = {
      id: 'trip-active', category: 'ride', status: 'accepted',
      origin_address: 'Origem', origin_lat: '-8.8', origin_lng: '13.2',
      dest_address: 'Destino', dest_lat: '-8.9', dest_lng: '13.3',
      estimated_fare: '2000', route_polyline: 'persisted-route',
    };
    api.get.mockReset().mockResolvedValue({ data: [trip] });

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(require('./RideFlowScreen').default, {
        navigation: { navigate: jest.fn() },
        route: { params: { initialStep: 'home', pickupCoords: { lat: -8.7, lng: 13.1 } } },
      }));
    });

    expect(api.get).toHaveBeenCalledWith('/trips/active/user-1');
    globalThis.__rideFlowMap.drawRoute.mockClear();
    globalThis.__rideFlowMap.setMarkers.mockClear();
    await act(async () => globalThis.__rideFlowMapProps.onMapReady());

    expect(globalThis.__rideFlowMap.setMarkers).toHaveBeenCalledWith(
      { lat: -8.8, lng: 13.2 },
      { lat: -8.9, lng: 13.3 },
    );
    expect(globalThis.__rideFlowMap.drawRoute).toHaveBeenCalledWith('persisted-route');
    await act(async () => renderer.unmount());
    api.get.mockReset().mockResolvedValue({ data: [] });
  });
});

describe('map tap intent lifecycle', () => {
  const mountRideFlow = async (initialStep) => {
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(require('./RideFlowScreen').default, {
        navigation: { navigate: jest.fn() },
        route: { params: { initialStep, pickupCoords: { lat: -8.8, lng: 13.2 } } },
      }));
    });
    return renderer;
  };

  const findTouchableForText = (root, text) => {
    let node = root.findAll((candidate) => candidate.type === 'Text' && candidate.children.join('') === text)[0];
    while (node && node.type !== TouchableOpacity) node = node.parent;
    return node;
  };

  it('ignores an older map geocode after a search result is selected', async () => {
    let resolveReverseGeocode;
    api.post.mockReset().mockResolvedValue({ data: [] });
    hereService.reverseGeocode.mockReset().mockImplementation(() => new Promise((resolve) => { resolveReverseGeocode = resolve; }));
    hereService.fetchSuggestions.mockResolvedValue([{
      id: 'search-result', name: 'Novo destino', address: 'Novo endereço', lat: -9.1, lng: 13.5,
    }]);
    const renderer = await mountRideFlow('searching_address');
    let staleTap;

    await act(async () => {
      staleTap = globalThis.__rideFlowMapProps.onMapTap({ lat: -9.0, lng: 13.4 });
    });
    await act(async () => renderer.root.findByType(TextInput).props.onChangeText('Novo destino'));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 550)));

    await act(async () => findTouchableForText(renderer.root, 'Novo destino').props.onPress());
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0][1]).toMatchObject({ destLat: -9.1, destLng: 13.5 });

    await act(async () => {
      resolveReverseGeocode('Destino antigo');
      await staleTap;
    });

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAll((node) => node.type === 'Text' && node.children.join('') === 'Novo destino')).toHaveLength(1);
    await act(async () => renderer.unmount());
  });

  it('ignores an older map geocode after entering manual pickup selection', async () => {
    let resolveReverseGeocode;
    api.post.mockReset();
    hereService.reverseGeocode.mockReset().mockImplementation(() => new Promise((resolve) => { resolveReverseGeocode = resolve; }));
    const renderer = await mountRideFlow('home');
    let staleTap;

    await act(async () => {
      staleTap = globalThis.__rideFlowMapProps.onMapTap({ lat: -9.0, lng: 13.4 });
    });
    await act(async () => findTouchableForText(renderer.root, 'Definir recolha no mapa').props.onPress());
    await act(async () => {
      resolveReverseGeocode('Destino antigo');
      await staleTap;
    });

    expect(api.post).not.toHaveBeenCalled();
    expect(renderer.root.findAll((node) => node.type === 'Text' && node.children.join('') === 'Digite seu destino...')).toHaveLength(1);
    expect(findTouchableForText(renderer.root, 'Toque no mapa para definir recolha')).toBeTruthy();
    await act(async () => renderer.unmount());
  });

  it('ignores a pending destination tap after GPS selects the pickup and falls back to coordinates', async () => {
    let resolveTappedAddress;
    api.post.mockReset();
    getCurrentClientLocation.mockResolvedValue({ status: 'granted', coords: { lat: -8.7, lng: 13.1 } });
    hereService.reverseGeocode.mockReset()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveTappedAddress = resolve; }))
      .mockResolvedValueOnce(null);
    const renderer = await mountRideFlow('home');

    const pendingTap = globalThis.__rideFlowMapProps.onMapTap({ lat: -9.0, lng: 13.4 });
    await act(async () => findTouchableForText(renderer.root, 'Usar minha localização').props.onPress());

    await act(async () => {
      resolveTappedAddress('Destino antigo');
      await pendingTap;
    });

    expect(api.post).not.toHaveBeenCalled();
    expect(globalThis.__rideFlowMap.setUserLocation).toHaveBeenCalledWith({ lat: -8.7, lng: 13.1 });
    expect(renderer.root.findAll((node) => node.type === 'Text' && node.children.join('') === 'Destino antigo')).toHaveLength(0);
    await act(async () => renderer.unmount());
  });
});
