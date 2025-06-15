import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Picker } from "@react-native-picker/picker";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { wp, hp } from "../src/utils/responsive";

export default function HomeScreen() {
  const [produtos, setProdutos] = useState([]);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("");
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState("");
  const [quantidades, setQuantidades] = useState({});
  const [carrinho, setCarrinho] = useState({});
  const navigation = useNavigation();

  useEffect(() => {
    const fetchProdutos = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "produtos"));
        const produtosData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProdutos(produtosData);
      } catch (error) {
        console.error("Erro ao buscar produtos:", error);
      }
    };
    fetchProdutos();
  }, []);

  const produtosFiltrados = produtos.filter((p) => {
    const categoriaOk = categoriaSelecionada
      ? p.categoria === categoriaSelecionada
      : true;
    const fornecedorOk = fornecedorSelecionado
      ? p.fornecedor === fornecedorSelecionado
      : true;
    return categoriaOk && fornecedorOk;
  });

  const atualizarQuantidade = (id, delta) => {
    setQuantidades((prev) => {
      const atual = prev[id] || 0;
      const novaQtd = Math.max(0, atual + delta);
      return { ...prev, [id]: novaQtd };
    });
  };

  const adicionarAoCarrinho = async (id) => {
    const produto = produtos.find((p) => p.id === id);
    const qtd = quantidades[id] || 0;

    if (!produto || qtd <= 0) {
      alert("Escolha uma quantidade válida");
      return;
    }

    try {
      await addDoc(collection(db, "carrinho"), {
        produtoId: produto.id,
        nome: produto.nome,
        imagem: produto.imagem,
        preco: Number(produto.preco),
        quantidade: qtd,
        timestamp: new Date(),
      });

      setCarrinho((prev) => ({
        ...prev,
        [id]: {
          id: produto.id,
          nome: produto.nome,
          preco: Number(produto.preco),
          quantidade: qtd,
          imagem: produto.imagem,
        },
      }));
    } catch (error) {
      console.error("Erro ao adicionar ao carrinho:", error);
      alert("Erro ao adicionar ao carrinho");
    }
  };

  const renderItem = ({ item }) => {
    const qtd = quantidades[item.id] || 1;
    const precoValido =
      item.preco && !isNaN(item.preco) ? Number(item.preco) : 0;
    const total = (precoValido * qtd).toFixed(2);
    const estoque = item.estoque ?? 0;

    return (
      <View style={styles.cardHorizontal}>
        <Image
          source={{ uri: item.imagem }}
          style={styles.imagemHorizontal}
          resizeMode="cover"
        />
        <View style={styles.infoContainer}>
          <Text style={styles.nome}>{item.nome || "Produto sem nome"}</Text>
          <Text style={styles.fornecedor}>
            Fornecedor: {item.fornecedor || "Não informado"}
          </Text>
          <Text style={styles.estoque}>Estoque: {estoque}</Text>

          <View style={styles.quantidadeContainer}>
            <TouchableOpacity
              onPress={() => atualizarQuantidade(item.id, -1)}
              style={styles.qtdBtn}
            >
              <Text>-</Text>
            </TouchableOpacity>
            <Text style={styles.qtdTexto}>{qtd}</Text>
            <TouchableOpacity
              onPress={() => {
                if (qtd < estoque) {
                  atualizarQuantidade(item.id, 1);
                } else {
                  alert(`Limite de estoque atingido (${estoque} unidades)`);
                }
              }}
              style={styles.qtdBtn}
            >
              <Text>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.preco}>R$ {precoValido.toFixed(2)}/Uni</Text>
          <Text style={styles.total}>Total: R$ {total}</Text>
        </View>
      </View>
    );
  };

  const fornecedoresUnicos = [...new Set(produtos.map((p) => p.fornecedor))];

  return (
    <View
      style={{
        flex: 1,
        paddingTop: hp("3%"),
        paddingHorizontal: wp("5%"),
        backgroundColor: "#fff",
      }}
    >
      {/* Ícone do carrinho */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          paddingHorizontal: 15,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            navigation.navigate("Carrinho", {
              carrinho: Object.values(carrinho), // transforma objeto em array
              atualizarCarrinhoNaHome: (novoCarrinhoArray) => {
                // transforma o array de volta em objeto para salvar
                const novoObj = {};
                novoCarrinhoArray.forEach((item) => {
                  novoObj[item.id] = item;
                });
                setCarrinho(novoObj);
              },
            });
          }}
        >
          <View style={styles.header}>
            <Image
              source={require("../img/logo.png")} // substitua pelo seu logo
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.iconRow}>
              <TouchableOpacity onPress={() => navigation.navigate("Perfil")}>
                <Ionicons
                  name="person-circle-outline"
                  size={28}
                  color="green"
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate("Carrinho")}>
                <Ionicons name="cart" size={28} color="green" />
                {Object.keys(carrinho).length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {Object.keys(carrinho).length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.tituloFiltro}>Filtrar por Categoria</Text>
      <View style={styles.filtroWrapper}>
        {["Frutas", "Legumes", "Verduras"].map((categoria) => {
          const ativa = categoriaSelecionada === categoria;
          return (
            <TouchableOpacity
              key={categoria}
              onPress={() => setCategoriaSelecionada(categoria)}
              style={[styles.filtroItem, ativa && styles.filtroItemAtivo]}
            >
              <Text
                style={[styles.filtroTexto, ativa && styles.filtroTextoAtivo]}
              >
                {categoria}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.tituloFiltro}>Filtrar por fornecedor</Text>
      <View style={styles.filtroWrapper}>
        {fornecedoresUnicos.map((fornecedor, i) => {
          const ativo = fornecedorSelecionado === fornecedor;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => setFornecedorSelecionado(fornecedor)}
              style={[styles.filtroItem, ativo && styles.filtroItemAtivo]}
            >
              <Text
                style={[styles.filtroTexto, ativo && styles.filtroTextoAtivo]}
              >
                {fornecedor}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={produtosFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.lista}
        numColumns={1}
      />

      {/* Menu inferior */}
      <View style={styles.menuInferior}>
        <TouchableOpacity onPress={() => navigation.navigate("Perfil")}>
          <Ionicons name="person" size={24} color="green" />
          <Text style={styles.menuTexto}>Perfil</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Receitas")}>
          <Ionicons name="restaurant" size={24} color="green" />
          <Text style={styles.menuTexto}>Receitas</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Dicas")}>
          <Ionicons name="bulb" size={24} color="green" />
          <Text style={styles.menuTexto}>Dicas</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lista: {
    padding: 7,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 6,
    marginBottom: 14,
    width: "48%",
    elevation: 2,
  },
  imagem: {
    width: "100%",
    height: 90,
    borderRadius: 8,
    marginBottom: 8,
    objectFit: "contain",
  },
  nome: {
    fontSize: 16,
    fontWeight: "bold",
  },
  fornecedor: {
    fontStyle: "italic",
    color: "#555",
  },
  quantidadeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    justifyContent: "center",
  },
  qtdBtn: {
    borderWidth: 1,
    borderColor: "#ccc",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
  },
  qtdTexto: {
    marginHorizontal: 10,
    fontSize: 16,
  },
  total: {
    fontWeight: "bold",
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center",
  },
  botaoCarrinho: {
    backgroundColor: "green",
    padding: 8,
    borderRadius: 8,
  },
  botaoTexto: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  tituloFiltro: {
    fontSize: 13,
    fontWeight: "bold",
    marginHorizontal: 8,
    marginTop: 4,
    color: "#333",
  },
  pickerContainer: {
    marginHorizontal: 5,
    backgroundColor: "#fff",
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#ccc",
    overflow: "hidden",
    marginBottom: 2,
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -10,
    backgroundColor: "red",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  menuInferior: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#ccc",
    marginBottom: 40,
  },
  menuTexto: {
    fontSize: 12,
    textAlign: "center",
    color: "#333",
  },
  cardHorizontal: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    padding: 10,
    marginHorizontal: 10,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },

  imagemHorizontal: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 10,
  },

  infoContainer: {
    flex: 1,
  },

  nome: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 2,
  },

  fornecedor: {
    fontSize: 12,
    color: "#666",
  },

  estoque: {
    fontSize: 12,
    color: "#666",
    marginBottom: 6,
  },

  quantidadeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  qtdBtn: {
    borderWidth: 1,
    borderColor: "#ccc",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
  },

  qtdTexto: {
    marginHorizontal: 10,
    fontSize: 14,
  },

  preco: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#000",
  },

  total: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#333",
    marginTop: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  logo: {
    width: 100,
    height: 40,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tituloFiltro: {
    fontSize: hp(1.6),
    fontWeight: "bold",
    marginHorizontal: wp(3),
    marginTop: hp(1),
    color: "#333",
  },

  filtroWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginVertical: hp(1),
    paddingHorizontal: wp(3),
  },

  filtroItem: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: wp(10),
    paddingVertical: hp(0.8),
    paddingHorizontal: wp(4),
    backgroundColor: "#fff",
    margin: wp(1.2),
  },

  filtroItemAtivo: {
    backgroundColor: "#69a461",
  },

  filtroTexto: {
    fontSize: hp(1.5),
    color: "#333",
    textAlign: "center",
  },

  filtroTextoAtivo: {
    color: "#fff",
    fontWeight: "bold",
  },
});
