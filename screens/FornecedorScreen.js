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
import ProdutosAtivos from "../ProdutosAtivos";
import EditarProduto from "../EditarProduto";
import MenuFornecedor from "../MenuFornecedor";
import { wp, hp } from "../src/utils/responsive";
import { SafeAreaView } from "react-native";

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

  // ✅ Aqui está a linha do precoFormatado no lugar certo:
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
  }, []);

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
        tipoPreco, // <- novo campo
        estoque: parseFloat(estoque),
        tipoEstoque, // <- novo campo
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
      setTipoPreco("unidade"); // <- limpa campo
      setTipoEstoque("unidade"); // <- limpa campo
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
    setTipoPreco(produto.tipoPreco || "unidade"); // <- novo
    setTipoEstoque(produto.tipoEstoque || "unidade"); // <- novo
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
        tipoPreco, // <- novo campo
        estoque: parseFloat(estoque),
        tipoEstoque, // <- novo campo
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
      <ScrollView>
        <Text style={styles.titulo}>Dashboard</Text>
        <BarChart
          data={{
            labels: ["À Venda", "Vendidos", "Total"],
            datasets: [
              { data: [produtosAtivos.length, produtosVendidos.length, total] },
            ],
          }}
          width={Dimensions.get("window").width - 20}
          height={220}
          chartConfig={{
            backgroundColor: "#fff",
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 128, 0, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          style={{ marginVertical: 10 }}
        />
        <PieChart
          data={pieData}
          width={Dimensions.get("window").width - 20}
          height={220}
          chartConfig={{
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
        />
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {telaAtual === "ativos" && (
          <>
            <Text style={styles.tituloFiltro}>Meus Produtos</Text>
            <View style={styles.filtroWrapper}>
              <TouchableOpacity
                onPress={() => setCategoriaFiltro("")}
                style={[
                  styles.filtroItem,
                  categoriaFiltro === "" && styles.filtroItemAtivo,
                ]}
              >
                <Text
                  style={[
                    styles.filtroTexto,
                    categoriaFiltro === "" && styles.filtroTextoAtivo,
                  ]}
                >
                  Todos
                </Text>
              </TouchableOpacity>

              {["Frutas", "Legumes", "Verduras"].map((categoria) => {
                const ativa = categoriaFiltro === categoria;
                return (
                  <TouchableOpacity
                    key={categoria}
                    onPress={() => setCategoriaFiltro(categoria)}
                    style={[styles.filtroItem, ativa && styles.filtroItemAtivo]}
                  >
                    <Text
                      style={[
                        styles.filtroTexto,
                        ativa && styles.filtroTextoAtivo,
                      ]}
                    >
                      {categoria}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <ProdutosAtivos
              produtos={produtosAtivos}
              renderCard={renderCard}
              aplicarFiltrosEOrdenacao={aplicarFiltrosEOrdenacao}
            />
          </>
        )}

        {telaAtual === "vendidos" && (
          <>
            <FlatList
              data={aplicarFiltrosEOrdenacao(produtos)}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={{ padding: 10 }}
              columnWrapperStyle={{ justifyContent: "space-between" }}
              renderItem={renderCard}
              ListEmptyComponent={
                <Text style={styles.semProdutos}>Nenhum produto</Text>
              }
            />
          </>
        )}
        {telaAtual === "cadastro" && (
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.titulo}>Cadastro de Produto</Text>

            <TextInput
              placeholder="Nome do Produto"
              value={nome}
              onChangeText={setNome}
              style={styles.input}
            />

            {/* Filtro visual para categoria */}
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

            {/* Filtro visual para tipo de preço */}
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
          </ScrollView>
        )}
        {telaAtual === "dashboard" && renderDashboard()}
      </SafeAreaView>
      {/* Menu Inferior */}

      <View style={styles.menuInferior}>
        <TouchableOpacity onPress={() => setTelaAtual("ativos")}>
          <Text>Ativos</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTelaAtual("vendidos")}>
          <Text>Vendidos</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTelaAtual("cadastro")}>
          <Text>Cadastro</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTelaAtual("dashboard")}>
          <Text>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Perfil")}>
          <Text>Perfil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: wp("4%"),
    paddingTop: hp("2%"),
  },
  titulo: {
    fontSize: hp("2.8%"),
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: hp("2%"),
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: hp("1.5%"),
    paddingHorizontal: wp("4%"),
    marginBottom: hp("1.5%"),
    backgroundColor: "#f9f9f9",
    fontSize: hp("1.8%"),
  },
  label: {
    fontWeight: "600",
    marginBottom: hp("0.5%"),
    fontSize: hp("1.8%"),
  },
  filtroWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: wp("3%"),
    marginBottom: hp("2%"),
  },
  botaoFiltro: {
    paddingHorizontal: wp("5%"),
    paddingVertical: hp("1%"),
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
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
  menuInferior: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#ccc",
  },
  tituloFiltro: {
    fontSize: hp(2.5),
    fontWeight: "bold",
    marginHorizontal: wp(6),
    marginTop: hp("5%"),
    color: "#333",
  },

  filtroWrapper: {
    flexDirection: "row",
    gap: wp(3),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    minHeight: hp("2%"), // garante altura mínima
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
