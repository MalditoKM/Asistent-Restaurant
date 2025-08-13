-- Habilitar la extensión pgcrypto para el cifrado de contraseñas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabla para Restaurantes
CREATE TABLE restaurants (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50)
);

-- Tabla para Usuarios
-- Las contraseñas se cifrarán automáticamente mediante un disparador antes de la inserción.
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    "password" TEXT NOT NULL, -- La contraseña se almacenará como un hash seguro
    "role" VARCHAR(50) NOT NULL CHECK ("role" IN ('superadmin', 'admin', 'seller', 'waiter')),
    restaurant_id VARCHAR(255) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE(email, restaurant_id)
);

-- Tabla para Categorías de Productos
CREATE TABLE categories (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    restaurant_id VARCHAR(255) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- Tabla para Productos
CREATE TABLE products (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    category_id VARCHAR(255) REFERENCES categories(id) ON DELETE SET NULL,
    restaurant_id VARCHAR(255) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- Tabla para Clientes
CREATE TABLE customers (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    restaurant_id VARCHAR(255) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- Tabla para Compras de Inventario
CREATE TABLE purchases (
    id VARCHAR(255) PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    supplier TEXT,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    purchase_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    restaurant_id VARCHAR(255) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- Tabla para Ventas
CREATE TABLE sales (
    id VARCHAR(255) PRIMARY KEY,
    customer_name VARCHAR(255),
    table_number VARCHAR(50),
    total_price NUMERIC(10, 2) NOT NULL,
    sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('paid', 'pending')),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    restaurant_id VARCHAR(255) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- Tabla para los Items de una Venta (tabla de unión)
CREATE TABLE sale_items (
    id VARCHAR(255) PRIMARY KEY,
    sale_id VARCHAR(255) REFERENCES sales(id) ON DELETE CASCADE,
    product_id VARCHAR(255) REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    price_at_sale NUMERIC(10, 2) NOT NULL
);


-- --- TRIGGERS Y FUNCIONES DE SEGURIDAD ---

-- Función de trigger para cifrar la contraseña del usuario antes de guardarla
CREATE OR REPLACE FUNCTION hash_user_password()
RETURNS TRIGGER AS $$
BEGIN
    -- Cifra la nueva contraseña usando bcrypt, un método muy seguro.
    -- El segundo argumento (8) es el factor de coste; un valor más alto es más seguro pero más lento.
    NEW."password" := crypt(NEW.password, gen_salt('bf', 8));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Asigna el trigger a la tabla de usuarios. Se ejecutará antes de cada INSERT o UPDATE.
CREATE TRIGGER trigger_hash_user_password
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION hash_user_password();


-- Función de trigger para prevenir la eliminación del último superadministrador
CREATE OR REPLACE FUNCTION prevent_last_superadmin_delete()
RETURNS TRIGGER AS $$
DECLARE
    superadmin_count INTEGER;
BEGIN
    -- Contar cuántos superadministradores quedan.
    SELECT COUNT(*) INTO superadmin_count FROM users WHERE "role" = 'superadmin';

    -- Si se está eliminando un superadministrador y es el último, lanzar un error.
    IF OLD."role" = 'superadmin' AND superadmin_count <= 1 THEN
        RAISE EXCEPTION 'No se puede eliminar al último superadministrador del sistema.';
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Asigna el trigger a la tabla de usuarios. Se ejecutará antes de cada DELETE.
CREATE TRIGGER trigger_prevent_last_superadmin_delete
BEFORE DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_last_superadmin_delete();


-- --- DATOS DE EJEMPLO (opcional, para desarrollo) ---

-- Insertar un restaurante de ejemplo
INSERT INTO restaurants (id, name, address, phone) VALUES
('marisqueria-el-puerto-1', 'Marisquería El Puerto', 'Avenida del Mar, 123', '912 345 678');

-- Insertar usuarios de ejemplo. La contraseña 'password123' será cifrada por el trigger.
INSERT INTO users (id, email, "password", "role", restaurant_id) VALUES
('superadmin-user-1', 'superadmin@example.com', 'password123', 'superadmin', 'marisqueria-el-puerto-1'),
('admin-user-1', 'admin@example.com', 'password123', 'admin', 'marisqueria-el-puerto-1'),
('seller-user-1', 'vendedor@example.com', 'password123', 'seller', 'marisqueria-el-puerto-1'),
('waiter-user-1', 'mesero@example.com', 'password123', 'waiter', 'marisqueria-el-puerto-1');

-- La función crypt() se usaría así para verificar una contraseña en una consulta de login:
-- SELECT * FROM users WHERE email = 'test@example.com' AND password = crypt('contraseña_ingresada', password);
