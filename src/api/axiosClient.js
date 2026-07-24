import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { getMockSavedShops, removeMockSavedShop, reorderMockSavedShops, getMockShops, getMockShop, getMockProducts, getMockCarts, updateMockCart, getMockAddresses, addMockAddress, updateMockAddress, deleteMockAddress, getMockOrders, addMockOrder, getMockUdharLedger, getMockWishlist, toggleMockWishlist } from './mockData';

// Use the dev tunnel URL provided by the user
const BASE_URL = 'https://8d9tvlgb-5000.inc1.devtunnels.ms/api';

const axiosClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

axiosClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor for Global Error Handling
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response ? error.response.status : null;
    const message = error.response?.data?.message || 'A network error occurred. Please try again.';

    if (status === 401) {
      // Token expired or invalid
      await AsyncStorage.removeItem('userToken');
      Toast.show({
        type: 'error',
        text1: 'Session Expired',
        text2: 'Please log in again.'
      });
      // Emitting an event or relying on Context to reset Nav is best practice.
      // For now, the App will detect token missing on next load/action.
    } else {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: message
      });
    }

    return Promise.reject(error);
  }
);



// --- MOCK INTERCEPTOR LOGIC ---
const originalGet = axiosClient.get;

axiosClient.get = async (url, config) => {
  // Mock /my-shops
  if (url === '/my-shops' || url.startsWith('/my-shops?')) {
    return { data: { savedShops: getMockSavedShops() } };
  }
  // Mock /shops/nearby
  if (url.startsWith('/shops/nearby?')) {
    const latMatch = url.match(/lat=([\d.-]+)/);
    const lngMatch = url.match(/lng=([\d.-]+)/);
    const radiusMatch = url.match(/radius=([\d.-]+)/);
    
    let shops = [];
    if (latMatch && lngMatch) {
       const allShops = getMockShops(latMatch[1], lngMatch[1]);
       const radius = radiusMatch ? parseFloat(radiusMatch[1]) : 5;
       
       if (radius <= 2) {
         shops = allShops.slice(0, 2);
       } else if (radius <= 5) {
         shops = allShops.slice(0, 5);
       } else {
         shops = allShops;
       }
    } else {
       shops = getMockShops();
    }
    return { data: { shops: shops } };
  }
  // Mock /shops/nearby-products
  if (url.startsWith('/shops/nearby-products?')) {
    const categoryMatch = url.match(/category=([^&]+)/);
    const category = categoryMatch ? decodeURIComponent(categoryMatch[1]) : 'All';
    return { data: { products: getMockProducts(null, category) } };
  }
  // Mock /shops/:shopId/products
  const shopProductsMatch = url.match(/^\/shops\/(\d+)\/products/);
  if (shopProductsMatch) {
    const shopId = shopProductsMatch[1];
    return { data: { products: getMockProducts(shopId) } };
  }
  // Mock /shops/:shopId
  const shopMatch = url.match(/^\/shops\/(\d+)/);
  if (shopMatch) {
    const shopId = shopMatch[1];
    return { data: { shop: getMockShop(shopId) } };
  }
  // Mock /auth/me
  if (url === '/auth/me') {
    return { data: { user: { id: 1, name: 'Mock User', phone: '+919999999999' } } };
  }
  // Mock /cart
  if (url === '/cart' || url.startsWith('/cart?')) {
    return { data: { carts: getMockCarts() } };
  }
  // Mock /wishlist
  if (url === '/wishlist' || url.startsWith('/wishlist?')) {
    return { data: { wishlist: getMockWishlist() } };
  }
  // Mock /orders
  if (url === '/orders' || url.startsWith('/orders?')) {
    return { data: { orders: getMockOrders() } };
  }
  // Mock /orders/:id
  const orderMatch = url.match(/^\/orders\/(\d+)$/);
  if (orderMatch) {
    const orderId = orderMatch[1];
    const order = getMockOrders().find(o => o.id == orderId);
    if (order) {
      return { data: order };
    } else {
      return Promise.reject({ response: { status: 404, data: { message: 'Order not found' } } });
    }
  }
  
  // Mock /addresses
  if (url === '/addresses' || url.startsWith('/addresses?')) {
    return { data: { addresses: getMockAddresses() } };
  }

  // Mock /khata
  if (url === '/khata') {
    const ledger = getMockUdharLedger();
    // Group by shop
    const grouped = ledger.reduce((acc, entry) => {
      if (!acc[entry.shop.id]) {
        acc[entry.shop.id] = {
          shop: entry.shop,
          total_pending: 0,
          transactions: []
        };
      }
      acc[entry.shop.id].total_pending += entry.amount;
      acc[entry.shop.id].transactions.push(entry);
      return acc;
    }, {});
    
    return { 
      data: { 
        khata: Object.values(grouped),
        total_overall: ledger.reduce((sum, entry) => sum + entry.amount, 0)
      } 
    };
  }

  // Fallback to real API
  return originalGet.apply(axiosClient, [url, config]);
};

const originalPost = axiosClient.post;
axiosClient.post = async (url, data, config) => {
  // Mock /auth/customer/send-otp
  if (url === '/auth/customer/send-otp') {
    return { data: { success: true } };
  }
  // Mock /auth/customer/verify-otp
  if (url === '/auth/customer/verify-otp') {
    return { 
      data: { 
        token: 'mock-jwt-token-123', 
        customer: { id: 1, name: 'Mock User', phone: data.phone || '+919999999999' } 
      } 
    };
  }
  // Mock mutations (add to cart, wishlist, orders)
  const cartMatch = url.match(/^\/cart\/(\d+)\/items/);
  if (cartMatch) {
    const shopId = cartMatch[1];
    updateMockCart(shopId, data.productId, data.quantity);
    
    if (data.quantity > 0) {
      Toast.show({
        type: 'success',
        text1: 'Added to Cart 🛒',
        text2: 'Item successfully added to your basket.',
        position: 'top',
        visibilityTime: 2500,
      });
    }
    return { data: { success: true } };
  }

  if (url === '/addresses') {
    const newAddress = addMockAddress(data);
    return { data: { success: true, address: newAddress } };
  }

  if (url === '/orders') {
    const newOrder = addMockOrder(data.shopId, data.addressId, data.payment_method);
    if (!newOrder) {
      return { data: { success: false, message: 'Cart empty or invalid' } };
    }
    return { 
      data: { 
        success: true, 
        orderId: newOrder.id, 
        orderNumber: newOrder.orderNumber 
      } 
    };
  }

  if (url.match(/^\/orders\/(\d+)\/reorder/)) {
    return { data: { success: true } };
  }

  if (url === '/wishlist' || url.startsWith('/wishlist')) {
    toggleMockWishlist(data.productId, false);
    Toast.show({
      type: 'success',
      text1: 'Added to Wishlist ❤️',
      text2: 'Item successfully saved for later.',
      position: 'top',
      visibilityTime: 2500,
    });
    return { data: { success: true } };
  }
  
  // Fallback to real API
  return originalPost.apply(axiosClient, [url, data, config]);
};

const originalDelete = axiosClient.delete;
axiosClient.delete = async (url, config) => {
  const addressMatch = url.match(/^\/addresses\/(\d+)/);
  if (addressMatch) {
    deleteMockAddress(addressMatch[1]);
    return { data: { success: true } };
  }
  const myShopMatch = url.match(/^\/my-shops\/(\d+)/);
  if (myShopMatch) {
    removeMockSavedShop(myShopMatch[1]);
    return { data: { success: true } };
  }
  if (url.startsWith('/wishlist')) {
    const wishlistMatch = url.match(/^\/wishlist\/(\d+)/);
    if (wishlistMatch) {
      toggleMockWishlist(wishlistMatch[1], true);
      Toast.show({
        type: 'info',
        text1: 'Removed from Wishlist',
        text2: 'Item removed from your saved items.',
        position: 'top',
        visibilityTime: 2500,
      });
    }
    return { data: { success: true } };
  }
  if (url.startsWith('/my-shops')) {
    return { data: { success: true } };
  }
  return originalDelete.apply(axiosClient, [url, config]);
};

const originalPut = axiosClient.put;
axiosClient.put = async (url, data, config) => {
  const addressMatch = url.match(/^\/addresses\/(\d+)/);
  if (addressMatch) {
    updateMockAddress(addressMatch[1], data);
    return { data: { success: true } };
  }
  if (url === '/my-shops/reorder') {
    reorderMockSavedShops(data.orders);
    return { data: { success: true } };
  }
  if (url.startsWith('/my-shops')) {
    return { data: { success: true } };
  }
  return originalPut.apply(axiosClient, [url, data, config]);
};
// --- END MOCK LOGIC ---

export default axiosClient;
