
import { mysqlTable, varchar, decimal, int, timestamp, json, text, mysqlEnum } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

const prefix = 'restaurante_simple';

export const restaurants = mysqlTable(`${prefix}_restaurants`, {
    id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    address: varchar('address', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 255 }).notNull(),
});

export const restaurantsRelations = relations(restaurants, ({ many }) => ({
    users: many(users),
    products: many(products),
    categories: many(categories),
    customers: many(customers),
    purchases: many(purchases),
    sales: many(sales),
}));

export const users = mysqlTable(`${prefix}_users`, {
    id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(),
    role: mysqlEnum('role', ['superadmin', 'admin', 'seller', 'waiter']).notNull(),
    restaurantId: varchar('restaurantId', { length: 255 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
});

export const usersRelations = relations(users, ({ one }) => ({
    restaurant: one(restaurants, {
        fields: [users.restaurantId],
        references: [restaurants.id],
    }),
}));

export const categories = mysqlTable(`${prefix}_categories`, {
    id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    restaurantId: varchar('restaurantId', { length: 255 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
});

export const products = mysqlTable(`${prefix}_products`, {
    id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    category: varchar('category', { length: 255 }).notNull(),
    restaurantId: varchar('restaurantId', { length: 255 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
});

export const customers = mysqlTable(`${prefix}_customers`, {
    id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 255 }).notNull(),
    restaurantId: varchar('restaurantId', { length: 255 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
});

export const purchases = mysqlTable(`${prefix}_purchases`, {
    id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    productName: varchar('productName', { length: 255 }).notNull(),
    supplier: varchar('supplier', { length: 255 }),
    quantity: int('quantity').notNull(),
    unitPrice: decimal('unitPrice', { precision: 10, scale: 2 }).notNull(),
    purchaseDate: timestamp('purchaseDate').notNull(),
    restaurantId: varchar('restaurantId', { length: 255 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
});

export const sales = mysqlTable(`${prefix}_sales`, {
    id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    customerName: varchar('customerName', { length: 255 }).notNull(),
    tableNumber: varchar('tableNumber', { length: 255 }).notNull(),
    items: json('items').notNull(),
    totalPrice: decimal('totalPrice', { precision: 10, scale: 2 }).notNull(),
    saleDate: timestamp('saleDate').notNull(),
    userId: varchar('userId', { length: 255 }).notNull(),
    userName: varchar('userName', { length: 255 }).notNull(),
    restaurantId: varchar('restaurantId', { length: 255 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
    status: mysqlEnum('status', ['paid', 'pending']).notNull(),
});
