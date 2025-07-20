import { IconSymbol } from '@/components/ui/IconSymbol';
import { useCart } from '@/contexts/CartContext';
import { useTabContext } from '@/contexts/TabContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useApiClient } from '@/utils/api';
import { useUser } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const ITEM_WIDTH = (width - 48) / 2; // 2 columns with padding

interface ClothingItem {
  id: string;
  name: string;        // Maps to item_name in DB
  price: string;       // Maps to price (formatted currency string) in DB 
  link: string;        // Maps to link in DB
  sizes: string[];     // Maps to sizes in DB
  brand: string;       // Maps to brand in DB
  description: string; // Maps to user_desc in DB
  dot_position_x: number; // Maps to x (converted from percentage to decimal) in DB
  dot_position_y: number; // Maps to y (converted from percentage to decimal) in DB
}

// Updated interface to match API response
interface FeedItem {
  id: string;
  title?: string;
  description?: string;
  author: {
    id: string; // User ID for fetching profile
    handle: string;
    avatar_url?: string;
  };
  created_at: string;
  images: string[];
  likes: number;
  liked_by_me: boolean;
  // Optional fields for backward compatibility and UI features
  tags?: string[];
  clothingItems?: ClothingItem[];
}

export default function FeedScreen() {
  const { setActiveTab } = useTabContext();
  const { addToCart } = useCart();
  const apiClient = useApiClient();
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  // Updated to use FeedItem interface
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'vertical'>('grid');
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMainSearchFocused, setIsMainSearchFocused] = useState(false);
  const [isFloatingSearchFocused, setIsFloatingSearchFocused] = useState(false);
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<{ [postId: string]: number }>({});
  const [imageLoadingStates, setImageLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [imageRetryCount, setImageRetryCount] = useState<{ [key: string]: number }>({});
  const [imageCache, setImageCache] = useState<{ [key: string]: string }>({});
  const [pressedDotId, setPressedDotId] = useState<string | null>(null);
  const [profilePreview, setProfilePreview] = useState<{
    user_id: string;
    username: string;
    avatar_url: string | null;
    bio: string | null;
    height_cm: number | null;
    chest_cm: number | null;
    waist_cm: number | null;
  } | null>(null);
  const [isProfilePreviewVisible, setIsProfilePreviewVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const searchAnimation = useRef(new Animated.Value(0)).current;
  const viewTransitionAnimation = useRef(new Animated.Value(0)).current; // 0 = grid, 1 = vertical
  const mainSearchInputRef = useRef<TextInput>(null);
  const floatingSearchInputRef = useRef<TextInput>(null);
  const hasLoadedInitially = useRef(false);
  const imageCacheRef = useRef<{ [key: string]: string }>({});
  const prefetchedImagesRef = useRef<Set<string>>(new Set());

  // Helper function to get relative time (e.g., "2 hours ago", "1 day ago")
  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const postDate = new Date(dateString);
    const diffInMs = now.getTime() - postDate.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInDays > 0) {
      return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
    } else if (diffInHours > 0) {
      return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    } else {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      if (diffInMinutes > 0) {
        return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
      } else {
        return 'Just now';
      }
    }
  };





  // Image caching and prefetching functions
  const getCachedImageUri = (imageUrl: string): string => {
    return imageCacheRef.current[imageUrl] || imageUrl;
  };

  const isImageCached = (imageUrl: string): boolean => {
    return !!imageCacheRef.current[imageUrl];
  };

  const isImagePrefetched = (imageUrl: string): boolean => {
    return prefetchedImagesRef.current.has(imageUrl);
  };

  const prefetchImage = async (imageUrl: string) => {
    if (isImagePrefetched(imageUrl) || isImageCached(imageUrl)) {
      return;
    }

    try {
      prefetchedImagesRef.current.add(imageUrl);
      
      // Create a unique filename for the cached image
      const filename = imageUrl.split('/').pop() || 'image.jpg';
      const cacheDir = `${FileSystem.cacheDirectory}image-cache/`;
      const fileUri = `${cacheDir}${Date.now()}_${filename}`;
      
      // Ensure cache directory exists
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      
      // Download and cache the image
      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
      
      if (downloadResult.status === 200) {
        imageCacheRef.current[imageUrl] = downloadResult.uri;
        setImageCache(prev => ({ ...prev, [imageUrl]: downloadResult.uri }));
        console.log('Image cached successfully:', imageUrl);
      }
    } catch (error) {
      console.error('Failed to prefetch image:', imageUrl, error);
      prefetchedImagesRef.current.delete(imageUrl);
    }
  };

  const prefetchImagesForPost = async (post: FeedItem) => {
    // Prefetch all images for a post
    const imagePromises = post.images.map(imageUrl => prefetchImage(imageUrl));
    await Promise.allSettled(imagePromises);
  };

  const prefetchVisibleImages = async (visiblePosts: FeedItem[]) => {
    // Prefetch images for visible posts and next few posts
    const postsToPrefetch = visiblePosts.slice(0, 10); // Prefetch first 10 posts
    const imagePromises = postsToPrefetch.flatMap(post => 
      post.images.map(imageUrl => prefetchImage(imageUrl))
    );
    await Promise.allSettled(imagePromises);
  };

  // Clear old cache entries to prevent memory issues
  const clearOldCache = async () => {
    try {
      const cacheDir = `${FileSystem.cacheDirectory}image-cache/`;
      const cacheInfo = await FileSystem.getInfoAsync(cacheDir);
      
      if (cacheInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(cacheDir);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        for (const file of files) {
          const filePath = `${cacheDir}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          
          if (fileInfo.exists && (now - fileInfo.modificationTime) > maxAge) {
            await FileSystem.deleteAsync(filePath);
            console.log('Cleared old cache file:', file);
          }
        }
      }
    } catch (error) {
      console.error('Failed to clear old cache:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setActiveTab('index');
    }, [setActiveTab])
  );

  // Load initial feed data (for refresh only)
  const loadFeed = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      // For refresh, always start from the beginning
      const response = await apiClient.getFeed(20, undefined);
      
      // Transform the API response to match frontend expectations
      const transformedFeed = response.feed.map((post: any) => ({
        ...post,
        // Ensure title is available
        title: post.title || 'Untitled Outfit',
        // Use the actual author handle from the API response
        author: {
          ...post.author,
          handle: post.author.handle || 'unknown'
        },
        // Map 'items' to 'clothingItems' and transform the data structure
        clothingItems: post.items?.map((item: any) => ({
          id: item.id || `item-${Math.random()}`, // Generate ID if missing
          name: item.item_name || item.name || 'Unknown Item',
          price: item.currency === 'JPY' ? `¥${item.price_cents}` : `$${item.price_cents}`,
          link: item.link || null,
          sizes: item.sizes || [],
          brand: item.brand || 'Unknown',
          description: item.user_desc || item.description || '',
          // Convert decimal positions back to percentages for frontend
          dot_position_x: (item.x || 0.5) * 100,
          dot_position_y: (item.y || 0.5) * 100,
        })) || []
      }));
      
      // Debug log to see transformed data
      if (transformedFeed.length > 0) {
        console.log('Transformed feed data:', {
          postCount: transformedFeed.length,
          firstPost: {
            id: transformedFeed[0].id,
            title: transformedFeed[0].title,
            clothingItemsCount: transformedFeed[0].clothingItems?.length || 0,
            clothingItems: transformedFeed[0].clothingItems,
            authorHandle: transformedFeed[0].author.handle,
            originalAuthorHandle: response.feed[0]?.author?.handle
          }
        });
      }
      
      setPosts(transformedFeed);
      setNextCursor(response.next_cursor);
      setHasMore(!!response.next_cursor);
    } catch (error) {
      console.error('Failed to load feed:', error);
      Alert.alert('Error', 'Failed to load feed. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [apiClient]);

  // Separate function for loading more posts
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || !nextCursor) return;
    
    try {
      setIsLoading(true);
      const response = await apiClient.getFeed(20, nextCursor);
      
      // Transform the API response to match frontend expectations
      const transformedFeed = response.feed.map((post: any) => ({
        ...post,
        // Ensure title is available
        title: post.title || 'Untitled Outfit',
        // Use the actual author handle from the API response
        author: {
          ...post.author,
          handle: post.author.handle || 'unknown'
        },
        // Map 'items' to 'clothingItems' and transform the data structure
        clothingItems: post.items?.map((item: any) => ({
          id: item.id || `item-${Math.random()}`, // Generate ID if missing
          name: item.item_name || item.name || 'Unknown Item',
          price: item.currency === 'JPY' ? `¥${item.price_cents}` : `$${item.price_cents}`,
          link: item.link || null,
          sizes: item.sizes || [],
          brand: item.brand || 'Unknown',
          description: item.user_desc || item.description || '',
          // Convert decimal positions back to percentages for frontend
          dot_position_x: (item.x || 0.5) * 100,
          dot_position_y: (item.y || 0.5) * 100,
        })) || []
      }));
      
      setPosts(prev => [...prev, ...transformedFeed]);
      setNextCursor(response.next_cursor);
      setHasMore(!!response.next_cursor);
    } catch (error) {
      console.error('Failed to load more posts:', error);
      Alert.alert('Error', 'Failed to load more posts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, hasMore, isLoading, nextCursor]);

  // Load feed on component mount only once
  useEffect(() => {
    if (!hasLoadedInitially.current) {
      hasLoadedInitially.current = true;
      // Clear old cache on startup
      clearOldCache();
      loadFeed();
    }
  }, [loadFeed]);

  // Prefetch images when posts change - optimized with caching
  useEffect(() => {
    if (posts.length > 0) {
      // Prefetch images for the first 10 posts
      prefetchVisibleImages(posts.slice(0, 10));
    }
  }, [posts]);



  // Initialize animations based on current view mode
  useEffect(() => {
    viewTransitionAnimation.setValue(viewMode === 'grid' ? 0 : 1);
  }, [viewMode, viewTransitionAnimation]);

  const onRefresh = useCallback(async () => {
    await loadFeed(true);
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, [loadFeed]);

  // Prefetch images for posts when they become visible in vertical view
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewMode === 'vertical' && viewableItems.length > 0) {
      const visiblePosts = viewableItems.map((item: any) => item.item);
      prefetchVisibleImages(visiblePosts);
    }
  }, [viewMode]);

  const handleLike = async (postId: string) => {
    try {
      // Find the current post
      const currentPost = posts.find(p => p.id === postId);
      if (!currentPost) return;

      // Optimistically update the UI
      setPosts(prevPosts => 
        prevPosts.map((post: FeedItem) => 
          post.id === postId 
            ? { 
                ...post, 
                likes: currentPost.liked_by_me ? post.likes - 1 : post.likes + 1,
                liked_by_me: !currentPost.liked_by_me
              }
            : post
        )
      );

      // Make API call
      if (currentPost.liked_by_me) {
        await apiClient.unlikePost(postId);
      } else {
        await apiClient.likePost(postId);
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
      
      // Revert the optimistic update on error
      setPosts(prevPosts => 
        prevPosts.map((post: FeedItem) => 
          post.id === postId 
            ? { 
                ...post, 
                likes: posts.find(p => p.id === postId)?.likes || post.likes,
                liked_by_me: posts.find(p => p.id === postId)?.liked_by_me || post.liked_by_me
              }
            : post
        )
      );
      
      Alert.alert('Error', 'Failed to update like. Please try again.');
    }
  };

  const handlePostSelect = (postId: string) => {
    setFocusedPostId(postId);
    setViewMode('vertical');
    
    // Prefetch all images for the selected post
    const selectedPost = posts.find(p => p.id === postId);
    if (selectedPost) {
      prefetchImagesForPost(selectedPost);
    }
    
    // Quick transition animation
    Animated.timing(viewTransitionAnimation, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const toggleViewMode = () => {
    if (viewMode === 'grid') {
      // Quick transition to vertical view
      Animated.timing(viewTransitionAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        setViewMode('vertical');
        // Prefetch images for the first few posts in vertical view
        prefetchVisibleImages(posts.slice(0, 5));
      });
    } else {
      // Quick transition to grid view
      setFocusedPostId(null);
      Animated.timing(viewTransitionAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        setViewMode('grid');
      });
    }
  };

  const toggleSearch = () => {
    const toValue = isSearchActive ? 0 : 1;
    setIsSearchActive(!isSearchActive);
    
    Animated.timing(searchAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      // Focus the appropriate input after animation completes
      if (!isSearchActive) { // We're opening search
        // Use a small delay to ensure the TextInput is rendered
        setTimeout(() => {
          if (toValue === 1) {
            // Focus the floating search input when search is active
            floatingSearchInputRef.current?.focus();
          }
        }, 50);
      }
    });
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      // Filter posts based on search query - note: limited search since API doesn't provide title/name
      const filteredPosts = posts.filter(post => 
        post.author.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.tags && post.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase())))
      );
      setPosts(filteredPosts);
    } else {
      // Reload fresh data when clearing search
      loadFeed(true);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    loadFeed(true);
    toggleSearch();
  };

  const handleDotPress = (item: ClothingItem) => {
    setPressedDotId(item.id);
    setSelectedItem(item);
    setSelectedSize(item.sizes.length === 1 ? item.sizes[0] : '');
    
    // Reset the pressed state after a short delay
    setTimeout(() => {
      setPressedDotId(null);
    }, 200);
  };

  const handleSizeSelect = (size: string) => {
    setSelectedSize(size);
  };

  const handleAddToCart = (item: ClothingItem, postImage: string) => {
    const sizeToUse = selectedSize || item.sizes[0];
    if (item.sizes.length > 1 && !selectedSize) {
      Alert.alert('Size Required', 'Please select a size before adding to cart.');
      return;
    }

    // Parse the price from the formatted string
    const priceNumber = parseInt(item.price.replace(/[^0-9]/g, ''));
    
    const cartItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      priceNumber,
      link: item.link,
      size: sizeToUse,
      brand: item.brand,
      description: item.description,
      image: postImage,
      postId: '1', // You could derive this from context
    };

    addToCart(cartItem);
    setSelectedItem(null);
    setSelectedSize('');
    Alert.alert('Added to Cart', `${item.name} (${sizeToUse}) has been added to your cart.`);
  };

  const closeSizeModal = () => {
    setSelectedItem(null);
    setSelectedSize('');
  };

  const handleUsernameTap = async (post: FeedItem) => {
    if (!post.author.id) {
      // Fallback to navigation if no user ID available
      router.push({
        pathname: '/(tabs)/user-profile',
        params: { username: post.author.handle }
      });
      return;
    }

    try {
      // Fetch profile using the user ID
      const response = await apiClient.getProfile(post.author.id);
      if (response.profile) {
        setProfilePreview(response.profile);
        setIsProfilePreviewVisible(true);
      }
    } catch (error) {
      console.error('Failed to fetch profile preview:', error);
      // Fallback to navigation
      router.push({
        pathname: '/(tabs)/user-profile',
        params: { username: post.author.handle }
      });
    }
  };

  // Grid view post component
  const renderGridPost = (post: FeedItem, index: number) => (
    <TouchableOpacity 
      key={post.id} 
      style={[
        styles.postContainer,
        { 
          marginLeft: index % 2 === 0 ? 0 : 8,
          backgroundColor: 'rgba(255,0,0,0.1)', // Debug background
        }
      ]}
      activeOpacity={0.9}
      onPress={() => handlePostSelect(post.id)}
    >
      <View style={[styles.imageContainer, { backgroundColor: 'rgba(0,255,0,0.1)' }]}>
        {imageLoadingStates[`grid-${post.id}`] && (
          <View style={styles.gridImageLoadingContainer}>
            <IconSymbol name="photo" size={32} color="rgba(255,255,255,0.5)" />
            <Text style={styles.gridImageLoadingText}>Loading...</Text>
          </View>
        )}
        <Image 
          source={{ 
            uri: getCachedImageUri(post.images[0]),
            headers: {
              'Cache-Control': 'max-age=31536000',
            },
          }} 
          style={[
            styles.postImage,
            imageLoadingStates[`grid-${post.id}`] && { opacity: 0 }
          ]}
          resizeMode="cover"
          onError={(error) => {
            console.error('Grid image load error for post', post.id, ':', error.nativeEvent.error);
            setImageLoadingStates(prev => ({ ...prev, [`grid-${post.id}`]: false }));
          }}
          onLoadStart={() => {
            if (!isImageCached(post.images[0])) {
              setImageLoadingStates(prev => ({ ...prev, [`grid-${post.id}`]: true }));
            }
          }}
          onLoad={() => {
            setImageLoadingStates(prev => ({ ...prev, [`grid-${post.id}`]: false }));
          }}
        />
        {post.images.length > 1 && (
          <View style={styles.multiImageIndicator}>
            <IconSymbol name="photo.stack" size={14} color="#fff" />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.imageOverlay}
        />
        
        <TouchableOpacity 
          style={styles.likeButton}
          onPress={(e) => {
            e.stopPropagation();
            handleLike(post.id);
          }}
        >
          <IconSymbol name={post.liked_by_me ? "heart.fill" : "heart"} size={16} color={post.liked_by_me ? "#ff4444" : "#fff"} />
        </TouchableOpacity>
        <View style={styles.postInfo}>
          <Text style={styles.postTitle} numberOfLines={1}>{post.title || 'Untitled Outfit'}</Text>
          <TouchableOpacity onPress={() => handleUsernameTap(post)}>
            <Text style={styles.postAuthor}>@{post.author.handle.startsWith('@') ? post.author.handle.slice(1) : post.author.handle}</Text>
          </TouchableOpacity>
          <Text style={styles.postDate}>{getRelativeTime(post.created_at)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Vertical view post component (TikTok style)
  const renderVerticalPost = ({ item: post }: { item: FeedItem }) => {
    const currentIndex = currentImageIndex[post.id] || 0;
    
    return (
      <View style={styles.verticalPostContainer}>
        <View style={styles.verticalPostTouchable}>
          <View style={styles.verticalImageContainer}>
            {/* Blurred background */}
            <Image 
              source={{ 
                uri: getCachedImageUri(post.images[currentIndex]),
                headers: {
                  'Cache-Control': 'max-age=31536000',
                },
              }} 
              style={styles.verticalBackgroundImage}
              resizeMode="cover"
              blurRadius={20}
              onError={(error) => {
                console.error('Vertical background image load error for post', post.id, ':', error.nativeEvent.error);
              }}
            />
            
            {/* Horizontal ScrollView for multiple images */}
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
                setCurrentImageIndex(prev => ({
                  ...prev,
                  [post.id]: newIndex
                }));
              }}
              style={styles.verticalImageScrollView}
            >
              {post.images.map((image, index) => (
                <View key={index} style={styles.verticalImageSlide}>
                  {imageLoadingStates[`${post.id}-${index}`] && (
                    <View style={styles.imageLoadingContainer}>
                      <IconSymbol name="photo" size={48} color="rgba(255,255,255,0.5)" />
                      <Text style={styles.imageLoadingText}>Loading...</Text>
                    </View>
                  )}
                  <Image 
                    source={{ 
                      uri: getCachedImageUri(image),
                      headers: {
                        'Cache-Control': 'max-age=31536000',
                      },
                    }} 
                    style={[
                      styles.verticalMainImage,
                      imageLoadingStates[`${post.id}-${index}`] && { opacity: 0 }
                    ]}
                    resizeMode="contain"
                    onError={(error) => {
                      console.error('Vertical main image load error for post', post.id, 'image', index, ':', error.nativeEvent.error);
                      setImageLoadingStates(prev => ({ ...prev, [`${post.id}-${index}`]: false }));
                      
                      // Retry logic - try up to 3 times
                      const retryKey = `${post.id}-${index}`;
                      const currentRetries = imageRetryCount[retryKey] || 0;
                      if (currentRetries < 3) {
                        setImageRetryCount(prev => ({ ...prev, [retryKey]: currentRetries + 1 }));
                        // Force a re-render to retry loading
                        setTimeout(() => {
                          setImageLoadingStates(prev => ({ ...prev, [retryKey]: true }));
                        }, 1000 * (currentRetries + 1)); // Exponential backoff
                      }
                    }}
                    onLoadStart={() => {
                      if (!isImageCached(image)) {
                        setImageLoadingStates(prev => ({ ...prev, [`${post.id}-${index}`]: true }));
                      }
                    }}
                    onLoad={() => {
                      setImageLoadingStates(prev => ({ ...prev, [`${post.id}-${index}`]: false }));
                    }}
                  />
                  
                  {/* Shopping Dots - show only on first image when multiple images exist */}
                  {index === 0 && post.clothingItems?.map((item, dotIndex) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.shoppingDot,
                        { 
                          top: `${item.dot_position_y}%`,  // Already in percentage format
                          left: `${item.dot_position_x}%` // Already in percentage format
                        }
                      ]}
                      onPress={() => handleDotPress(item)}
                    >
                      <View style={[
                        styles.dot,
                        pressedDotId === item.id && styles.dotPressed
                      ]}>
                        <View style={styles.dotInner} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
            
            {/* Image pagination dots */}
            {post.images.length > 1 && (
              <View style={styles.imagePagination}>
                {post.images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      {
                        backgroundColor: index === currentIndex ? '#fff' : 'rgba(255,255,255,0.5)',
                        width: index === currentIndex ? 8 : 6,
                        height: index === currentIndex ? 8 : 6,
                      }
                    ]}
                  />
                ))}
              </View>
            )}
            
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.verticalImageOverlay}
            />
          </View>
        <View style={styles.verticalPostInfo}>
          <Text style={styles.verticalPostTitle}>{post.title || 'Untitled Outfit'}</Text>
          <TouchableOpacity onPress={() => handleUsernameTap(post)}>
            <Text style={styles.verticalUserHandle}>@{post.author.handle.startsWith('@') ? post.author.handle.slice(1) : post.author.handle}</Text>
          </TouchableOpacity>
          <Text style={styles.verticalPostDate}>{getRelativeTime(post.created_at)}</Text>
          <View style={styles.tagsContainer}>
            {post.tags && post.tags.map((tag, index) => (
              <Text key={index} style={styles.tag}>#{tag}</Text>
            ))}
          </View>
        </View>
        <View style={styles.verticalActions}>
          <TouchableOpacity 
            style={styles.verticalLikeButton}
            onPress={() => handleLike(post.id)}
          >
            <IconSymbol name={post.liked_by_me ? "heart.fill" : "heart"} size={24} color={post.liked_by_me ? "#ff4444" : "#fff"} />
            <Text style={styles.verticalActionText}>{post.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.verticalViewButton}
          >
            <IconSymbol name="eye.fill" size={24} color="#fff" />
            <Text style={styles.verticalActionText}>{Math.floor(post.likes * 2.3)}k</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.bagOutfitButton}
            onPress={() => {
              // TODO: Add functionality to bag the whole outfit or individual items
              Alert.alert('View Details', 'Post details and shopping functionality would be available here.');
            }}
          >
            <IconSymbol name="bag" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
  };

  return (
    <View style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Grid View */}
      <Animated.View 
        style={[
          { 
            flex: 1,
            position: viewMode === 'grid' ? 'relative' : 'absolute',
            width: '100%',
            height: '100%',
            paddingTop: insets.top 
          },
          {
            opacity: viewTransitionAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0]
            })
          }
        ]}
        pointerEvents={viewMode === 'grid' ? 'auto' : 'none'}
      >
        {/* Header - only show in grid view */}
        <Animated.View style={[
          styles.header, 
          { 
            backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
            height: searchAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [60, 100]
            })
          }
        ]}>
          <Animated.View style={[
            styles.headerContent,
            {
              opacity: searchAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0]
              })
            }
          ]}>
            <Text style={[styles.headerTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
              OnlyFashion
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.viewToggleButton} onPress={toggleViewMode}>
                <IconSymbol 
                  name={viewMode === 'grid' ? 'rectangle.split.2x2' : 'rectangle.portrait'} 
                  size={20} 
                  color={colorScheme === 'dark' ? '#fff' : '#000'} 
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.searchButton} onPress={toggleSearch}>
                <IconSymbol name="magnifyingglass" size={24} color={colorScheme === 'dark' ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>
          </Animated.View>
          
          <Animated.View style={[
            styles.searchContainer,
            {
              opacity: searchAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1]
              }),
              transform: [{
                translateY: searchAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }]
            }
          ]}>
            <View style={[
              styles.searchBar, 
              { 
                backgroundColor: colorScheme === 'dark' ? '#333' : '#f0f0f0',
                borderColor: isMainSearchFocused ? '#7c3aed' : (colorScheme === 'dark' ? '#7c3aed20' : '#7c3aed15'),
                borderWidth: 1
              }
            ]}>
              <IconSymbol name="magnifyingglass" size={20} color={isMainSearchFocused ? '#7c3aed' : (colorScheme === 'dark' ? '#666' : '#999')} />
              <TextInput
                ref={mainSearchInputRef}
                style={[styles.searchInput, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
                placeholder="Search posts, tags, or users..."
                placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                onFocus={() => setIsMainSearchFocused(true)}
                onBlur={() => setIsMainSearchFocused(false)}
                returnKeyType="search"
                autoFocus={isSearchActive}
                editable={true}
                selectTextOnFocus={true}
                blurOnSubmit={false}
              />
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <IconSymbol name="xmark.circle.fill" size={20} color={colorScheme === 'dark' ? '#666' : '#999'} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
        <Animated.View style={[{ flex: 1 }]}>
          <ScrollView 
            style={styles.scrollView}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.postsGrid}>
              {isLoading && posts.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <Text style={[styles.loadingText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                    Loading your feed...
                  </Text>
                </View>
              ) : posts.length > 0 ? (
                <>
                  {posts.map((post, index) => {
                    return renderGridPost(post, index);
                  })}
                  {hasMore && (
                    <View style={styles.loadMoreContainer}>
                      <TouchableOpacity 
                        style={styles.loadMoreButton}
                        onPress={loadMore}
                        disabled={isLoading}
                      >
                        <Text style={styles.loadMoreText}>
                          {isLoading ? 'Loading...' : 'Load More'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.emptyContainer}>
                  <IconSymbol name="photo" size={48} color={colorScheme === 'dark' ? '#666' : '#999'} />
                  <Text style={[styles.emptyText, { color: colorScheme === 'dark' ? '#666' : '#999' }]}>
                    No posts found
                  </Text>
                  <Text style={[styles.emptySubtext, { color: colorScheme === 'dark' ? '#555' : '#aaa' }]}>
                    Follow more users or check back later
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>

      {/* Vertical View */}
      <Animated.View 
        style={[
          { 
            flex: 1,
            position: viewMode === 'vertical' ? 'relative' : 'absolute',
            width: '100%',
            height: '100%',
            backgroundColor: '#000' 
          },
          {
            opacity: viewTransitionAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1]
            })
          }
        ]}
        pointerEvents={viewMode === 'vertical' ? 'auto' : 'none'}
      >
        {/* Floating header for vertical view */}
        <View style={[styles.floatingHeaderContainer, { paddingTop: insets.top }]}>
          <Animated.View style={[
            styles.floatingHeader,
            {
              opacity: searchAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0]
              })
            }
          ]}>
            <View style={styles.floatingHeaderLeft}>
              {focusedPostId && (
                <TouchableOpacity 
                  style={styles.backButton} 
                  onPress={() => {
                    // Quick transition back to grid
                    setFocusedPostId(null);
                    Animated.timing(viewTransitionAnimation, {
                      toValue: 0,
                      duration: 200,
                      useNativeDriver: false,
                    }).start(() => {
                      setViewMode('grid');
                    });
                  }}
                >
                  <IconSymbol name="chevron.left" size={24} color="#fff" />
                </TouchableOpacity>
              )}
              <Text style={styles.floatingHeaderTitle}>OnlyFashion</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.viewToggleButton} onPress={toggleViewMode}>
                <IconSymbol 
                  name="rectangle.split.2x2" 
                  size={20} 
                  color="#fff" 
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.searchButton} onPress={toggleSearch}>
                <IconSymbol name="magnifyingglass" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </Animated.View>
          
          <Animated.View style={[
            styles.floatingSearchContainer,
            {
              opacity: searchAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1]
              }),
              transform: [{
                translateY: searchAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0]
                })
              }]
            }
          ]}>
            <View style={styles.floatingSearchBar}>
              <IconSymbol name="magnifyingglass" size={20} color={isFloatingSearchFocused ? '#7c3aed' : "#666"} />
              <TextInput
                ref={floatingSearchInputRef}
                style={styles.floatingSearchInput}
                placeholder="Search posts, tags, or users..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                onFocus={() => setIsFloatingSearchFocused(true)}
                onBlur={() => setIsFloatingSearchFocused(false)}
                returnKeyType="search"
                autoFocus={isSearchActive}
                editable={true}
                selectTextOnFocus={true}
                blurOnSubmit={false}
              />
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <IconSymbol name="xmark.circle.fill" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
        <Animated.View style={[{ flex: 1 }]}>
          <FlatList
            ref={flatListRef}
            data={focusedPostId ? posts.filter(post => post.id === focusedPostId) : posts}
            renderItem={renderVerticalPost}
            keyExtractor={(item) => item.id}
            pagingEnabled={!focusedPostId}
            showsVerticalScrollIndicator={false}
            snapToInterval={height} // Snap to exact post height
            snapToAlignment="start"
            decelerationRate="fast"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{
              itemVisiblePercentThreshold: 50,
              minimumViewTime: 100,
            }}
            getItemLayout={(data, index) => ({
              length: height,
              offset: height * index,
              index,
            })}
            style={{ backgroundColor: '#000' }}
            contentContainerStyle={{ backgroundColor: '#000' }}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            scrollEnabled={!focusedPostId}
          />
        </Animated.View>
      </Animated.View>
      
      {/* Size Selection Modal */}
      {selectedItem && (
        <View style={styles.modalOverlay}>
          <View style={[styles.sizeModal, { backgroundColor: colorScheme === 'dark' ? '#222' : '#fff' }]}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={closeSizeModal}
            >
              <IconSymbol name="xmark" size={20} color={colorScheme === 'dark' ? '#fff' : '#000'} />
            </TouchableOpacity>
            
            <Text style={[styles.modalTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
              {selectedItem?.name}
            </Text>
            <Text style={[styles.modalBrand, { color: colorScheme === 'dark' ? '#888' : '#666' }]}>
              {selectedItem?.brand}
            </Text>
            <Text style={styles.modalPrice}>{selectedItem?.price}</Text>
            
            {selectedItem && selectedItem.sizes && selectedItem.sizes.length > 1 && (
              <View style={styles.sizesContainer}>
                <Text style={[styles.sizesLabel, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                  Select Size:
                </Text>
                <View style={styles.sizeButtons}>
                  {selectedItem && selectedItem.sizes && selectedItem.sizes.map((size) => (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.sizeButton,
                        selectedSize === size && styles.selectedSizeButton
                      ]}
                      onPress={() => handleSizeSelect(size)}
                    >
                      <Text style={[
                        styles.sizeText,
                        selectedSize === size && styles.selectedSizeText
                      ]}>
                        {size}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            
            <TouchableOpacity
              style={[styles.shopButton, { backgroundColor: '#7c3aed' }]}
              onPress={() => selectedItem && handleAddToCart(selectedItem, posts.find(p => p.clothingItems?.some(item => item.id === selectedItem.id))?.images[0] || '')}
            >
              <Text style={styles.shopButtonText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Profile Preview Modal */}
      {isProfilePreviewVisible && profilePreview && (
        <View style={styles.modalOverlay}>
          <View style={[styles.profileModal, { backgroundColor: colorScheme === 'dark' ? '#222' : '#fff' }]}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setIsProfilePreviewVisible(false)}
            >
              <IconSymbol name="xmark" size={20} color={colorScheme === 'dark' ? '#fff' : '#000'} />
            </TouchableOpacity>
            
            {/* Profile Header */}
            <View style={styles.profileModalHeader}>
              <View style={styles.profileModalAvatar}>
                {profilePreview.avatar_url ? (
                  <Image source={{ uri: profilePreview.avatar_url }} style={styles.profileModalAvatarImage} />
                ) : (
                  <View style={[styles.profileModalAvatarPlaceholder, { backgroundColor: colorScheme === 'dark' ? '#333' : '#f0f0f0' }]}>
                    <IconSymbol name="person.fill" size={24} color={colorScheme === 'dark' ? '#666' : '#999'} />
                  </View>
                )}
              </View>
              <Text style={[styles.profileModalUsername, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                @{profilePreview.username}
              </Text>
            </View>

            {/* Bio Section */}
            <View style={styles.profileModalBio}>
              <Text style={[styles.profileModalBioLabel, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                Bio
              </Text>
              <Text style={[styles.profileModalBioText, { color: colorScheme === 'dark' ? '#ccc' : '#666' }]}>
                {profilePreview.bio || 'No bio available'}
              </Text>
            </View>

            {/* Measurements */}
            <View style={styles.profileModalMeasurements}>
              <Text style={[styles.profileModalMeasurementsLabel, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                Measurements
              </Text>
              <View style={styles.profileModalMeasurementsGrid}>
                <View style={styles.profileModalMeasurementItem}>
                  <Text style={[styles.profileModalMeasurementValue, { color: colorScheme === 'dark' ? '#7c3aed' : '#7c3aed' }]}>
                    {profilePreview.height_cm || 'N/A'}
                  </Text>
                  <Text style={[styles.profileModalMeasurementLabel, { color: colorScheme === 'dark' ? '#ccc' : '#666' }]}>
                    Height (cm)
                  </Text>
                </View>
                <View style={styles.profileModalMeasurementItem}>
                  <Text style={[styles.profileModalMeasurementValue, { color: colorScheme === 'dark' ? '#7c3aed' : '#7c3aed' }]}>
                    {profilePreview.chest_cm || 'N/A'}
                  </Text>
                  <Text style={[styles.profileModalMeasurementLabel, { color: colorScheme === 'dark' ? '#ccc' : '#666' }]}>
                    Chest (cm)
                  </Text>
                </View>
                <View style={styles.profileModalMeasurementItem}>
                  <Text style={[styles.profileModalMeasurementValue, { color: colorScheme === 'dark' ? '#7c3aed' : '#7c3aed' }]}>
                    {profilePreview.waist_cm || 'N/A'}
                  </Text>
                  <Text style={[styles.profileModalMeasurementLabel, { color: colorScheme === 'dark' ? '#ccc' : '#666' }]}>
                    Waist (cm)
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.profileModalActions}>
              <TouchableOpacity
                style={[styles.profileModalButton, { backgroundColor: '#7c3aed' }]}
                onPress={() => {
                  setIsProfilePreviewVisible(false);
                  router.push({
                    pathname: '/(tabs)/user-profile',
                    params: { username: profilePreview.username }
                  });
                }}
              >
                <Text style={styles.profileModalButtonText}>View Full Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderWidth: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  floatingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  floatingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  floatingHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  floatingHeaderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewToggleButton: {
    padding: 8,
    marginRight: 8,
  },
  searchButton: {
    padding: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    position: 'absolute',
    top: 10,
    left: 20,
    right: 20,
  },
  searchContainer: {
    position: 'absolute',
    bottom: 10,
    left: 20,
    right: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  floatingSearchContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
  },
  floatingSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  floatingSearchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#000',
  },
  scrollView: {
    flex: 1,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  postContainer: {
    width: ITEM_WIDTH,
    marginBottom: 20,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: ITEM_WIDTH * 1.4,
  },
  multiImageIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  verticalImageContainer: {
    position: 'relative',
    borderRadius: 0,
    overflow: 'hidden',
    width: width,
    height: height,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalBackgroundImage: {
    position: 'absolute',
    width: '120%',
    height: '120%',
    opacity: 0.3,
    left: '-10%',
    top: '-10%',
  },
  verticalMainImage: {
    width: '100%',
    height: '90%',
    maxWidth: width,
    maxHeight: height * 0.9,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  verticalImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  likeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  likeCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  postInfo: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  postTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  postAuthor: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.9,
  },
  postDate: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '400',
    opacity: 0.7,
  },
  postPrice: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  postLikes: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  userAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  userName: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Vertical (TikTok-style) view styles
  verticalPostContainer: {
    height: height, // Full screen height
    width: width,
    position: 'relative',
    borderWidth: 0,
    overflow: 'hidden',
  },
  verticalPostTouchable: {
    flex: 1,
  },
  verticalPostInfo: {
    position: 'absolute',
    bottom: 150, // Raised higher to avoid navbar collision
    left: 20,
    right: 80,
  },
  verticalUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  verticalPostTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  verticalUserHandle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    opacity: 0.9,
  },
  verticalPostDate: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 12,
    opacity: 0.7,
  },
  verticalPostMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  verticalPostPrice: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginRight: 16,
  },
  verticalPostLikes: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
    marginBottom: 4,
  },
  verticalActions: {
    position: 'absolute',
    right: 20,
    bottom: 150, // Raised higher to avoid navbar collision
    alignItems: 'center',
  },
  verticalLikeButton: {
    alignItems: 'center',
    padding: 8,
  },
  verticalViewButton: {
    alignItems: 'center',
    padding: 8,
    marginTop: 16,
  },
  bagOutfitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8b5cf6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 20,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  bagOutfitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  verticalActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  // Shopping dots styles
  shoppingDot: {
    position: 'absolute',
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  dotPressed: {
    transform: [{ scale: 1.2 }],
    backgroundColor: '#5b21b6',
  },
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  sizeModal: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
    minWidth: 300,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 1001,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 20,
  },
  modalBrand: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  modalPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7c3aed',
    marginBottom: 20,
  },
  sizesContainer: {
    marginBottom: 20,
  },
  sizesLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  sizeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sizeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7c3aed',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(124,58,237,0.1)',
  },
  selectedSizeButton: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  sizeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7c3aed',
  },
  selectedSizeText: {
    color: '#fff',
  },
  shopButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Loading and empty states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  // Load more styles
  loadMoreContainer: {
    width: '100%',
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadMoreButton: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
  },
  loadMoreText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Horizontal image scrolling styles
  verticalImageScrollView: {
    width: width,
    height: height - 200, // Adjust for header and actions
  },
  verticalImageSlide: {
    width: width,
    height: height - 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePagination: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  paginationDot: {
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  imageLoadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
  },
  imageLoadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 10,
  },
  gridImageLoadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
  },
  gridImageLoadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 10,
  },
  // Profile Preview Modal styles
  profileModal: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
    minWidth: 300,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  profileModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  profileModalAvatar: {
    marginBottom: 12,
  },
  profileModalAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profileModalAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModalUsername: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileModalBio: {
    marginBottom: 20,
  },
  profileModalBioLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  profileModalBioText: {
    fontSize: 14,
    lineHeight: 20,
  },
  profileModalMeasurements: {
    marginBottom: 20,
  },
  profileModalMeasurementsLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  profileModalMeasurementsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  profileModalMeasurementItem: {
    alignItems: 'center',
    flex: 1,
  },
  profileModalMeasurementValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileModalMeasurementLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  profileModalActions: {
    marginTop: 10,
  },
  profileModalButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  profileModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
