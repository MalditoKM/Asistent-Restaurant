
export interface User {
  id: string;
  name: string;
  email: string;
  password: string; 
  role: 'superadmin' | 'admin' | 'seller' | 'waiter';
  restaurantId: string;
}

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  users: User[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  restaurantId: string;
}

export interface Category {
  id: string;
  name: string;
  restaurantId: string;
}

export type ProductCategory = string;

export interface Product {
  id: string;
  name: string;
  price: number | string;
  category: ProductCategory;
  restaurantId: string;
}

export interface OrderItem extends Product {
  quantity: number;
}

export interface Purchase {
  id: string;
  productName: string;
  supplier?: string;
  quantity: number;
  unitPrice: number | string;
  purchaseDate: string; // ISO String
  restaurantId: string;
}

export interface Sale {
  id: string;
  customerName: string;
  tableNumber: string;
  items: OrderItem[];
  totalPrice: number | string;
  saleDate: string; // ISO String
  userId: string;
  userName: string;
  restaurantId: string;
  status: 'paid' | 'pending';
}

export interface StockItem {
  productId: string;
  productName: string;
  category: string;
  initialStock: number;
  unitsSold: number;
  currentStock: number;
}
