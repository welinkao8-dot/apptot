import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import GoingToClientView from '../src/components/ride/GoingToClientView';

describe('GoingToClientView navigation information', () => {
  it('does not show unavailable approach metrics and tells the driver how to navigate', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <GoingToClientView
          user={{ full_name: 'Motorista' }}
          activeTrip={{ coords: { lat: -8.84, lng: 13.29 }, pickupAddress: 'Rua A', destAddress: 'Rua B' }}
          onOpenMap={() => {}}
          onStartRide={() => {}}
        />,
      );
    });

    const visibleText = renderer!.root.findAllByType(Text).map((node) => String(node.props.children)).join(' ');
    expect(visibleText).toContain('A caminho do cliente');
    expect(visibleText).toContain('Use a navegação externa para chegar ao cliente');
    expect(visibleText).not.toContain('Tempo Est.');
    expect(visibleText).not.toContain('Distância');
    expect(visibleText).not.toContain('—');
  });
});
