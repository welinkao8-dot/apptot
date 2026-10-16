import api from './api';
import { hereService } from './hereService';

jest.mock('./api', () => ({
    __esModule: true,
    default: { get: jest.fn() },
}));

describe('hereService.fetchSuggestions', () => {
    beforeEach(() => {
        api.get.mockReset();
    });

    it('distinguishes a successful search with no matches from a request failure', async () => {
        api.get.mockResolvedValueOnce({ data: [] });
        const noMatches = await hereService.fetchSuggestions('Rua inexistente');

        api.get.mockRejectedValueOnce({ response: { status: 503 } });
        const unavailable = await hereService.fetchSuggestions('Rua temporaria');

        expect(noMatches).toEqual([]);
        expect(noMatches.status).toBe('no_results');
        expect(noMatches.retryable).toBe(false);
        expect(unavailable.status).toBe('server_error');
        expect(unavailable.retryable).toBe(true);
    });

    it.each([
        [{ code: 'ECONNABORTED' }, 'timeout'],
        [{ code: 'ERR_NETWORK', request: {} }, 'offline'],
        [{ response: { status: 429 } }, 'rate_limited'],
        [{ response: { status: 502 } }, 'server_error'],
    ])('classifies retryable failure as %s', async (error, expectedStatus) => {
        api.get.mockRejectedValueOnce(error);

        const result = await hereService.fetchSuggestions('Avenida Central');

        expect(result.status).toBe(expectedStatus);
        expect(result.retryable).toBe(true);
    });

    it('keeps prior suggestions for the same query when a retry fails', async () => {
        const suggestions = [{
            id: 'here:abc',
            title: 'Rua das Flores',
            address: { label: 'Rua das Flores' },
            position: { lat: -8.8, lng: 13.2 },
        }];
        api.get.mockResolvedValueOnce({ data: suggestions });
        const firstResult = await hereService.fetchSuggestions('Rua das Flores');

        api.get.mockRejectedValueOnce({ response: { status: 503 } });
        const retryResult = await hereService.fetchSuggestions('Rua das Flores');

        expect(retryResult).toEqual(firstResult);
        expect(retryResult.status).toBe('server_error');
        expect(retryResult.retryable).toBe(true);
    });

    it('retains retry suggestions when another search succeeded in between', async () => {
        api.get.mockResolvedValueOnce({ data: [{
            id: 'here:first',
            title: 'Rua Um',
            address: { label: 'Rua Um' },
            position: { lat: -8.8, lng: 13.2 },
        }] });
        const firstResult = await hereService.fetchSuggestions('Rua Um');

        api.get.mockResolvedValueOnce({ data: [{
            id: 'here:second',
            title: 'Rua Dois',
            address: { label: 'Rua Dois' },
            position: { lat: -8.8, lng: 13.2 },
        }] });
        await hereService.fetchSuggestions('Rua Dois');

        api.get.mockRejectedValueOnce({ response: { status: 504 } });
        const retryResult = await hereService.fetchSuggestions('Rua Um');

        expect(retryResult).toEqual(firstResult);
        expect(retryResult.status).toBe('server_error');
    });
});
