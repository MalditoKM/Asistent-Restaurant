'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Smartphone } from 'lucide-react';

export const InstallPwaButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI to notify the user they can install the PWA
      setIsReady(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    await deferredPrompt.userChoice;
    // We've used the prompt, and can't use it again, but we can listen for the appinstalled event
    setDeferredPrompt(null);
    setIsReady(false);
  };

  if (!isReady) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleInstallClick}
      title="Instalar Aplicación"
    >
      <Smartphone className="h-5 w-5" />
      <span className="sr-only">Instalar Aplicación</span>
    </Button>
  );
};
