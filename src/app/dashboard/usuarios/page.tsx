
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
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
import { PlusSquare, Edit, Trash2, ShieldCheck, User as UserIcon, Eye, EyeOff, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { User as UserType, Restaurant } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { addUser, deleteUser, getAllRestaurantsWithUsers, updateUser } from '@/lib/server/actions';

const userSchema = z.object({
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  email: z.string().email({ message: "Por favor, introduce una dirección de correo electrónico válida." }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
  role: z.enum(['superadmin', 'admin', 'seller', 'waiter'], { required_error: "Por favor, selecciona un rol." }),
});

type UserFormValues = z.infer<typeof userSchema>;
type UserWithRestaurantInfo = UserType & { restaurantId: string; restaurantName: string; };

const roleConfig = {
    superadmin: { label: 'Superadmin', icon: Crown, variant: 'destructive' as const },
    admin: { label: 'Administrador', icon: ShieldCheck, variant: 'default' as const },
    seller: { label: 'Vendedor', icon: UserIcon, variant: 'secondary' as const },
    waiter: { label: 'Mesero', icon: UserIcon, variant: 'secondary' as const },
};


export default function UsuariosPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null);

    const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
    const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<UserWithRestaurantInfo | null>(null);
    const [userToDelete, setUserToDelete] = useState<UserWithRestaurantInfo | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [currentUser, setCurrentUser] = useState<UserType | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        try {
            const userData = sessionStorage.getItem('loggedInUser');
            const restaurantId = sessionStorage.getItem('activeRestaurantId');
            if (userData && restaurantId) {
                const user: UserType = JSON.parse(userData);
                setCurrentUser(user);
                setActiveRestaurantId(restaurantId);

                if (user.role !== 'superadmin' && user.role !== 'admin') {
                    router.replace('/dashboard/informes');
                    return;
                }
            } else {
                router.replace('/');
                return;
            }
            setIsAuthorized(true);
        } catch (error) {
            console.error("No se pudieron cargar los datos del usuario", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los datos de los usuarios." });
            router.replace('/');
        }
    }, [router, toast]);
    
    useEffect(() => {
        async function fetchRestaurants() {
            if (isAuthorized) {
                setIsLoading(true);
                const fetchedRestaurants = await getAllRestaurantsWithUsers();
                setAllRestaurants(fetchedRestaurants);
                setIsLoading(false);
            }
        }
        fetchRestaurants();
    }, [isAuthorized]);

    const users = useMemo(() => {
        if (!allRestaurants || !currentUser) return [];

        let restaurantSource = allRestaurants;

        // If the current user is an admin (not superadmin), filter to only their restaurant
        if (currentUser.role === 'admin') {
            restaurantSource = allRestaurants.filter(r => r.id === currentUser.restaurantId);
        } else if (currentUser.role === 'superadmin' && activeRestaurantId !== 'all') {
            restaurantSource = allRestaurants.filter(r => r.id === activeRestaurantId);
        }
        
        const allUsersWithInfo: UserWithRestaurantInfo[] = restaurantSource.flatMap(r => 
            r.users.map(u => ({
                ...u,
                restaurantId: r.id,
                restaurantName: r.name,
            }))
        );

        if (currentUser.role === 'admin') {
            return allUsersWithInfo.filter(u => u.role !== 'superadmin');
        }
        
        return allUsersWithInfo.sort((a, b) => a.name.localeCompare(b.name));
    }, [allRestaurants, currentUser, activeRestaurantId]);

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: { name: '', email: '', password: '', role: 'waiter' },
    });

    useEffect(() => {
        if (isAddEditDialogOpen) {
            if (userToEdit) {
                form.reset({
                    name: userToEdit.name || '', 
                    email: userToEdit.email, 
                    password: userToEdit.password, 
                    role: userToEdit.role,
                });
                setShowPassword(true);
            } else {
                form.reset({ 
                    name: '',
                    email: '', 
                    password: '', 
                    role: 'waiter', 
                });
                setShowPassword(false);
            }
        }
    }, [isAddEditDialogOpen, userToEdit, form]);
    
    const handleOpenAddDialog = () => {
        setUserToEdit(null);
        setIsAddEditDialogOpen(true);
    };

    const handleOpenEditDialog = (user: UserWithRestaurantInfo) => {
        setUserToEdit(user);
        setIsAddEditDialogOpen(true);
    };

    const handleOpenDeleteDialog = (user: UserWithRestaurantInfo) => {
        setUserToDelete(user);
        setIsDeleteDialogOpen(true);
    };
    
    const handleConfirmDelete = async () => {
        if (!userToDelete || !currentUser) return;

        try {
            await deleteUser(userToDelete.id, currentUser.id);
            const updatedRestaurants = await getAllRestaurantsWithUsers();
            setAllRestaurants(updatedRestaurants);
            
            toast({ title: "Usuario Eliminado", description: `"${userToDelete.email}" ha sido eliminado.` });
        } catch (error: any) {
             console.error("Error al eliminar el usuario", error);
             toast({ variant: "destructive", title: "Error de Eliminación", description: error.message || "No se pudo eliminar el usuario." });
        } finally {
            setIsDeleteDialogOpen(false);
            setUserToDelete(null);
        }
    };

    const onSubmit = async (formData: UserFormValues) => {
        if (!currentUser || !activeRestaurantId) {
             toast({ variant: 'destructive', title: 'Error', description: 'Acción no permitida.' });
            return;
        };
        
        const targetRestaurantId = (currentUser.role === 'admin' ? currentUser.restaurantId : activeRestaurantId);

        if (targetRestaurantId === 'all') {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona un restaurante específico para añadir o editar un usuario.' });
            return;
        }

        if (currentUser.role === 'admin') {
            if (formData.role === 'superadmin' || formData.role === 'admin') {
                toast({ variant: 'destructive', title: 'Permiso Denegado', description: 'No puedes crear o asignar roles de administrador.' });
                return;
            }
            if (userToEdit && (userToEdit.role === 'superadmin' || userToEdit.role === 'admin')) {
                 toast({ variant: 'destructive', title: 'Permiso Denegado', description: 'No puedes editar un usuario administrador.' });
                 return;
            }
        }

        try {
            if (userToEdit) { // Edit
                await updateUser(userToEdit.id, formData);
                toast({ title: "Usuario Actualizado", description: "Los datos del usuario han sido actualizados." });
            } else { // Add
                await addUser({ ...formData, restaurantId: targetRestaurantId });
                toast({ title: "Usuario Añadido", description: `Se ha añadido a "${formData.email}".` });
            }
            
            const updatedRestaurants = await getAllRestaurantsWithUsers();
            setAllRestaurants(updatedRestaurants);

            setIsAddEditDialogOpen(false);
            setUserToEdit(null);
            
        } catch (error: any) {
             console.error("Error al guardar el usuario", error);
             toast({ variant: "destructive", title: "Error al Guardar", description: error.message || "No se pudo guardar los cambios. Inténtalo de nuevo."});
        }
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
            <div>
              <CardTitle>Gestión de Usuarios</CardTitle>
              <CardDescription>
                {currentUser?.role === 'superadmin' 
                    ? 'Añade, edita o elimina usuarios de cualquier restaurante.'
                    : 'Añade, edita o elimina usuarios de tu restaurante.'
                }
              </CardDescription>
            </div>
            <Button onClick={handleOpenAddDialog} disabled={activeRestaurantId === 'all' && currentUser?.role === 'superadmin'}>
              <PlusSquare className="mr-2 h-4 w-4" />
              Añadir Usuario
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                {currentUser?.role === 'superadmin' && <TableHead className="hidden md:table-cell">Restaurante</TableHead>}
                <TableHead className="text-center w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length > 0 ? (
                users.map(user => {
                    const config = roleConfig[user.role] || roleConfig.waiter;
                    const { label, icon: Icon, variant } = config;
                    const isCurrentUser = user.id === currentUser?.id;

                    const canEdit = currentUser?.role === 'superadmin' || 
                                    (currentUser?.role === 'admin' && user.role !== 'admin' && user.role !== 'superadmin');

                    return (
                        <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                                <Badge variant={variant}>
                                    <Icon className="mr-2 h-4 w-4" />
                                    {label}
                                </Badge>
                            </TableCell>
                            {currentUser?.role === 'superadmin' && <TableCell className="hidden md:table-cell">{user.restaurantName}</TableCell>}
                            <TableCell>
                                <div className="flex justify-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        onClick={() => handleOpenEditDialog(user)} 
                                        disabled={!canEdit}
                                        title={canEdit ? 'Editar usuario' : 'No tienes permiso para editar este usuario'}
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        onClick={() => handleOpenDeleteDialog(user)}
                                        disabled={isCurrentUser}
                                        title={isCurrentUser ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    )
                })
              ) : (
                <TableRow>
                    <TableCell colSpan={currentUser?.role === 'superadmin' ? 5 : 4} className="text-center h-24">No hay usuarios registrados.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isAddEditDialogOpen} onOpenChange={(isOpen) => {
          setIsAddEditDialogOpen(isOpen);
          if (!isOpen) {
              setUserToEdit(null);
          }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{userToEdit ? "Editar Usuario" : "Añadir Nuevo Usuario"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div>
              <Label htmlFor="name">Nombre del Usuario</Label>
              <Input id="name" {...form.register('name')} placeholder="Ej: Juan Pérez" className="mt-1" />
              {form.formState.errors.name && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="email">Email del Usuario</Label>
              <Input id="email" {...form.register('email')} type="email" placeholder="usuario@ejemplo.com" className="mt-1" />
              {form.formState.errors.email && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.email.message}</p>}
            </div>
             <div>
              <Label htmlFor="password">Contraseña</Label>
               <div className="relative">
                  <Input id="password" {...form.register('password')} type={showPassword ? "text" : "password"} placeholder="••••••••" className="mt-1 pr-10" />
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
              {form.formState.errors.password && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.password.message}</p>}
            </div>
            <div>
              <Label htmlFor="role">Rol</Label>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} disabled={userToEdit?.id === currentUser?.id || (currentUser?.role === 'admin' && (userToEdit?.role === 'admin' || userToEdit?.role === 'superadmin'))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentUser?.role === 'superadmin' && <SelectItem value="superadmin">Superadmin</SelectItem>}
                      <SelectItem value="admin" disabled={currentUser?.role === 'admin'}>Administrador</SelectItem>
                      <SelectItem value="seller">Vendedor</SelectItem>
                      <SelectItem value="waiter">Mesero</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.role && <p className="text-sm font-medium text-destructive mt-1">{form.formState.errors.role.message}</p>}
            </div>
            <DialogFooter className="pt-4">
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button type="submit">Guardar Cambios</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción no se puede deshacer. Esto eliminará permanentemente al usuario
                    "{userToDelete?.email}" del restaurante "{userToDelete?.restaurantName}".
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    