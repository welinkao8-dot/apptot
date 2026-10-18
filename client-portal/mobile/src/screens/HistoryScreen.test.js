jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'client-1' } }) }));
jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../services/operationalReceiptExporter', () => ({ shareOperationalReceipt: jest.fn() }));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { FlatList, Text, TouchableOpacity } from 'react-native';
import api from '../services/api';
import { shareOperationalReceipt } from '../services/operationalReceiptExporter';
import HistoryScreen from './HistoryScreen';

const makeTrip = (id, status = 'completed') => ({
  id,
  status,
  created_at: '2026-01-01T10:00:00.000Z',
  origin_address: `Origem ${id}`,
  dest_address: `Destino ${id}`,
  final_fare: 1000,
});

const findFilter = (root, label) => {
  const text = root.findAll((node) => node.type === Text && node.props.children === label)[0];
  let parent = text?.parent;
  while (parent && parent.type !== TouchableOpacity) parent = parent.parent;
  return parent;
};

const findTouchableForText = (root, label) => {
  let node = root.findAll((candidate) => candidate.type === Text && candidate.props.children === label)[0];
  while (node && node.type !== TouchableOpacity) node = node.parent;
  return node;
};

const flush = async () => act(async () => Promise.resolve());

describe('HistoryScreen request lifecycle', () => {
  let renderer;

  beforeEach(() => {
    api.get.mockReset();
    shareOperationalReceipt.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (renderer) await act(async () => renderer.unmount());
    renderer = null;
    console.error.mockRestore();
  });

  it('ignores an older filter response after a newer filter has loaded', async () => {
    let resolveOldPage;
    let resolveCompleted;
    api.get
      .mockResolvedValueOnce({ data: Array.from({ length: 15 }, (_, index) => makeTrip(`all-${index}`)) })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOldPage = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveCompleted = resolve; }));

    await act(async () => {
      renderer = TestRenderer.create(React.createElement(HistoryScreen, { navigation: { goBack: jest.fn() } }));
    });
    await flush();
    await act(async () => renderer.root.findByType(FlatList).props.onEndReached());
    await act(async () => findFilter(renderer.root, 'Concluídas').props.onPress());

    await act(async () => resolveCompleted({ data: [makeTrip('completed-trip')] }));
    expect(renderer.root.findAll((node) => node.type === Text && node.props.children === 'Origem completed-trip')).toHaveLength(1);

    await act(async () => resolveOldPage({ data: [makeTrip('old-all-trip')] }));
    expect(renderer.root.findAll((node) => node.type === Text && node.props.children === 'Origem old-all-trip')).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.type === Text && node.props.children === 'Origem completed-trip')).toHaveLength(1);
  });

  it('does not advance past a failed page before the user retries it', async () => {
    api.get
      .mockResolvedValueOnce({ data: Array.from({ length: 15 }, (_, index) => makeTrip(`page-1-${index}`)) })
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ data: [makeTrip('page-2-retry')] });

    await act(async () => {
      renderer = TestRenderer.create(React.createElement(HistoryScreen, { navigation: { goBack: jest.fn() } }));
    });

    await act(async () => renderer.root.findByType(FlatList).props.onEndReached());
    expect(api.get.mock.calls[1][1].params.page).toBe(2);

    await act(async () => renderer.root.findByType(FlatList).props.onEndReached());
    expect(api.get).toHaveBeenCalledTimes(2);

    const retry = findTouchableForText(renderer.root, 'Falha ao carregar mais. Tentar novamente');
    await act(async () => retry.props.onPress());
    expect(api.get).toHaveBeenCalledTimes(3);
    expect(api.get.mock.calls[2][1].params.page).toBe(2);
  });

  it('shows a load error instead of rendering malformed trip entries', async () => {
    api.get.mockResolvedValueOnce({ data: [null] });

    await act(async () => {
      renderer = TestRenderer.create(React.createElement(HistoryScreen, { navigation: { goBack: jest.fn() } }));
    });

    expect(renderer.root.findAll((node) => node.type === Text && node.props.children === 'Falha ao carregar')).toHaveLength(1);
  });

  it('exports the selected trip from the operational receipt modal', async () => {
    const trip = { ...makeTrip('receipt-trip'), trip_payment: { status: 'pending' } };
    const confirmedTrip = {
      ...trip,
      trip_payment: { status: 'confirmed', amount: '1000.00', confirmed_at: '2026-01-01T11:00:00.000Z' },
    };
    api.get.mockResolvedValueOnce({ data: [trip] }).mockResolvedValueOnce({ data: confirmedTrip });
    shareOperationalReceipt.mockResolvedValueOnce({});

    await act(async () => {
      renderer = TestRenderer.create(React.createElement(HistoryScreen, { navigation: { goBack: jest.fn() } }));
    });
    await flush();
    await act(async () => findTouchableForText(renderer.root, 'Resumo').props.onPress());
    await act(async () => findTouchableForText(renderer.root, 'Guardar').props.onPress());

    expect(api.get).toHaveBeenNthCalledWith(2, '/trips/receipt-trip');
    expect(shareOperationalReceipt).toHaveBeenCalledWith(confirmedTrip);
  });

  it('does not create a receipt when the server still reports pending payment', async () => {
    const trip = { ...makeTrip('pending-receipt'), trip_payment: { status: 'pending' } };
    api.get.mockResolvedValueOnce({ data: [trip] }).mockResolvedValueOnce({ data: trip });

    await act(async () => {
      renderer = TestRenderer.create(React.createElement(HistoryScreen, { navigation: { goBack: jest.fn() } }));
    });
    await flush();
    await act(async () => findTouchableForText(renderer.root, 'Resumo').props.onPress());
    await act(async () => findTouchableForText(renderer.root, 'Guardar').props.onPress());

    expect(shareOperationalReceipt).not.toHaveBeenCalled();
  });
});

