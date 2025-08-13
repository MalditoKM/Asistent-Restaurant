
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { User, Product, Sale, Purchase } from '@/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { getProductsForRestaurant, getPurchasesForRestaurant, getSalesForRestaurant } from '@/lib/server/actions';

// Define thresholds for stock levels
const LOW_STOCK_THRESHOLD = 10;

export default function StockPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const userData = sessionStorage.getItem('loggedInUser');
      const restaurantId = sessionStorage.getItem('activeRestaurantId');

      if (userData && restaurantId) {
        const user: User = JSON.parse(userData);
        setCurrentUser(user);
        
        if (user.role === 'waiter') {
          router.replace('/dashboard/menu');
          return;
        }

        setActiveRestaurantId(restaurantId);
        setIsAuthorized(true);
      } else {
        router.replace('/');
        return;
      }
    } catch (error) {
      console.error("Error al cargar datos para el stock", error);
      router.replace('/');
    }
  }, [router]);
  
  useEffect(() => {
    async function fetchData() {
        if(activeRestaurantId) {
            setIsLoading(true);
            const [fetchedProducts, fetchedSales, fetchedPurchases] = await Promise.all([
                getProductsForRestaurant(activeRestaurantId),
                getSalesForRestaurant(activeRestaurantId),
                getPurchasesForRestaurant(activeRestaurantId),
            ]);
            setProducts(fetchedProducts);
            setSales(fetchedSales);
            setPurchases(fetchedPurchases);
            setIsLoading(false);
        }
    }
    if (isAuthorized) {
        fetchData();
    }
  }, [activeRestaurantId, isAuthorized]);
  
  const stock = useMemo(() => {
    const calculatedStock = products.map(product => {
      const initialStock = purchases
        .filter(p => p.productName.toLowerCase() === product.name.toLowerCase())
        .reduce((total, purchase) => total + purchase.quantity, 0);
        
      const unitsSold = sales
        .flatMap(sale => sale.items)
        .filter(item => item.id === product.id)
        .reduce((total, item) => total + item.quantity, 0);

      const currentStock = initialStock - unitsSold;

      return {
        productId: product.id,
        productName: product.name,
        category: product.category,
        initialStock: initialStock,
        unitsSold: unitsSold,
        currentStock: currentStock,
      };
    });

    return calculatedStock.sort((a,b) => a.currentStock - b.currentStock);
  }, [products, sales, purchases]);

  const filteredStock = useMemo(() => {
    return stock.filter(item =>
      item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [stock, searchTerm]);

  const getStockBadge = (stockLevel: number) => {
    if (stockLevel <= 0) {
      return {
        variant: 'destructive' as const,
        text: 'Sin Stock',
        className: 'text-destructive-foreground',
      };
    }
    if (stockLevel <= LOW_STOCK_THRESHOLD) {
      return {
        variant: 'secondary' as const,
        text: 'Stock Bajo',
        className: 'bg-amber-400 text-amber-900 hover:bg-amber-400/80',
      };
    }
    return {
      variant: 'default' as const,
      text: 'En Stock',
      className: 'bg-green-500 text-green-50 hover:bg-green-500/90 border-green-600',
    };
  };

  if (isLoading || !isAuthorized) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </CardHeader>
        <CardContent>
            <div className="mb-4">
                <Skeleton className="h-10 max-w-sm" />
            </div>
            <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Stock</CardTitle>
        <CardDescription>
          Visualiza el estado actual del inventario basado en las compras y ventas registradas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o categoría..."
                className="pl-10 max-w-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Stock Inicial</TableHead>
                <TableHead className="text-right">Unidades Vendidas</TableHead>
                <TableHead className="text-right">Stock Actual</TableHead>
                <TableHead className="text-center w-[120px]">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStock.length > 0 ? (
                filteredStock.map((item) => {
                  const badge = getStockBadge(item.currentStock);
                  return (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-right">{item.initialStock}</TableCell>
                      <TableCell className="text-right">{item.unitsSold}</TableCell>
                      <TableCell className="text-right font-bold">{item.currentStock}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={badge.variant} className={cn(badge.className)}>
                          {badge.text}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                  <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">
                          No hay productos para mostrar. Registra productos y compras para ver el stock.
                      </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
