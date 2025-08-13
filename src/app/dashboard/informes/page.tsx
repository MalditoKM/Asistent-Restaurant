
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  TrendingDown,
  ShoppingBasket,
  UtensilsCrossed,
} from 'lucide-react';
import { Pie, PieChart, Cell } from 'recharts';

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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { User, Sale, Product, Customer } from '@/types';
import { Button } from '@/components/ui/button';
import { getCustomersForRestaurant, getProductsForRestaurant, getSalesForRestaurant } from '@/lib/server/actions';

const chartConfig = {
  sales: { label: 'Ventas' },
  'Arroces y Paellas': { label: 'Arroces y Paellas', color: 'hsl(var(--chart-1))' },
  'Mariscadas': { label: 'Mariscadas', color: 'hsl(var(--chart-2))' },
  'Pescados Frescos': { label: 'Pescados Frescos', color: 'hsl(var(--chart-3))' },
  'Bebidas': { label: 'Bebidas', color: 'hsl(var(--chart-4))' },
  'Entrantes de Mar': { label: 'Entrantes de Mar', color: 'hsl(var(--chart-5))' },
  'Postres': { label: 'Postres', color: 'hsl(var(--muted))' },
  // Add more categories from restaurant 2
  'Carnes a la Brasa': { label: 'Carnes a la Brasa', color: 'hsl(var(--chart-1))' },
  'Entrantes de la Tierra': { label: 'Entrantes de la Tierra', color: 'hsl(var(--chart-2))' },
  'Vinos Tintos': { label: 'Vinos Tintos', color: 'hsl(var(--chart-3))' },
};


export default function InformesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null);

  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const userData = sessionStorage.getItem('loggedInUser');
      const restaurantId = sessionStorage.getItem('activeRestaurantId');

      if (userData && restaurantId) {
        const user: User = JSON.parse(userData);
        setCurrentUser(user);
        setActiveRestaurantId(restaurantId);
        if (user.role === 'waiter') {
          router.replace('/dashboard/menu');
          return;
        }
      } else {
        router.replace('/');
        return;
      }
      setIsAuthorized(true);
    } catch (error) {
      console.error("Error al cargar datos para informes", error);
      router.replace('/');
    }
  }, [router]);

  useEffect(() => {
    async function fetchData() {
        if(activeRestaurantId) {
            setIsLoading(true);
            const [fetchedSales, fetchedProducts, fetchedCustomers] = await Promise.all([
                getSalesForRestaurant(activeRestaurantId),
                getProductsForRestaurant(activeRestaurantId),
                getCustomersForRestaurant(activeRestaurantId),
            ]);
            setSales(fetchedSales);
            setProducts(fetchedProducts);
            setCustomers(fetchedCustomers);
            setIsLoading(false);
        }
    }
    if (isAuthorized) {
        fetchData();
    }
  }, [activeRestaurantId, isAuthorized]);

  const kpiData = useMemo(() => {
    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.totalPrice), 0);
    const totalSales = sales.length;
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
    const totalCustomers = customers.length;

    return { totalRevenue, totalSales, avgTicket, totalCustomers };
  }, [sales, customers]);

  const productSales = useMemo(() => {
    const salesMap = new Map<string, { id: string; name: string; category: string; sales: number }>();
    
    if (!sales.length || !products.length) return [];

    sales.forEach(sale => {
      sale.items.forEach(item => {
        const existing = salesMap.get(item.id);
        const saleAmount = Number(item.price) * item.quantity;
        if (existing) {
          existing.sales += saleAmount;
        } else {
          const productInfo = products.find(p => p.id === item.id);
          salesMap.set(item.id, {
            id: item.id,
            name: item.name,
            category: productInfo?.category || 'Desconocida',
            sales: saleAmount,
          });
        }
      });
    });

    return Array.from(salesMap.values()).sort((a, b) => b.sales - a.sales);
  }, [sales, products]);

  const bestSellingProductsData = productSales.slice(0, 5);
  const leastSellingProductsData = productSales.slice(5).slice(-5).reverse();

  const salesByCategoryData = useMemo(() => {
    const categoryMap = new Map<string, number>();

    if (!sales.length || !products.length) return [];

    sales.forEach(sale => {
      sale.items.forEach(item => {
        const productInfo = products.find(p => p.id === item.id);
        if (productInfo) {
          const category = productInfo.category;
          const saleAmount = Number(item.price) * item.quantity;
          categoryMap.set(category, (categoryMap.get(category) || 0) + saleAmount);
        }
      });
    });

    return Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value,
      fill: (chartConfig as any)[name]?.color || 'hsl(var(--muted))',
    }));
  }, [sales, products]);


  if (isLoading || !isAuthorized) {
     return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2 items-start">
            <Skeleton className="h-96 w-full" />
            <div className="space-y-6">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline text-foreground">
          Informe General
        </h1>
        <p className="text-muted-foreground mt-1">
          Un resumen del rendimiento de tu restaurante.
        </p>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Acceso Rápido</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button asChild variant="outline" className="h-20 flex-col gap-2">
            <Link href="/dashboard/comidas">
              <ShoppingBasket className="h-6 w-6" />
              <span>Nueva Comanda</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex-col gap-2">
            <Link href="/dashboard/menu">
              <UtensilsCrossed className="h-6 w-6" />
              <span>Añadir Producto</span>
            </Link>
          </Button>
           <Button asChild variant="outline" className="h-20 flex-col gap-2">
            <Link href="/dashboard/compras">
              <ShoppingCart className="h-6 w-6" />
              <span>Registrar Compra</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-20 flex-col gap-2">
            <Link href="/dashboard/clientes">
              <Users className="h-6 w-6" />
              <span>Nuevo Cliente</span>
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ingresos Totales
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {kpiData.totalRevenue.toLocaleString('es-ES', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              +{kpiData.totalSales.toLocaleString('es-ES')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ticket Promedio
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {kpiData.avgTicket.toLocaleString('es-ES', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Clientes
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{kpiData.totalCustomers}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Ventas por Categoría</CardTitle>
            <CardDescription>
              Distribución de ventas en las diferentes categorías.
            </CardDescription>
          </CardHeader>
          <CardContent>
             {salesByCategoryData.length > 0 ? (
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square h-[300px]"
                >
                <PieChart>
                    <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                    />
                    <Pie
                    data={salesByCategoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    strokeWidth={5}
                    >
                    {salesByCategoryData.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                    ))}
                    </Pie>
                    <ChartLegend
                    content={<ChartLegendContent nameKey="name" />}
                    className="-mt-4"
                    />
                </PieChart>
                </ChartContainer>
             ) : (
                <div className="flex justify-center items-center h-[300px]">
                    <p className="text-muted-foreground">No hay datos de ventas para mostrar.</p>
                </div>
             )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                Productos más Vendidos
              </CardTitle>
              <CardDescription>
                Los productos que generan más ingresos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                    <TableHead className="text-right">Ventas Totales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bestSellingProductsData.length > 0 ? (
                    bestSellingProductsData.map((product) => (
                        <TableRow key={product.id}>
                        <TableCell>
                            <div className="font-medium">{product.name}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                            {product.category}
                        </TableCell>
                        <TableCell className="text-right">
                            $
                            {product.sales.toLocaleString('es-ES', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                            })}
                        </TableCell>
                        </TableRow>
                    ))
                  ) : (
                    <TableRow>
                        <TableCell colSpan={3} className="text-center h-24">No hay datos de ventas.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-muted-foreground" />
                Productos menos Vendidos
            </CardTitle>
            <CardDescription>
                Los productos que generan menos ingresos.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                    <TableHead className="text-right">Ventas Totales</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                  {leastSellingProductsData.length > 0 ? (
                    leastSellingProductsData.map((product) => (
                        <TableRow key={product.id}>
                        <TableCell>
                            <div className="font-medium">{product.name}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                            {product.category}
                        </TableCell>
                        <TableCell className="text-right">
                            $
                            {product.sales.toLocaleString('es-ES', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                            })}
                        </TableCell>
                        </TableRow>
                    ))
                  ) : (
                    <TableRow>
                        <TableCell colSpan={3} className="text-center h-24">No hay datos de ventas.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
            </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
