// Service worker: รับแจ้งเตือนเด้ง (Web Push) แม้ปิดแอปอยู่ แล้วเปิดแชทเมื่อกด
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "LIGHTMAX SOLAR";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/chat" },
    })
  );
});

// กดแจ้งเตือน → ถ้าเปิดแอปค้างอยู่ให้สลับไปหน้านั้น ไม่งั้นเปิดหน้าต่างใหม่
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/chat", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin) {
          w.focus();
          return w.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
