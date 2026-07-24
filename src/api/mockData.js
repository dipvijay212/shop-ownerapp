// ---------------------------------------------------------------------------
// Mock data for Local Shops app — 10 shops across 6 categories, with
// realistic per-shop product catalogs. Drop-in replacement for the existing
// mockData.js — all exported function signatures are unchanged.
// ---------------------------------------------------------------------------

const categories = [
  { id: 1, name: 'Groceries' },
  { id: 2, name: 'Electronics' },
  { id: 3, name: 'Clothing' },
  { id: 4, name: 'Pharmacy' },
  { id: 5, name: 'Bakery' },
  { id: 6, name: 'Stationery' },
];

// "My current location" — Amby Valley Arcade, Opp Sentosa Heights,
// Utran, Mota Varachha, Surat. Use this as the default base point
// wherever the app needs the customer's current location for
// nearby-shop/map screens.
export const CURRENT_LOCATION = {
  label: 'Amby Valley Arcade, Opp Sentosa Heights, Utran, Mota Varachha, Surat',
  latitude: 21.2380,
  longitude: 72.8761,
};

const mockShops = [
  // ---------------- GROCERIES ----------------
  {
    id: 1,
    name: 'Fresh Mart',
    status: 'active',
    banner_url: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800',
    address: 'Utran Road, Near Utran Char Rasta, Utran, Surat - 394105',
    rating_avg: '4.8',
    category: 'Groceries',
    latitude: 21.2401,
    longitude: 72.8735,
    categories: [
      { id: 1, name: 'Vegetables' },
      { id: 2, name: 'Fruits' },
      { id: 3, name: 'Dairy' },
      { id: 4, name: 'Staples' },
    ],
  },
  {
    id: 4,
    name: 'Golden Harvest Grocers',
    status: 'active',
    banner_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
    address: 'Sarthana Road, Near Sarthana Nature Park, Mota Varachha, Surat - 394101',
    rating_avg: '4.6',
    category: 'Groceries',
    latitude: 21.2312,
    longitude: 72.8672,
    categories: [
      { id: 1, name: 'Vegetables' },
      { id: 4, name: 'Staples' },
      { id: 5, name: 'Snacks' },
    ],
  },

  // ---------------- ELECTRONICS ----------------
  {
    id: 2,
    name: 'Gadget Hub',
    status: 'active',
    banner_url: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800',
    address: 'Kapodra Main Road, Kapodra, Surat - 395006',
    rating_avg: '4.5',
    category: 'Electronics',
    latitude: 21.2251,
    longitude: 72.8598,
    categories: [
      { id: 4, name: 'Phones' },
      { id: 5, name: 'Accessories' },
    ],
  },
  {
    id: 5,
    name: 'TechZone Electronics',
    status: 'active',
    banner_url: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800',
    address: 'Varachha Road, Near Kadamba Society, Varachha, Surat - 395006',
    rating_avg: '4.3',
    category: 'Electronics',
    latitude: 21.2199,
    longitude: 72.8611,
    categories: [
      { id: 6, name: 'Audio' },
      { id: 7, name: 'Computer Accessories' },
      { id: 5, name: 'Accessories' },
    ],
  },

  // ---------------- PHARMACY ----------------
  {
    id: 3,
    name: 'City Pharmacy',
    status: 'active',
    banner_url: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=800',
    address: 'Mota Varachha Main Road, Opp Bhagwan Mahavir Garden, Mota Varachha, Surat - 394101',
    rating_avg: '4.9',
    category: 'Pharmacy',
    latitude: 21.2365,
    longitude: 72.8802,
    categories: [
      { id: 6, name: 'Medicines' },
      { id: 7, name: 'Personal Care' },
    ],
  },
  {
    id: 6,
    name: 'Wellness Chemist',
    status: 'active',
    banner_url: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=800',
    address: 'Sarthana Jakat Naka Road, Sarthana, Surat - 395013',
    rating_avg: '4.7',
    category: 'Pharmacy',
    latitude: 21.2287,
    longitude: 72.8747,
    categories: [
      { id: 6, name: 'Medicines' },
      { id: 8, name: 'Baby Care' },
      { id: 7, name: 'Personal Care' },
    ],
  },

  // ---------------- CLOTHING ----------------
  {
    id: 7,
    name: 'Trend Threads',
    status: 'active',
    banner_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
    address: 'Kadodara Road, Near Sentosa Heights, Mota Varachha, Surat - 394101',
    rating_avg: '4.4',
    category: 'Clothing',
    latitude: 21.2418,
    longitude: 72.8798,
    categories: [
      { id: 9, name: "Men's Wear" },
      { id: 10, name: "Women's Wear" },
    ],
  },
  {
    id: 8,
    name: 'Style Studio',
    status: 'inactive',
    banner_url: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800',
    address: 'Utran-Kadodara Road, Utran, Surat - 394105',
    rating_avg: '4.2',
    category: 'Clothing',
    latitude: 21.2456,
    longitude: 72.8709,
    categories: [
      { id: 10, name: "Women's Wear" },
      { id: 11, name: 'Accessories' },
    ],
  },

  // ---------------- BAKERY ----------------
  {
    id: 9,
    name: 'The Daily Crumb',
    status: 'active',
    banner_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
    address: 'Amby Valley Road, Near Sentosa Heights, Utran, Mota Varachha, Surat - 394101',
    rating_avg: '4.9',
    category: 'Bakery',
    latitude: 21.2392,
    longitude: 72.8779,
    categories: [
      { id: 12, name: 'Breads' },
      { id: 13, name: 'Cakes & Pastries' },
    ],
  },

  // ---------------- STATIONERY ----------------
  {
    id: 10,
    name: 'Paper Trail Stationery',
    status: 'active',
    banner_url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800',
    address: 'Mota Varachha Char Rasta, Mota Varachha, Surat - 394101',
    rating_avg: '4.5',
    category: 'Stationery',
    latitude: 21.2341,
    longitude: 72.8823,
    categories: [
      { id: 14, name: 'Notebooks & Paper' },
      { id: 15, name: 'Pens & Art Supplies' },
    ],
  },
];

const mockProducts = [
  // ---------------- Fresh Mart (shop_id: 1) ----------------
  { id: 101, shop_id: 1, name: 'Fresh Organic Apples', price: '3.99', unit: 'kg', image_url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6fac6?w=400', stock_status: 'in_stock' },
  { id: 102, shop_id: 1, name: 'Whole Milk', price: '1.99', unit: '1L', image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400', stock_status: 'in_stock' },
  { id: 103, shop_id: 1, name: 'Broccoli', price: '2.49', unit: 'kg', image_url: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=400', stock_status: 'out_of_stock' },
  { id: 104, shop_id: 1, name: 'Basmati Rice', price: '6.50', unit: '5kg bag', image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400', stock_status: 'in_stock' },
  { id: 105, shop_id: 1, name: 'Farm Eggs', price: '3.25', unit: 'dozen', image_url: 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=400', stock_status: 'in_stock' },
  { id: 106, shop_id: 1, name: 'Ripe Bananas', price: '1.20', unit: 'dozen', image_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400', stock_status: 'in_stock' },

  // ---------------- Golden Harvest Grocers (shop_id: 4) ----------------
  { id: 401, shop_id: 4, name: 'Red Onions', price: '1.10', unit: 'kg', image_url: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=400', stock_status: 'in_stock' },
  { id: 402, shop_id: 4, name: 'Whole Wheat Flour', price: '2.80', unit: '5kg bag', image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', stock_status: 'in_stock' },
  { id: 403, shop_id: 4, name: 'Cooking Oil', price: '5.99', unit: '1L', image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400', stock_status: 'in_stock' },
  { id: 404, shop_id: 4, name: 'Potato Chips', price: '1.50', unit: 'pack', image_url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400', stock_status: 'in_stock' },
  { id: 405, shop_id: 4, name: 'Mixed Nuts', price: '7.25', unit: '250g pack', image_url: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400', stock_status: 'out_of_stock' },

  // ---------------- Gadget Hub (shop_id: 2) ----------------
  { id: 201, shop_id: 2, name: 'Wireless Earbuds', price: '49.99', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400', stock_status: 'in_stock' },
  { id: 202, shop_id: 2, name: 'Fast Charging Cable', price: '14.99', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=400', stock_status: 'in_stock' },
  { id: 203, shop_id: 2, name: '20W USB-C Charger', price: '19.99', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=400', stock_status: 'in_stock' },
  { id: 204, shop_id: 2, name: 'Phone Case', price: '9.99', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1601593346740-925612772716?w=400', stock_status: 'in_stock' },
  { id: 205, shop_id: 2, name: 'Tempered Glass Screen Protector', price: '5.99', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1592286927505-1def25115558?w=400', stock_status: 'out_of_stock' },

  // ---------------- TechZone Electronics (shop_id: 5) ----------------
  { id: 501, shop_id: 5, name: 'Bluetooth Speaker', price: '34.99', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400', stock_status: 'in_stock' },
  { id: 502, shop_id: 5, name: 'Wireless Mouse', price: '12.99', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400', stock_status: 'in_stock' },
  { id: 503, shop_id: 5, name: 'USB Hub (4-Port)', price: '15.50', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1591290619762-c6ffa4c8b5c9?w=400', stock_status: 'in_stock' },
  { id: 504, shop_id: 5, name: 'Laptop Stand', price: '22.00', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400', stock_status: 'in_stock' },
  { id: 505, shop_id: 5, name: 'HDMI Cable (2m)', price: '8.50', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=400', stock_status: 'in_stock' },

  // ---------------- City Pharmacy (shop_id: 3) ----------------
  { id: 301, shop_id: 3, name: 'Vitamin C Supplement', price: '12.50', unit: 'bottle', image_url: 'https://images.unsplash.com/photo-1584308666744-24d5e4a7a8d5?w=400', stock_status: 'in_stock' },
  { id: 302, shop_id: 3, name: 'Hand Sanitizer', price: '4.99', unit: '500ml', image_url: 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=400', stock_status: 'in_stock' },
  { id: 303, shop_id: 3, name: 'Paracetamol Tablets', price: '3.20', unit: 'pack of 10', image_url: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400', stock_status: 'in_stock' },
  { id: 304, shop_id: 3, name: 'First Aid Kit', price: '18.00', unit: 'box', image_url: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400', stock_status: 'in_stock' },
  { id: 305, shop_id: 3, name: 'Digital Thermometer', price: '9.75', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1584362917165-526a968579e8?w=400', stock_status: 'out_of_stock' },

  // ---------------- Wellness Chemist (shop_id: 6) ----------------
  { id: 601, shop_id: 6, name: 'Multivitamin Gummies', price: '15.99', unit: 'bottle', image_url: 'https://images.unsplash.com/photo-1584308666744-24d5e4a7a8d5?w=400', stock_status: 'in_stock' },
  { id: 602, shop_id: 6, name: 'Baby Diapers', price: '11.50', unit: 'pack of 30', image_url: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=400', stock_status: 'in_stock' },
  { id: 603, shop_id: 6, name: 'Baby Wipes', price: '3.99', unit: 'pack of 80', image_url: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=400', stock_status: 'in_stock' },
  { id: 604, shop_id: 6, name: 'Moisturizing Lotion', price: '6.75', unit: '200ml', image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400', stock_status: 'in_stock' },
  { id: 605, shop_id: 6, name: 'Cough Syrup', price: '5.40', unit: '100ml', image_url: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400', stock_status: 'in_stock' },

  // ---------------- Trend Threads (shop_id: 7) ----------------
  { id: 701, shop_id: 7, name: "Men's Cotton T-Shirt", price: '11.99', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400', stock_status: 'in_stock' },
  { id: 702, shop_id: 7, name: 'Slim Fit Jeans', price: '29.99', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400', stock_status: 'in_stock' },
  { id: 703, shop_id: 7, name: "Women's Floral Dress", price: '34.50', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400', stock_status: 'in_stock' },
  { id: 704, shop_id: 7, name: 'Cotton Socks', price: '4.99', unit: 'pair', image_url: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=400', stock_status: 'in_stock' },
  { id: 705, shop_id: 7, name: 'Formal Shirt', price: '19.99', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400', stock_status: 'out_of_stock' },

  // ---------------- Style Studio (shop_id: 8) — shop is inactive ----------------
  { id: 801, shop_id: 8, name: 'Summer Kurti', price: '24.99', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400', stock_status: 'in_stock' },
  { id: 802, shop_id: 8, name: 'Leather Handbag', price: '45.00', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400', stock_status: 'in_stock' },
  { id: 803, shop_id: 8, name: 'Statement Earrings', price: '8.99', unit: 'pair', image_url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400', stock_status: 'in_stock' },

  // ---------------- The Daily Crumb (shop_id: 9) ----------------
  { id: 901, shop_id: 9, name: 'Artisan Sourdough Loaf', price: '5.50', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1585478259715-4d3a5b3e0a1c?w=400', stock_status: 'in_stock' },
  { id: 902, shop_id: 9, name: 'Butter Croissant', price: '2.75', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400', stock_status: 'in_stock' },
  { id: 903, shop_id: 9, name: 'Chocolate Chip Cookies', price: '4.20', unit: 'pack of 6', image_url: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400', stock_status: 'in_stock' },
  { id: 904, shop_id: 9, name: 'Red Velvet Cupcake', price: '3.00', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?w=400', stock_status: 'in_stock' },
  { id: 905, shop_id: 9, name: 'Whole Wheat Bread', price: '4.10', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', stock_status: 'out_of_stock' },

  // ---------------- Paper Trail Stationery (shop_id: 10) ----------------
  { id: 1001, shop_id: 10, name: 'Ruled Notebook A5', price: '2.50', unit: 'piece', image_url: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400', stock_status: 'in_stock' },
  { id: 1002, shop_id: 10, name: 'Ballpoint Pen Set', price: '3.99', unit: 'pack of 10', image_url: 'https://images.unsplash.com/photo-1583485088034-697b5bc36b6c?w=400', stock_status: 'in_stock' },
  { id: 1003, shop_id: 10, name: 'Watercolor Paint Set', price: '9.50', unit: 'box', image_url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400', stock_status: 'in_stock' },
  { id: 1004, shop_id: 10, name: 'A4 Printer Paper', price: '6.75', unit: 'ream', image_url: 'https://images.unsplash.com/photo-1517971071642-34a2d3ecc9cd?w=400', stock_status: 'in_stock' },
  { id: 1005, shop_id: 10, name: 'Sticky Notes Pack', price: '2.10', unit: 'pack of 5', image_url: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400', stock_status: 'in_stock' },
  { id: 1006, shop_id: 10, name: 'Highlighter Set', price: '4.50', unit: 'pack of 6', image_url: 'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?w=400', stock_status: 'out_of_stock' },
];

// ---------------------------------------------------------------------------
// Exported helpers — same signatures as before
// ---------------------------------------------------------------------------

export const getMockShops = (baseLat, baseLng) => {
  // Each shop already has a fixed, realistic latitude/longitude near
  // Utran / Mota Varachha, Surat (see mockShops above), so by default
  // we just return them as-is — no need to recompute positions.
  if (baseLat === undefined || baseLng === undefined) {
    return mockShops;
  }

  // If a custom base location IS explicitly passed (e.g. testing what
  // the map looks like from a different point), spread shops around
  // that point instead, at varying distances/angles.
  const lat = parseFloat(baseLat);
  const lng = parseFloat(baseLng);

  return mockShops.map((s, index) => {
    const distanceStep = 0.008 + (index % 5) * 0.006; // ~0.9km to ~4.4km bands
    const angle = (index * 137.5) % 360; // spread pins around a circle
    const rad = (angle * Math.PI) / 180;
    return {
      ...s,
      latitude: lat + distanceStep * Math.cos(rad),
      longitude: lng + distanceStep * Math.sin(rad),
    };
  });
};

export const getMockShop = (id) => mockShops.find((s) => s.id == id);

let mockSavedShopIds = [1, 4, 2, 5, 3]; // Only 5 shops are saved by default

export const getMockSavedShops = () => {
  return mockSavedShopIds.map(id => getMockShop(id)).filter(Boolean);
};

export const removeMockSavedShop = (id) => {
  mockSavedShopIds = mockSavedShopIds.filter(shopId => shopId != id);
};

export const reorderMockSavedShops = (newOrderArray) => {
  // newOrderArray is expected to be an array of objects: [{shop_id: 1, sort_order: 0}, ...]
  const sorted = [...newOrderArray].sort((a, b) => a.sort_order - b.sort_order);
  mockSavedShopIds = sorted.map(item => item.shop_id);
};

export const getMockProducts = (shopId, categoryName) => {
  let products = mockProducts;
  
  if (shopId) {
    products = products.filter((p) => p.shop_id == shopId);
    if (categoryName && categoryName !== 'All') {
      const shop = mockShops.find((s) => s.id == shopId);
      const matchedCategory = shop?.categories.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase()
      );
      if (!matchedCategory) return [];
    }
  } else if (categoryName && categoryName !== 'All') {
    const matchingShops = mockShops.filter(s => s.category.toLowerCase() === categoryName.toLowerCase());
    const matchingShopIds = matchingShops.map(s => s.id);
    products = products.filter(p => matchingShopIds.includes(p.shop_id));
  }
  
  return products;
};

export const getMockCategories = () => categories;

let mockCarts = [];

export const getMockCarts = () => JSON.parse(JSON.stringify(mockCarts));

export const updateMockCart = (shopId, productId, quantity) => {
  shopId = parseInt(shopId);
  productId = parseInt(productId);

  let cart = mockCarts.find((c) => c.shop.id === shopId);
  if (!cart) {
    const shop = mockShops.find((s) => s.id === shopId);
    if (!shop) return;
    cart = { cart_id: Math.floor(Math.random() * 1000), shop: shop, items: [] };
    mockCarts.push(cart);
  }

  const product = mockProducts.find((p) => p.id === productId);
  if (!product) return;

  const existingItem = cart.items.find((i) => i.product_id === productId);

  if (quantity <= 0) {
    cart.items = cart.items.filter((i) => i.product_id !== productId);
    if (cart.items.length === 0) {
      mockCarts = mockCarts.filter((c) => c.shop.id !== shopId);
    }
  } else {
    if (existingItem) {
      existingItem.quantity = quantity;
    } else {
      cart.items.push({
        product_id: productId,
        quantity: quantity,
        price: product.price,
        image_url: product.image_url,
        name: product.name,
        unit: product.unit,
      });
    }
  }
};

let mockAddresses = [
  {
    id: 1,
    label: 'Home',
    name: 'Aman Sharma',
    line1: '42 Market St.',
    line2: 'Downtown',
    pincode: '394210',
    phone: '+91 98765 43210',
    is_default: true,
  }
];

export const getMockAddresses = () => JSON.parse(JSON.stringify(mockAddresses));

export const addMockAddress = (addressData) => {
  const newAddress = {
    id: Math.floor(Math.random() * 10000),
    ...addressData,
  };
  mockAddresses.push(newAddress);
  return newAddress;
};

export const updateMockAddress = (id, addressData) => {
  const index = mockAddresses.findIndex((a) => a.id == id);
  if (index !== -1) {
    mockAddresses[index] = { ...mockAddresses[index], ...addressData };
  }
};

export const deleteMockAddress = (id) => {
  mockAddresses = mockAddresses.filter((a) => a.id != id);
};

let mockUdharLedger = [];

export const getMockUdharLedger = () => JSON.parse(JSON.stringify(mockUdharLedger));

let mockOrders = [];

export const getMockOrders = () => JSON.parse(JSON.stringify(mockOrders));

export const addMockOrder = (shopId, addressId, paymentMethod) => {
  shopId = parseInt(shopId);
  const cartIndex = mockCarts.findIndex((c) => c.shop.id === shopId);
  
  const targetCartIndex = cartIndex !== -1 ? cartIndex : (mockCarts.length > 0 ? 0 : -1);
  if (targetCartIndex === -1) return null;

  const cart = mockCarts[targetCartIndex];
  
  const totalAmount = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const newOrder = {
    id: Math.floor(Math.random() * 10000),
    orderNumber: `LS-${Math.floor(10000 + Math.random() * 90000)}`,
    shop: cart.shop,
    status: 'pending',
    items: [...cart.items],
    total_amount: totalAmount,
    payment_method: paymentMethod,
    address_id: addressId,
    created_at: new Date().toISOString()
  };

  mockOrders.unshift(newOrder);
  mockCarts.splice(targetCartIndex, 1);
  
  if (paymentMethod === 'udhar') {
    mockUdharLedger.unshift({
      id: Math.floor(Math.random() * 100000),
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      shop: cart.shop,
      amount: totalAmount,
      date: newOrder.created_at,
      status: 'pending',
      items: [...cart.items]
    });
  }

  return newOrder;
};

let mockWishlist = [];

export const getMockWishlist = () => JSON.parse(JSON.stringify(mockWishlist));

export const toggleMockWishlist = (productId, isWishlisted) => {
  productId = parseInt(productId);
  if (isWishlisted) {
    mockWishlist = mockWishlist.filter(w => w.id !== productId);
  } else {
    const product = mockProducts.find(p => p.id === productId);
    if (product && !mockWishlist.find(w => w.id === productId)) {
      mockWishlist.push(product);
    }
  }
};
