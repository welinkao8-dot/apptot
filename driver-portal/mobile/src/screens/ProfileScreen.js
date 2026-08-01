import React, { useState, useContext } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, StatusBar, Image, Switch, Platform
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { 
    User, Bell, ChevronRight, Settings, Globe, Moon, HelpCircle, 
    ShieldAlert, LogOut, Bike, MapPin, FileText, CheckCircle
} from 'lucide-react-native';
import colors from '../theme/colors';

export default function ProfileScreen({ navigation }) {
    const { user, logout } = useContext(AuthContext);
    const [darkMode, setDarkMode] = useState(false);

    const handleLogout = () => {
        logout();
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

            {/* ─── TOP APP BAR ─── */}
            <View style={styles.topBar}>
                <View style={styles.topBarLeft}>
                    <View style={styles.headerAvatarBorder}>
                        {user?.avatar_url ? (
                            <Image source={{ uri: user.avatar_url }} style={styles.headerAvatar} />
                        ) : (
                            <View style={styles.headerAvatarFallback}>
                                <Text style={styles.avatarFallbackText}>
                                    {user?.full_name?.[0]?.toUpperCase() || 'M'}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.logoText}>TOT</Text>
                </View>
                <Text style={styles.barTitle}>Perfil do Motorista</Text>
                <TouchableOpacity style={styles.notifyBtn} activeOpacity={0.8}>
                    <Bell size={18} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {/* ─── SCROLLABLE CANVAS ─── */}
            <ScrollView style={styles.canvas} contentContainerStyle={styles.canvasContent} showsVerticalScrollIndicator={false}>
                
                {/* Profile Summary Card */}
                <View style={styles.profileCard}>
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatarBorder}>
                            {user?.avatar_url ? (
                                <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
                            ) : (
                                <View style={styles.avatarFallbackLarge}>
                                    <Text style={styles.avatarFallbackLargeText}>
                                        {user?.full_name?.[0]?.toUpperCase() || 'M'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.ratingBadge}>
                            <Text style={styles.ratingText}>{user?.rating || 4.9} ⭐</Text>
                        </View>
                    </View>

                    <View style={styles.profileInfo}>
                        <Text style={styles.driverName}>{user?.full_name || 'Motorista'}</Text>
                        <View style={styles.badgeRow}>
                            <View style={styles.idBadge}>
                                <Text style={styles.idBadgeText}>
                                    ID: {user?.id?.substring(0, 5)?.toUpperCase() || '88214'}-AO
                                </Text>
                            </View>
                            <View style={styles.verifiedBadge}>
                                <CheckCircle size={12} color={colors.primary} style={{ marginRight: 4 }} />
                                <Text style={styles.verifiedText}>Verificado</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Vehicle Section */}
                <Text style={styles.sectionLabel}>Veículo</Text>
                <View style={styles.vehicleGrid}>
                    <View style={styles.vehicleCard}>
                        <View style={styles.iconBox}>
                            <Bike size={24} color={colors.primary} />
                        </View>
                        <View>
                            <Text style={styles.vehicleLabel}>Modelo</Text>
                            <Text style={styles.vehicleValue}>{user?.vehicle_model || 'Honda Winner X'}</Text>
                        </View>
                    </View>
                    
                    <View style={styles.vehicleCard}>
                        <View style={styles.iconBox}>
                            <MapPin size={24} color={colors.primary} />
                        </View>
                        <View>
                            <Text style={styles.vehicleLabel}>Matrícula</Text>
                            <Text style={styles.vehicleValue}>
                                LD-{user?.phone?.substring(5, 7) || '92'}-{user?.phone?.substring(7, 9) || '48'}-AO
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Option Groups (Bento style lists) */}
                <View style={styles.optionsWrapper}>
                    
                    {/* Documentation Group */}
                    <View style={styles.groupCard}>
                        <View style={styles.groupHeader}>
                            <Text style={styles.groupHeaderText}>Documentação</Text>
                        </View>
                        <View style={styles.groupBody}>
                            <TouchableOpacity style={styles.optionItem} activeOpacity={0.8}>
                                <View style={styles.optionLeft}>
                                    <FileText size={18} color={colors.primary} style={{ marginRight: 12 }} />
                                    <Text style={styles.optionTitle}>Carteira de Habilitação</Text>
                                </View>
                                <ChevronRight size={18} color={colors.textSecondary} />
                            </TouchableOpacity>

                            <View style={styles.divider} />

                            <TouchableOpacity style={styles.optionItem} activeOpacity={0.8}>
                                <View style={styles.optionLeft}>
                                    <FileText size={18} color={colors.primary} style={{ marginRight: 12 }} />
                                    <Text style={styles.optionTitle}>Seguro do Veículo</Text>
                                </View>
                                <ChevronRight size={18} color={colors.textSecondary} />
                            </TouchableOpacity>

                            <View style={styles.divider} />

                            <TouchableOpacity style={styles.optionItem} activeOpacity={0.8}>
                                <View style={styles.optionLeft}>
                                    <FileText size={18} color={colors.primary} style={{ marginRight: 12 }} />
                                    <Text style={styles.optionTitle}>Certificado de Registro</Text>
                                </View>
                                <ChevronRight size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Preferences Group */}
                    <View style={styles.groupCard}>
                        <View style={styles.groupHeader}>
                            <Text style={styles.groupHeaderText}>Preferências</Text>
                        </View>
                        <View style={styles.groupBody}>
                            <TouchableOpacity style={styles.optionItem} activeOpacity={0.8}>
                                <View style={styles.optionLeft}>
                                    <Settings size={18} color={colors.primary} style={{ marginRight: 12 }} />
                                    <Text style={styles.optionTitle}>Configurações do App</Text>
                                </View>
                                <ChevronRight size={18} color={colors.textSecondary} />
                            </TouchableOpacity>

                            <View style={styles.divider} />

                            <TouchableOpacity style={styles.optionItem} activeOpacity={0.8}>
                                <View style={styles.optionLeft}>
                                    <Globe size={18} color={colors.primary} style={{ marginRight: 12 }} />
                                    <Text style={styles.optionTitle}>Idioma</Text>
                                </View>
                                <View style={styles.optionRight}>
                                    <Text style={styles.optionRightVal}>Português</Text>
                                    <ChevronRight size={18} color={colors.textSecondary} />
                                </View>
                            </TouchableOpacity>

                            <View style={styles.divider} />

                            <View style={styles.optionItem}>
                                <View style={styles.optionLeft}>
                                    <Moon size={18} color={colors.primary} style={{ marginRight: 12 }} />
                                    <Text style={styles.optionTitle}>Modo Noturno</Text>
                                </View>
                                <Switch 
                                    value={darkMode} 
                                    onValueChange={setDarkMode} 
                                    trackColor={{ false: colors.surfaceContainerHighest, true: colors.primaryLight }}
                                    thumbColor={darkMode ? colors.primary : '#fff'}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Support Group */}
                    <View style={styles.groupCard}>
                        <View style={styles.groupHeader}>
                            <Text style={styles.groupHeaderText}>Suporte</Text>
                        </View>
                        <View style={styles.groupBody}>
                            <TouchableOpacity style={styles.optionItem} activeOpacity={0.8}>
                                <View style={styles.optionLeft}>
                                    <HelpCircle size={18} color={colors.primary} style={{ marginRight: 12 }} />
                                    <Text style={styles.optionTitle}>Central de Ajuda</Text>
                                </View>
                                <ChevronRight size={18} color={colors.textSecondary} />
                            </TouchableOpacity>

                            <View style={styles.divider} />

                            <TouchableOpacity style={styles.optionItem} activeOpacity={0.8}>
                                <View style={styles.optionLeft}>
                                    <ShieldAlert size={18} color={colors.primary} style={{ marginRight: 12 }} />
                                    <Text style={styles.optionTitle}>Termos e Privacidade</Text>
                                </View>
                                <ChevronRight size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                </View>

                {/* Sair da Conta (Logout Button) */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
                    <LogOut size={20} color={colors.error} style={{ marginRight: 8 }} />
                    <Text style={styles.logoutText}>Sair da Conta</Text>
                </TouchableOpacity>

                {/* Tabbar spacer */}
                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },

    // Top Bar Styles
    topBar: {
        height: 60,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderColor: colors.surfaceContainerHighest,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 10 : 0
    },
    topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerAvatarBorder: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.primary, overflow: 'hidden' },
    headerAvatar: { width: '100%', height: '100%', objectFit: 'cover' },
    logoText: { fontSize: 18, fontWeight: '950', color: colors.primary, letterSpacing: -1 },
    barTitle: { fontSize: 15, fontWeight: '750', color: colors.text },
    notifyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center' },

    // Scroll Canvas
    canvas: { flex: 1 },
    canvasContent: { padding: 20 },

    // Profile Card
    profileCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f1f5',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        marginBottom: 24,
    },
    avatarContainer: { position: 'relative' },
    avatarBorder: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: colors.primaryContainer, padding: 2, backgroundColor: '#fff' },
    avatarImg: { width: '100%', height: '100%', borderRadius: 40, objectFit: 'cover' },
    ratingBadge: {
        position: 'absolute', bottom: -4, right: -4,
        backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3
    },
    ratingText: { fontSize: 10, fontWeight: '800', color: '#fff' },

    profileInfo: { flex: 1, marginLeft: 16, gap: 6 },
    driverName: { fontSize: 18, fontWeight: '800', color: colors.text },
    badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    idBadge: { backgroundColor: colors.surfaceContainer, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    idBadgeText: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
    verifiedBadge: { 
        flexDirection: 'row', alignItems: 'center', 
        backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 
    },
    verifiedText: { fontSize: 11, color: colors.primary, fontWeight: '800' },

    // Vehicle Cards
    sectionLabel: { fontSize: 14, fontWeight: '800', color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    vehicleGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    vehicleCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.surfaceContainerHighest,
        gap: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1
    },
    iconBox: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
    vehicleLabel: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    vehicleValue: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 2 },

    // Option groups
    optionsWrapper: { gap: 16, marginBottom: 24 },
    groupCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.surfaceContainerHighest,
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1
    },
    groupHeader: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surfaceContainerLow, borderBottomWidth: 1, borderColor: colors.surfaceContainerHighest },
    groupHeaderText: { fontSize: 10, fontWeight: '900', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
    groupBody: {},
    optionItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 16
    },
    optionLeft: { flexDirection: 'row', alignItems: 'center' },
    optionTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    optionRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    optionRightVal: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    divider: { height: 1, backgroundColor: colors.surfaceContainerHighest, marginLeft: 16 },

    // Sair Button
    logoutBtn: {
        flexDirection: 'row', height: 56, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(186, 26, 26, 0.2)',
        justifyContent: 'center', alignItems: 'center', marginTop: 12
    },
    logoutText: { fontSize: 15, fontWeight: '850', color: colors.error },
    headerAvatarFallback: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center'
    },
    avatarFallbackText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900'
    },
    avatarFallbackLarge: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center'
    },
    avatarFallbackLargeText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '900'
    },
});
