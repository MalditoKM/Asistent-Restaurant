
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
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
import { Button, buttonVariants } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Edit, Eye, EyeOff } from 'lucide-react';
import type { Restaurant, User } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteRestaurant, getAllRestaurantsWithUsers, updateRestaurant } from '@/lib/server/actions';

const restaurantSchema = z.object({
  name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres.' }),
  address: z.string().min(5, { message: 'La dirección debe tener al menos 5 caracteres.' }),
  phone: z.string().min(7, { message: 'Por favor, introduce un número de teléfono válido.' }),
  adminId: z.string().optional(),
  adminEmail: z.string().email({ message: 'Por favor, introduce un correo electrónico válido.' }).optional().or(z.literal('')),
  adminPassword: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }).optional().or(z.literal('')),
});

type RestaurantFormValues = z.infer<typeof restaurantSchema>;

export default function SuperAdminPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [restaurantToEdit, setRestaurantToEdit] = useState<Restaurant | null>(null);
    const [restaurantToDelete, setRestaurantToDelete] = useState<Restaurant | null>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [currentRestaurantId, setCurrentRestaurantId] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const form = useForm<RestaurantFormValues>({
        resolver: zodResolver(restaurantSchema),
    });

    useEffect(() => {
        try {
            const userData = sessionStorage.getItem('loggedInUser');
            if (userData) {
                const user: User = JSON.parse(userData);
                if (user.role !== 'superadmin') {
                    router.replace('/dashboard/informes');
                    return;
                }
            } else {
                router.replace('/');
                return;
            }
            
            const loggedInRestaurantId = sessionStorage.getItem('loggedInRestaurant');
            setCurrentRestaurantId(loggedInRestaurantId);

            setIsAuthorized(true);
        } catch (error) {
            console.error("Error al cargar los datos de la página de superadministrador", error);
            toast({
                variant: 'destructive',
                title: 'Error de Carga',
                description: 'No se pudieron cargar los datos.',
            });
            router.replace('/');
        }
    }, [router, toast]);

    useEffect(() => {
        async function fetchRestaurants() {
            setIsLoading(true);
            const data = await getAllRestaurantsWithUsers();
            setRestaurants(data);
            setIsLoading(false);
        }
        if (isAuthorized) {
            fetchRestaurants();
        }
    }, [isAuthorized]);

    useEffect(() => {
        if (isEditDialogOpen && restaurantToEdit) {
            const adminUser = restaurantToEdit.users.find(u => u.role === 'admin' || u.role === 'superadmin');
            
            form.reset({
                name: restaurantToEdit.name,
                address: restaurantToEdit.address,
                phone: restaurantToEdit.phone,
                adminId: adminUser?.id,
                adminEmail: adminUser?.email,
                adminPassword: adminUser?.password,
            });
            setShowPassword(true); // Show password by default on edit
        } else {
            setShowPassword(false);
        }
    }, [isEditDialogOpen, restaurantToEdit, form]);
    
    const handleOpenEditDialog = (restaurant: Restaurant) => {
        setRestaurantToEdit(restaurant);
        setIsEditDialogOpen(true);
    };
    
    const handleOpenDeleteDialog = (restaurant: Restaurant) => {
        setRestaurantToDelete(restaurant);
    };

    const onEditSubmit = async (formData: RestaurantFormValues) => {
        if (!restaurantToEdit) return;

        try {
            const adminData = (formData.adminId && formData.adminEmail && formData.adminPassword)
                ? { id: formData.adminId, email: formData.adminEmail, password: formData.adminPassword }
                : undefined;

            const updated = await updateRestaurant(
                restaurantToEdit.id,
                { name: formData.name, address: formData.address, phone: formData.phone },
                adminData
            );
            
            setRestaurants(restaurants.map(r => r.id === restaurantToEdit.id ? updated : r));

            toast({
                title: 'Restaurante Actualizado',
                description: `Los datos del restaurante "${formData.name}" han sido actualizados.`,
            });
        } catch (error) {
             console.error("Error al actualizar el restaurante", error);
             toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el restaurante.' });
        } finally {
            setIsEditDialogOpen(false);
            setRestaurantToEdit(null);
        }
    };
    
    const handleConfirmDelete = async () => {
        if (!restaurantToDelete) return;
        
        try {
            await deleteRestaurant(restaurantToDelete.id);
            setRestaurants(restaurants.filter(r => r.id !== restaurantToDelete.id));

            toast({
                title: 'Restaurante Eliminado',
                description: `El restaurante "${restaurantToDelete.name}" y todos sus datos han sido eliminados.`,
            });
            
            if (currentRestaurantId === restaurantToDelete.id) {
                sessionStorage.removeItem('loggedInRestaurant');
                sessionStorage.removeItem('loggedInUser');
                router.push('/');
            }
        } catch (error) {
            console.error("Error al eliminar el restaurante", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el restaurante y sus datos asociados.' });
        } finally {
            setRestaurantToDelete(null);
        }
    };
    
    if (isLoading || !isAuthorized) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
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
                    <CardTitle>Panel de Superadministrador</CardTitle>
                    <CardDescription>
                        Gestiona todos los restaurantes registrados en el sistema. Las acciones aquí son críticas y no se pueden deshacer.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre del Restaurante</TableHead>
                                <TableHead className="hidden md:table-cell">Dirección</TableHead>
                                <TableHead>Teléfono</TableHead>
                                <TableHead className="text-center w-[120px]">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {restaurants.length > 0 ? (
                                restaurants.map(restaurant => (
                                    <TableRow key={restaurant.id}>
                                        <TableCell className="font-medium">{restaurant.name}</TableCell>
                                        <TableCell className="hidden md:table-cell">{restaurant.address}</TableCell>
                                        <TableCell>{restaurant.phone}</TableCell>
                                        <TableCell>
                                            <div className="flex justify-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleOpenEditDialog(restaurant)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="icon"
                                                    onClick={() => handleOpenDeleteDialog(restaurant)}
                                                    title="Eliminar restaurante"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No hay restaurantes registrados.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Editar Restaurante y Administrador</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onEditSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                        <div className="sm:col-span-2">
                            <Label htmlFor="name">Nombre del Restaurante</Label>
                            <Input id="name" {...form.register('name')} className="mt-1" />
                            {form.formState.errors.name && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.name.message}</p>}
                        </div>
                        <div className="sm:col-span-2">
                            <Label htmlFor="address">Dirección</Label>
                            <Input id="address" {...form.register('address')} className="mt-1" />
                            {form.formState.errors.address && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.address.message}</p>}
                        </div>
                        <div className="sm:col-span-2">
                            <Label htmlFor="phone">Teléfono</Label>
                            <Input id="phone" {...form.register('phone')} className="mt-1" />
                            {form.formState.errors.phone && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.phone.message}</p>}
                        </div>

                        {form.getValues('adminId') && (
                            <>
                                <hr className="my-2 sm:col-span-2" />
                                <h4 className="font-medium text-sm text-muted-foreground pt-1 sm:col-span-2">Credenciales del Administrador Principal</h4>
                                <input type="hidden" {...form.register('adminId')} />
                                <div className="sm:col-span-2">
                                    <Label htmlFor="adminEmail">Email del Administrador</Label>
                                    <Input id="adminEmail" {...form.register('adminEmail')} className="mt-1" />
                                    {form.formState.errors.adminEmail && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.adminEmail.message}</p>}
                                </div>
                                <div className="sm:col-span-2">
                                    <Label htmlFor="adminPassword">Contraseña del Administrador</Label>
                                    <div className="relative">
                                      <Input id="adminPassword" {...form.register('adminPassword')} type={showPassword ? "text" : "password"} className="mt-1 pr-10" />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                      >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        <span className="sr-only">{showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</span>
                                      </Button>
                                    </div>
                                    {form.formState.errors.adminPassword && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.adminPassword.message}</p>}
                                </div>
                            </>
                        )}

                        <DialogFooter className="pt-4 sm:col-span-2">
                            <DialogClose asChild>
                                <Button type="button" variant="outline">Cancelar</Button>
                            </DialogClose>
                            <Button type="submit">Guardar Cambios</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!restaurantToDelete} onOpenChange={(isOpen) => !isOpen && setRestaurantToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción es irreversible. Se eliminará permanentemente el restaurante "{restaurantToDelete?.name}"
                            junto con todos sus usuarios, menús, ventas y datos asociados. No podrás recuperar esta información.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRestaurantToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={handleConfirmDelete}>Sí, eliminar permanentemente</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
