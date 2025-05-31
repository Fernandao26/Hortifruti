// graficodashboard.js
import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit';

export default function GraficoDashboard({ ativos, vendidos, valorTotalVendido }) {
  const pieData = [
    {
      name: 'À Venda',
      population: ativos,
      color: 'green',
      legendFontColor: '#7F7F7F',
      legendFontSize: 15,
    },
    {
      name: 'Vendidos',
      population: vendidos,
      color: 'red',
      legendFontColor: '#7F7F7F',
      legendFontSize: 15,
    },
  ];

  return (
    <View style={{ padding: 10 }}>
      <Text style={{ textAlign: 'center', fontSize: 18, fontWeight: 'bold' }}>Produtos</Text>
      <PieChart
        data={pieData}
        width={Dimensions.get('window').width - 20}
        height={220}
        chartConfig={{
          color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        }}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
      />

      <View style={{ marginTop: 20, paddingHorizontal: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>Resumo Financeiro</Text>
        <Text style={{ fontSize: 14, marginTop: 5 }}>
          Total vendido: <Text style={{ fontWeight: 'bold', color: 'green' }}>R$ {valorTotalVendido.toFixed(2)}</Text>
        </Text>
        <Text style={{ fontSize: 14 }}>
          Ticket médio: <Text style={{ fontWeight: 'bold' }}>R$ {(valorTotalVendido / (vendidos || 1)).toFixed(2)}</Text>
        </Text>
      </View>
    </View>
  );
}
