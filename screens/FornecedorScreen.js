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
import ProdutosAtivos from "../ProdutosAtivos"; // Verifique se esses imports são usados, caso contrário, remova-os
import EditarProduto from "../EditarProduto"; // Verifique se esses imports são usados, caso contrário, remova-os
import MenuFornecedor from "../MenuFornecedor"; // Verifique se esses imports são usados, caso contrário, remova-os
import { wp, hp } from "../src/utils/responsive";
import { SafeAreaView } from "react-native";

// Altura padrão do seu menu inferior (ajuste conforme o design final)
// Usaremos isso para calcular o paddingBottom
const MENU_INFERIOR_HEIGHT = hp("8%"); // Aproximadamente 8% da altura da tela

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
  }, [user]); // Adicionado 'user' como dependência para garantir que rode quando o user for carregado

  const carregarProdutos = async () => {
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
          paddingBottom: MENU_INFERIOR_HEIGHT + hp("3%"), // Padding para o menu inferior
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
          width={Dimensions.get("window").width - wp("8%")} // Ajustado para respeitar o padding horizontal
          height={hp("25%")} // Altura responsiva
          chartConfig={{
            backgroundColor: "#fff",
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 128, 0, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          style={{ marginVertical: hp("2%") }} // Espaçamento vertical para o gráfico
        />
        <PieChart
          data={pieData}
          width={Dimensions.get("window").width - wp("8%")} // Ajustado para respeitar o padding horizontal
          height={hp("25%")} // Altura responsiva
          chartConfig={{
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15" // Ajuste este padding se precisar mover o gráfico
          style={{ marginVertical: hp("2%") }} // Espaçamento vertical para o gráfico
        />
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {telaAtual === "ativos" && (
        <View style={styles.ativosContainer}>
          {/* Header */}
          <View style={styles.ativosHeader}>
            <Text style={styles.ativosTitle}>Produtos Cadastrados</Text>
            {/* O botão "+ Adicionar produto" foi movido para fora do View styles.ativosHeader */}
            {/* para ter um controle de espaçamento próprio */}
          </View>

          {/* Botão de Adicionar Produto */}
          <TouchableOpacity
            style={styles.addButton} // Estilo para o botão com fundo
            onPress={() => setTelaAtual("cadastro")}
          >
            <Text style={styles.addButtonText}>+ Adicionar produto</Text>
          </TouchableOpacity>

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

          {/* Lista de Produtos */}
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
                    style={styles.actionButton}
                    onPress={() => editarProduto(item)}
                  >
                    <Text style={styles.actionText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
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
            contentContainerStyle={{
              paddingBottom: MENU_INFERIOR_HEIGHT + hp("3%"), // Espaço para menu inferior
              paddingTop: hp("1.5%"), // Espaço acima da lista
            }}
          />
        </View>
      )}

      {telaAtual === "vendidos" && (
        <FlatList
          data={aplicarFiltrosEOrdenacao(produtosVendidos)}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{
            padding: wp("4%"), // Padding geral
            paddingBottom: MENU_INFERIOR_HEIGHT + hp("3%"), // Espaço para menu inferior
            paddingTop: hp("2%"), // Padding superior
          }}
          columnWrapperStyle={{ justifyContent: "space-between" }}
          renderItem={renderCard}
          ListEmptyComponent={
            <Text style={styles.semProdutos}>Nenhum produto vendido.</Text>
          }
        />
      )}

      {telaAtual === "cadastro" && (
        <ScrollView
          contentContainerStyle={{
            padding: wp("4%"), // Padding geral
            paddingBottom: MENU_INFERIOR_HEIGHT + hp("3%"), // Espaço para menu inferior
            paddingTop: hp("2%"), // Padding superior
          }}
        >
          <Text style={styles.titulo}>Cadastro de Produto</Text>

          <TextInput
            placeholder="Nome do Produto"
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
                  <Text style={ativo ? styles.textoAtivo : styles.textoFiltro}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            value={precoFormatado}
            onChangeText={(text) => {
              const onlyNumbers = text.replace(/[^0-9]/g, "");
              const float = parseFloat(onlyNumbers) / 100;
              setPreco(float.toFixed(2));
            }}
            keyboardType="numeric"
            placeholder="Preço (R$)"
            style={styles.input}
          />

          <TextInput
            placeholder="Estoque"
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
                  <Text style={ativo ? styles.textoAtivo : styles.textoFiltro}>
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
                  <Text style={ativo ? styles.textoAtivo : styles.textoFiltro}>
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
        </ScrollView>
      )}

      {telaAtual === "dashboard" && renderDashboard()}

      {/* Menu Inferior */}
      <View style={styles.menuInferior}>
        <TouchableOpacity
          onPress={() => setTelaAtual("ativos")}
          style={styles.menuItem}
        >
          <Image source={require("../img/logo.png")} style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Ativos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTelaAtual("vendidos")}
          style={styles.menuItem}
        >
          <Image source={require("../img/logo.png")} style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Vendidos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTelaAtual("cadastro")}
          style={styles.menuItem}
        >
          <Image source={require("../img/logo.png")} style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Cadastro</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTelaAtual("dashboard")}
          style={styles.menuItem}
        >
          <Image source={require("../img/logo.png")} style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("Perfil")}
          style={styles.menuItem}
        >
          <Image source={require("../img/logo.png")} style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0", // Cor de fundo geral do app
  },
  titulo: {
    fontSize: hp("2.8%"),
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: hp("3%"), // Aumentado o espaçamento abaixo do título
    marginTop: hp("1%"), // Adicionado um pequeno espaçamento acima
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: hp("1.5%"),
    paddingHorizontal: wp("4%"),
    marginBottom: hp("2%"), // Aumentado o espaçamento abaixo dos inputs
    backgroundColor: "#fff",
    fontSize: hp("1.8%"),
  },
  label: {
    fontWeight: "600",
    marginBottom: hp("0.8%"), // Aumentado um pouco o espaçamento abaixo do label
    marginTop: hp("1.5%"), // Adicionado espaçamento acima do label
    fontSize: hp("1.8%"),
    color: "#333",
  },
  filtroWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: wp("3%"), // Espaçamento entre os botões de filtro
    marginBottom: hp("2.5%"), // Aumentado o espaçamento abaixo dos wrappers de filtro
    alignItems: "flex-start",
    alignContent: "center",
  },
  botaoFiltro: {
    paddingHorizontal: wp("5%"),
    paddingVertical: hp("1%"),
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  botaoAtivo: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
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
    backgroundColor: "#4CAF50",
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
    backgroundColor: "#3498db",
    paddingVertical: hp("0.8%"),
    paddingHorizontal: wp("3%"),
    borderRadius: 6,
    flex: 1,
    marginRight: wp("1%"),
    alignItems: "center",
  },
  botaoExcluir: {
    backgroundColor: "#e74c3c",
    paddingVertical: hp("0.8%"),
    paddingHorizontal: wp("3%"),
    borderRadius: 6,
    flex: 1,
    marginLeft: wp("1%"),
    alignItems: "center",
  },
  // Estilos para a tela de Produtos Ativos
  ativosContainer: {
    flex: 1,
    paddingHorizontal: wp("4%"),
    paddingTop: hp("2%"),
  },
  ativosHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp("2%"), // Espaço abaixo do cabeçalho
  },
  ativosTitle: {
    fontSize: hp("2.6%"),
    fontWeight: "bold",
    color: "#333",
  },
  addButton: {
    backgroundColor: "#e0e0e0", // Um tom mais claro para o botão de adicionar
    paddingHorizontal: wp("4%"),
    paddingVertical: hp("1.2%"), // Aumentado o padding vertical para o botão
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignSelf: "flex-start", // Para que o botão não ocupe a largura total
    marginBottom: hp("2%"), // Espaço abaixo do botão
  },
  addButtonText: {
    color: "#333",
    fontWeight: "bold",
    fontSize: hp("1.8%"),
  },
  filterBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: hp("2.5%"), // Espaço abaixo da barra de filtros
  },
  filterButton: {
    flex: 1,
    marginHorizontal: wp("1%"),
    paddingVertical: hp("1%"),
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    alignItems: "center",
  },
  filterActive: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
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
    // paddingBottom será adicionado dinamicamente para respeitar o menuInferior
  },
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: hp("1.5%"), // Aumentado o espaçamento entre os cards
    padding: wp("4%"),
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
    borderRadius: 8,
    marginRight: wp("4%"),
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: hp("2%"),
    fontWeight: "600",
    marginBottom: hp("0.8%"), // Espaçamento abaixo do nome do produto
  },
  productPrice: {
    fontSize: hp("1.8%"),
    color: "#27ae60",
    fontWeight: "bold",
    marginBottom: hp("0.8%"), // Espaçamento abaixo do preço
  },
  productStock: {
    fontSize: hp("1.6%"),
    color: "#666",
    marginTop: hp("0.5%"), // Espaçamento acima do estoque
  },
  productActions: {
    marginLeft: wp("4%"),
    justifyContent: "space-around", // Para espaçar os botões Editar/Excluir
    height: hp("10%"), // Garantir altura suficiente para os botões
  },
  actionButton: {
    backgroundColor: "#f0f0f0",
    paddingVertical: hp("0.8%"),
    paddingHorizontal: wp("3%"),
    borderRadius: 6,
    marginBottom: hp("0.5%"), // Pequeno espaçamento entre os botões de ação
    elevation: 1,
  },
  actionText: {
    color: "#333",
    fontWeight: "bold",
    fontSize: hp("1.4%"),
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: hp("5%"), // Aumentado o espaçamento para o texto de vazio
    fontSize: hp("1.8%"),
  },
  semProdutos: {
    textAlign: "center",
    color: "#999",
    marginTop: hp("5%"), // Aumentado o espaçamento para o texto de vazio
    fontSize: hp("1.8%"),
    width: "100%", // Ocupar toda a largura para centralizar
  },
  // Menu Inferior e seus itens
  menuInferior: {
    position: "absolute",
    bottom: 0, // Alinha ao fundo da SafeAreaView
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: hp("1%"), // Padding interno do menu
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#e0e0e0", // Cor da borda
    height: MENU_INFERIOR_HEIGHT, // Altura definida no topo do arquivo
    elevation: 8, // Sombra para Android
    shadowColor: "#000", // Sombra para iOS
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  menuItem: {
    flex: 1, // Cada item ocupa espaço igual
    alignItems: "center",
    paddingVertical: hp("0.5%"), // Padding vertical interno
  },
  menuIcon: {
    width: wp("6%"), // Tamanho do ícone
    height: wp("6%"),
    marginBottom: hp("0.5%"), // Espaço entre ícone e texto
    tintColor: "#4CAF50", // Cor do ícone
  },
  menuItemText: {
    fontSize: hp("1.4%"), // Tamanho da fonte do texto do menu
    color: "#333",
    textAlign: "center",
  },
});
