// screens/DetalhesReceitaScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, Alert } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig'; 
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function DetalhesReceitaScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { receitaId } = route.params;

  const [receita, setReceita] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReceitaDetails = async () => {
      if (!receitaId) {
        Alert.alert("Erro", "ID da receita não fornecido.");
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, "receitas", receitaId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setReceita({
            id: docSnap.id,
            ...data,
            criadoEm: data.criadoEm?.toDate ? data.criadoEm.toDate().toISOString() : data.criadoEm,
          });
          console.log("Detalhes da receita carregados:", data);
        } else {
          Alert.alert("Erro", "Receita não encontrada.");
        }
      } catch (error) {
        console.error("Erro ao buscar detalhes da receita:", error);
        Alert.alert("Erro", "Não foi possível carregar os detalhes da receita.");
      } finally {
        setLoading(false);
      }
    };

    fetchReceitaDetails();
  }, [receitaId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#69A461" />
        <Text>{'Carregando detalhes da receita...'}</Text>
      </View>
    );
  }

  if (!receita) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{'Detalhes da receita não disponíveis.'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{'Voltar'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.fullScreen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'Detalhes da Receita'}</Text>
        <Text style={{ width: 40 }}></Text>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={styles.recipeTitle}>{receita.nome}</Text>
        {receita.imageUrl ? (
          <Image source={{ uri: receita.imageUrl }} style={styles.recipeImage} />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>{'Sem Imagem'}</Text>
          </View>
        )}
        {receita.descricao && (
          <Text style={styles.descriptionText}>{receita.descricao}</Text>
        )}

        <Text style={styles.sectionTitle}>{'Ingredientes:'}</Text>
        {receita.ingredientes && receita.ingredientes.length > 0 ? (
          receita.ingredientes.map((ingrediente, index) => (
            <Text key={index} style={styles.listItem}>• {ingrediente}</Text>
          ))
        ) : (
          <Text style={styles.noInfoText}>{'Nenhum ingrediente listado.'}</Text>
        )}

        <Text style={styles.sectionTitle}>{'Instruções:'}</Text>
        {receita.instrucoes && receita.instrucoes.length > 0 ? (
          receita.instrucoes.map((instrucao, index) => (
            <Text key={index} style={styles.listItem}>• {instrucao}</Text>
          ))
        ) : (
          <Text style={styles.noInfoText}>{'Nenhuma instrução fornecida.'}</Text>
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
  recipeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  recipeImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: '#eee',
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
