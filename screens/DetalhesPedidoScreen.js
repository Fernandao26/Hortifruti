
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Alert, Clipboard, Platform } from 'react-native';
import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore'; // Importar updateDoc e writeBatch
import { db } from '../firebaseConfig';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function DetalhesPedidoScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { pedidoId } = route.params;

  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false); 

  useEffect(() => {
    const fetchPedidoDetails = async () => {
      if (!pedidoId) {
        Alert.alert("Erro", "ID do pedido não fornecido.");
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, "pedidos", pedidoId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setPedido({
            id: docSnap.id,
            ...data,
            
            criadoEm: data.criadoEm?.toDate ? data.criadoEm.toDate().toISOString() : data.criadoEm,
            dataAprovacao: data.dataAprovacao?.toDate ? data.dataAprovacao.toDate().toISOString() : data.dataAprovacao,
            statusAtualizadoEm: data.statusAtualizadoEm?.toDate ? data.statusAtualizadoEm.toDate().toISOString() : data.statusAtualizadoEm,
          });
          console.log("Detalhes do pedido carregados:", data);
        } else {
          Alert.alert("Erro", "Pedido não encontrado.");
        }
      } catch (error) {
        console.error("Erro ao buscar detalhes do pedido:", error);
        Alert.alert("Erro", "Não foi possível carregar os detalhes do pedido.");
      } finally {
        setLoading(false);
      }
    };

    fetchPedidoDetails();
  }, [pedidoId]);

  const formatarData = (timestamp) => {
    if (!timestamp) return 'N/A';
   
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp.seconds * 1000);
    if (isNaN(date.getTime())) return "N/A"; 
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const translateStatus = (status) => {
    switch (status?.toLowerCase()) { 
      case 'approved':
      case 'success':
      case 'aprovado':
      case 'sucesso':
        return 'Aprovado';
      case 'pending':
      case 'pendente':
      case 'pending_payment':
        return 'Pendente';
      case 'cancelled':
      case 'cancelado':
      case 'rejected':
      case 'rejeitado':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) { 
      case 'approved':
      case 'success':
      case 'aprovado':
      case 'sucesso':
        return { color: '#0F9D58' };
      case 'pending':
      case 'pendente':
      case 'pending_payment':
        return { color: '#FFA500' };
      case 'cancelled':
      case 'cancelado':
      case 'rejected':
      case 'rejeitado':
        return { color: '#FF3D59' };
      default:
        return { color: '#333' };
    }
  };

  const handleCopyPix = () => {
    if (pedido?.qrCodePix) {
      Clipboard.setString(pedido.qrCodePix);
      Alert.alert("Copiado!", "Código PIX copiado para a área de transferência.");
    } else {
      Alert.alert("Erro", "Código PIX não disponível.");
    }
  };

  
  const handleCancelOrder = async () => {
    if (!pedido || isCancelling) return;

    Alert.alert(
      "Confirmar Cancelamento",
      "Tem certeza que deseja cancelar este pedido? O estoque dos produtos será restaurado.",
      [
        {
          text: "Não",
          style: "cancel"
        },
        {
          text: "Sim",
          onPress: async () => {
            setIsCancelling(true); 
            try {
              const batch = writeBatch(db); 
              const pedidoRef = doc(db, "pedidos", pedidoId);

              
              batch.update(pedidoRef, {
                status: 'cancelled',
                statusAtualizadoEm: new Date(), 
              });

              
              if (pedido.carrinho && pedido.carrinho.length > 0) {
                for (const item of pedido.carrinho) {
                  const productId = item.produtoId || item.id; 
                  if (productId) {
                    const productRef = doc(db, "produtos", productId);
                 
                    const productSnap = await getDoc(productRef);
                    if (productSnap.exists()) {
                      const currentStock = productSnap.data().estoque || 0;
                      const newStock = currentStock + item.quantidade;
                      batch.update(productRef, { estoque: newStock });
                    } else {
                      console.warn(`Produto com ID ${productId} não encontrado para reverter estoque.`);
                    }
                  }
                }
              }

              await batch.commit(); 
              Alert.alert("Sucesso", "Pedido cancelado e estoque restaurado!");
              
              setPedido(prevPedido => ({ ...prevPedido, status: 'cancelled' }));
            } catch (error) {
              console.error("Erro ao cancelar pedido e restaurar estoque:", error);
              Alert.alert("Erro", "Não foi possível cancelar o pedido e restaurar o estoque.");
            } finally {
              setIsCancelling(false); 
            }
          }
        }
      ]
    );
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>Carregando detalhes do pedido...</Text>
      </View>
    );
  }

  if (!pedido) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Detalhes do pedido não disponíveis.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  let fornecedorHeaderText = '';
  if (pedido.fornecedores && pedido.fornecedores.length > 0) {
    if (pedido.fornecedores.length === 1) {
      fornecedorHeaderText = `Fornecedor: ${pedido.fornecedores[0]}`;
    } else {
      fornecedorHeaderText = `Fornecedores: ${pedido.fornecedores.join(', ')}`;
    }
  } else {
    fornecedorHeaderText = 'Fornecedor: Desconhecido';
  }

  const canCancel = pedido.status?.toLowerCase() === 'pending' || pedido.status?.toLowerCase() === 'pending_payment';

  return (
    <SafeAreaView style={styles.fullScreen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes do Pedido</Text>
        <Text style={{ width: 40 }}></Text>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={styles.fornecedorHeader}>{fornecedorHeaderText}</Text>
        <Text style={styles.pedidoIdDisplay}>ID do Pedido: #{pedido.id.substring(0, 8)}</Text>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={[styles.infoValue, getStatusStyle(pedido.status)]}>{translateStatus(pedido.status)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Data do Pedido:</Text>
            <Text style={styles.infoValue}>{formatarData(pedido.criadoEm)}</Text>
          </View>
          <View style={styles.infoRowAddress}>
            <Text style={styles.infoLabel}>Endereço de Entrega:</Text>
            <Text style={styles.infoValueAddress}>{pedido.enderecoEntrega || 'Não informado'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Forma de Pagamento:</Text>
            <Text style={styles.infoValue}>{pedido.formaPagamento || 'Não informada'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CPF do Cliente:</Text>
            <Text style={styles.infoValue}>{pedido.cpfCliente || 'Não informado'}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Resumo de Valores:</Text>
        <View style={styles.summaryDetailsContainer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal Produtos:</Text>
            <Text style={styles.summaryValue}>R$ {pedido.subtotal?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxa de Serviço:</Text>
            <Text style={styles.summaryValue}>R$ {pedido.taxaServico?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Frete:</Text>
            <Text style={styles.summaryValue}>R$ {pedido.frete?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total do Pedido:</Text>
            <Text style={styles.totalValue}>R$ {pedido.total?.toFixed(2) || '0.00'}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Itens do Pedido:</Text>
        {pedido.carrinho && pedido.carrinho.length > 0 ? (
          pedido.carrinho.map((cartItem, index) => (
            <View key={index} style={styles.productItem}>
              <Text style={styles.productName}>{cartItem.nome}</Text>
              <Text style={styles.productDetails}>{cartItem.quantidade}x - R$ {(cartItem.preco * cartItem.quantidade).toFixed(2)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noProductText}>Nenhum item encontrado neste pedido.</Text>
        )}

        {pedido.qrCodePix ? (
          <View style={styles.pixSection}>
            <Text style={styles.pixTitle}>Código PIX para Pagamento:</Text>
            <Text style={styles.pixCode}>{pedido.qrCodePix}</Text>
            <TouchableOpacity style={styles.copyPixButton} onPress={handleCopyPix}>
              <Icon name="content-copy" size={20} color="#FFFFFF" />
              <Text style={styles.copyPixButtonText}>Copiar Código PIX</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.noPixText}>Código PIX não disponível para este pedido.</Text>
        )}

        
        {canCancel && (
          <TouchableOpacity
            style={[styles.cancelButton, isCancelling && styles.cancelButtonDisabled]}
            onPress={handleCancelOrder}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.cancelButtonText}>Cancelar Pedido</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 30, 
  },
  fornecedorHeader: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
    textAlign: 'left',
  },
  pedidoIdDisplay: {
    fontSize: 14,
    color: '#777',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  infoSection: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoRowAddress: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
    flex: 1,
    marginRight: 10,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  infoValueAddress: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 2,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 5,
  },
  summaryDetailsContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 15,
    color: '#666',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
    marginTop: 5,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0F9D58',
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  productName: {
    fontSize: 15,
    color: '#555',
    flex: 2,
  },
  productDetails: {
    fontSize: 15,
    color: '#555',
    textAlign: 'right',
    flex: 1,
  },
  noProductText: {
    fontSize: 15,
    color: '#999',
    fontStyle: 'italic',
  },
  pixSection: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pixTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  pixCode: {
    fontSize: 16,
    color: '#555',
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 10,
    backgroundColor: '#eee',
    borderRadius: 5,
    width: '100%',
    marginBottom: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo-Regular' : 'monospace',
  },
  copyPixButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  copyPixButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  noPixText: {
    fontSize: 15,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  
  cancelButton: {
    backgroundColor: '#FF3D59', 
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButtonDisabled: {
    backgroundColor: '#FF8A9B', 
  },
});