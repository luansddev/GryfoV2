import { useRouter } from "expo-router";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { registerUser } from '../services/auth/registerUser';

export default function Cadastro() {
    const router = useRouter();
    const [screenVisible, setScreenVisible] = useState("nome");
    const [name, setName] = useState('');
    const [sobrenome, setSobrenome] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [cpf, setCpf] = useState('');
    const [senha, setSenha] = useState('');
    const [confSenha, setConfSenha] = useState('');
    const [isEmailValid, setIsEmailValid] = useState(false);
    const [isCpfValid, setIsCpfValid] = useState(false);
    const [isPasswordValid, setIsPasswordValid] = useState(false);

    const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toLowerCase());

    const formatCpf = (value: string) => {
        let cleanValue = value.replace(/\D/g, '').substring(0, 11);
        if (cleanValue.length > 9) return cleanValue.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
        if (cleanValue.length > 6) return cleanValue.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1.$2.$3');
        if (cleanValue.length > 3) return cleanValue.replace(/^(\d{3})(\d{3})$/, '$1.$2');
        return cleanValue;
    };

    const validateCpf = (cpf: string) => {
        cpf = cpf.replace(/[^\d]+/g, '');
        if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
        let sum = 0, rest;
        for (let i = 1; i <= 9; i++) sum += parseInt(cpf[i - 1]) * (11 - i);
        rest = (sum * 10) % 11;
        if (rest !== parseInt(cpf[9])) return false;
        sum = 0;
        for (let i = 1; i <= 10; i++) sum += parseInt(cpf[i - 1]) * (12 - i);
        rest = (sum * 10) % 11;
        return rest === parseInt(cpf[10]);
    };

    useEffect(() => setIsEmailValid(validateEmail(email)), [email]);
    useEffect(() => setIsCpfValid(validateCpf(cpf)), [cpf]);
    useEffect(() => {
        setIsPasswordValid(
            senha.trim() !== '' &&
            confSenha.trim() !== '' &&
            senha === confSenha &&
            senha.length >= 6
        );
    }, [senha, confSenha]);

    const voltar = () => router.back();

    const handleAvancarPrimeiraEtapa = async () => {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setScreenVisible("cpfemail");
        setIsLoading(false);
    };

    const handleAvancarSegundaEtapa = async () => {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setScreenVisible("senha");
        setIsLoading(false);
    };

    const handleEtapaAnteriorCpfEmail = () => setScreenVisible("nome");
    const handleEtapaAnteriorSenha = () => setScreenVisible("cpfemail");

    const handleConcluir = async () => {
  setIsLoading(true);

  const result = await registerUser({ name, sobrenome, email, senha, cpf });

  setIsLoading(false);

  if (result.success) {
    Alert.alert('Sucesso', 'Cadastro realizado com sucesso!');
    router.replace('/home'); //Não sei qual é o erro dessa linha, mas ta funcionando, segue o jogo kkk.
  } else {
    Alert.alert('Erro', result.error || 'Não foi possível cadastrar o usuário.');
  }
};

    const btDesativoPrimeiraEtapa = name.trim() === '' || sobrenome.trim() === '';
    const btDesativoSegundaEtapa = !isEmailValid || !isCpfValid || isLoading;
    const btDesativoTerceiraEtapa = !isPasswordValid || isLoading;

    return (
        <View style={styles.conteiner}>
            <View style={styles.boxMenu}>
                <TouchableOpacity onPress={voltar} style={styles.btReturn}>
                    <Image source={require('../../assets/icons/return_black.png')} style={styles.imgButtonR} />
                </TouchableOpacity>
                <Text style={styles.txTst}>Criar conta</Text>
            </View>

            {screenVisible === "nome" && (
                <View>
                    <View style={styles.boxText}>
                        <Text style={styles.text}>Comece digitando o seu nome abaixo:</Text>
                    </View>
                    <View style={styles.boxInput}>
                        <TextInput placeholder="Nome" onChangeText={setName} style={styles.input} autoCapitalize="words" value={name} />
                        <TextInput placeholder="Sobrenome" onChangeText={setSobrenome} style={styles.input} autoCapitalize="words" value={sobrenome} />
                        <TouchableOpacity
                            style={[styles.bt2, btDesativoPrimeiraEtapa ? styles.bt2Disabled : styles.bt2Enabled]}
                            disabled={btDesativoPrimeiraEtapa || isLoading}
                            onPress={handleAvancarPrimeiraEtapa}
                        >
                            {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btText}>Avançar</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {screenVisible === "cpfemail" && (
                <View>
                    <View style={styles.boxText}>
                        <Text style={styles.name}>Olá, {name}</Text>
                        <Text style={styles.text}>Agora preencha os dados a seguir:</Text>
                    </View>
                    <View style={styles.boxInput}>
                        <TextInput placeholder="E-mail" style={[styles.input, !isEmailValid && email.length > 0 && { borderColor: 'red' }]} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                        <TextInput placeholder="CPF" style={[styles.input, !isCpfValid && cpf.length > 0 && { borderColor: 'red' }]} value={cpf} onChangeText={text => setCpf(formatCpf(text))} keyboardType="numeric" maxLength={14} />
                        <View style={styles.buttonBox}>
                            <TouchableOpacity style={styles.bt3} onPress={handleEtapaAnteriorCpfEmail}>
                                <Image source={require('../../assets/icons/arrow_left.png')} style={styles.imgButton} />
                                <Text style={styles.btText}>Etapa anterior</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.bt4, btDesativoSegundaEtapa ? styles.bt2Disabled : styles.bt2Enabled]}
                                disabled={btDesativoSegundaEtapa}
                                onPress={handleAvancarSegundaEtapa}
                            >
                                {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btText}>Avançar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {screenVisible === "senha" && (
                <View>
                    <View style={styles.boxText}>
                        <Text style={styles.name}>Olá, {name}</Text>
                        <Text style={styles.text}>Por último, crie uma senha para a sua conta:</Text>
                        <Text style={styles.textSmall}>(Mínimo de 6 caracteres)</Text>
                    </View>
                    <View style={styles.boxInput}>
                        <TextInput placeholder="Senha" onChangeText={setSenha} value={senha} secureTextEntry style={[styles.input, (senha.length > 0 && senha.length < 6) || (confSenha.length > 0 && senha !== confSenha) ? { borderColor: 'red' } : {}]} />
                        <TextInput placeholder="Repita a senha" onChangeText={setConfSenha} value={confSenha} secureTextEntry style={[styles.input, (confSenha.length > 0 && confSenha.length < 6) || (senha.length > 0 && senha !== confSenha) ? { borderColor: 'red' } : {}]} />
                        <View style={styles.buttonBox}>
                            <TouchableOpacity style={styles.bt3} onPress={handleEtapaAnteriorSenha}>
                                <Image source={require('../../assets/icons/arrow_left.png')} style={styles.imgButton} />
                                <Text style={styles.btText}>Etapa anterior</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.bt5, btDesativoTerceiraEtapa ? styles.bt2Disabled : styles.bt5Enabled]}
                                disabled={btDesativoTerceiraEtapa}
                                onPress={handleConcluir}
                            >
                                {isLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Image source={require('../../assets/icons/account_create.png')} style={styles.imgButton} />
                                        <Text style={styles.btText}>Concluir</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
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
    txTst: {
        color: "#000",
        fontSize: 26,
        fontFamily: "texgyB",
        left: "50%",
        transform: [{ translateX: -70 }],
        position: "absolute"
    },
    imgButtonR: {
        width: 30,
        height: 30,
        marginTop: 8
    },
    imgButton: {
        width: 20,
        height: 20,
    },
    boxText: {
        marginTop: "20%",
        padding: 10,
    },
    text: {
        fontFamily: "GlacialR",
        fontSize: 20
    },
    textSmall: {
        fontFamily: "GlacialR",
        fontSize: 14,
        color: 'gray',
        marginTop: 5,
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
        paddingHorizontal: 10,
        marginBottom: 20,
        width: '100%',
        fontSize: 16,
        fontFamily: "GlacialR"
    },
    bt2: {
        height: 40,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        marginTop: "5%"
    },
    bt2Enabled: {
        backgroundColor: "blue", // Cor azul do botão quando estiver ativo 
    },
    bt2Disabled: {
        backgroundColor: "grey", // Cor cinza APENAS quando os inputs estão vazios ou inválidos
    },
    btText: {
        color: "#fff",
        fontFamily: "GlacialR",
        fontSize: 18,
    },
    name: {
        color: "#000",
        fontFamily: "texgyB",
        fontSize: 25,
        marginBottom: "5%"
    },
    buttonBox: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    bt3: {
        height: 40,
        borderRadius: 10,
        justifyContent: "space-around",
        alignItems: "center",
        marginTop: "5%",
        backgroundColor: "#000",
        flexDirection: "row",
        padding: 10,
        width: "48%"
    },
    bt4: {
        height: 40,
        borderRadius: 10,
        justifyContent: "space-around",
        alignItems: "center",
        marginTop: "5%",
        flexDirection: "row",
        padding: 10,
        width: "48%"
    },
    bt5: { 
        height: 40,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        marginTop: "5%",
        flexDirection: "row",
        padding: 10,
        width: "48%",
        gap: 5,
    },
    bt5Enabled: { // Estilo para o botão Concluir quando está HABILITADO (é confuso, eu sei, eu vou melhorar, juro).
        backgroundColor: "green",
    },
});
