import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Image source={require('../img/ABERTURAofi.jpg')} style={styles.logo} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logo: {
    flex: 1,
    width: '100%',
    height: '100%',
    resizeMode: 'cover', // pode usar 'contain' se quiser a imagem inteira visível com bordas
  },
});
