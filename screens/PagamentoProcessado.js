import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native'; 
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';


const IMAGEM_DE_FUNDO = require('../img/confirmação de pagamento.png');


const { width, height } = Dimensions.get('window');

const PagamentoProcessadoScreen = () => {
  const navigation = useNavigation();
  // route não é estritamente necessário nesta versão simplificada, mas mantido.
  const route = useRoute(); 

  const [imageError, setImageError] = useState(false); 
  useEffect(() => {
    if (route.params?.pedidoId) {
      atualizarStatusPedido(route.params.pedidoId);
    }
  }, [route.params?.pedidoId]);

  const atualizarStatusPedido = async (pedidoId) => {
    try {
      const pedidoRef = doc(db, 'pedidos', pedidoId);
      await updateDoc(pedidoRef, {
        status: 'approved',
        dataAprovacao: new Date(),
      });
      console.log('Status do pedido atualizado para "approved" no Firestore.');
    } catch (error) {
      console.error('Erro ao atualizar status do pedido:', error);
    }
  };

  return (
    <View style={styles.container}>
      {imageError ? (
        // Se houver um erro no carregamento da imagem, mostre um texto de erro
        <Text style={styles.imageErrorText}>Erro ao carregar imagem de fundo.</Text>
      ) : (
        // Componente Image para exibir a imagem de fundo
        <Image 
          source={IMAGEM_DE_FUNDO} 
          style={styles.backgroundImage} 
          resizeMode="cover" 
          onError={(e) => {
            console.error("PagamentoProcessadoScreen: Erro ao carregar a imagem de fundo:", e.nativeEvent.error);
            setImageError(true); 
          }}
        />
      )}
      
      {/* Conteúdo sobreposto na imagem */}
      <View style={styles.overlayContent}>
        <Text style={styles.successText}>Pagamento Processado!</Text>
        {/* Subtítulo removido conforme solicitado */}
        {/* Você pode adicionar um botão para o usuário voltar para a home ou ver o histórico de pedidos */}
        {/* Exemplo de botão:
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.button}>
          <Text style={styles.buttonText}>Voltar para a Home</Text>
        </TouchableOpacity>
        */}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#E8F5E9', 
  },
  backgroundImage: {
    position: 'absolute', 
    top: 0,
    left: 0,
    width: width,
    height: height,
  },
  overlayContent: {
   
    position: 'absolute',
    bottom: height * 0.15, 
    width: '100%',
    alignItems: 'center',
  },
  imageErrorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    padding: 20,
    backgroundColor: '#FFEEF0',
    borderRadius: 10,
  },
  successText: {
    fontSize: 30, 
    fontWeight: 'bold',
    color: '#006400', 
    textAlign: 'center',
    marginBottom: 0, 
    textShadowColor: 'rgba(0, 0, 0, 0.3)', 
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  
});

export default PagamentoProcessadoScreen;
