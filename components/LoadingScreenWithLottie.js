// components/LoadingScreenWithLottie.js
import React, { useRef, useEffect, useState } from "react";
import { View, StyleSheet, Dimensions, Animated } from "react-native";
import LottieView from "lottie-react-native";

const { width, height } = Dimensions.get("window");

// **IMPORTANTE**: ALtere este caminho para o local real do seu arquivo Lottie!
const LOTTIE_ANIMATION_SOURCE = require("../assets/LoadingPerfil.json");

const LoadingScreenWithLottie = ({ onAnimationFinish }) => {
  const animationRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current; // Inicia opaco

  useEffect(() => {
    if (animationRef.current) {
      animationRef.current.play(); // Inicia a animação

      const animationDuration = 2000; // 2 segundos (ajuste)

      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500, // 0.5 segundo para desaparecer
          useNativeDriver: true,
        }).start(() => {
          onAnimationFinish(); // Chama o callback quando a animação e o fade out terminam
        });
      }, animationDuration);

      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <LottieView
        ref={animationRef}
        source={LOTTIE_ANIMATION_SOURCE}
        loop={false}
        speed={1}
        style={styles.lottieAnimation}
        resizeMode="contain" // Importante para preencher a tela
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  backgroundGreen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#69A461", // Seu verde desejado
  },
  lottieAnimation: {
    width: "100%", // Para a animação preencher o container
    height: "100%",
  },
});

export default LoadingScreenWithLottie;
