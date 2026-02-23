import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { AuthContext } from '../context/AuthContext';
import { FileText, Camera, CheckCircle, LogOut, Upload } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import colors from '../theme/colors';

export default function RegisterScreen({ navigation }) {
    const { user, updateDocs, logout } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [docs, setDocs] = useState({
        bi_frente: null,
        bi_verso: null,
        carta: null
    });

    const pickImage = async (field) => {
        const result = await launchImageLibrary({
            mediaType: 'photo',
            quality: 0.8,
            includeBase64: true
        });

        if (result.assets && result.assets[0]) {
            const base64 = `data:${result.assets[0].type};base64,${result.assets[0].base64}`;
            setDocs(prev => ({ ...prev, [field]: base64 }));
            Toast.show({
                type: 'success',
                text1: 'Documento anexado! ✅',
                text2: 'Você pode prosseguir quando todos estiverem prontos.'
            });
        }
    };

    const handleSubmit = async () => {
        if (!docs.bi_frente || !docs.bi_verso || !docs.carta) {
            return Toast.show({
                type: 'error',
                text1: 'Documentos Incompletos',
                text2: 'Por favor, anexe todos os documentos obrigatórios.'
            });
        }

        setLoading(true);
        const { success, error } = await updateDocs(docs);
        setLoading(false);

        if (success) {
            Toast.show({
                type: 'success',
                text1: 'Documentos Enviados! 📄',
                text2: 'Aguarde a aprovação do administrador.'
            });
        } else {
            Toast.show({
                type: 'error',
                text1: 'Erro ao Enviar',
                text2: error || 'Tente novamente.'
            });
        }
    };

    // Se já enviou docs e está aguardando aprovação
    if (user.status === 'pending') {
        return (
            <LinearGradient
                colors={['#0f172a', '#1e293b']}
                style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.pendingContainer}>
                        <Animated.View entering={FadeInUp.delay(200)} style={styles.iconCircle}>
                            <CheckCircle size={64} color={colors.success} />
                        </Animated.View>
                        <Animated.Text entering={FadeInUp.delay(400)} style={styles.pendingTitle}>
                            Documentos Enviados!
                        </Animated.Text>
                        <Animated.Text entering={FadeInUp.delay(600)} style={styles.pendingText}>
                            Sua conta está em análise. Você receberá uma notificação assim que for aprovada pelo administrador.
                        </Animated.Text>
                        <Animated.View entering={FadeInUp.delay(800)} style={styles.pendingInfo}>
                            <Text style={styles.pendingInfoText}>
                                Enquanto isso, você pode explorar o aplicativo, mas algumas funções estarão limitadas até a aprovação.
                            </Text>
                        </Animated.View>
                        <TouchableOpacity
                            onPress={logout}
                            style={styles.logoutButton}>
                            <LogOut size={20} color="#fff" />
                            <Text style={styles.logoutText}>Sair</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    // Tela de envio de documentos
    return (
        <LinearGradient
            colors={['#0f172a', '#1e293b']}
            style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Animated.View entering={FadeInUp.delay(200)} style={styles.header}>
                        <FileText size={48} color={colors.primary} />
                        <Text style={styles.title}>Envio de Documentos</Text>
                        <Text style={styles.subtitle}>
                            Para começar a trabalhar, precisamos validar seus documentos.
                        </Text>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(400)} style={styles.docsContainer}>
                        {/* BI Frente */}
                        <TouchableOpacity
                            style={[styles.docCard, docs.bi_frente && styles.docCardFilled]}
                            onPress={() => pickImage('bi_frente')}>
                            <View style={styles.docIcon}>
                                {docs.bi_frente ? (
                                    <CheckCircle size={32} color={colors.success} />
                                ) : (
                                    <Camera size={32} color={colors.textSecondary} />
                                )}
                            </View>
                            <Text style={styles.docTitle}>BI - Frente</Text>
                            <Text style={styles.docSubtitle}>
                                {docs.bi_frente ? 'Anexado ✓' : 'Toque para anexar'}
                            </Text>
                        </TouchableOpacity>

                        {/* BI Verso */}
                        <TouchableOpacity
                            style={[styles.docCard, docs.bi_verso && styles.docCardFilled]}
                            onPress={() => pickImage('bi_verso')}>
                            <View style={styles.docIcon}>
                                {docs.bi_verso ? (
                                    <CheckCircle size={32} color={colors.success} />
                                ) : (
                                    <Camera size={32} color={colors.textSecondary} />
                                )}
                            </View>
                            <Text style={styles.docTitle}>BI - Verso</Text>
                            <Text style={styles.docSubtitle}>
                                {docs.bi_verso ? 'Anexado ✓' : 'Toque para anexar'}
                            </Text>
                        </TouchableOpacity>

                        {/* Carta de Condução */}
                        <TouchableOpacity
                            style={[styles.docCard, docs.carta && styles.docCardFilled]}
                            onPress={() => pickImage('carta')}>
                            <View style={styles.docIcon}>
                                {docs.carta ? (
                                    <CheckCircle size={32} color={colors.success} />
                                ) : (
                                    <Camera size={32} color={colors.textSecondary} />
                                )}
                            </View>
                            <Text style={styles.docTitle}>Carta de Condução</Text>
                            <Text style={styles.docSubtitle}>
                                {docs.carta ? 'Anexado ✓' : 'Toque para anexar'}
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(600)}>
                        <TouchableOpacity
                            style={[
                                styles.submitButton,
                                (!docs.bi_frente || !docs.bi_verso || !docs.carta) && styles.submitButtonDisabled
                            ]}
                            onPress={handleSubmit}
                            disabled={loading || !docs.bi_frente || !docs.bi_verso || !docs.carta}>
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Upload size={20} color="#fff" />
                                    <Text style={styles.submitText}>Enviar Documentos</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={logout} style={styles.logoutLink}>
                            <LogOut size={16} color={colors.textSecondary} />
                            <Text style={styles.logoutLinkText}>Sair</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </ScrollView>
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
    scrollContent: {
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 16,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 20,
    },
    docsContainer: {
        gap: 16,
        marginBottom: 32,
    },
    docCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    docCardFilled: {
        borderColor: colors.success,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
    },
    docIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    docTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        flex: 1,
    },
    docSubtitle: {
        fontSize: 12,
        color: colors.textSecondary,
        position: 'absolute',
        bottom: 20,
        left: 92,
    },
    submitButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    submitButtonDisabled: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    submitText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    logoutLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 16,
    },
    logoutLinkText: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    // Pending status
    pendingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    pendingTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
    },
    pendingText: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    pendingInfo: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
        marginBottom: 32,
    },
    pendingInfoText: {
        color: colors.textSecondary,
        fontSize: 14,
        lineHeight: 20,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    logoutText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
