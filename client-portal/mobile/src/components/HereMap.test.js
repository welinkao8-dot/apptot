import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import HereMap from './HereMap';
import api from '../services/api';
import { shouldAllowHereMapNavigation } from '../utils/mapNavigation';
import { mockInjectJavaScript } from 'react-native-webview';

jest.mock('../services/api', () => ({
    __esModule: true,
    default: { get: jest.fn() },
}));

jest.mock('react-native-webview', () => {
    const React = require('react');
    const mockInjectJavaScript = jest.fn();
    return {
        mockInjectJavaScript,
        WebView: React.forwardRef((props, ref) => {
            React.useImperativeHandle(ref, () => ({ injectJavaScript: mockInjectJavaScript }));
            return React.createElement('WebView', props);
        }),
    };
});

describe('HereMap WebView recovery', () => {
    beforeEach(() => {
        api.get.mockResolvedValue({ data: { apiKey: 'public-map-key' } });
        mockInjectJavaScript.mockReset();
        jest.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('shows a retry action when the map WebView fails to load', async () => {
        let tree;
        await act(async () => {
            tree = TestRenderer.create(<HereMap />);
        });

        const webView = tree.root.findByType('WebView');
        await act(async () => {
            webView.props.onError({ nativeEvent: { code: -6 } });
        });

        expect(tree.root.findAll((element) => element.children?.join('') === 'Não foi possível carregar o mapa')).toHaveLength(1);
        expect(tree.root.findAll((element) => element.children?.join('') === 'Tentar novamente')).toHaveLength(1);

        const retryButton = tree.root.find((element) => element.props.accessibilityRole === 'button');
        await act(async () => {
            retryButton.props.onPress();
        });

        expect(tree.root.findAllByType('WebView')).toHaveLength(1);
        expect(api.get).toHaveBeenCalledTimes(1);
    });

    it('offers recovery when the WebView never signals READY', async () => {
        jest.useFakeTimers();
        let tree;
        await act(async () => {
            tree = TestRenderer.create(<HereMap />);
        });

        await act(async () => {
            tree.root.findByType('WebView').props.onLoadStart();
            jest.advanceTimersByTime(20000);
        });

        expect(tree.root.findAll((element) => element.children?.join('') === 'Não foi possível carregar o mapa')).toHaveLength(1);
    });

    it('replays only the latest route and markers when READY arrives after a reset', async () => {
        const mapRef = React.createRef();
        let tree;
        await act(async () => {
            tree = TestRenderer.create(<HereMap ref={mapRef} />);
        });

        const oldOrigin = { lat: -8.8, lng: 13.2 };
        const origin = { lat: -8.9, lng: 13.3 };
        const destination = { lat: -8.7, lng: 13.4 };
        mapRef.current.setMarkers(oldOrigin, destination);
        mapRef.current.drawRoute('old-route');
        mapRef.current.clearMap();
        mapRef.current.setMarkers(origin, destination);
        mapRef.current.drawRoute('new-route');

        expect(mockInjectJavaScript).not.toHaveBeenCalled();

        await act(async () => {
            tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: '{"type":"READY"}' } });
        });

        expect(mockInjectJavaScript).toHaveBeenCalledTimes(2);
        expect(mockInjectJavaScript.mock.calls[0][0]).toContain(JSON.stringify(origin));
        expect(mockInjectJavaScript.mock.calls[0][0]).toContain(JSON.stringify(destination));
        expect(mockInjectJavaScript.mock.calls[1][0]).toContain('new-route');
        expect(mockInjectJavaScript.mock.calls[1][0]).not.toContain('old-route');
    });

    it('uses the latest readiness callback and keeps commands buffered until each READY', async () => {
        const firstReady = jest.fn();
        const latestReady = jest.fn();
        const mapRef = React.createRef();
        let tree;
        await act(async () => {
            tree = TestRenderer.create(<HereMap ref={mapRef} onMapReady={firstReady} />);
        });

        mapRef.current.drawRoute('route-before-ready');
        expect(mockInjectJavaScript).not.toHaveBeenCalled();

        await act(async () => {
            tree.update(<HereMap ref={mapRef} onMapReady={latestReady} />);
        });
        await act(async () => {
            tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: '{"type":"READY"}' } });
        });

        expect(firstReady).not.toHaveBeenCalled();
        expect(latestReady).toHaveBeenCalledTimes(1);
        expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
        expect(mockInjectJavaScript.mock.calls[0][0]).toContain('route-before-ready');

        const webView = tree.root.findByType('WebView');
        await act(async () => {
            webView.props.onLoadStart();
            tree.update(<HereMap ref={mapRef} onMapReady={firstReady} />);
        });
        await act(async () => {
            tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: '{"type":"READY"}' } });
        });

        expect(firstReady).toHaveBeenCalledTimes(1);
        expect(latestReady).toHaveBeenCalledTimes(1);
    });

    it('clears replay state and accepts new map commands after a WebView reset', async () => {
        const mapRef = React.createRef();
        let tree;
        await act(async () => {
            tree = TestRenderer.create(<HereMap ref={mapRef} />);
        });
        const webView = tree.root.findByType('WebView');
        await act(async () => {
            webView.props.onMessage({ nativeEvent: { data: '{"type":"READY"}' } });
        });

        mapRef.current.setMarkers({ lat: -8.8, lng: 13.2 }, { lat: -8.7, lng: 13.3 });
        mapRef.current.drawRoute('old-route');
        mapRef.current.clearMap();
        mockInjectJavaScript.mockClear();

        await act(async () => {
            tree.root.findByType('WebView').props.onLoadStart();
            tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: '{"type":"READY"}' } });
        });

        expect(mockInjectJavaScript).not.toHaveBeenCalled();
        mapRef.current.setMarkers({ lat: -8.9, lng: 13.4 }, null);
        expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
        expect(mockInjectJavaScript.mock.calls[0][0]).toContain('setMarkers');
        expect(mockInjectJavaScript.mock.calls[0][0]).not.toContain('old-route');
    });

    it('only permits HTTPS HERE navigation and blocks mixed content and local files', async () => {
        let tree;
        await act(async () => {
            tree = TestRenderer.create(<HereMap />);
        });

        const webView = tree.root.findByType('WebView');
        expect(webView.props.originWhitelist).toEqual(['https://www.here.com', 'https://*.here.com', 'https://*.hereapi.com']);
        expect(webView.props.mixedContentMode).toBe('never');
        expect(webView.props.allowFileAccess).toBe(false);
        expect(webView.props.onShouldStartLoadWithRequest({ url: 'https://www.here.com/' })).toBe(true);
        expect(webView.props.onShouldStartLoadWithRequest({ url: 'https://js.api.here.com/v3/3.2/mapsjs-core.js' })).toBe(true);
        expect(webView.props.onShouldStartLoadWithRequest({ url: 'https://1.base.maps.ls.hereapi.com/maptile/2.1/tile/0/0/0/normal.day' })).toBe(true);
        expect(webView.props.onShouldStartLoadWithRequest({ url: 'http://js.api.here.com/maps.js' })).toBe(false);
        expect(webView.props.onShouldStartLoadWithRequest({ url: 'https://example.com/' })).toBe(false);
        expect(webView.props.onShouldStartLoadWithRequest({ url: 'file:///etc/passwd' })).toBe(false);
    });
});

describe('HERE map navigation policy', () => {
    it.each([
        ['https://www.here.com/', true],
        ['https://js.api.here.com/v3/3.2/mapsjs-core.js', true],
        ['https://1.base.maps.ls.hereapi.com/maptile/2.1/tile/0/0/0/normal.day', true],
        ['http://js.api.here.com/maps.js', false],
        ['https://here.com.evil.example/', false],
        ['https://example.com/', false],
        ['https://user:pass@here.com/', false],
        ['file:///etc/passwd', false],
        ['', false],
    ])('evaluates %s as %s', (url, expected) => {
        expect(shouldAllowHereMapNavigation(url)).toBe(expected);
    });
});
