import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    SafeAreaView,
    ScrollView,
    Dimensions,
} from 'react-native';
import {
    Home,
    History as HistoryIcon,
    User,
    CreditCard,
    Gift,
    Settings,
    HelpCircle,
    LogOut,
    ChevronRight,
    Car,
    Package
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

const { width } = Dimensions.get('window');

export default function Sidebar({ navigation }) {
    const { user, signOut } = useAuth();

    const menuItems = [
        { id: 'Dashboard', label: 'Início', icon: Home },
        { id: 'Deliveries', label: 'Minhas Entregas', icon: Package },
        { id: 'History', label: 'Minhas Viagens', icon: HistoryIcon },
        { id: 'Payments', label: 'Pagamentos', icon: CreditCard },
        { id: 'Promos', label: 'Promoções', icon: Gift },
        { id: 'Profile', label: 'Perfil', icon: User },
    ];

    const bottomItems = [
        { id: 'Settings', label: 'Configurações', icon: Settings },
        { id: 'Support', label: 'Suporte', icon: HelpCircle },
    ];

    const handleNavigate = (route) => {
        if (route === 'Dashboard' || route === 'History' || route === 'Deliveries') {
            navigation.navigate(route);
        } else {
            // Placeholder for other routes
            console.log('Navigating to', route);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.profileBadge}>
                    <View style={styles.avatarCircle}>
                        <User size={30} color="#FFF" />
                    </View>
                    <View style={styles.statusDot} />
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user?.full_name || 'Usuário TOT'}</Text>
                    <Text style={styles.userPhone}>{user?.phone || '9XXXXXXXX'}</Text>
                </View>
            </View>

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.navGroup}>
                    {menuItems.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.navItem}
                            onPress={() => handleNavigate(item.id)}
                        >
                            <View style={styles.itemIconBox}>
                                <item.icon size={22} color={colors.text} />
                            </View>
                            <Text style={styles.itemLabel}>{item.label}</Text>
                            <ChevronRight size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.divider} />

                <View style={styles.navGroup}>
                    {bottomItems.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.navItem}
                            onPress={() => handleNavigate(item.id)}
                        >
                            <View style={styles.itemIconBox}>
                                <item.icon size={22} color={colors.textMuted} />
                            </View>
                            <Text style={[styles.itemLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity style={styles.promoCard}>
                    <View style={styles.promoIcon}>
                        <Car size={24} color={colors.primary} />
                    </View>
                    <View>
                        <Text style={styles.promoTitle}>Convide Amigos</Text>
                        <Text style={styles.promoSub}>Ganhe Kz 500 de desconto</Text>
                    </View>
                </TouchableOpacity>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
                    <View style={styles.logoutIconBox}>
                        <LogOut size={20} color={colors.error} />
                    </View>
                    <Text style={styles.logoutText}>Sair da Conta</Text>
                </TouchableOpacity>
                <Text style={styles.versionText}>Versão 1.0.4 Premium</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    header: {
        padding: 24,
        paddingTop: 40,
        backgroundColor: colors.primary,
        borderBottomRightRadius: 40,
        ...colors.shadow,
        shadowColor: colors.primary,
    },
    profileBadge: {
        width: 80,
        height: 80,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    avatarCircle: {
        width: 64,
        height: 64,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusDot: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#4ade80',
        borderWidth: 2,
        borderColor: colors.primary,
    },
    userInfo: {
        marginTop: 5,
    },
    userName: {
        fontSize: 22,
        fontWeight: '950',
        color: '#FFF',
    },
    userPhone: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '600',
        marginTop: 2,
    },
    scrollContent: {
        flex: 1,
        padding: 24,
    },
    navGroup: {
        marginBottom: 30,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        marginBottom: 5,
    },
    itemIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    itemLabel: {
        flex: 1,
        fontSize: 16,
        fontWeight: '800',
        color: colors.text,
    },
    divider: {
        height: 1.5,
        backgroundColor: '#F1F5F9',
        marginBottom: 30,
    },
    promoCard: {
        backgroundColor: '#FDF2F5',
        borderRadius: 24,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        marginBottom: 40,
        borderWidth: 1,
        borderColor: 'rgba(233, 30, 99, 0.1)',
    },
    promoIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        ...colors.shadow,
    },
    promoTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: colors.text,
    },
    promoSub: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '700',
        marginTop: 2,
    },
    footer: {
        padding: 24,
        borderTopWidth: 1.5,
        borderTopColor: '#F8FAFC',
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    logoutIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#FFF1F2',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    logoutText: {
        fontSize: 15,
        fontWeight: '900',
        color: colors.error,
    },
    versionText: {
        fontSize: 10,
        color: colors.textMuted,
        fontWeight: '700',
        textAlign: 'center',
    }
});
