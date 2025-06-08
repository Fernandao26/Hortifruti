import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebaseConfig'; // db importado aqui
import { doc, getDoc } from 'firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const handleLogin = async () => {
    if (!email || !senha) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      console.log('UID do usuário logado:', user.uid); // Adicionado para depuração

      // Busca o tipo do usuário no Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
    
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const tipo = userData.tipo;

        console.log('Tipo do usuário no Firestore:', tipo); // Adicionado para depuração

        // Redireciona com base no tipo
        switch (tipo) {
          case 'admin':
            navigation.replace('Admin');
            break;
          case 'fornecedor':
            navigation.replace('Fornecedor');
            break;
          default:
            navigation.replace('Home');
        }
      } else {
        console.log('Documento do usuário não encontrado no Firestore'); // Log para depuração
        Alert.alert('Erro', 'Usuário não encontrado no banco de dados');
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Erro', 'Email ou senha incorretos');
      setEmail('');
      setSenha('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <TextInput
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <View style={styles.passwordContainer}>
        <TextInput
          placeholder="Senha"
          style={styles.passwordInput}
          value={senha}
          onChangeText={setSenha}
          secureTextEntry={!mostrarSenha}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)}>
          <Icon
            name={mostrarSenha ?  'visibility' : 'visibility-off'}
            size={24}
            color="#666"
          />
        </TouchableOpacity>
      </View>
      <Button title="Entrar" onPress={handleLogin} />
      <View style={styles.buttonSpacing}>
        <Button
          title="Cadastrar"
          onPress={() => navigation.navigate('Register')}
        />
        <TouchableOpacity onPress={() => navigation.navigate('RedefinirSenha')}>
          <Text style={styles.forgotPasswordText}>Esqueceu sua Senha?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    paddingHorizontal: 10,
    marginBottom: 15,
    borderRadius: 5,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    height: 40,
    marginBottom: 15,
  },
  forgotPasswordText: {
    color: 'blue',
    textAlign: 'right',
    marginBottom: 15,
    textDecorationLine: 'underline',
  },
  passwordInput: {
    flex: 1,
  },
  buttonSpacing: {
    marginTop: 10,
  },
});
