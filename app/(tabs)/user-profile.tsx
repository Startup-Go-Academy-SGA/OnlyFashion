import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useApiClient } from '@/utils/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');
const GRID_ITEM_WIDTH = (width - 60) / 3; // 3 columns with padding

interface UserProfile {
  user_id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  height_cm: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
}

interface UserPost {
  id: string;
  title: string;
  author: {
    handle: string;
    avatar_url?: string;
  };
  created_at: string;
  images: string[];
  likes: number;
  liked_by_me: boolean;
  clothingItems?: any[];
}

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const colorScheme = useColorScheme();
  const apiClient = useApiClient();
  const router = useRouter();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Helper function to get relative time
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

  // Load user profile by username
  const loadProfile = useCallback(async () => {
    if (!apiClient || !username) return;
    
    try {
      // Try to use the username directly with the profile endpoint
      // The backend should be able to resolve usernames to user IDs
      const response = await apiClient.getProfile(username);
      setProfile(response.profile);
      // After getting profile, load posts using the user_id from the profile
      if (response.profile.user_id) {
        loadUserPosts(response.profile.user_id);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      setError('Failed to load profile');
    }
  }, [apiClient, username]);

  // Load user posts by user ID
  const loadUserPosts = useCallback(async (userId?: string) => {
    if (!apiClient || !userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.getUserPosts(userId, 20);
      
      const transformedPosts = response.posts.map((post: any) => ({
        ...post,
        title: post.title || 'Untitled Outfit',
        author: {
          ...post.author,
          handle: post.author?.handle || username || 'unknown'
        },
        clothingItems: post.items?.map((item: any) => ({
          id: item.id || `item-${Math.random()}`,
          name: item.item_name || item.name || 'Unknown Item',
          price: item.currency === 'JPY' ? `¥${item.price}` : `$${item.price}`,
          link: item.link || null,
          sizes: item.sizes || [],
          brand: item.brand || 'Unknown',
          description: item.user_desc || item.description || '',
          dot_position_x: (item.x || 0.5) * 100,
          dot_position_y: (item.y || 0.5) * 100,
        })) || []
      }));
      
      setUserPosts(transformedPosts);
    } catch (err) {
      console.error('Failed to load user posts:', err);
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [apiClient, username]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  useEffect(() => {
    if (username) {
      loadProfile();
    }
  }, [username, loadProfile]);

  if (!username) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
        <Text style={[styles.errorText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
          No username provided
        </Text>
      </SafeAreaView>
    );
  }

  if (error && !profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
        <Text style={[styles.errorText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
          {error}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color={colorScheme === 'dark' ? '#fff' : '#000'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
          {profile ? `@${profile.username}` : 'Loading...'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {profile && (
          <>
            {/* Profile Header Section */}
            <View style={styles.profileHeader}>
              {/* Avatar Section */}
              <View style={styles.avatarSection}>
                <View style={styles.avatarContainer}>
                  {profile.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: colorScheme === 'dark' ? '#333' : '#f0f0f0' }]}>
                      <IconSymbol name="person.fill" size={40} color={colorScheme === 'dark' ? '#666' : '#999'} />
                    </View>
                  )}
                </View>
              </View>

              {/* Bio Section */}
              <View style={styles.bioSection}>
                <Text style={[styles.fieldLabel, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                  Bio
                </Text>
                <Text style={[styles.fieldValue, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                  {profile.bio || 'No bio available'}
                </Text>
              </View>
            </View>

            {/* Measurements Table */}
            <View style={styles.measurementsSection}>
              <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                Measurements
              </Text>
              
              <View style={[styles.measurementsTable, { backgroundColor: colorScheme === 'dark' ? '#222' : '#f8f8f8' }]}>
                <View style={styles.measurementColumn}>
                  <View style={[styles.measurementHeader, { backgroundColor: colorScheme === 'dark' ? '#333' : '#e0e0e0' }]}>
                    <IconSymbol name="ruler" size={16} color={colorScheme === 'dark' ? '#7c3aed' : '#7c3aed'} />
                    <Text style={[styles.measurementHeaderText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>Height</Text>
                  </View>
                  <View style={styles.measurementCell}>
                    <Text style={[styles.measurementTableValue, { color: colorScheme === 'dark' ? '#7c3aed' : '#7c3aed' }]}>
                      {profile.height_cm || 'N/A'}
                    </Text>
                  </View>
                </View>

                <View style={styles.measurementColumn}>
                  <View style={[styles.measurementHeader, { backgroundColor: colorScheme === 'dark' ? '#333' : '#e0e0e0' }]}>
                    <IconSymbol name="circle.grid.cross" size={16} color={colorScheme === 'dark' ? '#7c3aed' : '#7c3aed'} />
                    <Text style={[styles.measurementHeaderText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>Chest</Text>
                  </View>
                  <View style={styles.measurementCell}>
                    <Text style={[styles.measurementTableValue, { color: colorScheme === 'dark' ? '#7c3aed' : '#7c3aed' }]}>
                      {profile.chest_cm || 'N/A'}
                    </Text>
                  </View>
                </View>

                <View style={styles.measurementColumn}>
                  <View style={[styles.measurementHeader, { backgroundColor: colorScheme === 'dark' ? '#333' : '#e0e0e0' }]}>
                    <IconSymbol name="oval" size={16} color={colorScheme === 'dark' ? '#7c3aed' : '#7c3aed'} />
                    <Text style={[styles.measurementHeaderText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>Waist</Text>
                  </View>
                  <View style={styles.measurementCell}>
                    <Text style={[styles.measurementTableValue, { color: colorScheme === 'dark' ? '#7c3aed' : '#7c3aed' }]}>
                      {profile.waist_cm || 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Posts Section */}
            <View style={styles.postsSection}>
              <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                Posts ({userPosts.length})
              </Text>
              
              {loading ? (
                <Text style={[styles.loadingText, { color: colorScheme === 'dark' ? '#ccc' : '#666' }]}>
                  Loading posts...
                </Text>
              ) : userPosts.length > 0 ? (
                <View style={styles.postsGrid}>
                  {userPosts.map((post) => (
                    <TouchableOpacity
                      key={post.id}
                      style={styles.postItem}
                      onPress={() => {
                        // Navigate to post detail view
                        Alert.alert('Post Detail', `Viewing post: ${post.title}`);
                      }}
                    >
                      <Image 
                        source={{ uri: post.images[0] }} 
                        style={styles.postImage}
                        resizeMode="cover"
                      />
                      <View style={styles.postOverlay}>
                        <View style={styles.postStats}>
                          <IconSymbol name="heart.fill" size={12} color="#fff" />
                          <Text style={styles.postStatsText}>{post.likes}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={[styles.noPostsText, { color: colorScheme === 'dark' ? '#ccc' : '#666' }]}>
                  No posts yet
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    padding: 20,
    gap: 20,
  },
  avatarSection: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bioSection: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  fieldValue: {
    fontSize: 16,
    lineHeight: 22,
  },
  measurementsSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  measurementsTable: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
  },
  measurementColumn: {
    flex: 1,
  },
  measurementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
  },
  measurementHeaderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  measurementCell: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  measurementTableValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  postsSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  postItem: {
    width: GRID_ITEM_WIDTH,
    height: GRID_ITEM_WIDTH,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  postOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  postStatsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 20,
  },
  noPostsText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 20,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 50,
  },
}); 