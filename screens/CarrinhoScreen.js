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
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
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
  const [carrinhoAgrupado, setCarrinhoAgrupado] = useState({});
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

  useEffect(() => {
    buscarEnderecosDoUsuario();
    if (Array.isArray(carrinhoInicial)) {
      setCarrinho([...carrinhoInicial]);
      setCarrinhoAgrupado(agruparPorFornecedor(carrinhoInicial));
    }
  }, [JSON.stringify(carrinhoInicial)]);

  useEffect(() => {
    setCarrinhoAgrupado(agruparPorFornecedor(carrinho));
  }, [carrinho]);

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

      const distanciaEstimada = estimarDistanciaPorCep(CEP_LOJA, cepDigitado);
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
    <View key={item.id} style={styles.itemContainer}>
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
          <Text style={styles.removerTexto}>🗑️ Remover</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Seção de Endereço */}
      <Text style={styles.title}>Endereço de Entrega</Text>
      {enderecosSalvos.length > 0 &&
        enderecosSalvos.map((end) => (
          <View key={end.id} style={styles.enderecoCard}>
            <Text>{`${end.endereco}, ${end.numero} - ${end.bairro}`}</Text>
            <Text>{`${end.cidade} - ${end.estado}, CEP ${end.cep}`}</Text>
            <View style={styles.enderecoActions}>
              <TouchableOpacity
                onPress={() => selecionarEndereco(end)}
                style={styles.usarBtn}
              >
                <Text style={styles.btnText}>Usar este endereço</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removerEndereco(end.id)}
                style={styles.apagarBtn}
              >
                <Text style={styles.btnText}>Apagar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

      {!editandoEndereco ? (
        <>
          <Text>{`${enderecoUser} ${numeroUser}`}</Text>
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

          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={() => setEditandoEndereco(false)}
              style={[styles.button, { backgroundColor: "#aaa" }]}
            >
              <Text style={styles.buttonText}>Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={salvarEndereco}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Salvar Endereço</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Lista de Produtos por Fornecedor */}
      {Object.entries(carrinhoAgrupado).map(([fornecedor, itens]) => (
        <View key={fornecedor} style={styles.fornecedorGroup}>
          <Text style={styles.fornecedorTitle}>🧺 Fornecedor: {fornecedor}</Text>
          {itens.map((item) => renderItem({ item }))}
        </View>
      ))}

      {/* Resumo do Carrinho */}
      <View style={styles.resumoContainer}>
        <Text style={styles.resumoLabel}>Subtotal:</Text>
        <Text style={styles.resumoValor}>R$ {totalProdutos.toFixed(2)}</Text>

        <Text style={styles.resumoLabel}>Frete:</Text>
        <Text style={styles.resumoValor}>R$ {freteCalculado.toFixed(2)}</Text>

        <Text style={styles.resumoLabel}>Total:</Text>
        <Text style={styles.resumoValor}>R$ {totalComFrete}</Text>
      </View>

      {/* Botão Ir para Pagamento */}
      {carrinho.length > 0 && (
        <TouchableOpacity
          style={styles.continuarButton}
          onPress={() => navigation.navigate("Pagamento", { carrinho })}
        >
          <Text style={styles.continuarButtonText}>IR PARA PAGAMENTO</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// Estilos
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  enderecoCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 12,
  },
  enderecoActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  usarBtn: {
    flex: 1,
    marginRight: 6,
    backgroundColor: "#4CAF50",
    paddingVertical: 6,
    borderRadius: 4,
  },
  apagarBtn: {
    flex: 1,
    marginLeft: 6,
    backgroundColor: "#e74c3c",
    paddingVertical: 6,
    borderRadius: 4,
  },
  btnText: {
    color: "#fff",
    textAlign: "center",
  },
  editarEndereco: {
    color: "#007bff",
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    marginVertical: 6,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
  },
  button: {
    flex: 1,
    backgroundColor: "#4CAF50",
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#eee",
    paddingVertical: 12,
    marginBottom: 12,
  },
  imagem: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  infoContainer: {
    flex: 1,
  },
  nome: {
    fontSize: 16,
    fontWeight: "bold",
  },
  qtdContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  qtdButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#eee",
    borderRadius: 4,
  },
  qtdTexto: {
    marginHorizontal: 8,
    fontWeight: "bold",
  },
  removerButton: {
    position: "absolute",
    right: 8,
    top: 8,
    backgroundColor: "#e74c3c",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  removerTexto: {
    color: "#fff",
  },
  resumoContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    elevation: 2,
  },
  resumoLabel: {
    fontSize: 16,
    fontWeight: "bold",
  },
  resumoValor: {
    fontSize: 16,
    marginBottom: 8,
  },
  continuarButton: {
    marginTop: 20,
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  continuarButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  fornecedorGroup: {
    marginBottom: 20,
  },
  fornecedorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
});
