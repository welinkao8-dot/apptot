import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { NativeModules, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { toSafeErrorLog } from '../utils/safeErrorLog';
import { clearNativeLocationSession, syncNativeLocationSession } from '../services/nativeLocationSession';
import mobileUrls from '../config/mobileUrls';
import { registerDriverPushToken, removeDriverPushToken } from '../services/driverPushNotifications';

export const AuthContext = createContext();

// Debug via Metro e release usam produção por padrão; a variável permite override local explícito.
export const API_URL = mobileUrls.getMobileUrl(process.env.TOT_DRIVER_API_URL, 'https://driver-api.taxitot.com');
const { LocationModule } = NativeModules;

const syncNativeLocationUpload = async (driver, sessionToken) => {
    const result = await syncNativeLocationSession({
        locationModule: LocationModule,
        user: driver,
        token: sessionToken,
        apiUrl: API_URL,
    });
    result.errors.forEach((error) => {
        console.error('Could not synchronize native location session', toSafeErrorLog(error));
    });
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // Carregar dados salvos ao iniciar
    useEffect(() => {
        loadStorageData();
    }, []);

    useEffect(() => {
        if (!token || Platform.OS !== 'android') return undefined;

        let active = true;
        const pushApi = axios.create({ baseURL: API_URL, headers: { Authorization: `Bearer ${token}` } });
        const saveToken = async (fcmToken) => {
            try {
                if (active) await registerDriverPushToken({ token: fcmToken, platform: 'android', api: pushApi });
            } catch {
                console.warn('Push notification registration could not be synchronized.');
            }
        };

        const instance = messaging();
        instance.getToken().then(saveToken).catch(() => {
            console.warn('Firebase could not provide a push token.');
        });
        const unsubscribe = instance.onTokenRefresh(saveToken);

        return () => {
            active = false;
            unsubscribe();
        };
    }, [token]);

    const loadStorageData = async () => {
        try {
            const storedToken = await AsyncStorage.getItem('@tot_token');
            const storedUser = await AsyncStorage.getItem('@tot_user');

            if (storedToken && storedUser) {
                setToken(storedToken);
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                // Configurar header padrão para o axios
                axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
                await syncNativeLocationUpload(parsedUser, storedToken);
            } else {
                await clearNativeLocationSession(LocationModule);
            }
        } catch (e) {
            console.error('Failed to load auth data', toSafeErrorLog(e));
            await clearNativeLocationSession(LocationModule);
        } finally {
            setLoading(false);
        }
    };

    const checkPhone = async (phone) => {
        try {
            const response = await axios.post(`${API_URL}/auth/check-phone`, { phone });
            return { exists: response.data.exists, error: null };
        } catch (err) {
            console.error('Check phone error', toSafeErrorLog(err));
            return { exists: false, error: err.response?.data?.message || 'Erro ao conectar com servidor' };
        }
    };

    const login = async (phone, password) => {
        try {
            console.log('Tentando login em:', API_URL + '/auth/login');
            const response = await axios.post(`${API_URL}/auth/login`, {
                phone,
                password,
            });

            const { token, driver } = response.data;

            await AsyncStorage.setItem('@tot_token', token);
            await AsyncStorage.setItem('@tot_user', JSON.stringify(driver));

            setToken(token);
            setUser(driver);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            await syncNativeLocationUpload(driver, token);

            Toast.show({
                type: 'success',
                text1: 'Bem-vindo(a)!',
                text2: 'Login realizado com sucesso',
            });
            return { success: true };
        } catch (error) {
            console.error('Login error:', toSafeErrorLog(error));
            const msg = error.response?.data?.message || 'Erro ao conectar com servidor';
            Toast.show({
                type: 'error',
                text1: 'Erro no Login',
                text2: msg,
            });
            return { success: false, error: msg };
        }
    };

    const signUp = async (driverData) => {
        try {
            const response = await axios.post(`${API_URL}/auth/register`, driverData);
            const { token, driver } = response.data;

            await AsyncStorage.setItem('@tot_token', token);
            await AsyncStorage.setItem('@tot_user', JSON.stringify(driver));

            setToken(token);
            setUser(driver);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            await syncNativeLocationUpload(driver, token);

            return { success: true, driver };
        } catch (err) {
            console.error('Sign up error', toSafeErrorLog(err));
            return { success: false, error: err.response?.data?.message || 'Erro ao realizar cadastro' };
        }
    };

    const updateDocs = async (docData) => {
        try {
            // The authenticated JWT identifies the driver; never send a client-controlled owner ID.
            const payload = { ...docData };
            console.log('Sending docs:', Object.keys(payload));

            const response = await axios.post(`${API_URL}/auth/update-docs`, payload);

            // Merge updates into local user state
            const updatedUser = { ...user, status: 'pending' };
            // Note: documents are large base64 strings, maybe don't store them all in AsyncStorage user object if not needed?
            // Web stores them. driver details.

            await AsyncStorage.setItem('@tot_user', JSON.stringify(updatedUser));
            setUser(updatedUser);

            return { success: true };
        } catch (err) {
            console.error('Update docs error', toSafeErrorLog(err));
            return { success: false, error: err.response?.data?.message || 'Erro ao enviar documentos' };
        }
    };

    const logout = async () => {
        if (Platform.OS === 'android') {
            try {
                const instance = messaging();
                const pushApi = axios.create({ baseURL: API_URL, headers: { Authorization: `Bearer ${token}` } });
                await removeDriverPushToken({ token: await instance.getToken(), api: pushApi, messaging: instance });
            } catch {
                console.warn('Push notification token cleanup could not be synchronized.');
            }
        }
        const cleanupErrors = await clearNativeLocationSession(LocationModule);
        const storageResults = await Promise.allSettled([
            AsyncStorage.removeItem('@tot_token'),
            AsyncStorage.removeItem('@tot_user'),
        ]);
        cleanupErrors.forEach((error) => console.error('Native location cleanup error', toSafeErrorLog(error)));
        storageResults.filter((result) => result.status === 'rejected').forEach((result) => {
            console.error('Auth storage cleanup error', toSafeErrorLog(result.reason));
        });
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, checkPhone, login, signUp, updateDocs, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
