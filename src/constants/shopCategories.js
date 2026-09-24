import {
  Store, Tag, ShoppingBag, Smartphone, Shirt, Pill, Coffee, BookOpen,
  Apple, Fish, Tv, Footprints, Sparkles, Wrench, Home, Dog, Car, Watch, Utensils,
} from 'lucide-react-native';

export const getCategoryColor = (name) => {
  switch (name) {
    case 'Groceries':
    case 'Fruits & Vegetables':
      return { bg: '#DCFCE7', text: '#15803D' };
    case 'Restaurant':
      return { bg: '#FFEDD5', text: '#C2410C' };
    case 'Dairy & Milk Products':
    case 'Bakery & Confectionery':
      return { bg: '#FEF3C7', text: '#D97706' };
    case 'Meat & Seafood':
      return { bg: '#FEE2E2', text: '#DC2626' };
    case 'Electronics & Appliances':
    case 'Mobile & Accessories':
      return { bg: '#E0F2FE', text: '#0284C7' };
    case 'Clothing & Apparel':
    case 'Footwear & Shoes':
      return { bg: '#F3E8FF', text: '#7E22CE' };
    case 'Pharmacy & Healthcare':
      return { bg: '#CCFBF1', text: '#0D9488' };
    case 'Cosmetics & Beauty':
      return { bg: '#FCE7F3', text: '#DB2777' };
    case 'Hardware & Tools':
    case 'Auto Parts & Services':
      return { bg: '#F1F5F9', text: '#475569' };
    case 'Home & Kitchen':
      return { bg: '#FFEDD5', text: '#EA580C' };
    case 'Stationery & Books':
      return { bg: '#E0E7FF', text: '#4338CA' };
    case 'Pet Supplies':
      return { bg: '#FEF9C3', text: '#CA8A04' };
    case 'Jewelry & Watches':
      return { bg: '#FAE8FF', text: '#C026D3' };
    default:
      return { bg: '#F1F5F9', text: '#64748B' };
  }
};

// Mirrors the backend's MASTER_SHOP_CATEGORIES baseline. The picker no longer
// reads this list — it renders whatever GET /owner/shop-categories returns —
// so this exists purely to map a category name to its icon and colour.
export const CATEGORY_ITEMS = [
  { name: 'Groceries', icon: ShoppingBag },
  { name: 'Restaurant', icon: Utensils },
  { name: 'Fruits & Vegetables', icon: Apple },
  { name: 'Dairy & Milk Products', icon: Coffee },
  { name: 'Bakery & Confectionery', icon: Utensils },
  { name: 'Meat & Seafood', icon: Fish },
  { name: 'Electronics & Appliances', icon: Tv },
  { name: 'Mobile & Accessories', icon: Smartphone },
  { name: 'Clothing & Apparel', icon: Shirt },
  { name: 'Footwear & Shoes', icon: Footprints },
  { name: 'Pharmacy & Healthcare', icon: Pill },
  { name: 'Cosmetics & Beauty', icon: Sparkles },
  { name: 'Hardware & Tools', icon: Wrench },
  { name: 'Home & Kitchen', icon: Home },
  { name: 'Stationery & Books', icon: BookOpen },
  { name: 'Pet Supplies', icon: Dog },
  { name: 'Auto Parts & Services', icon: Car },
  { name: 'Jewelry & Watches', icon: Watch },
  { name: 'General Store / Kirana', icon: Store },
  { name: 'Others', icon: Tag },
];

// An admin can add a category after this build shipped, so an unknown name
// falls back to a generic tag rather than breaking the row.
export const getCategoryIcon = (name) =>
  CATEGORY_ITEMS.find((c) => c.name === name)?.icon || Tag;

export const formatShopCategories = (category, fallback = 'Groceries') => {
  if (!category) return fallback;
  if (Array.isArray(category)) {
    return category.length > 0 ? category.join(', ') : fallback;
  }
  return String(category);
};

