import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

export default function DashboardScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>📊 Dashboard</Text>

      {/* Visão do Produto */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Visão do produto</Text>
        <Text style={styles.bigNumber}>100</Text>
        <Text style={styles.percentage}>Esse mês +10%</Text>

        <View style={styles.divider} />

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text>Á venda</Text>
            <Text style={styles.statValue}>75</Text>
          </View>
          <View style={styles.statItem}>
            <Text>Vendidos</Text>
            <Text style={styles.statValue}>25</Text>
          </View>
          <View style={styles.statItem}>
            <Text>Total</Text>
            <Text style={styles.statValue}>100</Text>
          </View>
        </View>
      </View>

      {/* Visão da Venda */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Visão da venda</Text>
        <Text style={styles.bigNumber}>100</Text>
        <Text style={styles.percentage}>Esse mês +10%</Text>

        <View style={styles.divider} />

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text>Á venda</Text>
            <Text style={styles.statValue}>75</Text>
          </View>
          <View style={styles.statItem}>
            <Text>Total vendidos</Text>
            <Text style={styles.statValue}>25</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  bigNumber: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 5,
  },
  percentage: {
    color: "green",
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 15,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontWeight: "bold",
    marginTop: 5,
  },
});
