import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import Icon from "react-native-vector-icons/MaterialIcons";
import { wp, hp } from "../src/utils/responsive";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const handleLogin = async () => {
    if (!email || !senha) {
      Alert.alert("Erro", "Preencha todos os campos");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        senha
      );
      const user = userCredential.user;
     
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const tipo = userData.tipo;

        switch (tipo) {
          case "admin":
            navigation.replace("Admin");
            break;
          case "fornecedor":
            navigation.replace("Fornecedor");
            break;
          default:
            navigation.replace("Home");
        }
      } else {
        Alert.alert("Erro", "Usuário não encontrado no banco de dados");
      }
    } catch (error) {
      Alert.alert("Erro", "Email ou senha incorretos");
      setEmail("");
      setSenha("");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Image
            source={require("../img/logo.png")}
            style={styles.topImage}
            resizeMode="contain"
          />
          <Image
            source={require("../img/mascote.png")} // ajuste o caminho se necessário
            style={styles.image}
            resizeMode="contain"
          />
          <Text style={styles.loginTitle}>Login</Text>
          <Text style={styles.signUpText}>
            Não tem uma conta?
            <Text
              style={styles.signUpLink}
              onPress={() => navigation.navigate("Register")}
            >
              {"  "}
              Cadastrar
            </Text>
          </Text>
          <Text style={styles.EmailTitle}>Email</Text>
          <TextInput
            placeholder="Ex: Frutigo@gmail.com"
            placeholderTextColor={"#69A461"}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.passwordTitle}>Senha</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              placeholder="Senha"
              placeholderTextColor={"#69A461"}
              style={styles.passwordInput}
              value={senha}
              onChangeText={setSenha}
              secureTextEntry={!mostrarSenha}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)}>
              <Icon
                name={mostrarSenha ? "visibility" : "visibility-off"}
                size={24}
                color="#69A461"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate("RedefinirSenha")}
          >
            <Text style={styles.forgotPassword}>Esqueceu a senha ?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Entrar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 35,
  },
  container: {
    width: "100%",
    alignItems: "center",
  },
  topImage: {
    width: 50,
    height: 40,
    marginTop: 0,
    zIndex: 10,
    position: "absolute",
    alignSelf: "flex-start",
  },

  image: {
    width: wp("100%"),
    height: hp("40%"),
    marginBottom: 0,

    marginTop: 20,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 0,
    paddingTop: 0,
  },
  signUpText: {
    marginTop: 10,
    marginBottom: 20,
    color: "#666",
  },
  signUpLink: {
    color: "#3478f6",
    fontWeight: "bold",
  },
  EmailTitle: {
    color: "gray",
    alignSelf: "flex-start",
    marginBottom: 5,
  },
  passwordTitle: {
    color: "gray",
    alignSelf: "flex-start",
    marginBottom: 5,
  },
  input: {
    width: "100%",
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 50,
    marginBottom: 10,
    width: "100%",
  },
  passwordInput: {
    flex: 1,
  },
  forgotPassword: {
    color: "#69A461",
    textDecorationLine: "underline",
    alignSelf: "flex-end",
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: "#69A461",
    width: "100%",
    height: 50,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  loginButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
