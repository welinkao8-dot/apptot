import React, { useState, useContext, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ActivityIndicator, KeyboardAvoidingView, Platform,
    Dimensions, ScrollView, Image, StatusBar
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import colors from '../theme/colors';
import { 
    Phone, Lock, User, Mail, MapPin, Camera, FileText, 
    CheckCircle, LogOut, ChevronRight, ArrowLeft, ShieldCheck, HelpCircle
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
    const { checkPhone, login, signUp, updateDocs, user, logout } = useContext(AuthContext);

    const [step, setStep] = useState('phone');
    const [loading, setLoading] = useState(false);
    
    // Form fields
    const [form, setForm] = useState({
        phone: '',
        password: '',
        full_name: '',
        email: '',
        address: '', // Mapped to Address/City
        bi_frente: '',
        bi_verso: '',
        carta: ''
    });

    // Handle initial state restoration
    useEffect(() => {
        if (user) {
            if (user.status === 'pending_docs') setStep('register_docs');
            else if (user.status === 'pending') setStep('pending');
        }
    }, [user]);

    const handleCheckPhone = async () => {
        const phoneRegex = /^9\d{8}$/;
        if (!phoneRegex.test(form.phone)) {
            Toast.show({ type: 'error', text1: 'Número inválido', text2: 'O telefone deve começar com 9 e ter 9 dígitos.' });
            return;
        }
        setLoading(true);
        const { exists, error } = await checkPhone(form.phone);
        setLoading(false);
        if (error) { Toast.show({ type: 'error', text1: 'Erro', text2: error }); return; }
        if (exists) setStep('login');
        else { 
            Toast.show({ type: 'info', text1: 'Olá!', text2: 'Vamos criar a sua conta de motorista.' }); 
            setStep('register_info'); 
        }
    };

    const handleLogin = async () => {
        if (!form.password) {
            Toast.show({ type: 'error', text1: 'Senha necessária', text2: 'Por favor, insira a sua senha.' });
            return;
        }
        setLoading(true);
        await login(form.phone, form.password);
        setLoading(false);
    };

    const handleRegisterInfo = async () => {
        if (!form.full_name || !form.email || !form.address || !form.password) {
            Toast.show({ type: 'error', text1: 'Campos obrigatórios', text2: 'Preencha todos os campos para continuar.' });
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
            Toast.show({ type: 'success', text1: 'Dados guardados!', text2: 'Agora envie os seus documentos.' }); 
            setStep('register_docs'); 
        } else {
            Toast.show({ type: 'error', text1: 'Erro no cadastro', text2: error });
        }
    };

    const handleUpdateDocs = async () => {
        setLoading(true);
        // Upload documents placeholder strings
        const { success, error } = await updateDocs({ 
            bi_frente: 'doc_uploaded_placeholder', 
            bi_verso: 'doc_uploaded_placeholder', 
            carta: 'doc_uploaded_placeholder' 
        });
        setLoading(false);
        if (success) { 
            Toast.show({ type: 'success', text1: 'Documentos enviados!', text2: 'A sua conta está em análise.' }); 
            setStep('pending'); 
        } else {
            Toast.show({ type: 'error', text1: 'Falha no envio', text2: error });
        }
    };

    // Form inputs wrapper
    const renderFormInput = (label, placeholder, value, field, secure = false, keyboard = 'default', icon = null) => {
        const [isFocused, setIsFocused] = useState(false);
        return (
            <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isFocused && { color: colors.primary }]}>{label}</Text>
                <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
                    {icon && <View style={styles.inputIconPrefix}>{icon}</View>}
                    <TextInput
                        style={styles.inputField}
                        placeholder={placeholder}
                        placeholderTextColor={colors.textSecondary}
                        value={value}
                        onChangeText={text => setForm({ ...form, [field]: text })}
                        secureTextEntry={secure}
                        keyboardType={keyboard}
                        autoCapitalize="none"
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                    />
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

            {/* Header row with Back action for inner steps */}
            {step !== 'phone' && step !== 'pending' && (
                <View style={styles.navHeader}>
                    <TouchableOpacity 
                        style={styles.backBtn} 
                        onPress={() => {
                            if (step === 'login') setStep('phone');
                            else if (step === 'register_info') setStep('phone');
                            else if (step === 'register_docs') setStep('register_info');
                        }}
                        activeOpacity={0.8}
                    >
                        <ArrowLeft size={22} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.navLogoText}>TOT</Text>
                    <View style={{ width: 40 }} />
                </View>
            )}

            <ScrollView 
                contentContainerStyle={[
                    styles.scrollContent, 
                    (step === 'phone' || step === 'pending') && { paddingTop: 60 }
                ]} 
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* ─── STEP: PHONE INPUT (LOGIN SCREEN HOME) ─── */}
                {step === 'phone' && (
                    <View style={styles.innerCanvas}>
                        {/* Logo header */}
                        <View style={styles.logoHeader}>
                            <View style={styles.logoTxtBox}>
                                <Text style={styles.bigLogoTxt}>TOT</Text>
                            </View>
                            <Text style={styles.logoSubtitle}>Motorista Profissional</Text>
                        </View>

                        {/* Input card */}
                        <View style={styles.authCard}>
                            {renderFormInput(
                                "Telefone Celular", 
                                "9XXXXXXXX", 
                                form.phone, 
                                'phone', 
                                false, 
                                'phone-pad',
                                <Phone size={18} color={colors.textSecondary} />
                            )}

                            <TouchableOpacity 
                                style={styles.primaryActionBtn} 
                                onPress={handleCheckPhone} 
                                disabled={loading} 
                                activeOpacity={0.9}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Text style={styles.actionBtnTxt}>CONTINUAR</Text>
                                        <ChevronRight size={20} color="#fff" />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.footerCaption}>
                            Insira o seu número para aceder ou criar uma conta.
                        </Text>
                    </View>
                )}

                {/* ─── STEP: PASSWORD INPUT (LOGIN SCREEN FOR RETURNING DRIVER) ─── */}
                {step === 'login' && (
                    <View style={styles.innerCanvas}>
                        <View style={styles.logoHeader}>
                            <View style={styles.logoTxtBox}>
                                <Text style={styles.bigLogoTxt}>TOT</Text>
                            </View>
                            <Text style={styles.logoSubtitle}>Bem-vindo de Volta</Text>
                        </View>

                        <View style={styles.authCard}>
                            <Text style={styles.userPhoneSummary}>
                                Telemóvel: <Text style={{ fontWeight: '800', color: colors.primary }}>{form.phone}</Text>
                            </Text>

                            {renderFormInput(
                                "Senha de Acesso", 
                                "••••••••", 
                                form.password, 
                                'password', 
                                true, 
                                'default',
                                <Lock size={18} color={colors.textSecondary} />
                            )}

                            <TouchableOpacity 
                                style={styles.primaryActionBtn} 
                                onPress={handleLogin} 
                                disabled={loading} 
                                activeOpacity={0.9}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Text style={styles.actionBtnTxt}>ENTRAR</Text>
                                        <ChevronRight size={20} color="#fff" />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ─── STEP: REGISTER PERSONAL DETAILS (STEP 1 OF REGISTRATION) ─── */}
                {step === 'register_info' && (
                    <View style={styles.innerCanvas}>
                        {/* Progress line indicator (3 pills) */}
                        <View style={styles.progressLine}>
                            <View style={[styles.progressPill, styles.progressPillActive]} />
                            <View style={styles.progressPill} />
                            <View style={styles.progressPill} />
                        </View>

                        <View style={styles.registerHeadline}>
                            <Text style={styles.headlineTitle}>Seja um motorista</Text>
                            <Text style={styles.headlineStepSub}>Passo 1: Dados Pessoais</Text>
                        </View>

                        {/* Registration fields */}
                        <View style={styles.registerForm}>
                            {renderFormInput("Nome Completo", "Como no seu documento", form.full_name, 'full_name', false, 'default', <User size={18} color={colors.textSecondary} />)}
                            {renderFormInput("E-mail", "exemplo@email.com", form.email, 'email', false, 'email-address', <Mail size={18} color={colors.textSecondary} />)}
                            {renderFormInput("Cidade / Endereço", "Ex: Luanda", form.address, 'address', false, 'default', <MapPin size={18} color={colors.textSecondary} />)}
                            {renderFormInput("Crie uma Senha", "Mínimo 6 caracteres", form.password, 'password', true, 'default', <Lock size={18} color={colors.textSecondary} />)}

                            {/* Safety info bento card */}
                            <View style={styles.safetyCard}>
                                <View style={styles.safetyIconBox}>
                                    <ShieldCheck size={22} color="#fff" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.safetyTitle}>Segurança dos dados</Text>
                                    <Text style={styles.safetyText}>Seus dados estão protegidos sob nossa política de privacidade corporativa.</Text>
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={[styles.primaryActionBtn, { marginTop: 12 }]} 
                                onPress={handleRegisterInfo} 
                                disabled={loading} 
                                activeOpacity={0.9}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Text style={styles.actionBtnTxt}>CONTINUAR</Text>
                                        <ChevronRight size={20} color="#fff" />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ─── STEP: UPLOAD VEHICLE/DRIVER DOCUMENTS (STEP 2 OF REGISTRATION) ─── */}
                {step === 'register_docs' && (
                    <View style={styles.innerCanvas}>
                        {/* Progress line indicator */}
                        <View style={styles.progressLine}>
                            <View style={[styles.progressPill, styles.progressPillActive]} />
                            <View style={[styles.progressPill, styles.progressPillActive]} />
                            <View style={styles.progressPill} />
                        </View>

                        <View style={styles.registerHeadline}>
                            <View style={styles.docHeadlineTitle}>
                                <ShieldCheck size={16} color={colors.primary} style={{ marginRight: 6 }} />
                                <Text style={styles.docHeadlinePillText}>VERIFICAÇÃO DE PERFIL</Text>
                            </View>
                            <Text style={styles.headlineTitle}>Envio de Documentos</Text>
                            <Text style={styles.headlineDesc}>Tire fotos nítidas dos seus documentos para agilizar sua aprovação.</Text>
                        </View>

                        {/* Document Bento cards */}
                        <View style={styles.docsList}>
                            {/* Card 1: BI Frente */}
                            <View style={styles.docBentoCard}>
                                <View style={styles.docBentoLeft}>
                                    <View style={styles.docIconBg}><FileText size={24} color={colors.primary} /></View>
                                    <View>
                                        <Text style={styles.docBentoTitle}>B.I. Frente</Text>
                                        <Text style={styles.docBentoSubtitle}>Bilhete de Identidade (Frente)</Text>
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.photoBtn} activeOpacity={0.8}>
                                    <Camera size={20} color={colors.primary} />
                                </TouchableOpacity>
                            </View>

                            {/* Card 2: BI Verso */}
                            <View style={styles.docBentoCard}>
                                <View style={styles.docBentoLeft}>
                                    <View style={styles.docIconBg}><FileText size={24} color={colors.primary} /></View>
                                    <View>
                                        <Text style={styles.docBentoTitle}>B.I. Verso</Text>
                                        <Text style={styles.docBentoSubtitle}>Bilhete de Identidade (Verso)</Text>
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.photoBtn} activeOpacity={0.8}>
                                    <Camera size={20} color={colors.primary} />
                                </TouchableOpacity>
                            </View>

                            {/* Card 3: Carta */}
                            <View style={styles.docBentoCard}>
                                <View style={styles.docBentoLeft}>
                                    <View style={styles.docIconBg}><FileText size={24} color={colors.primary} /></View>
                                    <View>
                                        <Text style={styles.docBentoTitle}>Carta de Condução</Text>
                                        <Text style={styles.docBentoSubtitle}>Habilitação para Motociclos</Text>
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.photoBtn} activeOpacity={0.8}>
                                    <Camera size={20} color={colors.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Pro Tip Card */}
                        <View style={styles.tipCard}>
                            <HelpCircle size={22} color={colors.success} style={{ marginTop: 2 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.tipTitle}>DICA PRO</Text>
                                <Text style={styles.tipText}>
                                    Evite reflexos e use locais bem iluminados. Certifique-se de que todas as bordas do documento estão visíveis.
                                </Text>
                            </View>
                        </View>

                        {/* Submit Actions */}
                        <TouchableOpacity 
                            style={styles.primaryActionBtn} 
                            onPress={handleUpdateDocs} 
                            disabled={loading} 
                            activeOpacity={0.9}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.actionBtnTxt}>ENVIAR PARA ANÁLISE</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* ─── STEP: DOCUMENTS UNDER ANALYSIS (PENDING STATE) ─── */}
                {step === 'pending' && (
                    <View style={styles.innerCanvas}>
                        {/* Success card illustration */}
                        <View style={styles.pendingCard}>
                            <View style={styles.pendingIconOuter}>
                                <CheckCircle size={44} color={colors.primary} />
                            </View>
                            <Text style={styles.pendingTitle}>Conta em Análise</Text>
                            <Text style={styles.pendingDesc}>
                                Recebemos os seus documentos com sucesso. A nossa equipa analisará e ativará o seu cadastro em até 24 horas.
                            </Text>

                            <TouchableOpacity 
                                style={styles.logoutOutlineBtn} 
                                onPress={() => { logout(); setStep('phone'); }}
                                activeOpacity={0.8}
                            >
                                <LogOut size={18} color={colors.primary} style={{ marginRight: 8 }} />
                                <Text style={styles.logoutBtnTxt}>SAIR DA CONTA</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Background decorative circles */}
            {step === 'phone' && (
                <>
                    <View style={styles.decorCircleTopLeft} />
                    <View style={styles.decorCircleBottomRight} />
                </>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },

    // Nav Header Bar
    navHeader: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderColor: colors.surfaceContainerHigh
    },
    backBtn: { padding: 4 },
    navLogoText: { fontSize: 20, fontWeight: '900', color: colors.primary, letterSpacing: -1 },

    // Inner main canvas
    innerCanvas: { flex: 1, justifyContent: 'center' },

    // Logo Header
    logoHeader: { alignItems: 'center', marginBottom: 32, marginTop: 20 },
    logoTxtBox: { 
        paddingHorizontal: 20, paddingVertical: 10, borderRadius: 16, 
        backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 1
    },
    bigLogoTxt: { fontSize: 32, fontWeight: '950', color: colors.primary, letterSpacing: -1 },
    logoSubtitle: { fontSize: 16, fontWeight: '750', color: colors.text, marginTop: 14 },

    // Auth Card Container
    authCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        shadowColor: '#1a1c1f',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
        elevation: 4,
    },
    userPhoneSummary: { fontSize: 15, color: colors.textSecondary, marginBottom: 16, textAlign: 'center' },
    footerCaption: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 24 },

    // Form Field Layouts (Labels above input)
    inputGroup: { marginBottom: 16 },
    inputLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginBottom: 6 },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        backgroundColor: colors.surfaceContainerLowest,
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        borderRadius: 12,
        paddingHorizontal: 16,
    },
    inputContainerFocused: { borderColor: colors.primary, borderWidth: 1.5 },
    inputIconPrefix: { marginRight: 12 },
    inputField: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },

    // Primary Action Button (Chevron details)
    primaryActionBtn: {
        height: 56,
        borderRadius: 12,
        backgroundColor: colors.primary,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 4,
        marginTop: 10
    },
    actionBtnTxt: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },

    // Registration Steps
    progressLine: { flexDirection: 'row', gap: 8, marginBottom: 24, marginTop: 16 },
    progressPill: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceContainerHighest },
    progressPillActive: { backgroundColor: colors.primaryContainer },

    registerHeadline: { marginBottom: 24 },
    headlineTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
    headlineStepSub: { fontSize: 15, color: colors.textSecondary, marginTop: 4 },
    headlineDesc: { fontSize: 14, color: colors.textSecondary, marginTop: 6, lineHeight: 22 },

    registerForm: { gap: 4 },

    // Safety Bento Card
    safetyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primaryLight,
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        gap: 12,
        marginVertical: 12
    },
    safetyIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    safetyTitle: { fontSize: 14, fontWeight: '800', color: colors.onPrimaryFixed || colors.primary },
    safetyText: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },

    // Document Verification Step
    docHeadlineTitle: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    docHeadlinePillText: { fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 },
    docsList: { gap: 12, marginBottom: 20 },
    docBentoCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderColor: colors.primary,
        borderWidth: 1,
        borderTopColor: '#f1f1f5',
        borderRightColor: '#f1f1f5',
        borderBottomColor: '#f1f1f5',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    docBentoLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    docIconBg: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
    docBentoTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
    docBentoSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    photoBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center' },

    // Pro Tips
    tipCard: {
        flexDirection: 'row',
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.surfaceContainerHighest,
        padding: 16,
        gap: 12,
        marginBottom: 24
    },
    tipTitle: { fontSize: 12, fontWeight: '800', color: colors.successContainer, letterSpacing: 0.5, marginBottom: 2 },
    tipText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

    // Pending State Card
    pendingCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        shadowColor: '#1a1c1f',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 4,
        marginTop: 40
    },
    pendingIconOuter: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    pendingTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 12 },
    pendingDesc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
    logoutOutlineBtn: {
        flexDirection: 'row',
        height: 52,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24
    },
    logoutBtnTxt: { fontSize: 14, fontWeight: '800', color: colors.primary },

    // Decorative Blur circles
    decorCircleTopLeft: {
        position: 'absolute', top: 60, left: -40, width: 140, height: 140, borderRadius: 70,
        backgroundColor: 'rgba(182, 0, 89, 0.04)', zIndex: -10
    },
    decorCircleBottomRight: {
        position: 'absolute', bottom: 40, right: -40, width: 180, height: 180, borderRadius: 90,
        backgroundColor: 'rgba(182, 0, 89, 0.04)', zIndex: -10
    }
});
