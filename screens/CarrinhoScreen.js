import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
} from "firebase/firestore";

export default function CarrinhoScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  const { carrinho: carrinhoInicial = [], atualizarCarrinhoNaHome } =
    route.params || {};
  const [carrinho, setCarrinho] = useState([]);
  const [enderecoUser, setEnderecoUser] = useState("");
  const [numeroUser, setNumeroUser] = useState("");
  const [bairroUser, setBairroUser] = useState("");
  const [editandoEndereco, setEditandoEndereco] = useState(false);
  const [enderecoInput, setEnderecoInput] = useState("");
  const [numeroInput, setNumeroInput] = useState("");
  const [bairroInput, setBairroInput] = useState("");
  const [cep, setCep] = useState("");
  const [cidadeInput, setCidadeInput] = useState("");
  const [estadoInput, setEstadoInput] = useState("");
  const [freteCalculado, setFreteCalculado] = useState(10); // valor inicial
  const [enderecosSalvos, setEnderecosSalvos] = useState([]);
  const [enderecoSelecionado, setEnderecoSelecionado] = useState(null);
  const CEP_LOJA = "12507050";
  function estimarDistanciaPorCep(CEP_LOJA, cepCliente) {
    const cepLojaNum = parseInt(CEP_LOJA.substring(0, 5));
    const cepClienteNum = parseInt(cepCliente.substring(0, 5));
    const diferenca = Math.abs(cepLojaNum - cepClienteNum);

    // cada 10 unidades de diferença = ~1 km
    return diferenca / 10;
  }
  function calcularFretePorDistancia(distanciaKm) {
    if (distanciaKm < 4) return 0;
    return Math.ceil((distanciaKm - 4) / 4) * 10;
  }
  const buscarEnderecosDoUsuario = async () => {
    try {
      const uid = auth.currentUser.uid;
      const q = query(collection(db, "enderecos"), where("uid", "==", uid));
      const snap = await getDocs(q);
      const lista = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setEnderecosSalvos(lista);
    } catch (err) {
      console.error("Erro ao buscar endereços:", err);
    }
  };
  const agruparPorFornecedor = (itens) => {
    return itens.reduce((acc, item) => {
      const fornecedor = item.fornecedor || "Desconhecido";
      if (!acc[fornecedor]) {
        acc[fornecedor] = [];
      }
      acc[fornecedor].push(item);
      return acc;
    }, {});
  };
  const carrinhoAgrupado = agruparPorFornecedor(carrinho);
  useEffect(() => {
    buscarEnderecosDoUsuario();
    if (Array.isArray(carrinhoInicial)) {
      setCarrinho([...carrinhoInicial]);
    }
  }, [JSON.stringify(carrinhoInicial)]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        atualizarCarrinhoNaHome?.(carrinho);
      };
    }, [carrinho])
  );

  const fetchEnderecoUsuario = async () => {
    try {
      const uid = auth.currentUser.uid;
      const snap = await getDoc(doc(db, "users", uid));
      const data = snap.data() || {};
      setEnderecoUser(data.endereco || "");
      setNumeroUser(data.numero || "");
      setBairroUser(data.bairro || "");
    } catch (err) {
      console.error("Erro ao carregar endereço:", err);
    }
  };

  const buscarEnderecoPorCEP = async (cepDigitado) => {
    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${cepDigitado}/json/`
      );
      const data = await response.json();

      if (data.erro) {
        Alert.alert("CEP não encontrado");
        return;
      }

      setEnderecoInput(data.logradouro || "");
      setBairroInput(data.bairro || "");
      setCidadeInput(data.localidade || "");
      setEstadoInput(data.uf || "");
      const distanciaEstimada = estimarDistanciaPorCep("12502050", cepDigitado);
      const frete = calcularFretePorDistancia(distanciaEstimada);
      setFreteCalculado(frete);
    } catch (err) {
      Alert.alert("Erro ao buscar CEP");
      console.error(err);
    }
  };

  const salvarEndereco = async () => {
    if (!cep || !enderecoInput || !numeroInput || !bairroInput) {
      return Alert.alert("Preencha todos os campos de endereço");
    }

    try {
      const uid = auth.currentUser.uid;
      await addDoc(collection(db, "enderecos"), {
        uid: uid,
        cep,
        endereco: enderecoInput,
        numero: numeroInput,
        bairro: bairroInput,
        cidade: cidadeInput,
        estado: estadoInput,
        criadoEm: new Date(),
      });

      setEditandoEndereco(false);
      buscarEnderecosDoUsuario(); // atualiza lista
    } catch (err) {
      console.error(err);
      Alert.alert("Erro ao salvar endereço");
    }
  };
  const selecionarEndereco = (end) => {
    setEnderecoUser(end.endereco);
    setNumeroUser(end.numero);
    setBairroUser(end.bairro);
    setCidadeInput(end.cidade);
    setEstadoInput(end.estado);
    setCep(end.cep);
    setEnderecoSelecionado(end);

    const distanciaEstimada = estimarDistanciaPorCep(CEP_LOJA, end.cep);
    const frete = calcularFretePorDistancia(distanciaEstimada);
    setFreteCalculado(frete);
  };
  const removerEndereco = async (id) => {
    try {
      await deleteDoc(doc(db, "enderecos", id));
      buscarEnderecosDoUsuario(); // atualiza a lista após remover
    } catch (err) {
      console.error("Erro ao remover endereço:", err);
      Alert.alert("Erro ao remover endereço");
    }
  };
  const calcularTotalCarrinho = () =>
    carrinho.reduce((sum, item) => sum + item.preco * item.quantidade, 0);

  const totalProdutos = calcularTotalCarrinho();
  const totalComFrete = (totalProdutos + freteCalculado).toFixed(2);

  const alterarQuantidade = (id, op) => {
    const novo = carrinho.map((item) => {
      if (item.id === id) {
        const qtd = op === "mais" ? item.quantidade + 1 : item.quantidade - 1;
        return { ...item, quantidade: Math.max(1, qtd) };
      }
      return item;
    });
    setCarrinho(novo);
  };

  const removerItem = (id) => {
    const atualizado = carrinho.filter((item) => item.id !== id);
    setCarrinho(atualizado);
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <Image source={{ uri: item.imagem }} style={styles.imagem} />
      <View style={styles.infoContainer}>
        <Text style={styles.nome}>{item.nome}</Text>
        <Text>R$ {item.preco.toFixed(2)}</Text>

        <View style={styles.qtdContainer}>
          <TouchableOpacity
            onPress={() => alterarQuantidade(item.id, "menos")}
            style={styles.qtdButton}
          >
            <Text>-</Text>
          </TouchableOpacity>
          <Text style={styles.qtdTexto}>{item.quantidade}</Text>
          <TouchableOpacity
            onPress={() => alterarQuantidade(item.id, "mais")}
            style={styles.qtdButton}
          >
            <Text>+</Text>
          </TouchableOpacity>
        </View>

        <Text>Total: R$ {(item.preco * item.quantidade).toFixed(2)}</Text>

        {/* ✅ Botão único de remover */}
        <TouchableOpacity
          onPress={() => removerItem(item.id)}
          style={styles.removerButton}
        >
          <Text style={styles.removerTexto}>Remover</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Endereço de Entrega</Text>
      {enderecosSalvos.length > 0 && (
        <>
          {enderecosSalvos.map((end) => (
            <View
              key={end.id}
              style={{
                padding: 8,
                borderWidth: 1,
                borderColor:
                  enderecoSelecionado?.id === end.id ? "#4CAF50" : "#ccc",
                borderRadius: 6,
                marginBottom: 6,
              }}
            >
              <Text>
                {end.endereco}, {end.numero} - {end.bairro}
              </Text>
              <Text>
                {end.cidade} - {end.estado}, CEP {end.cep}
              </Text>
              <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
                <TouchableOpacity
                  onPress={() => selecionarEndereco(end)}
                  style={{
                    backgroundColor: "#4CAF50",
                    padding: 6,
                    borderRadius: 4,
                    flex: 1,
                  }}
                >
                  <Text style={{ color: "#fff", textAlign: "center" }}>
                    Usar este endereço
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => removerEndereco(end.id)}
                  style={{
                    backgroundColor: "#e74c3c",
                    padding: 6,
                    borderRadius: 4,
                    flex: 1,
                  }}
                >
                  <Text style={{ color: "#fff", textAlign: "center" }}>
                    Apagar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}
      {!editandoEndereco ? (
        <>
          <Text>
            {enderecoUser} {numeroUser}
          </Text>
          <Text>{bairroUser}</Text>
          <TouchableOpacity onPress={() => setEditandoEndereco(true)}>
            <Text style={styles.editarEndereco}>Adicionar Novo Endereço</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            placeholder="CEP"
            style={styles.input}
            value={cep}
            keyboardType="numeric"
            onChangeText={(value) => {
              setCep(value);
              if (value.length === 8) buscarEnderecoPorCEP(value);
            }}
          />
          <TextInput
            placeholder="Número"
            style={styles.input}
            value={numeroInput}
            onChangeText={setNumeroInput}
          />
          <TextInput
            placeholder="Rua"
            style={styles.input}
            value={enderecoInput}
            editable={false}
          />
          <TextInput
            placeholder="Bairro"
            style={styles.input}
            value={bairroInput}
            editable={false}
          />
          <TextInput
            placeholder="Cidade"
            style={styles.input}
            value={cidadeInput}
            editable={false}
          />
          <TextInput
            placeholder="Estado"
            style={styles.input}
            value={estadoInput}
            editable={false}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <TouchableOpacity
              onPress={() => setEditandoEndereco(false)}
              style={[styles.button, { flex: 1, backgroundColor: "#aaa" }]}
            >
              <Text style={styles.buttonText}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={salvarEndereco}
              style={[styles.button, { flex: 1 }]}
            >
              <Text style={styles.buttonText}>Salvar Endereço</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {carrinho.length > 0 ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {Object.entries(carrinhoAgrupado).map(([fornecedor, itens]) => (
            <View key={fornecedor} style={{ marginBottom: 16 }}>
              <View
                style={{
                  padding: 8,
                  backgroundColor: "#eee",
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                }}
              >
                <Text style={{ fontWeight: "bold", color: "#4CAF50" }}>
                  📦 Fornecedor:{" "}
                  <Text style={{ fontWeight: "normal" }}>{fornecedor}</Text>
                </Text>
              </View>
              {itens.map((item) => (
                <View key={item.id} style={styles.cardItem}>
                  <TouchableOpacity style={styles.checkbox} />
                  <Image
                    source={{ uri: item.imagem }}
                    style={styles.imagemProduto}
                  />
                  <View style={styles.infoProduto}>
                    <Text style={styles.nomeProduto}>{item.nome}</Text>
                    <Text style={styles.precoProduto}>
                      Preço un: R$ {item.preco.toFixed(2)}
                    </Text>
                    <View style={styles.qtdRow}>
                      <TouchableOpacity
                        onPress={() => alterarQuantidade(item.id, "menos")}
                        style={styles.qtdBtn}
                      >
                        <Text style={styles.qtdBtnTexto}>–</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtdTexto}>{item.quantidade}</Text>
                      <TouchableOpacity
                        onPress={() => alterarQuantidade(item.id, "mais")}
                        style={styles.qtdBtn}
                      >
                        <Text style={styles.qtdBtnTexto}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => removerItem(item.id)}
                    style={styles.btnRemover}
                  >
                    <Text style={styles.qtdBtnTexto}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.empty}>Carrinho vazio</Text>
      )}

      <View style={styles.totalContainer}>
        <Text style={styles.totalText}>
          Produtos: R$ {totalProdutos.toFixed(2)}
        </Text>
        <Text style={styles.totalText}>
          Frete: R$ {freteCalculado.toFixed(2)}
        </Text>
        <Text style={styles.totalText}>Total: R$ {totalComFrete}</Text>
      </View>

      {carrinho.length > 0 && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate("Pagamento", { carrinho })}
        >
          <Text style={styles.buttonText}>Ir para Pagamento</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  itemContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 12,
    alignItems: "center",
  },
  imagem: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#eee",
  },
  infoContainer: {
    flex: 1,
  },
  nome: {
    fontSize: 18,
    fontWeight: "bold",
  },
  total: {
    fontWeight: "bold",
    marginTop: 4,
  },
  vazio: {
    fontSize: 16,
    color: "gray",
    textAlign: "center",
    marginTop: 20,
  },
  qtdContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 8,
  },
  qtdButton: {
    backgroundColor: "#ccc",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  qtdButtonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  qtdTexto: {
    fontSize: 16,
    width: 30,
    textAlign: "center",
    fontWeight: "bold",
  },
  estoqueInfo: {
    color: "gray",
    fontSize: 14,
  },
  removerBotao: {
    marginTop: 6,
    backgroundColor: "#e74c3c",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  removerTexto: {
    color: "#fff",
    fontWeight: "bold",
  },
  totalContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  totalText: {
    fontSize: 17,
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  enderecoContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  editarEndereco: {
    color: "#007bff",
    marginTop: 4,
  },
  salvarEndereco: {
    color: "#28a745",
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    marginVertical: 6,
  },
  cardItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  imagemProduto: {
    width: 55,
    height: 55,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: "#eee",
  },
  infoProduto: {
    flex: 1,
  },
  nomeProduto: {
    fontSize: 16,
    fontWeight: "600",
  },
  precoProduto: {
    fontSize: 14,
    color: "#555",
  },
  qtdRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  qtdBtn: {
    borderRadius: 20,
    backgroundColor: "#eee",
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  qtdBtnTexto: {
    fontSize: 20,
  },
  qtdTexto: {
    fontSize: 16,
    minWidth: 20,
    textAlign: "center",
  },
  btnRemover: {
    marginLeft: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ccc",
    marginRight: 8,
  },
});
