// screens/PagamentoScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Platform, 
  Clipboard,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

import { auth, db, functions } from "../firebaseConfig";
import { doc, getDoc, collection, addDoc, updateDoc, serverTimestamp } from "firebase/firestore"; // Adicionado updateDoc
import { getFunctions, httpsCallable } from "firebase/functions";
import { SafeAreaView } from "react-native-safe-area-context";

const PagamentoScreen = ({ route }) => {
  const { carrinho, frete, cep } = route.params || {};
  const navigation = useNavigation();

  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [idToken, setIdToken] = useState(null); 
  const [metodoPagamento, setMetodoPagamento] = useState("Pix"); 
  const [enderecoCompleto, setEnderecoCompleto] = useState("");
  const [usuarioDataFromFirestore, setUsuarioDataFromFirestore] = useState(null);

  const [showPixModal, setShowPixModal] = useState(false);
  const [pixCodeToDisplay, setPixCodeToDisplay] = useState('');
  const [currentOrderId, setCurrentOrderId] = useState(null); // Usado para guardar o ID do pedido criado

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
        try {
          const tokenResult = await user.getIdTokenResult(true);
          setIdToken(tokenResult.token);
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

  const handleCopyPix = () => {
    if (pixCodeToDisplay) {
      Clipboard.setString(pixCodeToDisplay);
      Alert.alert("Copiado!", "Código PIX copiado para a área de transferência.");
    }
  };

  const handlePixOk = () => {
    setShowPixModal(false); 
    navigation.navigate("Pedidos"); 
  };

  const finalizarPedido = async () => {
    console.log("PagamentoScreen: Finalizar Pedido clicado.");

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

    const cpfClienteRaw = usuarioDataFromFirestore?.cpf; 
    const cpfCliente = cpfClienteRaw ? String(cpfClienteRaw).replace(/\D/g, '') : null; 

    if (!cpfCliente || cpfCliente.length !== 11) {
        Alert.alert(
            "Erro de CPF", 
            "Seu CPF não foi encontrado ou está inválido. Por favor, atualize seu perfil para adicionar um CPF válido (11 dígitos)."
        );
        console.error("CPF do cliente ausente ou inválido (não 11 dígitos numéricos). CPF recebido:", cpfClienteRaw);
        setIsProcessingOrder(false);
        return;
    }
    console.log("PagamentoScreen: CPF do cliente obtido e limpo:", cpfCliente);

    setIsProcessingOrder(true);

    try {
      // PRIMEIRO: Crie o documento do pedido no Firestore com status 'pending'
      const pedidoDocRef = await addDoc(collection(db, "pedidos"), {
        userId: currentUser.uid,
        fornecedores: fornecedoresUnicos,
        carrinho: carrinho, // Salva o carrinho original
        subtotal: parseFloat(calcularSubtotal().toFixed(2)),
        frete: freteCalculado,
        taxaServico: taxaServico, 
        total: parseFloat(totalFinal),
        formaPagamento: metodoPagamento,
        status: "pending", 
        criadoEm: serverTimestamp(), 
        nomeCliente:
          currentUser.displayName ||
          (usuarioDataFromFirestore
            ? usuarioDataFromFirestore.nome
            : "Cliente"),
        emailCliente: currentUser.email,
        enderecoEntrega: enderecoCompleto,
        cpfCliente: cpfCliente, 
        // Não salva qrCodePix e paymentId aqui ainda, eles virão da Cloud Function
      });
      const orderId = pedidoDocRef.id;
      setCurrentOrderId(orderId); // Guarda o ID do pedido criado

      console.log("Pedido salvo no Firestore com ID:", orderId);

      // SEGUNDO: Chame a Cloud Function com o ID do pedido recém-criado como external_reference
      const cleanedCarrinho = carrinho.map((item) => {
        const newItem = { ...item };
        if (newItem.timestamp instanceof Object && "seconds" in newItem.timestamp) {
          newItem.timestamp = newItem.timestamp.toDate().toISOString();
        }
        return newItem;
      });

      const callCriarPixHortifruti = httpsCallable(functions, "criarPixHortifruti");

      const payloadParaCloudFunction = {
        idToken: idToken,
        carrinho: cleanedCarrinho,
        frete: freteCalculado,
        taxaServico: taxaServico,
        total: parseFloat(totalFinal),
        nomeCliente:
          currentUser.displayName ||
          currentUser.email ||
          (usuarioDataFromFirestore
            ? usuarioDataFromFirestore.nome
            : "Cliente"),
        external_reference: orderId, // <-- AGORA USA O ID DO PEDIDO REAL!
        cpfCliente: cpfCliente, 
      };
      console.log(
        "Payload enviado para a Cloud Function:",
        payloadParaCloudFunction
      );

      const result = await callCriarPixHortifruti(payloadParaCloudFunction);

      const { qrCode, paymentId } = result.data;

      if (!qrCode || !paymentId) {
        Alert.alert(
          "Erro",
          "Não foi possível gerar o código PIX ou ID de pagamento. Tente novamente."
        );
        console.error("Resposta da Cloud Function incompleta:", result.data);
        return;
      }

      console.log("PIX gerado. QR Code:", qrCode, "Payment ID:", paymentId);

      // TERCEIRO: Atualize o pedido no Firestore com o QR Code e Payment ID
      await updateDoc(doc(db, "pedidos", orderId), {
        qrCodePix: qrCode,
        paymentIdMercadoPago: paymentId, // Opcional: salva o ID do pagamento do MP
        status: "pending_payment", // Atualiza o status para indicar que o PIX foi gerado
      });

      setPixCodeToDisplay(qrCode); // Define o PIX para exibição no modal
      setShowPixModal(true); // Mostra o modal do PIX

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
    <SafeAreaView style={{ flex: 1 }}>
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

        {/* Custom PIX Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showPixModal}
          onRequestClose={() => {
            Alert.alert(
              "Atenção",
              "Por favor, copie o código PIX e finalize o pagamento ou clique em OK para continuar."
            );
          }}
        >
          <View style={localStyles.centeredView}>
            <View style={localStyles.modalView}>
              <Text style={localStyles.modalTitle}>Código PIX para Pagamento</Text>
              <Text style={localStyles.pixCodeText}>{pixCodeToDisplay}</Text>

              <View style={localStyles.modalButtonContainer}>
                {/* Botão Copiar Código - NÃO FECHA O MODAL */}
                <TouchableOpacity
                  style={[localStyles.modalButton, localStyles.copyButton]}
                  onPress={handleCopyPix}
                >
                  <Icon name="content-copy" size={20} color="#FFFFFF" />
                  <Text style={localStyles.modalButtonText}>Copiar Código</Text>
                </TouchableOpacity>

                {/* Botão OK - FECHA O MODAL E NAVEGA PARA PEDIDOS */}
                <TouchableOpacity
                  style={[localStyles.modalButton, localStyles.okButton]}
                  onPress={handlePixOk}
                >
                  <Text style={localStyles.modalButtonText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: "#fff", padding: 16, flex: 1 },
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

const localStyles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  pixCodeText: {
    fontSize: 18,
    marginBottom: 25,
    textAlign: 'center',
    color: '#555',
    fontWeight: 'bold',
    padding: 10,
    backgroundColor: '#eee',
    borderRadius: 5,
    width: '100%',
    fontFamily: Platform.OS === 'ios' ? 'Menlo-Regular' : 'monospace',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 15,
  },
  modalButton: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  copyButton: {
    backgroundColor: '#007AFF',
  },
  okButton: {
    backgroundColor: '#69A461',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    marginLeft: 5,
    fontSize: 16,
  },
});

export default PagamentoScreen;
