import { useRouter, useFocusEffect } from "expo-router";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Animated,
} from "react-native";

import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { registerUser } from '../services/auth/registerUser';

const { width, height } = Dimensions.get('window');
const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);

export default function Cadastro() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [screenVisible, setScreenVisible] = useState("nome");
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [cpf, setCpf] = useState('');
    const [senha, setSenha] = useState('');
    const [confSenha, setConfSenha] = useState('');
    const [isEmailValid, setIsEmailValid] = useState(false);
    const [isCpfValid, setIsCpfValid] = useState(false);
    const [isPasswordValid, setIsPasswordValid] = useState(false);
    const [secureEntry, setSecureEntry] = useState(true);
    const [secureEntryConf, setSecureEntryConf] = useState(true);

    const bgOpacity = useRef(new Animated.Value(0)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const contentOpacity = useRef(new Animated.Value(0)).current;
    const contentTranslateY = useRef(new Animated.Value(30)).current;

    // Animation for form steps swipe
    const formTranslateX = useRef(new Animated.Value(0)).current;
    const formOpacity = useRef(new Animated.Value(1)).current;

    useFocusEffect(
        useCallback(() => {
            bgOpacity.setValue(0);
            logoOpacity.setValue(0);
            contentOpacity.setValue(0);
            contentTranslateY.setValue(30);

            Animated.sequence([
                Animated.timing(bgOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
                Animated.parallel([
                    Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
                    Animated.timing(contentOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
                    Animated.spring(contentTranslateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
                ]),
            ]).start();
        }, [])
    );

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

    const changeStep = (nextStep: string, direction: 'forward' | 'backward') => {
        const outValue = direction === 'forward' ? -40 : 40;
        const inValue = direction === 'forward' ? 40 : -40;

        Animated.parallel([
            Animated.timing(formOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(formTranslateX, { toValue: outValue, duration: 200, useNativeDriver: true }),
        ]).start(() => {
            setScreenVisible(nextStep);
            formTranslateX.setValue(inValue);

            Animated.parallel([
                Animated.timing(formOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.spring(formTranslateX, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
            ]).start();
        });
    };

    const handleAvancarPrimeiraEtapa = async () => {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        changeStep("cpfemail", "forward");
        setIsLoading(false);
    };

    const handleAvancarSegundaEtapa = async () => {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        changeStep("senha", "forward");
        setIsLoading(false);
    };

    const handleEtapaAnteriorCpfEmail = () => changeStep("nome", "backward");
    const handleEtapaAnteriorSenha = () => changeStep("cpfemail", "backward");

    const handleConcluir = async () => {
        setIsLoading(true);

        const result = await registerUser({ name, sobrenome: '', email, senha, cpf });

        setIsLoading(false);

        if (result.success) {
            Alert.alert('Sucesso', 'Cadastro realizado com sucesso!');
            router.replace('/home'); //Não sei qual é o erro dessa linha, mas ta funcionando, segue o jogo kkk.
        } else {
            Alert.alert('Erro', result.error || 'Não foi possível cadastrar o usuário.');
        }
    };

    const btDesativoPrimeiraEtapa = name.trim() === '';
    const btDesativoSegundaEtapa = !isEmailValid || !isCpfValid || isLoading;
    const btDesativoTerceiraEtapa = !isPasswordValid || isLoading;

    // Step indicator
    const currentStep = screenVisible === "nome" ? 1 : screenVisible === "cpfemail" ? 2 : 3;

    return (
        <View style={styles.container}>
            <AnimatedImageBackground
                source={require('../../assets/images/bg_03.jpg')}
                style={[styles.background, { opacity: bgOpacity }]}
                resizeMode="cover"
            >
                <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.85)", "rgba(0,0,0,0.95)"]}
                    locations={[0, 0.55, 0.75, 1]}
                    style={StyleSheet.absoluteFill}
                />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        contentContainerStyle={[
                            styles.scrollContent,
                            { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 40 },
                        ]}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Logo */}
                        <Animated.View style={[styles.logoRow, { opacity: logoOpacity }]}>
                            <Image
                                source={require('../../assets/images/gardio_branco.png')}
                                style={styles.headerLogo}
                                resizeMode="contain"
                            />
                        </Animated.View>

                        {/* Step indicator and Forms */}
                        <Animated.View style={{ flex: 1, opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }}>
                            <View style={{ flex: 1 }} />
                            {/* Step indicator */}
                            <View style={styles.stepRow}>
                                {[1, 2, 3].map((step) => (
                                    <View key={step} style={[styles.stepItem, step === 3 && { flex: 0 }]}>
                                        <View style={[
                                            styles.stepDot,
                                            step <= currentStep && styles.stepDotActive,
                                            step < currentStep && styles.stepDotDone,
                                        ]}>
                                            {step < currentStep ? (
                                                <FontAwesome6 name="check" size={10} color="#fff" />
                                            ) : (
                                                <Text style={[
                                                    styles.stepDotText,
                                                    step <= currentStep && styles.stepDotTextActive,
                                                ]}>{step}</Text>
                                            )}
                                        </View>
                                        {step < 3 && (
                                            <View style={[
                                                styles.stepLine,
                                                step < currentStep && styles.stepLineActive,
                                            ]} />
                                        )}
                                    </View>
                                ))}
                            </View>

                            {/* Spacer */}
                            <View style={{ flex: 1, minHeight: 20 }} />

                            {screenVisible === "nome" ? (
                                <View style={styles.formArea}>
                                    <TouchableOpacity onPress={voltar} style={styles.backBtnInline} activeOpacity={0.7}>
                                        <FontAwesome6 name="arrow-left-long" size={20} color="rgba(255,255,255,0.6)" />
                                    </TouchableOpacity>
                                    <Text style={styles.title}>Criar conta</Text>
                                </View>
                            ) : (
                                <View style={styles.formArea}>
                                    <Text style={styles.greeting}>Olá, {name}</Text>
                                </View>
                            )}

                            <Animated.View style={{ opacity: formOpacity, transform: [{ translateX: formTranslateX }] }}>
                                {/* STEP 1: Name */}
                                {screenVisible === "nome" && (
                                    <View style={[styles.formArea, { paddingTop: 0 }]}>
                                        <Text style={styles.subtitle}>Como podemos te chamar?</Text>

                                        <View style={styles.inputWrapper}>
                                            <FontAwesome6 name="user" size={15} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                                            <TextInput
                                                placeholder="Nome"
                                                placeholderTextColor="rgba(255,255,255,0.4)"
                                                onChangeText={setName}
                                                style={styles.input}
                                                autoCapitalize="words"
                                                value={name}
                                            />
                                        </View>

                                        <Text style={styles.hint}>Essa informação não será exibida para outros usuários.</Text>

                                        <TouchableOpacity
                                            style={[
                                                styles.primaryBtn,
                                                btDesativoPrimeiraEtapa && styles.primaryBtnDisabled,
                                            ]}
                                            disabled={btDesativoPrimeiraEtapa || isLoading}
                                            onPress={handleAvancarPrimeiraEtapa}
                                            activeOpacity={0.8}
                                        >
                                            {isLoading ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <>
                                                    <Text style={styles.primaryBtnText}>Avançar</Text>
                                                    <FontAwesome6 name="arrow-right" size={14} color="#fff" />
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* STEP 2: CPF + Email */}
                                {screenVisible === "cpfemail" && (
                                    <View style={[styles.formArea, { paddingTop: 0 }]}>
                                        <Text style={styles.subtitle}>Agora preencha os dados a seguir:</Text>

                                        <View style={[
                                            styles.inputWrapper,
                                            !isEmailValid && email.length > 0 && styles.inputError,
                                        ]}>
                                            {isEmailValid ? (
                                                <FontAwesome6 name="circle-check" size={15} color="#4ade80" style={styles.inputIcon} />
                                            ) : (
                                                <FontAwesome6 name="envelope" size={15} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                                            )}
                                            <TextInput
                                                placeholder="E-mail"
                                                placeholderTextColor="rgba(255,255,255,0.4)"
                                                style={styles.input}
                                                value={email}
                                                onChangeText={setEmail}
                                                keyboardType="email-address"
                                                autoCapitalize="none"
                                            />
                                        </View>

                                        <View style={[
                                            styles.inputWrapper,
                                            !isCpfValid && cpf.length > 0 && styles.inputError,
                                        ]}>
                                            {isCpfValid ? (
                                                <FontAwesome6 name="circle-check" size={15} color="#4ade80" style={styles.inputIcon} />
                                            ) : (
                                                <FontAwesome6 name="id-card" size={15} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                                            )}
                                            <TextInput
                                                placeholder="CPF"
                                                placeholderTextColor="rgba(255,255,255,0.4)"
                                                style={styles.input}
                                                value={cpf}
                                                onChangeText={text => setCpf(formatCpf(text))}
                                                keyboardType="numeric"
                                                maxLength={14}
                                            />
                                        </View>

                                        <Text style={styles.hint}>Esses dados são apenas para o registro e contato, e não serão exibidos para outros usuários no app.</Text>

                                        <View style={styles.dualButtonRow}>
                                            <TouchableOpacity
                                                style={styles.secondaryBtn}
                                                onPress={handleEtapaAnteriorCpfEmail}
                                                activeOpacity={0.7}
                                            >
                                                <FontAwesome6 name="arrow-left" size={14} color="#fff" />
                                                <Text style={styles.secondaryBtnText}>Voltar</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[
                                                    styles.primaryBtnHalf,
                                                    btDesativoSegundaEtapa && styles.primaryBtnDisabled,
                                                ]}
                                                disabled={btDesativoSegundaEtapa}
                                                onPress={handleAvancarSegundaEtapa}
                                                activeOpacity={0.8}
                                            >
                                                {isLoading ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <>
                                                        <Text style={styles.primaryBtnText}>Avançar</Text>
                                                        <FontAwesome6 name="arrow-right" size={14} color="#fff" />
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                {/* STEP 3: Password */}
                                {screenVisible === "senha" && (
                                    <View style={[styles.formArea, { paddingTop: 0 }]}>
                                        <Text style={styles.subtitle}>Por último, crie uma senha para a sua conta:</Text>
                                        <Text style={styles.hint}>
                                            <FontAwesome6 name="circle-info" size={12} color="rgba(255,255,255,0.4)" />
                                            {"  "}Mínimo de 6 caracteres
                                        </Text>

                                        <View style={[
                                            styles.inputWrapper,
                                            ((senha.length > 0 && senha.length < 6) || (confSenha.length > 0 && senha !== confSenha)) && styles.inputError,
                                        ]}>
                                            <FontAwesome6 name="lock" size={15} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                                            <TextInput
                                                placeholder="Senha"
                                                placeholderTextColor="rgba(255,255,255,0.4)"
                                                onChangeText={setSenha}
                                                value={senha}
                                                secureTextEntry={secureEntry}
                                                style={styles.input}
                                            />
                                            <TouchableOpacity onPress={() => setSecureEntry(!secureEntry)} style={styles.eyeBtn}>
                                                <FontAwesome6 name={secureEntry ? "eye" : "eye-slash"} size={15} color="rgba(255,255,255,0.5)" />
                                            </TouchableOpacity>
                                        </View>

                                        <View style={[
                                            styles.inputWrapper,
                                            ((confSenha.length > 0 && confSenha.length < 6) || (senha.length > 0 && senha !== confSenha)) && styles.inputError,
                                        ]}>
                                            <FontAwesome6 name="lock" size={15} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                                            <TextInput
                                                placeholder="Repita a senha"
                                                placeholderTextColor="rgba(255,255,255,0.4)"
                                                onChangeText={setConfSenha}
                                                value={confSenha}
                                                secureTextEntry={secureEntryConf}
                                                style={styles.input}
                                            />
                                            <TouchableOpacity onPress={() => setSecureEntryConf(!secureEntryConf)} style={styles.eyeBtn}>
                                                <FontAwesome6 name={secureEntryConf ? "eye" : "eye-slash"} size={15} color="rgba(255,255,255,0.5)" />
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.dualButtonRow}>
                                            <TouchableOpacity
                                                style={styles.secondaryBtn}
                                                onPress={handleEtapaAnteriorSenha}
                                                activeOpacity={0.7}
                                            >
                                                <FontAwesome6 name="arrow-left" size={14} color="#fff" />
                                                <Text style={styles.secondaryBtnText}>Voltar</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[
                                                    styles.concludeBtn,
                                                    btDesativoTerceiraEtapa && styles.primaryBtnDisabled,
                                                ]}
                                                disabled={btDesativoTerceiraEtapa}
                                                onPress={handleConcluir}
                                                activeOpacity={0.8}
                                            >
                                                {isLoading ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <>
                                                        <FontAwesome6 name="user-check" size={14} color="#fff" />
                                                        <Text style={styles.primaryBtnText}>Concluir</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </Animated.View>

                            {/* Link to login */}
                            <TouchableOpacity onPress={() => router.push('/login')} style={styles.switchLink} activeOpacity={0.7}>
                                <Text style={styles.switchLinkText}>
                                    Já possui uma conta? <Text style={styles.switchLinkBold}>Entre</Text>
                                </Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </AnimatedImageBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    background: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 28,
    },
    logoRow: {
        alignItems: 'center',
        marginTop: 8,
    },
    headerLogo: {
        width: 460,
        height: 150,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 28,
        paddingHorizontal: 30,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    stepDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepDotActive: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },
    stepDotDone: {
        backgroundColor: '#1d4ed8',
        borderColor: '#1d4ed8',
    },
    stepDotText: {
        color: 'rgba(255,255,255,0.4)',
        fontFamily: 'texgyB',
        fontSize: 12,
    },
    stepDotTextActive: {
        color: '#fff',
    },
    stepLine: {
        flex: 1,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginHorizontal: 6,
    },
    stepLineActive: {
        backgroundColor: '#1d4ed8',
    },
    formArea: {
    },
    backBtnInline: {
        marginBottom: 14,
        alignSelf: 'flex-start',
    },
    title: {
        color: '#fff',
        fontSize: 32,
        fontFamily: 'texgyB',
        marginBottom: 6,
    },
    greeting: {
        color: '#fff',
        fontFamily: 'texgyB',
        fontSize: 28,
        marginBottom: 4,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 16,
        fontFamily: 'GlacialR',
        marginBottom: 28,
    },
    hint: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        fontFamily: 'GlacialR',
        marginBottom: 18,
        marginTop: -8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        borderRadius: 14,
        marginBottom: 16,
        paddingHorizontal: 16,
        height: 52,
    },
    inputError: {
        borderColor: 'rgba(248,113,113,0.6)',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        fontFamily: 'GlacialR',
        height: '100%',
    },
    eyeBtn: {
        padding: 6,
    },
    primaryBtn: {
        backgroundColor: '#2563eb',
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
    },
    primaryBtnHalf: {
        backgroundColor: '#2563eb',
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        flex: 1,
    },
    primaryBtnDisabled: {
        backgroundColor: 'rgba(37,99,235,0.35)',
    },
    primaryBtnText: {
        color: '#fff',
        fontFamily: 'texgyR',
        fontSize: 16,
    },
    secondaryBtn: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        flex: 1,
        marginRight: 10,
    },
    secondaryBtnText: {
        color: '#fff',
        fontFamily: 'GlacialR',
        fontSize: 16,
    },
    concludeBtn: {
        backgroundColor: '#2563eb',
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        flex: 1,
    },
    dualButtonRow: {
        flexDirection: 'row',
        marginTop: 8,
    },
    switchLink: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 40,
    },
    switchLinkText: {
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'GlacialR',
        fontSize: 15,
    },
    switchLinkBold: {
        color: '#fff',
        fontFamily: 'texgyB',
    },
});
