/**
 * Keeps the latest desired map command while the HERE WebView is not ready.
 * The snapshot is replayed after a reload so the native view and map state stay in sync.
 */
export function createMapCommandQueue(inject) {
    let ready = false;
    const desiredCommands = new Map();

    const flush = () => {
        desiredCommands.forEach((code) => inject(code));
    };

    return {
        enqueue(code, key = code) {
            if (key === 'clearMap') {
                desiredCommands.clear();
                if (ready) inject(code);
                return;
            }
            desiredCommands.set(key, code);

            if (ready) inject(code);
        },
        onReady() {
            if (ready) return;
            ready = true;
            flush();
        },
        onLoadStart() {
            ready = false;
        },
    };
}
