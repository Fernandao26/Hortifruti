// screens/AdminScreen.js
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import ProdutosAtivos from '../components/ProdutosAtivos';
import GraficoDashboard from '../GraficoDashboard';

export default function AdminScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>📊 Dashboard</Text>

      <Text style={{ marginTop: 20 }}>📦 Produtos Ativos: 3</Text>
      <Text>🛒 Vendidos Hoje: 12</Text>
      <Text>💰 Faturamento Hoje: R$ 67,00</Text>
      <Text>📉 Menor Estoque: Banana – 12 unidades</Text>
      <Text>🔝 Mais Vendido: Manga – 20 unidades</Text>
      <GraficoDashboard ativos={ativos.length} vendidos={vendidos.length} valorTotalVendido={totalVendidoEmReais} />

      <GraficoDashboard />
      <ProdutosAtivos />
    </ScrollView>
  );
}
