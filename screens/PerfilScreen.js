import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Image,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  SafeAreaView,
} from "react-native";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import {
  signOut,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { Avatar, IconButton, Appbar } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

export default function PerfilScreen() {
  const [usuario, setUsuario] = useState(null);
  const [editando, setEditando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [senhaConfirmacao, setSenhaConfirmacao] = useState("");

  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState(""); // <-- NOVO ESTADO PARA CPF
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [tipo, setTipo] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [fotoLocal, setFotoLocal] = useState(null);
  const [fotoAlterada, setFotoAlterada] = useState(false);

  const navigation = useNavigation();
  const _goBack = () => {
    navigation.goBack();
  };
  const escolherImagem = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert("Permissão para acessar a galeria é necessária!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;

      // Converter URI para Base64
      const base64 = await convertUriToBase64(uri);

      // Salvar no Firestore
      await salvarFotoNoFirestore(base64);
    }
  };
  const convertUriToBase64 = async (uri) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result); // Base64 completo
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob); // Converte blob para base64
    });
  };
  const salvarFotoNoFirestore = async (base64Image) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Usuário não autenticado");

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        fotoBase64: base64Image, // Salva como string no Firestore
      });

      console.log("Foto salva no Firestore");
      setFotoLocal(base64Image); // Atualiza estado local
    } catch (error) {
      console.error("Erro ao salvar foto no Firestore:", error);
      Alert.alert("Erro", "Não foi possível salvar a foto.");
    }
  };
  const salvarFotoPerfil = async () => {
    try {
      if (!usuario?.uid || !fotoLocal) return;

      // 1. Salva localmente
      await AsyncStorage.setItem("fotoLocal", fotoLocal);

      // 2. Atualiza no Firestore
      const userRef = doc(db, "usuarios", usuario.uid);
      await updateDoc(userRef, { fotoLocal });

      Alert.alert("Sucesso", "Foto atualizada com sucesso!");
      setFotoAlterada(false);
    } catch (error) {
      console.error("Erro ao salvar foto:", error);
      Alert.alert("Erro", "Não foi possível salvar a foto.");
    }
  };

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const uid = auth.currentUser.uid;
        const docRef = doc(db, "users", uid);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const dados = snapshot.data();
          setUsuario(dados);
          setNome(dados.nome || "");
          setSobrenome(dados.sobrenome || "");
          setTelefone(dados.telefone || "");
          setCpf(dados.cpf || ""); // <-- CARREGA CPF DO FIRESTORE
          setCep(dados.cep || "");
          setEndereco(dados.endereco || "");
          setNumero(dados.numero || "");
          setComplemento(dados.complemento || "");
          setBairro(dados.bairro || "");
          setCidade(dados.cidade || "");
          setEstado(dados.estado || "");
          setTipo(dados.tipo || "");
          setEmpresa(dados.empresa || "");
          setFotoLocal(dados.fotoLocal || null);
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        Alert.alert("Erro ao carregar dados");
      } finally {
        setCarregando(false);
      }
    };

    carregarDados();
  }, []);

  const formatarTelefone = (valor) => {
    return valor
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  };

  const formatarCpf = (valor) => {
    const cleanCpf = valor.replace(/\D/g, "");
    if (cleanCpf.length <= 3) {
      return cleanCpf;
    } else if (cleanCpf.length <= 6) {
      return `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3)}`;
    } else if (cleanCpf.length <= 9) {
      return `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6)}`;
    } else {
      return `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9, 11)}`;
    }
  };

  const buscarEnderecoPorCep = async (cepDigitado) => {
    try {
      const resposta = await axios.get(
        `https://viacep.com.br/ws/${cepDigitado}/json/`
      );
      if (resposta.data.erro) {
        Alert.alert("CEP inválido");
      } else {
        setEndereco(resposta.data.logradouro || "");
        setBairro(resposta.data.bairro || "");
        setCidade(resposta.data.localidade || "");
        setEstado(resposta.data.uf || "");
      }
    } catch (error) {
      Alert.alert("Erro ao buscar o CEP");
    }
  };

  const salvarEdicao = async () => {
    if (cep.length !== 8) {
      Alert.alert("Digite um CEP válido com 8 números");
      return;
    }
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      Alert.alert("Erro", "O CPF deve conter 11 dígitos numéricos.");
      return;
    }

    try {
      const uid = auth.currentUser.uid;
      const docRef = doc(db, "users", uid);

      await updateDoc(docRef, {
        nome,
        sobrenome,
        telefone,
        cpf: cleanCpf, // <-- SALVA CPF LIMPO NO FIRESTORE
        cep,
        endereco,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        tipo,
        empresa,
        fotoLocal: fotoLocal || "",
      });

      setEditando(false);
      Alert.alert("Dados atualizados com sucesso!");
    } catch (error) {
      Alert.alert("Erro ao salvar alterações", error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      Alert.alert("Erro ao sair");
    }
  };

  const confirmarDesativacao = () => {
    setModalVisible(true);
  };

  const desativarConta = async () => {
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(
        user.email,
        senhaConfirmacao
      );
      await reauthenticateWithCredential(user, credential);

      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(user);

      Alert.alert("Conta desativada com sucesso.");
      setModalVisible(false);
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Erro ao desativar conta",
        "Verifique sua senha e tente novamente."
      );
    }
  };

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text>Carregando...</Text>
      </View>
    );
  }

  if (!usuario) return <Text>Usuário não encontrado</Text>;

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
          <SafeAreaView>
            <Appbar.Header style={styles.header}>
              <TouchableOpacity onPress={_goBack} style={{ padding: 8 }}>
                <Image
                  source={require("../img/Left2.png")}
                  style={{
                    width: 30,
                    height: 30,
                  }}
                />
              </TouchableOpacity>
              <View style={{ flexDirection: "row" }}>
                {editando ? (
                  <TouchableOpacity
                    onPress={salvarEdicao}
                    style={{
                      width: 70,
                      height: 70,

                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Icon
                      name="check-circle-outline"
                      size={38}
                      color="#69A461"
                    />
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        navigation.navigate("Ajuda");
                      }}
                      style={{ padding: 8, marginRight: 0 }}
                    >
                      <Image
                        source={require("../img/Infocircle.png")}
                        style={{
                          width: 30,
                          height: 30,
                        }}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleLogout}
                      style={{ padding: 8, marginRight: 16 }}
                    >
                      <Image
                        source={require("../img/Logout.png")}
                        style={{
                          width: 30,
                          height: 30,
                        }}
                      />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </Appbar.Header>
          </SafeAreaView>
          <View
            style={{ alignItems: "center", marginBottom: 20, marginTop: 5 }}
          >
            <View
              style={{
                position: "relative",
                width: 180,
                height: 180,
                alignSelf: "center",
              }}
            >
              {/* Elipse (maior que o avatar) */}
              <Image
                source={require("../img/Ellipse.png")}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: 180, // maior que o avatar
                  height: 180,
                }}
                resizeMode="contain"
              />

              {/* Avatar menor (com espaço em branco em volta) */}
              <View
                style={{
                  position: "absolute",
                  top: 10, // controla o espaço entre avatar e anel
                  left: 10,
                  right: 10,
                  bottom: 10,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <TouchableOpacity onPress={editando ? escolherImagem : null}>
                  <Image
                    source={
                      fotoLocal
                        ? { uri: fotoLocal }
                        : require("../img/frutigoprofile.png")
                    }
                    style={{
                      width: 170,
                      height: 170,
                      borderRadius: 85,
                      size: 160,
                    }}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    position: "absolute",
                    right: -5,
                    bottom: 0,
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    backgroundColor: "white",
                    borderWidth: 3,
                    borderColor: "#69A461",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                  onPress={() => {
                    setEditando(!editando);
                    // ação de editar
                  }}
                >
                  <Image
                    source={
                      editando
                        ? require("../img/Camera.png") // ÍCONE DE CHECK QUANDO EDITANDO
                        : require("../img/Edit1.png") // ÍCONE DE EDIT QUANDO NÃO EDITANDO
                    }
                    style={{ width: 24, height: 24 }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ flexDirection: "row", marginTop: 20 }}>
              <Text style={styles.nome}>{nome} </Text>
              <Text style={styles.sobrenome}>
                {sobrenome}{" "}
                <Text style={{ fontWeight: "600", color: "gray" }}>
                  {"|"} <Text style={styles.tipo}>{tipo}</Text>
                </Text>
              </Text>
            </View>
            <Text style={styles.email}>{usuario.email}</Text>
            <View
              style={{
                borderBottomWidth: 2,
                borderBottomColor: "#D3D3D3",
                marginTop: 25,
                width: "70%",
                marginBottom: 15,
              }}
            ></View>
          </View>
          <View
            style={{
              marginHorizontal: 25,
            }}
          >
            {tipo === "fornecedor" && (
              <>
                <Text style={styles.label}>Empresa</Text>
                {editando ? (
                  <TextInput
                    value={empresa}
                    onChangeText={setEmpresa}
                    style={styles.input}
                  />
                ) : (
                  <Text style={styles.valor}>{empresa}</Text>
                )}
              </>
            )}
            <Text style={styles.label}>Nome</Text>
            {editando ? (
              <TextInput
                value={nome}
                onChangeText={setNome}
                style={styles.input}
              />
            ) : (
              <Text style={styles.valor}>{nome}</Text>
            )}
            <Text style={styles.label}>Sobrenome</Text>
            {editando ? (
              <TextInput
                value={sobrenome}
                onChangeText={setSobrenome}
                style={styles.input}
              />
            ) : (
              <Text style={styles.valor}>{sobrenome}</Text>
            )}
            <Text style={styles.label}>Email</Text>
            <Text style={styles.valor}>{usuario.email}</Text>
            <Text style={styles.label}>Telefone</Text>
            {editando ? (
              <TextInput
                value={formatarTelefone(telefone)}
                onChangeText={(texto) => setTelefone(texto.replace(/\D/g, ""))}
                style={styles.input}
                keyboardType="phone-pad"
                maxLength={15}
              />
            ) : (
              <Text style={styles.valor}>{formatarTelefone(telefone)}</Text>
            )}
            {/* NOVO CAMPO PARA CPF */}
            <Text style={styles.label}>CPF</Text>
            {editando ? (
              <TextInput
                value={formatarCpf(cpf)} // Aplica a formatação aqui
                onChangeText={(texto) => setCpf(texto.replace(/\D/g, ""))} // Salva apenas dígitos
                style={styles.input}
                keyboardType="numeric"
                maxLength={14} // 11 dígitos + 3 para formatação (pontos e traço)
              />
            ) : (
              <Text style={styles.valor}>{formatarCpf(cpf)}</Text>
            )}
            {/* FIM NOVO CAMPO PARA CPF */}
            <Text style={styles.label}>CEP</Text>
            {editando ? (
              <TextInput
                value={cep}
                onChangeText={(texto) => {
                  const cleanCep = texto.replace(/\D/g, "");
                  setCep(cleanCep);
                  if (cleanCep.length === 8) buscarEnderecoPorCep(cleanCep);
                }}
                keyboardType="numeric"
                style={styles.input}
                maxLength={8}
              />
            ) : (
              <Text style={styles.valor}>{cep}</Text>
            )}
            <Text style={styles.label}>Endereço</Text>
            {editando ? (
              <TextInput
                value={endereco}
                onChangeText={setEndereco}
                style={styles.input}
              />
            ) : (
              <Text style={styles.valor}>{endereco}</Text>
            )}
            <Text style={styles.label}>Número</Text>
            {editando ? (
              <TextInput
                value={numero}
                onChangeText={setNumero}
                style={styles.input}
                keyboardType="numeric"
              />
            ) : (
              <Text style={styles.valor}>{numero}</Text>
            )}
            <Text style={styles.label}>Complemento</Text>
            {editando ? (
              <TextInput
                value={complemento}
                onChangeText={setComplemento}
                style={styles.input}
              />
            ) : (
              <Text style={styles.valor}>{complemento}</Text>
            )}
            <Text style={styles.label}>Bairro</Text>
            {editando ? (
              <TextInput
                value={bairro}
                onChangeText={setBairro}
                style={styles.input}
              />
            ) : (
              <Text style={styles.valor}>{bairro}</Text>
            )}
            <Text style={styles.label}>Cidade</Text>
            {editando ? (
              <TextInput
                value={cidade}
                onChangeText={setCidade}
                style={styles.input}
              />
            ) : (
              <Text style={styles.valor}>{cidade}</Text>
            )}
            <Text style={styles.label}>Estado</Text>
            {editando ? (
              <TextInput
                value={estado}
                onChangeText={setEstado}
                style={styles.input}
                maxLength={2}
              />
            ) : (
              <Text style={styles.valor}>{estado}</Text>
            )}
          </View>

          <View style={{ marginTop: 50, marginBottom: 60, paddingBottom: 30 }}>
            <TouchableOpacity
              style={[styles.botao]}
              onPress={confirmarDesativacao}
            >
              <Text style={styles.botaoTexto}>Desativar Conta</Text>
            </TouchableOpacity>
          </View>

          <Modal visible={modalVisible} transparent animationType="slide">
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={{ marginBottom: 10 }}>
                  Digite sua senha para confirmar:
                </Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  placeholder="Senha"
                  value={senhaConfirmacao}
                  onChangeText={setSenhaConfirmacao}
                />
                <View style={{ flexDirection: "row", marginTop: 10 }}>
                  <Button
                    title="Cancelar"
                    onPress={() => setModalVisible(false)}
                  />
                  <View style={{ width: 10 }} />
                  <Button
                    title="Confirmar"
                    onPress={desativarConta}
                    color="red"
                  />
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "white",
    flexGrow: 1,
  },
  header: {
    justifyContent: "space-between",
    height: 40,
    marginTop: 10,
    backgroundColor: "white",
  },
  titulo: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  profile: {
    objectFit: "contain",
  },
  label: {
    fontWeight: "bold",
    marginTop: 10,
    fontSize: 16,
  },
  nome: {
    fontSize: 20,
    fontWeight: "600",
  },
  sobrenome: {
    fontSize: 20,
    alignSelf: "center",
    fontWeight: "400",
  },
  tipo: {
    fontSize: 20,
    color: "D3D3D3",
  },
  email: {
    fontSize: 15,
    color: "gray",
    marginTop: 3,
  },
  valor: {
    marginBottom: 8,
    fontSize: 16,
    color: "gray",
    marginTop: 3,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: "#fff",
    padding: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    marginBottom: 5,
    borderRadius: 5,
  },
  botao: {
    paddingBottom: 12,
    borderRadius: 8,
  },
  botaoTexto: {
    textAlign: "center",
    fontWeight: "bold",
    marginTop: 0,
    color: "#DC5831",
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 8,
  },
});
