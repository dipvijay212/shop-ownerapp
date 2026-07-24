import AsyncStorage from '@react-native-async-storage/async-storage';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const KEYS = {
  TOKEN: 'owner_token',
  PROFILE: 'owner_profile',
  SHOP: 'owner_shop', // Shares the same key as mockOwnerData.js
};

export const ownerAuthService = {
  /**
   * Mock endpoint for POST /api/auth/owner/send-otp
   */
  sendOtp: async (phone) => {
    await delay(1000); // Simulate network delay
    console.log(`[ownerAuthService] Sending OTP to ${phone}`);
    return { success: true };
  },

  /**
   * Mock endpoint for POST /api/auth/owner/verify-otp
   */
  verifyOtp: async (phone, otp) => {
    await delay(1000); // Simulate network delay

    if (otp !== '123456') {
      const error = new Error('Invalid OTP');
      error.response = { status: 400 };
      throw error;
    }

    // Check if owner and shop exist in AsyncStorage
    const storedOwner = await AsyncStorage.getItem(KEYS.PROFILE);
    const storedShop = await AsyncStorage.getItem(KEYS.SHOP);

    if (storedOwner && storedShop) {
      // Existing owner
      const owner = JSON.parse(storedOwner);
      const shop = JSON.parse(storedShop);
      const token = `mock-owner-jwt-token-for-${owner.id}`;
      
      return {
        isNewUser: false,
        token,
        owner,
        shop,
      };
    } else {
      // New owner (must register shop and profile)
      return {
        isNewUser: true,
        phone,
      };
    }
  },

  /**
   * Mock endpoint for POST /api/auth/owner/register
   */
  registerOwner: async ({ name, email, phone, shopName, shopAddress, shopCategory, shopLatitude, shopLongitude, shopBannerUrl, deliveryPolygon }) => {
    await delay(1200); // Simulate network delay

    const ownerId = `owner_${Date.now()}`;
    const shopId = 1; // Always matches Fresh Mart ID = 1

    const newOwner = {
      id: ownerId,
      name,
      email: email || '',
      phone,
      createdAt: new Date().toISOString(),
    };

    const newShop = {
      id: shopId,
      name: shopName,
      status: 'active',
      banner_url: shopBannerUrl || 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800',
      address: shopAddress,
      rating_avg: '5.0',
      category: shopCategory || 'Groceries',
      latitude: parseFloat(shopLatitude) || 21.2401,
      longitude: parseFloat(shopLongitude) || 72.8735,
      delivery_polygon: deliveryPolygon || [],
      categories: [
        { id: 1, name: 'Vegetables' },
        { id: 2, name: 'Fruits' },
        { id: 3, name: 'Dairy' },
        { id: 4, name: 'Staples' },
      ],
    };

    // Store in AsyncStorage
    await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(newOwner));
    await AsyncStorage.setItem(KEYS.SHOP, JSON.stringify(newShop));
    
    const token = `mock-owner-jwt-token-for-${ownerId}`;
    await AsyncStorage.setItem(KEYS.TOKEN, token);

    return {
      token,
      owner: newOwner,
      shop: newShop,
    };
  },

  /**
   * Mock endpoint for GET /api/auth/owner/me (validate token)
   */
  validateToken: async (token) => {
    await delay(600); // Simulate network delay

    if (!token || !token.startsWith('mock-owner-jwt-token-for-')) {
      const error = new Error('Unauthorized');
      error.response = { status: 401 };
      throw error;
    }

    const storedOwner = await AsyncStorage.getItem(KEYS.PROFILE);
    const storedShop = await AsyncStorage.getItem(KEYS.SHOP);

    if (!storedOwner || !storedShop) {
      const error = new Error('Profile not found');
      error.response = { status: 404 };
      throw error;
    }

    return {
      owner: JSON.parse(storedOwner),
      shop: JSON.parse(storedShop),
    };
  },
};
