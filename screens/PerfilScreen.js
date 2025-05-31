import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';

export default function PerfilScreen() {
  const [usuario, setUsuario] = useState(null);
  const [editando, setEditando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  // Campos editáveis
  const [telefone, setTelefone] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

  const navigation = useNavigation();

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const uid = auth.currentUser.uid;
        const docRef = doc(db, 'users', uid);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const dados = snapshot.data();
          setUsuario(dados);
          setTelefone(dados.telefone || '');
          setCep(dados.cep || '');
          setEndereco(dados.endereco || '');
          setNumero(dados.numero || '');
          setComplemento(dados.complemento || '');
          setBairro(dados.bairro || '');
          setCidade(dados.cidade || '');
          setEstado(dados.estado || '');
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        Alert.alert('Erro ao carregar dados');
      } finally {
        setCarregando(false);
      }
    };

    carregarDados();
  }, []);

  const formatarTelefone = (valor) => {
    return valor
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  };

  const buscarEnderecoPorCep = async (cepDigitado) => {
    try {
      const resposta = await axios.get(`https://viacep.com.br/ws/${cepDigitado}/json/`);
      if (resposta.data.erro) {
        Alert.alert('CEP inválido');
      } else {
        setEndereco(resposta.data.logradouro || '');
        setBairro(resposta.data.bairro || '');
        setCidade(resposta.data.localidade || '');
        setEstado(resposta.data.uf || '');
      }
    } catch (error) {
      Alert.alert('Erro ao buscar o CEP');
    }
  };

  const salvarEdicao = async () => {
    if (cep.length !== 8) {
      Alert.alert('Digite um CEP válido com 8 números');
      return;
    }

    try {
      const uid = auth.currentUser.uid;
      const docRef = doc(db, 'users', uid);

      await updateDoc(docRef, {
        telefone,
        cep,
        endereco,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
      });

      setEditando(false);
      Alert.alert('Dados atualizados com sucesso!');
    } catch (error) {
      Alert.alert('Erro ao salvar alterações');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      Alert.alert('Erro ao sair');
    }
  };

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text>Carregando...</Text>
      </View>
    );
  }

  if (!usuario) return <Text>Usuário não encontrado</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Meu Perfil</Text>

      <Text style={styles.label}>Nome:</Text>
      <Text style={styles.valor}>{usuario.nome}</Text>

      <Text style={styles.label}>Email:</Text>
      <Text style={styles.valor}>{usuario.email}</Text>

      <Text style={styles.label}>Telefone:</Text>
      {editando ? (
        <TextInput
          value={formatarTelefone(telefone)}
          onChangeText={(texto) => setTelefone(texto.replace(/\D/g, ''))}
          style={styles.input}
          keyboardType="phone-pad"
          maxLength={15}
        />
      ) : (
        <Text style={styles.valor}>{formatarTelefone(telefone)}</Text>
      )}

      <Text style={styles.label}>CEP:</Text>
      {editando ? (
        <TextInput
          value={cep}
          onChangeText={(texto) => {
            const cleanCep = texto.replace(/\D/g, '');
            setCep(cleanCep);
            if (cleanCep.length === 8) buscarEnderecoPorCep(cleanCep);
          }}
          keyboardType="numeric"
          style={styles.input}
          maxLength={8}
        />
      ) : (
        <Text style={styles.valor}>{cep}</Text>
      )}

      <Text style={styles.label}>Endereço:</Text>
      {editando ? (
        <TextInput value={endereco} onChangeText={setEndereco} style={styles.input} />
      ) : (
        <Text style={styles.valor}>{endereco}</Text>
      )}

      <Text style={styles.label}>Número:</Text>
      {editando ? (
        <TextInput value={numero} onChangeText={setNumero} style={styles.input} keyboardType="numeric" />
      ) : (
        <Text style={styles.valor}>{numero}</Text>
      )}

      <Text style={styles.label}>Complemento:</Text>
      {editando ? (
        <TextInput value={complemento} onChangeText={setComplemento} style={styles.input} />
      ) : (
        <Text style={styles.valor}>{complemento}</Text>
      )}

      <Text style={styles.label}>Bairro:</Text>
      {editando ? (
        <TextInput value={bairro} onChangeText={setBairro} style={styles.input} />
      ) : (
        <Text style={styles.valor}>{bairro}</Text>
      )}

      <Text style={styles.label}>Cidade:</Text>
      {editando ? (
        <TextInput value={cidade} onChangeText={setCidade} style={styles.input} />
      ) : (
        <Text style={styles.valor}>{cidade}</Text>
      )}

      <Text style={styles.label}>Estado:</Text>
      {editando ? (
        <TextInput value={estado} onChangeText={setEstado} style={styles.input} maxLength={2} />
      ) : (
        <Text style={styles.valor}>{estado}</Text>
      )}

      {editando ? (
        <Button title="Salvar" onPress={salvarEdicao} color="green" />
      ) : (
        <Button title="Editar Perfil" onPress={() => setEditando(true)} />
      )}

      <View style={{ marginTop: 30 }}>
        <TouchableOpacity style={styles.botao} onPress={() => navigation.navigate('Ajuda')}>
          <Text style={styles.botaoTexto}>Ajuda</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.botao, { backgroundColor: 'red' }]} onPress={handleLogout}>
          <Text style={styles.botaoTexto}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f9f9f9',
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontWeight: 'bold',
    marginTop: 10,
  },
  valor: {
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#fff',
    padding: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 5,
    borderRadius: 5,
  },
  botao: {
    backgroundColor: '#4CAF50',
    padding: 12,
    marginTop: 15,
    borderRadius: 8,
  },
  botaoTexto: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
