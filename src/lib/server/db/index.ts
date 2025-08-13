
'use server';

import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

// --- GESTIÓN DEL POOL DE CONEXIONES SINGLETON ---
// En un entorno sin servidor (como Vercel o Firebase Functions), cada invocación de una función
// puede ser un proceso completamente nuevo. Si creáramos una nueva conexión o un nuevo pool
// de conexiones cada vez, agotaríamos rápidamente el límite de la base de datos (error 'max_user_connections').

// Para solucionar esto, utilizamos un patrón "singleton". Almacenamos el pool de conexiones en una
// variable global (`global.db` y `pool`). De esta manera, la primera vez que se ejecute la función,
// creará el pool. En las siguientes ejecuciones, en lugar de crear uno nuevo, reutilizará el que
// ya existe en la variable global. Esto asegura que toda la aplicación comparta un único pool,
// siendo eficiente y evitando errores de conexión.

// Se declara una propiedad 'db' en el objeto global de TypeScript para poder adjuntarle nuestra instancia.
declare global {
  // rome-ignore lint/style/noVar: Se necesita 'var' para declarar una propiedad global.
  var db: MySql2Database<typeof schema> | undefined;
}

let pool: mysql.Pool;

/**
 * Obtiene una instancia del cliente de base de datos Drizzle.
 * Implementa un patrón singleton para reutilizar el pool de conexiones en las distintas
 * invocaciones de funciones sin servidor, previniendo errores de límite de conexiones.
 * @returns {Promise<MySql2Database<typeof schema>>} Una instancia de Drizzle conectada a la base de datos.
 */
export async function getDb(): Promise<MySql2Database<typeof schema>> {
  // Si ya existe una instancia de la base de datos en el objeto global, la reutilizamos.
  // Esto evita tener que crear una nueva conexión en cada llamada.
  if (global.db) {
    return global.db;
  }
  
  // Si la variable de entorno con la URL de la base de datos no está configurada, lanzamos un error.
  // Es crucial para el funcionamiento de la aplicación.
  if (!process.env.DATABASE_URL) {
    throw new Error('La variable de entorno DATABASE_URL no está configurada.');
  }
  
  // Si el pool de conexiones aún no ha sido creado, lo creamos.
  // Esto solo debería ocurrir en la primera invocación de la función.
  if (!pool) {
     try {
        pool = mysql.createPool({
            uri: process.env.DATABASE_URL,
            // PlanetScale recomienda un límite de 5-10 para entornos sin servidor.
            // Lo establecemos en 5 para coincidir con el límite de la cuenta actual.
            connectionLimit: 5, 
        });
     } catch (error: any) {
        // Este log ayuda a diagnosticar problemas de firewall o red en producción.
        console.error("Fallo al crear el pool de conexiones:", error);
        throw new Error(`Fallo al conectar a la base de datos. Razón: ${error.message}`);
     }
  }

  // Usamos el pool existente para crear la instancia de Drizzle.
  const db = drizzle(pool, { schema, mode: 'default' });
  // Guardamos la instancia de Drizzle en el objeto global para que las futuras
  // invocaciones de getDb() puedan reutilizarla.
  global.db = db;
  
  return db;
}
