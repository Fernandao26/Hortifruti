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
import { hp, wp } from "../src/utils/responsive";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
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
  const [freteCalculado, setFreteCalculado] = useState(null); // Frete fixo R$ 7,00;
  const [enderecosSalvos, setEnderecosSalvos] = useState([]);

  const CEP_LOJA = "12507050";
  useEffect(() => {
    if (cep && cep.length === 8) {
      buscarEnderecoPorCEP(cep);
    }
  }, [cep]);
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

  // Carregar carrinho do Firebase
  const carregarCarrinho = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const q = query(collection(db, "carrinho"), where("uid", "==", uid));
      const snapshot = await getDocs(q);

      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCarrinho(lista);
    } catch (error) {
      console.error("Erro ao carregar carrinho:", error);
    }
  };
  // Função para atualizar quantidade no Firebase
  const atualizarQuantidadeNoFirebase = async (itemId, novaQuantidade) => {
    try {
      const itemRef = doc(db, "carrinho", itemId);
      await updateDoc(itemRef, {
        quantidade: novaQuantidade,
      });
    } catch (error) {
      console.error("Erro ao atualizar quantidade:", error);
    }
  };
  useFocusEffect(
    useCallback(() => {
      carregarCarrinho();
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

      const cepOriginal = data.cep || "";

      setCep(cepOriginal); // ✅ Atualiza o estado `cep` com o original

      if (cepOriginal.length === 8) {
        await buscarEnderecoPorCEP(cepOriginal); // ✅ Recalcula o frete com o CEP original
      }
    } catch (err) {
      console.error("Erro ao carregar endereço:", err);
    }
  };
  useEffect(() => {
    if (auth.currentUser) {
      fetchEnderecoUsuario();
    }
  }, []);

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
      await buscarEnderecosDoUsuario();

      // Força recarregar o CEP original do usuário
      await fetchEnderecoUsuario(); // ✅ Atualiza o CEP do usuário

      // Garante que o frete seja recalculado com o CEP original
      const uid = auth.currentUser.uid;
      const snap = await getDoc(doc(db, "users", uid));
      const data = snap.data() || {};
      const cepOriginal = data.cep || "";

      if (cepOriginal.length === 8) {
        await buscarEnderecoPorCEP(cepOriginal); // ✅ Frete calculado com CEP original
      }
    } catch (error) {
      console.error("Erro ao remover endereço:", error);
      Alert.alert("Erro ao remover endereço");
    }
  };

  const calcularTotalCarrinho = () =>
    carrinho.reduce((sum, item) => sum + item.preco * item.quantidade, 0);

  const totalProdutos = calcularTotalCarrinho();
  const taxaApp = totalProdutos * 0.02; // 2% do subtotal
  const totalComFrete = (totalProdutos + taxaApp + freteCalculado).toFixed(2);

  // Função chamada pelos botões "+" e "-"
  const alterarQuantidade = (id, op) => {
    setCarrinho((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const qtd = op === "mais" ? item.quantidade + 1 : item.quantidade - 1;
          const novaQtd = Math.max(1, qtd);

          // Atualiza no Firebase
          atualizarQuantidadeNoFirebase(id, novaQtd);

          return { ...item, quantidade: novaQtd };
        }
        return item;
      })
    );
  };
  const removerItem = async (itemId) => {
    try {
      await deleteDoc(doc(db, "carrinho", itemId));
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
        <Image source={require("../img/Minus.png")} style={styles.removeText} />
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

      // Converter CEP para número
      const cepNumero = parseInt(cepDigitado);

      let novoFrete;

      if (cepNumero >= 12500001 && cepNumero <= 12505001) {
        novoFrete = 3; // Frete grátis
      } else if (cepNumero >= 12505002 && cepNumero <= 12510001) {
        novoFrete = 5;
      } else if (cepNumero >= 12510002 && cepNumero <= 12515001) {
        novoFrete = 10;
      } else if (cepNumero >= 12515002 && cepNumero <= 12520001) {
        novoFrete = 15;
      } else if (cepNumero >= 12520002 && cepNumero <= 12524999) {
        novoFrete = 20;
      } else {
        Alert.alert("CEP fora da área de entrega");
        novoFrete = 40;
      }

      setFreteCalculado(novoFrete);
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
      <Text style={styles.carrinho}>Carrinho</Text>
      <View style={styles.enderecoContainer}>
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",

            alignItems: "center",
            marginBottom: hp("0.7"),
          }}
        >
          <Text style={styles.title}>Endereço de Entrega </Text>
          <Icon name="home-city-outline" size={wp("6")} color="#69A461" />
        </TouchableOpacity>
        {/* Exibe endereços salvos */}
        {enderecosSalvos.length > 0
          ? enderecosSalvos.map((end) => (
              <View key={end.id} style={styles.enderecoCard}>
                <View style={styles.enderecoInfo}>
                  <Text style={styles.enderecoTexto}>
                    {end.endereco}, {end.numero}
                  </Text>
                  <Text style={styles.enderecoTexto}>{end.bairro}</Text>
                  <Text style={styles.enderecoTexto}>
                    {end.cidade} - {end.estado}, CEP {end.cep}
                  </Text>
                </View>
                <View style={styles.enderecoAcoes}>
                  <TouchableOpacity
                    style={styles.enderecoBotaoUsar}
                    onPress={() => selecionarEndereco(end)}
                  >
                    <Text style={styles.enderecoBotaoTexto}>Usar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.enderecoBotaoExcluir}
                    onPress={() => removerEndereco(end.id)}
                  >
                    <Text style={styles.enderecoBotaoTexto}>Excluir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          : null}
        {/* Mostra o endereço padrão do usuário */}
        {!editandoEndereco && !enderecosSalvos.length ? (
          <View style={styles.enderecoDefault}>
            <View>
              <Icon name="map-marker-outline" size={wp("7")} color="#69A461" />
            </View>
            <Text
              style={styles.enderecoTexto}
            >{`${enderecoUser}, ${numeroUser}, ${bairroUser}`}</Text>
          </View>
        ) : null}
        {/* Botão para adicionar novo endereço */}
        {!editandoEndereco && !enderecosSalvos.length ? (
          <TouchableOpacity
            style={styles.botaoAdicionarEndereco}
            onPress={() => setEditandoEndereco(true)}
          >
            <Text style={{ color: "#007bff", paddingLeft: hp(3.5) }}>
              + Adicionar novo endereço
            </Text>
          </TouchableOpacity>
        ) : null}
        {/* Formulário de edição de endereço */}
        {editandoEndereco && (
          <View style={styles.formularioEndereco}>
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
                style={[styles.button, { backgroundColor: "#ccc" }]}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={salvarEndereco} style={styles.button}>
                <Text style={styles.buttonText}>Salvar Endereço</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View
        style={{
          backgroundColor: "#d3d3d3",
          marginHorizontal: wp("-4"),
          marginTop: hp("1"),
          paddingTop: hp("2"),
        }}
      >
        {Object.entries(carrinhoAgrupado).length > 0 ? (
          Object.entries(carrinhoAgrupado).map(([fornecedor, itens]) => (
            <View key={fornecedor} style={styles.fornecedorGroup}>
              <Text style={styles.fornecedorTitle}>
                🧺 Fornecedor: {fornecedor}
              </Text>
              {itens.map((item) => renderItem({ item }))}
            </View>
          ))
        ) : (
          <Text style={styles.emptyCart}>Seu carrinho está vazio.</Text>
        )}
      </View>
      {/* Resumo do Carrinho */}
      <View style={styles.resumoContainer}>
        <Text style={styles.resumoLabel}>Subtotal:</Text>
        <Text style={styles.resumoValor}>R$ {totalProdutos.toFixed(2)}</Text>
        <Text style={styles.resumoLabel}>Taxa de Serviço(2%):</Text>
        <Text style={styles.resumoValor}>R$ {taxaApp.toFixed(2)}</Text>
        <Text style={styles.resumoLabel}>Frete:</Text>
        <Text style={styles.resumoValor}>
          R$ {freteCalculado !== null ? freteCalculado.toFixed(2) : "---"}
        </Text>
        <Text style={styles.resumoLabel}>Total:</Text>
        <Text style={styles.resumoValor}>R$ {totalComFrete}</Text>
      </View>
      {/* Botão Ir para Pagamento */}
      {carrinho.length > 0 && (
        <TouchableOpacity
          style={styles.continuarButton}
          onPress={() =>
            navigation.navigate("Pagamento", {
              carrinho,
              frete: freteCalculado,
              cep: cep,
            })
          }
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
    padding: wp("4"),
    backgroundColor: "#fff",
  },
  title: {
    fontSize: hp("1.8"),
    fontWeight: "bold",
    paddingHorizontal: hp("0.5"),
    paddingVertical: "auto",
  },
  carrinho: {
    fontSize: hp("2.8"),
    fontWeight: "bold",
    textAlign: "center",
    marginTop: hp("2.8"),
    marginBottom: hp("1.6"),
  },

  enderecoCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "blue",
  },
  enderecoActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "blue",
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
  enderecoDefault: {
    flexDirection: "row",
    marginBottom: hp("1"),
  },
  enderecoTexto: {
    paddingLeft: hp("1"),
    paddingRight: hp("8"),
    color: "gray",
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
    marginBottom: hp("1"),
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
    fontSize: hp("4"),
  },
  fornecedorGroup: {
    marginBottom: hp("2"),
    backgroundColor: "#fff",
    paddingHorizontal: wp("5"),
    paddingVertical: wp("4"),
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
