import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export default function PromoverAdminScreen({ navigation }) {
  const [uidParaPromover, setUidParaPromover] = useState('');
  const [usuarioAtualEhAdmin, setUsuarioAtualEhAdmin] = useState(false);

  useEffect(() => {
    const verificarPermissao = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
      if (userDoc.exists() && userDoc.data().tipo === 'admin') {
        setUsuarioAtualEhAdmin(true);
      } else {
        Alert.alert('Acesso negado', 'Você não tem permissão para acessar esta tela.');
        navigation.goBack();
      }
    };

    verificarPermissao();
  }, []);

  const promover = async () => {
    if (!uidParaPromover.trim()) {
      Alert.alert('Erro', 'Informe a UID do usuário.');
      return;
    }

    try {
      const userRef = doc(db, 'usuarios', uidParaPromover.trim());
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        Alert.alert('Erro', 'Usuário não encontrado.');
        return;
      }

      await updateDoc(userRef, { tipo: 'admin' });
      Alert.alert('Sucesso', 'Usuário promovido a admin!');
      setUidParaPromover('');
    } catch (error) {
      Alert.alert('Erro', 'Falha ao promover: ' + error.message);
    }
  };
  promoverParaAdmin('Iie3nBEdmUWKumc4BzGPRoHqJ1q2');
  if (!usuarioAtualEhAdmin) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Promover Usuário a Admin</Text>
      <TextInput
        style={styles.input}
        placeholder="Digite a UID do usuário"
        value={uidParaPromover}
        onChangeText={setUidParaPromover}
      />
      <TouchableOpacity style={styles.botao} onPress={promover}>
        <Text style={styles.textoBotao}>Promover</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  botao: {
    backgroundColor: 'green',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  textoBotao: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
