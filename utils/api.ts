import { useAuth } from '@clerk/clerk-expo';

const API_BASE_URL = 'https://api.egress.live';

/**
 * API utility class for making authenticated requests to the OnlyFits API
 */
export class ApiClient {
  private static instance: ApiClient;
  private getToken: (() => Promise<string | null>) | null = null;

  private constructor() {}

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * Initialize the API client with the Clerk getToken function
   */
  initialize(getToken: () => Promise<string | null>) {
    this.getToken = getToken;
  }

  /**
   * Make an authenticated request to the API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    if (!this.getToken) {
      throw new Error('API client not initialized. Call initialize() first.');
    }

    const token = await this.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        url,
        method: options.method || 'GET',
        errorResponse: errorText
      });
      throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
    }

    return response;
  }

  /**
   * Upload multiple images and create a post with clothing items and dot positions
   */
  async uploadPost(
    images: string[], 
    title: string,
    description: string,
    clothingItems?: {
      name: string;
      price: string;
      link?: string;
      sizes: string[];
      brand: string;
      description: string;
      dot_position_x: number;
      dot_position_y: number;
    }[]
  ): Promise<{
    post: {
      id: string;
      user_id: string;
      created_at: string;
    };
    media: string[];
  }> {
    const formData = new FormData();

    // Add images to form data
    for (let i = 0; i < images.length; i++) {
      const imageUri = images[i];
      
      // Determine the file extension and MIME type
      const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
      
      // Create the file object for React Native FormData
      const file = {
        uri: imageUri,
        name: `image_${i}.${fileExtension}`,
        type: mimeType,
      } as any;

      formData.append('images', file);
    }

    // Add required metadata fields
    formData.append('title', title);
    formData.append('description', description);

    // Add clothing items with dot positions as JSON string if provided
    if (clothingItems && clothingItems.length > 0) {
      // Map frontend field names to database field names
      const dbClothingItems = clothingItems.map(item => ({
        item_name: item.name,                           // name -> item_name
        brand: item.brand || 'Unknown',                 // brand -> brand
        price: parseInt(item.price.replace(/[^0-9]/g, '')) || 0, // "$29.99" -> 2999 (integer)
        currency: 'JPY',                                // Add default currency
        link: item.link || null,                        // link -> link
        user_desc: item.description || null,            // description -> user_desc
        sizes: item.sizes || [],                        // sizes -> sizes
        x: Number(item.dot_position_x) / 100 || 0.25,   // Convert percentage to decimal (25% -> 0.25)
        y: Number(item.dot_position_y) / 100 || 0.25    // Convert percentage to decimal (25% -> 0.25)
      }));
      
      console.log('Sending clothing items (mapped for DB):', JSON.stringify(dbClothingItems, null, 2));
      formData.append('items', JSON.stringify(dbClothingItems));
    } else {
      console.log('No clothing items to send');
    }

    console.log('Upload data summary:', {
      title,
      description,
      imageCount: images.length,
      clothingItemCount: clothingItems?.length || 0
    });

    const response = await this.makeRequest('/upload-post', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header for FormData in React Native
      // The fetch API will set it automatically with the boundary
    });

    const result = await response.json();
    console.log('Upload response:', result);
    return result;
  }

  /**
   * Get the user's feed
   */
  async getFeed(limit: number = 20, cursor?: string): Promise<{
    feed: any[];
    next_cursor: string | null;
  }> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (cursor) {
      params.append('cursor', cursor);
    }

    const response = await this.makeRequest(`/feed?${params.toString()}`);
    return response.json();
  }

  /**
   * Get posts authored by a specific user (or "me" for current user)
   */
  async getUserPosts(userId: string = 'me', limit: number = 20, cursor?: string): Promise<{
    posts: any[];
    next_cursor: string | null;
  }> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (cursor) {
      params.append('cursor', cursor);
    }

    try {
      const response = await this.makeRequest(`/users/${userId}/posts?${params.toString()}`);
      return response.json();
    } catch (error) {
      console.warn('getUserPosts failed:', error);
      throw error;
    }
  }

  /**
   * Like a post
   */
  async likePost(postId: string): Promise<void> {
    await this.makeRequest(`/posts/${postId}/like`, {
      method: 'POST',
    });
  }

  /**
   * Unlike a post
   */
  async unlikePost(postId: string): Promise<void> {
    await this.makeRequest(`/posts/${postId}/like`, {
      method: 'DELETE',
    });
  }

  /**
   * Record a post view
   */
  async recordView(postId: string): Promise<void> {
    await this.makeRequest(`/posts/${postId}/view`, {
      method: 'POST',
    });
  }

  /**
   * Get a user profile (own or other)
   */
  async getProfile(userId: string = 'me'): Promise<{
    profile: {
      user_id: string;
      username: string;
      avatar_url: string;
      bio: string | null;
      height_cm: number | null;
      chest_cm: number | null;
      waist_cm: number | null;
    };
  }> {
    const response = await this.makeRequest(`/profiles/${userId}`);
    return response.json();
  }



  /**
   * Update the caller's own profile
   */
  async updateProfile(profileData: {
    username?: string;
    avatar_url?: string;
    bio?: string;
    height_cm?: number;
    chest_cm?: number;
    waist_cm?: number;
  }): Promise<{
    profile: {
      user_id: string;
      username: string;
      avatar_url: string;
      bio: string | null;
      height_cm: number | null;
      chest_cm: number | null;
      waist_cm: number | null;
    };
  }> {
    const response = await this.makeRequest('/profiles/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });
    return response.json();
  }
}

/**
 * Hook to get an initialized API client
 */
export function useApiClient(): ApiClient {
  const { getToken } = useAuth();
  
  const client = ApiClient.getInstance();
  client.initialize(getToken);
  
  return client;
}
