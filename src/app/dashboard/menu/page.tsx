

'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusSquare, Edit, Trash2 } from 'lucide-react';
import type { Product, Category, User } from '@/types';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { addProduct, deleteProduct, getCategoriesForRestaurant, getProductsForRestaurant, updateProduct } from '@/lib/server/actions';

const productSchema = z.object({
  name: z.string().min(2, { message: "El nombre es obligatorio y debe tener al menos 2 caracteres." }),
  price: z.coerce.number({invalid_type_error: "El precio es obligatorio."}).gt(0, { message: "El precio debe ser mayor que 0." }),
  category: z.string({ required_error: "La categoría es obligatoria." }).min(1, "La categoría es obligatoria."),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function MenuPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null);

    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    
    const [isAddEditOpen, setIsAddEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const { toast } = useToast();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        try {
            const userData = sessionStorage.getItem('loggedInUser');
            const restaurantId = sessionStorage.getItem('activeRestaurantId');
            if (!userData || !restaurantId) {
                router.replace('/');
                return;
            }
            const user: User = JSON.parse(userData);
            setCurrentUser(user);
            setActiveRestaurantId(restaurantId);
            setIsAuthorized(true);
        } catch(error) {
            console.error("Error al cargar los datos del menú", error);
            router.replace('/');
        }
    }, [router]);

    useEffect(() => {
        async function fetchData() {
            if (activeRestaurantId) {
                setIsLoading(true);
                const [fetchedProducts, fetchedCategories] = await Promise.all([
                    getProductsForRestaurant(activeRestaurantId),
                    getCategoriesForRestaurant(activeRestaurantId)
                ]);
                setProducts(fetchedProducts);
                setCategories(fetchedCategories);
                setIsLoading(false);
            }
        }
        if (isAuthorized) {
            fetchData();
        }
    }, [activeRestaurantId, isAuthorized]);
    
    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: { name: '', price: undefined, category: undefined },
    });

    const canManageMenu = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

    useEffect(() => {
        if (isAddEditOpen) {
            if (productToEdit) {
                form.reset({
                    ...productToEdit,
                    price: Number(productToEdit.price)
                });
            } else {
                form.reset({ name: '', price: undefined, category: undefined });
            }
        }
    }, [isAddEditOpen, productToEdit, form]);

    const handleOpenAddDialog = () => {
        setProductToEdit(null);
        setIsAddEditOpen(true);
    };

    const handleOpenEditDialog = (product: Product) => {
        setProductToEdit(product);
        setIsAddEditOpen(true);
    };
    
    const handleOpenDeleteDialog = (product: Product) => {
        setProductToDelete(product);
        setIsDeleteOpen(true);
    };
    
    const handleConfirmDelete = async () => {
        if (!productToDelete) return;

        if (!canManageMenu) {
            toast({ variant: 'destructive', title: 'Acción no permitida', description: 'No tienes permisos para eliminar productos.' });
            setIsDeleteOpen(false);
            return;
        }

        await deleteProduct(productToDelete.id);
        setProducts(products.filter(p => p.id !== productToDelete.id));

        toast({ title: "Producto Eliminado", description: `"${productToDelete.name}" ha sido eliminado.` });
        setIsDeleteOpen(false);
        setProductToDelete(null);
    };

    const onSubmit = async (formData: ProductFormValues) => {
        if (!canManageMenu || !activeRestaurantId || activeRestaurantId === 'all') {
            toast({ variant: 'destructive', title: 'Acción no permitida', description: 'No tienes permisos para gestionar el menú o no se ha identificado el restaurante.' });
            setIsAddEditOpen(false);
            return;
        }

        const existingProduct = products.find(
            (p) => p.name.toLowerCase() === formData.name.toLowerCase() && p.id !== productToEdit?.id
        );

        if (existingProduct) {
            toast({
                variant: 'destructive',
                title: 'Producto Duplicado',
                description: `Ya existe un producto con el nombre "${formData.name}".`
            });
            return;
        }

        if (productToEdit) {
            const updated = await updateProduct(productToEdit.id, formData);
            setProducts(products.map(p => p.id === productToEdit.id ? updated : p));
            toast({ title: "Producto Actualizado", description: `"${formData.name}" ha sido actualizado.` });
        } else {
            const newProduct = await addProduct({ ...formData, restaurantId: activeRestaurantId });
            setProducts([...products, newProduct]);
            toast({ title: "Producto Añadido", description: `"${formData.name}" ha sido añadido al menú.` });
        }
        setIsAddEditOpen(false);
        setProductToEdit(null);
    };

  if (isLoading || !isAuthorized) {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-10 w-40" />
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
            <CardTitle>Gestión del Menú</CardTitle>
            {canManageMenu && (
              <Button onClick={handleOpenAddDialog} disabled={activeRestaurantId === 'all'}>
                <PlusSquare className="mr-2 h-4 w-4" />
                Añadir Plato
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre del Plato</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                {canManageMenu && <TableHead className="text-center w-[120px]">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell className="text-right">
                    ${Number(product.price).toFixed(2)}
                  </TableCell>
                  {canManageMenu && (
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleOpenDeleteDialog(product)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {canManageMenu && (
        <>
          <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{productToEdit ? "Editar Plato" : "Añadir Plato"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="name">Nombre del Plato</Label>
                  <Input id="name" {...form.register('name')} placeholder="Ej: Paella de Mariscos" className="mt-1" />
                  {form.formState.errors.name && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="price">Precio</Label>
                  <Input id="price" type="number" step="0.01" {...form.register('price')} placeholder="Ej: 35.00" className="mt-1" />
                  {form.formState.errors.price && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.price.message}</p>}
                </div>
                <div>
                  <Label htmlFor="category">Categoría</Label>
                  <Controller
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecciona una categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {form.formState.errors.category && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.category.message}</p>}
                </div>
                <DialogFooter className="pt-4 sm:col-span-2">
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
                        Esta acción no se puede deshacer. Esto eliminará permanentemente el producto
                        "{productToDelete?.name}" de tu menú.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
  );
}
