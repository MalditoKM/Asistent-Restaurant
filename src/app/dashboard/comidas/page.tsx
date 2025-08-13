
'use client';

import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ClipboardList,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  X,
  Printer,
  Trash2,
  PlusSquare,
  Edit,
} from 'lucide-react';
import type { Product, OrderItem, Category, Sale, User, Restaurant } from '@/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { addSale, getCategoriesForRestaurant, getProductsForRestaurant, getRestaurantById, getSaleById, updateSale } from '@/lib/server/actions';

const Barcode = ({ id }: { id: string }) => {
    // Simple pseudo-random number generator based on the ID
    const simpleHash = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    };

    const hash = simpleHash(id);
    const bars = Array.from({ length: 40 }, (_, i) => {
        const random = Math.abs(simpleHash(id + i));
        return random % 4; // Generates 0, 1, 2, 3
    });

    return (
        <div className="flex flex-col items-center mt-4">
            <svg height="50" className="w-full max-w-[200px]">
                {bars.map((width, i) => (
                    <rect 
                        key={i} 
                        x={i * 5} 
                        y="0" 
                        width={width === 0 ? 0 : width + 1} // Bar width
                        height="50" 
                        style={{ fill: '#000000' }} 
                    />
                ))}
            </svg>
            <p className="text-xs tracking-widest">{id}</p>
        </div>
    );
};


export default function ComidasPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentRestaurant, setCurrentRestaurant] = useState<Restaurant | null>(null);

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [printableSale, setPrintableSale] = useState<Sale | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const userData = sessionStorage.getItem('loggedInUser');
      const restaurantId = sessionStorage.getItem('activeRestaurantId');
      const saleIdToEdit = sessionStorage.getItem('saleToEditId');

      if (userData && restaurantId) {
          setCurrentUser(JSON.parse(userData));
          setActiveRestaurantId(restaurantId);
          if (saleIdToEdit) setEditingSaleId(saleIdToEdit);
      }
    } catch(error) {
        console.error("Error al cargar los datos de sesión", error);
    }
  }, []);
  
  useEffect(() => {
    async function fetchData() {
      if (activeRestaurantId) {
        setIsLoading(true);
        const [fetchedProducts, fetchedCategories, fetchedRestaurant] = await Promise.all([
          getProductsForRestaurant(activeRestaurantId),
          getCategoriesForRestaurant(activeRestaurantId),
          getRestaurantById(activeRestaurantId),
        ]);
        setProducts(fetchedProducts);
        setCategories(fetchedCategories);
        setCurrentRestaurant(fetchedRestaurant);

        if (editingSaleId) {
          const saleToEdit = await getSaleById(editingSaleId);
          if (saleToEdit) {
            setOrderItems(saleToEdit.items);
            setCustomerName(saleToEdit.customerName);
            setTableNumber(saleToEdit.tableNumber);
            toast({
                title: "Modificando Comanda",
                description: `Se ha cargado la comanda de la mesa ${saleToEdit.tableNumber}. Añade más productos.`
            });
          }
          sessionStorage.removeItem('saleToEditId');
        }
        setIsLoading(false);
      }
    }
    fetchData();
  }, [activeRestaurantId, editingSaleId, toast]);

  const handleAddToOrder = (product: Product) => {
    setOrderItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.id === product.id);
      if (existingItem) {
        return prevItems.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevItems, { ...product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveFromOrder(productId);
      return;
    }
    setOrderItems((prevItems) =>
      prevItems.map((item) =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };
  
  const handleRemoveFromOrder = (productId: string) => {
    setOrderItems((prevItems) => prevItems.filter((item) => item.id !== productId));
  };

  const handleClearOrder = () => {
    setOrderItems([]);
    setCustomerName('');
    setTableNumber('');
    setEditingSaleId(null);
  };

  const handleSaveAndPrint = async () => {
    if (orderItems.length === 0) {
      toast({ variant: 'destructive', title: 'Comanda Vacía', description: 'Añade productos antes de guardar.' });
      return;
    }
  
    if (!tableNumber || tableNumber.trim() === '') {
      toast({ variant: 'destructive', title: 'Campo Obligatorio', description: 'Por favor, introduce un número de mesa.' });
      return;
    }
    
    if (!currentUser || !activeRestaurantId) {
       toast({ variant: 'destructive', title: 'Error de Sesión', description: 'No se ha podido identificar al usuario o restaurante. Inicia sesión de nuevo.' });
      return;
    }

    try {
        let saleToPrint: Sale;

        if (editingSaleId) {
            const updatedSaleData = {
                items: orderItems,
                totalPrice: totalPrice,
                saleDate: new Date().toISOString(),
            };
            saleToPrint = await updateSale(editingSaleId, updatedSaleData);
            toast({ title: "Comanda Actualizada", description: "Los cambios en la comanda han sido guardados." });
        } else {
            const newSaleData = {
                customerName: customerName.trim() ? customerName : 'Consumidor Final',
                tableNumber: tableNumber,
                items: orderItems,
                totalPrice: totalPrice,
                saleDate: new Date().toISOString(),
                userId: currentUser.id,
                userName: currentUser.name || currentUser.email,
                restaurantId: activeRestaurantId,
                status: 'pending' as const,
            };
            saleToPrint = await addSale(newSaleData);
            toast({ title: "Comanda Guardada", description: "La comanda ha sido guardada en el historial de ventas." });
        }
        
        setPrintableSale(saleToPrint);
        
        // This timeout ensures the state is updated before printing
        setTimeout(() => {
            window.print();
            setPrintableSale(null); // Clear after printing
            handleClearOrder();
        }, 100);

    } catch (error) {
        console.error("No se pudo guardar la comanda", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la comanda." });
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === 'All' || product.category === selectedCategory;
      const matchesSearch = product.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchTerm, products]);

  const totalPrice = useMemo(() => {
    return orderItems.reduce((total, item) => total + item.price * item.quantity, 0);
  }, [orderItems]);

  if (isLoading) {
      return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
                <Skeleton className="h-[600px] w-full" />
            </div>
            <div className="lg:col-span-1">
                <Skeleton className="h-[600px] w-full" />
            </div>
          </div>
      );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start print-hidden">
        {/* Columna Izquierda: Selección de Platos */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-6 w-6" />
                Seleccionar Platos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar platos para la comanda..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === 'All' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('All')}
                >
                  Todas las Categorías
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.name ? 'default' : 'outline'}
                    onClick={() => setSelectedCategory(category.name)}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>
              <ScrollArea className="h-[300px] md:h-[450px] border rounded-md p-2">
                <div className="space-y-2">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ${product.price.toFixed(2)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleAddToOrder(product)}>
                        <PlusSquare className="h-4 w-4 mr-2" />
                        Añadir
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha: Comanda Actual */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {editingSaleId ? <Edit className="h-6 w-6" /> : <ShoppingCart className="h-6 w-6" />}
                {editingSaleId ? 'Modificando Comanda' : 'Comanda Actual'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Detalles de la Comanda</h3>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="customerName" className="text-sm font-medium text-muted-foreground">Nombre del Cliente</label>
                    <Input id="customerName" placeholder="Consumidor Final" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="tableNumber" className="text-sm font-medium text-muted-foreground">Número de Mesa</label>
                    <Input id="tableNumber" type="number" placeholder="1" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} />
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-2">Platos en la Comanda:</h3>
                <ScrollArea className={cn("h-[150px] sm:h-[200px]", orderItems.length === 0 && 'h-auto')}>
                  {orderItems.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">La comanda está vacía.</p>
                  ) : (
                    <div className="space-y-2">
                      {orderItems.map((item) => (
                        <div key={item.id} className="flex items-start justify-between p-2 rounded-md bg-muted/50">
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} &times; ${item.price.toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-sm w-16 text-right">${(item.quantity * item.price).toFixed(2)}</div>
                            <div className="flex items-center gap-1">
                              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}> <Minus className="h-3 w-3" /> </Button>
                              <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}> <Plus className="h-3 w-3" /> </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10 ml-1" onClick={() => handleRemoveFromOrder(item.id)}> <X className="h-4 w-4" /> </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
              <Separator />
              <div className="flex justify-between items-center font-bold text-xl">
                <span>TOTAL:</span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <Button className="w-full" disabled={orderItems.length === 0} onClick={handleSaveAndPrint}>
                <Printer className="mr-2 h-4 w-4" />
                {editingSaleId ? 'Actualizar e Imprimir' : 'Guardar e Imprimir'}
              </Button>
              <Button variant="outline" className="w-full" onClick={handleClearOrder} disabled={orderItems.length === 0}>
                <Trash2 className="mr-2 h-4 w-4" />
                Limpiar Comanda
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
      
      <div id="printable-ticket-wrapper" className="hidden print-block">
        {printableSale && (
            <div className="print-text-black print-text-xs print-font-mono">
                <div className="text-center space-y-1">
                    <h2 className="text-base font-bold">{currentRestaurant?.name}</h2>
                    <p>Cliente: <strong>{printableSale.customerName}</strong></p>
                    <p>Mesa: <strong>{printableSale.tableNumber}</strong></p>
                    <p>{format(new Date(printableSale.saleDate), "dd/MM/yyyy HH:mm")}</p>
                    {printableSale.userName && <p>Vendido por: {printableSale.userName}</p>}
                </div>
                <Separator className="my-2 border-dashed border-black/50" />
                <div className="flex justify-between font-bold">
                    <span>Producto</span>
                    <span>Total</span>
                </div>
                <Separator className="my-2 border-dashed border-black/50" />
                <div className="space-y-1">
                    {printableSale.items.map((item) => (
                        <div key={item.id}>
                            <div className="flex justify-between items-start">
                                <span>{item.name}</span>
                                <span className="text-right w-16">${(item.quantity * item.price).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-start pl-2">
                                <span className="text-muted-foreground text-xs">{item.quantity} x ${item.price.toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <Separator className="my-2 border-dashed border-black/50" />
                <div className="flex justify-between items-center font-bold text-sm pt-1">
                    <span>TOTAL:</span>
                    <span>${printableSale.totalPrice.toFixed(2)}</span>
                </div>
                <div className="text-center mt-4">
                  <p>¡Gracias por su visita!</p>
                </div>
                <Barcode id={printableSale.id} />
            </div>
        )}
      </div>
    </>
  );
}
