import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { MapPin, ShieldCheck, Info } from 'lucide-react-native';

const LocationDisclosure = ({ visible, onAccept }) => {
    return (
        <Modal visible={visible} animationType="slide" transparent={true}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <View style={styles.header}>
                            <View style={styles.iconCircle}>
                                <MapPin size={32} color="#e91e63" />
                            </View>
                            <Text style={styles.title}>Uso da sua Localização</Text>
                        </View>

                        <Text style={styles.description}>
                            O **TOT MOTO TÁXI** recolhe dados de localização para permitir as seguintes funcionalidades:
                        </Text>

                        <View style={styles.featureItem}>
                            <ShieldCheck size={24} color="#e91e63" />
                            <View style={styles.featureText}>
                                <Text style={styles.featureTitle}>Segurança em Tempo Real</Text>
                                <Text style={styles.featureDesc}>
                                    Permite que a sua posição seja monitorizada durante a viagem para garantir o seu bem-estar.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.featureItem}>
                            <MapPin size={24} color="#e91e63" />
                            <View style={styles.featureText}>
                                <Text style={styles.featureTitle}>Rastreamento em Segundo Plano</Text>
                                <Text style={styles.featureDesc}>
                                    Mesmo com o ecrã desligado ou noutra app, continuamos a atualizar a sua posição para que o cálculo da tarifa e o rastreio da viagem não sejam interrompidos.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.infoBox}>
                            <Info size={18} color="#666" />
                            <Text style={styles.infoText}>
                                Poderá alterar as suas preferências de localização a qualquer momento nas definições do dispositivo.
                            </Text>
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.button} onPress={onAccept}>
                            <Text style={styles.buttonText}>Entendi e Aceito</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '75%',
        padding: 20,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#fce4ec',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: '#666',
        lineHeight: 22,
        marginBottom: 24,
        textAlign: 'center',
    },
    featureItem: {
        flexDirection: 'row',
        marginBottom: 20,
        alignItems: 'flex-start',
    },
    featureText: {
        marginLeft: 15,
        flex: 1,
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
        marginBottom: 4,
    },
    featureDesc: {
        fontSize: 14,
        color: '#777',
        lineHeight: 18,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
        marginTop: 10,
        alignItems: 'center',
    },
    infoText: {
        fontSize: 12,
        color: '#666',
        marginLeft: 10,
        flex: 1,
    },
    footer: {
        paddingVertical: 15,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    button: {
        backgroundColor: '#e91e63',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default LocationDisclosure;
