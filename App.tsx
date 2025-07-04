import React, { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Provider as PaperProvider, DefaultTheme } from "react-native-paper";
import * as Updates from "expo-updates";
import SplashScreen from "./screens/SplashScreen";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import HomeScreen from "./screens/HomeScreen";
import RedefinirSenha from "./screens/RedefinirSenha";
import CarrinhoScreen from "./screens/CarrinhoScreen";
import FornecedorScreen from "./screens/FornecedorScreen";
import PromoverAdminScreen from "./screens/PromoverAdminScreen";
import PagamentoScreen from "./screens/PagamentoScreen";
import DicasScreen from "./screens/DicasScreen";
import ReceitasScreen from "./screens/ReceitasScreen";
import PedidosScreen from "./screens/PedidosScreen";
import AvaliacaoScreen from "./screens/AvaliacaoScreen";
import PerfilScreen from "./screens/PerfilScreen";
import AjudaScreen from "./screens/AjudaScreen";
import AdminScreen from "./screens/AdminScreen";
import DetalhesReceitaScreen from "./screens/DetalhesReceitaScreen.js";
import DetalhesDicaScreen from "./screens/DetalhesDicaScreen";
import VendasScreen from "./screens/VendasScreen";
import DetalhesPedidoScreen from "./screens/DetalhesPedidoScreen.js"
const Stack = createNativeStackNavigator();

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    
    async function checkForUpdates() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync(); 
        }
      } catch (error) {
        console.log("Erro ao verificar atualizações OTA:", error);
      }
    }

    checkForUpdates(); 

   
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <SplashScreen />;

  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: "#69A461",
      placeholder: "#999999",
      background: "white",
      text: "#69A461",
    },
  };


  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="RedefinirSenha" component={RedefinirSenha} />
            <Stack.Screen name="Carrinho" component={CarrinhoScreen} />
            <Stack.Screen name="Fornecedor" component={FornecedorScreen} />
            <Stack.Screen
              name="PromoverAdmin"
              component={PromoverAdminScreen}
            />
            <Stack.Screen name="Pagamento" component={PagamentoScreen} />
            <Stack.Screen name="Dicas" component={DicasScreen} options={{ headerShown: false }} />
            <Stack.Screen name="DetalhesDica" component={DetalhesDicaScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Receitas" component={ReceitasScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Pedidos" component={PedidosScreen} options={{ headerShown: false }}  />
            <Stack.Screen name="DetalhesPedido" component={DetalhesPedidoScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Avaliacao" component={AvaliacaoScreen} />
            <Stack.Screen name="Perfil" component={PerfilScreen} />
            <Stack.Screen name="Vendas" component={VendasScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Ajuda" component={AjudaScreen} />
            <Stack.Screen name="Admin" component={AdminScreen} />
            <Stack.Screen name="DetalhesReceita" component={DetalhesReceitaScreen} options={{ headerShown: false }} />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
