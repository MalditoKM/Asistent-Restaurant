
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Building, Phone, Mail, Lock, Eye, EyeOff, MapPin, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createRestaurant } from '@/lib/server/actions';

// Define el schema de validación para el formulario de registro usando Zod.
// Se asegura de que todos los campos necesarios estén presentes y tengan el formato correcto.
const registrationSchema = z.object({
  restaurantName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  address: z.string().min(5, 'La dirección debe tener al menos 5 caracteres.'),
  phone: z.string().min(7, 'Por favor, introduce un número de teléfono válido.'),
  adminName: z.string().min(2, 'El nombre del administrador es obligatorio.'),
  email: z.string().email('Por favor, introduce una dirección de correo electrónico válida.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
});

type RegistrationFormValues = z.infer<typeof registrationSchema>;


export function RegistrationForm() {
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  
  // Inicializa el hook `useForm` de React Hook Form.
  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema), // Usa Zod para la validación.
    defaultValues: {
      restaurantName: '',
      address: '',
      phone: '',
      adminName: '',
      email: '',
      password: '',
    },
  });

  // Esta función se ejecuta cuando el usuario envía el formulario de registro.
  async function handleRegistration(formData: RegistrationFormValues) {
     try {
        // 1. Llama a la acción del servidor `createRestaurant`, pasándole los datos del
        //    restaurante y del usuario administrador.
        await createRestaurant({
            name: formData.restaurantName,
            address: formData.address,
            phone: formData.phone,
        }, {
            name: formData.adminName,
            email: formData.email,
            password: formData.password,
        });

        // 2. Si la creación es exitosa, muestra una notificación de éxito.
        toast({
            title: 'Registro Exitoso',
            description: `El restaurante "${formData.restaurantName}" ha sido creado. Inicia sesión.`,
        });
        
        // 3. Espera un breve momento para que el usuario pueda ver la notificación.
        setTimeout(() => {
            // 4. Recarga la página. Esto limpia el formulario y cambia a la pestaña de
            //    inicio de sesión, listo para que el usuario ingrese.
            window.location.reload();
        }, 1500);

    } catch (error: any) {
        // 5. Si ocurre un error durante la creación (p. ej., el email ya existe),
        //    se captura aquí.
        console.error("Error en el registro:", error);
        // Muestra una notificación de error con el mensaje devuelto por el servidor.
        toast({
            variant: 'destructive',
            title: 'Error en el Registro',
            description: error.message || 'No se pudo crear el restaurante. Por favor, inténtalo de nuevo.',
        });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleRegistration)} className="space-y-6">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="restaurantName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del Restaurante</FormLabel>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <FormControl>
                    <Input placeholder="ej., La Hoja Verde" {...field} className="pl-10" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dirección</FormLabel>
                 <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <FormControl>
                    <Input placeholder="Calle Principal 123" {...field} className="pl-10" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número de Teléfono</FormLabel>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <FormControl>
                    <Input placeholder="(123) 456-7890" {...field} className="pl-10" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <hr />
           <FormField
            control={form.control}
            name="adminName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del Administrador</FormLabel>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <FormControl>
                    <Input placeholder="Ej: Juan Pérez" {...field} className="pl-10" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email del Administrador</FormLabel>
                 <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <FormControl>
                    <Input type="email" placeholder="admin@ejemplo.com" {...field} className="pl-10" />
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
                    <Input type={showPassword ? 'text' : 'password'} placeholder="Crea una contraseña segura" {...field} className="pl-10 pr-10" />
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
        <p className="text-xs text-muted-foreground text-center">
            Al registrarte, se creará un nuevo restaurante con un usuario administrador. Los datos se guardarán en una base de datos en la nube.
        </p>
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
           {form.formState.isSubmitting ? 'Registrando...' : 'Registrar Restaurante'}
        </Button>
      </form>
    </Form>
  );
}
