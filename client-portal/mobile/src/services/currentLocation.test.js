import { getCurrentClientLocation } from './currentLocation'
import AsyncStorage from '@react-native-async-storage/async-storage'

jest.mock('react-native-geolocation-service', () => ({ default: {} }))
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn().mockResolvedValue('true') },
}))

describe('getCurrentClientLocation', () => {
  beforeEach(() => {
    AsyncStorage.getItem.mockResolvedValue('true')
  })

  it('does not request or read location before the disclosure is accepted', async () => {
    AsyncStorage.getItem.mockResolvedValue(null)
    const permissions = {
      PERMISSIONS: { ACCESS_FINE_LOCATION: 'fine' },
      RESULTS: { GRANTED: 'granted', NEVER_ASK_AGAIN: 'never' },
      check: jest.fn().mockResolvedValue(false),
      request: jest.fn(),
    }
    const geolocation = { getCurrentPosition: jest.fn() }

    await expect(getCurrentClientLocation({ platform: 'android', permissions, geolocation }))
      .resolves.toEqual({ status: 'disclosure_required' })
    expect(permissions.check).not.toHaveBeenCalled()
    expect(permissions.request).not.toHaveBeenCalled()
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled()
  })

  it('asks for Android foreground permission before reading GPS', async () => {
    const permissions = {
      PERMISSIONS: { ACCESS_FINE_LOCATION: 'fine' },
      RESULTS: { GRANTED: 'granted', NEVER_ASK_AGAIN: 'never' },
      check: jest.fn().mockResolvedValue(false),
      request: jest.fn().mockResolvedValue('granted'),
    }
    const geolocation = {
      getCurrentPosition: jest.fn(success => success({ coords: { latitude: -8.9, longitude: 13.2 } })),
    }

    await expect(getCurrentClientLocation({ platform: 'android', permissions, geolocation }))
      .resolves.toEqual({ status: 'granted', coords: { lat: -8.9, lng: 13.2 } })
    expect(permissions.request).toHaveBeenCalledWith('fine', expect.any(Object))
  })

  it('does not call GPS when Android permission is permanently denied', async () => {
    const permissions = {
      PERMISSIONS: { ACCESS_FINE_LOCATION: 'fine' },
      RESULTS: { GRANTED: 'granted', NEVER_ASK_AGAIN: 'never' },
      check: jest.fn().mockResolvedValue(false),
      request: jest.fn().mockResolvedValue('never'),
    }
    const geolocation = { getCurrentPosition: jest.fn() }

    await expect(getCurrentClientLocation({ platform: 'android', permissions, geolocation }))
      .resolves.toEqual({ status: 'blocked' })
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled()
  })

  it('returns denied when the Android permission prompt is dismissed', async () => {
    const permissions = {
      PERMISSIONS: { ACCESS_FINE_LOCATION: 'fine' },
      RESULTS: { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never' },
      check: jest.fn().mockResolvedValue(false),
      request: jest.fn().mockResolvedValue('denied'),
    }
    const geolocation = { getCurrentPosition: jest.fn() }

    await expect(getCurrentClientLocation({ platform: 'android', permissions, geolocation }))
      .resolves.toEqual({ status: 'denied' })
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled()
  })

  it('uses an already granted approximate Android location without prompting for precise access', async () => {
    const permissions = {
      PERMISSIONS: { ACCESS_FINE_LOCATION: 'fine', ACCESS_COARSE_LOCATION: 'coarse' },
      RESULTS: { GRANTED: 'granted', NEVER_ASK_AGAIN: 'never' },
      check: jest.fn(permission => Promise.resolve(permission === 'coarse')),
      request: jest.fn(),
    }
    const geolocation = {
      getCurrentPosition: jest.fn(success => success({ coords: { latitude: -8.9, longitude: 13.2 } })),
    }

    await expect(getCurrentClientLocation({ platform: 'android', permissions, geolocation }))
      .resolves.toEqual({ status: 'granted', accuracy: 'reduced', coords: { lat: -8.9, lng: 13.2 } })
    expect(permissions.request).not.toHaveBeenCalled()
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('uses when-in-use authorization on iOS and rejects invalid coordinates', async () => {
    const geolocation = {
      requestAuthorization: jest.fn().mockResolvedValue('granted'),
      getCurrentPosition: jest.fn(success => success({ coords: { latitude: 91, longitude: 13 } })),
    }

    await expect(getCurrentClientLocation({ platform: 'ios', geolocation }))
      .resolves.toEqual({ status: 'error' })
    expect(geolocation.requestAuthorization).toHaveBeenCalledWith('whenInUse')
  })

  it('reports native location failures and requests a fresh high-accuracy fix with a timeout', async () => {
    const geolocation = {
      requestAuthorization: jest.fn().mockResolvedValue('granted'),
      getCurrentPosition: jest.fn((_success, error) => error({ code: 3 })),
    }

    await expect(getCurrentClientLocation({ platform: 'ios', geolocation }))
      .resolves.toEqual({ status: 'error' })
    expect(geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    )
  })
})
