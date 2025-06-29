// screens/DetalhesDicaScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, Alert } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig'; // Garanta que 'db' está sendo importado de firebaseConfig
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function DetalhesDicaScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { dicaId } = route.params; // Pega o ID da dica passado pela rota

  const [dica, setDica] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDicaDetails = async () => {
      if (!dicaId) {
        Alert.alert("Erro", "ID da dica não fornecido.");
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, "dicas", dicaId); // Referência ao documento da dica
        const docSnap = await getDoc(docRef); // Busca o documento

        if (docSnap.exists()) {
          const data = docSnap.data();
          setDica({
            id: docSnap.id,
            ...data,
            criadoEm: data.criadoEm?.toDate ? data.criadoEm.toDate().toISOString() : data.criadoEm,
          });
          console.log("Detalhes da dica carregados:", data);
        } else {
          Alert.alert("Erro", "Dica não encontrada.");
        }
      } catch (error) {
        console.error("Erro ao buscar detalhes da dica:", error);
        Alert.alert("Erro", "Não foi possível carregar os detalhes da dica.");
      } finally {
        setLoading(false);
      }
    };

    fetchDicaDetails();
  }, [dicaId]); // Executa quando o ID da dica muda

  // Exibe um indicador de carregamento
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#69A461" />
        <Text>{'Carregando detalhes da dica...'}</Text>
      </View>
    );
  }

  // Exibe mensagem se a dica não for encontrada
  if (!dica) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{'Detalhes da dica não disponíveis.'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{'Voltar'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.fullScreen}>
      {/* Cabeçalho da tela */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'Detalhes da Dica'}</Text>
        <Text style={{ width: 40 }}></Text> {/* Espaçador */}
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={styles.dicaTitle}>{dica.titulo}</Text>
        {/* Exibe a imagem da dica ou um placeholder */}
        {dica.imageUrl ? (
          <Image source={{ uri: dica.imageUrl }} style={styles.dicaImage} />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>{'Sem Imagem'}</Text>
          </View>
        )}
        {/* Exibe a descrição completa */}
        {dica.descricaoCompleta && (
          <Text style={styles.descriptionText}>{dica.descricaoCompleta}</Text>
        )}
        {/* Se houver uma lista de pontos/tópicos, exibe-os */}
        {dica.pontosChave && dica.pontosChave.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>{'Pontos Principais:'}</Text>
            {dica.pontosChave.map((ponto, index) => (
              <Text key={index} style={styles.listItem}>• {ponto}</Text>
            ))}
          </View>
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
  },
  dicaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  dicaImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: '#eee', // Fundo de placeholder
  },
  placeholderImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  descriptionText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    textAlign: 'justify',
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
  listItem: {
    fontSize: 16,
    color: '#444',
    marginBottom: 5,
    lineHeight: 22,
  },
  noInfoText: {
    fontSize: 15,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 5,
  },
});
