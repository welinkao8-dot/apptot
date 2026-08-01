import React, { useState, useContext } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, StatusBar, Platform, Image
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { FileText, Camera, Bell, CheckCircle, AlertCircle, RefreshCw, Eye, ArrowLeft } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import colors from '../theme/colors';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};

export default function DocumentsScreen({ navigation }) {
    const { user, setUser } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);

    // Document status matching
    const [docStatus, setDocStatus] = useState({
        bi_frente: user?.doc_bi_frente ? 'approved' : 'missing',
        bi_verso: user?.doc_bi_verso ? 'approved' : 'missing',
        carta: user?.doc_carta_conducao ? 'approved' : 'missing'
    });

    const handleUpdateDocs = () => {
        Alert.alert(
            "Atualizar Documentos",
            "Deseja iniciar o processo de re-envio de documentos? Os documentos atuais serão substituídos após a aprovação.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Continuar",
                    onPress: () => {
                        ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
                        Toast.show({
                            type: 'info',
                            text1: 'Módulo de Câmera',
                            text2: 'O seletor de imagens será aberto na próxima versão.'
                        });
                    }
                }
            ]
        );
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved': return <CheckCircle size={18} color="#10b981" />;
            case 'pending': return <RefreshCw size={18} color="#f59e0b" />;
            case 'rejected': return <AlertCircle size={18} color="#ba1a1a" />;
            default: return <AlertCircle size={18} color={colors.textSecondary} />;
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'approved': return 'Aprovado';
            case 'pending': return 'Em Análise';
            case 'rejected': return 'Recusado';
            default: return 'Não Enviado';
        }
    };

    const renderDocCard = (title, status, subtitle) => (
        <View style={styles.docBentoCard}>
            <View style={styles.docCardLeft}>
                <View style={[styles.docIconBg, status === 'approved' && styles.docIconBgSuccess]}>
                    <FileText size={22} color={status === 'approved' ? '#fff' : colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.docTitle}>{title}</Text>
                    <View style={styles.statusRow}>
                        {getStatusIcon(status)}
                        <Text style={[styles.statusLabel, { color: status === 'approved' ? '#10b981' : colors.textSecondary }]}>
                            {getStatusText(status)}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.docActions}>
                {status === 'approved' && (
                    <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
                        <Eye size={18} color={colors.text} />
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={handleUpdateDocs} activeOpacity={0.8}>
                    <Camera size={18} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

            {/* ─── TOP APP BAR ─── */}
            <View style={styles.topBar}>
                <View style={styles.topBarLeft}>
                    <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                        <ArrowLeft size={22} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.logoText}>TOT</Text>
                </View>
                <Text style={styles.barTitle}>Documentos</Text>
                <TouchableOpacity style={styles.notifyBtn} activeOpacity={0.8}>
                    <Bell size={18} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {/* ─── SCROLL CANVAS ─── */}
            <ScrollView style={styles.canvas} contentContainerStyle={styles.canvasContent} showsVerticalScrollIndicator={false}>
                
                {/* Info status box */}
                <View style={styles.infoBox}>
                    <AlertCircle size={22} color={colors.primary} style={{ marginRight: 12, marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.infoTitle}>Status da Conta</Text>
                        <Text style={styles.infoDescription}>
                            {user?.status === 'active'
                                ? 'Seus documentos estão em conformidade. Você está habilitado para receber corridas.'
                                : 'A sua conta aguarda a validação final da documentação pela nossa equipa administrativa.'}
                        </Text>
                    </View>
                </View>

                <Text style={styles.sectionLabel}>Documentos de Identidade</Text>
                {renderDocCard("B.I. Frente", docStatus.bi_frente, "Bilhete de Identidade (Frente)")}
                {renderDocCard("B.I. Verso", docStatus.bi_verso, "Bilhete de Identidade (Verso)")}

                <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Habilitação</Text>
                {renderDocCard("Carta de Condução", docStatus.carta, "Habilitação para Motociclos")}

                <TouchableOpacity
                    style={styles.mainUpdateButton}
                    onPress={handleUpdateDocs}
                    activeOpacity={0.9}
                >
                    <RefreshCw size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.mainUpdateText}>ATUALIZAR TUDO</Text>
                </TouchableOpacity>

                <Text style={styles.footerNote}>
                    * Certifique-se de que as imagens tiradas estão nítidas e todos os campos visíveis para agilizar a validação.
                </Text>
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
    headerBackBtn: { padding: 4 },
    logoText: { fontSize: 18, fontWeight: '950', color: colors.primary, letterSpacing: -1 },
    barTitle: { fontSize: 15, fontWeight: '750', color: colors.text },
    notifyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center' },

    // Canvas
    canvas: { flex: 1 },
    canvasContent: { padding: 20, paddingBottom: 40 },

    // Info Box
    infoBox: {
        flexDirection: 'row',
        backgroundColor: colors.primaryLight, borderRadius: 16, padding: 16,
        marginBottom: 24, borderWidth: 1, borderColor: colors.outlineVariant,
    },
    infoTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 4 },
    infoDescription: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

    sectionLabel: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' },

    // Bento doc card
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
        marginBottom: 12
    },
    docCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
    docIconBg: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
    docIconBgSuccess: { backgroundColor: '#10b981' },
    docTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 4 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statusLabel: { fontSize: 12, fontWeight: '750' },

    docActions: { flexDirection: 'row', gap: 8 },
    actionBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center' },
    actionBtnPrimary: {
        backgroundColor: colors.primary,
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3,
    },

    mainUpdateButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 16,
        marginTop: 20,
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 5,
    },
    mainUpdateText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
    footerNote: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: 24, fontStyle: 'italic', paddingHorizontal: 12 }
});
