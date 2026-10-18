import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import mobileUrls from '../config/mobileUrls';

// Debug via Metro e release usam produção por padrão; a variável permite override local explícito.
export const API_URL = mobileUrls.getMobileUrl(process.env.TOT_CLIENT_API_URL, 'https://api.taxitot.com');

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
