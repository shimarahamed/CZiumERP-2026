
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import type { Product } from '@/types';
import { Barcode, Video, VideoOff, CheckCircle } from '@/components/icons';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/money';

export default function ScannerPage() {
  const { products, currencySymbol } = useAppContext();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number>();
  
  const [isScanning, setIsScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);

  const stopScanning = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = undefined;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  const scan = useCallback(() => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          const product = products.find(p => p.id === code.data);
          if (product) {
            setScannedProduct(product);
            toast({ title: 'Product Found!', description: product.name });
            stopScanning();
            return;
          }
        }
      }
    }
    animationFrameId.current = requestAnimationFrame(scan);
  }, [products, toast, stopScanning]);


  const startScanning = useCallback(async () => {
    setScannedProduct(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.oncanplay = () => {
          setIsScanning(true);
        }
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        variant: 'destructive',
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions in your browser settings.',
      });
    }
  }, [toast]);
  
  useEffect(() => {
    if (isScanning) {
      animationFrameId.current = requestAnimationFrame(scan);
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isScanning, scan]);

  useEffect(() => {
    return () => stopScanning();
  }, [stopScanning]);

  return (
    <div className="flex flex-col h-full">
      <Header title="Barcode Scanner" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Scan Product Barcode</CardTitle>
            <CardDescription>
              Point your camera at a product&apos;s barcode to look it up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
              <video ref={videoRef} className={cn("w-full h-full object-cover", !isScanning && "hidden")} autoPlay muted playsInline />
              {!isScanning && (
                <div className="text-center text-muted-foreground">
                  <Barcode className="h-16 w-16 mx-auto" />
                  <p>Camera is off</p>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {scannedProduct && (
              <Card className="mt-4 bg-primary/10">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CheckCircle className="text-green-500" />Product Found</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-lg font-bold">{scannedProduct.name}</p>
                    <p className="text-muted-foreground">Price: {currencySymbol} {formatNumber(scannedProduct.price)}</p>
                    <p className="text-muted-foreground">Stock: {scannedProduct.stock}</p>
                </CardContent>
              </Card>
            )}
          </CardContent>
          <CardFooter className="flex justify-center gap-4">
            {!isScanning ? (
                <Button size="lg" onClick={startScanning}><Video className="mr-2"/>Start Scanning</Button>
            ) : (
                <Button size="lg" variant="destructive" onClick={stopScanning}><VideoOff className="mr-2"/>Stop Scanning</Button>
            )}
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
