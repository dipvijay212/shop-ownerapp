import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper for simulating realistic network latency
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Keys used for AsyncStorage persistence
const STORAGE_KEYS = {
  SHOP: 'owner_shop',
  PRODUCTS: 'owner_products',
  ORDERS: 'owner_orders',
  REVIEWS: 'owner_reviews',
  NOTIFICATIONS: 'owner_notifications',
};

// ---------------------------------------------------------------------------
// Initial Seed Data (Mirrors the schema used in the Customer App's mockData.js)
// ---------------------------------------------------------------------------

export const initialShop = {
  id: 1, // Matches "Fresh Mart" from customer app
  name: 'Fresh Mart',
  status: 'active',
  banner_url: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800',
  address: 'Utran Road, Near Utran Char Rasta, Utran, Surat - 394105',
  rating_avg: '4.8',
  category: 'Groceries',
  latitude: 21.2401,
  longitude: 72.8735,
  delivery_polygon: [], // Empty array initially
  categories: [
    { id: 1, name: 'Vegetables' },
    { id: 2, name: 'Fruits' },
    { id: 3, name: 'Dairy' },
    { id: 4, name: 'Staples' },
  ],
};

export const initialProducts = [
  { id: 101, shop_id: 1, name: 'Fresh Organic Apples', price: '3.99', unit: 'kg', category: 'Fruits', image_url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6fac6?w=400', stock_status: 'in_stock' },
  { id: 102, shop_id: 1, name: 'Whole Milk', price: '1.99', unit: 'L', category: 'Dairy', image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400', stock_status: 'in_stock' },
  { id: 103, shop_id: 1, name: 'Broccoli', price: '2.49', unit: 'kg', category: 'Vegetables', image_url: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=400', stock_status: 'out_of_stock' },
  { id: 104, shop_id: 1, name: 'Basmati Rice', price: '6.50', unit: 'pack', category: 'Staples', image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400', stock_status: 'in_stock' },
  { id: 105, shop_id: 1, name: 'Farm Eggs', price: '3.25', unit: 'piece', category: 'Dairy', image_url: 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=400', stock_status: 'in_stock' },
  { id: 106, shop_id: 1, name: 'Ripe Bananas', price: '1.20', unit: 'piece', category: 'Fruits', image_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400', stock_status: 'in_stock' },
];

export const initialOrders = [
  {
    id: 10001,
    orderNumber: 'LS-94821',
    customer_name: 'Aman Sharma',
    customer_phone: '+91 98765 43210',
    delivery_address: 'Flat 402, Sentosa Heights, Utran, Mota Varachha, Surat - 394101',
    items: [
      { product_id: 101, name: 'Fresh Organic Apples', price: '3.99', unit: 'kg', quantity: 2 },
      { product_id: 102, name: 'Whole Milk', price: '1.99', unit: '1L', quantity: 1 }
    ],
    payment_method: 'upi',
    payment_status: 'completed',
    total: 9.97,
    status: 'delivered',
    created_at: '2026-07-20T14:30:00.000Z'
  },
  {
    id: 10002,
    orderNumber: 'LS-28491',
    customer_name: 'Priya Patel',
    customer_phone: '+91 91234 56789',
    delivery_address: 'B-105, Amby Valley Arcade, Utran, Surat - 394105',
    items: [
      { product_id: 104, name: 'Basmati Rice', price: '6.50', unit: '5kg bag', quantity: 1 },
      { product_id: 105, name: 'Farm Eggs', price: '3.25', unit: 'dozen', quantity: 2 }
    ],
    payment_method: 'cod',
    payment_status: 'pending',
    total: 13.00,
    status: 'placed',
    created_at: '2026-07-23T15:00:00.000Z'
  },
  {
    id: 10003,
    orderNumber: 'LS-38291',
    customer_name: 'Rohan Mehta',
    customer_phone: '+91 98250 12345',
    delivery_address: '12, Shiv Shakti Society, Near Char Rasta, Utran, Surat - 394105',
    items: [
      { product_id: 106, name: 'Ripe Bananas', price: '1.20', unit: 'dozen', quantity: 3 },
      { product_id: 101, name: 'Fresh Organic Apples', price: '3.99', unit: 'kg', quantity: 1.5 }
    ],
    payment_method: 'upi',
    payment_status: 'completed',
    total: 9.59,
    status: 'accepted',
    created_at: '2026-07-23T12:15:00.000Z'
  },
  {
    id: 10004,
    orderNumber: 'LS-48291',
    customer_name: 'Sneha Shah',
    customer_phone: '+91 97243 88888',
    delivery_address: 'C-304, Sentosa Heights, Mota Varachha, Surat - 394101',
    items: [
      { product_id: 102, name: 'Whole Milk', price: '1.99', unit: '1L', quantity: 3 },
      { product_id: 103, name: 'Broccoli', price: '2.49', unit: 'kg', quantity: 1 }
    ],
    payment_method: 'cod',
    payment_status: 'pending',
    total: 8.46,
    status: 'preparing',
    created_at: '2026-07-23T09:45:00.000Z'
  },
  {
    id: 10005,
    orderNumber: 'LS-58392',
    customer_name: 'Vikram Singh',
    customer_phone: '+91 99099 77777',
    delivery_address: 'A-501, Green Avenue, Mota Varachha, Surat - 394101',
    items: [
      { product_id: 104, name: 'Basmati Rice', price: '6.50', unit: '5kg bag', quantity: 2 },
      { product_id: 101, name: 'Fresh Organic Apples', price: '3.99', unit: 'kg', quantity: 1 }
    ],
    payment_method: 'upi',
    payment_status: 'completed',
    total: 16.99,
    status: 'out_for_delivery',
    created_at: '2026-07-22T18:20:00.000Z'
  },
  {
    id: 10006,
    orderNumber: 'LS-68291',
    customer_name: 'Amit Vyas',
    customer_phone: '+91 98980 11111',
    delivery_address: 'G-12, Royal Plaza, Near Utran Station, Surat - 394105',
    items: [
      { product_id: 105, name: 'Farm Eggs', price: '3.25', unit: 'dozen', quantity: 1 },
      { product_id: 106, name: 'Ripe Bananas', price: '1.20', unit: 'dozen', quantity: 1 }
    ],
    payment_method: 'cod',
    payment_status: 'failed',
    total: 4.45,
    status: 'cancelled',
    created_at: '2026-07-21T11:00:00.000Z'
  },
  {
    id: 10007,
    orderNumber: 'LS-78392',
    customer_name: 'Neha Deshmukh',
    customer_phone: '+91 95588 22222',
    delivery_address: 'Block E, Sunrise Residency, Utran, Surat - 394105',
    items: [
      { product_id: 101, name: 'Fresh Organic Apples', price: '3.99', unit: 'kg', quantity: 3 }
    ],
    payment_method: 'upi',
    payment_status: 'completed',
    total: 11.97,
    status: 'delivered',
    created_at: '2026-07-22T10:15:00.000Z'
  }
];

export const initialReviews = [
  {
    id: 1,
    customer_name: 'Aman Sharma',
    rating: 5,
    comment: 'Always fresh produce! The organic apples are extremely sweet and delivery is very quick.',
    date: '2026-07-22'
  },
  {
    id: 2,
    customer_name: 'Priya Patel',
    rating: 4,
    comment: 'Great quality milk and eggs. Sometimes broccoli is out of stock, but overall great service.',
    date: '2026-07-21'
  },
  {
    id: 3,
    customer_name: 'Rohan Mehta',
    rating: 5,
    comment: 'Fresh Mart has become my go-to shop for daily groceries. Highly recommended!',
    date: '2026-07-20'
  },
  {
    id: 4,
    customer_name: 'Sneha Shah',
    rating: 3,
    comment: 'Items are good but delivery was slightly delayed today. Hope they improve the timing.',
    date: '2026-07-19'
  },
  {
    id: 5,
    customer_name: 'Vikram Singh',
    rating: 5,
    comment: 'Fantastic packaging and very polite delivery agent. Five stars!',
    date: '2026-07-18'
  }
];

export const initialNotifications = [
  {
    id: 1,
    title: 'New Order Received',
    body: 'Order #LS-28491 from Priya Patel has been placed.',
    is_read: false,
    created_at: '2026-07-23T15:00:00.000Z'
  },
  {
    id: 2,
    title: 'Payment Received',
    body: 'UPI Payment of ₹9.59 received for Order #LS-38291 from Rohan Mehta.',
    is_read: false,
    created_at: '2026-07-23T12:16:00.000Z'
  },
  {
    id: 3,
    title: 'New Review Received',
    body: 'Aman Sharma gave you a 5-star rating: "Always fresh produce!..."',
    is_read: true,
    created_at: '2026-07-22T15:00:00.000Z'
  },
  {
    id: 4,
    title: 'Order Status Updated',
    body: 'Order #LS-58392 is now Out for Delivery.',
    is_read: true,
    created_at: '2026-07-22T18:25:00.000Z'
  },
  {
    id: 5,
    title: 'New Order Received',
    body: 'Order #LS-78392 from Neha Deshmukh has been placed.',
    is_read: true,
    created_at: '2026-07-22T10:15:00.000Z'
  },
  {
    id: 6,
    title: 'Payment Received',
    body: 'UPI Payment of ₹11.97 received for Order #LS-78392.',
    is_read: true,
    created_at: '2026-07-22T10:16:00.000Z'
  }
];

// ---------------------------------------------------------------------------
// In-Memory Storage Cache (used as a fallback or for fast read/writes)
// ---------------------------------------------------------------------------

const memoryStore = {
  [STORAGE_KEYS.SHOP]: null,
  [STORAGE_KEYS.PRODUCTS]: null,
  [STORAGE_KEYS.ORDERS]: null,
  [STORAGE_KEYS.REVIEWS]: null,
  [STORAGE_KEYS.NOTIFICATIONS]: null,
};

// ---------------------------------------------------------------------------
// Helper Functions for Data Access & Persistence
// ---------------------------------------------------------------------------

const getStoredData = async (key, initialValue) => {
  try {
    const data = await AsyncStorage.getItem(key);
    if (data !== null) {
      return JSON.parse(data);
    }
    // If not found in storage, initialize it
    await AsyncStorage.setItem(key, JSON.stringify(initialValue));
    return initialValue;
  } catch (error) {
    console.error(`[mockOwnerData] Error reading ${key} from AsyncStorage:`, error);
    return initialValue;
  }
};

const setStoredData = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[mockOwnerData] Error writing ${key} to AsyncStorage:`, error);
  }
};

// Helper to reset AsyncStorage and memory storage to initial seed data
export const resetMockOwnerStorage = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.SHOP);
    await AsyncStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    await AsyncStorage.removeItem(STORAGE_KEYS.ORDERS);
    await AsyncStorage.removeItem(STORAGE_KEYS.REVIEWS);
    await AsyncStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    
    memoryStore[STORAGE_KEYS.SHOP] = null;
    memoryStore[STORAGE_KEYS.PRODUCTS] = null;
    memoryStore[STORAGE_KEYS.ORDERS] = null;
    memoryStore[STORAGE_KEYS.REVIEWS] = null;
    memoryStore[STORAGE_KEYS.NOTIFICATIONS] = null;
    
    return { success: true };
  } catch (error) {
    console.error('[mockOwnerData] Error resetting storage:', error);
    return { success: false, error };
  }
};

// ---------------------------------------------------------------------------
// Exported API Functions
// ---------------------------------------------------------------------------

/**
 * Gets the shop details for the owner.
 * @returns {Promise<Object>} The shop object.
 */
export const getMockShop = async () => {
  await delay(300);
  return await getStoredData(STORAGE_KEYS.SHOP, initialShop);
};

/**
 * Updates the status of the shop.
 * @param {string} status - The new status ('active' or 'inactive').
 * @returns {Promise<Object>} The updated shop object.
 */
export const updateMockShopStatus = async (status) => {
  await delay(300);
  const shop = await getStoredData(STORAGE_KEYS.SHOP, initialShop);
  shop.status = status;
  await setStoredData(STORAGE_KEYS.SHOP, shop);
  return shop;
};

/**
 * Updates the geofence delivery polygon of the shop.
 * @param {Array<Object>} polygon - Array of lat/lng coordinates defining the delivery zone.
 * @returns {Promise<Object>} The updated shop object.
 */
export const updateMockShopGeofence = async (polygon) => {
  await delay(300);
  const shop = await getStoredData(STORAGE_KEYS.SHOP, initialShop);
  shop.delivery_polygon = polygon;
  await setStoredData(STORAGE_KEYS.SHOP, shop);
  return shop;
};

/**
 * Gets all the products managed by the shop owner.
 * @returns {Promise<Array<Object>>} List of products.
 */
export const getMockOwnerProducts = async () => {
  await delay(300);
  return await getStoredData(STORAGE_KEYS.PRODUCTS, initialProducts);
};

/**
 * Updates the stock status of a specific product.
 * @param {number|string} productId - The ID of the product.
 * @param {string} status - The new stock status ('in_stock' or 'out_of_stock').
 * @returns {Promise<Object>} The updated product object.
 */
export const updateMockProductStock = async (productId, status) => {
  await delay(300);
  const products = await getStoredData(STORAGE_KEYS.PRODUCTS, initialProducts);
  const index = products.findIndex((p) => p.id === parseInt(productId));
  if (index !== -1) {
    products[index].stock_status = status;
    await setStoredData(STORAGE_KEYS.PRODUCTS, products);
    return products[index];
  }
  throw new Error(`Product with ID ${productId} not found`);
};

/**
 * Adds a new product to the catalog.
 * @param {Object} data - The product info (name, price, unit, image_url, etc.).
 * @returns {Promise<Object>} The newly created product object.
 */
export const addMockProduct = async (data) => {
  await delay(300);
  const products = await getStoredData(STORAGE_KEYS.PRODUCTS, initialProducts);
  
  // Find highest product ID to generate a new sequential one
  const maxId = products.reduce((max, p) => (p.id > max ? p.id : max), 100);
  
  const newProduct = {
    id: maxId + 1,
    shop_id: 1, // Owner app fresh mart shop ID is always 1
    name: data.name,
    price: parseFloat(data.price).toFixed(2),
    unit: data.unit,
    category: data.category || 'Other',
    image_url: data.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400',
    stock_status: data.stock_status || 'in_stock',
  };
  
  products.push(newProduct);
  await setStoredData(STORAGE_KEYS.PRODUCTS, products);
  return newProduct;
};

/**
 * Updates an existing product in the catalog.
 * @param {number|string} productId - The ID of the product.
 * @param {Object} data - The updated product info.
 * @returns {Promise<Object>} The updated product object.
 */
export const updateMockProduct = async (productId, data) => {
  await delay(300);
  const products = await getStoredData(STORAGE_KEYS.PRODUCTS, initialProducts);
  const index = products.findIndex((p) => p.id === parseInt(productId));
  if (index !== -1) {
    products[index] = {
      ...products[index],
      name: data.name ?? products[index].name,
      price: data.price ? parseFloat(data.price).toFixed(2) : products[index].price,
      unit: data.unit ?? products[index].unit,
      category: data.category ?? products[index].category,
      image_url: data.image_url ?? products[index].image_url,
      stock_status: data.stock_status ?? products[index].stock_status,
    };
    await setStoredData(STORAGE_KEYS.PRODUCTS, products);
    return products[index];
  }
  throw new Error(`Product with ID ${productId} not found`);
};

/**
 * Deletes a product from the catalog.
 * @param {number|string} productId - The ID of the product.
 * @returns {Promise<boolean>} Success indicator.
 */
export const deleteMockProduct = async (productId) => {
  await delay(300);
  const products = await getStoredData(STORAGE_KEYS.PRODUCTS, initialProducts);
  const index = products.findIndex((p) => p.id === parseInt(productId));
  if (index !== -1) {
    products.splice(index, 1);
    await setStoredData(STORAGE_KEYS.PRODUCTS, products);
    return true;
  }
  throw new Error(`Product with ID ${productId} not found`);
};

/**
 * Gets the shop's orders, optionally filtered by status.
 * @param {string} [statusFilter] - Optional filter ('placed', 'accepted', 'preparing', 'out_for_delivery', 'delivered', 'cancelled', or 'all').
 * @returns {Promise<Array<Object>>} List of matching orders, sorted by created_at descending.
 */
export const getMockOrders = async (statusFilter) => {
  await delay(300);
  const orders = await getStoredData(STORAGE_KEYS.ORDERS, initialOrders);
  
  // Sort orders with the newest first
  const sortedOrders = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  if (!statusFilter || statusFilter.toLowerCase() === 'all') {
    return sortedOrders;
  }
  
  return sortedOrders.filter((order) => order.status.toLowerCase() === statusFilter.toLowerCase());
};

/**
 * Updates the status of an order.
 * @param {number|string} orderId - The ID of the order.
 * @param {string} status - The new status of the order.
 * @returns {Promise<Object>} The updated order object.
 */
export const updateMockOrderStatus = async (orderId, status) => {
  await delay(300);
  const orders = await getStoredData(STORAGE_KEYS.ORDERS, initialOrders);
  const index = orders.findIndex((o) => o.id === parseInt(orderId));
  if (index !== -1) {
    orders[index].status = status;
    
    // Automatically complete payment status if the order is COD and is marked as delivered
    if (status === 'delivered' && orders[index].payment_method === 'cod') {
      orders[index].payment_status = 'completed';
    }
    
    await setStoredData(STORAGE_KEYS.ORDERS, orders);
    return orders[index];
  }
  throw new Error(`Order with ID ${orderId} not found`);
};

/**
 * Marks the payment status of an order as completed/received.
 * @param {number|string} orderId - The ID of the order.
 * @returns {Promise<Object>} The updated order object.
 */
export const markMockPaymentReceived = async (orderId) => {
  await delay(300);
  const orders = await getStoredData(STORAGE_KEYS.ORDERS, initialOrders);
  const index = orders.findIndex((o) => o.id === parseInt(orderId));
  if (index !== -1) {
    orders[index].payment_status = 'completed';
    await setStoredData(STORAGE_KEYS.ORDERS, orders);
    return orders[index];
  }
  throw new Error(`Order with ID ${orderId} not found`);
};

/**
 * Gets reviews for the shop.
 * @returns {Promise<Array<Object>>} List of reviews, sorted by date descending.
 */
export const getMockReviews = async () => {
  await delay(300);
  const reviews = await getStoredData(STORAGE_KEYS.REVIEWS, initialReviews);
  return [...reviews].sort((a, b) => new Date(b.date) - new Date(a.date));
};

/**
 * Gets notifications for the owner.
 * @returns {Promise<Array<Object>>} List of notifications, sorted by created_at descending.
 */
export const getMockNotifications = async () => {
  await delay(300);
  const notifications = await getStoredData(STORAGE_KEYS.NOTIFICATIONS, initialNotifications);
  return [...notifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

/**
 * Marks a specific notification as read.
 * @param {number|string} id - The ID of the notification.
 * @returns {Promise<Object>} The updated notification object.
 */
export const markMockNotificationRead = async (id) => {
  await delay(300);
  const notifications = await getStoredData(STORAGE_KEYS.NOTIFICATIONS, initialNotifications);
  const index = notifications.findIndex((n) => n.id === parseInt(id));
  if (index !== -1) {
    notifications[index].is_read = true;
    await setStoredData(STORAGE_KEYS.NOTIFICATIONS, notifications);
    return notifications[index];
  }
  throw new Error(`Notification with ID ${id} not found`);
};

/**
 * Simulates and inserts a new random order into the queue for testing.
 * @returns {Promise<Object>} The newly created order.
 */
export const simulateNewMockOrder = async () => {
  await delay(300);
  const orders = await getStoredData(STORAGE_KEYS.ORDERS, initialOrders);
  
  const maxId = orders.reduce((max, o) => (o.id > max ? o.id : max), 10000);
  const newOrderId = maxId + 1;
  const newOrderNumber = `LS-${Math.floor(10000 + Math.random() * 90000)}`;

  const customerNames = ['Amit Kumar', 'Rajesh Patel', 'Karan Johar', 'Sunita Rao', 'Komal Shah'];
  const customerPhones = ['+91 99999 11111', '+91 88888 22222', '+91 77777 33333', '+91 66666 44444'];
  const customerAddresses = [
    'Flat 102, Shreepad Residency, Surat - 395009',
    'Plot 45, Golden Heights, Surat - 395007',
    'Building A, Sentosa Greens, Surat - 395010',
  ];

  const itemsPool = [
    { product_id: 101, name: 'Fresh Organic Apples', price: '3.99', unit: 'kg', quantity: Math.floor(1 + Math.random() * 3) },
    { product_id: 102, name: 'Whole Milk', price: '1.99', unit: 'L', quantity: Math.floor(1 + Math.random() * 2) },
    { product_id: 103, name: 'Broccoli', price: '2.49', unit: 'kg', quantity: Math.floor(1 + Math.random() * 2) },
    { product_id: 104, name: 'Basmati Rice', price: '6.50', unit: 'pack', quantity: 1 },
  ];

  // Pick 1-2 random items
  const items = [];
  const itemsCount = Math.floor(1 + Math.random() * 2);
  for (let i = 0; i < itemsCount; i++) {
    const randomItem = itemsPool[Math.floor(Math.random() * itemsPool.length)];
    if (!items.find(it => it.product_id === randomItem.product_id)) {
      items.push(randomItem);
    }
  }
  if (items.length === 0) {
    items.push(itemsPool[0]);
  }

  const total = items.reduce((sum, item) => sum + item.quantity * parseFloat(item.price), 0);
  const payMethod = Math.random() > 0.5 ? 'upi' : 'cod';

  const newOrder = {
    id: newOrderId,
    orderNumber: newOrderNumber,
    customer_name: customerNames[Math.floor(Math.random() * customerNames.length)],
    customer_phone: customerPhones[Math.floor(Math.random() * customerPhones.length)],
    delivery_address: customerAddresses[Math.floor(Math.random() * customerAddresses.length)],
    items,
    payment_method: payMethod,
    payment_status: 'pending',
    total,
    status: 'placed',
    created_at: new Date().toISOString()
  };

  orders.push(newOrder);
  await setStoredData(STORAGE_KEYS.ORDERS, orders);

  // Also add a notification
  const notifications = await getStoredData(STORAGE_KEYS.NOTIFICATIONS, initialNotifications);
  const maxNotifId = notifications.reduce((max, n) => (n.id > max ? n.id : max), 0);
  notifications.push({
    id: maxNotifId + 1,
    title: 'New Order Received',
    body: `Order ${newOrderNumber} from ${newOrder.customer_name} has been placed.`,
    is_read: false,
    created_at: new Date().toISOString()
  });
  await setStoredData(STORAGE_KEYS.NOTIFICATIONS, notifications);

  return newOrder;
};
