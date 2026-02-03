import PocketBase from 'pocketbase';

export const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);

// Disable auto-cancellation globally to prevent "The request was aborted" errors
// during multiple rapid requests or React Strict Mode effects.
pb.autoCancellation(false);
