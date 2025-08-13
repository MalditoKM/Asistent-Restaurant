
'use server';

import { getDb } from './db';
import { restaurants, users, products, categories, customers, sales, purchases } from './db/schema';
import { eq, and, inArray, not, count } from 'drizzle-orm';
import type { Restaurant, User, Product, Category, Customer, Purchase, Sale, OrderItem } from '@/types';

// =================================================================
// ACCIONES DE RESTAURANTES (RESTAURANT ACTIONS)
// Estas funciones gestionan los datos principales de los restaurantes.
// =================================================================

/**
 * Obtiene todos los restaurantes junto con los usuarios asociados a cada uno.
 * Es una función clave para el superadministrador y para la carga inicial de datos.
 * @returns {Promise<Restaurant[]>} Un array de objetos de restaurante.
 */
export async function getAllRestaurantsWithUsers(): Promise<Restaurant[]> {
    // 1. Obtiene la conexión a la base de datos.
    const db = await getDb();
    // 2. Realiza una consulta a la tabla 'restaurants' y, gracias a las relaciones definidas
    //    en el schema, le pide que también traiga los 'users' relacionados.
    const result = await db.query.restaurants.findMany({
        with: {
            users: true // Esto carga automáticamente los usuarios de cada restaurante.
        }
    });
    // 3. Devuelve el resultado casteado al tipo esperado.
    return result as Restaurant[];
}

/**
 * Obtiene un restaurante específico por su ID.
 * @param {string} id - El ID del restaurante a buscar.
 * @returns {Promise<Restaurant | null>} El objeto del restaurante o null si no se encuentra.
 */
export async function getRestaurantById(id: string): Promise<Restaurant | null> {
    const db = await getDb();
    const result = await db.query.restaurants.findFirst({
        where: eq(restaurants.id, id), // Condición: donde el ID de la tabla sea igual al ID proporcionado.
    });
    return (result as Restaurant) || null;
}

/**
 * Crea un nuevo restaurante y su usuario administrador inicial.
 * Esta operación se realiza dentro de una transacción para garantizar la atomicidad:
 * o se crean ambos (restaurante y usuario), o no se crea ninguno.
 * @param {Omit<Restaurant, 'id' | 'users'>} restaurantData - Datos del restaurante.
 * @param {Omit<User, 'id' | 'role'>} adminData - Datos del usuario administrador.
 * @returns {Promise<{ id: string }>} El ID del nuevo restaurante.
 */
export async function createRestaurant(restaurantData: Omit<Restaurant, 'id' | 'users'>, adminData: Omit<User, 'id' | 'role'>) {
    const db = await getDb();
    
    // Verificación previa: Comprueba si el correo electrónico del administrador ya existe en el sistema.
    const existingUser = await db.select({ value: count() }).from(users).where(eq(users.email, adminData.email));
    if (existingUser[0].value > 0) {
        throw new Error('El correo electrónico ya está en uso por otro usuario en el sistema.');
    }
    
    // Comprueba si este será el primer restaurante en registrarse.
    const existingRestaurantsCount = await db.select({ value: count() }).from(restaurants);
    const isFirstRestaurant = existingRestaurantsCount[0].value === 0;

    // Inicia una transacción. Todo lo que está dentro de esta función se ejecuta como un solo bloque.
    return await db.transaction(async (tx) => {
        // 1. Crea un ID único para el restaurante.
        const restaurantId = crypto.randomUUID();
        // 2. Inserta el nuevo restaurante en la base de datos.
        await tx.insert(restaurants).values({ ...restaurantData, id: restaurantId });
        
        // 3. Inserta el nuevo usuario, asignándole el rol de 'superadmin' si es el primer
        //    restaurante, o 'admin' en caso contrario.
        await tx.insert(users).values({
            ...adminData,
            id: crypto.randomUUID(),
            role: isFirstRestaurant ? 'superadmin' : 'admin',
            restaurantId: restaurantId,
        });
        
        // 4. Si todo ha ido bien, la transacción se confirma y se devuelve el ID.
        return { id: restaurantId };
    });
}

/**
 * Actualiza los datos de un restaurante y/o su administrador.
 * Se utiliza una transacción para asegurar que todas las actualizaciones se realicen correctamente.
 * @param {string} id - El ID del restaurante a actualizar.
 * @param {Partial<Omit<Restaurant, 'id' | 'users'>>} restaurantData - Nuevos datos del restaurante.
 * @param {object} [adminData] - Nuevos datos del administrador (opcional).
 * @returns {Promise<Restaurant>} El objeto del restaurante actualizado.
 */
export async function updateRestaurant(id: string, restaurantData: Partial<Omit<Restaurant, 'id' | 'users'>>, adminData?: {id: string, email: string, password?: string}) {
    const db = await getDb();
    return await db.transaction(async (tx) => {
        // Actualiza los datos del restaurante si se proporcionaron.
        if (Object.keys(restaurantData).length > 0) {
            await tx.update(restaurants).set(restaurantData).where(eq(restaurants.id, id));
        }
        // Actualiza los datos del usuario administrador si se proporcionaron.
        if (adminData && adminData.id) {
            // Verifica que el nuevo email no esté en uso por OTRO usuario.
            const otherUserWithEmail = await tx.query.users.findFirst({
                where: and(eq(users.email, adminData.email), not(eq(users.id, adminData.id)))
            });

            if (otherUserWithEmail) {
                 throw new Error("El correo electrónico ya está registrado por otro usuario.");
            }

            const updateData: { email: string; password?: string } = { email: adminData.email };
            if (adminData.password && adminData.password.length >= 6) {
                updateData.password = adminData.password;
            }
            await tx.update(users).set(updateData).where(eq(users.id, adminData.id));
        }

        // Devuelve el restaurante actualizado con sus usuarios.
        const updatedRestaurant = await tx.query.restaurants.findFirst({
            where: eq(restaurants.id, id),
            with: { users: true }
        });
        return updatedRestaurant as Restaurant;
    });
}

/**
 * Elimina un restaurante. Gracias a la configuración `onDelete: 'cascade'` en el schema,
 * todos los datos asociados (usuarios, productos, ventas, etc.) se eliminarán automáticamente.
 * @param {string} id - El ID del restaurante a eliminar.
 */
export async function deleteRestaurant(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(restaurants).where(eq(restaurants.id, id));
}


// =================================================================
// ACCIONES DE USUARIOS (USER ACTIONS)
// =================================================================
export async function addUser(userData: Omit<User, 'id'> & { restaurantId: string }): Promise<User> {
    const db = await getDb();
    const existingUser = await db.select({ value: count() }).from(users).where(eq(users.email, userData.email));
    if(existingUser[0].value > 0) {
        throw new Error("El correo electrónico ya está en uso en el sistema.");
    }
    const newUser = { ...userData, id: crypto.randomUUID() };
    await db.insert(users).values(newUser);
    return newUser as User;
}

export async function updateUser(id: string, userData: Partial<Omit<User, 'id'>>): Promise<User> {
    const db = await getDb();
    if(userData.email) {
        const otherUserWithEmail = await db.query.users.findFirst({
            where: and(eq(users.email, userData.email), not(eq(users.id, id)))
        });
        if(otherUserWithEmail) {
            throw new Error("El correo electrónico ya está en uso por otro usuario en el sistema.");
        }
    }
    await db.update(users).set(userData).where(eq(users.id, id));
    const updatedUser = await db.query.users.findFirst({ where: eq(users.id, id) });
    return updatedUser as User;
}

export async function deleteUser(id: string, currentUserId: string): Promise<void> {
    const db = await getDb();

    if (id === currentUserId) {
        throw new Error('No puedes eliminar tu propia cuenta de usuario.');
    }

    const userToDelete = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!userToDelete) {
        throw new Error('El usuario que intentas eliminar no existe.');
    }
    
    const currentUser = await db.query.users.findFirst({ where: eq(users.id, currentUserId) });

    // Superadmin can delete anyone except the last superadmin
    if (currentUser?.role === 'superadmin') {
        if (userToDelete.role === 'superadmin') {
            const superadminCountResult = await db.select({ value: count() }).from(users).where(eq(users.role, 'superadmin'));
            const superadminCount = superadminCountResult[0].value;
            if (superadminCount <= 1) {
                throw new Error('No se puede eliminar al único superadministrador del sistema.');
            }
        }
    } else if (currentUser?.role === 'admin') {
        // Admin can't delete superadmins or other admins
        if (userToDelete.role === 'admin' || userToDelete.role === 'superadmin') {
            throw new Error('No tienes permisos para eliminar a un administrador.');
        }
        // Check if this is the last user in the restaurant
        const usersInRestaurantResult = await db.select({ value: count() }).from(users).where(eq(users.restaurantId, userToDelete.restaurantId));
        const usersInRestaurantCount = usersInRestaurantResult[0].value;
        if (usersInRestaurantCount <= 1) {
            throw new Error('No se puede eliminar al único usuario de un restaurante. Elimina el restaurante en su lugar.');
        }
    } else {
        // Other roles can't delete users
        throw new Error('No tienes permisos para eliminar usuarios.');
    }


    await db.delete(users).where(eq(users.id, id));
}


// =================================================================
// ACCIONES DE PRODUCTOS (PRODUCT ACTIONS)
// =================================================================
export async function getProductsForRestaurant(restaurantId: string): Promise<Product[]> {
    const db = await getDb();
    // Si el ID es 'all', el superadministrador quiere ver los productos de todos los restaurantes.
    if (restaurantId === 'all') {
        return (await db.select().from(products)) as Product[];
    }
    // Si no, filtra los productos por el ID del restaurante activo.
    return (await db.query.products.findMany({ where: eq(products.restaurantId, restaurantId) })) as Product[];
}

export async function addProduct(product: Omit<Product, 'id'>): Promise<Product> {
    const db = await getDb();
    const newProduct = { ...product, id: crypto.randomUUID() };
    await db.insert(products).values(newProduct);
    return newProduct as Product;
}

export async function updateProduct(id: string, product: Partial<Omit<Product, 'id' | 'restaurantId'>>): Promise<Product> {
    const db = await getDb();
    await db.update(products).set(product).where(eq(products.id, id));
    const updatedProduct = await db.query.products.findFirst({ where: eq(products.id, id) });
    return updatedProduct as Product;
}

export async function deleteProduct(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(products).where(eq(products.id, id));
}

// =================================================================
// ACCIONES DE CATEGORÍAS (CATEGORY ACTIONS)
// =================================================================
export async function getCategoriesForRestaurant(restaurantId: string): Promise<Category[]> {
    const db = await getDb();
    if (restaurantId === 'all') {
        return await db.select().from(categories);
    }
    return await db.query.categories.findMany({ where: eq(categories.restaurantId, restaurantId) });
}

export async function addCategory(category: Omit<Category, 'id'>): Promise<Category> {
    const db = await getDb();
    const newCategory = { ...category, id: crypto.randomUUID() };
    await db.insert(categories).values(newCategory);
    return newCategory;
}

export async function updateCategory(id: string, category: Partial<Omit<Category, 'id' | 'restaurantId'>>): Promise<Category> {
    const db = await getDb();
    await db.update(categories).set(category).where(eq(categories.id, id));
    const updatedCategory = await db.query.categories.findFirst({ where: eq(categories.id, id) });
    return updatedCategory as Category;
}

export async function deleteCategory(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(categories).where(eq(categories.id, id));
}

// =================================================================
// ACCIONES DE CLIENTES (CUSTOMER ACTIONS)
// =================================================================
export async function getCustomersForRestaurant(restaurantId: string): Promise<Customer[]> {
    const db = await getDb();
    if (restaurantId === 'all') {
        return await db.select().from(customers);
    }
    return await db.query.customers.findMany({ where: eq(customers.restaurantId, restaurantId) });
}

export async function addCustomer(customer: Omit<Customer, 'id'>): Promise<Customer> {
    const db = await getDb();
    const newCustomer = { ...customer, id: crypto.randomUUID() };
    await db.insert(customers).values(newCustomer);
    return newCustomer;
}

export async function updateCustomer(id: string, customer: Partial<Omit<Customer, 'id' | 'restaurantId'>>): Promise<Customer> {
    const db = await getDb();
    await db.update(customers).set(customer).where(eq(customers.id, id));
    const updatedCustomer = await db.query.customers.findFirst({ where: eq(customers.id, id) });
    return updatedCustomer as Customer;
}

export async function deleteCustomer(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(customers).where(eq(customers.id, id));
}

// =================================================================
// ACCIONES DE COMPRAS (PURCHASE ACTIONS)
// =================================================================
export async function getPurchasesForRestaurant(restaurantId: string): Promise<Purchase[]> {
    const db = await getDb();
    if (restaurantId === 'all') {
        const result = await db.select().from(purchases);
        // El precio se guarda como string en la DB, lo convertimos a número.
        return result.map(p => ({...p, unitPrice: Number(p.unitPrice)}));
    }
    const result = await db.query.purchases.findMany({ where: eq(purchases.restaurantId, restaurantId) });
    return result.map(p => ({...p, unitPrice: Number(p.unitPrice)}));
}

export async function addPurchase(purchase: Omit<Purchase, 'id'>): Promise<Purchase> {
    const db = await getDb();
    const newPurchase = { ...purchase, id: crypto.randomUUID() };
    await db.insert(purchases).values(newPurchase);
    return { ...newPurchase, unitPrice: Number(newPurchase.unitPrice) };
}

export async function updatePurchase(id: string, purchase: Partial<Omit<Purchase, 'id' | 'restaurantId'>>): Promise<Purchase> {
    const db = await getDb();
    await db.update(purchases).set(purchase).where(eq(purchases.id, id));
    const updatedPurchase = await db.query.purchases.findFirst({ where: eq(purchases.id, id) });
    return { ...updatedPurchase, unitPrice: Number(updatedPurchase!.unitPrice) } as Purchase;
}

export async function deletePurchase(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(purchases).where(eq(purchases.id, id));
}


// =================================================================
// ACCIONES DE VENTAS (SALE ACTIONS)
// =================================================================
export async function getSalesForRestaurant(restaurantId: string): Promise<Sale[]> {
    const db = await getDb();
    const query = restaurantId === 'all'
        ? db.select().from(sales)
        : db.query.sales.findMany({ where: eq(sales.restaurantId, restaurantId) });
    const allSales = await query;
    // El campo 'items' es un JSON en la DB. Lo parseamos al tipo correcto.
    return allSales.map(s => ({ ...s, items: s.items as OrderItem[], totalPrice: Number(s.totalPrice) }));
}

export async function getSaleById(id: string): Promise<Sale | null> {
    const db = await getDb();
    const result = await db.query.sales.findFirst({ where: eq(sales.id, id) });
    if (!result) return null;
    return { ...result, items: result.items as OrderItem[], totalPrice: Number(result.totalPrice) };
}

export async function addSale(sale: Omit<Sale, 'id'>): Promise<Sale> {
    const db = await getDb();
    const newSale = { ...sale, id: crypto.randomUUID() };
    await db.insert(sales).values(newSale);
    return { ...newSale, items: newSale.items as OrderItem[], totalPrice: Number(newSale.totalPrice) };
}

export async function updateSale(id: string, sale: Partial<Omit<Sale, 'id' | 'restaurantId'>>): Promise<Sale> {
    const db = await getDb();
    await db.update(sales).set(sale).where(eq(sales.id, id));
    const updatedSale = await db.query.sales.findFirst({ where: eq(sales.id, id) });
    return { ...updatedSale, items: updatedSale!.items as OrderItem[], totalPrice: Number(updatedSale!.totalPrice) } as Sale;
}

export async function updateSaleStatus(id: string, status: 'paid' | 'pending'): Promise<Sale> {
    const db = await getDb();
    await db.update(sales).set({ status }).where(eq(sales.id, id));
    const updatedSale = await db.query.sales.findFirst({ where: eq(sales.id, id) });
    return { ...updatedSale, items: updatedSale!.items as OrderItem[], totalPrice: Number(updatedSale!.totalPrice) } as Sale;
}

/**
 * Elimina una o varias ventas de forma masiva.
 * @param {string[]} ids - Un array de IDs de las ventas a eliminar.
 */
export async function deleteSales(ids: string[]): Promise<void> {
    const db = await getDb();
    if (ids.length === 0) return;
    // 'inArray' es una forma eficiente de hacer un 'DELETE WHERE id IN (...)'.
    await db.delete(sales).where(inArray(sales.id, ids));
}
