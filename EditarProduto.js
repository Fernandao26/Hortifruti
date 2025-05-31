// editarproduto.js
import React from 'react';
import { View, Text, TextInput, Button, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';

export default function EditarProduto({
  nome, setNome,
  categoria, setCategoria,
  preco, setPreco,
  estoque, setEstoque,
  onSalvar
}) {
  return (
    <ScrollView style={{ padding: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Cadastrar Produto</Text>

      <TextInput placeholder="Nome" value={nome} onChangeText={setNome} style={{ borderBottomWidth: 1, marginBottom: 10 }} />

      <Picker selectedValue={categoria} onValueChange={setCategoria} style={{ marginBottom: 10 }}>
        <Picker.Item label="Selecione a categoria" value="" />
        <Picker.Item label="Frutas" value="frutas" />
        <Picker.Item label="Verduras" value="verduras" />
        <Picker.Item label="Legumes" value="legumes" />
      </Picker>

      <TextInput placeholder="Preço" value={preco} onChangeText={setPreco} keyboardType="decimal-pad" style={{ borderBottomWidth: 1, marginBottom: 10 }} />
      <TextInput placeholder="Estoque" value={estoque} onChangeText={setEstoque} keyboardType="numeric" style={{ borderBottomWidth: 1, marginBottom: 20 }} />

      <Button title="Salvar Produto" onPress={onSalvar} color="green" />
    </ScrollView>
  );
}
