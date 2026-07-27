type DebugFields = Record<string, boolean | number | string | undefined | null>;

/**
 * Structured operational logs for the order flow. Fields must never include
 * addresses, contact data, API keys, or complete request payloads.
 */
export function logOrderDebug(event: string, fields: DebugFields = {}) {
  console.info(JSON.stringify({ event, timestamp: new Date().toISOString(), ...fields }));
}
