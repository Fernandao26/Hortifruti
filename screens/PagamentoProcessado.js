import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native'; // Mantido para consistência

// --- A sua imagem local da pasta 'img' ---
// O nome exato que você confirmou: confirmação de pagamento.png
const IMAGEM_DE_FUNDO = require('../img/confirmação de pagamento.png');

// Obter as dimensões da tela para garantir que a imagem ocupe a tela inteira
const { width, height } = Dimensions.get('window');

const PagamentoProcessadoScreen = () => {
  const navigation = useNavigation();
  // route não é estritamente necessário nesta versão simplificada, mas mantido.
  // const route = useRoute(); 

  const [imageError, setImageError] = useState(false); // Mantido para depuração de imagem

  return (
    <View style={styles.container}>
      {imageError ? (
        // Se houver um erro no carregamento da imagem, mostre um texto de erro
        <Text style={styles.imageErrorText}>Erro ao carregar imagem de fundo.</Text>
      ) : (
        // Componente Image para exibir a imagem de fundo
        <Image 
          source={IMAGEM_DE_FUNDO} 
          style={styles.backgroundImage} // Usamos um estilo diferente para imagem de fundo
          resizeMode="cover" // Garante que a imagem cubra toda a área
          onError={(e) => {
            console.error("PagamentoProcessadoScreen: Erro ao carregar a imagem de fundo:", e.nativeEvent.error);
            setImageError(true); // Define o estado de erro da imagem
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
    justifyContent: 'center', // Centraliza conteúdo verticalmente se não for full screen
    alignItems: 'center', // Centraliza conteúdo horizontalmente
    backgroundColor: '#E8F5E9', // Fundo de fallback caso a imagem não carregue
  },
  backgroundImage: {
    position: 'absolute', // Faz a imagem cobrir toda a tela
    top: 0,
    left: 0,
    width: width,
    height: height,
  },
  overlayContent: {
    // Estilos para posicionar o texto
    position: 'absolute',
    bottom: height * 0.15, // Ajuste este valor para mover o texto para cima/baixo
    width: '100%',
    alignItems: 'center', // Centraliza o texto horizontalmente
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
    fontSize: 30, // Ajustado para ser mais compacto
    fontWeight: 'bold',
    color: '#006400', // Um verde escuro forte para contraste com a imagem
    textAlign: 'center',
    marginBottom: 0, // Removido espaçamento extra
    textShadowColor: 'rgba(0, 0, 0, 0.3)', // Sombra para o texto para melhor legibilidade
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  // O estilo subtitleText foi removido
});

export default PagamentoProcessadoScreen;
