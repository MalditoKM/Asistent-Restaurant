
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UtensilsCrossed } from 'lucide-react';
import { RegistrationForm } from '@/components/auth/registration-form';
import { LoginForm } from '@/components/auth/login-form';


export default function Home() {
  // This page no longer fetches data, making it resilient to DB connection issues.
  // The login and registration forms handle all server interactions.
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4 font-body">
      <Card className="w-full max-w-md mx-auto shadow-2xl rounded-2xl overflow-hidden border-0">
        <CardHeader className="text-center p-8 bg-primary/5">
            <div className="flex justify-center text-primary mb-4">
                <UtensilsCrossed className="w-16 h-16" />
            </div>
            <CardTitle className="text-3xl font-bold font-headline">Asistente de Restaurante</CardTitle>
            <CardDescription className="text-lg pt-1">Administra tu restaurante con facilidad.</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
            <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">
                    Iniciar Sesión
                </TabsTrigger>
                <TabsTrigger value="register">Registrarse</TabsTrigger>
                </TabsList>
                <TabsContent value="login" className="pt-6">
                <LoginForm />
                </TabsContent>
                <TabsContent value="register" className="pt-6">
                <RegistrationForm />
                </TabsContent>
            </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
