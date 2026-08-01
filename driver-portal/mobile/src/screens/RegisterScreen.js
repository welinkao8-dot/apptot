import React, { useState, useContext } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Platform, StatusBar, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { AuthContext } from '../context/AuthContext';
import { 
    FileText, Camera, CheckCircle, LogOut, Upload, Hourglass, 
    ShieldCheck, HelpCircle, ArrowLeft
} from 'lucide-react-native';
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
                text2: 'O documento foi carregado com sucesso.'
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

    // ─── PENDING STATE ───
    if (user?.status === 'pending') {
        return (
            <View style={styles.root}>
                <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity style={styles.headerBackBtn} onPress={logout} activeOpacity={0.8}>
                            <ArrowLeft size={22} color={colors.primary} />
                        </TouchableOpacity>
                        <Text style={styles.headerLogo}>TOT</Text>
                    </View>
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
                </View>

                <View style={styles.pendingCanvas}>
                    {/* Status Indicator */}
                    <View style={styles.statusBox}>
                        <View style={styles.statusPill}>
                            <Hourglass size={16} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.statusPillText}>Aguardando Pagamento</Text>
                        </View>
                    </View>

                    {/* Pending Information Card */}
                    <View style={styles.pendingMsgCard}>
                        <View style={styles.pendingIconOuter}>
                            <CheckCircle size={44} color={colors.primary} />
                        </View>
                        <Text style={styles.pendingCardTitle}>Conta em Análise</Text>
                        <Text style={styles.pendingCardDesc}>
                            Recebemos os seus documentos com sucesso. A nossa equipa analisará e ativará o seu cadastro em até 24 horas.
                        </Text>
                    </View>

                    <View style={{ flex: 1 }} />

                    {/* Logout Button */}
                    <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
                        <LogOut size={18} color={colors.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.logoutBtnText}>SAIR DA CONTA</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ─── UPLOAD STATE ───
    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity style={styles.headerBackBtn} onPress={logout} activeOpacity={0.8}>
                        <ArrowLeft size={22} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerLogo}>TOT</Text>
                </View>
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
            </View>

            <ScrollView contentContainerStyle={styles.scrollCanvas} showsVerticalScrollIndicator={false}>
                
                {/* Title & Desc section */}
                <View style={styles.headlineSection}>
                    <View style={styles.headlinePill}>
                        <ShieldCheck size={16} color={colors.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.headlinePillText}>VERIFICAÇÃO DE PERFIL</Text>
                    </View>
                    <Text style={styles.headlineMainTitle}>Envio de Documentos</Text>
                    <Text style={styles.headlineSubText}>
                        Tire fotos nítidas dos seus documentos para agilizar sua aprovação.
                    </Text>
                </View>

                {/* Document List bento card list */}
                <View style={styles.docsList}>
                    {/* B.I. Frente */}
                    <View style={styles.docBentoCard}>
                        <View style={styles.docCardLeft}>
                            <View style={[styles.docIconBg, docs.bi_frente && styles.docIconBgSuccess]}>
                                <FileText size={24} color={docs.bi_frente ? '#fff' : colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.docTitle}>B.I. Frente</Text>
                                <Text style={styles.docSubtitle}>{docs.bi_frente ? 'Imagem anexada ✓' : 'Bilhete de Identidade (Frente)'}</Text>
                            </View>
                        </View>
                        <TouchableOpacity 
                            style={[styles.cameraBtn, docs.bi_frente && styles.cameraBtnSuccess]} 
                            onPress={() => pickImage('bi_frente')}
                            activeOpacity={0.8}
                        >
                            <Camera size={20} color={docs.bi_frente ? '#fff' : colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* B.I. Verso */}
                    <View style={styles.docBentoCard}>
                        <View style={styles.docCardLeft}>
                            <View style={[styles.docIconBg, docs.bi_verso && styles.docIconBgSuccess]}>
                                <FileText size={24} color={docs.bi_verso ? '#fff' : colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.docTitle}>B.I. Verso</Text>
                                <Text style={styles.docSubtitle}>{docs.bi_verso ? 'Imagem anexada ✓' : 'Bilhete de Identidade (Verso)'}</Text>
                            </View>
                        </View>
                        <TouchableOpacity 
                            style={[styles.cameraBtn, docs.bi_verso && styles.cameraBtnSuccess]} 
                            onPress={() => pickImage('bi_verso')}
                            activeOpacity={0.8}
                        >
                            <Camera size={20} color={docs.bi_verso ? '#fff' : colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* Carta de Condução */}
                    <View style={styles.docBentoCard}>
                        <View style={styles.docCardLeft}>
                            <View style={[styles.docIconBg, docs.carta && styles.docIconBgSuccess]}>
                                <FileText size={24} color={docs.carta ? '#fff' : colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.docTitle}>Carta de Condução</Text>
                                <Text style={styles.docSubtitle}>{docs.carta ? 'Imagem anexada ✓' : 'Carta de Condução'}</Text>
                            </View>
                        </View>
                        <TouchableOpacity 
                            style={[styles.cameraBtn, docs.carta && styles.cameraBtnSuccess]} 
                            onPress={() => pickImage('carta')}
                            activeOpacity={0.8}
                        >
                            <Camera size={20} color={docs.carta ? '#fff' : colors.primary} />
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

                {/* Bottom floating button */}
                <View style={styles.actionContainer}>
                    <TouchableOpacity 
                        style={[
                            styles.submitBtn, 
                            (!docs.bi_frente || !docs.bi_verso || !docs.carta) && styles.submitBtnDisabled
                        ]} 
                        onPress={handleSubmit} 
                        disabled={loading || !docs.bi_frente || !docs.bi_verso || !docs.carta}
                        activeOpacity={0.9}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Upload size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.submitBtnTxt}>ENVIAR PARA ANÁLISE</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },

    // Header Styles
    header: {
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
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerBackBtn: { padding: 4 },
    headerLogo: { fontSize: 20, fontWeight: '900', color: colors.primary, letterSpacing: -1 },
    headerAvatarBorder: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.primary, overflow: 'hidden' },
    headerAvatar: { width: '100%', height: '100%', objectFit: 'cover' },

    // Scroll canvas
    scrollCanvas: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

    // Headlines
    headlineSection: { marginBottom: 24 },
    headlinePill: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    headlinePillText: { fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 },
    headlineMainTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
    headlineSubText: { fontSize: 14, color: colors.textSecondary, marginTop: 6, lineHeight: 22 },

    // Docs bento card lists
    docsList: { gap: 12, marginBottom: 24 },
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
    docCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    docIconBg: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
    docIconBgSuccess: { backgroundColor: '#22c55e' },
    docTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
    docSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    cameraBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    cameraBtnSuccess: { backgroundColor: '#22c55e', borderColor: '#22c55e' },

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

    // Bottom action button
    actionContainer: { paddingBottom: 20 },
    submitBtn: {
        width: '100%', height: 60, borderRadius: 12, backgroundColor: colors.primary,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6
    },
    submitBtnDisabled: { backgroundColor: colors.surfaceContainerHighest, shadowOpacity: 0, elevation: 0 },
    submitBtnTxt: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },

    // ─── PENDING VIEW SPECIFIC STYLES ───
    pendingCanvas: { flex: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
    statusBox: { alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primaryContainer,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 4
    },
    statusPillText: { fontSize: 11, fontWeight: '900', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
    pendingMsgCard: {
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
        marginTop: 20
    },
    pendingIconOuter: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    pendingCardTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 12 },
    pendingCardDesc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 },
    logoutBtn: {
        flexDirection: 'row',
        height: 52,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24
    },
    logoutBtnText: { fontSize: 14, fontWeight: '800', color: colors.primary },
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
});
