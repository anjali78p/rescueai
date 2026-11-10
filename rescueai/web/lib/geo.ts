import type { Loc } from "./types";

let lastKnown: Loc | null = null;

export function getLocation(timeoutMs = 6000): Promise<Loc | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(lastKnown);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        lastKnown = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, captured_at: new Date().toISOString() };
        resolve(lastKnown);
      },
      () => resolve(lastKnown), // fall back to the last fix we had; may be null
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}
export const mapsLink = (l: Loc) => `https://www.google.com/maps?q=${l.lat},${l.lng}`;
