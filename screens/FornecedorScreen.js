import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Button, StyleSheet, Alert,
  FlatList, Image, TouchableOpacity, ScrollView, Dimensions
} from 'react-native';
import {
  collection, addDoc, updateDoc, getDocs,
  query, where, doc, getDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useNavigation } from '@react-navigation/native';
import { getAuth, signOut } from 'firebase/auth';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { Picker } from '@react-native-picker/picker';
import ProdutosAtivos from '../ProdutosAtivos';
import EditarProduto from '../EditarProduto';
import MenuFornecedor from '../MenuFornecedor';

export default function FornecedorScreen() {
  const navigation = useNavigation();
  const [telaAtual, setTelaAtual] = useState('dashboard');
  const [userRole, setUserRole] = useState(null);
  const [produtosAtivos, setProdutosAtivos] = useState([]);
  const [produtosVendidos, setProdutosVendidos] = useState([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [preco, setPreco] = useState('');
  const [estoque, setEstoque] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
const [ordenacao, setOrdenacao] = useState('');
const [filtroTipo, setFiltroTipo] = useState('');
  

  const user = getAuth().currentUser;

  useEffect(() => {
    
    const verificarPermissao = async () => {
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      if (userData?.tipo === 'fornecedor' || userData?.tipo === 'admin') {
        setUserRole(userData.tipo);
        carregarProdutos();
      } else {
        Alert.alert('Acesso negado', 'Você não tem permissão para acessar essa página.');
        navigation.goBack();
      }
    };

    verificarPermissao();
  }, []);

  const carregarProdutos = async () => {
    const produtosRef = collection(db, 'produtos');
    const q = query(produtosRef, where('fornecedor_uid', '==', user.uid));
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
      const imagemRef = collection(db, 'imagem');
      const q = query(imagemRef, where('nome', '==', produtoNome.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const imgData = querySnapshot.docs[0].data();
        return imgData.url;
      }
    } catch (err) {
      console.error('Erro ao buscar imagem:', err);
    }

    return '';
  };

  const cadastrarProduto = async () => {
    if (!nome || !categoria || !preco || !estoque) {
      return Alert.alert('Preencha todos os campos!');
    }

    try {
      const imagemURL = await buscarImagemPorNome(nome);

      const docRef = await addDoc(collection(db, 'produtos'), {
        nome,
        categoria,
        preco: parseFloat(preco),
        estoque: parseInt(estoque),
        imagem: imagemURL,
        fornecedor: user.email,
        fornecedor_uid: user.uid,
        product_id: '',
      });

      await updateDoc(docRef, {
        product_id: docRef.id,
      });

      Alert.alert('Produto cadastrado com sucesso!');
      setNome('');
      setCategoria('');
      setPreco('');
      setEstoque('');
      carregarProdutos();
    } catch (error) {
      console.error('Erro ao cadastrar produto:', error);
      Alert.alert('Erro ao cadastrar produto');
    }
  };

  const editarProduto = (produto) => {
    setProdutoSelecionado(produto);
    setNome(produto.nome);
    setCategoria(produto.categoria);
    setPreco(produto.preco.toString());
    setEstoque(produto.estoque.toString());
    setModoEdicao(true);
    setTelaAtual('cadastro');
  };

  const salvarEdicaoProduto = async () => {
    try {
      const imagemURL = await buscarImagemPorNome(nome);

      const ref = doc(db, 'produtos', produtoSelecionado.id);
      await updateDoc(ref, {
        nome,
        categoria,
        preco: parseFloat(preco),
        estoque: parseInt(estoque),
        imagem: imagemURL,
      });

      Alert.alert('Produto editado com sucesso!');
      setModoEdicao(false);
      setProdutoSelecionado(null);
      setTelaAtual('ativos');
      carregarProdutos();
    } catch (err) {
      console.error('Erro ao editar produto:', err);
      Alert.alert('Erro ao editar produto');
    }
  };

  const excluirProduto = async (id) => {
    try {
      await deleteDoc(doc(db, 'produtos', id));
      Alert.alert('Produto excluído com sucesso!');
      carregarProdutos();
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      Alert.alert('Erro ao excluir produto');
    }
  };

  const formatarPreco = (valor) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
        <TouchableOpacity onPress={() => editarProduto(item)} style={styles.botaoEditar}>
          <Text style={styles.textoBotao}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => excluirProduto(item.id)} style={styles.botaoExcluir}>
          <Text style={styles.textoBotao}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const aplicarFiltrosEOrdenacao = (produtos) => {
    let produtosFiltrados = produtos;
  
    if (categoriaFiltro !== '') {
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
        name: 'À Venda',
        population: produtosAtivos.length,
        color: 'green',
        legendFontColor: '#7F7F7F',
        legendFontSize: 15,
      },
      {
        name: 'Vendidos',
        population: produtosVendidos.length,
        color: 'red',
        legendFontColor: '#7F7F7F',
        legendFontSize: 15,
      },
    ];

    return (
      <ScrollView>
        <Text style={styles.titulo}>Dashboard</Text>
        <BarChart
          data={{
            labels: ['À Venda', 'Vendidos', 'Total'],
            datasets: [{ data: [produtosAtivos.length, produtosVendidos.length, total] }],
          }}
          width={Dimensions.get('window').width - 20}
          height={220}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 128, 0, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          style={{ marginVertical: 10 }}
        />
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
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1 }}>
     {telaAtual === 'ativos' && (
  <>
    <Picker
      selectedValue={categoriaFiltro}
      onValueChange={(itemValue) => setCategoriaFiltro(itemValue)}
      style={{ marginHorizontal: 10 }}
    >
      <Picker.Item label="Todas as Categorias" value="" />
      <Picker.Item label="Frutas" value="Frutas" />
      <Picker.Item label="Verduras" value="Verduras" />
      <Picker.Item label="Legumes" value="Legumes" />
      {/* Adicione mais categorias conforme seu sistema */}
    </Picker>

    <ProdutosAtivos
      produtos={produtosAtivos}
      renderCard={renderCard}
      aplicarFiltrosEOrdenacao={aplicarFiltrosEOrdenacao}
    />
  </>
)}


      {telaAtual === 'vendidos' && (
  <>
    <Picker
      selectedValue={categoriaFiltro}
      onValueChange={(itemValue) => setCategoriaFiltro(itemValue)}
      style={{ marginHorizontal: 10 }}
    >
      <Picker.Item label="Todas as Categorias" value="" />
      <Picker.Item label="Frutas" value="Frutas" />
      <Picker.Item label="Verduras" value="Verduras" />
      <Picker.Item label="Legumes" value="Legumes" />
    </Picker>

    <FlatList
      data={aplicarFiltrosEOrdenacao(produtosVendidos)}
      keyExtractor={(item) => item.id}
      numColumns={2}
      contentContainerStyle={{ padding: 10 }}
      renderItem={renderCard}
      ListEmptyComponent={<Text style={styles.semProdutos}>Nenhum produto vendido</Text>}
    />
  </>
)}
      {telaAtual === 'cadastro' && (
        <EditarProduto
          nome={nome}
          setNome={setNome}
          categoria={categoria}
          setCategoria={setCategoria}
          preco={preco}
          setPreco={setPreco}
          estoque={estoque}
          setEstoque={setEstoque}
          modoEdicao={modoEdicao}
          salvar={modoEdicao ? salvarEdicaoProduto : cadastrarProduto}
        />
      )}
      {telaAtual === 'dashboard' && renderDashboard()}

      {/* Menu Inferior */}
      <View style={styles.menuInferior}>
  <TouchableOpacity onPress={() => setTelaAtual('ativos')}>
    <Text>Ativos</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={() => setTelaAtual('vendidos')}>
    <Text>Vendidos</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={() => setTelaAtual('cadastro')}>
    <Text>Cadastro</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={() => setTelaAtual('dashboard')}>
    <Text>Dashboard</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={() => navigation.navigate('Perfil')}>
  <Text>Perfil</Text>
</TouchableOpacity>
</View>

    </View>
  );

}

const styles = StyleSheet.create({
  menuInferior: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 19,
    backgroundColor: '#fff',
    borderTopWidth: 2,
    borderColor: '#ccc',
  },
  menu: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 10 },
  card: { flex: 1, padding: 10, backgroundColor: '#f5f5f5', margin: 5, borderRadius: 8 },
  image: { width: '100%', height: 100, resizeMode: 'cover', borderRadius: 4 },
  nome: { fontWeight: 'bold', fontSize: 16 },
  preco: { color: 'green' },
  botoesCard: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  botaoEditar: { backgroundColor: 'blue', padding: 5, borderRadius: 5 },
  botaoExcluir: { backgroundColor: 'red', padding: 5, borderRadius: 5 },
  textoBotao: { color: 'white' },
  semImagem: { fontStyle: 'italic', textAlign: 'center' },
  semProdutos: { textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
  titulo: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginVertical: 10 },
});
