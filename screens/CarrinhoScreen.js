import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  const [freteCalculado, setFreteCalculado] = useState(7); // Frete fixo R$ 7,00;
  const [enderecosSalvos, setEnderecosSalvos] = useState([]);

  const CEP_LOJA = "12507050";

  // Função para agrupar os produtos por fornecedor
  const agruparPorFornecedor = (itens) => {
    if (!Array.isArray(itens)) return {};

    return itens.reduce((acc, item) => {
      const fornecedor = item.fornecedor || "Desconhecido";
      if (!acc[fornecedor]) acc[fornecedor] = [];
      acc[fornecedor].push(item);
      return acc;
    }, {});
  };

  const carrinhoAgrupado = useMemo(() => {
    return agruparPorFornecedor(carrinho);
  }, [carrinho]);

  // Carregar carrinho do Firebase ao abrir ou focar a tela
  const carregarCarrinho = async () => {
    try {
      const snapshot = await getDocs(collection(db, "carrinho"));
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCarrinho(lista);
    } catch (error) {
      console.error("Erro ao carregar carrinho:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      carregarCarrinho(); // Recarrega carrinho sempre que a tela for aberta
    }, [])
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

  const selecionarEndereco = (end) => {
    setEnderecoUser(end.endereco);
    setNumeroUser(end.numero);
    setBairroUser(end.bairro);
    setCidadeInput(end.cidade);
    setEstadoInput(end.estado);
    setCep(end.cep);
  };

  const removerEndereco = async (id) => {
    try {
      await deleteDoc(doc(db, "enderecos", id));
      buscarEnderecosDoUsuario();
    } catch (error) {
      console.error("Erro ao remover endereço:", error);
      Alert.alert("Erro ao remover endereço");
    }
  };

  const calcularTotalCarrinho = () =>
    carrinho.reduce((sum, item) => sum + item.preco * item.quantidade, 0);

  const totalProdutos = calcularTotalCarrinho();
  const totalComFrete = (totalProdutos + freteCalculado).toFixed(2);

  const alterarQuantidade = (id, op) => {
    setCarrinho((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const qtd = op === "mais" ? item.quantidade + 1 : item.quantidade - 1;
          return { ...item, quantidade: Math.max(1, qtd) };
        }
        return item;
      })
    );
  };

  const removerItem = async (itemId) => {
    try {
      // Remover do estado local
      const atualizado = carrinho.filter((item) => item.id !== itemId);
      setCarrinho(atualizado);

      // Remover do Firestore
      await deleteDoc(doc(db, "carrinho", itemId));
    } catch (error) {
      console.error("Erro ao remover item do carrinho:", error);
      Alert.alert("Erro", "Não foi possível remover o item.");
    }
  };

  // Renderizar cada item do carrinho
  const renderItem = ({ item }) => (
    <View key={item.id} style={styles.itemCard}>
      <Image source={{ uri: item.imagem }} style={styles.itemImage} />
      <View style={styles.itemDetails}>
        <Text style={styles.itemName}>{item.nome}</Text>
        <Text style={styles.itemPrice}>R$ {item.preco.toFixed(2)}</Text>

        {/* Controle de Quantidade */}
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            onPress={() => alterarQuantidade(item.id, "menos")}
            style={styles.quantityButton}
          >
            <Text style={styles.quantityText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.quantityValue}>{item.quantidade}</Text>
          <TouchableOpacity
            onPress={() => alterarQuantidade(item.id, "mais")}
            style={styles.quantityButton}
          >
            <Text style={styles.quantityText}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.totalPrice}>
          Total: R$ {(item.preco * item.quantidade).toFixed(2)}
        </Text>
      </View>

      {/* Botão de Remover */}
      <TouchableOpacity
        onPress={() => removerItem(item.id)}
        style={styles.removeButton}
      >
        <Text style={styles.removeText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  const buscarEnderecosDoUsuario = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const q = query(collection(db, "enderecos"), where("uid", "==", uid));
      const snap = await getDocs(q);
      const lista = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setEnderecosSalvos(lista);
    } catch (err) {
      console.error("Erro ao buscar endereços:", err);
    }
  };

  const buscarEnderecoPorCEP = async (cepDigitado) => {
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepDigitado}/json/`); 
      const data = await response.json();
      if (data.erro) {
        Alert.alert("CEP não encontrado");
        return;
      }

      setEnderecoInput(data.logradouro || "");
      setBairroInput(data.bairro || "");
      setCidadeInput(data.localidade || "");
      setEstadoInput(data.uf || "");

      const distanciaEstimada =
        parseInt(CEP_LOJA.substring(0, 5)) - parseInt(cepDigitado.substring(0, 5));
      const frete = Math.max(0, Math.ceil(Math.abs(distanciaEstimada) / 4) * 10);
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
        uid,
        cep,
        endereco: enderecoInput,
        numero: numeroInput,
        bairro: bairroInput,
        cidade: cidadeInput,
        estado: estadoInput,
        criadoEm: new Date(),
      });
      setEditandoEndereco(false);
      buscarEnderecosDoUsuario();
    } catch (err) {
      console.error("Erro ao salvar endereço:", err);
      Alert.alert("Erro ao salvar endereço");
    }
  };

  useEffect(() => {
    if (auth.currentUser) {
      fetchEnderecoUsuario();
      buscarEnderecosDoUsuario();
    }
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
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
        <Text>{`${enderecoUser}, ${numeroUser}, ${bairroUser}`}</Text>
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

    {/* Lista de Produtos Agrupados */}
    {Object.entries(carrinhoAgrupado || {}).length > 0 ? (
      Object.entries(carrinhoAgrupado || {}).map(([fornecedor, itens]) => (
        <View key={fornecedor} style={styles.fornecedorGroup}>
          <Text style={styles.fornecedorTitle}>
            🧺 Fornecedor: {fornecedor}
          </Text>
          {itens.map((item) => renderItem({ item: item }))}
        </View>
      ))
    ) : (
      <Text style={styles.emptyCart}>Seu carrinho está vazio.</Text>
    )}

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
  scrollContent: {
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
  itemCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    alignItems: "center",
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  itemPrice: {
    color: "#555",
    marginVertical: 4,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  quantityButton: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eee",
    borderRadius: 12,
  },
  quantityText: {
    fontWeight: "bold",
  },
  quantityValue: {
    marginHorizontal: 10,
    fontWeight: "bold",
  },
  totalPrice: {
    marginTop: 6,
    fontWeight: "bold",
    color: "#333",
  },
  removeButton: {
    marginLeft: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  removeText: {
    color: "#e74c3c",
    fontSize: 18,
  },
  fornecedorGroup: {
    marginBottom: 20,
    backgroundColor: "#f8f8f8",
    padding: 12,
    borderRadius: 8,
  },
  fornecedorTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
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
  emptyCart: {
    fontStyle: "italic",
    color: "#888",
    textAlign: "center",
    marginVertical: 20,
  },
});