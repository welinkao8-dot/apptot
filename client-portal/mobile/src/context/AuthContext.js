import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { API_URL } from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStorageData();
    }, []);

    async function loadStorageData() {
        try {
            const authDataSerialized = await AsyncStorage.getItem('@tot_token');
            const userDataSerialized = await AsyncStorage.getItem('@tot_user');

            if (authDataSerialized && userDataSerialized) {
                const _token = authDataSerialized;
                const _user = JSON.parse(userDataSerialized);
                setToken(_token);
                setUser(_user);
            }
        } catch (e) {
            console.error('Error loading auth data', e);
        } finally {
            setLoading(false);
        }
    }

    const checkPhone = async (phone) => {
        try {
            const response = await api.post('/auth/check-phone', { phone });
            return response.data; // { exists: boolean, name?: string }
        } catch (error) {
            console.error('Check phone error:', error);
            throw error;
        }
    };

    const register = async (phone, fullName, password) => {
        try {
            const response = await api.post('/auth/register', { phone, fullName, password });
            const { token: _token, user: _user } = response.data;

            await AsyncStorage.setItem('@tot_token', _token);
            await AsyncStorage.setItem('@tot_user', JSON.stringify(_user));

            setToken(_token);
            setUser(_user);
            return response.data;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    };

    const signIn = async (phone, password) => {
        try {
            const response = await api.post('/auth/login', { phone, password });
            const { token: _token, user: _user } = response.data;

            await AsyncStorage.setItem('@tot_token', _token);
            await AsyncStorage.setItem('@tot_user', JSON.stringify(_user));

            setToken(_token);
            setUser(_user);
            return response.data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };

    const signOut = async () => {
        await AsyncStorage.removeItem('@tot_token');
        await AsyncStorage.removeItem('@tot_user');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, checkPhone, register, signIn, signOut, API_URL }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
