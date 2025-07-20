import { useCart } from '@/contexts/CartContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

export function FloatingCart() {
  const { getCartCount } = useCart();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const cartCount = getCartCount();

  if (cartCount === 0) return null;

  const handleCartPress = () => {
    router.push('/(tabs)/saved');
  };

  return (
    <TouchableOpacity
      style={[
        styles.cartButton,
        {
          backgroundColor: colorScheme === 'dark' ? 'rgba(124, 58, 237, 0.95)' : 'rgba(124, 58, 237, 0.95)',
        }
      ]}
      onPress={handleCartPress}
      activeOpacity={0.8}
    >
      <View style={styles.cartContent}>
        <IconSymbol name="bag.fill" size={20} color="#fff" />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{cartCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cartButton: {
    position: 'absolute',
    top: 100,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  cartContent: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
