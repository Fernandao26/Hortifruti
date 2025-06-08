import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, setDoc } from "firebase/firestore";
import { TextInputMask } from "react-native-masked-text";
import Icon from "react-native-vector-icons/MaterialIcons";

export default function RegisterScreen({ navigation }) {
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [tipo, setTipo] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  useEffect(() => {
    const fetchEndereco = async () => {
      if (cep.length === 8) {
        try {
          const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const data = await response.json();

          if (!data.erro) {
            setEndereco(data.logradouro);
            setBairro(data.bairro);
            setCidade(data.localidade);
            setEstado(data.uf);
          } else {
            Alert.alert("CEP não encontrado");
          }
        } catch (error) {
          Alert.alert("Erro ao buscar o CEP");
        }
      }
    };

    fetchEndereco();
  }, [cep]);

  const validarSenha = (senha) => {
    const regex = /^(?=.*[A-Z])(?=.*[\W_]).{8,}$/;
    return regex.test(senha);
  };

  const handleRegister = async () => {
    if (
      !nome ||
      !sobrenome ||
      !telefone ||
      !cep ||
      !endereco ||
      !numero ||
      !complemento ||
      !bairro ||
      !cidade ||
      !estado ||
      !tipo ||
      !email ||
      !senha ||
      (tipo === "fornecedor" && !cnpj)
    ) {
      Alert.alert("Erro", "Todos os campos são obrigatórios.");
      return;
    }

    if (!validarSenha(senha)) {
      Alert.alert(
        "Senha inválida",
        "A senha deve conter no mínimo 8 caracteres, uma letra maiúscula e um caractere especial."
      );
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        senha
      );
      const uid = userCredential.user.uid;

      const userData = {
        nome,
        sobrenome,
        telefone,
        cep,
        endereco,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        tipo,
        email,
      };

      if (tipo === "fornecedor") {
        userData.cnpj = cnpj;

        // Salva também na coleção "fornecedores"
        await setDoc(doc(db, "fornecedores", uid), {
          uid,
          nome,
          sobrenome,
          telefone,
          cep,
          endereco,
          numero,
          complemento,
          bairro,
          cidade,
          estado,
          email,
          cnpj,
          tipo,
        });
      }

      await setDoc(doc(db, "users", uid), userData);

      Alert.alert("Sucesso", "Usuário cadastrado com sucesso!");
      navigation.replace("Login");
    } catch (error) {
      console.log(error.code, error.message);
      if (error.code === "auth/email-already-in-use") {
        Alert.alert("Erro", "Este e-mail já está em uso.");
      } else {
        Alert.alert("Erro ao cadastrar", error.message);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.title}>Cadastro</Text>
            <Text style={styles.nometitle}>Nome</Text>
            <TextInput
              placeholder="Nome"
              style={styles.input}
              value={nome}
              onChangeText={setNome}
            />
            <TextInput
              placeholder="Sobrenome"
              style={styles.input}
              value={sobrenome}
              onChangeText={setSobrenome}
            />

            <TextInputMask
              type={"cel-phone"}
              options={{ maskType: "BRL", withDDD: true, dddMask: "(99) " }}
              placeholder="Telefone"
              style={styles.input}
              value={telefone}
              onChangeText={setTelefone}
              keyboardType="phone-pad"
            />

            <TextInput
              placeholder="CEP"
              style={styles.input}
              value={cep}
              onChangeText={(text) => setCep(text.replace(/\D/g, ""))}
              keyboardType="numeric"
            />

            <TextInput
              placeholder="Endereço"
              style={styles.input}
              value={endereco}
              onChangeText={setEndereco}
            />
            <TextInput
              placeholder="Número"
              style={styles.input}
              value={numero}
              onChangeText={setNumero}
              keyboardType="numeric"
            />
            <TextInput
              placeholder="Complemento"
              style={styles.input}
              value={complemento}
              onChangeText={setComplemento}
            />
            <TextInput
              placeholder="Bairro"
              style={styles.input}
              value={bairro}
              onChangeText={setBairro}
            />
            <TextInput
              placeholder="Cidade"
              style={styles.input}
              value={cidade}
              onChangeText={setCidade}
            />
            <TextInput
              placeholder="Estado"
              style={styles.input}
              value={estado}
              onChangeText={setEstado}
            />

            <Text style={styles.label}>Tipo de usuário:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={tipo}
                onValueChange={(itemValue) => setTipo(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Selecione..." value="" />
                <Picker.Item label="Cliente" value="cliente" />
                <Picker.Item label="Fornecedor" value="fornecedor" />
              </Picker>
            </View>

            {tipo === "fornecedor" && (
              <TextInputMask
                type={"cnpj"}
                placeholder="CNPJ"
                style={styles.input}
                value={cnpj}
                onChangeText={setCnpj}
                keyboardType="numeric"
              />
            )}

            <TextInput
              placeholder="Email"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="Senha"
                style={styles.passwordInput}
                value={senha}
                onChangeText={setSenha}
                secureTextEntry={!mostrarSenha}
              />
              <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)}>
                <Icon
                  name={mostrarSenha ? "visibility" : "visibility-off"}
                  size={24}
                  color="#888"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.senhaRegras}>
              A senha deve ter no mínimo 8 caracteres, uma letra maiúscula e um
              caractere especial.
            </Text>

            <TouchableOpacity style={styles.button} onPress={handleRegister}>
              <Text style={styles.buttonText}>Cadastrar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => navigation.replace("Login")}
            >
              <Text style={styles.buttonText}>Já tem conta? Fazer login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: "#f2f2f2",
    flexGrow: 1,
    alignItems: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 25,
    textAlign: "center",
    color: "#333",
  },
  input: {
    height: 50,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
    backgroundColor: "#fafafa",
  },
  picker: {
    height: 50,
    width: "100%",
  },
  label: {
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 8,
    color: "#333",
  },
  senhaRegras: {
    fontSize: 12,
    color: "#888",
    marginBottom: 15,
    textAlign: "center",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 50,
    backgroundColor: "#fafafa",
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
  },
  button: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  secondaryButton: {
    backgroundColor: "#2196F3",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
