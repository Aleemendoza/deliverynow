self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : { title: "Delivery Ya", body: "Tenés una actualización" };
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, icon: "/delivery-ya-icon-192.png", badge: "/delivery-ya-icon-192.png", data: { url: payload.url ?? "/" } }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url ?? "/"));
});
