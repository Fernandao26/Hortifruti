// screens/DicasScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image, Alert } from 'react-native';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig'; 
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const DicasScreen = () => {
  const [dicas, setDicas] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    const q = query(
      collection(db, 'dicas'),
      orderBy('criadoEm', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dicasList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id, 
          ...data,
          criadoEm: data.criadoEm?.toDate ? data.criadoEm.toDate().toISOString() : data.criadoEm,
        };
      });
      setDicas(dicasList);
      setLoading(false);
      console.log("DicasScreen: Dicas carregadas em tempo real.");
    }, (error) => {
      console.error("DicasScreen: Erro ao carregar dicas:", error);
      setLoading(false);
      Alert.alert("Erro", "Não foi possível carregar as dicas.");
    });

    return () => unsubscribe(); 
  }, []);

  const renderDicaItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('DetalhesDica', { dicaId: item.id })}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.dicaImage} />
      ) : (
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderText}>{'Sem Imagem'}</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.dicaTitle}>{item.titulo}</Text>
        {item.descricao && <Text style={styles.dicaDescription}>{item.descricao}</Text>}
        <Text style={styles.viewDetailsLink}>{'Ver Dica Completa →'}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#69A461" />
        <Text>{'Carregando dicas...'}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.fullScreen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'Dicas Saudáveis'}</Text>
        <Text style={{ width: 40 }}></Text>
      </View>

      {dicas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="lightbulb-on-outline" size={80} color="#ccc" />
          {/* Apenas uma pequena alteração para forçar reprocessamento */}
          <Text style={styles.emptyText}>{'Nenhuma dica disponível no momento. Tente novamente mais tarde.'}</Text> 
          <Text style={styles.emptySubText}>{'Adicione novas dicas no Firestore para vê-las aqui!'}</Text>
        </View>
      ) : (
        <FlatList
          data={dicas}
          renderItem={renderDicaItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
};

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
  emptySubText: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dicaImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 15,
    backgroundColor: '#eee',
  },
  placeholderImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 15,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  cardContent: {
    flex: 1,
  },
  dicaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  dicaDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  viewDetailsLink: {
    color: '#007AFF',
    marginTop: 5,
    textAlign: 'right',
    textDecorationLine: 'underline',
    fontSize: 14,
  },
});

export default DicasScreen;
