import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Image,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { FileText, Camera, ChevronLeft, CheckCircle, AlertCircle, RefreshCw, Eye } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
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

    // MOCK STATUS (In a real app, these would come from document metadata)
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

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <ChevronLeft size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Documentos</Text>
            <View style={{ width: 44 }} />
        </View>
    );

    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved': return <CheckCircle size={20} color="#10b981" />;
            case 'pending': return <RefreshCw size={20} color="#f59e0b" />;
            case 'rejected': return <AlertCircle size={20} color="#ef4444" />;
            default: return <AlertCircle size={20} color="rgba(255,255,255,0.2)" />;
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

    const renderDocCard = (title, status, docKey) => (
        <View style={styles.docCard}>
            <View style={styles.docInfo}>
                <View style={styles.iconContainer}>
                    <FileText size={24} color={colors.primary} />
                </View>
                <View style={styles.docTextContainer}>
                    <Text style={styles.docTitle}>{title}</Text>
                    <View style={styles.statusRow}>
                        {getStatusIcon(status)}
                        <Text style={styles.statusLabel}>{getStatusText(status)}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.docActions}>
                {status === 'approved' && (
                    <TouchableOpacity style={styles.actionBtn}>
                        <Eye size={20} color="#fff" />
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={handleUpdateDocs}>
                    <Camera size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {renderHeader()}

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.infoBox}>
                        <AlertCircle size={24} color={colors.primary} />
                        <View style={styles.infoTextContainer}>
                            <Text style={styles.infoTitle}>Status da Conta</Text>
                            <Text style={styles.infoDescription}>
                                {user?.status === 'active'
                                    ? 'Seus documentos estão em conformidade. Você pode receber corridas.'
                                    : 'Sua conta está aguardando a validação final dos documentos pela nossa equipe.'}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>DOCUMENTOS DE IDENTIDADE</Text>
                    {renderDocCard("B.I. Frente", docStatus.bi_frente, 'bi_frente')}
                    {renderDocCard("B.I. Verso", docStatus.bi_verso, 'bi_verso')}

                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>HABILITAÇÃO</Text>
                    {renderDocCard("Carta de Condução", docStatus.carta, 'carta')}

                    <TouchableOpacity
                        style={styles.mainUpdateButton}
                        onPress={handleUpdateDocs}
                    >
                        <LinearGradient
                            colors={colors.gradients.pink}
                            style={styles.mainUpdateGradient}
                        >
                            <RefreshCw size={20} color="#fff" />
                            <Text style={styles.mainUpdateText}>ACTUALIZAR TUDO</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <Text style={styles.footerNote}>
                        * Certifique-se de que as fotos estejam nítidas e todos os dados legíveis para evitar atrasos na aprovação.
                    </Text>
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
        paddingBottom: 40,
    },
    infoBox: {
        backgroundColor: 'rgba(233, 30, 99, 0.05)',
        borderRadius: 24,
        padding: 24,
        flexDirection: 'row',
        gap: 16,
        borderWidth: 1,
        borderColor: 'rgba(233, 30, 99, 0.2)',
        marginBottom: 32,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    infoDescription: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        lineHeight: 18,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: 2,
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    docCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 24,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        marginBottom: 12,
    },
    docInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        flex: 1,
    },
    iconContainer: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: 'rgba(233, 30, 99, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    docTextContainer: {
        flex: 1,
    },
    docTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 4,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: 0.5,
    },
    docActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    actionBtnPrimary: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
        elevation: 6,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    mainUpdateButton: {
        height: 64,
        borderRadius: 20,
        marginTop: 32,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
    },
    mainUpdateGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    mainUpdateText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    footerNote: {
        marginTop: 32,
        fontSize: 11,
        color: 'rgba(255,255,255,0.2)',
        textAlign: 'center',
        paddingHorizontal: 30,
        fontStyle: 'italic',
        fontWeight: '600',
        lineHeight: 18,
    }
});
