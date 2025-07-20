import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTabContext } from '@/contexts/TabContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useApiClient } from '@/utils/api';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Image,
    PanResponder,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');

interface ClothingItem {
  id: string;
  name: string;        // Maps to item_name in DB
  price: string;       // Maps to price (converted to integer) in DB 
  link: string;        // Maps to link in DB
  sizes: string[];     // Maps to sizes in DB
  brand: string;       // Maps to brand in DB
  description: string; // Maps to user_desc in DB
  dot_position_x: number; // Maps to x (converted from percentage to decimal) in DB
  dot_position_y: number; // Maps to y (converted from percentage to decimal) in DB
}

export default function PostScreen() {
  const { setActiveTab } = useTabContext();
  const colorScheme = useColorScheme();
  const apiClient = useApiClient();
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [postTitle, setPostTitle] = useState('');
  const [postDescription, setPostDescription] = useState('');
  const [tags, setTags] = useState('');
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [currentStep, setCurrentStep] = useState<'create' | 'position'>('create');
  const [isUploading, setIsUploading] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    link: '',
    brand: '',
    description: '',
    sizes: [] as string[],
    currentSize: ''
  });

  // State for dot positions and scroll control
  const [dotPositions, setDotPositions] = useState<{[key: string]: {x: number, y: number}}>({});
  const [isDragging, setIsDragging] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  
  // Animation values
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  
  // Success animation function
  const triggerSuccessAnimation = () => {
    setShowSuccessAnimation(true);
    
    // Reset animation values
    successScale.setValue(0);
    successOpacity.setValue(0);
    
    // Animate in
    Animated.sequence([
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 150,
          friction: 6,
        }),
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(1500),
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 0,
          useNativeDriver: true,
          tension: 150,
          friction: 6,
        }),
        Animated.timing(successOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setShowSuccessAnimation(false);
      // Reset form after animation
      setSelectedImages([]);
      setPostTitle('');
      setPostDescription('');
      setTags('');
      setClothingItems([]);
      setDotPositions({});
      setCurrentStep('create');
    });
  };
  
  // Function to create a PanResponder for each dot
  const createDotPanResponder = (itemId: string) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        // Disable scrolling when dragging starts
        setIsDragging(true);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Calculate the container dimensions
        const containerWidth = width - 32; // Account for padding
        const containerHeight = (width - 32) * 1.2; // Maintain aspect ratio
        
        // Get the current position or set a default
        const currentPosition = dotPositions[itemId] || { 
          x: 20 + (clothingItems.findIndex(item => item.id === itemId) % 2) * 55, 
          y: 25 + clothingItems.findIndex(item => item.id === itemId) * 20 
        };
        
        // Calculate the movement delta as percentages
        const deltaX = (gestureState.dx / containerWidth) * 100;
        const deltaY = (gestureState.dy / containerHeight) * 100;
        
        // Calculate new position with proper boundaries
        const newX = Math.max(2, Math.min(93, currentPosition.x + deltaX));
        const newY = Math.max(2, Math.min(83, currentPosition.y + deltaY));
        
        // Update position
        setDotPositions(prev => ({
          ...prev,
          [itemId]: { x: newX, y: newY }
        }));
      },
      onPanResponderRelease: () => {
        // Re-enable scrolling when dragging ends
        setIsDragging(false);
      },
      onPanResponderTerminate: () => {
        // Re-enable scrolling if gesture is terminated
        setIsDragging(false);
      },
    });
  };

  useFocusEffect(
    useCallback(() => {
      setActiveTab('post');
    }, [setActiveTab])
  );

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please grant camera roll permissions to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImages(prev => [...prev, result.assets[0].uri]);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please grant camera permissions to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImages(prev => [...prev, result.assets[0].uri]);
    }
  };

  const showImageOptions = () => {
    if (selectedImages.length >= 6) {
      Alert.alert('Maximum Images', 'You can only add up to 6 images per post.');
      return;
    }
    
    Alert.alert(
      'Add Image',
      'Choose how you want to add your outfit photo',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Gallery', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const addSize = () => {
    if (newItem.currentSize.trim() && !newItem.sizes.includes(newItem.currentSize.trim())) {
      setNewItem(prev => ({
        ...prev,
        sizes: [...prev.sizes, prev.currentSize.trim()],
        currentSize: ''
      }));
    }
  };

  const removeSize = (size: string) => {
    setNewItem(prev => ({
      ...prev,
      sizes: prev.sizes.filter(s => s !== size)
    }));
  };

  const addClothingItem = () => {
    if (newItem.name.trim() && newItem.price.trim() && newItem.sizes.length > 0) {
      const itemId = Date.now().toString();
      setClothingItems(prev => [...prev, {
        id: itemId,
        name: newItem.name,
        price: newItem.price,
        link: newItem.link,
        brand: newItem.brand,
        description: newItem.description,
        sizes: newItem.sizes,
        dot_position_x: 25 + (prev.length * 25), // Default positions spread out
        dot_position_y: 25 + (prev.length * 20)
      }]);
      setNewItem({ 
        name: '', 
        price: '', 
        link: '', 
        brand: '', 
        description: '', 
        sizes: [], 
        currentSize: '' 
      });
      setIsAddingItem(false);
    } else {
      Alert.alert('Missing Information', 'Please fill in the name, price, and at least one size.');
    }
  };

  const removeClothingItem = (id: string) => {
    setClothingItems(prev => prev.filter(item => item.id !== id));
  };

  const handleNext = () => {
    if (selectedImages.length === 0) {
      Alert.alert('Image Required', 'Please select at least one image for your outfit post.');
      return;
    }
    if (!postTitle.trim()) {
      Alert.alert('Title Required', 'Please add a title for your outfit post.');
      return;
    }
    if (clothingItems.length === 0) {
      Alert.alert('Items Required', 'Please add at least one clothing item.');
      return;
    }
    
    setCurrentStep('position');
  };

  const handlePost = async () => {
    if (isUploading) return;
    
    // Validation checks
    if (selectedImages.length === 0) {
      Alert.alert('Error', 'Please select at least one image');
      return;
    }

    if (!postTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for your post');
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Create final clothing items with updated positions from dotPositions state
      const finalClothingItems = clothingItems.map(item => {
        const position = dotPositions[item.id];
        const finalItem = {
          ...item,
          dot_position_x: position ? position.x : item.dot_position_x,
          dot_position_y: position ? position.y : item.dot_position_y,
          brand: item.brand || 'Unknown', // Ensure brand is not empty
          description: item.description || '',
          link: item.link || ''
        };

        console.log('Final clothing item:', finalItem);
        return finalItem;
      });

      console.log('Uploading post with data:', {
        title: postTitle.trim(),
        description: postDescription.trim(),
        imageCount: selectedImages.length,
        clothingItemCount: finalClothingItems.length,
        clothingItems: finalClothingItems
      });

      // Upload images and create post with new API signature
      const result = await apiClient.uploadPost(
        selectedImages, 
        postTitle.trim(),
        postDescription.trim() || 'No description',
        finalClothingItems.length > 0 ? finalClothingItems : undefined
      );
      
      console.log('Post created successfully:', result);
      
      // Show success animation
      triggerSuccessAnimation();
      
    } catch (error) {
      console.error('Failed to upload post:', error);
      Alert.alert(
        'Upload Failed', 
        error instanceof Error ? error.message : 'Failed to upload your post. Please try again.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Success Animation Overlay */}
      {showSuccessAnimation && (
        <View style={styles.successOverlay}>
          <Animated.View 
            style={[
              styles.successContainer,
              {
                transform: [{ scale: successScale }],
                opacity: successOpacity,
              }
            ]}
          >
            <View style={styles.successIcon}>
              <IconSymbol name="checkmark" size={32} color="#fff" />
            </View>
            <Text style={styles.successText}>Posted Successfully!</Text>
          </Animated.View>
        </View>
      )}
      
      {currentStep === 'create' ? (
        <>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Images Section - Top 1/3 */}
            <View style={styles.inputSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                  Images ({selectedImages.length}/6)
                </Text>
                <TouchableOpacity 
                  style={[styles.nextButton, { backgroundColor: '#7c3aed' }]}
                  onPress={handleNext}
                >
                  <Text style={styles.nextButtonText}>Next</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.imagesContainer}>
                {selectedImages.map((image, index) => (
                  <View key={index} style={styles.imageItem}>
                    <Image source={{ uri: image }} style={styles.selectedImage} />
                    <TouchableOpacity 
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <IconSymbol name="xmark" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {selectedImages.length < 6 && (
                  <TouchableOpacity style={styles.addImageButton} onPress={showImageOptions}>
                    <IconSymbol name="plus" size={24} color={colorScheme === 'dark' ? '#666' : '#999'} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Clothing Items Section */}
            <View style={styles.inputSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                  Clothing Items
                </Text>
                <TouchableOpacity
                  style={[styles.addItemButton, { backgroundColor: '#7c3aed' }]}
                  onPress={() => setIsAddingItem(true)}
                >
                  <IconSymbol name="plus.circle.fill" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Add Item Form */}
              {isAddingItem && (
                <View style={[styles.addItemForm, { backgroundColor: colorScheme === 'dark' ? '#222' : '#f8f8f8' }]}>
                  <TextInput
                    style={[styles.textInput, { 
                      backgroundColor: colorScheme === 'dark' ? '#333' : '#fff',
                      color: colorScheme === 'dark' ? '#fff' : '#000'
                    }]}
                    placeholder="Item name"
                    placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                    value={newItem.name}
                    onChangeText={(text) => setNewItem({...newItem, name: text})}
                  />
                  <TextInput
                    style={[styles.textInput, { 
                      backgroundColor: colorScheme === 'dark' ? '#333' : '#fff',
                      color: colorScheme === 'dark' ? '#fff' : '#000'
                    }]}
                    placeholder="Brand"
                    placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                    value={newItem.brand}
                    onChangeText={(text) => setNewItem({...newItem, brand: text})}
                  />
                  <TextInput
                    style={[styles.textInput, { 
                      backgroundColor: colorScheme === 'dark' ? '#333' : '#fff',
                      color: colorScheme === 'dark' ? '#fff' : '#000'
                    }]}
                    placeholder="Price (e.g., $89)"
                    placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                    value={newItem.price}
                    onChangeText={(text) => setNewItem({...newItem, price: text})}
                  />
                  <TextInput
                    style={[styles.textInput, { 
                      backgroundColor: colorScheme === 'dark' ? '#333' : '#fff',
                      color: colorScheme === 'dark' ? '#fff' : '#000'
                    }]}
                    placeholder="Shopping link (optional)"
                    placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                    value={newItem.link}
                    onChangeText={(text) => setNewItem({...newItem, link: text})}
                  />
                  <TextInput
                    style={[styles.textInput, { 
                      backgroundColor: colorScheme === 'dark' ? '#333' : '#fff',
                      color: colorScheme === 'dark' ? '#fff' : '#000'
                    }]}
                    placeholder="Description (optional)"
                    placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                    value={newItem.description}
                    onChangeText={(text) => setNewItem({...newItem, description: text})}
                  />
                  
                  {/* Sizes Section */}
                  <View style={styles.sizesSection}>
                    <Text style={[styles.inputLabel, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                      Sizes
                    </Text>
                    <View style={styles.sizeInputRow}>
                      <TextInput
                        style={[styles.sizeInput, { 
                          backgroundColor: colorScheme === 'dark' ? '#333' : '#fff',
                          color: colorScheme === 'dark' ? '#fff' : '#000'
                        }]}
                        placeholder="Size (e.g., M, L, XL)"
                        placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                        value={newItem.currentSize}
                        onChangeText={(text) => setNewItem({...newItem, currentSize: text})}
                      />
                      <TouchableOpacity
                        style={[styles.addSizeButton, { backgroundColor: '#7c3aed' }]}
                        onPress={addSize}
                      >
                        <IconSymbol name="plus" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.sizesContainer}>
                      {newItem.sizes.map((size, index) => (
                        <View key={index} style={styles.sizeTag}>
                          <Text style={styles.sizeTagText}>{size}</Text>
                          <TouchableOpacity onPress={() => removeSize(size)}>
                            <IconSymbol name="xmark" size={12} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                  
                  <View style={styles.formButtons}>
                    <TouchableOpacity
                      style={[styles.cancelButton, { backgroundColor: '#666' }]}
                      onPress={() => setIsAddingItem(false)}
                    >
                      <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveButton, { backgroundColor: '#7c3aed' }]}
                      onPress={addClothingItem}
                    >
                      <Text style={styles.buttonText}>Add Item</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Clothing Items List */}
              {clothingItems.map((item) => (
                <View key={item.id} style={[styles.clothingItem, { backgroundColor: colorScheme === 'dark' ? '#111' : '#f8f8f8' }]}>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.itemBrand, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>
                      {item.brand}
                    </Text>
                    <Text style={[styles.itemPrice, { color: '#7c3aed' }]}>
                      {item.price}
                    </Text>
                    <Text style={[styles.itemSizes, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>
                      Sizes: {item.sizes.join(', ')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeClothingItem(item.id)}
                  >
                    <IconSymbol name="trash" size={20} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Post Title and Description */}
            <View style={styles.inputSection}>
              <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                Post Details
              </Text>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: colorScheme === 'dark' ? '#333' : '#fff',
                  color: colorScheme === 'dark' ? '#fff' : '#000'
                }]}
                placeholder="Post title"
                placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                value={postTitle}
                onChangeText={setPostTitle}
              />
              <TextInput
                style={[styles.descriptionInput, { 
                  backgroundColor: colorScheme === 'dark' ? '#333' : '#fff',
                  color: colorScheme === 'dark' ? '#fff' : '#000'
                }]}
                placeholder="Describe your outfit..."
                placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                value={postDescription}
                onChangeText={setPostDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Tags */}
            <View style={styles.inputSection}>
              <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                Tags
              </Text>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: colorScheme === 'dark' ? '#333' : '#fff',
                  color: colorScheme === 'dark' ? '#fff' : '#000'
                }]}
                placeholder="e.g., #streetwear #summer #casual"
                placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                value={tags}
                onChangeText={setTags}
              />
            </View>
          </ScrollView>
        </>
      ) : (
        // Position dots step
        <>
          <View style={[styles.header, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
            <TouchableOpacity onPress={() => setCurrentStep('create')}>
              <IconSymbol name="chevron.left" size={24} color={colorScheme === 'dark' ? '#fff' : '#000'} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
              Position Items
            </Text>
            <TouchableOpacity 
              style={[
                styles.postButton, 
                { 
                  backgroundColor: isUploading ? '#9ca3af' : '#7c3aed',
                  opacity: isUploading ? 0.7 : 1 
                }
              ]}
              onPress={handlePost}
              disabled={isUploading}
            >
              <Text style={styles.postButtonText}>
                {isUploading ? 'Posting...' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} scrollEnabled={!isDragging}>
            <View style={styles.positionContainer}>
              <Text style={[styles.instructionText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                Drag the purple dots to position your items on the image
              </Text>
              <View style={styles.imageWithDots}>
                {selectedImages.length > 0 && (
                  <Image 
                    source={{ uri: selectedImages[0] }} 
                    style={styles.positionImage}
                    resizeMode="contain"
                  />
                )}
                {clothingItems.map((item, index) => {
                  // Calculate initial position if not set
                  const defaultPosition = { 
                    x: 20 + (index % 2) * 40, 
                    y: 20 + Math.floor(index / 2) * 25 
                  };
                  
                  const currentPosition = dotPositions[item.id] || defaultPosition;
                  
                  // Set initial position if not already set
                  if (!dotPositions[item.id]) {
                    setDotPositions(prev => ({
                      ...prev,
                      [item.id]: defaultPosition
                    }));
                  }
                  
                  const panResponder = createDotPanResponder(item.id);
                  
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.positionDot,
                        { 
                          top: `${currentPosition.y}%`,
                          left: `${currentPosition.x}%`
                        }
                      ]}
                      {...panResponder.panHandlers}
                    >
                      <View style={styles.dot}>
                        <View style={styles.dotInner} />
                      </View>
                      <View style={[styles.itemLabel, { backgroundColor: colorScheme === 'dark' ? '#222' : '#fff' }]}>
                        <Text style={[styles.itemLabelText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                          {item.name}
                        </Text>
                        <Text style={[styles.itemLabelPrice, { color: '#7c3aed' }]}>
                          {item.price}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </>
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  imageSelector: {
    marginTop: 20,
    marginBottom: 20,
  },
  selectedImage: {
    width: '100%',
    height: width * 1.2,
    borderRadius: 12,
  },
  imagePlaceholder: {
    width: '100%',
    height: width * 1.2,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#ccc',
  },
  placeholderText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  inputSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addItemText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  textInput: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
  },
  captionInput: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    textAlignVertical: 'top',
    height: 80,
  },
  addItemForm: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  saveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clothingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemSize: {
    fontSize: 14,
  },
  removeButton: {
    padding: 8,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    minHeight: 120,
    alignItems: 'flex-start',
  },
  imageItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageButton: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  nextButton: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  descriptionInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sizesSection: {
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  sizeInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  sizeInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  addSizeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },
  sizesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  sizeTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  itemBrand: {
    fontSize: 14,
    marginBottom: 2,
  },
  itemSizes: {
    fontSize: 12,
  },
  // Position step styles
  positionContainer: {
    flex: 1,
    padding: 16,
  },
  instructionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  imageWithDots: {
    position: 'relative',
    width: '100%',
    height: width * 1.2,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  positionImage: {
    width: '100%',
    height: '100%',
  },
  positionDot: {
    position: 'absolute',
    width: 24,
    height: 24,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  itemLabel: {
    position: 'absolute',
    top: 30,
    left: -40,
    minWidth: 120,
    padding: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  itemLabelText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemLabelPrice: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Success animation styles
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  successContainer: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
