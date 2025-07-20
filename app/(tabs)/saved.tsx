import { IconSymbol } from '@/components/ui/IconSymbol';
import { useCart } from '@/contexts/CartContext';
import { useTabContext } from '@/contexts/TabContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
    Alert,
    Image,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function CartScreen() {
  const { setActiveTab } = useTabContext();
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, clearCart } = useCart();
  const colorScheme = useColorScheme();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setActiveTab('saved');
    }, [setActiveTab])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const handleRemoveItem = (id: string, size: string) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeFromCart(id, size) }
      ]
    );
  };

  const handleQuantityChange = (id: string, size: string, currentQuantity: number, change: number) => {
    const newQuantity = currentQuantity + change;
    if (newQuantity > 0) {
      updateQuantity(id, size, newQuantity);
    }
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    
    Alert.alert(
      'Checkout',
      `Total: $${getCartTotal().toFixed(2)}\n\nProceed to checkout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Checkout', onPress: () => {
          Alert.alert('Success', 'Order placed successfully!');
          clearCart();
        }}
      ]
    );
  };

  const renderCartItem = (item: typeof cartItems[0], index: number) => (
    <View key={`${item.id}-${item.size}`} style={[styles.cartItem, { backgroundColor: colorScheme === 'dark' ? '#111' : '#f8f8f8' }]}>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveItem(item.id, item.size)}
      >
        <IconSymbol name="xmark" size={18} color="#ff4444" />
      </TouchableOpacity>
      
      <Image source={{ uri: item.image }} style={styles.itemImage} />
      <View style={styles.itemDetails}>
        <Text style={[styles.itemName, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>{item.name}</Text>
        <Text style={[styles.itemBrand, { color: colorScheme === 'dark' ? '#888' : '#666' }]}>{item.brand}</Text>
        <Text style={[styles.itemSize, { color: colorScheme === 'dark' ? '#888' : '#666' }]}>Size: {item.size}</Text>
        
        <View style={styles.priceQuantityRow}>
          <Text style={styles.itemPrice}>{item.price}</Text>
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={[styles.quantityButton, { backgroundColor: colorScheme === 'dark' ? '#333' : '#e0e0e0' }]}
              onPress={() => handleQuantityChange(item.id, item.size, item.quantity, -1)}
            >
              <Text style={[styles.quantityButtonText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>-</Text>
            </TouchableOpacity>
            <Text style={[styles.quantityText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>{item.quantity}</Text>
            <TouchableOpacity
              style={[styles.quantityButton, { backgroundColor: colorScheme === 'dark' ? '#333' : '#e0e0e0' }]}
              onPress={() => handleQuantityChange(item.id, item.size, item.quantity, 1)}
            >
              <Text style={[styles.quantityButtonText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
        <Text style={[styles.headerTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
          ${getCartTotal().toFixed(2)}
        </Text>
        {cartItems.length > 0 && (
          <TouchableOpacity
            style={[styles.checkoutButton, { backgroundColor: '#7c3aed' }]}
            onPress={handleCheckout}
          >
            <Text style={styles.checkoutButtonText}>
              Checkout ({cartItems.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <IconSymbol name="bag.fill" size={64} color={colorScheme === 'dark' ? '#333' : '#ccc'} />
          </View>
          <Text style={[styles.emptyTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
            Your cart is empty
          </Text>
          <Text style={[styles.emptySubtitle, { color: colorScheme === 'dark' ? '#888' : '#666' }]}>
            Add some items to get started
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cartContainer}>
            {cartItems.map((item, index) => renderCartItem(item, index))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  cartContainer: {
    padding: 20,
  },
  cartItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    position: 'relative',
    alignItems: 'flex-start',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
    paddingTop: 0,
    paddingBottom: 0,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemBrand: {
    fontSize: 14,
    marginBottom: 2,
  },
  itemSize: {
    fontSize: 12,
    marginBottom: 4,
  },
  priceQuantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7c3aed',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  checkoutButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
