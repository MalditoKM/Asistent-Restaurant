
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Restaurant, User } from '@/types';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { getAllRestaurantsWithUsers } from '@/lib/server/actions';

// Define el schema de validación para el formulario de login usando Zod.
// Zod asegura que los datos tengan el formato correcto antes de enviarlos.
const loginSchema = z.object({
  email: z.string().email('Por favor, introduce una dirección de correo electrónico válida.'),
  password: z.string().min(1, 'La contraseña es obligatoria.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;


export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  
  // Inicializa el hook `useForm` de React Hook Form.
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema), // Usa Zod para la validación.
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Esta función se ejecuta cuando el usuario envía el formulario.
  async function onSubmit(data: LoginFormValues) {
    try {
        // --- ACCESO DE EMERGENCIA PARA RECUPERACIÓN ---
        // Esta sección permite a un superadministrador acceder incluso si algo falla
        // con los datos de su restaurante específico. Es una puerta trasera de seguridad.
        if (data.email === 'superadmin@example.com' && data.password === 'password123') {
            const allRestaurants = await getAllRestaurantsWithUsers();
            
            // Busca cualquier usuario con el rol de 'superadmin' en todo el sistema.
            let superAdminUser: User | null = null;
            for (const restaurant of allRestaurants) {
                const found = restaurant.users.find(u => u.role === 'superadmin');
                if (found) {
                    superAdminUser = found;
                    break;
                }
            }
            
            if (superAdminUser) {
                toast({
                    title: 'Acceso de Recuperación',
                    description: `Has iniciado sesión como Superadmin.`,
                });
                // Guarda el usuario en la sesión y establece el restaurante activo a 'todos'.
                sessionStorage.setItem('loggedInUser', JSON.stringify(superAdminUser));
                sessionStorage.setItem('activeRestaurantId', 'all');
                router.push('/dashboard');
                return; // Termina la ejecución aquí.
            } else {
                 toast({
                    variant: 'destructive',
                    title: 'Error de Recuperación',
                    description: 'No se encontró una cuenta de superadministrador. Registra un restaurante para crear una.',
                });
                return;
            }
        }
        // --- FIN DEL ACCESO DE EMERGENCIA ---

        // Proceso de login normal.
        // 1. Obtiene todos los restaurantes y todos sus usuarios.
        const allRestaurants = await getAllRestaurantsWithUsers();
        
        let loggedInUser: User | null = null;
        let restaurantForUser: Restaurant | null = null;

        // 2. Itera sobre cada restaurante para encontrar al usuario.
        for (const restaurant of allRestaurants) {
            // Busca un usuario cuyo email coincida con el proporcionado.
            const foundUser = restaurant.users.find(u => u.email === data.email);
            if (foundUser) {
                // Si se encuentra el usuario, verifica si la contraseña coincide.
                if (foundUser.password === data.password) {
                    loggedInUser = foundUser;
                    restaurantForUser = restaurant;
                    break; // Si se encuentra, no es necesario seguir buscando.
                }
            }
        }

        // 3. Si se encontraron un usuario y un restaurante válidos...
        if (loggedInUser && restaurantForUser) {
            toast({
                title: 'Inicio de Sesión Exitoso',
                description: `¡Bienvenido de nuevo, ${loggedInUser.name || loggedInUser.email}!`,
            });

            // 4. Guarda los datos del usuario en la sesión del navegador.
            sessionStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
            
            // 5. Determina qué restaurante establecer como activo.
            // Si es superadmin, se le da acceso a 'todos'. De lo contrario, a su restaurante específico.
            const restaurantIdToSet = loggedInUser.role === 'superadmin' ? 'all' : restaurantForUser.id;
            sessionStorage.setItem('activeRestaurantId', restaurantIdToSet);

            // 6. Redirige al usuario al dashboard.
            router.push('/dashboard');
        } else {
            // Si no se encontró el usuario o la contraseña era incorrecta.
            toast({
                variant: 'destructive',
                title: 'Fallo de Inicio de Sesión',
                description: 'Email o contraseña no válidos. Por favor, inténtalo de nuevo.',
            });
        }
    } catch (error: any) {
        // Maneja errores inesperados, como problemas de conexión a la base de datos.
        console.error("Error en el inicio de sesión:", error);
        toast({
            variant: 'destructive',
            title: 'Error del Servidor',
            description: error.message || 'No se pudo conectar a la base de datos. Por favor, inténtalo de nuevo más tarde.',
        });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email del Usuario</FormLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <FormControl>
                    <Input type="email" placeholder="usuario@ejemplo.com" {...field} className="pl-10" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contraseña</FormLabel>
                 <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <FormControl>
                    <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...field} className="pl-10 pr-10" />
                  </FormControl>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="sr-only">{showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</span>
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
        </Button>
      </form>
    </Form>
  );
}
