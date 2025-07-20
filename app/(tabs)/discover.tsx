import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTabContext } from '@/contexts/TabContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  RefreshControl,
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
const ITEM_WIDTH = (width - 48) / 2;

interface TrendingTag {
  id: string;
  name: string;
  count: number;
  color: string;
}

interface StyleCategory {
  id: string;
  name: string;
  image: string;
  postCount: number;
}

interface FeaturedCreator {
  id: string;
  name: string;
  username: string;
  avatar: string;
  followers: string;
  isVerified: boolean;
  posts: number;
}

const trendingTags: TrendingTag[] = [
  { id: '1', name: '#streetwear', count: 2350, color: '#FF6B6B' },
  { id: '2', name: '#minimalist', count: 1892, color: '#4ECDC4' },
  { id: '3', name: '#vintage', count: 1456, color: '#45B7D1' },
  { id: '4', name: '#formal', count: 1234, color: '#96CEB4' },
  { id: '5', name: '#casual', count: 987, color: '#FFEAA7' },
  { id: '6', name: '#boho', count: 834, color: '#DDA0DD' },
];

const STYLE_CATEGORIES: StyleCategory[] = [
  {
    id: '1',
    name: 'Street Style',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=300&fit=crop',
    postCount: 2350
  },
  {
    id: '2',
    name: 'Minimalist',
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=300&fit=crop',
    postCount: 1892
  },
  {
    id: '3',
    name: 'Vintage',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=300&fit=crop',
    postCount: 1456
  },
  {
    id: '4',
    name: 'Formal',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=300&fit=crop',
    postCount: 1234
  },
];

const FEATURED_CREATORS: FeaturedCreator[] = [
  {
    id: '1',
    name: 'Sarah Martinez',
    username: '@sarahstyle',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b637?w=100&h=100&fit=crop&crop=face',
    followers: '125K',
    isVerified: true,
    posts: 234
  },
  {
    id: '2',
    name: 'Alex Kim',
    username: '@minimalalex',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    followers: '89K',
    isVerified: true,
    posts: 156
  },
  {
    id: '3',
    name: 'Maya Lopez',
    username: '@streetmaya',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    followers: '67K',
    isVerified: false,
    posts: 89
  },
];

export default function DiscoverScreen() {
  const colorScheme = useColorScheme();
  const { setActiveTab } = useTabContext();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setActiveTab('discover');
    }, [setActiveTab])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const styles = createStyles(colorScheme ?? 'light');

  const openFeedScreen = (type: string, title: string, query?: any) => {
    Alert.alert('Navigation', `Opening ${title} feed with query: ${JSON.stringify(query || 'all')}`);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      openFeedScreen('search', 'Search Results', { query: searchQuery });
    }
  };

  const renderTrendingTag = (tag: TrendingTag) => (
    <TouchableOpacity
      key={tag.id}
      style={[styles.tagButton, { backgroundColor: tag.color + '20', borderColor: tag.color }]}
      activeOpacity={0.8}
      onPress={() => openFeedScreen('tag', `#${tag.name}`, { tag: tag.name })}
    >
      <Text style={[styles.tagText, { color: tag.color }]}>{tag.name}</Text>
      <Text style={[styles.tagCount, { color: tag.color }]}>{tag.count}</Text>
    </TouchableOpacity>
  );

  const renderStyleCategory = (category: StyleCategory) => (
    <TouchableOpacity
      key={category.id}
      style={styles.categoryCard}
      activeOpacity={0.9}
      onPress={() => openFeedScreen('category', category.name, { category: category.id })}
    >
      <Image source={{ uri: category.image }} style={styles.categoryImage} />
      <View style={styles.categoryOverlay}>
        <Text style={styles.categoryName}>{category.name}</Text>
        <Text style={styles.categoryCount}>{category.postCount} posts</Text>
      </View>
    </TouchableOpacity>
  );

  const renderFeaturedCreator = (creator: FeaturedCreator) => (
    <TouchableOpacity
      key={creator.id}
      style={[styles.creatorCard, { backgroundColor: colorScheme === 'dark' ? '#333' : '#f8f8f8' }]}
      activeOpacity={0.8}
      onPress={() => openFeedScreen('creator', creator.name, { creatorId: creator.id })}
    >
      <Image source={{ uri: creator.avatar }} style={styles.creatorAvatar} />
      <View style={styles.creatorInfo}>
        <View style={styles.creatorNameRow}>
          <Text style={[styles.creatorName, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
            {creator.name}
          </Text>
          {creator.isVerified && (
            <IconSymbol name="checkmark.seal.fill" size={16} color="#007AFF" />
          )}
        </View>
        <Text style={[styles.creatorUsername, { color: colorScheme === 'dark' ? '#888' : '#666' }]}>
          {creator.username}
        </Text>
        <View style={styles.creatorStats}>
          <Text style={[styles.creatorFollowers, { color: colorScheme === 'dark' ? '#ccc' : '#333' }]}>
            {creator.followers} followers
          </Text>
          <Text style={[styles.creatorPosts, { color: colorScheme === 'dark' ? '#ccc' : '#333' }]}>
            {creator.posts} posts
          </Text>
        </View>
      </View>
      <TouchableOpacity style={[styles.followButton, { backgroundColor: '#7c3aed' }]}>
        <Text style={styles.followButtonText}>Follow</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
        <View style={[
          styles.searchBar, 
          { 
            backgroundColor: colorScheme === 'dark' ? '#333' : '#f0f0f0',
            borderColor: isSearchFocused ? '#7c3aed' : (colorScheme === 'dark' ? '#7c3aed20' : '#7c3aed15')
          }
        ]}>
          <IconSymbol name="magnifyingglass" size={20} color={isSearchFocused ? '#7c3aed' : (colorScheme === 'dark' ? '#666' : '#999')} />
          <TextInput
            style={[styles.searchInput, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
            placeholder="Search styles, creators, or trends..."
            placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            returnKeyType="search"
            editable={true}
            selectTextOnFocus={true}
            blurOnSubmit={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
              <IconSymbol name="arrow.right" size={16} color="#7c3aed" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Trending Tags */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
              Trending Now
            </Text>
            <TouchableOpacity onPress={() => openFeedScreen('allTags', 'All Tags', {})}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tagsContainer}>
            {trendingTags.map(renderTrendingTag)}
          </View>
        </View>

        {/* Style Categories */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
              Style Categories
            </Text>
            <TouchableOpacity onPress={() => openFeedScreen('allCategories', 'All Categories', {})}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.categoriesGrid}>
            {STYLE_CATEGORIES.map(renderStyleCategory)}
          </View>
        </View>

        {/* Featured Creators */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
              Featured Creators
            </Text>
            <TouchableOpacity onPress={() => openFeedScreen('allCreators', 'All Creators', {})}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.creatorsContainer}>
            {FEATURED_CREATORS.map(renderFeaturedCreator)}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colorScheme: string) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  searchButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
  },
  tagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  tagCount: {
    fontSize: 12,
    opacity: 0.8,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: ITEM_WIDTH,
    height: 120,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  categoryName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  categoryCount: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  creatorsContainer: {
    paddingHorizontal: 20,
  },
  creatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  creatorAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  creatorInfo: {
    flex: 1,
  },
  creatorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 6,
  },
  creatorUsername: {
    fontSize: 14,
    marginBottom: 6,
  },
  creatorStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorFollowers: {
    fontSize: 12,
    marginRight: 12,
  },
  creatorPosts: {
    fontSize: 12,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
