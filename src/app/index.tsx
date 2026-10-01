//Tela de início
import { router, useFocusEffect } from "expo-router";
import { Dimensions, Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View, Animated } from "react-native";
import { useCallback, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");
const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);

export default function Index() {
    const insets = useSafeAreaInsets();

    const bgOpacity = useRef(new Animated.Value(0)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const logoTranslateY = useRef(new Animated.Value(-30)).current;
    const contentOpacity = useRef(new Animated.Value(0)).current;
    const contentTranslateY = useRef(new Animated.Value(30)).current;

    useFocusEffect(
        useCallback(() => {
            // Reset values so the animation replays
            bgOpacity.setValue(0);
            logoOpacity.setValue(0);
            logoTranslateY.setValue(-30);
            contentOpacity.setValue(0);
            contentTranslateY.setValue(30);

            Animated.sequence([
                Animated.timing(bgOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
                Animated.parallel([
                    Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
                    Animated.spring(logoTranslateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
                ]),
                Animated.parallel([
                    Animated.timing(contentOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
                    Animated.spring(contentTranslateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
                ]),
            ]).start();
        }, [])
    );

    function navegarCad() {
        router.navigate("/cadastro");
    }
    function navegarLog() {
        router.navigate("/login");
    }

    return (
        <View style={styles.container}>
            <AnimatedImageBackground
                source={require("../../assets/images/bg_02.jpg")}
                style={[styles.background, { opacity: bgOpacity }]}
                resizeMode="cover"
            >
                {/* Gradient overlay: transparent at top → intense dark at bottom 45% */}
                <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.85)", "rgba(0,0,0,0.95)"]}
                    locations={[0, 0.55, 0.75, 1]}
                    style={StyleSheet.absoluteFill}
                />

                {/* Content */}
                <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
                    {/* Logo at the top */}
                    <Animated.View style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ translateY: logoTranslateY }] }]}>
                        <Image
                            source={require("../../assets/images/gardio_branco.png")}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </Animated.View>

                    {/* Spacer */}
                    <View style={{ flex: 1 }} />

                    {/* Bottom section: tagline + buttons */}
                    <Animated.View style={[styles.bottomSection, { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }]}>
                        <Text style={styles.tagline}>
                            Fique por dentro da segurança da sua região.
                        </Text>

                        <View style={styles.buttonGroup}>
                            <TouchableOpacity
                                style={styles.btnPrimary}
                                onPress={navegarCad}
                                activeOpacity={0.8}
                            >
                                <FontAwesome6 name="user-plus" size={16} color="#fff" />
                                <Text style={styles.btnPrimaryText}>Crie uma conta</Text>
                            </TouchableOpacity>

                            <View style={styles.dividerRow}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>ou</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            <TouchableOpacity
                                style={styles.btnSecondary}
                                onPress={navegarLog}
                                activeOpacity={0.8}
                            >
                                <FontAwesome6 name="right-to-bracket" size={16} color="#fff" />
                                <Text style={styles.btnSecondaryText}>Entrar</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </AnimatedImageBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0a0a",
    },
    background: {
        flex: 1,
        width: "100%",
        height: "100%",
    },
    content: {
        flex: 1,
        paddingHorizontal: 28,
    },
    logoContainer: {
        alignItems: "center",
        marginTop: 20,
    },
    logo: {
        width: 535,
        height: 173,
    },
    bottomSection: {
        marginBottom: 50,
    },
    tagline: {
        color: "#fff",
        fontSize: 22,
        fontFamily: "texgyR",
        lineHeight: 30,
        marginBottom: 36,
    },
    buttonGroup: {
        gap: 0,
    },
    btnPrimary: {
        backgroundColor: "rgba(255,255,255,0.15)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.3)",
        height: 52,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        gap: 10,
    },
    btnPrimaryText: {
        color: "#fff",
        fontFamily: "texgyR",
        fontSize: 17,
    },
    dividerRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginVertical: 14,
        gap: 12,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: "rgba(255,255,255,0.2)",
    },
    dividerText: {
        fontFamily: "GlacialR",
        fontSize: 15,
        color: "rgba(255,255,255,0.5)",
    },
    btnSecondary: {
        backgroundColor: "#2563eb",
        height: 52,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        gap: 10,
    },
    btnSecondaryText: {
        color: "#fff",
        fontFamily: "texgyR",
        fontSize: 17,
    },
});
