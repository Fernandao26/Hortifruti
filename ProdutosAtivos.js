// produtosativos.js
import React from 'react';
import { FlatList, Text, View } from 'react-native';

export default function ProdutosAtivos({ produtos, renderCard, aplicarFiltrosEOrdenacao }) {
  return (
    <FlatList
      data={aplicarFiltrosEOrdenacao(produtos)}
      numColumns={2}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 10 }}
      columnWrapperStyle={{ justifyContent: 'space-between' }}
      ListEmptyComponent={<Text style={{ textAlign: 'center' }}>Nenhum produto à venda</Text>}
      renderItem={renderCard}
    />
  );
}
