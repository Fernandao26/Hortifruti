import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const VendasScreen = () => {
  const [vendasAprovadas, setVendasAprovadas] = useState([]);
  const [vendasPendentes, setVendasPendentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState("aprovadas"); 
  const navigation = useNavigation();
  const [currentFornecedorId, setCurrentFornecedorId] = useState(null);
  const isApproved = (status) =>
    ["approved", "aprovado", "success", "sucesso"].includes(
      status?.toLowerCase()
    );
  
  const isPending = (status) =>
    ["pending", "pendente", "pending_payment"].includes(
      status?.toLowerCase()
    );
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentFornecedorId(user.uid);
        console.log("VendasScreen: Fornecedor logado UID:", user.uid);
      } else {
        console.log("VendasScreen: Nenhum fornecedor logado.");
        Alert.alert(
          "Acesso Negado",
          "Por favor, faça login como fornecedor para ver suas vendas."
        );
        setLoading(false);
        navigation.navigate("Login");
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!currentFornecedorId) {
      setLoading(false);
      return;
    }
  
    console.log("Buscando vendas para currentFornecedorId:", currentFornecedorId); 
  
    const q = query(
      collection(db, "pedidos"),
      where("status", "in", ["approved", "pending"])
    );
  
    const unsubscribeFirestore = onSnapshot(
      q,
      async (snapshot) => {
        const aprovadasTemp = [];
        const pendentesTemp = [];
        const productPromises = [];
  
        console.log("Total de pedidos buscados no Firestore:", snapshot.docs.length); 
  
        snapshot.docs.forEach((docPedido) => {
          const pedidoData = docPedido.data();
          console.log(`Processando pedido ID: ${docPedido.id}, Status: ${pedidoData.status}`); 
          const dataPedido = pedidoData.criadoEm?.toDate ? pedidoData.criadoEm.toDate() : new Date();
  
          if (pedidoData.carrinho && Array.isArray(pedidoData.carrinho)) {
            pedidoData.carrinho.forEach((itemCarrinho) => {
              const productId = itemCarrinho.produtoId || itemCarrinho.id;
              if (!productId) {
                  console.warn("ID do produto ausente no item do carrinho:", itemCarrinho);
                  return; // Pula se não houver ID do produto
              }
              const promise = getDoc(doc(db, "produtos", productId))
                .then((docProduto) => {
                  if (docProduto.exists()) {
                    const produtoData = docProduto.data();
                    console.log(`  Verificando produto ID: ${productId}, UID do Fornecedor do Produto: ${produtoData.fornecedor_uid}, UID do Fornecedor Atual: ${currentFornecedorId}`); // Adicione este log crucial
  
                    if (produtoData.fornecedor_uid === currentFornecedorId) {
                      const vendaItem = {
                        id: `${docPedido.id}-${productId}`,
                        nomeProduto: itemCarrinho.nome,
                        quantidade: itemCarrinho.quantidade,
                        precoUnitario: itemCarrinho.preco,
                        imageUrl: itemCarrinho.imagem,
                        dataPedido: dataPedido,
                        statusPedido: pedidoData.status || "Desconhecido",
                        fornecedorNome: itemCarrinho.fornecedor,
                        clienteEmail: pedidoData.emailCliente,
                        nomeCliente: pedidoData.nomeCliente,
                      };
                      console.log(`    Item de venda encontrado para o fornecedor atual. Status: ${vendaItem.statusPedido}`); // Adicione isso
                      if (isApproved(vendaItem.statusPedido)) {
                        aprovadasTemp.push(vendaItem);
                      } else if (isPending(vendaItem.statusPedido)) {
                        pendentesTemp.push(vendaItem);
                      }
                    } else {
                      console.log(`    UID do fornecedor do produto (${produtoData.fornecedor_uid}) NÃO corresponde ao UID do fornecedor atual (${currentFornecedorId}). Pulando item de venda.`); // Adicione isso
                    }
                  } else {
                    console.log(`  Produto não encontrado para o ID: ${productId}`); 
                  }
                })
                .catch((error) => {
                  console.error(
                    "Erro ao buscar detalhes do produto para item do carrinho:",
                    productId,
                    error
                  );
                });
              productPromises.push(promise);
            });
          } else {
            console.log(`Pedido ${docPedido.id} não possui um array 'carrinho' válido.`); 
          }
        });
  
        await Promise.all(productPromises);
  
        aprovadasTemp.sort(
          (a, b) => b.dataPedido.getTime() - a.dataPedido.getTime()
        );
        pendentesTemp.sort(
          (a, b) => b.dataPedido.getTime() - a.dataPedido.getTime()
        );
  
        setVendasAprovadas(aprovadasTemp);
        setVendasPendentes(pendentesTemp);
        setLoading(false);
  
        console.log(
          "Contagem Final de Vendas - Aprovadas:",
          aprovadasTemp.length,
          "Pendentes:",
          pendentesTemp.length
        );
      },
      (error) => {
        console.error("VendasScreen: Erro ao carregar vendas:", error);
        setLoading(false);
        Alert.alert("Erro", "Não foi possível carregar as vendas.");
      }
    );
  
    return () => unsubscribeFirestore();
  }, [currentFornecedorId]);

  const renderVendaItem = ({ item }) => (
    <View style={styles.card}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.productImage} />
      ) : (
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderText}>{"Sem Imagem"}</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.productName}>{item.nomeProduto}</Text>
        <Text style={styles.productDetails}>
          {"Qtde: "}
          {item.quantidade}
        </Text>
        <Text style={styles.productDetails}>
          {"Preço Un.: R$ "}
          {item.precoUnitario?.toFixed(2).replace(".", ",")}
        </Text>
        <Text style={styles.productDetails}>
          {"Total: R$ "}
          {((item.quantidade || 0) * (item.precoUnitario || 0))
            ?.toFixed(2)
            .replace(".", ",")}
        </Text>
        <Text style={styles.orderDateTime}>
          {"Pedido em: "}
          {item.dataPedido
            ? item.dataPedido.toLocaleDateString("pt-BR")
            : "N/A"}{" "}
          {"às "}
          {item.dataPedido
            ? item.dataPedido.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </Text>
        <Text
          style={[
            styles.orderStatus,
            item.statusPedido === "approved"
              ? styles.statusApproved
              : styles.statusPending,
          ]}
        >
          {"Status: "}
          {item.statusPedido}
        </Text>
        <Text style={styles.customerInfo}>
          {"Cliente: "}
          {item.nomeCliente || item.clienteEmail || "N/A"}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#69A461" />
        <Text>{"Carregando vendas..."}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.fullScreen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image
            source={require("../img/Left2.png")}
            style={{
              width: 30,
              height: 30,
            }}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{"Minhas Vendas"}</Text>
        <Text style={{ width: 40 }}></Text>
      </View>
      {/* Abas para alternar entre Aprovados e Pendentes */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            currentTab === "aprovadas" && styles.tabButtonActive,
          ]}
          onPress={() => setCurrentTab("aprovadas")}
        >
          <Text
            style={[
              styles.tabText,
              currentTab === "aprovadas" && styles.tabTextActive,
            ]}
          >
            {"Aprovadas"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            currentTab === "pendentes" && styles.tabButtonActive,
          ]}
          onPress={() => setCurrentTab("pendentes")}
        >
          <Text
            style={[
              styles.tabText,
              currentTab === "pendentes" && styles.tabTextActive,
            ]}
          >
            {"Pendentes"}
          </Text>
        </TouchableOpacity>
      </View>
      {currentTab === "aprovadas" ? (
        vendasAprovadas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="tag-off-outline" size={80} color="#ccc" />
            <Text style={styles.emptyText}>
              {"Nenhuma venda aprovada encontrada para você."}
            </Text>
            <Text style={styles.emptySubText}>
              {"Aguarde novos pedidos aprovados!"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={vendasAprovadas}
            renderItem={renderVendaItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
          />
        )
      ) : (
        vendasPendentes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="timer-sand" size={80} color="#ccc" />
            <Text style={styles.emptyText}>
              {"Nenhum pedido pendente para você."}
            </Text>
            <Text style={styles.emptySubText}>
              {"Aguarde a aprovação de novos pedidos!"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={vendasPendentes}
            renderItem={renderVendaItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
          />
        )
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#007AFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
    marginTop: 20,
    textAlign: "center",
  },
  emptySubText: {
    fontSize: 14,
    color: "#999",
    marginTop: 5,
    textAlign: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabButtonActive: {
    borderBottomColor: "#69A461",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  tabTextActive: {
    color: "#69A461",
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 15,
    backgroundColor: "#eee",
  },
  placeholderImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 15,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 10,
    color: "#888",
    textAlign: "center",
  },
  cardContent: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#333",
  },
  productDetails: {
    fontSize: 14,
    color: "#666",
    marginBottom: 3,
  },
  orderDateTime: {
    fontSize: 12,
    color: "#999",
    marginTop: 5,
  },
  orderStatus: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 5,
  },
  statusApproved: {
    color: "#28a745",
  },
  statusPending: {
    color: "#ffc107",
  },
  customerInfo: {
    fontSize: 12,
    color: "#888",
    marginTop: 5,
  },
});

export default VendasScreen;