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
  ActivityIndicator, // Já adicionamos no último ajuste
  Modal,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import Icon from "react-native-vector-icons/MaterialIcons";
import { wp, hp } from "../src/utils/responsive";
import LottieView from "lottie-react-native";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Para o spinner do botão
  const [showWelcomeLottie, setShowWelcomeLottie] = useState(false); // <-- ADICIONE ESTE NOVO ESTADO
  const [userTypeDestination, setUserTypeDestination] = useState(null); // <-- NOVO ESTADO PARA A DESTINAÇÃO APÓS LOTTIE

  const handleLogin = async () => {
    if (!email || !senha) {
      Alert.alert("Erro", "Preencha todos os campos");
      return;
    }

    setIsLoading(true); // Ativa o spinner do botão

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

        let destinationScreen;
        switch (tipo) {
          case "admin":
            destinationScreen = "Admin";
            break;
          case "fornecedor":
            destinationScreen = "Fornecedor";
            break;
          default:
            destinationScreen = "Home"; // Ou "Home" se não usar Tab Navigator
        }
        setUserTypeDestination(destinationScreen); // Guarda a tela de destino

        // Se o login for bem-sucedido, ativa a animação Lottie
        setShowWelcomeLottie(true);

        // Não navegamos aqui ainda! A navegação será feita após a Lottie terminar.
      } else {
        Alert.alert("Erro", "Usuário não encontrado no banco de dados.");
        setIsLoading(false); // Desativa o spinner em caso de erro antes da Lottie
      }
    } catch (error) {
      Alert.alert("Erro", "Email ou senha incorretos.");
      setEmail("");
      setSenha("");
      setIsLoading(false); // Desativa o spinner em caso de erro
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
          {/* ... Todos os seus elementos existentes da LoginScreen (Imagens, Inputs, Botões, etc.) ... */}

          <Image
            source={require("../img/logo.png")}
            style={styles.topImage}
            resizeMode="contain"
          />
          <Image
            source={require("../img/mascote.png")}
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

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={isLoading || showWelcomeLottie} // <-- Desabilita também durante a Lottie
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Entrar</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* NOVO: MODAL DA ANIMAÇÃO LOTTIE DE BOAS-VINDAS */}
      <Modal
        visible={showWelcomeLottie}
        transparent={false}
        animationType="slide" // Ou "slide"
        onRequestClose={() => {
          // Opcional: Se o usuário fechar o modal, navega mesmo assim
          setShowWelcomeLottie(false);
          setIsLoading(false); // Garante que o loading do botão pare
          if (userTypeDestination) {
            navigation.replace(userTypeDestination);
          }
        }}
      >
        <View style={styles.lottieOverlay}>
          <LottieView
            source={require("../assets/LoadingPerfil.json")} // <-- AJUSTE ESTE CAMINHO PARA O SEU ARQUIVO LOTTIE
            autoPlay
            loop={false} // A animação deve tocar apenas uma vez
            onAnimationFinish={() => {
              console.log("Animação Lottie de boas-vindas concluída.");
              setShowWelcomeLottie(false); // Esconde o modal
              setIsLoading(false); // Garante que o loading do botão pare

              // AQUI É ONDE A NAVEGAÇÃO FINALMENTE ACONTECE
              if (userTypeDestination) {
                navigation.replace(userTypeDestination);
              } else {
                // Fallback caso userTypeDestination não seja definido (o que não deve acontecer com o try/catch)
                navigation.replace("Home");
              }
            }}
            style={styles.lottieAnimation}
          />
          {/* Opcional: Adicionar um texto abaixo da animação */}
          <Text style={styles.welcomeText}>Bem-vindo ao Frutiway!</Text>
        </View>
      </Modal>
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
    color: "black",
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
    color: "black",
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
  lottieOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)", // Fundo quase branco, semi-transparente
  },
  lottieAnimation: {
    width: 300, // Ajuste conforme o tamanho da sua animação
    height: 300,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#69A461",
    marginTop: 20,
    textAlign: "center",
  },
});
