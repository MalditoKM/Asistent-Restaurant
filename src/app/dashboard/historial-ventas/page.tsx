
'use client';

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Eye, Printer, Trash2, CheckCircle2, Edit } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';

import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { Sale, User } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteSales, getRestaurantById, getSalesForRestaurant, updateSaleStatus } from '@/lib/server/actions';

const chartConfig = {
  sales: {
    label: 'Ventas',
    color: 'hsl(var(--chart-1))',
  },
};

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

export default function HistorialVentasPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);

  const [date, setDate] = useState<DateRange | undefined>(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 29);
    return { from, to };
  });

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [restaurantName, setRestaurantName] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDeleteSelectedOpen, setIsDeleteSelectedOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    try {
        const userData = sessionStorage.getItem('loggedInUser');
        const restaurantId = sessionStorage.getItem('activeRestaurantId');
        if (userData && restaurantId) {
            setCurrentUser(JSON.parse(userData));
            setActiveRestaurantId(restaurantId);
        }
    } catch (error) {
        console.error("No se pudo cargar la sesión del usuario", error);
    }
  }, []);

  useEffect(() => {
    async function fetchData() {
        if(activeRestaurantId) {
            setIsLoading(true);
            const [fetchedSales, restaurantData] = await Promise.all([
                getSalesForRestaurant(activeRestaurantId),
                activeRestaurantId === 'all' ? Promise.resolve(null) : getRestaurantById(activeRestaurantId)
            ]);
            
            const sortedSales = fetchedSales.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());
            setSales(sortedSales);

            if(restaurantData) {
                setRestaurantName(restaurantData.name);
            } else {
                setRestaurantName('Todos los Restaurantes');
            }
            setIsLoading(false);
        }
    }
    fetchData();
  }, [activeRestaurantId]);

  const filteredSales = useMemo(() => {
    if (!currentUser) return [];

    let currentSales = sales;
    
    // Filter by user if waiter
    if (currentUser.role === 'waiter') {
      currentSales = currentSales.filter(sale => sale.userId === currentUser.id);
    }

    // Filter by date range
    if (date?.from) {
      const from = new Date(date.from.setHours(0, 0, 0, 0));
      const to = date.to ? new Date(date.to.setHours(23, 59, 59, 999)) : new Date(from.setHours(23, 59, 59, 999));

      currentSales = currentSales.filter(sale => {
        const saleDate = new Date(sale.saleDate);
        return saleDate >= from && saleDate <= to;
      });
    }

    return currentSales;
  }, [sales, currentUser, date]);
  
  const chartData = useMemo(() => {
    const salesByDay: Record<string, number> = {};

    filteredSales.forEach(sale => {
      const day = format(new Date(sale.saleDate), 'yyyy-MM-dd');
      salesByDay[day] = (salesByDay[day] || 0) + Number(sale.totalPrice);
    });

    if (date?.from) {
      const from = date.from;
      const to = date.to || from;
      let currentDate = new Date(from);
      
      while (currentDate <= to) {
        const formattedDate = format(currentDate, 'yyyy-MM-dd');
        if (!salesByDay[formattedDate]) {
          salesByDay[formattedDate] = 0;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return Object.entries(salesByDay)
      .map(([day, total]) => ({
        date: day,
        sales: total,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredSales, date]);


  const handleOpenDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailsOpen(true);
  };

  const handleEditSale = (saleId: string) => {
    sessionStorage.setItem('saleToEditId', saleId);
    router.push('/dashboard/comidas');
  };
  
  const handleReprint = () => {
    setTimeout(() => {
        window.print();
    }, 100);
  };

  const handleMarkAsPaid = async (saleId: string) => {
    try {
        await updateSaleStatus(saleId, 'paid');
        setSales(sales.map(sale => sale.id === saleId ? { ...sale, status: 'paid' } : sale));
        
        if (selectedSale && selectedSale.id === saleId) {
            setSelectedSale({ ...selectedSale, status: 'paid' });
        }

        toast({
            title: "Venta Actualizada",
            description: "La venta ha sido marcada como pagada.",
        });
    } catch (error) {
        console.error("Error al marcar como pagada", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el estado de la venta." });
    }
  };
  
  const handleConfirmDeleteSelected = async () => {
    if (!currentUser || (currentUser?.role !== 'admin' && currentUser?.role !== 'superadmin')) {
        toast({ variant: 'destructive', title: 'Acción no permitida', description: 'No tienes permisos para eliminar ventas.' });
        return;
    }

    try {
        await deleteSales(Array.from(selectedRows));
        setSales(sales.filter(sale => !selectedRows.has(sale.id)));
        setSelectedRows(new Set());
        toast({ title: "Ventas Eliminadas", description: `${selectedRows.size} venta(s) ha(n) sido eliminada(s) permanentemente.` });
    } catch (error) {
        console.error("Error al eliminar las ventas seleccionadas", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudieron eliminar las ventas seleccionadas." });
    } finally {
        setIsDeleteSelectedOpen(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
        setSelectedRows(new Set(filteredSales.map(s => s.id)));
    } else {
        setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelectedRows = new Set(selectedRows);
    if (checked) {
        newSelectedRows.add(id);
    } else {
        newSelectedRows.delete(id);
    }
    setSelectedRows(newSelectedRows);
  };

  const canManageSales = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const canMarkAsPaid = currentUser?.role === 'superadmin' || currentUser?.role === 'admin' || currentUser?.role === 'seller';
  const canModifyOrder = !!currentUser;
  const tableColSpan = canManageSales ? (currentUser?.role === 'waiter' ? 8 : 8) : (currentUser?.role === 'waiter' ? 7 : 7);
  
  if (isLoading) {
    return (
        <div className="space-y-6">
            <Skeleton className="h-[400px] w-full" />
            <Skeleton className="h-[400px] w-full" />
        </div>
    );
  }

  return (
    <div className="space-y-6">
      {currentUser?.role !== 'waiter' && (
        <Card>
          <CardHeader>
            <CardTitle>Historial de Ventas por Día</CardTitle>
            <CardDescription>
              Resumen de las ventas diarias en el período seleccionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Bar dataKey="sales" fill="var(--color-sales)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <CardTitle>Comprobantes de Venta</CardTitle>
                    <CardDescription>
                        {currentUser?.role === 'waiter' 
                            ? "Lista de tus ventas registradas en el período seleccionado." 
                            : "Lista de todas las ventas registradas en el período seleccionado."}
                    </CardDescription>
                </div>
                 <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={'outline'}
                            className={cn(
                            'w-full sm:w-[280px] justify-start text-left font-normal',
                            !date && 'text-muted-foreground'
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (
                            date.to ? (
                                <>
                                {format(date.from, 'LLL dd, y')} -{' '}
                                {format(date.to, 'LLL dd, y')}
                                </>
                            ) : (
                                format(date.from, 'LLL dd, y')
                            )
                            ) : (
                            <span>Selecciona una fecha</span>
                            )}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={2}
                        />
                        </PopoverContent>
                    </Popover>
                    {canManageSales && (
                        <Button variant="destructive" onClick={() => setIsDeleteSelectedOpen(true)} disabled={selectedRows.size === 0} className="w-full sm:w-auto">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar ({selectedRows.size})
                        </Button>
                    )}
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        {canManageSales && (
                            <TableHead className="w-[40px]">
                                <Checkbox
                                    checked={filteredSales.length > 0 && selectedRows.size === filteredSales.length}
                                    onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                                    aria-label="Seleccionar todas las filas"
                                    disabled={filteredSales.length === 0}
                                />
                            </TableHead>
                        )}
                        <TableHead>Fecha y Hora</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Mesa</TableHead>
                        {currentUser?.role !== 'waiter' && <TableHead className="hidden lg:table-cell">Vendido Por</TableHead>}
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-center w-[250px]">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredSales.length > 0 ? (
                        filteredSales.map((sale) => (
                            <TableRow key={sale.id} data-state={selectedRows.has(sale.id) ? 'selected' : undefined}>
                                {canManageSales && (
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedRows.has(sale.id)}
                                            onCheckedChange={(checked) => handleSelectRow(sale.id, Boolean(checked))}
                                            aria-label={`Seleccionar la venta ${sale.id}`}
                                        />
                                    </TableCell>
                                )}
                                <TableCell>{format(new Date(sale.saleDate), 'dd/MM/yyyy HH:mm')}</TableCell>
                                <TableCell className="font-medium">{sale.customerName}</TableCell>
                                <TableCell>{sale.tableNumber}</TableCell>
                                {currentUser?.role !== 'waiter' && <TableCell className="hidden lg:table-cell">{sale.userName || 'N/A'}</TableCell>}
                                <TableCell className="text-right font-semibold">${Number(sale.totalPrice).toFixed(2)}</TableCell>
                                <TableCell>
                                    {sale.status === 'paid' ? (
                                        <Badge variant="default" className="bg-green-500 text-white hover:bg-green-600">Pagado</Badge>
                                    ) : (
                                        <Badge variant="secondary" className="bg-yellow-400 text-yellow-900 hover:bg-yellow-500">Pendiente</Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col sm:flex-row justify-center items-center gap-2">
                                        {sale.status === 'pending' && canModifyOrder && (
                                            <Button variant="outline" size="sm" onClick={() => handleEditSale(sale.id)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Modificar
                                            </Button>
                                        )}
                                        <Button variant="outline" size="sm" onClick={() => handleOpenDetails(sale)}>
                                            <Eye className="mr-2 h-4 w-4" />
                                            Ver
                                        </Button>
                                        {sale.status === 'pending' && canMarkAsPaid && (
                                            <Button variant="outline" size="sm" onClick={() => handleMarkAsPaid(sale.id)}>
                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                                Marcar Pagado
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={tableColSpan} className="h-24 text-center">
                                No hay ventas registradas para el período seleccionado.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-md print:max-w-none print:shadow-none print:border-0">
            <div id="printable-receipt" className="print-text-black print-text-xs print-font-mono">
                <DialogHeader className="text-center space-y-2 mb-4 print:text-center print:space-y-1">
                    <DialogTitle className="no-print">Detalles de la Venta</DialogTitle>
                    {selectedSale && (
                        <DialogDescription className="no-print">
                            Comprobante para {selectedSale.customerName} - Mesa: {selectedSale.tableNumber}
                        </DialogDescription>
                    )}
                    <div className="hidden print:block space-y-1">
                        <h2 className="text-base font-bold">{restaurantName}</h2>
                        {selectedSale && (
                            <>
                                <p>Cliente: <strong>{selectedSale.customerName}</strong></p>
                                <p>Mesa: <strong>{selectedSale.tableNumber}</strong></p>
                                <p>{format(new Date(selectedSale.saleDate), "dd/MM/yyyy HH:mm")}</p>
                                {selectedSale.userName && <p>Vendido por: {selectedSale.userName}</p>}
                                <p className="font-semibold pt-1">COPIA DE TICKET</p>
                            </>
                        )}
                    </div>
                </DialogHeader>
                {selectedSale && (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm no-print">
                            <span className="text-muted-foreground">
                            {format(new Date(selectedSale.saleDate), "eeee, d 'de' LLLL 'de' yyyy, h:mm a")}
                            </span>
                            {selectedSale.status === 'paid' ? (
                                <Badge variant="default" className="bg-green-500 text-white hover:bg-green-600">Pagado</Badge>
                            ) : (
                                <Badge variant="secondary" className="bg-yellow-400 text-yellow-900 hover:bg-yellow-500">Pendiente</Badge>
                            )}
                        </div>
                        <Separator className="my-2 border-dashed border-black/50" />
                        <div className="hidden print:flex justify-between font-bold">
                            <span>Producto</span>
                            <span>Total</span>
                        </div>
                        <Separator className="hidden print:block my-2 border-dashed border-black/50" />
                        <ScrollArea className="h-[200px] pr-4 print:h-auto print:pr-0">
                            <div className="space-y-2 print:space-y-1">
                                {selectedSale.items.map((item) => (
                                    <div key={item.id} className="print:block">
                                        <div className="flex justify-between items-start text-sm">
                                            <div>
                                                <p className="font-medium">{item.name}</p>
                                                <p className="text-xs text-muted-foreground no-print">
                                                    {item.quantity} x ${Number(item.price).toFixed(2)}
                                                </p>
                                            </div>
                                            <p className="font-medium">${(item.quantity * Number(item.price)).toFixed(2)}</p>
                                        </div>
                                        <div className="hidden print:flex justify-between items-start pl-2 text-xs">
                                          <span>{item.quantity} x ${Number(item.price).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                        <Separator className="my-2 border-dashed border-black/50" />
                        <div className="flex justify-between items-center font-bold text-lg print:text-sm">
                            <span>TOTAL:</span>
                            <span>${Number(selectedSale.totalPrice).toFixed(2)}</span>
                        </div>
                        <div className="text-center mt-4">
                            <p>¡Gracias por su visita!</p>
                        </div>
                        <Barcode id={selectedSale.id} />
                    </div>
                )}
            </div>
            <DialogFooter className="pt-4 no-print sm:justify-between sm:space-x-2">
                <div>
                     {selectedSale?.status === 'pending' && canMarkAsPaid && (
                        <Button variant="outline" onClick={() => selectedSale && handleMarkAsPaid(selectedSale.id)}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Marcar Pagado
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cerrar</Button>
                    </DialogClose>
                    {selectedSale?.status === 'pending' && canModifyOrder ? (
                        <Button onClick={() => selectedSale && handleEditSale(selectedSale.id)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Añadir Productos
                        </Button>
                    ) : (
                        <Button onClick={handleReprint} disabled={!selectedSale}>
                            <Printer className="mr-2 h-4 w-4" />
                            Reimprimir Ticket
                        </Button>
                    )}
                </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteSelectedOpen} onOpenChange={setIsDeleteSelectedOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción es irreversible y eliminará permanentemente {selectedRows.size} venta(s) seleccionada(s).
                    No podrás recuperar estos datos. ¿Deseas continuar?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={handleConfirmDeleteSelected}>Sí, eliminar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
