import React, { useState,useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const PagamentoScreen = ({ route }) => {
  const { carrinho, frete } = route.params || {};
  const navigation = useNavigation();
  const { cep } = route.params || {};
  const auth = getAuth();
  const userId = auth.currentUser?.uid;

  const [metodoPagamento, setMetodoPagamento] = useState('Pix');

  const calcularSubtotal = () =>
    carrinho.reduce((sum, item) => sum + item.preco * item.quantidade, 0);

  const taxaServico = calcularSubtotal() * 0.02;
  const freteCalculado = typeof frete === 'number' ? frete : 7;
  const totalFinal = (calcularSubtotal() + freteCalculado + taxaServico).toFixed(2);

  const fornecedoresUnicos = Array.from(
    new Set(carrinho.map((item) => item.nomeFornecedor || item.fornecedor || 'Desconhecido'))
  );

  const finalizarPedido = async () => {
    try {
      await addDoc(collection(db, "pedidos"), {
        userId: userId || 'desconhecido',
        fornecedores: fornecedoresUnicos,
        subtotal: calcularSubtotal(),
        frete: freteCalculado,
        taxaServico: taxaServico,
        total: parseFloat(totalFinal),
        formaPagamento: metodoPagamento,
        status: "Pendente",
        criadoEm: new Date(),
      });

      Alert.alert("Pedido realizado com sucesso!");
      navigation.navigate("Home");
    } catch (error) {
      console.error("Erro ao finalizar pedido:", error);
      Alert.alert("Erro ao finalizar pedido");
    }
  };
  const [enderecoCompleto, setEnderecoCompleto] = useState("");
  const [usuario, setUsuario] = useState(null);
  useEffect(() => {
    const carregarDadosUsuario = async () => {
      if (!userId) return;
  
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        const data = userDoc.data();
  
        if (data) {
          setUsuario(data);
          const enderecoCompleto = `${data.endereco}, ${data.numero} - ${data.bairro}\n${data.cidade} - ${data.estado}, CEP ${data.cep}`;
          setEnderecoCompleto(enderecoCompleto);
        }
      } catch (error) {
        console.error("Erro ao carregar dados do usuário:", error);
      }
    };
  
    carregarDadosUsuario();
  }, [userId]);
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>CARRINHO</Text>
        <Text style={styles.clearButton}>Frutiway</Text>
      </View>
      
      {enderecoCompleto ? (
  <Text style={styles.summaryValue}>{enderecoCompleto}</Text>
) : (
  <Text style={styles.summaryValue}>Endereço não encontrado</Text>
)}
      {/* Fornecedores */}
      <View style={styles.fornecedorSection}>
        <Text style={styles.fornecedorName}>
          {fornecedoresUnicos.length > 1 ? 'Fornecedores:' : 'Fornecedor:'} {fornecedoresUnicos.join(', ')}
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.addItemsLink}>Adicionar mais itens</Text>
        </TouchableOpacity>
      </View>
{/* Lista de Produtos */}
<View style={styles.produtosSection}>
      <Text style={styles.produtosTitle}>Produtos</Text>

      {carrinho && carrinho.length > 0 ? (
        carrinho.map((item) => (
          <View key={item.id} style={styles.produtoRow}>
            <Text style={styles.produtoNome}>{item.nome}</Text>
            <View style={styles.produtoInfo}>
              <Text style={styles.produtoQuantidade}>Qtd: {item.quantidade}</Text>
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

      {/* Pagamento */}
      <View style={styles.paymentSection}>
        <Text style={styles.paymentTitle}>Pagamento pelo app</Text>
        <View style={styles.paymentMethod}>
          <Icon name="qrcode" size={22} color="#0F9D58" style={{ marginRight: 6 }} />
          <Text style={styles.paymentMethodName}>{metodoPagamento}</Text>
          <TouchableOpacity onPress={() => Alert.alert("Método de pagamento", "Em breve!")}>
            <Text style={styles.changePaymentMethod}>Trocar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Resumo */}
      <View style={styles.summarySection}>
        <Text style={styles.summaryTitle}>Resumo de valores</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>R$ {calcularSubtotal().toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Taxa de entrega</Text>
          <Text style={styles.summaryValue}>R$ {freteCalculado.toFixed(2)}</Text>
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

      <TouchableOpacity style={styles.confirmButton} onPress={finalizarPedido}>
        <Text style={styles.confirmButtonText}>Finalizar pedido • R$ {totalFinal}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backButton: { paddingHorizontal: 8 },
  backButtonText: { fontSize: 18, fontWeight: 'bold' },
  title: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  clearButton: { fontSize: 16, color: '#666' },

  fornecedorSection: { marginBottom: 16 },
  fornecedorName: { fontSize: 16, fontWeight: 'bold' },
  addItemsLink: { color: '#007AFF', marginTop: 8, textDecorationLine: 'underline' },

  paymentSection: { marginBottom: 16 },
  paymentTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  paymentMethod: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paymentMethodName: { fontSize: 16, flex: 1 },
  changePaymentMethod: { fontSize: 16, color: '#007AFF' },

  summarySection: { marginBottom: 16 },
  summaryTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14 },
  summaryValueTotal: { fontSize: 16, fontWeight: 'bold' },

  confirmButton: { backgroundColor: '#FF3D59', paddingVertical: 16, borderRadius: 8, marginTop: 16 },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  produtosSection: {
    marginBottom: 16,
  },
  produtosTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  produtoRow: {
    marginBottom: 10,
  },
  produtoNome: {
    fontSize: 14,
    fontWeight: '500',
  },
  produtoInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  produtoQuantidade: {
    fontSize: 14,
    color: '#666',
  },
  produtoPreco: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 12,
  }
});

export default PagamentoScreen;