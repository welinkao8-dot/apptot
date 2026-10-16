import { PermissionsAndroid, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Geolocation from 'react-native-geolocation-service'

const LOCATION_DISCLOSURE_KEY = '@has_seen_location_disclosure_v2'

const locationRationale = {
  title: 'Permissão de localização',
  message: 'O TOT usa a sua localização para preencher o ponto de recolha. Também pode escolher o ponto diretamente no mapa.',
  buttonPositive: 'Permitir',
  buttonNegative: 'Agora não',
}

async function requestForegroundPermission(platform, permissions, geolocation) {
  if (platform === 'android') {
    const finePermission = permissions.PERMISSIONS.ACCESS_FINE_LOCATION
    const coarsePermission = permissions.PERMISSIONS.ACCESS_COARSE_LOCATION
    if (await permissions.check(finePermission)) return 'granted'
    if (coarsePermission && await permissions.check(coarsePermission)) return 'limited'

    const result = await permissions.request(finePermission, locationRationale)
    if (result === permissions.RESULTS.GRANTED) return 'granted'
    if (coarsePermission && await permissions.check(coarsePermission)) return 'limited'
    return result === permissions.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied'
  }

  if (platform === 'ios') {
    const result = await geolocation.requestAuthorization('whenInUse')
    return result === 'granted' ? 'granted' : result === 'denied' || result === 'restricted' ? 'blocked' : 'denied'
  }

  return 'unavailable'
}

export async function getCurrentClientLocation({
  platform = Platform.OS,
  permissions = PermissionsAndroid,
  geolocation = Geolocation,
} = {}) {
  try {
    if (await AsyncStorage.getItem(LOCATION_DISCLOSURE_KEY) !== 'true') {
      return { status: 'disclosure_required' }
    }

    const permission = await requestForegroundPermission(platform, permissions, geolocation)
    if (permission !== 'granted' && permission !== 'limited') return { status: permission }

    return await new Promise(resolve => {
      geolocation.getCurrentPosition(
        position => {
          const lat = position?.coords?.latitude
          const lng = position?.coords?.longitude
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            resolve({ status: 'error' })
            return
          }
          resolve({
            status: 'granted',
            ...(permission === 'limited' ? { accuracy: 'reduced' } : {}),
            coords: { lat, lng },
          })
        },
        () => resolve({ status: 'error' }),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      )
    })
  } catch {
    return { status: 'error' }
  }
}
