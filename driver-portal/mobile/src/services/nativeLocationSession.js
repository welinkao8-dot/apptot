const locationSessionQueues = new WeakMap();

function enqueueLocationSessionOperation(locationModule, operation) {
    if (!locationModule || (typeof locationModule !== 'object' && typeof locationModule !== 'function')) {
        return Promise.resolve().then(operation);
    }

    const previous = locationSessionQueues.get(locationModule) || Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    locationSessionQueues.set(locationModule, current.catch(() => {}));
    return current;
}

async function clearLocationSessionNow(locationModule) {
    const errors = [];

    for (const operation of [
        () => locationModule?.stopLocationUpdates?.(),
        () => locationModule?.clearLocationUploadConfig?.(),
    ]) {
        try {
            await operation();
        } catch (error) {
            errors.push(error);
        }
    }

    return errors;
}

export async function clearNativeLocationSession(locationModule) {
    return enqueueLocationSessionOperation(locationModule, () => clearLocationSessionNow(locationModule));
}

export async function syncNativeLocationSession({ locationModule, user, token, apiUrl }) {
    const status = typeof user?.status === 'string' ? user.status.trim().toLowerCase() : '';
    const isEligible = !status || status === 'active';

    if (!isEligible || !token) {
        return {
            configured: false,
            errors: await clearNativeLocationSession(locationModule),
        };
    }

    if (!locationModule?.configureLocationUpload) {
        return { configured: false, errors: [] };
    }

    return enqueueLocationSessionOperation(locationModule, async () => {
        try {
            await locationModule.configureLocationUpload(apiUrl, token);
            return { configured: true, errors: [] };
        } catch (error) {
            return {
                configured: false,
                errors: [error, ...await clearLocationSessionNow(locationModule)],
            };
        }
    });
}
