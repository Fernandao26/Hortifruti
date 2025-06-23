// src/context/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

// Cria o contexto de autenticação
export const AuthContext = createContext();

// Provedor de Autenticação que envolverá seu aplicativo
export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null); // Objeto de usuário do Firebase (firebase.User)
  const [userId, setUserId] = useState(null);   // UID do usuário (string)
  const [authLoading, setAuthLoading] = useState(true); // Para saber se o estado inicial de auth já foi carregado

  useEffect(() => {
    const auth = getAuth(); // Obtém a instância do Firebase Auth

    // onAuthStateChanged: Observador que é acionado sempre que o estado de autenticação muda
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user); // user será null se não logado, ou o objeto User se logado
      setUserId(user ? user.uid : null); // Define o userId com base no user.uid
      setAuthLoading(false); // O estado de autenticação foi carregado, pode parar o loading
      console.log("Estado de autenticação atualizado:", user ? user.uid : "Nenhum usuário logado");
    });

    // Função de limpeza para desinscrever o observador quando o componente desmonta
    return () => unsubscribe();
  }, []); // O array de dependências vazio garante que o efeito rode apenas uma vez na montagem

  // Se o estado de autenticação ainda estiver carregando, não renderize os filhos ainda.
  // Você pode mostrar uma tela de carregamento aqui, como uma Splash Screen.
  if (authLoading) {
    return null; // Ou <SplashScreen />
  }

  // Provê o usuário e o userId para todos os componentes filhos
  return (
    <AuthContext.Provider value={{ usuario, userId }}>
      {children}
    </AuthContext.Provider>
  );
};