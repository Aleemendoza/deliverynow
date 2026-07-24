export const VILLA_CONSTITUCION_CENTER = { latitude: -33.2278, longitude: -60.3297 } as const;
export const SERVICE_RADIUS_KM = Number(process.env.NEXT_PUBLIC_SERVICE_RADIUS_KM ?? process.env.SERVICE_RADIUS_KM ?? 20);

export function distanceInKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const earthRadiusKm = 6371;
  const radians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinServiceArea(address: { latitude: number; longitude: number }) {
  return distanceInKm(VILLA_CONSTITUCION_CENTER, address) <= SERVICE_RADIUS_KM;
}
