import { useSyncExternalStore } from 'react';

// Whether the browser thinks it's online. navigator.onLine can be
// optimistic (connected to a network without internet), so features use
// it to disable online-only actions up front and still handle request
// failures; it is never trusted as proof that a request will succeed.
const subscribe = (onChange) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

const getSnapshot = () => navigator.onLine !== false;
const getServerSnapshot = () => true;

export function useOnline() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
