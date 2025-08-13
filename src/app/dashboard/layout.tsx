
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart,
  BookMarked,
  History,
  LogOut,
  Menu,
  ShieldAlert,
  ShoppingBasket,
  ShoppingCart,
  Tag,
  Users,
  UsersRound,
  UtensilsCrossed,
  Package,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Restaurant, User } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { InstallPwaButton } from '@/components/common/install-pwa-button';
import { getAllRestaurantsWithUsers } from '@/lib/server/actions';

// --- GESTIÓN DE LA SESIÓN Y EL CONTEXTO DEL DASHBOARD ---
// Este componente Layout es el corazón del área de administración. Se encarga de varias tareas críticas:
// 1. Proteger las rutas: Verifica si hay un usuario en `sessionStorage`. Si no lo hay, redirige al inicio.
// 2. Cargar datos globales: Obtiene la lista de todos los restaurantes para el selector del superadmin.
// 3. Establecer el contexto: Determina qué restaurante está activo (`activeRestaurantId`) y guarda
//    esta información para que todas las páginas hijas (Informes, Menú, etc.) sepan qué datos deben mostrar.
// 4. Renderizar la navegación: Muestra los enlaces de navegación adecuados según el rol del usuario.

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Estado para almacenar todos los restaurantes (usado por el superadmin).
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // El ID del restaurante que está actualmente seleccionado. Puede ser 'all' para el superadmin.
  const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null);

  // Estado para el usuario que ha iniciado sesión.
  const [user, setUser] = useState<User | null>(null);
  // `isHydrated` es un truco para evitar errores de hidratación de React.
  // Nos asegura que el código que accede a `sessionStorage` solo se ejecute en el cliente.
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);


  useEffect(() => {
    // Este efecto se ejecuta solo una vez en el lado del cliente.
    let userData: string | null = null;
    try {
      // 1. Intenta obtener los datos del usuario de la sesión del navegador.
      userData = sessionStorage.getItem('loggedInUser');
    } catch (e) {
      console.error("No se pudo acceder a sessionStorage:", e);
      router.replace('/'); // Si falla, redirige por seguridad.
      return;
    }

    // 2. Si no hay datos del usuario, no está autenticado. Se redirige al inicio.
    if (!userData) {
      router.replace('/');
      return;
    }
    
    // 3. Si hay datos, se parsean y se guardan en el estado.
    const currentUser = JSON.parse(userData) as User;
    setUser(currentUser);
    
    // 4. Se establece el restaurante activo.
    // Si es superadmin, puede ver 'todos' o uno específico. Se mira si hay algo guardado.
    // Si es otro rol, se carga el restaurante al que pertenece.
    const loggedInRestaurant = sessionStorage.getItem('loggedInRestaurant');
    if (currentUser.role === 'superadmin') {
      const savedRestaurantId = sessionStorage.getItem('activeRestaurantId');
      setActiveRestaurantId(savedRestaurantId || 'all');
    } else if (loggedInRestaurant) {
      setActiveRestaurantId(loggedInRestaurant);
    }
    
    // 5. Marca el componente como "hidratado", permitiendo el renderizado final.
    setIsHydrated(true);

  }, [router]);

  useEffect(() => {
    // Carga los datos de todos los restaurantes una vez que el usuario está autenticado.
    async function fetchData() {
      setIsLoading(true);
      const data = await getAllRestaurantsWithUsers();
      setAllRestaurants(data);
      setIsLoading(false);
    }
    fetchData();
  }, []);
  
  // `useMemo` optimiza el rendimiento. Esta función solo se recalcula si sus dependencias cambian.
  // Determina el nombre del restaurante actual que se muestra en la cabecera.
  const currentRestaurant = useMemo(() => {
    if (user?.role === 'superadmin' && activeRestaurantId === 'all') {
      return { id: 'all', name: 'Todos los Restaurantes' };
    }
    if (!allRestaurants || !activeRestaurantId) return null;
    return allRestaurants.find(r => r.id === activeRestaurantId);
  }, [allRestaurants, activeRestaurantId, user]);


  const handleLogout = () => {
    try {
      // Limpia todos los datos de sesión al cerrar sesión.
      sessionStorage.removeItem('loggedInRestaurant');
      sessionStorage.removeItem('loggedInUser');
      sessionStorage.removeItem('activeRestaurantId');
    } catch(e) {
      console.error("No se pudo limpiar sessionStorage:", e);
    }
    router.replace('/');
  };
  
  // Cuando el superadmin cambia de restaurante en el selector.
  const handleRestaurantChange = (newId: string) => {
    if (!newId || newId === activeRestaurantId) return;
    setActiveRestaurantId(newId);
    sessionStorage.setItem('activeRestaurantId', newId);
    // Se recarga la página completa. Esto asegura que todos los componentes
    // obtengan los datos frescos para el nuevo contexto del restaurante.
    window.location.reload();
  };

  // `useMemo` para generar la lista de enlaces de navegación.
  // La lista se filtra según el rol del usuario actual.
  const menuItems = useMemo(() => {
    if (!user) return [];

    const allItems = [
      { href: '/dashboard/informes', label: 'Informes', icon: BarChart, roles: ['superadmin', 'admin', 'seller'] },
      { href: '/dashboard/comidas', label: 'Comanda', icon: ShoppingBasket, roles: ['superadmin', 'admin', 'seller', 'waiter'] },
      { href: '/dashboard/historial-ventas', label: 'Historial', icon: History, roles: ['superadmin', 'admin', 'seller', 'waiter'] },
      { href: '/dashboard/menu', label: 'Menú', icon: BookMarked, roles: ['superadmin', 'admin', 'seller', 'waiter'] },
      { href: '/dashboard/categorias', label: 'Categorías', icon: Tag, roles: ['superadmin', 'admin'] },
      { href: '/dashboard/stock', label: 'Stock', icon: Package, roles: ['superadmin', 'admin', 'seller'] },
      { href: '/dashboard/compras', label: 'Compras', icon: ShoppingCart, roles: ['superadmin', 'admin', 'seller'] },
      { href: '/dashboard/clientes', label: 'Clientes', icon: Users, roles: ['superadmin', 'admin', 'seller'] },
      { href: '/dashboard/usuarios', label: 'Usuarios', icon: UsersRound, roles: ['superadmin', 'admin'] },
      { href: '/dashboard/superadmin', label: 'Super Admin', icon: ShieldAlert, roles: ['superadmin'] },
    ];
    
    return allItems.filter(item => item.roles.includes(user.role));
  }, [user]);

  // Componente interno para renderizar los enlaces, reutilizado para móvil y escritorio.
  const NavLinks = ({isMobile = false} : {isMobile?: boolean}) => (
    <>
      {menuItems.map((item) => (
         <Button asChild key={item.href} variant={pathname.startsWith(item.href) ? "secondary" : "ghost"} size="sm" className={cn(
            isMobile ? "w-full justify-start text-base gap-4 p-4 h-auto" : "h-9",
            item.href === '/dashboard/superadmin' && (pathname.startsWith(item.href) ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'text-destructive/80 hover:bg-destructive/10 hover:text-destructive'),
          )}
          onClick={() => isMobile && setIsSheetOpen(false)}
          >
          <Link href={item.href}>
            <item.icon className="mr-2 h-4 w-4" />
            {item.label}
          </Link>
        </Button>
      ))}
    </>
  );

  return (
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <header className="sticky top-0 z-30 border-b bg-card">
          <div className="flex h-16 items-center justify-between px-4 md:px-6">
              <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                  <UtensilsCrossed className="h-6 w-6 text-primary" />
                  <span className="hidden text-lg sm:inline-block">{isHydrated && currentRestaurant ? currentRestaurant.name : <Skeleton className="h-6 w-32" />}</span>
              </Link>

              <div className="flex items-center gap-2">
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                  <SheetTrigger asChild>
                      <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                      <Menu className="h-5 w-5" />
                      <span className="sr-only">Toggle navigation menu</span>
                      </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="flex flex-col p-0">
                      <div className="p-4 border-b">
                          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-xl" onClick={() => setIsSheetOpen(false)}>
                            <UtensilsCrossed className="h-7 w-7 text-primary" />
                            <span>{isHydrated && currentRestaurant ? currentRestaurant.name : <Skeleton className="h-7 w-36" />}</span>
                          </Link>
                      </div>
                      <nav className="grid gap-2 text-lg font-medium p-4">
                        {isHydrated && user ? <NavLinks isMobile /> : Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />) }
                      </nav>
                  </SheetContent>
                </Sheet>
                
                <InstallPwaButton />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <Avatar className="size-9">
                        <AvatarFallback>{isHydrated && user ? (user.name || user.email).charAt(0).toUpperCase() : '?'}</AvatarFallback>
                      </Avatar>
                      <span className="sr-only">Toggle user menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                      {isHydrated && user ? (
                        <>
                          <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                              <p className="text-sm font-medium leading-none">{user.name || user.email}</p>
                              <p className="text-xs leading-none text-muted-foreground capitalize">{user.role}</p>
                            </div>
                          </DropdownMenuLabel>
                        </>
                      ) : (
                        <div className="p-2 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Cerrar Sesión</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
          </div>
          
          <nav className="hidden border-t bg-card/95 px-4 md:flex md:items-center md:justify-between md:px-6">
              <div className="flex flex-wrap items-center gap-2 py-2">
                  {isHydrated && user ? <NavLinks /> : Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-9 w-32" />) }
              </div>
               {isHydrated && user?.role === 'superadmin' && allRestaurants.length > 0 && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="restaurant-select" className="text-sm font-medium">
                    Viendo:
                  </Label>
                  <Select
                    value={activeRestaurantId ?? ''}
                    onValueChange={handleRestaurantChange}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="restaurant-select" className="w-[220px] h-9">
                      <SelectValue placeholder="Selecciona un restaurante" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los Restaurantes</SelectItem>
                      {allRestaurants.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
          </nav>
        </header>

        <main key={activeRestaurantId} className="flex-1 p-4 sm:p-6">
          {/* Muestra un esqueleto de carga hasta que el usuario y los datos estén listos. */}
          {(isHydrated && !isLoading) ? children : <DashboardSkeleton />}
        </main>
      </div>
  );
}

// Componente simple para mostrar mientras cargan los datos iniciales.
const DashboardSkeleton = () => (
  <div className="space-y-6">
    <Skeleton className="h-96 w-full" />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  </div>
);
