import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  FlatList,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform, // Importar Platform para ajustes específicos de iOS/Android
} from "react-native";
import {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useNavigation } from "@react-navigation/native";
import { getAuth, signOut } from "firebase/auth";
import { BarChart, PieChart } from "react-native-chart-kit";
import { Picker } from "@react-native-picker/picker";
// Verifique se esses imports são usados, caso contrário, remova-os para manter o código limpo:
// import ProdutosAtivos from "../ProdutosAtivos";
// import EditarProduto from "../EditarProduto";
// import MenuFornecedor from "../MenuFornecedor";

import { wp, hp } from "../src/utils/responsive";
// Importe useSafeAreaInsets da nova biblioteca
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VendasScreen from "./VendasScreen";

// Altura padrão do seu menu inferior (ajuste conforme o design final)
const MENU_INFERIOR_HEIGHT = hp("6%"); // Aproximadamente 8% da altura da tela

export default function FornecedorScreen() {
  const navigation = useNavigation();
  const [telaAtual, setTelaAtual] = useState("dashboard");
  const [userRole, setUserRole] = useState(null);
  const [produtosAtivos, setProdutosAtivos] = useState([]);
  const [produtosVendidos, setProdutosVendidos] = useState([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [preco, setPreco] = useState("");
  const [estoque, setEstoque] = useState("");
  const [modoEdicao, setModoEdicao] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [ordenacao, setOrdenacao] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [tipoPreco, setTipoPreco] = useState("unidade");
  const [tipoEstoque, setTipoEstoque] = useState("unidade");
  const user = getAuth().currentUser;
  const [loading, setLoading] = useState(true);

  // Obtém os insets da área segura do dispositivo
  const insets = useSafeAreaInsets();

  const precoFormatado = useMemo(() => {
    if (preco === "") return "";
    return `R$ ${parseFloat(preco).toFixed(2).replace(".", ",")}`;
  }, [preco]);

  useEffect(() => {
    const verificarPermissao = async () => {
      if (!user) return;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();

      if (userData?.tipo === "fornecedor" || userData?.tipo === "admin") {
        setUserRole(userData.tipo);
        carregarProdutos();
      } else {
        Alert.alert(
          "Acesso negado",
          "Você não tem permissão para acessar essa página."
        );
        navigation.goBack();
      }
    };

    verificarPermissao();
  }, [user]);

  const carregarProdutos = async () => {
    setLoading(true);
    const produtosRef = collection(db, "produtos");

    const q = query(produtosRef, where("fornecedor_uid", "==", user.uid));
    const querySnapshot = await getDocs(q);

    const ativos = [];
    const vendidos = [];

    querySnapshot.forEach((doc) => {
      const produto = doc.data();
      produto.id = doc.id;
      if (produto.estoque > 0) {
        ativos.push(produto);
      } else {
        vendidos.push(produto);
      }
    });

    setProdutosAtivos(ativos);
    setProdutosVendidos(vendidos);
    setLoading(false);
  };

  const buscarImagemPorNome = async (produtoNome) => {
    try {
      const imagemRef = collection(db, "imagem");
      const q = query(
        imagemRef,
        where("nome", "==", produtoNome.toLowerCase())
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const imgData = querySnapshot.docs[0].data();
        return imgData.url;
      }
    } catch (err) {
      console.error("Erro ao buscar imagem:", err);
    }

    return "";
  };

  const cadastrarProduto = async () => {
    if (
      !nome ||
      !categoria ||
      !preco ||
      !estoque ||
      !tipoPreco ||
      !tipoEstoque
    ) {
      return Alert.alert("Preencha todos os campos!");
    }

    try {
      const imagemURL = await buscarImagemPorNome(nome);

      const docRef = await addDoc(collection(db, "produtos"), {
        nome,
        categoria,
        preco: parseFloat(preco),
        tipoPreco,
        estoque: parseFloat(estoque),
        tipoEstoque,
        imagem: imagemURL,
        fornecedor: user.email,
        fornecedor_uid: user.uid,
        product_id: "",
      });

      await updateDoc(docRef, {
        product_id: docRef.id,
      });

      Alert.alert("Produto cadastrado com sucesso!");
      setNome("");
      setCategoria("");
      setPreco("");
      setEstoque("");
      setTipoPreco("unidade");
      setTipoEstoque("unidade");
      carregarProdutos();
    } catch (error) {
      console.error("Erro ao cadastrar produto:", error);
      Alert.alert("Erro ao cadastrar produto");
    }
  };

  const editarProduto = (produto) => {
    setProdutoSelecionado(produto);
    setNome(produto.nome);
    setCategoria(produto.categoria);
    setPreco(produto.preco.toString());
    setEstoque(produto.estoque.toString());
    setTipoPreco(produto.tipoPreco || "unidade");
    setTipoEstoque(produto.tipoEstoque || "unidade");
    setModoEdicao(true);
    setTelaAtual("cadastro");
  };

  const salvarEdicaoProduto = async () => {
    try {
      const imagemURL = await buscarImagemPorNome(nome);

      const ref = doc(db, "produtos", produtoSelecionado.id);
      await updateDoc(ref, {
        nome,
        categoria,
        preco: parseFloat(preco),
        tipoPreco,
        estoque: parseFloat(estoque),
        tipoEstoque,
        imagem: imagemURL,
      });

      Alert.alert("Produto editado com sucesso!");
      setModoEdicao(false);
      setProdutoSelecionado(null);
      setNome("");
      setCategoria("");
      setPreco("");
      setEstoque("");
      setTipoPreco("unidade");
      setTipoEstoque("unidade");
      setTelaAtual("ativos");
      carregarProdutos();
    } catch (err) {
      console.error("Erro ao editar produto:", err);
      Alert.alert("Erro ao editar produto");
    }
  };

  const excluirProduto = async (id) => {
    try {
      await deleteDoc(doc(db, "produtos", id));
      Alert.alert("Produto excluído com sucesso!");
      carregarProdutos();
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      Alert.alert("Erro ao excluir produto");
    }
  };

  const formatarPreco = (valor) => {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const renderCard = ({ item }) => (
    <View style={styles.card}>
      {item.imagem ? (
        <Image source={{ uri: item.imagem }} style={styles.image} />
      ) : (
        <Text style={styles.semImagem}>Sem imagem</Text>
      )}
      <Text style={styles.nome}>{item.nome}</Text>
      <Text style={styles.preco}>{formatarPreco(item.preco)}</Text>
      <Text>Estoque: {item.estoque}</Text>
      <View style={styles.botoesCard}>
        <TouchableOpacity
          onPress={() => editarProduto(item)}
          style={styles.botaoEditar}
        >
          <Text style={styles.textoBotao}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => excluirProduto(item.id)}
          style={styles.botaoExcluir}
        >
          <Text style={styles.textoBotao}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const aplicarFiltrosEOrdenacao = (produtos) => {
    let produtosFiltrados = produtos;

    if (categoriaFiltro !== "") {
      produtosFiltrados = produtosFiltrados.filter(
        (produto) => produto.categoria === categoriaFiltro
      );
    }
    return produtosFiltrados;
  };

  const renderDashboard = () => {
    const total = produtosAtivos.length + produtosVendidos.length;

    const pieData = [
      {
        name: "À Venda",
        population: produtosAtivos.length,
        color: "green",
        legendFontColor: "#7F7F7F",
        legendFontSize: 15,
      },
      {
        name: "Vendidos",
        population: produtosVendidos.length,
        color: "red",
        legendFontColor: "#7F7F7F",
        legendFontSize: 15,
      },
    ];

    return (
      <ScrollView
        contentContainerStyle={{
          paddingBottom: MENU_INFERIOR_HEIGHT + insets.bottom + hp("5%"), // Padding para o menu inferior
          paddingHorizontal: wp("4%"), // Padding horizontal para o dashboard
          paddingTop: hp("2%"), // Padding superior
        }}
      >
        <Text style={styles.titulo}>Dashboard</Text>
        <BarChart
          data={{
            labels: ["À Venda", "Vendidos", "Total"],
            datasets: [
              { data: [produtosAtivos.length, produtosVendidos.length, total] },
            ],
          }}
          width={Dimensions.get("window").width - wp("8%")}
          height={hp("25%")}
          chartConfig={{
            backgroundColor: "#fff",
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 128, 0, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          style={{ marginVertical: hp("2%") }}
        />
        <PieChart
          data={pieData}
          width={Dimensions.get("window").width - wp("8%")}
          height={hp("25%")}
          chartConfig={{
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          style={{ marginVertical: hp("2%") }}
        />
        <Image
          source={require("../img/grafico1.png")}
          style={styles.imageDash}
          resizeMode="contain"
        />
        <Image
          source={require("../img/grafico2.png")}
          style={styles.imageDash}
          resizeMode="contain"
        />
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {telaAtual === "ativos" && (
        <View style={styles.ativosContainer}>
          {/* Header */}
          <View style={styles.ativosHeader}>
            <Text style={styles.ativosTitle}>Produtos Cadastrados</Text>
          </View>

          {/* Filtros por Categoria */}
          <View style={styles.filterBar}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                categoriaFiltro === "" && styles.filterActive,
              ]}
              onPress={() => setCategoriaFiltro("")}
            >
              <Text
                style={[
                  styles.filterText,
                  categoriaFiltro === "" && styles.filterTextActive,
                ]}
              >
                Todos
              </Text>
            </TouchableOpacity>
            {["Frutas", "Legumes", "Verduras"].map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.filterButton,
                  categoriaFiltro === cat && styles.filterActive,
                ]}
                onPress={() => setCategoriaFiltro(cat)}
              >
                <Text
                  style={[
                    styles.filterText,
                    categoriaFiltro === cat && styles.filterTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setTelaAtual("cadastro")}
          >
            <Text style={{ fontSize: hp("2.5%"), color: "#fff" }}> + </Text>
            <Text style={styles.addButtonText}> Adicionar produto</Text>
          </TouchableOpacity>

          {/* Lista de Produtos */}
          {loading ? (
            <>
              {/* Skeleton para loading */}
              {[1, 2, 3].map((_, index) => (
                <View key={index} style={styles.skeletonCard}>
                  <View style={styles.skeletonImage} />
                  <View style={styles.skeletonText} />
                  <View style={styles.skeletonText} />
                </View>
              ))}
            </>
          ) : (
            <FlatList
              data={aplicarFiltrosEOrdenacao(produtosAtivos)}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.productCard}>
                  <Image
                    source={{ uri: item.imagem || "https://picsum.photos/200" }}
                    style={styles.productImage}
                  />
                  <View style={styles.productDetails}>
                    <Text style={styles.productName}>{item.nome}</Text>
                    <Text style={styles.productPrice}>
                      {formatarPreco(item.preco)}
                    </Text>
                    <Text style={styles.productStock}>
                      Estoque: {item.estoque} {item.tipoEstoque}
                    </Text>
                  </View>
                  <View style={styles.productActions}>
                    <TouchableOpacity
                      style={styles.actionButtonEdit}
                      onPress={() => editarProduto(item)}
                    >
                      <Text style={styles.actionText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButtonExcluir}
                      onPress={() => excluirProduto(item.id)}
                    >
                      <Text style={styles.actionText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Nenhum produto encontrado.</Text>
              }
            />
          )}
        </View>
      )}

      {telaAtual === "Vendas" && (
        <VendasScreen
          // <FlatList
          //   data={aplicarFiltr
          // osEOrdenacao(produtosVendidos)}
          //   keyExtractor={(item) => item.id}
          //   numColumns={2}
          contentContainerStyle={{
            padding: wp("4%"),
            paddingBottom: MENU_INFERIOR_HEIGHT + insets.bottom + hp("2%"), // Espaço dinâmico para menu inferior
            paddingTop: hp("2%"),
          }}
        />
        //   columnWrapperStyle={{ justifyContent: "space-between" }}
        //   renderItem={renderCard}
        //   ListEmptyComponent={
        //     <Text style={styles.semProdutos}>Nenhum produto vendido.</Text>
        //   }
        // />
      )}

      {telaAtual === "cadastro" && (
        <ScrollView
          contentContainerStyle={{
            padding: wp("4%"),
            paddingBottom: MENU_INFERIOR_HEIGHT + insets.bottom + hp("2%"), // Espaço dinâmico para menu inferior
            paddingTop: hp("2%"),
          }}
        >
          <View style={styles.cadastro}>
            <Text style={styles.titulo}>Cadastrar Produtos</Text>
            <Text style={styles.label}>Nome do Produto: </Text>
            <TextInput
              placeholder="Ex: Banana, Maçã"
              placeholderTextColor="#9a9a9a"
              value={nome}
              onChangeText={setNome}
              style={styles.input}
            />

            <Text style={styles.label}>Categoria:</Text>
            <View style={styles.filtroWrapper}>
              {["Frutas", "Legumes", "Verduras"].map((cat) => {
                const ativo = categoria === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.botaoFiltro, ativo && styles.botaoAtivo]}
                    onPress={() => setCategoria(cat)}
                  >
                    <Text
                      style={ativo ? styles.textoAtivo : styles.textoFiltro}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.label}>Preço (R$) </Text>
            <TextInput
              value={precoFormatado}
              onChangeText={(text) => {
                const onlyNumbers = text.replace(/[^0-9]/g, "");
                const float = parseFloat(onlyNumbers) / 100;
                setPreco(float.toFixed(2));
              }}
              keyboardType="numeric"
              placeholder="Preço (R$)"
              placeholderTextColor="#9a9a9a"
              style={styles.input}
            />
            <Text style={styles.label}>Estoque: </Text>
            <TextInput
              placeholder="Estoque"
              placeholderTextColor="#9a9a9a"
              value={estoque}
              onChangeText={setEstoque}
              keyboardType="numeric"
              style={styles.input}
            />

            <Text style={styles.label}>Tipo de Preço:</Text>
            <View style={styles.filtroWrapper}>
              {["unid", "kg", "dúzia"].map((tipo) => {
                const ativo = tipoPreco === tipo;
                return (
                  <TouchableOpacity
                    key={tipo}
                    style={[styles.botaoFiltro, ativo && styles.botaoAtivo]}
                    onPress={() => setTipoPreco(tipo)}
                  >
                    <Text
                      style={ativo ? styles.textoAtivo : styles.textoFiltro}
                    >
                      {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Tipo de Estoque:</Text>
            <View style={styles.filtroWrapper}>
              {["unid", "kg", "dúzia"].map((tipo) => {
                const ativo = tipoEstoque === tipo;
                return (
                  <TouchableOpacity
                    key={tipo}
                    style={[styles.botaoFiltro, ativo && styles.botaoAtivo]}
                    onPress={() => setTipoEstoque(tipo)}
                  >
                    <Text
                      style={ativo ? styles.textoAtivo : styles.textoFiltro}
                    >
                      {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={modoEdicao ? salvarEdicaoProduto : cadastrarProduto}
              style={styles.botaoSalvar}
            >
              <Text style={styles.textoBotao}>Salvar Produto</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {telaAtual === "dashboard" && renderDashboard()}

      {/* Menu Inferior - Agora a posição `bottom` é dinâmica */}
      <View style={[styles.menuInferior, { bottom: insets.bottom }]}>
        <TouchableOpacity
          onPress={() => setTelaAtual("ativos")}
          style={styles.menuItem}
        >
          {/* Certifique-se de que esses caminhos de imagem estão corretos */}
          <Image
            source={require("../img/ativos.png")}
            style={[
              styles.menuIcon,
              telaAtual === "ativos" && styles.menuIconActive,
            ]}
          />
          <Text
            style={[
              styles.menuItemText,
              telaAtual === "ativos" && styles.menuTextActive,
            ]}
          >
            Produtos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("Vendas")}
          style={styles.menuItem}
        >
          <Image
            source={require("../img/Vendas.png")}
            style={[
              styles.menuIcon,
              telaAtual === "Vendas" && styles.menuIconActive,
            ]}
          />
          <Text
            style={[
              styles.menuItemText,
              telaAtual === "Vendas" && styles.menuTextActive,
            ]}
          >
            Vendas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTelaAtual("cadastro")}
          style={styles.menuItem}
        >
          <Image
            source={require("../img/cadastroo.png")}
            style={[
              styles.menuIcon,
              telaAtual === "cadastro" && styles.menuIconActive,
            ]}
          />
          <Text
            style={[
              styles.menuItemText,
              telaAtual === "cadastro" && styles.menuTextActive,
            ]}
          >
            Cadastro
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTelaAtual("dashboard")}
          style={styles.menuItem}
        >
          <Image
            source={require("../img/dashboard.png")}
            style={[
              styles.menuIcon,
              telaAtual === "dashboard" && styles.menuIconActive,
              ,
            ]}
          />
          <Text
            style={[
              styles.menuItemText,
              telaAtual === "dashboard" && styles.menuTextActive,
            ]}
          >
            Dashboard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("Perfil")}
          style={styles.menuItem}
        >
          <Image
            source={require("../img/perfill.png")}
            style={[
              styles.menuIcon,
              telaAtual === "perfil" && styles.menuIconActive,
            ]}
          />
          <Text
            style={[
              styles.menuItemText,
              telaAtual === "perfil" && styles.menuTextActive,
            ]}
          >
            Perfil
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff", // Cor de fundo geral do app
    paddingBottom: hp("10"),
    // paddingTop: insets.top será aplicado diretamente no componente
  },

  cadastro: {
    paddingHorizontal: hp("2"),
  },
  titulo: {
    fontSize: hp("2.8%"),
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: hp("3%"),
    marginTop: hp("1%"),
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: hp("1.5%"),
    paddingHorizontal: wp("4%"),
    marginBottom: hp("2%"),
    backgroundColor: "#fff",
    fontSize: hp("1.8%"),
  },
  label: {
    fontWeight: "600",
    marginBottom: hp("0.8%"),
    marginTop: hp("0.3%"),
    fontSize: hp("1.9"),
    color: "#333",
  },
  filtroWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: wp("3%"),
    marginBottom: hp("2.5%"),
    alignItems: "flex-start",
    alignContent: "center",
  },
  botaoFiltro: {
    paddingHorizontal: wp("3%"),
    paddingVertical: hp("1%"),
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  botaoAtivo: {
    backgroundColor: "#69a461",
    borderColor: "#69a461",
  },
  textoFiltro: {
    color: "#333",
    fontSize: hp("1.6%"),
  },
  textoAtivo: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: hp("1.6%"),
  },
  botaoSalvar: {
    backgroundColor: "#69a461",
    paddingVertical: hp("2%"),
    borderRadius: 8,
    alignItems: "center",
    marginTop: hp("2%"),
  },
  textoBotao: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: hp("1.8%"),
  },
  card: {
    width: wp("44%"),
    margin: wp("2%"),
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: wp("3%"),
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: "center",
  },
  image: {
    width: wp("35%"),
    height: hp("12%"),
    resizeMode: "cover",
    borderRadius: 8,
    marginBottom: hp("1%"),
  },
  imageDash: {
    width: wp("90%"),
    height: hp("35%"),
    alignSelf: "center",
  },
  nome: {
    fontSize: hp("1.8%"),
    fontWeight: "600",
    textAlign: "center",
    marginBottom: hp("0.5%"),
  },
  preco: {
    color: "#27ae60",
    fontWeight: "bold",
    marginBottom: hp("1%"),
  },
  botoesCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: hp("1%"),
  },
  botaoEditar: {
    backgroundColor: "#69a461",
    paddingVertical: hp("0.8%"),
    paddingHorizontal: wp("3%"),
    borderRadius: 6,
    flex: 1,
    marginRight: wp("1%"),
    alignItems: "center",
    borderWidth: 1,
  },
  botaoExcluir: {
    paddingVertical: hp("0.8%"),
    paddingHorizontal: wp("3%"),
    borderRadius: 6,
    flex: 1,
    marginLeft: wp("1%"),
    alignItems: "center",
  },
  ativosContainer: {
    flex: 1,
    paddingHorizontal: wp("4%"),
    paddingTop: hp("2%"),
  },
  ativosHeader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: hp("2%"),
  },
  ativosTitle: {
    fontSize: hp("2.6%"),
    fontWeight: "bold",
    color: "#333",

    justifyContent: "center",
  },
  addButton: {
    backgroundColor: "#19b3e6",
    paddingHorizontal: wp("2%"),
    paddingVertical: hp("0.4%"),
    borderRadius: 10,
    elevation: 1,
    flexDirection: "row",
    alignItems: "Center",

    alignSelf: "flex-end",
    marginBottom: hp("1%"),
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: hp("1.5%"),
    alignSelf: "center",
  },
  filterBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: hp("1.8%"),
  },
  filterButton: {
    flex: 1,
    marginHorizontal: wp("1%"),
    paddingVertical: hp("0.6%"),
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    alignItems: "center",
  },
  filterActive: {
    backgroundColor: "#69a461",
    borderColor: "#69a461",
  },
  filterText: {
    color: "#333",
    fontSize: hp("1.6%"),
  },
  filterTextActive: {
    color: "#fff",
    fontWeight: "bold",
  },
  productsList: {
    // paddingBottom será adicionado dinamicamente no componente
  },
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: hp("1.5%"),
    padding: wp("5%"),
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productImage: {
    width: wp("22%"),
    height: hp("10%"),
    resizeMode: "cover",
    borderRadius: 10,
    marginRight: wp("4%"),
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: hp("2%"),
    fontWeight: "600",
    marginBottom: hp("0.8%"),
  },
  productPrice: {
    fontSize: hp("1.8%"),
    color: "#27ae60",
    fontWeight: "bold",
    marginBottom: hp("0.8%"),
  },
  productStock: {
    fontSize: hp("1.6%"),
    color: "#666",
    marginTop: hp("0.5%"),
  },
  productActions: {
    marginLeft: wp("4%"),
    justifyContent: "space-around",
    height: hp("10%"),
  },
  actionButtonExcluir: {
    backgroundColor: "#DC5831",
    paddingVertical: hp("0.8%"),
    paddingHorizontal: wp("3%"),
    borderRadius: 6,
    marginBottom: hp("0.5%"),
    elevation: 1,
  },
  actionButtonEdit: {
    backgroundColor: "#69a461",
    paddingVertical: hp("0.8%"),
    paddingHorizontal: wp("3%"),
    borderRadius: 6,
    marginBottom: hp("0.5%"),
    elevation: 1,
  },
  actionText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: hp("1.4%"),
  },

  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: hp("5%"),
    fontSize: hp("1.8%"),
  },
  semProdutos: {
    textAlign: "center",
    color: "#999",
    marginTop: hp("5%"),
    fontSize: hp("1.8%"),
    width: "100%",
  },
  // Menu Inferior e seus itens
  menuInferior: {
    position: "absolute", // <-- ADICIONE ISSO
    left: 0, // <-- ADICIONE ISSO
    right: 0, // <-- ADICIONE ISSO
    // bottom: não precisa aqui, pois será sobrescrito pelo style dinâmico acima
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: hp("1%"), // <-- Use hp() aqui para o padding
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e0e0e0", // Sugestão para cor de borda
    height: MENU_INFERIOR_HEIGHT, // <-- Garanta que use a constante aqui
    elevation: 0, // Sombra para Android
    shadowColor: "#000", // Sombra para iOS
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  menuItem: {
    flex: 1,
    alignItems: "center",
    transition: "all 0.3s ease", // Anima mudanças de estilo
  },

  menuIcon: {
    width: wp("17%"),
    height: wp("6%"),

    alignSelf: "center",
  },
  menuItemText: {
    fontSize: hp("1.5%"),
    color: "#69a461",
    textAlign: "center",
  },
  menuIconActive: {
    transform: [{ scale: 1.2 }],

    tintColor: "#000", // Preto para o ícone ativo
  },
  menuTextActive: {
    color: "#000000", // Preto para o texto ativo
    // Opcional: deixar em negrito
  },
  skeletonCard: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    marginHorizontal: wp("4%"),
  },
  skeletonImage: {
    height: hp("12%"),
    backgroundColor: "#e0e0e0",
    borderRadius: 8,
    marginBottom: 10,
  },
  skeletonText: {
    height: hp("2%"),
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 6,
    width: "70%",
  },
});
