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
    const qtd = quantidades[item.id] || 0;
    const precoValido =
      item.preco && !isNaN(item.preco) ? Number(item.preco) : 0;
    const total = (precoValido * qtd).toFixed(2);
    const estoque = item.estoque ?? 0;

    const aumentarQtd = () => {
      if (qtd < estoque) {
        atualizarQuantidade(item.id, 1);
      } else {
        alert(`Limite de estoque atingido (${estoque} unidades)`);
      }
    };

    return (
      <View style={styles.card}>
        <Image source={{ uri: item.imagem }} style={styles.imagem} />
        <Text style={styles.nome}>{item.nome || "Produto sem nome"}</Text>
        <Text style={styles.nome}>{item.categoria || "Sem categoria"}</Text>
        <Text style={styles.fornecedor}>
          Fornecedor: {item.fornecedor || "Não informado"}
        </Text>
        <Text>Preço: R$ {precoValido.toFixed(2)} / un</Text>
        <Text>Estoque: {estoque}</Text>

        <View style={styles.quantidadeContainer}>
          <TouchableOpacity
            onPress={() => atualizarQuantidade(item.id, -1)}
            style={styles.qtdBtn}
          >
            <Text>-</Text>
          </TouchableOpacity>
          <Text style={styles.qtdTexto}>{qtd}</Text>
          <TouchableOpacity onPress={aumentarQtd} style={styles.qtdBtn}>
            <Text>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.total}>Total: R$ {total}</Text>

        <TouchableOpacity
          style={styles.botaoCarrinho}
          onPress={() => adicionarAoCarrinho(item.id)}
        >
          <Text style={styles.botaoTexto}>Adicionar ao carrinho</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const fornecedoresUnicos = [...new Set(produtos.map((p) => p.fornecedor))];

  return (
    <View style={{ flex: 1, paddingTop: 40, backgroundColor: "#f2f2f2" }}>
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
          <View>
            <Ionicons name="cart" size={28} color="green" />
            {Object.keys(carrinho).length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {Object.keys(carrinho).length}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.tituloFiltro}>Filtrar por categoria:</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={categoriaSelecionada}
          onValueChange={(itemValue) => setCategoriaSelecionada(itemValue)}
        >
          <Picker.Item label="Todas as categorias" value="" />
          <Picker.Item label="Frutas" value="Frutas" />
          <Picker.Item label="Legumes" value="Legumes" />
          <Picker.Item label="Verduras" value="Verduras" />
        </Picker>
      </View>

      <Text style={styles.tituloFiltro}>Filtrar por fornecedor:</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={fornecedorSelecionado}
          onValueChange={(itemValue) => setFornecedorSelecionado(itemValue)}
        >
          <Picker.Item label="Todos os fornecedores" value="" />
          {fornecedoresUnicos.map((fornecedor, index) => (
            <Picker.Item key={index} label={fornecedor} value={fornecedor} />
          ))}
        </Picker>
      </View>

      <FlatList
        data={produtosFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.lista}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between" }}
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
});
