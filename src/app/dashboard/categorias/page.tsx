
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
import { PlusSquare, Edit, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Category, User } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { addCategory, deleteCategory, getCategoriesForRestaurant, updateCategory } from '@/lib/server/actions';

const categorySchema = z.object({
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export default function CategoriasPage() {
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null);
    const [isAddEditOpen, setIsAddEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        try {
            const userData = sessionStorage.getItem('loggedInUser');
            const restaurantId = sessionStorage.getItem('activeRestaurantId');

            if (!userData || !restaurantId) {
                router.replace('/');
                return;
            }
            const user: User = JSON.parse(userData);
            setActiveRestaurantId(restaurantId);
            
            if (user.role === 'waiter' || user.role === 'seller') {
                router.replace('/dashboard/menu');
                return;
            }
            
            setIsAuthorized(true);
        } catch (error) {
            console.error("No se pudieron cargar los datos de la página", error);
            router.replace('/');
        }
    }, [router]);
    
    useEffect(() => {
      async function fetchCategories() {
        if (activeRestaurantId) {
          setIsLoading(true);
          const fetchedCategories = await getCategoriesForRestaurant(activeRestaurantId);
          setCategories(fetchedCategories);
          setIsLoading(false);
        }
      }
      if (isAuthorized) {
        fetchCategories();
      }
    }, [activeRestaurantId, isAuthorized]);

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: { name: '' },
    });

    useEffect(() => {
        if (isAddEditOpen) {
            if (categoryToEdit) {
                form.reset({ name: categoryToEdit.name });
            } else {
                form.reset({ name: '' });
            }
        }
    }, [isAddEditOpen, categoryToEdit, form]);
    
    const handleOpenAddDialog = () => {
        setCategoryToEdit(null);
        setIsAddEditOpen(true);
    };

    const handleOpenEditDialog = (category: Category) => {
        setCategoryToEdit(category);
        setIsAddEditOpen(true);
    };
    
    const handleOpenDeleteDialog = (category: Category) => {
        setCategoryToDelete(category);
        setIsDeleteOpen(true);
    };
    
    const handleConfirmDelete = async () => {
        if (!categoryToDelete) return;

        await deleteCategory(categoryToDelete.id);
        setCategories(categories.filter((c) => c.id !== categoryToDelete.id));

        toast({ title: "Categoría Eliminada", description: `"${categoryToDelete.name}" ha sido eliminada.` });
        setIsDeleteOpen(false);
        setCategoryToDelete(null);
    };

    const onSubmit = async (formData: CategoryFormValues) => {
        if (!activeRestaurantId) return;

        const existingCategory = categories.find(
            (c) => c.name.toLowerCase() === formData.name.toLowerCase() &&
                   c.id !== categoryToEdit?.id // Exclude the current category when editing
        );

        if (existingCategory) {
            toast({
                variant: 'destructive',
                title: 'Categoría Duplicada',
                description: `Ya existe una categoría con el nombre "${formData.name}".`
            });
            return;
        }

        if (categoryToEdit) {
            const updatedCategory = await updateCategory(categoryToEdit.id, formData);
            setCategories(categories.map((c) =>
                c.id === categoryToEdit.id ? updatedCategory : c
            ));
            toast({ title: "Categoría Actualizada", description: `"${formData.name}" ha sido actualizada.` });
        } else {
            const newCategory = await addCategory({ ...formData, restaurantId: activeRestaurantId });
            setCategories([...categories, newCategory]);
            toast({ title: "Categoría Añadida", description: `"${formData.name}" ha sido añadida.` });
        }
        setIsAddEditOpen(false);
        setCategoryToEdit(null);
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
          <div className="flex justify-between items-center">
            <CardTitle>Gestión de Categorías</CardTitle>
            <Button onClick={handleOpenAddDialog}>
              <PlusSquare className="mr-2 h-4 w-4" />
              Añadir Categoría
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre de la Categoría</TableHead>
                <TableHead className="text-center w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(category)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleOpenDeleteDialog(category)}>
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{categoryToEdit ? "Editar Categoría" : "Añadir Categoría"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la Categoría</Label>
              <Input id="name" {...form.register('name')} placeholder="Ej: Bebidas" />
              {form.formState.errors.name && <p className="text-sm font-medium text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <DialogFooter className="pt-4">
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
                    Esta acción no se puede deshacer. Esto eliminará permanentemente la categoría
                    "{categoryToDelete?.name}". Si existen productos en esta categoría, no serán eliminados pero podrían necesitar una nueva asignación de categoría.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setCategoryToDelete(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
