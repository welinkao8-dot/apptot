import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, History, LogOut, User, Bell, Settings, HelpCircle, FileText, Menu } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

import DashboardScreen from '../screens/DashboardScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import { AuthContext } from '../context/AuthContext';
import colors from '../theme/colors';

const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();

// Custom Drawer Content
function CustomDrawerContent(props) {
    const { user, logout } = useContext(AuthContext);

    // Detect active route
    const { state } = props;
    const activeRouteName = state.routes[state.index].name;
    const isMain = activeRouteName === 'Main';
    const mainState = isMain ? state.routes[state.index].state : null;
    const activeTab = mainState ? mainState.routes[mainState.index].name : 'DashboardTab';

    const isActive = (screen, tab = null) => {
        if (tab) return isMain && activeTab === tab;
        return activeRouteName === screen;
    };

    return (
        <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent} scrollEnabled={false}>
            {/* ULTRA-MINIMALIST TEXT-ONLY HEADER */}
            <View style={styles.headerWrapper}>
                <Text style={styles.stateLabelSmall}>ESTADO DA CONTA</Text>
                <View style={styles.statusRowMinimal}>
                    <View style={[styles.statusDotSmall, { backgroundColor: user?.status === 'active' ? '#10b981' : '#f59e0b' }]} />
                    <Text style={[styles.statusTextMinimal, { color: user?.status === 'active' ? '#10b981' : '#f59e0b' }]}>
                        {user?.status === 'active' ? 'ACTIVA' : 'PENDENTE'}
                    </Text>
                </View>
            </View>

            <View style={styles.drawerItems}>
                <TouchableOpacity
                    style={styles.drawerItem}
                    onPress={() => props.navigation.navigate('Main', { screen: 'DashboardTab' })}>
                    <View style={styles.drawerIconBox}>
                        <Home size={22} color={colors.primary} />
                    </View>
                    <Text style={styles.drawerItemText}>Início</Text>
                    <View style={[styles.activeIndicator, { backgroundColor: isActive('Main', 'DashboardTab') ? '#0f172a' : colors.primary }]} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.drawerItem}
                    onPress={() => props.navigation.navigate('Main', { screen: 'HistoryTab' })}>
                    <View style={styles.drawerIconBox}>
                        <History size={22} color={colors.primary} />
                    </View>
                    <Text style={styles.drawerItemText}>Corridas</Text>
                    <View style={[styles.activeIndicator, { backgroundColor: isActive('Main', 'HistoryTab') ? '#0f172a' : colors.primary }]} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.drawerItem}
                    onPress={() => props.navigation.navigate('Profile')}>
                    <View style={styles.drawerIconBox}>
                        <User size={22} color={colors.primary} />
                    </View>
                    <Text style={styles.drawerItemText}>Perfil</Text>
                    <View style={[styles.activeIndicator, { backgroundColor: isActive('Profile') ? '#0f172a' : colors.primary }]} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.drawerItem}
                    onPress={() => props.navigation.navigate('Documents')}>
                    <View style={styles.drawerIconBox}>
                        <FileText size={22} color={colors.primary} />
                    </View>
                    <Text style={styles.drawerItemText}>Documentos</Text>
                    <View style={[styles.activeIndicator, { backgroundColor: isActive('Documents') ? '#0f172a' : colors.primary }]} />
                </TouchableOpacity>

                <View style={styles.drawerDivider} />

                <TouchableOpacity style={styles.drawerItem}>
                    <View style={styles.drawerIconBox}>
                        <HelpCircle size={22} color={colors.textSecondary} />
                    </View>
                    <Text style={styles.drawerItemText}>Central de Ajuda</Text>
                </TouchableOpacity>

                <View style={styles.drawerDivider} />
            </View>

            {/* LOGOUT BUTTON JUST ABOVE FOOTER */}
            <TouchableOpacity
                style={[styles.drawerItem, styles.logoutItem]}
                onPress={logout}>
                <View style={[styles.drawerIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <LogOut size={22} color="#ef4444" />
                </View>
                <Text style={[styles.drawerItemText, styles.logoutText]}>Encerrar Sessão</Text>
            </TouchableOpacity>

            {/* PREMIUN FOOTER */}
            <View style={styles.drawerFooter}>
                <Text style={styles.versionText}>TOT Driver v1.1.0</Text>
                <Text style={styles.companyText}>© 2026 Grupo Torres Center</Text>
            </View>
        </DrawerContentScrollView>
    );
}

// Bottom Tab Navigator
function BottomTabNavigator() {
    const { logout } = useContext(AuthContext);

    return (
        <Tab.Navigator
            initialRouteName="DashboardTab"
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarShowLabel: true,
                tabBarLabelStyle: styles.tabLabel,
                animationEnabled: false, // Prevents AnimatedNode crash during tab switches
            }}>
            <Tab.Screen
                name="MenuTab"
                component={View}
                listeners={({ navigation }) => ({
                    tabPress: (e) => {
                        e.preventDefault();
                        navigation.openDrawer();
                    },
                })}
                options={{
                    tabBarLabel: 'Menu',
                    tabBarIcon: ({ color, size }) => <Menu size={size} color={color} />,
                }}
            />
            <Tab.Screen
                name="DashboardTab"
                component={DashboardScreen}
                options={{
                    tabBarLabel: 'Início',
                    tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
                }}
            />
            <Tab.Screen
                name="HistoryTab"
                component={HistoryScreen}
                options={{
                    tabBarLabel: 'Corridas',
                    tabBarIcon: ({ color, size }) => <History size={size} color={color} />,
                }}
            />
            <Tab.Screen
                name="LogoutTab"
                component={View} // Dummy component
                listeners={{
                    tabPress: (e) => {
                        e.preventDefault();
                        logout();
                    },
                }}
                options={{
                    tabBarLabel: 'Sair',
                    tabBarIcon: ({ color, size }) => <LogOut size={size} color={color} />,
                }}
            />
        </Tab.Navigator>
    );
}

// Main Drawer Navigator
export default function MainNavigator() {
    return (
        <Drawer.Navigator
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerType: 'front',
                drawerStyle: styles.drawer,
            }}>
            <Drawer.Screen name="Main" component={BottomTabNavigator} />
            <Drawer.Screen name="Profile" component={ProfileScreen} />
            <Drawer.Screen name="Documents" component={DocumentsScreen} />
        </Drawer.Navigator>
    );
}

const styles = StyleSheet.create({
    // Drawer Styles
    drawer: {
        backgroundColor: '#ffffff',
        width: 300,
    },
    drawerContent: {
        flex: 1,
    },
    headerWrapper: {
        height: 60,
        paddingHorizontal: 20,
        justifyContent: 'flex-end',
        paddingBottom: 4,
    },
    stateLabelSmall: {
        fontSize: 8,
        fontWeight: '900',
        color: 'rgba(0, 0, 0, 0.5)',
        letterSpacing: 2,
        marginBottom: 2,
    },
    statusRowMinimal: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusDotSmall: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusTextMinimal: {
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 1,
    },
    drawerItems: {
        flex: 1,
        paddingTop: 16,
    },
    drawerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginBottom: 4,
        position: 'relative',
    },
    drawerIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(233, 30, 99, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    drawerItemText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#334155',
    },
    activeIndicator: {
        position: 'absolute',
        right: 0,
        width: 4,
        height: 20,
        backgroundColor: colors.primary,
        borderTopLeftRadius: 4,
        borderBottomLeftRadius: 4,
    },
    drawerDivider: {
        height: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        marginVertical: 12,
        marginHorizontal: 16,
    },
    logoutItem: {
        marginTop: 'auto',
        marginBottom: 8,
    },
    logoutText: {
        color: '#ef4444',
        fontWeight: '800',
    },
    drawerFooter: {
        padding: 20,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.03)',
    },
    versionText: {
        fontSize: 11,
        fontWeight: '900',
        color: colors.primary,
        letterSpacing: 1,
        marginBottom: 2,
    },
    companyText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#000000',
    },

    // Bottom Tab Styles
    tabBar: {
        backgroundColor: '#0f172a',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
        height: 75,
        paddingBottom: 12,
        paddingTop: 10,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
});
