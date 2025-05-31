import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { TextInputMask } from 'react-native-masked-text';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function RegisterScreen({ navigation }) {
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [tipo, setTipo] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  useEffect(() => {
    const fetchEndereco = async () => {
      if (cep.length === 8) {
        try {
          const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const data = await response.json();

          if (!data.erro) {
            setEndereco(data.logradouro);
            setBairro(data.bairro);
            setCidade(data.localidade);
            setEstado(data.uf);
          } else {
            Alert.alert('CEP não encontrado');
          }
        } catch (error) {
          Alert.alert('Erro ao buscar o CEP');
        }
      }
    };

    fetchEndereco();
  }, [cep]);

  const validarSenha = (senha) => {
    const regex = /^(?=.*[A-Z])(?=.*[\W_]).{8,}$/;
    return regex.test(senha);
  };

  const handleRegister = async () => {
    if (
      !nome || !sobrenome || !telefone || !cep || !endereco || !numero ||
      !complemento || !bairro || !cidade || !estado || !tipo || !email || !senha || (tipo === 'fornecedor' && !cnpj)
    ) {
      Alert.alert('Erro', 'Todos os campos são obrigatórios.');
      return;
    }

    if (!validarSenha(senha)) {
      Alert.alert(
        'Senha inválida',
        'A senha deve conter no mínimo 8 caracteres, uma letra maiúscula e um caractere especial.'
      );
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const uid = userCredential.user.uid;

      const userData = {
        nome,
        sobrenome,
        telefone,
        cep,
        endereco,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        tipo,
        email,
      };

      if (tipo === 'fornecedor') {
        userData.cnpj = cnpj;
      
        // Salva também na coleção "fornecedores"
        await setDoc(doc(db, 'fornecedores', uid), {
          uid,
          nome,
          sobrenome,
          telefone,
          cep,
          endereco,
          numero,
          complemento,
          bairro,
          cidade,
          estado,
          email,
          cnpj,
          tipo
        });
      }

      await setDoc(doc(db, 'users', uid), userData);

      Alert.alert('Sucesso', 'Usuário cadastrado com sucesso!');
      navigation.replace('Login');
    } catch (error) {
      console.log(error.code, error.message);
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert('Erro', 'Este e-mail já está em uso.');
      } else {
        Alert.alert('Erro ao cadastrar', error.message);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Cadastro</Text>

          <TextInput placeholder="Nome" style={styles.input} value={nome} onChangeText={setNome} />
          <TextInput placeholder="Sobrenome" style={styles.input} value={sobrenome} onChangeText={setSobrenome} />

          <TextInputMask
            type={'cel-phone'}
            options={{ maskType: 'BRL', withDDD: true, dddMask: '(99) ' }}
            placeholder="Telefone"
            style={styles.input}
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
          />

          <TextInput
            placeholder="CEP"
            style={styles.input}
            value={cep}
            onChangeText={(text) => setCep(text.replace(/\D/g, ''))}
            keyboardType="numeric"
          />

          <TextInput placeholder="Endereço" style={styles.input} value={endereco} onChangeText={setEndereco} />
          <TextInput placeholder="Número" style={styles.input} value={numero} onChangeText={setNumero} keyboardType="numeric" />
          <TextInput placeholder="Complemento" style={styles.input} value={complemento} onChangeText={setComplemento} />
          <TextInput placeholder="Bairro" style={styles.input} value={bairro} onChangeText={setBairro} />
          <TextInput placeholder="Cidade" style={styles.input} value={cidade} onChangeText={setCidade} />
          <TextInput placeholder="Estado" style={styles.input} value={estado} onChangeText={setEstado} />

          <Text style={styles.label}>Tipo de usuário:</Text>
          <Picker
            selectedValue={tipo}
            onValueChange={(itemValue) => setTipo(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Selecione..." value="" />
            <Picker.Item label="Cliente" value="cliente" />
            <Picker.Item label="Fornecedor" value="fornecedor" />
          </Picker>

          {tipo === 'fornecedor' && (
            <TextInputMask
              type={'cnpj'}
              placeholder="CNPJ"
              style={styles.input}
              value={cnpj}
              onChangeText={setCnpj}
              keyboardType="numeric"
            />
          )}

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
            />
            <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)}>
              <Icon
                name={mostrarSenha ? 'visibility-off' : 'visibility'}
                size={24}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.senhaRegras}>
            A senha deve ter no mínimo 8 caracteres, uma letra maiúscula e um caractere especial.
          </Text>

          <View style={styles.buttonContainer}>
            <Button title="Cadastrar" onPress={handleRegister} />
          </View>

          <View style={styles.buttonContainer}>
            <Button title="Já tem conta? Fazer login" onPress={() => navigation.replace('Login')} />
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff', flexGrow: 1 },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
  input: {
    height: 45,
    borderColor: '#ccc',
    borderWidth: 1,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  picker: {
    height: 50,
    marginBottom: 10,
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  senhaRegras: {
    fontSize: 12,
    color: 'gray',
    marginBottom: 10,
  },
  buttonContainer: {
    marginVertical: 5,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    height: 45,
    marginBottom: 10,
  },
  passwordInput: {
    flex: 1,
  },
});
