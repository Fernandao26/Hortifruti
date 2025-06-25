import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  Clipboard,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

import { auth, db, functions } from "../firebaseConfig";

import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { SafeAreaView } from "react-native-safe-area-context";

const PagamentoScreen = ({ route }) => {
  const { carrinho, frete, cep } = route.params || {};
  const navigation = useNavigation();

  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [idToken, setIdToken] = useState(null); // Novo estado para o token ID
  const [metodoPagamento, setMetodoPagamento] = useState("Pix");
  const [enderecoCompleto, setEnderecoCompleto] = useState("");
  const [usuarioDataFromFirestore, setUsuarioDataFromFirestore] =
    useState(null);
  const [qrCodePix, setQrCodePix] = useState(null);

  const calcularSubtotal = () =>
    carrinho.reduce((sum, item) => sum + item.preco * item.quantidade, 0);

  const taxaServico = calcularSubtotal() * 0.02;
  const freteCalculado = typeof frete === "number" ? frete : 7;
  const totalFinal = (
    calcularSubtotal() +
    freteCalculado +
    taxaServico
  ).toFixed(2);

  const fornecedoresUnicos = Array.from(
    new Set(
      carrinho.map(
        (item) => item.nomeFornecedor || item.fornecedor || "Desconhecido"
      )
    )
  );

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        console.log(
          "PagamentoScreen: onAuthStateChanged - Usuário logado detectado:",
          user.email,
          "UID:",
          user.uid
        );

        try {
          const tokenResult = await user.getIdTokenResult(true);
          setIdToken(tokenResult.token);
          console.log(
            "PagamentoScreen: Token ID obtido:",
            tokenResult.token.substring(0, 30) + "..."
          );
        } catch (tokenError) {
          console.error(
            "PagamentoScreen: Erro ao obter token ID no onAuthStateChanged:",
            tokenError
          );
          setIdToken(null);
        }

        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUsuarioDataFromFirestore(data);
            const fullAddress = `${data.endereco}, ${data.numero} - ${data.bairro}\n${data.cidade} - ${data.estado}, CEP ${data.cep}`;
            setEnderecoCompleto(fullAddress);
          } else {
            console.warn(
              "PagamentoScreen: Documento do usuário não encontrado no Firestore para UID:",
              user.uid
            );
          }
        } catch (error) {
          console.error(
            "PagamentoScreen: Erro ao carregar dados do usuário do Firestore:",
            error
          );
        }
      } else {
        console.warn(
          "PagamentoScreen: Nenhum usuário logado. Botão de finalizar desabilitado."
        );
        setCurrentUser(null);
        setIdToken(null);
        setUsuarioDataFromFirestore(null);
        setEnderecoCompleto("");
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const finalizarPedido = async () => {
    console.log("PagamentoScreen: Finalizar Pedido clicado.");
    console.log(
      "PagamentoScreen: currentUser (estado local):",
      currentUser ? currentUser.uid : "NÃO DEFINIDO/LOGADO"
    );

    if (isProcessingOrder) {
      console.warn("Pedido já está sendo processado.");
      return;
    }
    if (!currentUser || !idToken) {
      Alert.alert(
        "Erro de Login",
        "Você precisa estar logado para finalizar o pedido. Por favor, faça login ou cadastre-se e aguarde a validação."
      );
      console.error(
        "Tentativa de finalizar pedido sem usuário logado ou token ID."
      );
      return;
    }

    setIsProcessingOrder(true);

    try {
      const pedidoRef = await addDoc(collection(db, "pedidos"), {
        userId: currentUser.uid,
        fornecedores: fornecedoresUnicos,
        carrinho: carrinho,
        subtotal: parseFloat(calcularSubtotal().toFixed(2)),
        frete: freteCalculado,
        taxaServico: taxaServico, // <<-- CORRIGIDO AQUI
        total: parseFloat(totalFinal),
        formaPagamento: metodoPagamento,
        status: "Pendente",
        criadoEm: new Date(),
        nomeCliente:
          currentUser.displayName ||
          (usuarioDataFromFirestore
            ? usuarioDataFromFirestore.nome
            : "Cliente"),
        emailCliente: currentUser.email,
        enderecoEntrega: enderecoCompleto,
      });
      const orderId = pedidoRef.id;

      console.log("Pedido salvo no Firestore com ID:", orderId);

      // --- LIMPANDO O CARRINHO PARA ENVIO À CLOUD FUNCTION ---
      const cleanedCarrinho = carrinho.map((item) => {
        const newItem = { ...item };
        if (
          newItem.timestamp instanceof Object &&
          "seconds" in newItem.timestamp
        ) {
          newItem.timestamp = newItem.timestamp.toDate().toISOString();
        } else if (newItem.timestamp) {
          delete newItem.timestamp;
        }
        return newItem;
      });
      // --- FIM DA LIMPEZA ---

      const callCriarPixHortifruti = httpsCallable(
        functions,
        "criarPixHortifruti"
      );

      // --- payloadParaCloudFunction construído com o cleanedCarrinho ---
      const payloadParaCloudFunction = {
        idToken: idToken,
        carrinho: cleanedCarrinho, // <--- USA O CARRINHO LIMPO AQUI
        frete: freteCalculado,
        taxaServico: taxaServico,
        total: parseFloat(totalFinal),
        nomeCliente:
          currentUser.displayName ||
          currentUser.email ||
          (usuarioDataFromFirestore
            ? usuarioDataFromFirestore.nome
            : "Cliente"),
        external_reference: orderId,
      };
      console.log(
        "Payload enviado para a Cloud Function:",
        payloadParaCloudFunction
      );
      // -----------------------------------------------------------

      // --- AQUI É ONDE USAMOS O PAYLOAD CORRETO ---
      const result = await callCriarPixHortifruti(payloadParaCloudFunction);
      // --- FIM DA CORREÇÃO ---

      const { qrCode, paymentId } = result.data;

      if (!qrCode || !paymentId) {
        Alert.alert(
          "Erro",
          "Não foi possível gerar o código PIX ou ID de pagamento."
        );
        console.error("Resposta da Cloud Function incompleta:", result.data);
        return;
      }

      console.log("PIX gerado. QR Code:", qrCode, "Payment ID:", paymentId);

      Alert.alert(
        "PIX Gerado!",
        `Escaneie o QR Code ou copie o código PIX:\n\n${qrCode}`,
        [
          {
            text: "Copiar Código",
            onPress: () => Clipboard.setString(qrCode),
          },
          {
            text: "OK",
            onPress: () => {
              Alert.alert("Pedido realizado com sucesso!");
              navigation.navigate("OrderConfirmation", {
                orderId: orderId,
                paymentId: paymentId,
                status: "pending_payment",
              });
            },
          },
        ]
      );

      setQrCodePix(qrCode);
    } catch (error) {
      console.error("Erro ao finalizar pedido (frontend):", error);
      let errorMessage =
        "Não foi possível finalizar o pedido. Tente novamente mais tarde.";

      if (error.code === "functions/unauthenticated") {
        errorMessage = "Você precisa estar logado para completar esta ação.";
      } else if (error.code === "functions/invalid-argument") {
        errorMessage = error.message;
      } else if (error.code === "functions/failed-precondition") {
        errorMessage =
          error.message || "Pré-condição falhou. Contate o suporte.";
      } else if (error.code === "functions/internal") {
        errorMessage =
          error.message ||
          "Ocorreu um erro interno no servidor. Tente novamente.";
      } else if (
        error.message &&
        error.message.includes("Network request failed")
      ) {
        errorMessage = "Erro de conexão. Verifique sua internet.";
      }
      Alert.alert("Erro", errorMessage);
    } finally {
      setIsProcessingOrder(false);
    }
  };

  return (
    <SafeAreaView>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Pagamento</Text>
          <Text style={styles.clearButton}>Frutiway</Text>
        </View>

        {enderecoCompleto ? (
          <Text style={styles.summaryValue}>{enderecoCompleto}</Text>
        ) : (
          <Text style={styles.summaryValue}>Endereço não encontrado</Text>
        )}

        <View style={styles.fornecedorSection}>
          <Text style={styles.fornecedorName}>
            {fornecedoresUnicos.length > 1 ? "Fornecedores:" : "Fornecedor:"}{" "}
            {fornecedoresUnicos.join(", ")}
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.addItemsLink}>Adicionar mais itens</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.produtosSection}>
          <Text style={styles.produtosTitle}>Produtos</Text>
          {carrinho && carrinho.length > 0 ? (
            carrinho.map((item) => (
              <View key={item.id} style={styles.produtoRow}>
                <Text style={styles.produtoNome}>{item.nome}</Text>
                <View style={styles.produtoInfo}>
                  <Text style={styles.produtoQuantidade}>
                    Qtd: {item.quantidade}
                  </Text>
                  <Text style={styles.produtoPreco}>
                    R$ {(item.preco * item.quantidade).toFixed(2)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={{ color: "#999" }}>Nenhum produto no carrinho.</Text>
          )}
          <View style={styles.divider} />
        </View>

        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>Pagamento pelo app</Text>
          <View style={styles.paymentMethod}>
            <Icon
              name="qrcode"
              size={22}
              color="#0F9D58"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.paymentMethodName}>{metodoPagamento}</Text>
            <TouchableOpacity
              onPress={() => Alert.alert("Método de pagamento", "Em breve!")}
            >
              <Text style={styles.changePaymentMethod}>Trocar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Resumo de valores</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              R$ {calcularSubtotal().toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxa de entrega</Text>
            <Text style={styles.summaryValue}>
              R$ {freteCalculado.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxa de serviço</Text>
            <Text style={styles.summaryValue}>R$ {taxaServico.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValueTotal}>R$ {totalFinal}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.confirmButton}
          onPress={finalizarPedido}
          disabled={isProcessingOrder || !currentUser || !idToken}
        >
          {isProcessingOrder ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmButtonText}>
              Finalizar pedido • R$ {totalFinal}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  container: { backgroundColor: "#fff", padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: { paddingHorizontal: 8 },
  backButtonText: { fontSize: 18, fontWeight: "bold" },
  title: { fontSize: 18, fontWeight: "bold", textAlign: "center" },
  clearButton: { fontSize: 16, color: "#666" },

  fornecedorSection: { marginBottom: 16 },
  fornecedorName: { fontSize: 16, fontWeight: "bold" },
  addItemsLink: {
    color: "#007AFF",
    marginTop: 8,
    textDecorationLine: "underline",
  },

  paymentSection: { marginBottom: 16 },
  paymentTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  paymentMethod: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  paymentMethodName: { fontSize: 16, flex: 1 },
  changePaymentMethod: { fontSize: 16, color: "#007AFF" },

  summarySection: { marginBottom: 16 },
  summaryTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14 },
  summaryValueTotal: { fontSize: 16, fontWeight: "bold" },

  confirmButton: {
    backgroundColor: "#FF3D59",
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  produtosSection: {
    marginBottom: 16,
  },
  produtosTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  produtoRow: {
    marginBottom: 10,
  },
  produtoNome: {
    fontSize: 14,
    fontWeight: "500",
  },
  produtoInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  produtoQuantidade: {
    fontSize: 14,
    color: "#666",
  },
  produtoPreco: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  divider: {
    height: 1,
    backgroundColor: "#ddd",
    marginVertical: 12,
  },
});

export default PagamentoScreen;
