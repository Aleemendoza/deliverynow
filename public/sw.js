self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : { title: "Delivery Now", body: "Tenés una actualización" };
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, icon: "/icon.svg", data: { url: payload.url ?? "/" } }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url ?? "/"));
});
