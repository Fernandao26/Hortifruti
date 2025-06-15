import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
} from "react-native";
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";
import { wp, hp } from "../src/utils/responsive";

export default function CarrinhoScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  const { carrinho: carrinhoInicial = [], atualizarCarrinhoNaHome } =
    route.params || {};
  const [carrinho, setCarrinho] = useState([]);

  useEffect(() => {
    if (Array.isArray(carrinhoInicial)) {
      setCarrinho(carrinhoInicial);
    } else {
      setCarrinho([]);
    }
  }, [carrinhoInicial]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (atualizarCarrinhoNaHome) {
          atualizarCarrinhoNaHome(carrinho);
        }
      };
    }, [carrinho])
  );

  const calcularTotalCarrinho = () => {
    return carrinho
      .reduce((total, item) => total + item.preco * item.quantidade, 0)
      .toFixed(2);
  };

  const alterarQuantidade = (id, operacao) => {
    const novoCarrinho = carrinho.map((item) => {
      if (item.id === id) {
        let novaQtd = item.quantidade;
        const estoqueDisponivel = item.estoque || 99;

        if (operacao === "mais" && novaQtd < estoqueDisponivel) {
          novaQtd++;
        } else if (operacao === "menos" && novaQtd > 1) {
          novaQtd--;
        }

        return { ...item, quantidade: novaQtd };
      }
      return item;
    });

    setCarrinho(novoCarrinho);
    atualizarCarrinhoNaHome?.(novoCarrinho);
  };

  const removerItem = (id) => {
    const novoCarrinho = carrinho.filter((item) => item.id !== id);
    setCarrinho(novoCarrinho);
    atualizarCarrinhoNaHome?.(novoCarrinho);
  };

  const renderItem = ({ item }) => {
    const total = (item.preco * item.quantidade).toFixed(2);

    return (
      <View style={styles.itemContainer}>
        <Image source={{ uri: item.imagem }} style={styles.imagem} />
        <View style={styles.infoContainer}>
          <Text style={styles.nome}>{item.nome}</Text>
          <Text style={styles.preco}>Preço un: R$ {item.preco.toFixed(2)}</Text>
          <View style={styles.qtdContainer}>
            <TouchableOpacity
              style={styles.qtdButton}
              onPress={() => alterarQuantidade(item.id, "menos")}
            >
              <Text style={styles.qtdButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.qtdTexto}>{item.quantidade}</Text>
            <Text style={styles.estoqueInfo}>/ {item.estoque}</Text>
            <TouchableOpacity
              style={styles.qtdButton}
              onPress={() => alterarQuantidade(item.id, "mais")}
            >
              <Text style={styles.qtdButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.total}>Total: R$ {total}</Text>
          <TouchableOpacity
            onPress={() => removerItem(item.id)}
            style={styles.removerBotao}
          >
            <Text style={styles.removerTexto}>Remover</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const totalCarrinho = calcularTotalCarrinho();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Carrinho</Text>
      {carrinho.length > 0 ? (
        <FlatList
          data={carrinho}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: hp("10%") }}
        />
      ) : (
        <Text style={styles.vazio}>Carrinho vazio</Text>
      )}

      <View style={styles.totalContainer}>
        <Text style={styles.totalText}>Total: R$ {totalCarrinho}</Text>
      </View>

      {carrinho.length > 0 && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate("Pagamento", { carrinho })}
        >
          <Text style={styles.buttonText}>Ir para Pagamento</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: wp("4%") },
  title: { fontSize: hp("3%"), fontWeight: "bold", marginBottom: hp("2%") },
  itemContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ccc",
    paddingVertical: hp("2%"),
    alignItems: "center",
  },
  imagem: {
    width: wp("18%"),
    height: wp("18%"),
    borderRadius: wp("2%"),
    marginRight: wp("4%"),
    backgroundColor: "#eee",
  },
  infoContainer: { flex: 1 },
  nome: { fontSize: hp("2.2%"), fontWeight: "bold" },
  preco: { fontSize: hp("1.8%"), marginTop: hp("0.5%") },
  total: { fontWeight: "bold", marginTop: hp("1%"), fontSize: hp("2%") },
  vazio: {
    fontSize: hp("2%"),
    color: "gray",
    textAlign: "center",
    marginTop: hp("3%"),
  },
  qtdContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: hp("1%"),
    gap: wp("2%"),
  },
  qtdButton: {
    backgroundColor: "#ccc",
    paddingHorizontal: wp("3%"),
    paddingVertical: hp("0.5%"),
    borderRadius: wp("2%"),
  },
  qtdButtonText: {
    fontSize: hp("2.5%"),
    fontWeight: "bold",
  },
  qtdTexto: {
    fontSize: hp("2%"),
    width: wp("8%"),
    textAlign: "center",
    fontWeight: "bold",
  },
  estoqueInfo: {
    color: "gray",
    fontSize: hp("1.8%"),
  },
  removerBotao: {
    marginTop: hp("1%"),
    backgroundColor: "#e74c3c",
    paddingVertical: hp("1%"),
    paddingHorizontal: wp("3%"),
    borderRadius: wp("2%"),
    alignSelf: "flex-start",
  },
  removerTexto: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: hp("1.8%"),
  },
  totalContainer: {
    marginTop: hp("2%"),
    alignItems: "center",
  },
  totalText: {
    fontSize: hp("2.2%"),
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#4CAF50",
    paddingVertical: hp("1.8%"),
    borderRadius: wp("2%"),
    marginTop: hp("2%"),
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: hp("2.2%"),
    fontWeight: "bold",
  },
});
