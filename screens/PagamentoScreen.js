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
  Image,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db, functions } from "../firebaseConfig";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { SafeAreaView } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import { wp, hp } from "../src/utils/responsive";
import successAnimation from "../assets/Pagamento.json";

const { width } = Dimensions.get("window");

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
// (Manter todas as constantes e funções do backend originais aqui...)

const PagamentoScreen = ({ route }) => {
  // (Manter todos os states e efeitos orig
  // const PagamentoScreen = ({ route }) => {
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
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

  const taxaServico = calcularSubtotal() * 0.05;
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
    setShowSuccessAnimation(true);

    // Mostra a animação por 2 segundos antes de prosseguir
    setTimeout(() => {
      setShowSuccessAnimation(false);

      if (onClearCart && typeof onClearCart === "function") {
        onClearCart();
      }

      if (currentUser && currentUser.uid) {
        try {
          const userCartRef = doc(db, "carts", currentUser.uid);
          updateDoc(userCartRef, { items: [] });
        } catch (error) {
          console.error("Erro ao limpar carrinho:", error);
        }
      }

      navigation.navigate("Pedidos");
    }, 4000);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <LinearGradient
        colors={["#4CAF50", "#8BC34A"]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Finalizar Pedido</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Seção de Endereço */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Icon name="map-marker" size={20} color="#4CAF50" />
            <Text style={styles.sectionTitle}>Endereço de Entrega</Text>
          </View>
          <Text style={styles.addressText}>{enderecoCompleto}</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate("Perfil")}
          >
            <Text style={styles.editButtonText}>Alterar endereço</Text>
          </TouchableOpacity>
        </View>

        {/* Seção de Produtos */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Icon name="basket" size={20} color="#4CAF50" />
            <Text style={styles.sectionTitle}>Seu Pedido</Text>
          </View>

          {carrinho.map((item) => (
            <View key={item.id} style={styles.productItem}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.nome}</Text>
                <Text style={styles.productQuantity}>x {item.quantidade}</Text>
              </View>
              <Text style={styles.productPrice}>
                R$ {((item.preco || 0) * (item.quantidade || 0)).toFixed(2)}
              </Text>
            </View>
          ))}

          <TouchableOpacity
            style={styles.addMoreButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="plus-circle" size={20} color="#4CAF50" />
            <Text style={styles.addMoreText}>Adicionar mais itens</Text>
          </TouchableOpacity>
        </View>

        {/* Seção de Entrega */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Icon name="truck-delivery" size={20} color="#4CAF50" />
            <Text style={styles.sectionTitle}>Entrega</Text>
          </View>

          {/* Data de Entrega */}
          <TouchableOpacity
            onPress={showDatepicker}
            style={styles.pickerButton}
          >
            <View style={styles.pickerIcon}>
              <Icon name="calendar" size={20} color="#4CAF50" />
            </View>
            <View style={styles.pickerTextContainer}>
              <Text style={styles.pickerLabel}>Data de entrega</Text>
              <Text style={styles.pickerValue}>
                {dataEntrega.toLocaleDateString("pt-BR")}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color="#999" />
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

          {/* Horário de Entrega */}
          <TouchableOpacity
            onPress={() => setShowTimePickerModal(true)}
            style={styles.pickerButton}
          >
            <View style={styles.pickerIcon}>
              <Icon name="clock-outline" size={20} color="#4CAF50" />
            </View>
            <View style={styles.pickerTextContainer}>
              <Text style={styles.pickerLabel}>Horário de entrega</Text>
              <Text style={styles.pickerValue}>
                {getAvailableTimeOptions.find(
                  (opt) => opt.value === horarioEntrega
                )?.label || "Selecione"}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color="#999" />
          </TouchableOpacity>

          <Text style={styles.deliveryInfoText}>
            <Text style={{ fontWeight: "bold" }}>Horários de entrega:</Text>
            {"\n"}• Segunda a Sexta: 7h às 21h
            {"\n"}• Sábado: 7h às 19h
            {"\n"}• Domingo e Feriados: 8h às 13h
          </Text>
        </View>

        {/* Seção de Pagamento */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Icon name="credit-card" size={20} color="#4CAF50" />
            <Text style={styles.sectionTitle}>Pagamento</Text>
          </View>

          <View style={styles.paymentMethod}>
            <View style={styles.paymentMethodIcon}>
              <Icon name="qrcode" size={24} color="#0F9D58" />
            </View>
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodName}>PIX</Text>
              <Text style={styles.paymentMethodDescription}>
                Pagamento instantâneo
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => Alert.alert("Método de pagamento", "Em breve!")}
            >
              <Text style={styles.changePaymentText}>Alterar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Resumo do Pedido */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Icon name="receipt" size={20} color="#4CAF50" />
            <Text style={styles.sectionTitle}>Resumo do Pedido</Text>
          </View>

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

          <View style={styles.divider} />

          <View style={[styles.summaryRow, { marginTop: 8 }]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>R$ {totalFinal}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Botão de Finalizar */}
      <LinearGradient
        colors={["#4CAF50", "#8BC34A"]}
        style={styles.footer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={finalizarPedido}
          disabled={isProcessingOrder || !currentUser || !idToken}
        >
          {isProcessingOrder ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.buttonContent}>
              <Text style={styles.confirmButtonText}>Finalizar Pedido</Text>
              <Text style={styles.confirmButtonPrice}>R$ {totalFinal}</Text>
            </View>
          )}
        </TouchableOpacity>
      </LinearGradient>

      {/* Modal PIX */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showPixModal}
        onRequestClose={() => {
          Alert.alert(
            "Atenção",
            "Por favor, copie o código PIX e finalize o pagamento ou clique em OK para continuar."
          );
        }}
      >
        <View style={styles.centeredModal}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pagamento via PIX</Text>
              <Text style={styles.modalSubtitle}>
                Copie o código abaixo e cole no seu app bancário
              </Text>
            </View>

            <View style={styles.pixCodeContainer}>
              <Icon
                name="qrcode"
                size={80}
                color="#0F9D58"
                style={styles.qrIcon}
              />
              <Text style={styles.pixCodeText}>{pixCodeToDisplay}</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.copyButton]}
                onPress={handleCopyPix}
              >
                <Icon name="content-copy" size={20} color="#fff" />
                <Text style={styles.modalButtonText}>Copiar Código</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.okButton]}
                onPress={handlePixOk}
              >
                <Text style={styles.modalButtonText}>Já paguei</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showTimePickerModal}
        onRequestClose={() => setShowTimePickerModal(false)}
      >
        <View style={styles.centeredModal}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Selecione o Horário</Text>

            {getAvailableTimeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.timeOption,
                  horarioEntrega === option.value && styles.timeOptionSelected,
                ]}
                onPress={() => {
                  setHorarioEntrega(option.value);
                  setShowTimePickerModal(false);
                }}
              >
                <Text
                  style={[
                    styles.timeOptionText,
                    horarioEntrega === option.value &&
                      styles.timeOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowTimePickerModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSuccessAnimation}
        onRequestClose={() => {}}
      >
        <View style={styles.animationContainer}>
          <LottieView
            source={successAnimation}
            autoPlay
            loop={false}
            // NOVO: Adicionado a propriedade 'speed' para controlar a velocidade.
            // 1 é a velocidade normal. 0.5 é metade da velocidade, 2 é o dobro.
            speed={1.5} // Experimente valores como 0.5, 0.7, 0.8 para deixar mais lenta
            // Ajuste aqui para preencher o container mantendo a proporção:
            style={styles.lottieFullScreen}
          />

          <Text style={styles.successText}>Preparando Produtos...</Text>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // Estilos globais
  scrollContainer: {
    padding: 16,
    paddingBottom: 100,
  },

  animationContainer: {
    flex: 1, // Faz o container ocupar toda a altura e largura do Modal
    justifyContent: "center", // Centraliza o conteúdo verticalmente
    alignItems: "center", // Centraliza o conteúdo horizontalmente
    backgroundColor: "rgba(255, 255, 255, 1)", // Fundo branco sólido
  },
  lottieFullScreen: {
    // Como a animação é quadrada (600x600), podemos fazer ela ocupar 100% da largura
    // e deixar a altura se ajustar proporcionalmente. O 'flex: 1' no container
    // e centralização vão ajudar a posicioná-la.
    width: "100%",
    // Para manter a proporção e evitar o corte/estica, podemos usar aspectRatio: 1 (se a animação for quadrada)
    // ou apenas flex: 1 se o LottieView se auto-ajustar bem dentro do container flex.
    // Vamos tentar flex: 1 no LottieView, pois ele geralmente lida bem com isso.
    flex: 1,
    // Se flex: 1 não funcionar perfeitamente, tente:
    // height: '100%', // Remova esta linha se usar aspect ratio ou flex: 1 para evitar esticar
    // aspectRatio: 1, // Adicione esta linha se sua animação for quadrada (como 600x600) e você quer garantir que ela permaneça assim.
  },
  successText: {
    marginTop: 5,
    fontSize: 20,
    fontWeight: "bold",
    color: "#4CAF50",
    position: "absolute", // Para posicionar o texto acima da animação
    bottom: 80, // Ajuste a distância da parte inferior
    zIndex: 1, // Garante que o texto esteja acima da animação
    textAlign: "center", // Centraliza o texto se for longo
    width: "100%", // Garante que o texto ocupe a largura completa para centralização
  },

  // Header
  headerGradient: {
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },

  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },

  // Seções
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
    color: "#333",
  },

  // Endereço
  addressText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginBottom: 12,
  },
  editButton: {
    alignSelf: "flex-start",
  },
  editButtonText: {
    color: "#4CAF50",
    fontWeight: "500",
  },

  // Produtos
  productItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    color: "#333",
  },
  productQuantity: {
    fontSize: 12,
    color: "#777",
    marginTop: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  addMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  addMoreText: {
    color: "#4CAF50",
    fontWeight: "500",
    marginLeft: 8,
  },

  // Seletores
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  pickerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  pickerTextContainer: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 12,
    color: "#777",
  },
  pickerValue: {
    fontSize: 16,
    color: "#333",
    marginTop: 2,
  },
  deliveryInfoText: {
    fontSize: 12,
    color: "#666",
    marginTop: 12,
    lineHeight: 18,
  },

  // Pagamento
  paymentMethod: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  paymentMethodIcon: {
    marginRight: 12,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  paymentMethodDescription: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  changePaymentText: {
    color: "#4CAF50",
    fontWeight: "500",
  },

  // Resumo
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
  },
  summaryValue: {
    fontSize: 14,
    color: "#333",
  },
  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4CAF50",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  confirmButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 8,
  },
  confirmButtonPrice: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },

  // Modais
  centeredModal: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContainer: {
    width: width - 40,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
  },
  modalHeader: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
  },
  pixCodeContainer: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginVertical: 16,
  },
  qrIcon: {
    marginBottom: 16,
  },
  pixCodeText: {
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    color: "#333",
    textAlign: "center",
    marginTop: 8,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  copyButton: {
    backgroundColor: "#2196F3",
    marginRight: 8,
  },
  okButton: {
    backgroundColor: "#4CAF50",
    marginLeft: 8,
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
  },
  timeOption: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    marginBottom: 8,
  },
  timeOptionSelected: {
    backgroundColor: "#4CAF50",
  },
  timeOptionText: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
  },
  timeOptionTextSelected: {
    color: "#fff",
  },
  cancelButton: {
    marginTop: 16,
    padding: 12,
  },
  cancelButtonText: {
    color: "#F44336",
    fontWeight: "500",
    textAlign: "center",
  },
});

export default PagamentoScreen;
