import { createMapCommandQueue } from './mapCommandQueue';

describe('createMapCommandQueue', () => {
    it('buffers map calls until READY and flushes them in order once', () => {
        const send = jest.fn();
        const queue = createMapCommandQueue(send);

        queue.enqueue('setMarkers');
        queue.enqueue('drawRoute');
        expect(send).not.toHaveBeenCalled();

        queue.onReady();
        expect(send.mock.calls).toEqual([['setMarkers'], ['drawRoute']]);

        queue.onReady();
        expect(send).toHaveBeenCalledTimes(2);
    });

    it('buffers commands again after the WebView starts reloading', () => {
        const send = jest.fn();
        const queue = createMapCommandQueue(send);

        queue.onReady();
        queue.enqueue('first');
        queue.onLoadStart();
        queue.enqueue('after-reload');

        expect(send).toHaveBeenCalledTimes(1);
        queue.onReady();
        expect(send.mock.calls).toEqual([['first'], ['first'], ['after-reload']]);
    });

    it('replays the latest map state after a WebView reload', () => {
        const send = jest.fn();
        const queue = createMapCommandQueue(send);

        queue.enqueue('setMarkers-old', 'markers');
        queue.enqueue('drawRoute', 'route');
        queue.onReady();
        send.mockClear();

        queue.onLoadStart();
        queue.enqueue('setMarkers-new', 'markers');
        queue.onReady();

        expect(send.mock.calls).toEqual([['setMarkers-new'], ['drawRoute']]);
    });

    it('does not replay map state cleared before a reload', () => {
        const send = jest.fn();
        const queue = createMapCommandQueue(send);

        queue.enqueue('setMarkers', 'markers');
        queue.enqueue('drawRoute', 'route');
        queue.enqueue('clearMap()', 'clearMap');
        queue.onReady();
        send.mockClear();

        queue.onLoadStart();
        queue.onReady();
        expect(send).not.toHaveBeenCalled();
    });
});
