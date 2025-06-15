import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { wp, hp } from "../src/utils/responsive";

export default function RedefinirSenha({ navigation }) {
  const [email, setEmail] = useState("");

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert("Erro", "Preencha o email");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert("Sucesso", "Email de redefinição enviado!");
      navigation.goBack();
    } catch (error) {
      console.log(error);
      Alert.alert("Erro", "Falha ao enviar email");
    }
    const navigation = useNavigation();
    const _goBack = () => {
      navigation.goBack();
    };
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.scroll}>
          <Image
            source={require("../img/back.png")}
            style={styles.background}
          />

          <Image
            source={require("../img/redefinirsenha.png")}
            style={styles.imageOverlay}
          />
          <View style={styles.container}>
            <Text style={styles.title}>Redefinir senha</Text>
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
            <TouchableOpacity
              style={styles.Button}
              onPress={handleResetPassword}
            >
              <Text style={styles.ButtonText}>Enviar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.footer}>
            <Image source={require("../img/logo.png")} style={styles.logo} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  scroll: {
    flex: 1,
    width: wp("100%"),
    backgroundColor: "#fff",
    alignItems: "center",
  },
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    width: wp("100%"),
    height: hp("51%"),
    resizeMode: "Contain",
    zIndex: 0,
  },
  imageOverlay: {
    position: "absolute",
    top: hp("16.7%"),
    width: wp("89%"),
    height: undefined,
    aspectRatio: 1,
    resizeMode: "contain",
    zIndex: 1,
  },
  container: {
    marginTop: hp("58%"),
    width: wp("90%"),
    zIndex: 2,

    paddingHorizontal: "7%",
  },
  EmailTitle: {
    color: "gray",
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: -5,
    paddingTop: 0,
    alignSelf: "center",
    marginBottom: "6%",
  },
  input: {
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    paddingHorizontal: 10,
    marginBottom: 20,
    borderRadius: 5,
  },
  Button: {
    backgroundColor: "#69A461",
    width: "100%",
    height: 50,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  ButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  footer: {
    margin: "8%",
  },
  logo: {
    width: wp("30%"),
    height: hp("5%"),
    resizeMode: "contain",
  },
});
