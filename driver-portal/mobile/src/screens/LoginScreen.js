import React, { useState, useContext, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
    ScrollView
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import colors from '../theme/colors';
import { Phone, Lock, User, MapPin, Mail, Camera, FileText, CheckCircle, LogOut } from 'lucide-react-native';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
    const { checkPhone, login, signUp, updateDocs, user, logout } = useContext(AuthContext);

    // STATES
    const [step, setStep] = useState('phone'); // phone, login, register_info, register_docs, pending
    const [loading, setLoading] = useState(false);

    // FORM DATA
    const [form, setForm] = useState({
        phone: '',
        password: '',
        full_name: '',
        email: '',
        address: '',
        bi_frente: '',
        bi_verso: '',
        carta: ''
    });

    // SYNC STATE WITH USER STATUS
    useEffect(() => {
        if (user) {
            if (user.status === 'pending_docs') {
                setStep('register_docs');
            } else if (user.status === 'pending') {
                setStep('pending');
            }
            // Active users are handled by Main Navigator (App.js usually switches stack)
        }
    }, [user]);

    // HANDLERS
    const handleCheckPhone = async () => {
        const phoneRegex = /^9\d{8}$/;
        if (!phoneRegex.test(form.phone)) {
            Toast.show({
                type: 'error',
                text1: 'Número inválido',
                text2: 'Deve começar com 9 e ter 9 dígitos.'
            });
            return;
        }

        setLoading(true);
        const { exists, error } = await checkPhone(form.phone);
        setLoading(false);

        if (error) {
            Toast.show({ type: 'error', text1: 'Erro', text2: error });
            return;
        }

        if (exists) {
            setStep('login');
        } else {
            Toast.show({ type: 'info', text1: 'Bem-vindo!', text2: 'Vamos criar sua conta.' });
            setStep('register_info');
        }
    };

    const handleLogin = async () => {
        if (!form.password) return;
        setLoading(true);
        const { success, error } = await login(form.phone, form.password);
        setLoading(false);
    };

    const handleRegisterInfo = async () => {
        if (!form.full_name || !form.email || !form.address || !form.password) {
            Toast.show({ type: 'error', text1: 'Campos obrigatórios', text2: 'Preencha todos os campos.' });
            return;
        }

        setLoading(true);
        const { success, error } = await signUp({
            full_name: form.full_name,
            phone: form.phone,
            email: form.email,
            address: form.address,
            password: form.password
        });
        setLoading(false);

        if (success) {
            Toast.show({ type: 'success', text1: 'Conta criada!', text2: 'Agora anexe os documentos.' });
            setStep('register_docs');
        } else {
            Toast.show({ type: 'error', text1: 'Erro no cadastro', text2: error });
        }
    };

    const handleUpdateDocs = async () => {
        // Mock docs for now since we don't have ImagePicker installed yet
        // In a real app, we would validate form.bi_frente etc.
        setLoading(true);
        const { success, error } = await updateDocs({
            bi_frente: 'mock_base64_string',
            bi_verso: 'mock_base64_string',
            carta: 'mock_base64_string'
        });
        setLoading(false);

        if (success) {
            Toast.show({ type: 'success', text1: 'Documentos enviados!', text2: 'Aguarde aprovação.' });
            setStep('pending');
        } else {
            Toast.show({ type: 'error', text1: 'Erro', text2: error });
        }
    };

    // RENDER HELPERS
    const renderInput = (icon, placeholder, value, field, secure = false, keyboard = 'default') => (
        <View style={styles.inputGroup}>
            <View style={styles.inputContainer}>
                {icon}
                <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor="#94a3b8"
                    value={value}
                    onChangeText={text => setForm({ ...form, [field]: text })}
                    secureTextEntry={secure}
                    keyboardType={keyboard}
                    autoCapitalize="none"
                />
            </View>
        </View>
    );

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.logo}>TOT</Text>
                    <Text style={styles.subtitle}>App do Motorista</Text>
                </View>

                {/* STEP 1: PHONE */}
                {step === 'phone' && (
                    <View style={styles.formCard}>
                        {renderInput(<Phone size={20} color={colors.primary} />, "9XXXXXXXX", form.phone, 'phone', false, 'phone-pad')}

                        <TouchableOpacity style={styles.button} onPress={handleCheckPhone} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>CONTINUAR</Text>}
                        </TouchableOpacity>
                    </View>
                )}

                {/* STEP 2: LOGIN */}
                {step === 'login' && (
                    <View style={styles.formCard}>
                        <Text style={styles.infoMsg}>Bem-vindo de volta! Digite sua senha.</Text>
                        {renderInput(<Lock size={20} color={colors.primary} />, "Sua Senha", form.password, 'password', true)}

                        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>ENTRAR</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setStep('phone')}>
                            <Text style={styles.link}>Voltar</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* STEP 3: REGISTER INFO */}
                {step === 'register_info' && (
                    <View style={styles.formCard}>
                        <Text style={styles.infoMsg}>Vamos criar sua conta.</Text>
                        {renderInput(<User size={20} color="#fff" />, "Nome Completo", form.full_name, 'full_name')}
                        {renderInput(<Mail size={20} color="#fff" />, "E-mail", form.email, 'email', false, 'email-address')}
                        {renderInput(<MapPin size={20} color="#fff" />, "Endereço", form.address, 'address')}
                        {renderInput(<Lock size={20} color="#fff" />, "Crie uma Senha", form.password, 'password', true)}

                        <TouchableOpacity style={styles.button} onPress={handleRegisterInfo} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>PRÓXIMO</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setStep('phone')}>
                            <Text style={styles.link}>Voltar</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* STEP 4: DOCS (MOCKED FOR NOW) */}
                {step === 'register_docs' && (
                    <View style={styles.formCard}>
                        <Text style={styles.infoMsg}>Anexe seus documentos.</Text>
                        <Text style={styles.warningMsg}>(Upload de imagem simulado nesta versão)</Text>

                        <View style={styles.docItem}>
                            <Camera size={24} color={colors.primary} />
                            <Text style={styles.docText}>B.I. Frente</Text>
                            <CheckCircle size={20} color="green" />
                        </View>
                        <View style={styles.docItem}>
                            <Camera size={24} color={colors.primary} />
                            <Text style={styles.docText}>B.I. Verso</Text>
                            <CheckCircle size={20} color="green" />
                        </View>
                        <View style={styles.docItem}>
                            <FileText size={24} color={colors.primary} />
                            <Text style={styles.docText}>Carta de Condução</Text>
                            <CheckCircle size={20} color="green" />
                        </View>

                        <TouchableOpacity style={styles.button} onPress={handleUpdateDocs} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>FINALIZAR CADASTRO</Text>}
                        </TouchableOpacity>
                    </View>
                )}

                {/* STEP 5: PENDING */}
                {step === 'pending' && (
                    <View style={styles.successView}>
                        <CheckCircle size={80} color={colors.primary} />
                        <Text style={styles.successTitle}>Conta em Análise</Text>
                        <Text style={styles.successText}>Recebemos seus documentos. Nossa equipe irá validar em breve.</Text>

                        <TouchableOpacity style={styles.outlineButton} onPress={() => {
                            logout();
                            setStep('phone');
                        }}>
                            <LogOut size={20} color={colors.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.outlineButtonText}>SAIR E AGUARDAR</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        fontSize: 48,
        fontWeight: '900',
        color: colors.primary,
        letterSpacing: 2,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
        color: '#94a3b8',
        fontWeight: '500',
    },
    formCard: {
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    infoMsg: {
        color: '#e2e8f0',
        marginBottom: 20,
        textAlign: 'center',
        fontSize: 16,
    },
    warningMsg: {
        color: '#fbbf24',
        marginBottom: 20,
        textAlign: 'center',
        fontSize: 12,
        fontStyle: 'italic',
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        borderRadius: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#334155',
        height: 56,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        marginLeft: 12,
    },
    button: {
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        letterSpacing: 1,
    },
    link: {
        color: colors.secondary || '#38bdf8',
        textAlign: 'center',
        marginTop: 20,
        fontWeight: 'bold',
    },
    docItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        justifyContent: 'space-between',
    },
    docText: {
        color: '#fff',
        fontWeight: '600',
    },
    successView: {
        alignItems: 'center',
        padding: 20,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 20,
        marginBottom: 10,
    },
    successText: {
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 30,
        fontSize: 16,
    },
    outlineButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: 12,
    },
    outlineButtonText: {
        color: colors.primary,
        fontWeight: 'bold',
    }
});
