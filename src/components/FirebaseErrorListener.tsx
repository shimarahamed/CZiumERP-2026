
'use client';

import { useEffect, useState } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';

type FirestoreErrorPayload = {
    error: Error;
    collectionName: string;
    attemptedData: any;
}

export default function FirebaseErrorListener() {
    const { toast } = useToast();
    const [errorToThrow, setErrorToThrow] = useState<Error | null>(null);

    useEffect(() => {
        const handleError = (payload: FirestoreErrorPayload) => {
            const { error, collectionName } = payload;
            console.error("A critical Firestore error was caught:", payload);
            
            const enhancedError = new Error(`Firestore operation on collection '${collectionName}' failed. This is often a security rule violation. \nOriginal Message: ${error.message}`);
            // Attach original error and data for better debugging in the overlay
            (enhancedError as any).cause = error;
            (enhancedError as any).attemptedData = payload.attemptedData;
            
            if (process.env.NODE_ENV === 'development') {
                toast({
                    variant: "destructive",
                    title: `Firestore Error: ${collectionName}`,
                    description: "An error has been thrown to activate the Next.js error overlay with details.",
                    duration: 6000,
                });
                setErrorToThrow(enhancedError); // Set state to throw error on next render
            } else {
                 toast({
                    variant: "destructive",
                    title: "Action Failed",
                    description: "Could not save changes. Please check your connection and try again.",
                 });
            }
        };

        const handleRollback = ({ collectionName }: { collectionName: string }) => {
            toast({
                variant: 'destructive',
                title: 'Changes Reverted',
                description: `The save to "${collectionName}" failed and your changes were rolled back. Please try again.`,
            });
        };

        errorEmitter.on('permission-error', handleError);
        errorEmitter.on('rollback', handleRollback);

        return () => {
            errorEmitter.off('permission-error', handleError);
            errorEmitter.off('rollback', handleRollback);
        };

    }, [toast]);

    if (errorToThrow) {
        throw errorToThrow;
    }
    
    return null; // This component doesn't render anything
}
