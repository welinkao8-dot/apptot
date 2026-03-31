import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    ScrollView,
    Dimensions,
    Modal,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { 
    User, 
    Mail, 
    Phone, 
    Calendar, 
    ChevronRight, 
    ArrowLeft, 
    Lock, 
    Settings, 
    Trash2,
    LogOut,
    Eye,
    EyeOff,
    X
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';
import api from '../services/api';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ navigation }) {
    const { user, signOut } = useAuth();
    const [isModalVisible, setIsModalVisible] = React.useState(false);
    const [showPassword, setShowPassword] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    const [form, setForm] = React.useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const infoItems = [
        { id: 'email', label: 'E-mail', value: user?.email || 'N/A', icon: Mail },
        { id: 'phone', label: 'Telemóvel', value: user?.phone || '9XXXXXXXX', icon: Phone },
        { id: 'joined', label: 'Membro desde', value: user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }) : 'N/A', icon: Calendar },
    ];

    const handleChangePassword = async () => {
        if (!form.oldPassword || !form.newPassword || !form.confirmPassword) {
            Toast.show({ type: 'error', text1: 'Atenção', text2: 'Preencha todos os campos.' });
            return;
        }

        if (form.newPassword.length < 6) {
            Toast.show({ type: 'error', text1: 'Segurança', text2: 'A nova senha deve ter pelo menos 6 caracteres.' });
            return;
        }

        if (form.newPassword !== form.confirmPassword) {
            Toast.show({ type: 'error', text1: 'Erro', text2: 'As novas senhas não coincidem.' });
            return;
        }

        try {
            setLoading(true);
            await api.post('/auth/change-password', {
                userId: user.id,
                oldPassword: form.oldPassword,
                newPassword: form.newPassword
            });

            Toast.show({ type: 'success', text1: 'Sucesso', text2: 'Senha alterada com sucesso!' });
            setIsModalVisible(false);
            setForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            console.error('Change password error:', error);
            const msg = error.response?.data?.message || 'Erro ao alterar senha.';
            Toast.show({ type: 'error', text1: 'Erro', text2: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            
            {/* Elegant Pink Header */}
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backBtn} 
                    onPress={() => navigation.goBack()}
                >
                    <ArrowLeft size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>PERFIL</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Hero Profile Section */}
                <View style={styles.heroSection}>
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatarGradient}>
                            <User size={60} color="#FFF" />
                        </View>
                        <TouchableOpacity style={styles.editBadge}>
                            <Settings size={16} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.userName}>{user?.full_name || 'Usuário TOT'}</Text>
                    <Text style={styles.userRole}>Cliente Premium</Text>
                </View>

                {/* Info List Section */}
                <View style={styles.detailsContainer}>
                    <Text style={styles.sectionTitle}>Informações da Conta</Text>
                    
                    {infoItems.map((item, index) => (
                        <View key={item.id} style={styles.infoRow}>
                            <View style={styles.iconBox}>
                                <item.icon size={20} color={colors.primary} />
                            </View>
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>{item.label}</Text>
                                <Text style={styles.infoValue}>{item.value}</Text>
                            </View>
                            {index !== infoItems.length - 1 && <View style={styles.rowDivider} />}
                        </View>
                    ))}
                </View>

                {/* Security Section */}
                <View style={styles.detailsContainer}>
                    <Text style={styles.sectionTitle}>Segurança & Privacidade</Text>
                    
                    <TouchableOpacity 
                        style={styles.actionRow} 
                        activeOpacity={0.7}
                        onPress={() => setIsModalVisible(true)}
                    >
                        <View style={[styles.iconBox, { backgroundColor: '#F1F5F9' }]}>
                            <Lock size={20} color={colors.textSecondary} />
                        </View>
                        <Text style={styles.actionLabel}>Alterar Palavra-passe</Text>
                        <ChevronRight size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Logout Action */}
                <TouchableOpacity 
                    style={styles.logoutButton} 
                    onPress={signOut}
                    activeOpacity={0.8}
                >
                    <LogOut size={20} color="#FFF" />
                    <Text style={styles.logoutText}>Terminar Sessão</Text>
                </TouchableOpacity>

                <Text style={styles.footerNote}>TOT © 2026 - Versão 1.0.4 Premium</Text>
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Change Password Modal */}
            <Modal
                visible={isModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>ALTERAR SENHA</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                                <X size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalSubtitle}>Sua segurança é nossa prioridade. Escolha uma senha forte.</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Senha Atual</Text>
                                <View style={styles.inputWrapper}>
                                    <Lock size={18} color={colors.textMuted} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Digite sua senha atual"
                                        secureTextEntry={!showPassword}
                                        value={form.oldPassword}
                                        onChangeText={(t) => setForm({ ...form, oldPassword: t })}
                                        placeholderTextColor="#94A3B8"
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Nova Senha</Text>
                                <View style={styles.inputWrapper}>
                                    <Lock size={18} color={colors.textMuted} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="No mínimo 6 caracteres"
                                        secureTextEntry={!showPassword}
                                        value={form.newPassword}
                                        onChangeText={(t) => setForm({ ...form, newPassword: t })}
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Confirmar Nova Senha</Text>
                                <View style={styles.inputWrapper}>
                                    <Lock size={18} color={colors.textMuted} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Confirme a nova senha"
                                        secureTextEntry={!showPassword}
                                        value={form.confirmPassword}
                                        onChangeText={(t) => setForm({ ...form, confirmPassword: t })}
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={[styles.updateBtn, loading && { opacity: 0.7 }]} 
                                onPress={handleChangePassword}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.updateBtnText}>Actualizar Palavra-passe</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        height: 60,
        backgroundColor: colors.primary,
        zIndex: 10,
    },
    backBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '950',
        color: '#FFF',
        letterSpacing: 2,
    },
    heroSection: {
        alignItems: 'center',
        paddingVertical: 40,
        backgroundColor: colors.primary,
        borderBottomLeftRadius: 60,
        borderBottomRightRadius: 60,
        ...colors.shadow,
        shadowColor: colors.primary,
        marginBottom: 30,
    },
    avatarContainer: {
        marginBottom: 20,
    },
    avatarGradient: {
        width: 120,
        height: 120,
        borderRadius: 45,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#FFF',
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        ...colors.shadow,
    },
    userName: {
        fontSize: 24,
        fontWeight: '950',
        color: '#FFF',
        marginBottom: 4,
    },
    userRole: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '700',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    detailsContainer: {
        marginHorizontal: 24,
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: colors.textSecondary,
        marginBottom: 20,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#FDF2F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 11,
        color: colors.textMuted,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 15,
        color: colors.text,
        fontWeight: '800',
    },
    rowDivider: {
        position: 'absolute',
        bottom: 0,
        left: 64,
        right: 0,
        height: 1,
        backgroundColor: '#F1F5F9',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    actionLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '800',
        color: colors.text,
    },
    logoutButton: {
        marginHorizontal: 24,
        backgroundColor: colors.primary,
        height: 60,
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        marginTop: 10,
        ...colors.shadow,
        shadowColor: colors.primary,
    },
    logoutText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '900',
    },
    footerNote: {
        textAlign: 'center',
        marginTop: 30,
        fontSize: 11,
        color: colors.textMuted,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        height: '85%',
        overflow: 'hidden',
    },
    modalHeader: {
        backgroundColor: colors.primary,
        padding: 24,
        paddingTop: 30,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalTitle: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 2,
    },
    closeBtn: {
        padding: 4,
    },
    modalBody: {
        padding: 24,
    },
    modalSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '600',
        marginBottom: 30,
        lineHeight: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '900',
        color: colors.textMuted,
        textTransform: 'uppercase',
        marginBottom: 8,
        letterSpacing: 1,
        paddingLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 20,
        paddingHorizontal: 16,
        height: 56,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: colors.text,
        fontWeight: '700',
    },
    updateBtn: {
        backgroundColor: colors.primary,
        height: 60,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 40,
        ...colors.shadow,
        shadowColor: colors.primary,
    },
    updateBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '950',
    }
});
