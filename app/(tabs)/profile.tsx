import { LogoutButton } from '@/components/LogoutButton';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTabContext } from '@/contexts/TabContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useApiClient } from '@/utils/api'; // Re-enabled
import { useUser } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    Modal,
    RefreshControl, // Re-enabled
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

// Re-enabled - will implement with API
interface UserPost {
  id: string;
  author: {
    handle: string;
    avatar_url?: string;
  };
  created_at: string;
  images: string[];
  likes: number;
  liked_by_me: boolean;
  clothingItems?: ClothingItem[];
}

export default function ProfileScreen() {
  const { setActiveTab } = useTabContext();
  const colorScheme = useColorScheme();
  const { user } = useUser();
  const apiClient = useApiClient(); // Re-enabled
  const [isEditing, setIsEditing] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    user_id: user?.id || 'user_123456789',
    username: user?.username || 'fashionista',
    avatar_url: null,
    bio: 'Fashion enthusiast | Style curator | Always looking for the perfect outfit ✨',
    height_cm: 175,
    chest_cm: 95,
    waist_cm: 80,
  });
  const [editedProfile, setEditedProfile] = useState<UserProfile>(profile);
  // Re-enabled posts functionality
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedInitially = useRef(false);

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

  // Load user profile from API
  const loadProfile = useCallback(async () => {
    if (!apiClient) return;
    
    try {
      const response = await apiClient.getProfile('me');
      setProfile(response.profile);
    } catch (error) {
      console.error('Failed to load profile:', error);
      // Keep the default profile if API fails
    }
  }, [apiClient]);

  // Re-enabled - will implement with API
  const loadUserPosts = useCallback(async () => {
    if (!apiClient) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.getUserPosts('me', 20);
      
      // Transform the API response to match frontend expectations (similar to feed)
      const transformedPosts = response.posts.map((post: any) => ({
        ...post,
        // Ensure title is available
        title: post.title || 'Untitled Outfit',
        // Use Clerk username for current user's posts
        author: {
          ...post.author,
          handle: user?.username || 'fashionista'
        },
        // Map 'items' to 'clothingItems' and transform the data structure
        clothingItems: post.items?.map((item: any) => ({
          id: item.id || `item-${Math.random()}`,
          name: item.item_name || item.name || 'Unknown Item',
          price: item.currency === 'JPY' ? `¥${item.price}` : `$${item.price}`,
          link: item.link || null,
          sizes: item.sizes || [],
          brand: item.brand || 'Unknown',
          description: item.user_desc || item.description || '',
          // Convert decimal positions back to percentages for frontend
          dot_position_x: (item.x || 0.5) * 100,
          dot_position_y: (item.y || 0.5) * 100,
        })) || []
      }));
      
      setUserPosts(transformedPosts);
    } catch (err) {
      console.error('Failed to load user posts:', err);
      setError('Failed to load posts. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [apiClient, user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserPosts();
    setRefreshing(false);
  }, [loadUserPosts]);

  // Update profile when user data changes
  useEffect(() => {
    if (user) {
      setProfile(prev => ({
        ...prev,
        id: user.id,
        handle: user.username ? `@${user.username}` : '@fashionista',
      }));
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setActiveTab('profile');
      loadProfile(); // Load profile when tab becomes active
      loadUserPosts(); // Load posts when tab becomes active
    }, [setActiveTab, loadProfile, loadUserPosts])
  );

  const handleEdit = () => {
    setEditedProfile(profile);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      // Update profile via API
      const updateData: any = {};
      
      if (editedProfile.username !== profile.username) {
        updateData.username = editedProfile.username;
      }
      if (editedProfile.bio !== profile.bio) {
        updateData.bio = editedProfile.bio;
      }
      if (editedProfile.height_cm !== profile.height_cm) {
        updateData.height_cm = editedProfile.height_cm;
      }
      if (editedProfile.chest_cm !== profile.chest_cm) {
        updateData.chest_cm = editedProfile.chest_cm;
      }
      if (editedProfile.waist_cm !== profile.waist_cm) {
        updateData.waist_cm = editedProfile.waist_cm;
      }
      
      if (Object.keys(updateData).length > 0) {
        const response = await apiClient.updateProfile(updateData);
        setProfile(response.profile);
      }
      
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  const handleSettings = () => {
    setShowSettingsModal(true);
  };

  const pickAvatar = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please grant camera roll permissions to update your avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && user && result.assets[0].base64) {
      try {
        await user.setProfileImage({ file: `data:image/jpeg;base64,${result.assets[0].base64}` });
        Alert.alert('Success', 'Avatar updated successfully!');
      } catch (error) {
        console.error('Error updating avatar:', error);
        Alert.alert('Error', 'Failed to update avatar. Please try again.');
      }
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please grant camera permissions to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && user && result.assets[0].base64) {
      try {
        await user.setProfileImage({ file: `data:image/jpeg;base64,${result.assets[0].base64}` });
        Alert.alert('Success', 'Avatar updated successfully!');
      } catch (error) {
        console.error('Error updating avatar:', error);
        Alert.alert('Error', 'Failed to update avatar. Please try again.');
      }
    }
  };

  const showAvatarOptions = () => {
    Alert.alert(
      'Update Avatar',
      'Select a new profile picture',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Gallery', onPress: pickAvatar },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Re-enabled - will implement with API
  const handleDeletePost = (postId: string) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            setUserPosts(prev => prev.filter(post => post.id !== postId));
          }
        },
      ]
    );
  };

  // const handleEditPost = (postId: string) => {
  //   // TODO: Navigate to edit post screen
  //   Alert.alert('Edit Post', `Edit functionality for post ${postId} would be implemented here.`);
  // };

  const currentProfile = isEditing ? editedProfile : profile;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
        {!isEditing ? (
          <Text style={[styles.headerTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
            @{currentProfile.username}
          </Text>
        ) : (
          <TextInput
            style={[styles.headerTitleInput, { 
              backgroundColor: colorScheme === 'dark' ? '#333' : '#f8f8f8',
              color: colorScheme === 'dark' ? '#fff' : '#000'
            }]}
            value={editedProfile.username}
            onChangeText={(text) => setEditedProfile(prev => ({ ...prev, username: text }))}
            placeholder="username"
            placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
          />
        )}
        {!isEditing ? (
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[styles.settingsButton, { backgroundColor: colorScheme === 'dark' ? '#333' : '#f0f0f0' }]}
              onPress={handleSettings}
            >
              <IconSymbol name="gearshape.fill" size={18} color={colorScheme === 'dark' ? '#fff' : '#000'} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.editButton, { backgroundColor: '#7c3aed' }]}
              onPress={handleEdit}
            >
              <IconSymbol name="pencil" size={16} color="#fff" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.cancelButton, { backgroundColor: '#666' }]}
              onPress={handleCancel}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: '#7c3aed' }]}
              onPress={handleSave}
            >
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Header Section - Avatar + Bio Side by Side */}
        <View style={styles.profileHeader}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={showAvatarOptions}
            >
              {(user?.imageUrl || currentProfile.avatar_url) ? (
                <Image source={{ uri: user?.imageUrl || currentProfile.avatar_url || '' }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colorScheme === 'dark' ? '#333' : '#f0f0f0' }]}>
                  <IconSymbol name="person.fill" size={40} color={colorScheme === 'dark' ? '#666' : '#999'} />
                </View>
              )}
              <View style={styles.editAvatarOverlay}>
                <IconSymbol name="camera.fill" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Bio Section */}
          <View style={styles.bioSection}>
            <Text style={[styles.fieldLabel, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
              Bio
            </Text>
            {isEditing ? (
              <TextInput
                style={[styles.bioInput, { 
                  backgroundColor: colorScheme === 'dark' ? '#333' : '#f8f8f8',
                  color: colorScheme === 'dark' ? '#fff' : '#000'
                }]}
                value={editedProfile.bio || ''}
                onChangeText={(text) => setEditedProfile(prev => ({ ...prev, bio: text }))}
                placeholder="Tell us about yourself..."
                placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                multiline
                numberOfLines={4}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                {currentProfile.bio}
              </Text>
            )}
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
                {isEditing ? (
                  <View style={styles.measurementInputContainer}>
                    <TextInput
                      style={[styles.measurementTableInput, { 
                        backgroundColor: colorScheme === 'dark' ? '#333' : '#fff',
                        color: colorScheme === 'dark' ? '#fff' : '#000'
                      }]}
                      value={editedProfile.height_cm?.toString() || ''}
                      onChangeText={(text) => setEditedProfile(prev => ({ ...prev, height_cm: parseInt(text) || null }))}
                      placeholder="175"
                      placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.measurementUnit, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>cm</Text>
                  </View>
                ) : (
                  <Text style={[styles.measurementTableValue, { color: colorScheme === 'dark' ? '#7c3aed' : '#7c3aed' }]}>
                    {currentProfile.height_cm || 'N/A'}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.measurementColumn}>
              <View style={[styles.measurementHeader, { backgroundColor: colorScheme === 'dark' ? '#333' : '#e0e0e0' }]}>
                <IconSymbol name="circle.grid.cross" size={16} color={colorScheme === 'dark' ? '#7c3aed' : '#7c3aed'} />
                <Text style={[styles.measurementHeaderText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>Chest</Text>
              </View>
              <View style={styles.measurementCell}>
                {isEditing ? (
                  <View style={styles.measurementInputContainer}>
                    <TextInput
                      style={[styles.measurementTableInput, { 
                        backgroundColor: colorScheme === 'dark' ? '#333' : '#fff',
                        color: colorScheme === 'dark' ? '#fff' : '#000'
                      }]}
                      value={editedProfile.chest_cm?.toString() || ''}
                      onChangeText={(text) => setEditedProfile(prev => ({ ...prev, chest_cm: parseInt(text) || null }))}
                      placeholder="95"
                      placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.measurementUnit, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>cm</Text>
                  </View>
                ) : (
                  <Text style={[styles.measurementTableValue, { color: colorScheme === 'dark' ? '#7c3aed' : '#7c3aed' }]}>
                    {currentProfile.chest_cm || 'N/A'}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.measurementColumn}>
              <View style={[styles.measurementHeader, { backgroundColor: colorScheme === 'dark' ? '#333' : '#e0e0e0' }]}>
                <IconSymbol name="oval" size={16} color={colorScheme === 'dark' ? '#7c3aed' : '#7c3aed'} />
                <Text style={[styles.measurementHeaderText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>Waist</Text>
              </View>
              <View style={styles.measurementCell}>
                {isEditing ? (
                  <View style={styles.measurementInputContainer}>
                    <TextInput
                      style={[styles.measurementTableInput, { 
                        backgroundColor: colorScheme === 'dark' ? '#333' : '#fff',
                        color: colorScheme === 'dark' ? '#fff' : '#000'
                      }]}
                      value={editedProfile.waist_cm?.toString() || ''}
                      onChangeText={(text) => setEditedProfile(prev => ({ ...prev, waist_cm: parseInt(text) || null }))}
                      placeholder="80"
                      placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.measurementUnit, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>cm</Text>
                  </View>
                ) : (
                  <Text style={[styles.measurementTableValue, { color: colorScheme === 'dark' ? '#7c3aed' : '#7c3aed' }]}>
                    {currentProfile.waist_cm || 'N/A'}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Posts Section */}
        <View style={styles.postsSection}>
          <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
            My Posts
          </Text>
          
          {loading && userPosts.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colorScheme === 'dark' ? '#222' : '#f8f8f8' }]}>
              <Text style={[styles.emptyStateText, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>
                Loading your posts...
              </Text>
            </View>
          ) : error ? (
            <View style={[styles.emptyState, { backgroundColor: colorScheme === 'dark' ? '#222' : '#f8f8f8' }]}>
              <IconSymbol name="exclamationmark.triangle" size={48} color={colorScheme === 'dark' ? '#ff6b6b' : '#ff6b6b'} />
              <Text style={[styles.emptyStateText, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>
                {error}
              </Text>
              <TouchableOpacity 
                style={[styles.retryButton, { backgroundColor: '#7c3aed' }]}
                onPress={loadUserPosts}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : userPosts.length > 0 ? (
            <View style={styles.postsGrid}>
              {userPosts.map((post, index) => (
                <View key={post.id} style={styles.postGridItem}>
                  <TouchableOpacity 
                    style={styles.postGridImageContainer}
                    onPress={() => {
                      // TODO: Navigate to post detail view
                      Alert.alert('Post Details', `View details for post ${post.id}`);
                    }}
                  >
                    <Image 
                      source={{ uri: post.images[0] }} 
                      style={styles.postGridImage}
                      resizeMode="cover"
                    />
                    {post.images.length > 1 && (
                      <View style={styles.multipleImagesIndicator}>
                        <IconSymbol name="photo.on.rectangle" size={16} color="#fff" />
                        <Text style={styles.multipleImagesText}>{post.images.length}</Text>
                      </View>
                    )}
                    <View style={styles.postGridOverlay}>
                      <View style={styles.postStats}>
                        <View style={styles.postGridStat}>
                          <IconSymbol name="heart.fill" size={12} color="#ff4444" />
                          <Text style={styles.postGridStatText}>{post.likes}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                  
                  {/* Post Actions */}
                  <View style={styles.postGridActions}>
                    <TouchableOpacity 
                      style={styles.postGridActionButton}
                      onPress={() => {
                        // TODO: Navigate to edit post screen
                        Alert.alert('Edit Post', `Edit functionality for post ${post.id} would be implemented here.`);
                      }}
                    >
                      <IconSymbol name="pencil" size={14} color={colorScheme === 'dark' ? '#fff' : '#000'} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.postGridActionButton}
                      onPress={() => handleDeletePost(post.id)}
                    >
                      <IconSymbol name="trash" size={14} color="#ff4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colorScheme === 'dark' ? '#222' : '#f8f8f8' }]}>
              <IconSymbol name="photo" size={48} color={colorScheme === 'dark' ? '#7c3aed' : '#7c3aed'} />
              <Text style={[styles.emptyStateText, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>
                No posts yet
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colorScheme === 'dark' ? '#666' : '#999' }]}>
                Share your first fashion post to get started
              </Text>
            </View>
          )}
        </View>
        
        {/* Logout Button */}
        <LogoutButton />
      </ScrollView>

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
          <View style={[styles.modalHeader, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
              Account Settings
            </Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowSettingsModal(false)}
            >
              <IconSymbol name="xmark" size={20} color={colorScheme === 'dark' ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.settingsSection}>
              <Text style={[styles.settingsLabel, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>ACCOUNT</Text>
              
              <TouchableOpacity 
                style={[styles.settingsItem, { backgroundColor: colorScheme === 'dark' ? '#111' : '#f8f8f8' }]}
                onPress={() => {
                  Alert.alert('Profile Settings', 'Manage your profile information, display name, and email address.');
                }}
              >
                <View style={styles.settingsItemLeft}>
                  <IconSymbol name="person.circle" size={20} color="#7c3aed" />
                  <Text style={[styles.settingsItemText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                    Profile Information
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colorScheme === 'dark' ? '#666' : '#999'} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.settingsItem, { backgroundColor: colorScheme === 'dark' ? '#111' : '#f8f8f8' }]}
                onPress={() => {
                  Alert.alert('Security Settings', 'Manage your password, two-factor authentication, and security preferences.');
                }}
              >
                <View style={styles.settingsItemLeft}>
                  <IconSymbol name="lock.shield" size={20} color="#7c3aed" />
                  <Text style={[styles.settingsItemText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                    Security & Authentication
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colorScheme === 'dark' ? '#666' : '#999'} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.settingsItem, { backgroundColor: colorScheme === 'dark' ? '#111' : '#f8f8f8' }]}
                onPress={() => {
                  Alert.alert('Email Settings', 'Manage your email addresses and verification status.');
                }}
              >
                <View style={styles.settingsItemLeft}>
                  <IconSymbol name="envelope" size={20} color="#7c3aed" />
                  <Text style={[styles.settingsItemText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                    Email Addresses
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colorScheme === 'dark' ? '#666' : '#999'} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingsSection}>
              <Text style={[styles.settingsLabel, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>PREFERENCES</Text>
              
              <TouchableOpacity 
                style={[styles.settingsItem, { backgroundColor: colorScheme === 'dark' ? '#111' : '#f8f8f8' }]}
                onPress={() => {
                  Alert.alert('Privacy Settings', 'Control your privacy settings and data sharing preferences.');
                }}
              >
                <View style={styles.settingsItemLeft}>
                  <IconSymbol name="eye.slash" size={20} color="#7c3aed" />
                  <Text style={[styles.settingsItemText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                    Privacy & Visibility
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colorScheme === 'dark' ? '#666' : '#999'} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.settingsItem, { backgroundColor: colorScheme === 'dark' ? '#111' : '#f8f8f8' }]}
                onPress={() => {
                  Alert.alert('Notification Settings', 'Manage your notification preferences and frequency.');
                }}
              >
                <View style={styles.settingsItemLeft}>
                  <IconSymbol name="bell" size={20} color="#7c3aed" />
                  <Text style={[styles.settingsItemText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                    Notifications
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colorScheme === 'dark' ? '#666' : '#999'} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingsSection}>
              <Text style={[styles.settingsLabel, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>SUPPORT</Text>
              
              <TouchableOpacity 
                style={[styles.settingsItem, { backgroundColor: colorScheme === 'dark' ? '#111' : '#f8f8f8' }]}
                onPress={() => {
                  Alert.alert('Help & Support', 'Get help with your account or contact our support team.');
                }}
              >
                <View style={styles.settingsItemLeft}>
                  <IconSymbol name="questionmark.circle" size={20} color="#7c3aed" />
                  <Text style={[styles.settingsItemText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                    Help & Support
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colorScheme === 'dark' ? '#666' : '#999'} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.settingsItem, { backgroundColor: colorScheme === 'dark' ? '#111' : '#f8f8f8' }]}
                onPress={() => {
                  Alert.alert('About OnlyFashion', 'Learn more about OnlyFashion, version information, and terms of service.');
                }}
              >
                <View style={styles.settingsItemLeft}>
                  <IconSymbol name="info.circle" size={20} color="#7c3aed" />
                  <Text style={[styles.settingsItemText, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                    About
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colorScheme === 'dark' ? '#666' : '#999'} />
              </TouchableOpacity>
            </View>

            {/* User Info Section */}
            {user && (
              <View style={styles.userInfoSection}>
                <Text style={[styles.settingsLabel, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>ACCOUNT INFO</Text>
                <View style={[styles.userInfoCard, { backgroundColor: colorScheme === 'dark' ? '#111' : '#f8f8f8' }]}>
                  <Text style={[styles.userInfoEmail, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                    {user.emailAddresses?.[0]?.emailAddress || 'No email'}
                  </Text>
                  <Text style={[styles.userInfoId, { color: colorScheme === 'dark' ? '#666' : '#999' }]}>
                    User ID: {user.id}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerTitleInput: {
    fontSize: 24,
    fontWeight: '700',
    padding: 8,
    borderRadius: 8,
    minWidth: 200,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  avatarSection: {
    alignItems: 'center',
    flex: 0.35,
  },
  profileHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 24,
    alignItems: 'flex-start',
  },
  bioSection: {
    flex: 0.65,
    paddingTop: 8,
  },
  measurementsTable: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 12,
    overflow: 'hidden',
    gap: 1,
  },
  measurementColumn: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  measurementHeader: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  measurementHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  measurementCell: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  measurementTableInput: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'transparent',
    minHeight: 24,
  },
  measurementTableValue: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  gridPostCard: {
    width: GRID_ITEM_WIDTH,
    height: GRID_ITEM_WIDTH,
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  gridPostImageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  gridPostImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gridPostOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    padding: 8,
  },
  gridPostStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridLikesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridLikesText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  gridPostActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  gridActionButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    padding: 6,
  },
  gridPostTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#7c3aed',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  infoSection: {
    paddingBottom: 32,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#7c3aed',
  },
  fieldValue: {
    fontSize: 15,
    lineHeight: 22,
  },
  textInput: {
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  bioInput: {
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  measurementsSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  measurementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  measurementItem: {
    flex: 1,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  measurementLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  measurementValue: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  measurementInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  measurementInput: {
    width: 80,
    padding: 8,
    borderRadius: 8,
    fontSize: 16,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  measurementUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Posts section styles
  postsSection: {
    marginTop: 32,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    borderRadius: 12,
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 20,
  },
  postCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  postImageContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  postImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  multiImageIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    padding: 6,
  },
  postContent: {
    padding: 16,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  postDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  postStatsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  postLikes: {
    fontSize: 12,
    fontWeight: '600',
  },
  postDate: {
    fontSize: 11,
  },
  postActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
  postTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  tagChip: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  moreTagsText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
    borderRadius: 16,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  settingsSection: {
    marginTop: 24,
  },
  settingsLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  userInfoSection: {
    marginTop: 24,
    marginBottom: 40,
  },
  userInfoCard: {
    padding: 16,
    borderRadius: 12,
  },
  userInfoEmail: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userInfoId: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  gridPostSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Post grid styles
  postGridItem: {
    width: GRID_ITEM_WIDTH,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  postGridImageContainer: {
    position: 'relative',
    width: '100%',
    height: GRID_ITEM_WIDTH,
  },
  postGridImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  multipleImagesIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  multipleImagesText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  postGridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
  },
  postGridStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postGridStatText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  postGridActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  postGridActionButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
});
