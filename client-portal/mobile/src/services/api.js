import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuração padrão para USB (adb reverse tcp:3001 tcp:3001)
export const API_URL = 'http://localhost:3001';

const api = axios.create({
    baseURL: API_URL,
    timeout: 15000,
});

api.interceptors.request.use(async config => {
    const token = await AsyncStorage.getItem('@tot_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Adicionar métodos customizados
api.getServices = () => api.get('/services');

export default api;
