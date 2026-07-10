'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppContext } from '@/context/AppContext';
import { Store, CheckCircle } from '@/components/icons';

export default function SelectStorePage() {
  const { stores, selectStore, currentStore, logout, user } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'manager') {
      router.push('/');
    }
  }, [user, router]);

  const handleSelectStore = (storeId: string) => {
    selectStore(storeId);
    router.push('/');
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (user?.role === 'admin' || user?.role === 'manager') {
    return null; // Prevent flicker while redirecting
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <div className="absolute top-4 right-4">
            <Button variant="ghost" onClick={handleLogout}>Logout</Button>
        </div>
        <div className="w-full max-w-4xl">
            <div className="text-center mb-10">
                <Store className="w-12 h-12 mx-auto text-primary mb-4" />
                <h1 className="text-3xl font-bold">Select a Store</h1>
                <p className="text-muted-foreground">Choose which store location you want to manage for this session.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {!user?.storeId && (
                    <Card
                        onClick={() => handleSelectStore('all')}
                        className="cursor-pointer hover:border-primary transition-colors relative"
                    >
                        {currentStore?.id === 'all' && (
                            <div className="absolute top-3 right-3 bg-green-500 text-white rounded-full p-1">
                                <CheckCircle className="w-5 h-5" />
                            </div>
                        )}
                        <CardHeader>
                            <CardTitle>All Stores</CardTitle>
                            <CardDescription>Work across every store location (global view).</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <Button className="w-full">
                                {currentStore?.id === 'all' ? 'Continue to Session' : 'Select All Stores'}
                           </Button>
                        </CardContent>
                    </Card>
                )}
                {stores.map(store => (
                    <Card 
                        key={store.id} 
                        onClick={() => handleSelectStore(store.id)} 
                        className="cursor-pointer hover:border-primary transition-colors relative"
                    >
                        {currentStore?.id === store.id && (
                            <div className="absolute top-3 right-3 bg-green-500 text-white rounded-full p-1">
                                <CheckCircle className="w-5 h-5" />
                            </div>
                        )}
                        <CardHeader>
                            <CardTitle>{store.name}</CardTitle>
                            <CardDescription>{store.address}</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <Button className="w-full">
                                {currentStore?.id === store.id ? 'Continue to Session' : 'Select Store'}
                           </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    </div>
  );
}
