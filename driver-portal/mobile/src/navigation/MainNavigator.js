import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, History, LogOut, User, Bell, Settings, HelpCircle, FileText, Menu, DollarSign } from 'lucide-react-native';

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
    const { state } = props;
    const activeRouteName = state.routes[state.index].name;

    const isActive = (screen) => activeRouteName === screen;

    return (
        <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent} scrollEnabled={false}>
            {/* Minimalist Account Status header */}
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
                    style={[styles.drawerItem, isActive('Main') && styles.drawerItemActive]}
                    onPress={() => props.navigation.navigate('Main')}>
                    <View style={[styles.drawerIconBox, isActive('Main') && styles.drawerIconBoxActive]}>
                        <Home size={22} color={isActive('Main') ? '#fff' : colors.primary} />
                    </View>
                    <Text style={[styles.drawerItemText, isActive('Main') && styles.drawerItemTextActive]}>Início / Dashboard</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.drawerItem, isActive('Documents') && styles.drawerItemActive]}
                    onPress={() => props.navigation.navigate('Documents')}>
                    <View style={[styles.drawerIconBox, isActive('Documents') && styles.drawerIconBoxActive]}>
                        <FileText size={22} color={isActive('Documents') ? '#fff' : colors.primary} />
                    </View>
                    <Text style={[styles.drawerItemText, isActive('Documents') && styles.drawerItemTextActive]}>Meus Documentos</Text>
                </TouchableOpacity>

                <View style={styles.drawerDivider} />

                <TouchableOpacity style={styles.drawerItem}>
                    <View style={styles.drawerIconBox}>
                        <HelpCircle size={22} color={colors.textSecondary} />
                    </View>
                    <Text style={styles.drawerItemText}>Central de Ajuda</Text>
                </TouchableOpacity>
            </View>

            {/* Logout button */}
            <TouchableOpacity style={[styles.drawerItem, styles.logoutItem]} onPress={logout}>
                <View style={[styles.drawerIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <LogOut size={22} color="#ef4444" />
                </View>
                <Text style={[styles.drawerItemText, styles.logoutText]}>Encerrar Sessão</Text>
            </TouchableOpacity>

            <View style={styles.drawerFooter}>
                <Text style={styles.versionText}>TOT Driver v1.2.0</Text>
                <Text style={styles.companyText}>© 2026 Grupo Torres Center</Text>
            </View>
        </DrawerContentScrollView>
    );
}

// Bottom Tab Navigator
function BottomTabNavigator() {
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
                animationEnabled: false,
            }}>
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
                    tabBarLabel: 'Ganhos',
                    tabBarIcon: ({ color, size }) => <DollarSign size={size} color={color} />,
                }}
            />
            <Tab.Screen
                name="ProfileTab"
                component={ProfileScreen}
                options={{
                    tabBarLabel: 'Perfil',
                    tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
                }}
            />
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
            <Drawer.Screen name="Documents" component={DocumentsScreen} />
        </Drawer.Navigator>
    );
}

const styles = StyleSheet.create({
    drawer: { backgroundColor: '#ffffff', width: 280 },
    drawerContent: { flex: 1 },
    headerWrapper: { height: 70, paddingHorizontal: 20, justifyContent: 'flex-end', paddingBottom: 8 },
    stateLabelSmall: { fontSize: 8, fontWeight: '900', color: 'rgba(0, 0, 0, 0.5)', letterSpacing: 2, marginBottom: 2 },
    statusRowMinimal: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statusDotSmall: { width: 6, height: 6, borderRadius: 3 },
    statusTextMinimal: { fontSize: 14, fontWeight: '900', letterSpacing: 1 },
    drawerItems: { flex: 1, paddingTop: 16 },
    drawerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, marginBottom: 4 },
    drawerIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(182, 0, 89, 0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    drawerItemText: { fontSize: 15, fontWeight: '700', color: '#334155' },
    drawerDivider: { height: 1, backgroundColor: 'rgba(0, 0, 0, 0.05)', marginVertical: 12, marginHorizontal: 16 },
    logoutItem: { marginTop: 'auto', marginBottom: 8 },
    logoutText: { color: '#ef4444', fontWeight: '800' },
    drawerFooter: { padding: 20, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(0, 0, 0, 0.03)' },
    versionText: { fontSize: 11, fontWeight: '900', color: colors.primary, letterSpacing: 1, marginBottom: 2 },
    companyText: { fontSize: 9, fontWeight: '800', color: '#000000' },

    // Bottom Tab Bar Styles
    tabBar: {
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#f1f1f5',
        height: 75,
        paddingBottom: Platform.OS === 'ios' ? 15 : 12,
        paddingTop: 10,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    tabLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    drawerItemActive: { backgroundColor: '#FCE7F3', borderRadius: 12, marginHorizontal: 8 },
    drawerIconBoxActive: { backgroundColor: colors.primary },
    drawerItemTextActive: { color: colors.primary },
});
