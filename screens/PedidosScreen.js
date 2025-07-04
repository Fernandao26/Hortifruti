import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
} from "react-native";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { wp, hp } from "../src/utils/responsive"; // Certifique-se de que estes utilitários estão configurados corretamente

const PedidosScreen = () => {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("aprovados"); // Novo estado para a aba ativa

  const navigation = useNavigation();
  const route = useRoute();

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (!user) {
        setLoading(false);
        setPedidos([]);
        Alert.alert(
          "Acesso Negado",
          "Você precisa estar logado para ver seus pedidos."
        );
        navigation.replace("Login");
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      setLoading(true);
      const q = query(
        collection(db, "pedidos"),
        where("userId", "==", currentUser.uid), // Filtra pedidos pelo UID do cliente
        orderBy("criadoEm", "desc")
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const pedidosList = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              criadoEm: data.criadoEm?.toDate
                ? data.criadoEm.toDate().toISOString()
                : data.criadoEm,
              dataAprovacao: data.dataAprovacao?.toDate
                ? data.dataAprovacao.toDate().toISOString()
                : data.dataAprovacao,
              statusAtualizadoEm: data.statusAtualizadoEm?.toDate
                ? data.statusAtualizadoEm.toDate().toISOString()
                : data.statusAtualizadoEm,
            };
          });
          setPedidos(pedidosList);
          setLoading(false);
          console.log(
            "PedidosScreen: Pedidos do usuário carregados em tempo real."
          );
        },
        (error) => {
          console.error("PedidosScreen: Erro ao carregar pedidos:", error);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    }
  }, [currentUser]);

  // Funções de verificação de status
  const isApproved = (status) =>
    ["approved", "aprovado", "success", "sucesso"].includes(
      status?.toLowerCase()
    );
  const isPending = (status) =>
    ["pending", "pendente", "pending_payment"].includes(status?.toLowerCase());
  const isCancelled = (status) =>
    ["cancelled", "cancelado", "rejected", "rejeitado"].includes(
      status?.toLowerCase()
    );

  // Filtrar pedidos para cada aba
  const pedidosAprovados = pedidos.filter((pedido) =>
    isApproved(pedido.status)
  );
  const pedidosPendentes = pedidos.filter((pedido) =>
    isPending(pedido.status)
  );
  const pedidosCancelados = pedidos.filter((pedido) =>
    isCancelled(pedido.status)
  );

  const getFilteredPedidos = () => {
    switch (activeTab) {
      case "aprovados":
        return pedidosAprovados;
      case "pendentes":
        return pedidosPendentes;
      case "cancelados":
        return pedidosCancelados;
      default:
        return [];
    }
  };

  const renderPedidoItem = ({ item }) => {
    const totalItens = item.carrinho
      ? item.carrinho.reduce((sum, cartItem) => sum + cartItem.quantidade, 0)
      : 0;

    const formatarData = (timestamp) => {
      if (!timestamp) return "N/A";
      // Certifique-se de que o timestamp é um valor válido para Date
      const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp.seconds * 1000);
      if (isNaN(date.getTime())) return "N/A"; // Verifica se a data é inválida
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    const translateStatus = (status) => {
      switch (status?.toLowerCase()) { // Use toLowerCase para garantir consistência
        case "approved":
        case "aprovado":
        case "success":
        case "sucesso":
          return "Aprovado";
        case "pending":
        case "pendente":
        case "pending_payment":
          return "Pendente";
        case "cancelled":
        case "cancelado":
        case "rejected":
        case "rejeitado":
          return "Cancelado";
        default:
          return status;
      }
    };

    let fornecedorTitleText = "";
    if (item.fornecedores && item.fornecedores.length > 0) {
      if (item.fornecedores.length === 1) {
        fornecedorTitleText = `Fornecedor: ${item.fornecedores[0]}`;
      } else {
        fornecedorTitleText = `Fornecedores: ${item.fornecedores.join(", ")}`;
      }
    } else {
      fornecedorTitleText = "Fornecedor: Desconhecido";
    }

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate("DetalhesPedido", { pedidoId: item.id })
        }
      >
        <Text style={styles.cardTitle}>{fornecedorTitleText}</Text>
        <Text style={styles.pedidoIdText}>
          {"ID do Pedido: #" + item.id.substring(0, 8)}
        </Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <Text style={[styles.infoValue, getStatusStyle(item.status)]}>
            {translateStatus(item.status)}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Total do Pedido:</Text>
          <Text style={styles.infoValue}>
            R$ {item.total?.toFixed(2) || "0.00"}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Data do Pedido:</Text>
          <Text style={styles.infoValue}>{formatarData(item.criadoEm)}</Text>
        </View>

        <Text style={styles.sectionTitle}>
          {"Itens do Pedido (" + totalItens + " total):"}
        </Text>
        {item.carrinho && item.carrinho.length > 0 ? (
          // Exibir apenas os 2 primeiros itens e depois "Ver todos"
          item.carrinho.slice(0, 2).map((cartItem, index) => (
            <View key={index} style={styles.productItem}>
              <Text style={styles.productName}>{cartItem.nome}</Text>
              <Text style={styles.productDetails}>
                {cartItem.quantidade}x - R${" "}
                {(cartItem.preco * cartItem.quantidade).toFixed(2)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noProductText}>
            Nenhum item encontrado neste pedido.
          </Text>
        )}
        {item.carrinho && item.carrinho.length > 2 && (
          <Text style={styles.detalhesLink}>Ver mais itens...</Text>
        )}

        <TouchableOpacity
          style={styles.detalhesLinkContainer}
          onPress={() =>
            navigation.navigate("DetalhesPedido", { pedidoId: item.id })
          }
        >
          <Text style={styles.detalhesLink}>Ver Todos os Itens e Detalhes →</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case "approved":
      case "success":
      case "aprovado":
      case "sucesso":
        return { color: "#0F9D58" }; // Verde
      case "pending":
      case "pendente":
      case "pending_payment":
        return { color: "#FFA500" }; // Laranja
      case "cancelled":
      case "cancelado":
      case "rejected":
      case "rejeitado":
        return { color: "#FF3D59" }; // Vermelho
      default:
        return { color: "#333" }; // Cor padrão
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>Carregando seus pedidos...</Text>
      </View>
    );
  }

  const currentPedidos = getFilteredPedidos();

  return (
    <>
      <SafeAreaView style={styles.fullScreen}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meus Pedidos</Text>
          <Text style={{ width: 40 }}></Text>
        </View>

        {/* Abas de navegação */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "aprovados" && styles.activeTab]}
            onPress={() => setActiveTab("aprovados")}
          >
            <Text style={[styles.tabText, activeTab === "aprovados" && styles.activeTabText]}>Aprovados</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "pendentes" && styles.activeTab]}
            onPress={() => setActiveTab("pendentes")}
          >
            <Text style={[styles.tabText, activeTab === "pendentes" && styles.activeTabText]}>Pendentes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "cancelados" && styles.activeTab]}
            onPress={() => setActiveTab("cancelados")}
          >
            <Text style={[styles.tabText, activeTab === "cancelados" && styles.activeTabText]}>Cancelados</Text>
          </TouchableOpacity>
        </View>

        {currentPedidos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="basket-off-outline" size={80} color="#ccc" />
            <Text style={styles.emptyText}>
              {activeTab === "aprovados" && "Nenhum pedido aprovado encontrado."}
              {activeTab === "pendentes" && "Nenhum pedido pendente encontrado."}
              {activeTab === "cancelados" && "Nenhum pedido cancelado encontrado."}
            </Text>
            <TouchableOpacity
              style={styles.buttonGoHome}
              onPress={() => navigation.navigate("Home")}
            >
              <Text style={styles.buttonText}>Fazer meu primeiro pedido!</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={currentPedidos}
            renderItem={renderPedidoItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </SafeAreaView>
       {/* Menu inferior */}
          <View style={styles.menuInferior}>
            <TouchableOpacity
              onPress={() => {
                // <-- INÍCIO DA MUDANÇA AQUI
                if (route.name !== "Home") {
                  // Verifica se a tela atual NÃO é 'HomeScreen'
                  navigation.navigate("Home"); // Só navega se não for a HomeScreen
                }
              }} // <-- FIM DA MUDANÇA AQUI
            >
              <Image
                source={require("../img/Home.png")} // Caminho para sua imagem local
                style={{ width: 24, height: 28 }}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <View style={styles.iconRow}>
              <TouchableOpacity onPress={() => navigation.navigate("Pedidos")}>
                <Image
                  source={require("../img/bolsa-de-compras.png")} // Caminho para sua imagem local
                  style={{ width: 28, height: 28 }}
                  resizeMode="contain"
                  tintColor={"#69a461"}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => navigation.navigate("Receitas")}>
              <Image
                source={require("../img/receitas.png")} // Caminho para sua imagem local
                style={{ width: 28, height: 28 }}
                resizeMode="contain"
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Dicas")}>
              <Image
                source={require("../img/idea.png")} // Caminho para sua imagem local
                style={{ width: 28, height: 28 }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
    </>
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
  buttonGoHome: {
    backgroundColor: "#69A461",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    marginTop: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  listContainer: {
    padding: 16,
    paddingBottom: hp("10%"), // Espaço extra para o menu inferior
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#333",
  },
  pedidoIdText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  detalhesLinkContainer: { // Novo estilo para o TouchableOpacity
    marginTop: 10,
    alignSelf: 'flex-end', // Alinha à direita
  },
  detalhesLink: {
    color: "#007AFF",
    textAlign: "right",
    textDecorationLine: "underline",
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
    color: "#333",
  },
  productItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  productName: {
    fontSize: 14,
    color: "#555",
    flex: 2,
  },
  productDetails: {
    fontSize: 14,
    color: "#555",
    textAlign: "right",
    flex: 1,
  },
  noProductText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
  },
  menuInferior: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#ccc",
    marginBottom: hp("5%"), // Ajuste se for fixo na parte inferior da tela
  },
  // Novos estilos para as abas
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 10,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: "#69A461", // Cor de fundo para a aba ativa
  },
  tabText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#666",
  },
  activeTabText: {
    color: "#fff", // Cor do texto para a aba ativa
  },
});

export default PedidosScreen;