import { requireNativeComponent, ViewProps } from 'react-native';

/**
 * MapboxNavigationView
 * 
 * Componente 100% nativo (Android) que gere a renderização do mapa,
 * a linha da rota (RouteLine) e a câmera de navegação.
 * 
 * @props mapStyle - URI do estilo do Mapbox (padrão: mapbox://styles/mapbox/streets-v12)
 */
const MapboxNavigationView = requireNativeComponent('MapboxNavigationView');

export default MapboxNavigationView;
