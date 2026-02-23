import React from 'react';
import { StatusBar, LogBox } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Ignore specific logs if necessary
LogBox.ignoreLogs(['Non-serializable values were found in the navigation state']);

const toastConfig = {
    success: (props) => (
        <BaseToast
            {...props}
            style={{ borderLeftColor: '#4ade80' }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{
                fontSize: 15,
                fontWeight: '400'
            }}
        />
    ),
    error: (props) => (
        <ErrorToast
            {...props}
            text1Style={{
                fontSize: 15,
                fontWeight: '400'
            }}
            text2Style={{
                fontSize: 13,
                color: '#666'
            }}
        />
    ),
    warning: (props) => (
        <BaseToast
            {...props}
            style={{ borderLeftColor: '#F59E0B' }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{
                fontSize: 15,
                fontWeight: '700'
            }}
        />
    )
};

const App = () => {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
                <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
                <AppNavigator />
                <Toast config={toastConfig} />
            </AuthProvider>
        </GestureHandlerRootView>
    );
};

export default App;
