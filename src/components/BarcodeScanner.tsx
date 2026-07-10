'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { useToast } from '@/hooks/use-toast';
import { Barcode, Video, VideoOff } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

type BarcodeScannerProps = {
    onScan: (data: string) => void;
    onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number>();
  
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState(true);

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
          onScan(code.data);
          stopScanning();
          return;
        }
      }
    }
    animationFrameId.current = requestAnimationFrame(scan);
  }, [onScan, stopScanning]);


  const startScanning = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setHasPermission(true);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.oncanplay = () => {
          setIsScanning(true);
        }
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasPermission(false);
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

  // Automatically start scanning when the component mounts
  useEffect(() => {
    startScanning();
    return () => stopScanning();
  }, [startScanning, stopScanning]);

  return (
    <div className="flex flex-col gap-4">
        <div className="relative aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
            <video ref={videoRef} className={cn("w-full h-full object-cover", !isScanning && "hidden")} autoPlay muted playsInline />
            {!isScanning && (
            <div className="text-center text-muted-foreground p-4">
                <Barcode className="h-16 w-16 mx-auto" />
                {hasPermission ? (
                     <p>Starting camera...</p>
                ): (
                    <p className="text-destructive-foreground">Camera permission denied. Please grant access and try again.</p>
                )}
            </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
        </div>
        <Button size="lg" variant="outline" onClick={onClose}><VideoOff className="mr-2"/>Cancel</Button>
    </div>
  );
}
