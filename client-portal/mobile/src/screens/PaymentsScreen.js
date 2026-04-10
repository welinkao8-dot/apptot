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
} from 'react-native';
import { 
    ArrowLeft, 
    Banknote, 
    CreditCard, 
    CheckCircle2, 
    Plus,
    ShieldCheck,
    Info
} from 'lucide-react-native';
import colors from '../theme/colors';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

export default function PaymentsScreen({ navigation }) {
    
    const handleAddMethod = () => {
        Toast.show({
            type: 'info',
            text1: 'Brevemente',
            text2: 'Novos métodos de pagamento estarão disponíveis em breve.'
        });
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
                <Text style={styles.headerTitle}>PAGAMENTOS</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
                
                <View style={styles.infoSection}>
                    <View style={styles.infoIconBox}>
                        <ShieldCheck size={28} color={colors.primary} />
                    </View>
                    <Text style={styles.infoTitle}>Pagamentos Seguros</Text>
                    <Text style={styles.infoSubtitle}>Gerencie seus métodos de pagamento com total segurança e praticidade.</Text>
                </View>

                {/* Selected Method Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>MÉTODO SELECCIONADO</Text>
                    
                    <TouchableOpacity style={styles.methodCardActive} activeOpacity={0.9}>
                        <View style={styles.methodIconBoxActive}>
                            <Banknote size={24} color={colors.primary} />
                        </View>
                        <View style={styles.methodInfo}>
                            <Text style={styles.methodNameActive}>Numerário (Dinheiro)</Text>
                            <Text style={styles.methodStatus}>Padrão nas suas viagens</Text>
                        </View>
                        <CheckCircle2 size={24} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Available Methods Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>OUTROS MÉTODOS</Text>
                    
                    <TouchableOpacity 
                        style={styles.addMethodBtn} 
                        activeOpacity={0.7}
                        onPress={handleAddMethod}
                    >
                        <View style={styles.addIconBox}>
                            <Plus size={20} color={colors.textMuted} />
                        </View>
                        <Text style={styles.addText}>Adicionar Novo Cartão</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.addMethodBtn} 
                        activeOpacity={0.7}
                        onPress={handleAddMethod}
                    >
                        <View style={styles.addIconBox}>
                            <CreditCard size={20} color={colors.textMuted} />
                        </View>
                        <Text style={styles.addText}>Multicaixa Express</Text>
                    </TouchableOpacity>
                </View>

                {/* Security Note */}
                <View style={styles.securityNote}>
                    <Info size={16} color={colors.textMuted} />
                    <Text style={styles.securityText}>Seus dados de pagamento são protegidos por criptografia de ponta a ponta.</Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
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
    scrollContainer: {
        padding: 24,
    },
    infoSection: {
        alignItems: 'center',
        marginBottom: 40,
        marginTop: 10,
    },
    infoIconBox: {
        width: 64,
        height: 64,
        borderRadius: 24,
        backgroundColor: '#FDF2F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    infoTitle: {
        fontSize: 20,
        fontWeight: '950',
        color: colors.text,
        marginBottom: 8,
    },
    infoSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 10,
    },
    section: {
        marginBottom: 30,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '900',
        color: colors.textMuted,
        letterSpacing: 1.5,
        marginBottom: 16,
        paddingLeft: 4,
    },
    methodCardActive: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 20,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: colors.primary,
        ...colors.shadow,
        shadowColor: colors.primary,
        shadowOpacity: 0.1,
    },
    methodIconBoxActive: {
        width: 52,
        height: 52,
        borderRadius: 18,
        backgroundColor: '#FDF2F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    methodInfo: {
        flex: 1,
    },
    methodNameActive: {
        fontSize: 16,
        fontWeight: '900',
        color: colors.text,
    },
    methodStatus: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '700',
        marginTop: 2,
    },
    addMethodBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        marginBottom: 12,
        backgroundColor: '#F8FAFC',
    },
    addIconBox: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    addText: {
        fontSize: 15,
        fontWeight: '800',
        color: colors.textSecondary,
    },
    securityNote: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 16,
        gap: 10,
        marginTop: 10,
    },
    securityText: {
        flex: 1,
        fontSize: 12,
        color: colors.textMuted,
        fontWeight: '600',
        lineHeight: 16,
    }
});
