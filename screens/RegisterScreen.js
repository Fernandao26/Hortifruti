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
import { TextInput as RPTextInput } from "react-native-paper";

export default function RegisterScreen({ navigation }) {
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [cpf, setCpf] = useState("");
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
  const [empresa, setempresa] = useState("");
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
      !cpf ||
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
      (tipo === "fornecedor" && (!cnpj || !empresa))
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
        cpf,
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
        userData.empresa = empresa;

        // Salva também na coleção "fornecedores"
        await setDoc(doc(db, "fornecedores", uid), {
          uid,
          nome,
          sobrenome,
          cpf,
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
          empresa,
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
  function maskPhone(text) {
    const cleaned = text.replace(/\D/g, "");

    if (cleaned.length > 10) {
      return cleaned.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    } else if (cleaned.length > 5) {
      return cleaned.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    } else if (cleaned.length > 2) {
      return cleaned.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    } else {
      return cleaned;
    }
  }
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

            <RPTextInput
              label="Nome"
              value={nome}
              onChangeText={setNome}
              mode="outlined"
              style={{ marginBottom: 10 }}
            />
            <RPTextInput
              label="Sobrenome"
              value={sobrenome}
              onChangeText={setSobrenome}
              mode="outlined"
              style={{ marginBottom: 10 }}
            />
            <RPTextInput
              label="CPF"
              value={cpf}
              onChangeText={setCpf}
              keyboardType="phone-pad"
              mode="outlined"
              style={{ marginBottom: 10 }}
            />

            <RPTextInput
              label="Telefone"
              value={telefone}
              onChangeText={(text) => setTelefone(maskPhone(text))}
              keyboardType="phone-pad"
              mode="outlined"
              style={{ marginBottom: 10 }}
            />

            <RPTextInput
              label="CEP"
              value={cep}
              onChangeText={(text) => setCep(text.replace(/\D/g, ""))}
              keyboardType="numeric"
              mode="outlined"
              style={{ marginBottom: 10 }}
            />

            <RPTextInput
              label="Endereço"
              value={endereco}
              onChangeText={setEndereco}
              mode="outlined"
              style={{ marginBottom: 10 }}
            />
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <RPTextInput
                label="Número"
                value={numero}
                onChangeText={setNumero}
                keyboardType="numeric"
                mode="outlined"
                style={{ marginBottom: 10, flex: 1, marginRight: 8 }}
                // ocupa metade da largura menos a margem
              />
              <RPTextInput
                label="Complemento"
                value={complemento}
                onChangeText={setComplemento}
                mode="outlined"
                style={{ marginBottom: 10, flex: 1 }} // ocupa metade da largura menos a margem
              />
            </View>
            <RPTextInput
              label="Bairro"
              value={bairro}
              onChangeText={setBairro}
              mode="outlined"
              style={{ marginBottom: 10 }}
            />
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <RPTextInput
                label="Cidade"
                value={cidade}
                onChangeText={setCidade}
                mode="outlined"
                style={{ marginBottom: 10, flex: 3, marginRight: 8 }}
              />
              <RPTextInput
                label="Estado"
                value={estado}
                onChangeText={setEstado}
                mode="outlined"
                style={{ marginBottom: 10 }}
              />
            </View>
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
              <>
                <Text style={{ marginBottom: 5, marginTop: 10, color: "#333", fontWeight: "500" }}>CNPJ</Text>
    <TextInputMask
      type={"cnpj"}
      value={cnpj}
      onChangeText={setCnpj}
      keyboardType="numeric"
      style={styles.input}
      placeholder="00.000.000/0000-00"
      placeholderTextColor="#69A461"
    />
                <RPTextInput
                  label="Nome da Empresa"
                  value={empresa}
                  onChangeText={setempresa}
                  mode="outlined"
                  style={{ marginBottom: 10, flex: 3, marginRight: 8 }}
                />
              </>
            )}

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
              />
              <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)}>
                <Icon
                  name={mostrarSenha ? "visibility" : "visibility-off"}
                  size={24}
                  color="#69A461"
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
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 15,
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
    marginTop: 5,
    color: "black",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 30,
    overflow: "hidden",
    backgroundColor: "#fafafa",
    color: "black",
  },
  picker: {
    height: 50,
    width: "100%",
    color: "black",
  },
  label: {
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 30,
    color: "#333",
    fontSize: 18,
  },
  senhaRegras: {
    fontSize: 12,
    color: "#888",
    marginBottom: 15,
    textAlign: "left",
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
    marginTop: 5,
    color: "black",
  },
  passwordInput: {
    flex: 1,
    color: "black",
  },
  button: {
    backgroundColor: "#69A461",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 10,
    width: "80%",
  },
  secondaryButton: {
    backgroundColor: "#2196F3",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
