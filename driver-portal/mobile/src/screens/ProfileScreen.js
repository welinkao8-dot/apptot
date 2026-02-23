import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { User, Mail, MapPin, Lock, ChevronLeft, Save, Edit3, KeyRound } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import colors from '../theme/colors';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};

export default function ProfileScreen({ navigation }) {
    const { user, setUser } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isChangingPass, setIsChangingPass] = useState(false);

    const [form, setForm] = useState({
        full_name: user?.full_name || '',
        email: user?.email || '',
        address: user?.address || '',
    });

    const [passForm, setPassForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const handleUpdateProfile = async () => {
        if (!form.full_name) {
            Toast.show({ type: 'error', text1: 'Nome obrigatório' });
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/auth/update-profile', {
                driverId: user.id,
                ...form
            });

            if (res.data.success) {
                setUser({ ...user, ...res.data.driver });
                setIsEditing(false);
                ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
                Toast.show({
                    type: 'success',
                    text1: 'Perfil Atualizado',
                    text2: 'Seus dados foram salvos com sucesso.'
                });
            }
        } catch (error) {
            console.error('Update profile error:', error);
            Toast.show({
                type: 'error',
                text1: 'Erro ao atualizar',
                text2: error.response?.data?.message || 'Tente novamente mais tarde.'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!passForm.currentPassword || !passForm.newPassword || !passForm.confirmPassword) {
            Toast.show({ type: 'error', text1: 'Preencha todos os campos' });
            return;
        }

        if (passForm.newPassword !== passForm.confirmPassword) {
            Toast.show({ type: 'error', text1: 'As senhas não coincidem' });
            return;
        }

        if (passForm.newPassword.length < 6) {
            Toast.show({ type: 'error', text1: 'Senha muito curta', text2: 'Mínimo de 6 caracteres.' });
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/change-password', {
                driverId: user.id,
                currentPassword: passForm.currentPassword,
                newPassword: passForm.newPassword
            });

            setIsChangingPass(false);
            setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
            Toast.show({
                type: 'success',
                text1: 'Senha Alterada',
                text2: 'Sua senha foi atualizada com sucesso.'
            });
        } catch (error) {
            console.error('Change password error:', error);
            Toast.show({
                type: 'error',
                text1: 'Erro ao alterar senha',
                text2: error.response?.data?.message || 'Verifique sua senha atual.'
            });
        } finally {
            setLoading(false);
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <ChevronLeft size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Meu Perfil</Text>
            <View style={{ width: 44 }} />
        </View>
    );

    const renderField = (icon, label, value, field, editable, keyboardType = 'default') => (
        <View style={styles.fieldContainer}>
            <View style={styles.fieldHeader}>
                {icon}
                <Text style={styles.fieldLabel}>{label}</Text>
            </View>
            <TextInput
                style={[styles.input, !editable && styles.inputDisabled]}
                value={value}
                onChangeText={(text) => setForm({ ...form, [field]: text })}
                editable={editable}
                placeholder={`Digite seu ${label.toLowerCase()}`}
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType={keyboardType}
            />
        </View>
    );

    return (
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {renderHeader()}

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : null}
                    style={{ flex: 1 }}
                >
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        {/* Profile Card */}
                        <View style={styles.profileCard}>
                            <View style={styles.avatarContainer}>
                                <LinearGradient
                                    colors={colors.gradients.pink}
                                    style={styles.avatarGradient}
                                >
                                    <User size={40} color="#fff" />
                                </LinearGradient>
                                <View style={styles.profileInfo}>
                                    <Text style={styles.profileName}>{user?.full_name}</Text>
                                    <Text style={styles.profileRole}>Motorista Parceiro</Text>
                                </View>
                            </View>

                            <View style={styles.statusBadge}>
                                <View style={[styles.statusDot, { backgroundColor: user?.status === 'active' ? '#10b981' : '#f59e0b' }]} />
                                <Text style={styles.statusText}>
                                    {user?.status === 'active' ? 'Ativo' : 'Pendente'}
                                </Text>
                            </View>
                        </View>

                        {/* Personal Data Section */}
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>DADOS PESSOAIS</Text>
                            {!isEditing && (
                                <TouchableOpacity
                                    style={styles.editButton}
                                    onPress={() => setIsEditing(true)}
                                >
                                    <Edit3 size={18} color={colors.primary} />
                                    <Text style={styles.editButtonText}>Editar</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.formContainer}>
                            {renderField(<User size={18} color={colors.primary} />, "Nome Completo", form.full_name, 'full_name', isEditing)}
                            {renderField(<Mail size={18} color={colors.primary} />, "E-mail", form.email, 'email', isEditing, 'email-address')}
                            {renderField(<MapPin size={18} color={colors.primary} />, "Endereço", form.address, 'address', isEditing)}

                            <View style={styles.fieldContainer}>
                                <View style={styles.fieldHeader}>
                                    <Edit3 size={18} color={colors.primary} />
                                    <Text style={styles.fieldLabel}>Telefone</Text>
                                </View>
                                <TextInput
                                    style={[styles.input, styles.inputDisabled]}
                                    value={user?.phone}
                                    editable={false}
                                />
                                <Text style={styles.helperText}>O telefone não pode ser alterado.</Text>
                            </View>

                            {isEditing && (
                                <TouchableOpacity
                                    style={styles.saveButton}
                                    onPress={handleUpdateProfile}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <Save size={20} color="#fff" />
                                            <Text style={styles.saveButtonText}>SALVAR ALTERAÇÕES</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Security Section */}
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>SEGURANÇA</Text>
                        </View>

                        <View style={styles.formContainer}>
                            {!isChangingPass ? (
                                <TouchableOpacity
                                    style={styles.outlineButton}
                                    onPress={() => setIsChangingPass(true)}
                                >
                                    <KeyRound size={20} color={colors.primary} />
                                    <Text style={styles.outlineButtonText}>ALTERAR SENHA</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.passChangeContainer}>
                                    <View style={styles.fieldContainer}>
                                        <Text style={styles.fieldLabel}>Senha Atual</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={passForm.currentPassword}
                                            onChangeText={(text) => setPassForm({ ...passForm, currentPassword: text })}
                                            secureTextEntry
                                            placeholder="Digite sua senha atual"
                                            placeholderTextColor="rgba(255,255,255,0.3)"
                                        />
                                    </View>
                                    <View style={styles.fieldContainer}>
                                        <Text style={styles.fieldLabel}>Nova Senha</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={passForm.newPassword}
                                            onChangeText={(text) => setPassForm({ ...passForm, newPassword: text })}
                                            secureTextEntry
                                            placeholder="Nova senha"
                                            placeholderTextColor="rgba(255,255,255,0.3)"
                                        />
                                    </View>
                                    <View style={styles.fieldContainer}>
                                        <Text style={styles.fieldLabel}>Confirmar Nova Senha</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={passForm.confirmPassword}
                                            onChangeText={(text) => setPassForm({ ...passForm, confirmPassword: text })}
                                            secureTextEntry
                                            placeholder="Confirme a nova senha"
                                            placeholderTextColor="rgba(255,255,255,0.3)"
                                        />
                                    </View>

                                    <View style={styles.passActions}>
                                        <TouchableOpacity
                                            style={styles.cancelButton}
                                            onPress={() => setIsChangingPass(false)}
                                        >
                                            <Text style={styles.cancelButtonText}>CANCELAR</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.savePassButton}
                                            onPress={handleChangePassword}
                                            disabled={loading}
                                        >
                                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>ALTERAR</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    profileCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 32,
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 32,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
    },
    avatarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    avatarGradient: {
        width: 70,
        height: 70,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
    profileInfo: {
        gap: 4,
    },
    profileName: {
        fontSize: 20,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 0.5,
    },
    profileRole: {
        fontSize: 11,
        color: colors.primary,
        fontWeight: '900',
        letterSpacing: 1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 10,
        color: '#fff',
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: 2,
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(233, 30, 99, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    editButtonText: {
        fontSize: 12,
        fontWeight: '900',
        color: colors.primary,
    },
    formContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        padding: 24,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        marginBottom: 32,
    },
    fieldContainer: {
        marginBottom: 24,
    },
    fieldHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: 1,
    },
    input: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 16,
        paddingHorizontal: 18,
        height: 60,
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    inputDisabled: {
        opacity: 0.6,
        backgroundColor: 'transparent',
        borderWidth: 0,
        paddingHorizontal: 0,
        height: 40,
    },
    helperText: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.2)',
        marginTop: 6,
        fontStyle: 'italic',
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 64,
        borderRadius: 20,
        gap: 12,
        marginTop: 10,
        elevation: 10,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    outlineButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 64,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: colors.primary,
        gap: 12,
        backgroundColor: 'rgba(233, 30, 99, 0.05)',
    },
    outlineButtonText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 2,
    },
    passChangeContainer: {
        gap: 8,
    },
    passActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    cancelButton: {
        flex: 1,
        height: 60,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cancelButtonText: {
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '900',
        fontSize: 12,
        letterSpacing: 1,
    },
    savePassButton: {
        flex: 2,
        height: 60,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.primary,
        elevation: 10,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    }
});
