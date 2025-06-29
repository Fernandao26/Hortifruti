// screens/PagamentoScreen.js
import React, { useState, useEffect, useMemo } from "react";
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
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import DateTimePicker from "@react-native-community/datetimepicker";

import { auth, db, functions } from "../firebaseConfig";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  FieldValue,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { SafeAreaView } from "react-native-safe-area-context";

// Lista estática de feriados nacionais fixos no Brasil para 2025 (MM-DD)
const NATIONAL_HOLIDAYS_2025 = [
  "01-01", // Confraternização Universal
  "03-03", // Carnaval (Segunda - data de 2025)
  "03-04", // Carnaval (Terça - data de 2025)
  "04-18", // Sexta-feira Santa (data de 2025)
  "04-21", // Tiradentes
  "05-01", // Dia do Trabalho
  "06-19", // Corpus Christi (data de 2025)
  "09-07", // Independência do Brasil
  "10-12", // Nossa Senhora Aparecida
  "11-02", // Finados
  "11-15", // Proclamação da República
  "12-25", // Natal
];

const PagamentoScreen = ({ route }) => {
  const { carrinho, frete, cep, onClearCart } = route.params || {};
  const navigation = useNavigation();

  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [metodoPagamento, setMetodoPagamento] = useState("Pix");
  const [enderecoCompleto, setEnderecoCompleto] = useState(
    "Carregando endereço..."
  );
  const [usuarioDataFromFirestore, setUsuarioDataFromFirestore] =
    useState(null);
  const [horarioEntrega, setHorarioEntrega] = useState("manhã");
  const [dataEntrega, setDataEntrega] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);

  const [showPixModal, setShowPixModal] = useState(false);
  const [pixCodeToDisplay, setPixCodeToDisplay] = useState("");
  const [currentOrderId, setCurrentOrderId] = useState(null);

  const calcularSubtotal = () =>
    carrinho.reduce(
      (sum, item) => sum + (item.preco || 0) * (item.quantidade || 0),
      0
    );

  const taxaServico = calcularSubtotal() * 0.02;
  const freteCalculado = typeof frete === "number" ? frete : 7;
  const totalFinal = (
    calcularSubtotal() +
    freteCalculado +
    taxaServico
  ).toFixed(2);

  const fornecedoresUnicos = Array.from(
    new Set(
      carrinho.map((item) =>
        (item.nomeFornecedor || item.fornecedor || "Desconhecido")
          ?.toString()
          .trim()
      )
    )
  );

  const isHolidayOrSunday = (date) => {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) {
      return true;
    }

    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const formattedDate = `${month}-${day}`;

    const currentYear = date.getFullYear();
    if (currentYear === 2025) {
      return NATIONAL_HOLIDAYS_2025.includes(formattedDate);
    }
    return false;
  };

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

        if (user.uid) {
          try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              setUsuarioDataFromFirestore(data);
              const endereco = data.endereco?.toString().trim() || "";
              const numero = data.numero?.toString().trim() || "";
              const bairro = data.bairro?.toString().trim() || "";
              const cidade = data.cidade?.toString().trim() || "";
              const estado = data.estado?.toString().trim() || "";
              const cepData = data.cep?.toString().trim() || "";

              const fullAddress = `${endereco}, ${numero} - ${bairro}\n${cidade} - ${estado}, CEP ${cepData}`;
              setEnderecoCompleto(fullAddress);
              console.log("Endereço carregado com sucesso:", fullAddress);
            } else {
              console.warn(
                "PagamentoScreen: Documento do usuário não encontrado no Firestore para UID:",
                user.uid
              );
              setEnderecoCompleto("Endereço não cadastrado.");
            }
          } catch (error) {
            console.error(
              "PagamentoScreen: Erro ao carregar dados do usuário do Firestore (dentro do onAuthStateChanged):",
              error
            );
            setEnderecoCompleto("Erro ao carregar endereço.");
          }
        }
      } else {
        console.warn(
          "PagamentoScreen: Nenhum usuário logado. Botão de finalizar desabilitado."
        );
        setCurrentUser(null);
        setIdToken(null);
        setUsuarioDataFromFirestore(null);
        setEnderecoCompleto("Você não está logado.");
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const isSpecialDay = isHolidayOrSunday(dataEntrega);
    const dayOfWeek = dataEntrega.getDay();

    let newHorarioToSet = horarioEntrega;

    if (isSpecialDay) {
      if (horarioEntrega !== "manhã") {
        newHorarioToSet = "manhã";
      }
    } else if (dayOfWeek === 6) {
      if (horarioEntrega === "noite") {
        newHorarioToSet = "manhã";
      }
    }

    if (newHorarioToSet !== horarioEntrega) {
      setHorarioEntrega(newHorarioToSet);
      console.log(
        "Horário de Entrega ajustado para:",
        newHorarioToSet,
        "devido à mudança de data."
      );
    }
  }, [dataEntrega]);

  const handleCopyPix = () => {
    if (pixCodeToDisplay) {
      Clipboard.setString(pixCodeToDisplay.toString().trim());
      Alert.alert(
        "Copiado!",
        "Código PIX copiado para a área de transferência."
      );
    }
  };

  const handlePixOk = async () => {
    setShowPixModal(false);

    if (onClearCart && typeof onClearCart === "function") {
      onClearCart();
      console.log(
        "Carrinho limpo através da função onClearCart (estado local)."
      );
    } else {
      console.warn(
        "onClearCart não foi fornecido ou não é uma função. O carrinho local pode não ser limpo."
      );
    }

    if (currentUser && currentUser.uid) {
      try {
        const userCartRef = doc(db, "carts", currentUser.uid);
        await updateDoc(userCartRef, { items: [] });
        console.log(
          "Carrinho persistente do usuário (UID:",
          currentUser.uid,
          ") limpo no Firestore."
        );
      } catch (error) {
        console.error(
          "Erro ao limpar carrinho persistente no Firestore:",
          error
        );
        Alert.alert(
          "Erro",
          "Não foi possível limpar seu carrinho online. Por favor, tente novamente mais tarde."
        );
      }
    } else {
      console.warn(
        "Não foi possível limpar o carrinho persistente: Usuário não logado ou UID ausente."
      );
    }

    navigation.navigate("Pedidos");
  };

  const onChangeDate = (event, selectedDate) => {
    const currentDate = selectedDate || dataEntrega;
    setShowDatePicker(Platform.OS === "ios");
    setDataEntrega(currentDate);
    console.log(
      "Data de Entrega selecionada:",
      currentDate.toLocaleDateString("pt-BR")
    );
  };

  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  const getAvailableTimeOptions = useMemo(() => {
    const options = [];
    const isSpecialDay = isHolidayOrSunday(dataEntrega);
    const dayOfWeek = dataEntrega.getDay();

    if (isSpecialDay) {
      options.push({ label: "Manhã (8h - 13h)", value: "manhã" });
    } else if (dayOfWeek === 6) {
      options.push(
        { label: "Manhã (7h - 12h)", value: "manhã" },
        { label: "Tarde (12h - 19h)", value: "tarde" }
      );
    } else {
      options.push(
        { label: "Manhã (7h - 12h)", value: "manhã" },
        { label: "Tarde (12h - 18h)", value: "tarde" },
        { label: "Noite (18h - 21h)", value: "noite" }
      );
    }
    console.log(
      "Opções de horário disponíveis (getAvailableTimeOptions):",
      options
    );
    return options;
  }, [dataEntrega]);

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
    const cpfCliente = cpfClienteRaw
      ? String(cpfClienteRaw).replace(/\D/g, "")
      : null;

    if (!cpfCliente || cpfCliente.length !== 11) {
      Alert.alert(
        "Erro de CPF",
        "Seu CPF não foi encontrado ou está inválido. Por favor, atualize seu perfil para adicionar um CPF válido (11 dígitos)."
      );
      console.error(
        "CPF do cliente ausente ou inválido (não 11 dígitos numéricos). CPF recebido:",
        cpfClienteRaw
      );
      setIsProcessingOrder(false);
      return;
    }
    console.log("PagamentoScreen: CPF do cliente obtido e limpo:", cpfCliente);

    const currentValidTimeOptions = getAvailableTimeOptions.map(
      (option) => option.value
    );
    if (!horarioEntrega || !currentValidTimeOptions.includes(horarioEntrega)) {
      Alert.alert(
        "Erro",
        "Por favor, selecione um horário de entrega válido para a data escolhida."
      );
      setIsProcessingOrder(false);
      return;
    }

    setIsProcessingOrder(true);

    try {
      await runTransaction(db, async (transaction) => {
        const productsToUpdate = [];
        for (const item of carrinho) {
          const productIdToLookup = item.produtoId;
          const productRef = doc(db, "produtos", productIdToLookup);

          console.log(
            `Verificando produto para transação: ID do PRODUTO no carrinho=${productIdToLookup}, Nome=${item.nome}`
          );
          const productSnap = await transaction.get(productRef);

          if (!productSnap.exists()) {
            throw new Error(
              `Produto com ID '${productIdToLookup}' (Nome: ${item.nome}) não encontrado no Firestore na coleção 'produtos'. Por favor, verifique os produtos no seu carrinho ou o banco de dados.`
            );
          }

          const currentStock = productSnap.data().estoque || 0;
          const requestedQuantity = item.quantidade || 0;

          if (currentStock < requestedQuantity) {
            throw new Error(
              `Estoque insuficiente para ${item.nome}. Disponível: ${currentStock}, Solicitado: ${requestedQuantity}`
            );
          }

          const newStock = currentStock - requestedQuantity;
          transaction.update(productRef, { estoque: newStock });
          productsToUpdate.push({
            id: productIdToLookup,
            oldStock: currentStock,
            newStock: newStock,
          });
          console.log(
            `Estoque de ${item.nome} (ID do PRODUTO: ${productIdToLookup}) atualizado de ${currentStock} para ${newStock}.`
          );
        }

        const pedidoDocRef = collection(db, "pedidos");
        const newOrderRef = await addDoc(pedidoDocRef, {
          userId: currentUser.uid,
          fornecedores: fornecedoresUnicos,
          carrinho: carrinho,
          subtotal: parseFloat(calcularSubtotal().toFixed(2)),
          frete: freteCalculado,
          taxaServico: taxaServico,
          total: parseFloat(totalFinal),
          formaPagamento: metodoPagamento,
          horarioEntrega: horarioEntrega.toString().trim(),
          dataEntrega: dataEntrega,
          status: "pending",
          criadoEm: serverTimestamp(),
          nomeCliente: (
            currentUser.displayName ||
            usuarioDataFromFirestore?.nome ||
            "Cliente"
          )
            ?.toString()
            .trim(),
          emailCliente: currentUser.email?.toString().trim(),
          enderecoEntrega: enderecoCompleto.toString().trim(),
          cpfCliente: cpfCliente.toString().trim(),
          estoque_antes_da_compra: productsToUpdate.map((p) => ({
            productId: p.id,
            oldStock: p.oldStock,
          })),
        });

        const orderId = newOrderRef.id;
        setCurrentOrderId(orderId);
        console.log("Pedido salvo no Firestore com ID:", orderId);

        const cleanedCarrinho = carrinho.map((item) => {
          const newItem = { ...item };
          if (
            newItem.timestamp instanceof Object &&
            "seconds" in newItem.timestamp
          ) {
            newItem.timestamp = newItem.timestamp.toDate().toISOString();
          } else if (newItem.timestamp === undefined) {
            newItem.timestamp = null;
          }
          newItem.nome = newItem.nome?.toString().trim();
          newItem.fornecedor = newItem.fornecedor?.toString().trim();
          newItem.nomeFornecedor = newItem.nomeFornecedor?.toString().trim();
          newItem.produtoId = newItem.produtoId?.toString().trim() || null;
          newItem.id = newItem.id?.toString().trim();
          return newItem;
        });

        const callCriarPixHortifruti = httpsCallable(
          functions,
          "criarPixHortifruti"
        );

        const payloadParaCloudFunction = {
          idToken: idToken,
          carrinho: cleanedCarrinho,
          frete: freteCalculado,
          taxaServico: taxaServico,
          total: parseFloat(totalFinal),
          nomeCliente: (
            currentUser.displayName ||
            currentUser.email ||
            usuarioDataFromFirestore?.nome ||
            "Cliente"
          )
            ?.toString()
            .trim(),
          external_reference: orderId.toString().trim(),
          cpfCliente: cpfCliente.toString().trim(),
        };
        console.log(
          "Payload enviado para a Cloud Function:",
          payloadParaCloudFunction
        );

        const result = await callCriarPixHortifruti(payloadParaCloudFunction);

        const { qrCode, paymentId } = result.data;

        if (!qrCode || !paymentId) {
          throw new Error(
            "Não foi possível gerar o código PIX ou ID de pagamento. Tente novamente."
          );
        }

        console.log("PIX gerado. QR Code:", qrCode, "Payment ID:", paymentId);

        await updateDoc(doc(db, "pedidos", orderId), {
          qrCodePix: qrCode.toString().trim(),
          paymentIdMercadoPago: paymentId.toString().trim(),
          status: "pending_payment",
        });

        setPixCodeToDisplay(qrCode.toString().trim());
        setShowPixModal(true);
      });
    } catch (error) {
      console.error("Erro ao finalizar pedido (frontend):", error);
      let errorMessage =
        "Não foi possível finalizar o pedido. Tente novamente mais tarde.";

      if (error.message.includes("Estoque insuficiente")) {
        errorMessage = error.message;
      } else if (error.message.includes("não encontrado no Firestore")) {
        errorMessage = `Um dos produtos no seu carrinho não foi encontrado no banco de dados. Por favor, verifique os itens. ${error.message}`;
      } else if (error.code === "functions/unauthenticated") {
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

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.summaryValue}>
            {enderecoCompleto?.toString().trim()}
          </Text>

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
                <View
                  key={item.id?.toString().trim() || Math.random().toString()}
                  style={styles.produtoRow}
                >
                  <Text style={styles.produtoNome}>
                    {item.nome?.toString().trim()}
                  </Text>
                  <View style={styles.produtoInfo}>
                    <Text style={styles.produtoQuantidade}>
                      Qtd: {item.quantidade?.toString().trim()}
                    </Text>
                    <Text style={styles.produtoPreco}>
                      R${" "}
                      {((item.preco || 0) * (item.quantidade || 0)).toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ color: "#999" }}>Nenhum produto no carrinho.</Text>
            )}
            <View style={styles.divider} />
          </View>

          {/* Seleção de Data de Entrega */}
          <View style={styles.deliveryDateSection}>
            <Text style={styles.deliveryTimeTitle}>Data para Entrega</Text>
            <TouchableOpacity
              onPress={showDatepicker}
              style={styles.datePickerButton}
            >
              <Text style={styles.datePickerButtonText}>
                {dataEntrega.toLocaleDateString("pt-BR")}
              </Text>
              <Icon name="calendar" size={24} color="#69A461" />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                testID="dateTimePicker"
                value={dataEntrega}
                mode="date"
                display="default"
                onChange={onChangeDate}
                minimumDate={new Date()}
              />
            )}
          </View>

          {/* Seleção de Horário de Entrega (Customizada com Modal) */}
          <View style={styles.deliveryTimeSection}>
            <Text style={styles.deliveryTimeTitle}>Horário para Entrega</Text>
            <TouchableOpacity
              onPress={() => setShowTimePickerModal(true)}
              style={styles.datePickerButton}
            >
              <Text style={styles.datePickerButtonText}>
                {getAvailableTimeOptions.find(
                  (opt) => opt.value === horarioEntrega
                )?.label || "Selecione o horário"}
              </Text>
              <Icon name="clock-outline" size={24} color="#69A461" />
            </TouchableOpacity>
            <Text style={styles.deliveryInfo}>
              As entregas ocorrem:
              {"\n"}• Segunda a Sexta: 7h às 21h
              {"\n"}• Sábado: 7h às 19h
              {"\n"}• Domingo e Feriados: 8h às 13h
            </Text>
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
              <Text style={styles.paymentMethodName}>
                {metodoPagamento?.toString().trim()}
              </Text>
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
              <Text style={styles.summaryValue}>
                R$ {taxaServico.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryValueTotal}>R$ {totalFinal}</Text>
            </View>
          </View>
        </ScrollView>

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
              <Text style={localStyles.modalTitle}>
                Código PIX para Pagamento
              </Text>
              <Text style={localStyles.pixCodeText}>
                {pixCodeToDisplay?.toString().trim()}
              </Text>

              <View style={localStyles.modalButtonContainer}>
                <TouchableOpacity
                  style={[localStyles.modalButton, localStyles.copyButton]}
                  onPress={handleCopyPix}
                >
                  <Icon name="content-copy" size={20} color="#FFFFFF" />
                  <Text style={localStyles.modalButtonText}>Copiar Código</Text>
                </TouchableOpacity>

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

        {/* Modal de Seleção de Horário Personalizado */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showTimePickerModal}
          onRequestClose={() => setShowTimePickerModal(false)}
        >
          <View style={localStyles.centeredView}>
            <View style={localStyles.modalView}>
              <Text style={localStyles.modalTitle}>
                Selecione o Horário de Entrega
              </Text>
              {getAvailableTimeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    localStyles.timeOptionButton,
                    horarioEntrega === option.value &&
                      localStyles.timeOptionButtonSelected,
                  ]}
                  onPress={() => {
                    setHorarioEntrega(option.value);
                    setShowTimePickerModal(false);
                  }}
                >
                  <Text
                    style={[
                      localStyles.timeOptionButtonText,
                      horarioEntrega === option.value &&
                        localStyles.timeOptionButtonTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  localStyles.modalButton,
                  { backgroundColor: "#FF3D59", marginTop: 20 },
                ]}
                onPress={() => setShowTimePickerModal(false)}
              >
                <Text style={localStyles.modalButtonText}>Fechar</Text>
              </TouchableOpacity>
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

  deliveryDateSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  datePickerButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: "#333",
  },

  deliveryTimeSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  deliveryTimeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  deliveryInfo: {
    fontSize: 13,
    color: "#555",
    lineHeight: 18,
    marginTop: 5,
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
});

const localStyles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: "90%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  pixCodeText: {
    fontSize: 18,
    marginBottom: 25,
    textAlign: "center",
    color: "#555",
    fontWeight: "bold",
    padding: 10,
    backgroundColor: "#eee",
    borderRadius: 5,
    width: "100%",
    fontFamily: Platform.OS === "ios" ? "Menlo-Regular" : "monospace",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 15,
  },
  modalButton: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    marginHorizontal: 5,
  },
  copyButton: {
    backgroundColor: "#007AFF",
  },
  okButton: {
    backgroundColor: "#69A461",
  },
  modalButtonText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
    marginLeft: 5,
    fontSize: 16,
  },
  timeOptionButton: {
    width: "100%",
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    marginBottom: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  timeOptionButtonSelected: {
    backgroundColor: "#69A461",
    borderColor: "#4a7d4a",
  },
  timeOptionButtonText: {
    fontSize: 18,
    color: "#333",
    fontWeight: "bold",
  },
  timeOptionButtonTextSelected: {
    color: "#fff",
  },
});

export default PagamentoScreen;
