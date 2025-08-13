
'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PlusSquare, Edit, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Purchase, User } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { addPurchase, deletePurchase, getPurchasesForRestaurant, updatePurchase } from '@/lib/server/actions';

const purchaseSchema = z.object({
  productName: z.string().min(2, { message: "El nombre del producto debe tener al menos 2 caracteres." }),
  supplier: z.string().optional(),
  quantity: z.coerce.number().positive({ message: "La cantidad debe ser un número positivo." }),
  unitPrice: z.coerce.number().positive({ message: "El precio unitario debe ser un número positivo." }),
  purchaseDate: z.date({ required_error: "Por favor, selecciona una fecha." }),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

export default function ComprasPage() {
    const router = useRouter();
    
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null);

    const [isAddEditOpen, setIsAddEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [purchaseToEdit, setPurchaseToEdit] = useState<Purchase | null>(null);
    const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const { toast } = useToast();

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
            console.error("No se pudieron cargar los datos de la página", error);
            router.replace('/');
        }
    }, [router]);
    
    useEffect(() => {
        async function fetchPurchases() {
            if (activeRestaurantId) {
                setIsLoading(true);
                const fetchedPurchases = await getPurchasesForRestaurant(activeRestaurantId);
                setPurchases(fetchedPurchases);
                setIsLoading(false);
            }
        }
        if(isAuthorized) {
            fetchPurchases();
        }
    }, [activeRestaurantId, isAuthorized]);

    const form = useForm<PurchaseFormValues>({
        resolver: zodResolver(purchaseSchema),
        defaultValues: { productName: '', supplier: '', quantity: 0, unitPrice: 0 },
    });

    useEffect(() => {
        if (isAddEditOpen) {
            if (purchaseToEdit) {
                form.reset({
                    ...purchaseToEdit,
                    purchaseDate: new Date(purchaseToEdit.purchaseDate)
                });
            } else {
                form.reset({ productName: '', supplier: '', quantity: 0, unitPrice: 0, purchaseDate: new Date() });
            }
        }
    }, [isAddEditOpen, purchaseToEdit, form]);
    
    const handleOpenAddDialog = () => {
        setPurchaseToEdit(null);
        setIsAddEditOpen(true);
    };

    const handleOpenEditDialog = (purchase: Purchase) => {
        setPurchaseToEdit(purchase);
        setIsAddEditOpen(true);
    };
    
    const handleOpenDeleteDialog = (purchase: Purchase) => {
        setPurchaseToDelete(purchase);
        setIsDeleteOpen(true);
    };
    
    const handleConfirmDelete = async () => {
        if (!purchaseToDelete) return;
        
        await deletePurchase(purchaseToDelete.id);
        setPurchases(purchases.filter(p => p.id !== purchaseToDelete.id));
        
        toast({ title: "Compra Eliminada", description: `La compra de "${purchaseToDelete.productName}" ha sido eliminada.` });
        setIsDeleteOpen(false);
        setPurchaseToDelete(null);
    };

    const onSubmit = async (formData: PurchaseFormValues) => {
        if (!activeRestaurantId || activeRestaurantId === 'all') {
             toast({
                variant: 'destructive',
                title: 'Restaurante no seleccionado',
                description: 'Por favor, selecciona un restaurante específico para registrar una compra.',
            });
            return;
        }

        const purchaseData = { ...formData, purchaseDate: formData.purchaseDate.toISOString() };

        if (purchaseToEdit) {
            const updated = await updatePurchase(purchaseToEdit.id, purchaseData);
            setPurchases(purchases.map(p => p.id === purchaseToEdit.id ? updated : p));
            toast({ title: "Compra Actualizada", description: `La compra de "${formData.productName}" ha sido actualizada.` });
        } else {
            const newPurchase = await addPurchase({ ...purchaseData, restaurantId: activeRestaurantId });
            setPurchases([...purchases, newPurchase]);
            toast({ title: "Compra Registrada", description: `La compra de "${formData.productName}" ha sido registrada.` });
        }
        setIsAddEditOpen(false);
        setPurchaseToEdit(null);
    };

    if (isLoading || !isAuthorized) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <Skeleton className="h-8 w-1/3" />
                        <Skeleton className="h-10 w-44" />
                    </div>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-48 w-full" />
                </CardContent>
            </Card>
        );
    }

    return (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <CardTitle>Gestión de Compras</CardTitle>
                <Button onClick={handleOpenAddDialog} disabled={currentUser?.role === 'superadmin' && activeRestaurantId === 'all'}>
                  <PlusSquare className="mr-2 h-4 w-4" />
                  Registrar Compra
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="hidden lg:table-cell">Proveedor</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Precio Unitario</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="hidden sm:table-cell">Fecha de Compra</TableHead>
                    <TableHead className="text-center w-[120px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-medium">{purchase.productName}</TableCell>
                      <TableCell className="hidden lg:table-cell">{purchase.supplier || 'N/A'}</TableCell>
                      <TableCell className="text-right">{purchase.quantity}</TableCell>
                      <TableCell className="text-right hidden md:table-cell">${Number(purchase.unitPrice).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">${(purchase.quantity * Number(purchase.unitPrice)).toFixed(2)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{format(new Date(purchase.purchaseDate), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(purchase)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleOpenDeleteDialog(purchase)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{purchaseToEdit ? "Editar Compra" : "Registrar Nueva Compra"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="productName">Nombre del Producto</Label>
                  <Input id="productName" {...form.register('productName')} placeholder="Ej: Gambas Frescas" className="mt-1" />
                  {form.formState.errors.productName && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.productName.message}</p>}
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="supplier">Proveedor (Opcional)</Label>
                  <Input id="supplier" {...form.register('supplier')} placeholder="Ej: Mariscos del Sur" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="quantity">Cantidad</Label>
                  <Input id="quantity" type="number" step="1" {...form.register('quantity')} placeholder="Ej: 20" className="mt-1" />
                  {form.formState.errors.quantity && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.quantity.message}</p>}
                </div>
                <div>
                  <Label htmlFor="unitPrice">Precio Unitario</Label>
                  <Input id="unitPrice" type="number" step="0.01" {...form.register('unitPrice')} placeholder="Ej: 25.50" className="mt-1" />
                  {form.formState.errors.unitPrice && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.unitPrice.message}</p>}
                </div>
                <div className="sm:col-span-2">
                    <Label htmlFor="purchaseDate">Fecha de Compra</Label>
                    <Controller
                        control={form.control}
                        name="purchaseDate"
                        render={({ field }) => (
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-full justify-start text-left font-normal mt-1",
                                    !field.value && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, "PPP") : <span>Selecciona una fecha</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                        )}
                    />
                    {form.formState.errors.purchaseDate && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.purchaseDate.message}</p>}
                </div>

                <DialogFooter className="sm:col-span-2 pt-4">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button type="submit">Guardar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          
          <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción no se puede deshacer. Esto eliminará permanentemente el registro de la compra de
                        "{purchaseToDelete?.productName}".
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setPurchaseToDelete(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
    );
}
