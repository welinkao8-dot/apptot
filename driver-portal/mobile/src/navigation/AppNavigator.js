import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React, { useContext } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import MainNavigator from './MainNavigator';

// Context
import { AuthContext } from '../context/AuthContext';
import colors from '../theme/colors';

const Stack = createStackNavigator();

export default function AppNavigator() {
    const { user, loading } = useContext(AuthContext);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    cardStyle: { backgroundColor: '#0f172a' },
                    animationEnabled: false,
                }}>
                {!user ? (
                    // 1. NÃO LOGADO → Tela de Login
                    <Stack.Screen name="Login" component={LoginScreen} />
                ) : user.status === 'pending_docs' ? (
                    // 2. LOGADO MAS SEM DOCS → Tela de envio de documentos
                    <Stack.Screen name="Register" component={RegisterScreen} />
                ) : user.status === 'pending' ? (
                    // 3. DOCS ENVIADOS, AGUARDANDO APROVAÇÃO → Tela de status pendente
                    <Stack.Screen name="Register" component={RegisterScreen} />
                ) : user.status === 'active' ? (
                    // 4. APROVADO → Acesso ao Dashboard com Bottom Tabs e Drawer
                    <Stack.Screen name="Main" component={MainNavigator} />
                ) : (
                    // 5. QUALQUER OUTRO STATUS (suspended, etc) → Volta pro Login
                    <Stack.Screen name="Login" component={LoginScreen} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
    },
});
