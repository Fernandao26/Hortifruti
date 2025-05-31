// components/MenuInferior.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function MenuInferior() {
  const navigation = useNavigation();

  return (
    <View style={styles.menuInferior}>
  <TouchableOpacity onPress={() => setTelaAtual('ativos')}>
    <Ionicons name="pricetags" size={24} color="green" />
    <Text style={styles.menuTexto}>Ativos</Text>
  </TouchableOpacity>

  <TouchableOpacity onPress={() => setTelaAtual('vendidos')}>
    <Ionicons name="checkmark-done" size={24} color="green" />
    <Text style={styles.menuTexto}>Vendidos</Text>
  </TouchableOpacity>

  <TouchableOpacity onPress={() => setTelaAtual('cadastro')}>
    <Ionicons name="add-circle" size={24} color="green" />
    <Text style={styles.menuTexto}>Cadastrar</Text>
  </TouchableOpacity>

  <TouchableOpacity onPress={() => setTelaAtual('dashboard')}>
    <Ionicons name="analytics" size={24} color="green" />
    <Text style={styles.menuTexto}>Dashboard</Text>
  </TouchableOpacity>

  <TouchableOpacity onPress={handleLogout}>
    <Ionicons name="log-out" size={24} color="red" />
    <Text style={[styles.menuTexto, { color: 'red' }]}>Sair</Text>
  </TouchableOpacity>
</View>
  );
}

const styles = StyleSheet.create({
  menuInferior: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#ccc',
  },
  menuTexto: {
    fontSize: 12,
    textAlign: 'center',
    color: '#333',
  },
});
