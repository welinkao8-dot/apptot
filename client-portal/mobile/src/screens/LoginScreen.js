import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Animated,
    Dimensions,
    StatusBar,
    SafeAreaView,
    Image,
    ActivityIndicator,
} from 'react-native';
import {
    Phone,
    ChevronRight,
    Lock,
    User,
    ArrowLeft,
    CheckCircle
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';
import Toast from 'react-native-toast-message';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
    const { checkPhone, signIn, register } = useAuth();

    const [step, setStep] = useState(1); // 1: Phone, 2: Login, 3: Register
    const [loading, setLoading] = useState(false);
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');

    const fadeAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

    const transition = (nextStep) => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: -20, duration: 200, useNativeDriver: true })
        ]).start(() => {
            setStep(nextStep);
            slideAnim.setValue(20);
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true })
            ]).start();
        });
    };

    const handlePhoneSubmit = async () => {
        if (phone.length < 9) {
            Toast.show({ type: 'error', text1: 'Número inválido', text2: 'Insira pelo menos 9 dígitos' });
            return;
        }
        setLoading(true);
        try {
            const result = await checkPhone(phone);
            if (result.exists) {
                transition(2);
            } else {
                transition(3);
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Erro de conexão', text2: 'Não foi possível verificar seu número' });
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!password) return;
        setLoading(true);
        try {
            await signIn(phone, password);
            Toast.show({ type: 'success', text1: 'Bem-vindo de volta!', text2: 'Login realizado com sucesso' });
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Erro no login', text2: 'Sua senha pode estar incorreta' });
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!fullName || !password) return;
        setLoading(true);
        try {
            await register(phone, fullName, password);
            Toast.show({ type: 'success', text1: 'Conta criada!', text2: 'Bem-vindo ao TOT' });
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Falha no registro', text2: 'Tente novamente em instantes' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={[colors.primary, '#C2185B']}
                style={styles.background}
            >
                <View style={styles.topSpace}>
                    <View style={styles.logoContainer}>
                        <Text style={styles.logoText}>TOT</Text>
                        <Text style={styles.logoSub}>VAI UMA CORRIDA?</Text>
                    </View>
                </View>

                <Animated.View style={[
                    styles.card,
                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                ]}>
                    {step === 1 && (
                        <View>
                            <Text style={styles.title}>Bem-vindo</Text>
                            <Text style={styles.subtitle}>Insira seu número de telefone para começar</Text>

                            <View style={styles.inputContainer}>
                                <View style={styles.countryCode}>
                                    <Text style={styles.countryText}>+244</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="9XXXXXXXX"
                                    keyboardType="phone-pad"
                                    value={phone}
                                    onChangeText={setPhone}
                                    maxLength={9}
                                />
                                <Phone size={20} color={colors.primary} style={styles.inputIcon} />
                            </View>

                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handlePhoneSubmit}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <>
                                        <Text style={styles.buttonText}>Continuar</Text>
                                        <ChevronRight size={20} color="#FFF" />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {step === 2 && (
                        <View>
                            <TouchableOpacity style={styles.backBtn} onPress={() => transition(1)}>
                                <ArrowLeft size={16} color={colors.textSecondary} />
                                <Text style={styles.backText}>{phone}</Text>
                            </TouchableOpacity>
                            <Text style={styles.title}>Olá novamente!</Text>
                            <Text style={styles.subtitle}>Digite sua senha para entrar</Text>

                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Sua senha"
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <Lock size={20} color={colors.primary} style={styles.inputIcon} />
                            </View>

                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleLogin}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.buttonText}>Entrar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {step === 3 && (
                        <View>
                            <TouchableOpacity style={styles.backBtn} onPress={() => transition(1)}>
                                <ArrowLeft size={16} color={colors.textSecondary} />
                                <Text style={styles.backText}>{phone}</Text>
                            </TouchableOpacity>
                            <Text style={styles.title}>Crie sua conta</Text>
                            <Text style={styles.subtitle}>Quase lá! Só precisamos de alguns dados</Text>

                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Nome Completo"
                                    value={fullName}
                                    onChangeText={setFullName}
                                />
                                <User size={20} color={colors.primary} style={styles.inputIcon} />
                            </View>

                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Escolha uma senha"
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <Lock size={20} color={colors.primary} style={styles.inputIcon} />
                            </View>

                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleRegister}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.buttonText}>Finalizar Cadastro</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>

                <View style={styles.footerContainer}>
                    <Text style={styles.footerText}>© 2026 TOT Angola - Sinta o Futuro</Text>
                </View>
            </LinearGradient>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    background: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    topSpace: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoContainer: {
        alignItems: 'center',
    },
    logoText: {
        fontSize: 72,
        fontWeight: '900',
        color: '#FFF',
        letterSpacing: -4,
    },
    logoSub: {
        fontSize: 14,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: 4,
        marginTop: -10,
    },
    card: {
        backgroundColor: '#FFF',
        width: '100%',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        padding: 30,
        paddingBottom: 20,
        // Remove shadow from bottom to blend with footer
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 5,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    backText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.text,
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 15,
        color: colors.textSecondary,
        marginBottom: 30,
        lineHeight: 22,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        paddingHorizontal: 15,
        marginBottom: 20,
        height: 60,
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
    },
    countryCode: {
        paddingRight: 10,
        marginRight: 10,
        borderRightWidth: 1,
        borderRightColor: '#E2E8F0',
    },
    countryText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: colors.text,
        fontWeight: '600',
    },
    inputIcon: {
        marginLeft: 10,
    },
    button: {
        backgroundColor: colors.primary,
        height: 60,
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        ...colors.shadow,
        shadowColor: colors.primary,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '800',
        marginRight: 8,
    },
    footerContainer: {
        backgroundColor: '#FFF',
        paddingVertical: 15,
        borderTopWidth: 1,
        borderTopColor: 'rgba(233, 30, 99, 0.1)', // Thin transparent pink line
    },
    footerText: {
        textAlign: 'center',
        color: 'rgba(233, 30, 99, 0.6)', // Transparent pink
        fontSize: 12,
        fontWeight: '600',
    }
});
