// src/push.ts

// Public VAPID key (Base64URL) provided at build time via Vite
const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC as string;

/** Convert a Base64URL string to a Uint8Array (for PushManager) */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Registers the service worker (public/sw.js) and ensures a push subscription
 * for the given userId. Sends the subscription to the API for storage.
 */
export async function ensurePushSubscription(userId: string): Promise<void> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push not supported on this browser");
      return;
    }

    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      console.warn("Notifications were not granted");
      return;
    }

    // Register your service worker (must be served from the app root)
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await reg.update();

    const ready = await navigator.serviceWorker.ready;

    // Get existing subscription or create a new one
    let sub = await ready.pushManager.getSubscription();
    if (!sub) {
      const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC);
      sub = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        // TS expects a BufferSource (ArrayBuffer is fine)
        applicationServerKey: keyBytes.buffer as ArrayBuffer,
      });
    }

    // Send subscription to your backend
    await fetch("https://api.tempo-os.com/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, subscription: sub }),
      credentials: "omit",
    });
  } catch (err) {
    console.error("ensurePushSubscription failed:", err);
  }
}

