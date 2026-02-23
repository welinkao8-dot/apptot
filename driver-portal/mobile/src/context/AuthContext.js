import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Toast from 'react-native-toast-message';

export const AuthContext = createContext();

// CONFIGURAÇÃO DA API
// IMPORTANTE: Emulador usa 10.0.2.2 para acessar localhost do PC
// Dispositivo físico Wi-Fi precisa do IP da LAN (ex: 10.140.244.1)
// Para testar via cabo USB use 'adb reverse tcp:3004 tcp:3004'
export const API_URL = 'http://localhost:3004';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // Carregar dados salvos ao iniciar
    useEffect(() => {
        loadStorageData();
    }, []);

    const loadStorageData = async () => {
        try {
            const storedToken = await AsyncStorage.getItem('@tot_token');
            const storedUser = await AsyncStorage.getItem('@tot_user');

            if (storedToken && storedUser) {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
                // Configurar header padrão para o axios
                axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            }
        } catch (e) {
            console.error('Failed to load auth data', e);
        } finally {
            setLoading(false);
        }
    };

    const checkPhone = async (phone) => {
        try {
            const response = await axios.post(`${API_URL}/auth/check-phone`, { phone });
            return { exists: response.data.exists, error: null };
        } catch (err) {
            console.error('Check phone error', err);
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

            Toast.show({
                type: 'success',
                text1: 'Bem-vindo(a)!',
                text2: 'Login realizado com sucesso',
            });
            return { success: true };
        } catch (error) {
            console.error('Login error:', error);
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

            return { success: true, driver };
        } catch (err) {
            console.error('Sign up error', err);
            return { success: false, error: err.response?.data?.message || 'Erro ao realizar cadastro' };
        }
    };

    const updateDocs = async (docData) => {
        try {
            // Include driverId from current user context if not passed, but usually purely doc data implies current user
            // Web implementation sends { ...docData, driverId: user.id }
            const payload = { ...docData, driverId: user.id };
            console.log('Sending docs:', Object.keys(payload));

            const response = await axios.post(`${API_URL}/auth/update-docs`, payload);

            // Merge updates into local user state
            const updatedUser = { ...user, status: 'pending', ...docData };
            // Note: documents are large base64 strings, maybe don't store them all in AsyncStorage user object if not needed?
            // Web stores them. driver details.

            await AsyncStorage.setItem('@tot_user', JSON.stringify(updatedUser));
            setUser(updatedUser);

            return { success: true };
        } catch (err) {
            console.error('Update docs error', err);
            return { success: false, error: err.response?.data?.message || 'Erro ao enviar documentos' };
        }
    };

    const logout = async () => {
        try {
            await AsyncStorage.removeItem('@tot_token');
            await AsyncStorage.removeItem('@tot_user');
            setToken(null);
            setUser(null);
            delete axios.defaults.headers.common['Authorization'];
        } catch (e) {
            console.error('Logout error', e);
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, checkPhone, login, signUp, updateDocs, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
