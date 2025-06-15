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
      setCarrinho([]); // garante que não vai quebrar
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
    atualizarCarrinhoNaHome?.(novoCarrinho); // <-- aqui também
  };

  const renderItem = ({ item }) => {
    const total = (item.preco * item.quantidade).toFixed(2);

    return (
      <View style={styles.itemContainer}>
        <Image source={{ uri: item.imagem }} style={styles.imagem} />
        <View style={styles.infoContainer}>
          <Text style={styles.nome}>{item.nome}</Text>
          <Text>Preço un: R$ {item.preco.toFixed(2)}</Text>

          <View style={styles.qtdContainer}>
            <TouchableOpacity
              style={styles.qtdButton}
              onPress={() => alterarQuantidade(item.id, "menos")}
            >
              <Text style={styles.qtdButtonText}>-</Text>
            </TouchableOpacity>

            <Text style={styles.qtdTexto}>{item.quantidade}</Text>

            <Text style={styles.estoqueInfo}>/ {item.estoque}</Text>
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image
            source={require("../img/Left2.png")} // use o ícone da seta verde
            style={styles.backIcon}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Carrinho</Text>
        <TouchableOpacity onPress={() => {}}>
          <Image
            source={require("../img/Edit1.png")} // use o ícone de lápis
            style={styles.editIcon}
          />
        </TouchableOpacity>
      </View>
      {carrinho.length > 0 ? (
        <FlatList
          data={carrinho}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: hp("4%"),
    paddingHorizontal: wp("4%"),
  },
  headerTitle: {
    fontSize: hp("3%"),
    fontWeight: "bold",
    alignSelf: "flex-start",
  },
  backIcon: {
    width: wp("6%"),
    height: wp("6%"),
  },
  editIcon: {
    width: wp("6%"),
    height: wp("6%"),
  },
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 16 },
  itemContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 12,
    alignItems: "center",
  },
  imagem: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#eee",
  },
  infoContainer: { flex: 1 },
  nome: { fontSize: 18, fontWeight: "bold" },
  total: { fontWeight: "bold", marginTop: 4 },
  vazio: { fontSize: 16, color: "gray", textAlign: "center", marginTop: 20 },

  qtdContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 8,
  },
  qtdButton: {
    backgroundColor: "#ccc",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  qtdButtonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  qtdTexto: {
    fontSize: 16,
    width: 30,
    textAlign: "center",
    fontWeight: "bold",
  },
  estoqueInfo: {
    color: "gray",
    fontSize: 14,
  },

  removerBotao: {
    marginTop: 6,
    backgroundColor: "#e74c3c",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  removerTexto: {
    color: "#fff",
    fontWeight: "bold",
  },

  totalContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  totalText: {
    fontSize: 17,
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
