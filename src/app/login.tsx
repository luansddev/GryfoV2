import { router, useFocusEffect } from 'expo-router';
import React, { useState, useCallback, useRef } from 'react';
import {
    ActivityIndicator,
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
    Keyboard,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../config/firebaseConfig';
import PasswordInput from '../components/PasswordInput';

const { width, height } = Dimensions.get('window');
const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);

export default function Login() {
    const insets = useSafeAreaInsets();
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [secureEntry, setSecureEntry] = useState(true);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const senhaRef = useRef<TextInput>(null);
    const scrollRef = useRef<ScrollView>(null);

    React.useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                setIsKeyboardVisible(true);
                setKeyboardHeight(e.endCoordinates.height);
            }
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                setIsKeyboardVisible(false);
                setKeyboardHeight(0);
            }
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const bgOpacity = useRef(new Animated.Value(0)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const contentOpacity = useRef(new Animated.Value(0)).current;
    const contentTranslateY = useRef(new Animated.Value(30)).current;
    const hasAnimatedRef = useRef(false);

    useFocusEffect(
        useCallback(() => {
            if (hasAnimatedRef.current) return;
            hasAnimatedRef.current = true;

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

            return () => {
                hasAnimatedRef.current = false;
            };
        }, [])
    );

    const voltar = () => router.back();

    const handleLogin = async () => {
        setIsLoading(true);
        setErrorMessage('');

        try {
            await signInWithEmailAndPassword(auth, email, senha);
            router.replace('/home');
        } catch (error: any) {
            if (
                error.code === 'auth/user-not-found' ||
                error.code === 'auth/wrong-password' ||
                error.code === 'auth/invalid-credential'
            ) {
                setErrorMessage('Email ou senha incorretos.');
            } else {
                setErrorMessage('Erro ao fazer login, tente novamente.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const isButtonDisabled = !email || !senha || isLoading;

    return (
        <View style={styles.container}>
            <AnimatedImageBackground
                source={require('../../assets/images/bg_01.jpg')}
                style={[styles.background, { opacity: bgOpacity }]}
                resizeMode="cover"
            >
                <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.85)", "rgba(0,0,0,0.95)"]}
                    locations={[0, 0.55, 0.75, 1]}
                    style={StyleSheet.absoluteFill}
                />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        ref={scrollRef}
                        style={{ flex: 1 }}
                        contentContainerStyle={[
                            styles.scrollContent,
                            {
                                paddingTop: insets.top + 4,
                                paddingBottom: Platform.OS === 'android' && keyboardHeight > 0
                                    ? keyboardHeight + 24
                                    : insets.bottom + 24,
                            },
                        ]}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="none"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Logo: mantém o espaço no layout, mas fica invisível quando o teclado está aberto */}
                        <Animated.View style={[
                            styles.logoRow,
                            { opacity: isKeyboardVisible ? 0 : logoOpacity }
                        ]}>
                            <Image
                                source={require('../../assets/images/gardio_branco.png')}
                                style={styles.headerLogo}
                                resizeMode="contain"
                            />
                        </Animated.View>

                        {/* Flexible Spacer: pushes form down when screen is tall, collapses cleanly when keyboard opens */}
                        <View style={isKeyboardVisible ? { height: 12 } : { flex: 1, minHeight: 20 }} />

                        {/* Form area */}
                        <Animated.View style={[styles.formArea, { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }]}>
                            <TouchableOpacity onPress={voltar} style={styles.backBtnInline} activeOpacity={0.7}>
                                <FontAwesome6 name="arrow-left-long" size={20} color="rgba(255,255,255,0.6)" />
                            </TouchableOpacity>
                            <Text style={styles.title}>Entrar</Text>
                            <Text style={styles.subtitle}>Olá, bem-vindo de volta</Text>

                            {/* Email input */}
                            <View collapsable={false} style={styles.inputWrapper}>
                                <FontAwesome6 name="envelope" size={15} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                                <TextInput
                                    placeholder="Email"
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    style={styles.input}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoComplete="off"
                                    importantForAutofill="no"
                                    cursorColor="#fff"
                                    selectionColor="rgba(255,255,255,0.3)"
                                    underlineColorAndroid="transparent"
                                    blurOnSubmit={false}
                                    value={email}
                                    onChangeText={(text) => {
                                        setEmail(text);
                                        if (errorMessage) setErrorMessage('');
                                    }}
                                    returnKeyType="next"
                                    onSubmitEditing={() => senhaRef.current?.focus()}
                                />
                            </View>

                            {/* Password input */}
                            <View collapsable={false} style={styles.inputWrapper}>
                                <FontAwesome6 name="lock" size={15} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                                <PasswordInput
                                    ref={senhaRef}
                                    placeholder="Senha"
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    secureTextEntry={secureEntry}
                                    style={styles.input}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoComplete="off"
                                    importantForAutofill="no"
                                    cursorColor="#fff"
                                    selectionColor="rgba(255,255,255,0.3)"
                                    underlineColorAndroid="transparent"
                                    value={senha}
                                    blurOnSubmit={false}
                                    onChangeText={(text) => {
                                        setSenha(text);
                                        if (errorMessage) setErrorMessage('');
                                    }}
                                    returnKeyType="done"
                                    onSubmitEditing={() => {
                                        if (!isButtonDisabled) {
                                             handleLogin();
                                        }
                                    }}
                                />
                                <TouchableOpacity onPress={() => setSecureEntry(!secureEntry)} style={styles.eyeBtn}>
                                    <FontAwesome6 name={secureEntry ? "eye" : "eye-slash"} size={15} color="rgba(255,255,255,0.5)" />
                                </TouchableOpacity>
                            </View>

                            {errorMessage !== '' && (
                                <View style={styles.errorContainer}>
                                    <FontAwesome6 name="circle-exclamation" size={14} color="#f87171" />
                                    <Text style={styles.errorText}>{errorMessage}</Text>
                                </View>
                            )}

                            {/* Login button */}
                            <TouchableOpacity
                                style={[
                                    styles.loginBtn,
                                    isButtonDisabled && styles.loginBtnDisabled,
                                ]}
                                onPress={handleLogin}
                                disabled={isButtonDisabled}
                                activeOpacity={0.8}
                            >
                                {isLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <FontAwesome6 name="right-to-bracket" size={16} color="#fff" style={{ transform: [{ translateY: 1 }] }} />
                                        <Text style={styles.loginBtnText}>Vamos lá</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            {/* Link to cadastro */}
                            <TouchableOpacity onPress={() => router.push('/cadastro')} style={styles.switchLink} activeOpacity={0.7}>
                                <Text style={styles.switchLinkText}>
                                    Não possui uma conta? <Text style={styles.switchLinkBold}>Crie uma</Text>
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
        marginBottom: 16,
    },
    headerLogo: {
        width: 460,
        maxWidth: '100%',
        height: 140,
    },
    formArea: {
        marginBottom: 40,
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
    subtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 16,
        fontFamily: 'GlacialR',
        marginBottom: 32,
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
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        fontFamily: 'GlacialR',
        height: '100%',
        backgroundColor: 'transparent',
    },
    eyeBtn: {
        padding: 6,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(248,113,113,0.12)',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 16,
    },
    errorText: {
        color: '#f87171',
        fontSize: 14,
        fontFamily: 'GlacialR',
        flex: 1,
    },
    loginBtn: {
        backgroundColor: '#2563eb',
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
    },
    loginBtnDisabled: {
        backgroundColor: 'rgba(37,99,235,0.4)',
    },
    loginBtnText: {
        color: '#fff',
        fontFamily: 'texgyR',
        fontSize: 17,
        includeFontPadding: false,
    },
    switchLink: {
        alignItems: 'center',
        marginTop: 20,
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
