import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ImageBackground,
  Alert,
} from "react-native";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { Picker } from "@react-native-picker/picker";
import {
  useNavigation,
  useRoute,
  useIsFocused,
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { wp, hp } from "../src/utils/responsive";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
const MENU_INFERIOR_HEIGHT = hp("6%");

export default function HomeScreen() {
  const [produtos, setProdutos] = useState([]);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("");
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState("");
  const [quantidades, setQuantidades] = useState({});
  const [carrinho, setCarrinho] = useState({});
  const [fornecedores, setFornecedores] = useState({});
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const fetchDados = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "produtos"));
        const produtosData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProdutos(produtosData);

        // Buscar fornecedores
        const fornecedoresSnapshot = await getDocs(
          collection(db, "fornecedores")
        );
        const dadosFornecedores = {};
        fornecedoresSnapshot.forEach((doc) => {
          const data = doc.data();
          dadosFornecedores[data.email] = data.empresa;
        });
        setFornecedores(dadosFornecedores);
        // Carregar carrinho do Firebase
        // Carregar carrinho do usuário atual
        // Carregar carrinho do usuário atual
        const carregarCarrinho = async () => {
          try {
            const uid = auth.currentUser?.uid;
            if (!uid) return;

            const q = query(
              collection(db, "carrinho"),
              where("uid", "==", uid)
            );
            const snapshot = await getDocs(q);

            const lista = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));

            const carrinhoMap = {};
            lista.forEach((item) => {
              carrinhoMap[item.produtoId] = item;
            });

            setCarrinho(carrinhoMap);
          } catch (error) {
            console.error("Erro ao carregar carrinho:", error);
          }
        };

        // Inicializar quantidades
        const quantidadesIniciais = {};
        produtosData.forEach((p) => {
          quantidadesIniciais[p.id] = 1;
        });
        setQuantidades(quantidadesIniciais);
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      }
    };

    fetchDados();
  }, []);

  useEffect(() => {
    const fetchProdutos = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "produtos"));
        const produtosData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProdutos(produtosData);
        const quantidadesIniciais = {};
        produtosData.forEach((p) => {
          quantidadesIniciais[p.id] = 1;
        });
        setQuantidades(quantidadesIniciais);
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
      const atual = prev[id] || 1;
      const novaQtd = Math.max(1, atual + delta);
      return { ...prev, [id]: novaQtd };
    });
  };

  // Adicionar ao carrinho com `uid`
  const adicionarAoCarrinho = async (id) => {
    const produto = produtos.find((p) => p.id === id);
    const qtd = quantidades[id] || 0;

    if (!produto || qtd <= 0) {
      alert("Escolha uma quantidade válida");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "carrinho"), {
        uid: auth.currentUser.uid, // ✅ Associa ao usuário atual
        produtoId: produto.id,
        nome: produto.nome,
        imagem: produto.imagem,
        preco: Number(produto.preco),
        quantidade: qtd,
        timestamp: new Date(),
        fornecedor: fornecedores[produto.fornecedor], // ✅ Vamos corrigir isso abaixo
      });

      setCarrinho((prev) => ({
        ...prev,
        [id]: {
          id: docRef.id,
          ...produto,
          quantidade: qtd,
          preco: Number(produto.preco),
        },
      }));

      setQuantidades((prev) => ({ ...prev, [id]: 1 }));
      Alert.alert("Produto adicionado ao carrinho");
    } catch (error) {
      console.error("Erro ao adicionar ao carrinho:", error);
      alert("Erro ao adicionar ao carrinho");
    }
  };
  // Substitua dentro do renderItem
  const renderItem = ({ item }) => {
    const qtd = Math.max(1, quantidades[item.id] ?? 1); // Garante quantidade mínima de 1
    const precoValido = item.preco ? Number(item.preco) : 0;
    const total = (precoValido * qtd).toFixed(2);
    const estoque = item.estoque ?? 0;

    const imagemUri =
      typeof item.imagem === "string" && item.imagem.trim() !== ""
        ? item.imagem
        : "https://via.placeholder.com/150";

    const comprado = carrinho[item.id] !== undefined;
    return (
      <View style={styles.itemContainer}>
        <ImageBackground
          source={{ uri: imagemUri }}
          style={styles.imagemHorizontal}
          imageStyle={{ borderRadius: wp(5) }}
          resizeMode="cover"
        />
        <View style={styles.infoContainer}>
          <Text style={styles.nome}>{item.nome || "Produto sem nome"}</Text>
          <Text style={styles.fornecedor}>
            Fornecedor: {fornecedores[item.fornecedor] || "Não informado"}
          </Text>
          <Text style={styles.estoque}>Estoque: {estoque}</Text>

          <View style={styles.quantidadePrecoRow}>
            <View style={styles.quantidadeContainer}>
              <TouchableOpacity
                onPress={() => atualizarQuantidade(item.id, -1)}
                style={styles.qtdBtn}
              >
                <Icon name="minus-circle-outline" size={25} color="#007bff" />
              </TouchableOpacity>

              <Text style={styles.qtdTexto}>{qtd}</Text>

              <TouchableOpacity
                onPress={() => {
                  if (qtd < estoque) {
                    atualizarQuantidade(item.id, 1);
                  } else {
                    alert(
                      `Limite de estoque atingido (${estoque} ${item.tipoPreco})`
                    );
                  }
                }}
                style={styles.qtdBtn}
              >
                <Icon
                  name="plus-circle-outline"
                  size={25}
                  color={qtd > 1 ? "#69a461" : "#007bff"}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.preco}>
              R$ {precoValido.toFixed(2)} /{item.tipoPreco || "Unid"}
            </Text>
          </View>

          <View style={styles.acaoRow}>
            <TouchableOpacity
              style={[
                styles.botaoaddCarrinho,
                { backgroundColor: comprado ? "#28a745" : "#007bff" },
              ]}
              onPress={() => {
                if (qtd <= 0 || isNaN(qtd)) {
                  console.log("Quantidade invalida");
                  Alert.alert("Escolha uma quantidade válida");
                  return;
                }
                adicionarAoCarrinho(item.id);
              }}
            >
              <Text style={styles.botaoTexto}>Comprar</Text>
            </TouchableOpacity>

            <Text style={styles.total}>Total: R$ {total}</Text>
          </View>
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
      <View style={styles.header}>
        <Image
          source={require("../img/logo.png")} // seu logo
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.iconRow}>
          <TouchableOpacity onPress={() => navigation.navigate("Pedidos")}>
            <Image
              source={require("../img/pedido.png")} // Caminho para sua imagem local
              style={{ width: 28, height: 28 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
        <View style={styles.iconRow}>
          <TouchableOpacity onPress={() => navigation.navigate("Perfil")}>
            <Image
              source={require("../img/profilehome.png")} // Caminho para sua imagem local
              style={{ width: 28, height: 28 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              navigation.navigate("Carrinho", {
                carrinho: Object.values(carrinho),
              });
            }}
          >
            <Image
              source={require("../img/Cart.png")} // Caminho para sua imagem local
              style={{ width: 28, height: 28 }}
              resizeMode="contain"
            />
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

      <Text style={styles.tituloFiltro}>Filtrar por categoria</Text>
      <View style={styles.filtroWrapper}>
        <TouchableOpacity
          onPress={() => setCategoriaSelecionada("")}
          style={[
            styles.filtroItem,
            categoriaSelecionada === "" && styles.filtroItemAtivo,
          ]}
        >
          <Text
            style={[
              styles.filtroTexto,
              categoriaSelecionada === "" && styles.filtroTextoAtivo,
            ]}
          >
            Todos
          </Text>
        </TouchableOpacity>

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
      <Text style={styles.tituloFiltro}>Filtrar por Fornecedor</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtroWrapper}
        style={{ marginBottom: hp("1%"), height: hp("11%") }}
      >
        <TouchableOpacity
          onPress={() => setFornecedorSelecionado("")}
          style={[
            styles.filtroItem,
            fornecedorSelecionado === "" && styles.filtroItemAtivo,
          ]}
        >
          <Text
            style={[
              styles.filtroTexto,
              fornecedorSelecionado === "" && styles.filtroTextoAtivo,
            ]}
          >
            Todos
          </Text>
        </TouchableOpacity>

        {fornecedoresUnicos.map((email, i) => {
          const ativo = fornecedorSelecionado === email;
          const nomeEmpresa = fornecedores[email] || "Fornecedor desconhecido";
          return (
            <TouchableOpacity
              key={i}
              onPress={() => setFornecedorSelecionado(email)}
              style={[styles.filtroItem, ativo && styles.filtroItemAtivo]}
            >
              <Text
                style={[styles.filtroTexto, ativo && styles.filtroTextoAtivo]}
              >
                {nomeEmpresa}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={produtos.filter((p) => {
          const categoriaOk = categoriaSelecionada
            ? p.categoria === categoriaSelecionada
            : true;
          const fornecedorOk = fornecedorSelecionado
            ? p.fornecedor === fornecedorSelecionado
            : true;
          return categoriaOk && fornecedorOk;
        })}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        scrollEnabled={true}
      />

      {/* Menu inferior */}
      <View style={styles.menuInferior}>
        <TouchableOpacity onPress={() => navigation.navigate("Perfil")}>
          <Image
            source={require("../img/profilehomedown.png")} // Caminho para sua imagem local
            style={{ width: 28, height: 28 }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Receitas")}>
          <Image
            source={require("../img/receitas.png")} // Caminho para sua imagem local
            style={{ width: 28, height: 28 }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Dicas")}>
          <Image
            source={require("../img/idea.png")} // Caminho para sua imagem local
            style={{ width: 28, height: 28 }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
  console.log("Imagem:", item.imagem);
}

const styles = StyleSheet.create({
  lista: {
    padding: hp("2%"),
  },
  itemContainer: {
    flexDirection: "row",
    paddingVertical: hp(1.7), // um pouco mais de espaço
    paddingHorizontal: wp(1.5),
    borderBottomWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    // centraliza a imagem com o conteúdo
  },
  imagemHorizontal: {
    width: wp(22),
    height: wp(22),

    marginRight: wp(3),
  },

  infoContainer: {
    flex: 1,
    justifyContent: "space-between",
  },

  quantidadePrecoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: hp(1),
  },

  quantidadeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  qtdTexto: {
    marginHorizontal: wp(2),
    fontSize: hp(1.6),
    fontWeight: "bold",
  },

  preco: {
    fontSize: hp(1.8),
    fontWeight: "bold",
    color: "#222",
  },

  total: {
    fontSize: hp(1.8),
    fontWeight: "bold",
    color: "#222",
    marginTop: hp(0.5),
    alignSelf: "flex-end",
  },

  nome: {
    fontSize: hp(2),
    fontWeight: "bold",
  },

  fornecedor: {
    fontSize: hp(1.5),
    color: "#666",
  },

  estoque: {
    fontSize: hp(1.5),
    color: "#666",
    marginBottom: hp(0.3),
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

  menuInferior: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#ccc",
    marginBottom: hp("5%"),
  },
  acaoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: hp(1),
  },

  botaoaddCarrinho: {
    backgroundColor: "#007bff",
    paddingVertical: hp(0.6),
    paddingHorizontal: wp(4),
    borderRadius: wp(2),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
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

  botaoTexto: {
    color: "#fff",
    fontSize: hp(1.7),
    fontWeight: "bold",
    textAlign: "center",
  },
  menuTexto: {
    fontSize: 12,
    textAlign: "center",
    color: "#333",
  },

  header: {
    flexDirection: "row",
    paddingTop: wp("6%"),
    paddingBottom: wp("2%"),
    width: wp("85%"),
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    width: wp("20"),
    height: 40,
    alignSelf: "left",
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginRight: 10,
    gap: 7,
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
    gap: wp(1),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    minHeight: hp("5%"), // garante altura mínima
    alignItems: "flex-start",
    alignContent: "center",

    // não centraliza verticalmente
  },

  filtroItem: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: wp(10),
    paddingVertical: hp(0.7),
    paddingHorizontal: wp(4),
    backgroundColor: "#fff",
    margin: wp(0.4),
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
