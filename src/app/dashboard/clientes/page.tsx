
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
import type { Customer, User } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { addCustomer, deleteCustomer, getCustomersForRestaurant, updateCustomer } from '@/lib/server/actions';

const customerSchema = z.object({
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  email: z.string().email({ message: "Por favor, introduce un correo válido." }),
  phone: z.string().min(7, { message: "Por favor, introduce un teléfono válido." }),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export default function ClientesPage() {
    const router = useRouter();

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null);

    const [isAddEditOpen, setIsAddEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        try {
            const userData = sessionStorage.getItem('loggedInUser');
            const restaurantId = sessionStorage.getItem('activeRestaurantId');

            if (userData) {
                const user: User = JSON.parse(userData);
                setCurrentUser(user);
                 if (!restaurantId || user.role === 'waiter') {
                    router.replace('/dashboard/menu');
                    return;
                }
                setActiveRestaurantId(restaurantId);
            } else {
                router.replace('/');
                return;
            }
            setIsAuthorized(true);
        } catch (error) {
            console.error("No se pudieron cargar los datos de la página", error);
            router.replace('/');
        }
    }, [router]);

    useEffect(() => {
        async function fetchCustomers() {
            if(activeRestaurantId) {
                setIsLoading(true);
                const fetchedCustomers = await getCustomersForRestaurant(activeRestaurantId);
                setCustomers(fetchedCustomers);
                setIsLoading(false);
            }
        }
        if (isAuthorized) {
            fetchCustomers();
        }
    }, [activeRestaurantId, isAuthorized]);

    const form = useForm<CustomerFormValues>({
        resolver: zodResolver(customerSchema),
        defaultValues: { name: '', email: '', phone: '' },
    });

    useEffect(() => {
        if (isAddEditOpen) {
            if (customerToEdit) {
                form.reset(customerToEdit);
            } else {
                form.reset({ name: '', email: '', phone: '' });
            }
        }
    }, [isAddEditOpen, customerToEdit, form]);

    const handleOpenAddDialog = () => {
        setCustomerToEdit(null);
        setIsAddEditOpen(true);
    };

    const handleOpenEditDialog = (customer: Customer) => {
        setCustomerToEdit(customer);
        setIsAddEditOpen(true);
    };
    
    const handleOpenDeleteDialog = (customer: Customer) => {
        setCustomerToDelete(customer);
        setIsDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!customerToDelete) return;
        
        await deleteCustomer(customerToDelete.id);
        setCustomers(customers.filter(c => c.id !== customerToDelete.id));

        toast({ title: "Cliente Eliminado", description: `"${customerToDelete.name}" ha sido eliminado.` });
        setIsDeleteOpen(false);
        setCustomerToDelete(null);
    };

    const onSubmit = async (formData: CustomerFormValues) => {
        if (!activeRestaurantId || activeRestaurantId === 'all') {
            toast({
                variant: 'destructive',
                title: 'Restaurante no seleccionado',
                description: 'Por favor, selecciona un restaurante específico para añadir o editar un cliente.',
            });
            return;
        }

        if (customerToEdit) {
            const updatedCustomer = await updateCustomer(customerToEdit.id, formData);
            setCustomers(customers.map((c) =>
                c.id === customerToEdit.id ? updatedCustomer : c
            ));
            toast({ title: "Cliente Actualizado", description: `"${formData.name}" ha sido actualizado.` });
        } else {
            const newCustomer = await addCustomer({ ...formData, restaurantId: activeRestaurantId });
            setCustomers([...customers, newCustomer]);
            toast({ title: "Cliente Añadido", description: `"${formData.name}" ha sido añadido.` });
        }
        setIsAddEditOpen(false);
        setCustomerToEdit(null);
    };

    const canManageCustomers = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'seller';
    const canDeleteCustomers = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

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
            <CardTitle>Gestión de Clientes</CardTitle>
             {canManageCustomers && (
                <Button onClick={handleOpenAddDialog} disabled={currentUser?.role === 'superadmin' && activeRestaurantId === 'all'}>
                  <PlusSquare className="mr-2 h-4 w-4" />
                  Añadir Cliente
                </Button>
             )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden sm:table-cell">Teléfono</TableHead>
                <TableHead className="text-center w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{customer.email}</TableCell>
                  <TableCell className="hidden sm:table-cell">{customer.phone}</TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(customer)} disabled={!canManageCustomers}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {canDeleteCustomers && (
                        <Button variant="destructive" size="icon" onClick={() => handleOpenDeleteDialog(customer)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{customerToEdit ? "Editar Cliente" : "Añadir Cliente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Nombre del Cliente</Label>
              <Input id="name" {...form.register('name')} placeholder="Ej: Ana García" className="mt-1" />
              {form.formState.errors.name && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register('email')} placeholder="Ej: ana.garcia@email.com" className="mt-1" />
              {form.formState.errors.email && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" {...form.register('phone')} placeholder="Ej: 555-123-4567" className="mt-1" />
              {form.formState.errors.phone && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.phone.message}</p>}
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
                    Esta acción no se puede deshacer. Esto eliminará permanentemente al cliente
                    "{customerToDelete?.name}".
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setCustomerToDelete(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
