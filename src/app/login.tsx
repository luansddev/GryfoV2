import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function Login() {
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const voltar = () => {
        router.back();
    };

    const handleLogin = async () => {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simula delay de rede
        setIsLoading(false);
        Alert.alert('Login Simulado', 'Autenticação desativada neste ambiente.');
        router.replace('/home');
    };

    const isButtonDisabled = !email || !senha || isLoading;

    return (
        <View style={styles.conteiner}>
            <View style={styles.boxMenu}>
                <TouchableOpacity onPress={voltar} style={styles.btReturn}>
                    <Image source={require('../../assets/icons/return_black.png')} style={styles.imgButtonR} />
                </TouchableOpacity>
                <Text style={styles.txTst}>Entrar</Text>
            </View>
            <View style={styles.boxText}>
                <Text style={styles.text}>Olá, bem-vindo de volta</Text>
            </View>
            <View style={styles.boxInput}>
                <TextInput
                    placeholder="Email"
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                />
                <TextInput
                    placeholder="Senha"
                    secureTextEntry
                    style={styles.input}
                    value={senha}
                    onChangeText={setSenha}
                />
            </View>
            <View style={styles.buttonBox}>
                <TouchableOpacity
                    style={[styles.bt2, { backgroundColor: isButtonDisabled ? 'grey' : 'green' }]}
                    onPress={handleLogin}
                    disabled={isButtonDisabled}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <Image source={require('../../assets/icons/start.png')} style={styles.imgButton} />
                            <Text style={styles.btText}>Vamos lá</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    conteiner: {
        flex: 1,
        padding: 20,
    },
    boxMenu: {
        width: "100%",
        marginTop: "10%",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    image: {
        width: 50,
        height: 50,
        left: "50%",
        transform: [{ translateX: -20 }],
        position: "absolute"
    },
    btReturn: {
        padding: 0,
    },
    imgButtonR: {
        width: 30,
        height: 30,
        marginTop: 8
    },
    txTst: {
        color: "#000",
        fontSize: 26,
        fontFamily: "texgyB",
        left: "50%",
        transform: [{ translateX: -37 }],
        position: "absolute"
    },
    boxText: {
        marginTop: "20%",
        padding: 10,
    },
    text: {
        fontFamily: "GlacialR",
        fontSize: 20
    },
    boxInput: {
        padding: 10,
        marginTop: "5%",
        flexDirection: "column"
    },
    input: {
        height: 40,
        borderColor: '#c0c0c0',
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 15,
        marginBottom: 20,
        width: '100%',
        fontSize: 16,
        fontFamily: "GlacialR"
    },
    buttonBox: {
        flexDirection: "row",
        justifyContent: "center",
        padding: 10
    },
    btText: {
        color: "#fff",
        fontFamily: "GlacialR",
        fontSize: 18,
    },
    imgButton: {
        width: 20,
        height: 20,
    },
    bt2: {
        backgroundColor: "green",
        height: 40,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        flexDirection: "row-reverse",
        gap: 10
    }
});
