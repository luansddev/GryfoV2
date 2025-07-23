//Apenas a tela de início com dois botões
import { router } from "expo-router";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
export default function Index(){
    function navegarCad(){
        router.navigate("/cadastro")
    }
    function navegarLog(){
        router.navigate("/login")
    }
    
    return(
        <View style={styles.conteiner}>
            <View style={styles.boxImage}>
                <Image style={styles.image}source={require('../../assets/images/gryfop.png')}></Image>
            </View>
            <View style={styles.boxText}>
                <Text style={styles.title}>Fique informado sobre a segurança da sua região.</Text>
            </View>
            <View style={styles.boxButton}>
                <TouchableOpacity  style={styles.bt1} onPress={navegarCad}>
                    <Text style={styles.btText}>Crie uma conta</Text>
                </TouchableOpacity>
                    <View style={styles.boxOu}>
                        <View style={styles.linha}></View>
                        <Text style={styles.ou}>ou</Text>
                        <View style={styles.linha}></View>
                    </View>
                <TouchableOpacity style={styles.bt2} onPress={navegarLog}>
                    <Text style={styles.btText}>Entre</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    conteiner: {
        padding: 20,
        maxWidth: "90%",
        marginLeft: "auto",
        marginRight: "auto"
    },
    boxImage: {
        marginTop: "20%",
        alignItems: "center",
    },
    boxText: {
        marginTop: "60%",
    },
    title: {
        color: "#000",
        fontSize: 27,
        fontFamily: "texgyR"
    },
    image: {
        width: 40,
        height: 40,
    },
    boxButton: {
        flexDirection: "column",
        marginTop: "20%"
    },
    linha: {
        width: "40%",
        height: 2,
        backgroundColor: "#ccc",
    },
    boxOu: {
        marginTop: "3%",
        marginBottom: "3%",
        flexDirection: "row",
        justifyContent: "space-evenly",
        alignItems: "center"
    },
    ou: {
        fontFamily: "GlacialR",
        fontSize: 20,
        color: "grey",
        marginBottom: 6,
    },
    bt1: {
        backgroundColor: "#000",
        height: 50,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",

    },
    bt2: {
        backgroundColor: "blue",
        height: 50,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",

    },
    btText: {
        color: "#fff",
        fontFamily: "GlacialR",
        fontSize: 20,
    } 
})
