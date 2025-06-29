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
  query,
  where,
  getDocs,
  deleteDoc,
  // setDoc, // setDoc não será usado para documentos de item individuais aqui
} from "firebase/firestore";
import { hp, wp } from "../src/utils/responsive";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CarrinhoScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  // Recebe onHomeRefresh dos parâmetros da rota (vindo da HomeScreen)
  const { atualizarCarrinhoNaHome, onHomeRefresh } = route.params || {}; 
  const [carrinho, setCarrinho] = useState([]); // Agora será um array de objetos de item
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
  const [freteCalculado, setFreteCalculado] = useState(null); 
  const [enderecosSalvos, setEnderecosSalvos] = useState([]);

  // Removido: userCartDocId não é mais necessário, pois cada item é um documento

  const CEP_LOJA = "12507050"; 
  
  useEffect(() => {
    if (cep && cep.length === 8) {
      buscarEnderecoPorCEP(cep);
    }
  }, [cep]);

  const agruparPorFornecedor = (itens) => {
    if (!Array.isArray(itens)) return {};

    return itens.reduce((acc, item) => {
      // Usar nomeFornecedor se disponível, caso contrário 'fornecedor' (UID)
      // Ajuste para garantir que 'fornecedor' ou 'nomeFornecedor' sejam strings
      const fornecedorDisplay = (item.nomeFornecedor || item.fornecedor || "Desconhecido")?.toString().trim();
      if (!acc[fornecedorDisplay]) acc[fornecedorDisplay] = [];
      acc[fornecedorDisplay].push(item);
      return acc;
    }, {});
  };

  const carrinhoAgrupado = useMemo(() => {
    return agruparPorFornecedor(carrinho);
  }, [carrinho]);

  // Carregar carrinho do Firebase - agora busca múltiplos documentos de item
  const carregarCarrinho = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setCarrinho([]); 
        return;
      }

      // Query para buscar TODOS os documentos na coleção 'carrinho' que pertencem a este UID
      const q = query(collection(db, "carrinho"), where("uid", "==", uid));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) { 
        // Cada documento no snapshot é um item de carrinho
        const itemsList = snapshot.docs.map(doc => ({
          id: doc.id, // O ID do documento Firestore será o ID do item
          ...doc.data(),
          preco: Number(doc.data().preco) || 0, // Garante que preco é número
          quantidade: Number(doc.data().quantidade) || 0 // Garante que quantidade é número
        }));
        
        setCarrinho(itemsList); 
        console.log(`Carrinho carregado do Firestore. Encontrados ${itemsList.length} itens.`);
      } else {
        setCarrinho([]);
        console.log("Nenhum item encontrado no carrinho para o usuário. Carrinho local vazio.");
      }

    } catch (error) {
      console.error("Erro ao carregar carrinho:", error);
      Alert.alert("Erro", "Não foi possível carregar seu carrinho. Tente novamente.");
      setCarrinho([]); 
    }
  };

  // Função para atualizar quantidade no Firebase - agora atualiza o documento de item específico
  const atualizarQuantidadeNoFirebase = async (itemId, novaQuantidade) => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        Alert.alert("Erro", "Usuário não logado para atualizar o item.");
        return;
      }

      const itemRef = doc(db, "carrinho", itemId); // Referência direta ao documento do item
      await updateDoc(itemRef, { quantidade: Number(novaQuantidade) }); // Atualiza a quantidade
      console.log(`Quantidade do item ${itemId} atualizada para ${novaQuantidade} no Firestore.`);
      
    } catch (error) {
      console.error("Erro ao atualizar quantidade no Firebase:", error);
      Alert.alert("Erro", "Não foi possível atualizar a quantidade do item.");
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

      setCep(cepOriginal); 

      if (cepOriginal.length === 8) {
        await buscarEnderecoPorCEP(cepOriginal); 
      }
    } catch (err) {
      console.error("Erro ao carregar endereço:", err);
      setEnderecoUser("Erro ao carregar endereço.");
    }
  };

  useEffect(() => {
    if (auth.currentUser) {
      fetchEnderecoUsuario();
      buscarEnderecosDoUsuario();
    }
  }, [auth.currentUser]); 

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

      await fetchEnderecoUsuario(); 

      const uid = auth.currentUser.uid;
      const snap = await getDoc(doc(db, "users", uid));
      const data = snap.data() || {};
      const cepOriginal = data.cep || "";

      if (cepOriginal.length === 8) {
        await buscarEnderecoPorCEP(cepOriginal); 
      }
      Alert.alert("Sucesso", "Endereço removido!");
    } catch (error) {
      console.error("Erro ao remover endereço:", error);
      Alert.alert("Erro", "Erro ao remover endereço.");
    }
  };

  const calcularTotalCarrinho = () =>
    carrinho.reduce((sum, item) => sum + (item.preco || 0) * (item.quantidade || 0), 0);

  const totalProdutos = calcularTotalCarrinho();
  const taxaApp = totalProdutos * 0.02; 
  const totalComFrete = (totalProdutos + taxaApp + (freteCalculado || 0)).toFixed(2);

  const alterarQuantidade = (id, op) => {
    setCarrinho((prev) => {
      const updatedCart = prev.map((item) => {
        if (item.id === id) { // 'id' agora é o ID do documento Firestore do item
          const qtd = op === "mais" ? item.quantidade + 1 : item.quantidade - 1;
          const novaQtd = Math.max(1, qtd);

          atualizarQuantidadeNoFirebase(item.id, novaQtd); // Passa o ID do documento do item

          return { ...item, quantidade: novaQtd };
        }
        return item;
      });
      return updatedCart;
    });
  };

  // Remover item - agora deleta o documento de item específico
  const removerItem = async (itemId) => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        Alert.alert("Erro", "Usuário não logado para remover o item.");
        return;
      }

      // Referência direta ao documento do item no Firestore
      const itemRef = doc(db, "carrinho", itemId); 
      await deleteDoc(itemRef); // Deleta o documento do item

      // Atualiza o estado local do carrinho
      setCarrinho((prev) => prev.filter((item) => item.id !== itemId)); 
      Alert.alert("Sucesso", "Item removido do carrinho.");

    } catch (error) {
      console.error("Erro ao remover item do carrinho:", error);
      Alert.alert("Erro", "Não foi possível remover o item.");
    }
  };

  // Renderizar cada item do carrinho
  const renderItem = ({ item }) => {
    // Garante que preco e quantidade são números válidos para toFixed
    const preco = Number(item.preco) || 0;
    const quantidade = Number(item.quantidade) || 0;

    return (
      <View key={item.id} style={styles.itemCard}>
        <Image source={{ uri: item.imagem }} style={styles.itemImage} />
        <View style={styles.itemDetails}>
          <Text style={styles.itemName}>{item.nome}</Text>
          <Text style={styles.itemPrice}>R$ {preco.toFixed(2)}</Text> 

          <View style={styles.quantityContainer}>
            <TouchableOpacity
              onPress={() => alterarQuantidade(item.id, "menos")}
              style={styles.quantityButton}
            >
              <Text style={styles.quantityText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.quantityValue}>{quantidade}</Text> 
            <TouchableOpacity
              onPress={() => alterarQuantidade(item.id, "mais")}
              style={styles.quantityButton}
            >
              <Text style={styles.quantityText}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.totalPrice}>
            Total: R$ {(preco * quantidade).toFixed(2)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => removerItem(item.id)}
          style={styles.removeButton}
        >
          <Image source={require("../img/Minus.png")} style={styles.removeText} />
        </TouchableOpacity>
      </View>
    );
  };

  const buscarEnderecosDoUsuario = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setEnderecosSalvos([]);
        return;
      }

      const q = query(collection(db, "enderecos"), where("uid", "==", uid));
      const snap = await getDocs(q);
      const lista = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setEnderecosSalvos(lista);
    } catch (err) {
      console.error("Erro ao buscar endereços:", err);
      Alert.alert("Erro", "Não foi possível buscar endereços salvos.");
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
        setEnderecoInput("");
        setBairroInput("");
        setCidadeInput("");
        setEstadoInput("");
        setFreteCalculado(null); 
        return;
      }

      setEnderecoInput(data.logradouro || "");
      setBairroInput(data.bairro || "");
      setCidadeInput(data.localidade || "");
      setEstadoInput(data.uf || "");

      const cepNumero = parseInt(cepDigitado.replace(/\D/g, '')); 

      let novoFrete;

      if (cepNumero >= 12500001 && cepNumero <= 12505001) {
        novoFrete = 3; 
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
      setFreteCalculado(null); 
    }
  };

  const salvarEndereco = async () => {
    if (!cep || !enderecoInput || !numeroInput || !bairroInput || !cidadeInput || !estadoInput) {
      return Alert.alert("Erro", "Preencha todos os campos de endereço.");
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
      Alert.alert("Sucesso", "Endereço salvo!");
    } catch (err) {
      console.error("Erro ao salvar endereço:", err);
      Alert.alert("Erro", "Erro ao salvar endereço.");
    }
  };

  // Limpar carrinho agora deleta todos os documentos de item do usuário
  const clearCartForPaymentScreen = async () => {
    setCarrinho([]); // Limpa o estado local imediatamente
    console.log("Carrinho local limpo pela CarrinhoScreen.");

    if (auth.currentUser && auth.currentUser.uid) {
      try {
        const uid = auth.currentUser.uid;
        const q = query(collection(db, "carrinho"), where("uid", "==", uid));
        const snapshot = await getDocs(q);

        // Deleta cada documento de item individualmente
        const batchDeletes = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(batchDeletes); // Espera todas as deleções serem concluídas

        console.log(`Todos os ${snapshot.docs.length} itens do carrinho do usuário (UID: ${uid}) foram limpos no Firestore.`);
      } catch (error) {
        console.error("Erro ao limpar carrinho persistente no Firestore pela CarrinhoScreen:", error);
        Alert.alert("Erro", "Não foi possível limpar seu carrinho online. Por favor, tente novamente mais tarde.");
      }
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}> 
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.carrinho}>Carrinho</Text>
        <View style={styles.enderecoContainer}>
          <TouchableOpacity
            style={{
              flexDirection: "row",
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
                <Icon
                  name="map-marker-outline"
                  size={wp("7")}
                  color="#69A461"
                />
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
                <TouchableOpacity
                  onPress={salvarEndereco}
                  style={styles.button}
                >
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
                  <Icon name="store" size={hp("2.4")} color="gray" />{" "}
                  Fornecedor: {fornecedor}
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
          {/* Subtotal */}
          <View style={styles.resumoLinha}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Icon name="cart-outline" size={14} color="#69a461" />
              <Text style={[styles.resumoLabel, { marginLeft: 4 }]}>
                Subtotal
              </Text>
            </View>
            <Text style={styles.resumoValor}>
              {/* Garante que totalProdutos é um número antes de toFixed */}
              R$ {(Number(totalProdutos) || 0).toFixed(2)}
            </Text>
          </View>

          {/* Taxa */}
          <View style={styles.resumoLinha}>
            <TouchableOpacity
              onPress={() => Alert.alert("Taxa de Serviço", "Taxa de 2% cobrada pela plataforma")}
            >
              <Text style={styles.resumoLabel}>Taxa de Serviço (2%) ⓘ</Text>
            </TouchableOpacity>
            {/* Garante que taxaApp é um número antes de toFixed */}
            <Text style={styles.resumoValor}>R$ {(Number(taxaApp) || 0).toFixed(2)}</Text>
          </View>

          {/* Frete */}
          <View style={styles.resumoLinha}>
            <Text style={styles.resumoLabel}>Frete</Text>
            <Text
              style={[
                styles.resumoValor,
                freteCalculado === 0 && { color: "green" },
              ]}
            >
              {freteCalculado === 0
                ? "Grátis"
                : freteCalculado !== null 
                  ? `R$ ${(Number(freteCalculado) || 0).toFixed(2)}` 
                  : "---"}
            </Text>
          </View>

          {/* Total */}
          <View style={[styles.resumoLinha, styles.totalContainer]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValor}>R$ {totalComFrete}</Text>
          </View>
        </View>
        {/* Botão Ir para Pagamento */}
        {carrinho.length > 0 && (
          <TouchableOpacity
            style={styles.continuarButton}
            onPress={() =>
              navigation.navigate("Pagamento", {
                // O carrinho já está mapeado com preco/quantidade como números
                carrinho: carrinho, 
                frete: freteCalculado,
                cep: cep,
                onClearCart: clearCartForPaymentScreen, 
                onHomeRefresh: onHomeRefresh, 
              })
            }
          >
            <Text style={styles.continuarButtonText}>IR PARA PAGAMENTO</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
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
  enderecoInfo: { 
    flex: 1,
  },
  enderecoAcoes: { 
    flexDirection: "row",
    justifyContent: "space-around", 
    alignItems: "center",
    marginLeft: 10,
  },
  enderecoBotaoUsar: { 
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginRight: 5,
  },
  enderecoBotaoExcluir: { 
    backgroundColor: '#e74c3c',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  enderecoBotaoTexto: { 
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
  resumoContainer: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
  },
  resumoLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  resumoLabel: {
    color: "#555",
    fontSize: 14,
  },
  resumoValor: {
    color: "#333",
    fontSize: 14,
  },
  totalContainer: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontWeight: "bold",
    color: "#000",
  },
  totalValor: {
    fontWeight: "bold",
    color: "#000",
    fontSize: 16,
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
    width: hp("4"), 
    height: hp("4"), 
    resizeMode: 'contain', 
  },
  fornecedorGroup: {
    marginBottom: hp("2"),
    backgroundColor: "#fff",
    paddingHorizontal: wp("5"),
    paddingVertical: wp("4"),
  },
  fornecedorTitle: {
    fontSize: 16,
    fontWeight: "400",
    marginBottom: 8,
    color: "gray",
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
  botaoAdicionarEndereco: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: hp('1.5'),
  },
  formularioEndereco: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  }
});
