// Service Worker - Copa 2026 PWA
// Versão do cache (incremente ao fazer deploy para forçar atualização)
const CACHE_VERSION = 'v3';
const CACHE_NAME = `copa2026-${CACHE_VERSION}`;
const OFFLINE_URL = '/Tabela2026-joseh_eduardo/';

// Arquivos para fazer cache na instalação
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/Tabela2026-joseh_eduardo/manifest.json'
];

// ========== INSTALL ==========
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache aberto, pré-cacheando:', PRECACHE_URLS);
        return cache.addAll(PRECACHE_URLS).catch(err => {
          console.warn('[SW] Falha ao pré-cachear alguns recursos:', err);
        });
      })
      .then(() => {
        console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// ========== ACTIVATE ==========
self.addEventListener('activate', event => {
  console.log('[SW] Ativando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('copa2026-') && name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Removendo cache antigo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

// ========== FETCH ==========
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições não-HTTP(S), chrome-extension, etc.
  if (!url.protocol.startsWith('http')) return;

  // Estratégia: Network First para navegação, Cache First para assets
  if (request.mode === 'navigate') {
    // Network First com fallback para cache
    event.respondWith(
      fetch(request)
        .then(response => {
          // Atualiza o cache com a versão mais recente
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Offline: retorna do cache
          return caches.match(request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            // Se nem no cache tem, retorna a página offline
            return caches.match(OFFLINE_URL);
          });
        })
    );
  } else {
    // Cache First para assets (CSS, JS, imagens, etc.)
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          // Stale-while-revalidate: retorna cache e atualiza em background
          const fetchPromise = fetch(request).then(networkResponse => {
            if (networkResponse && networkResponse.ok) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, networkResponse.clone());
              });
            }
            return networkResponse;
          }).catch(() => {});
          
          // Não espera a atualização
          return cachedResponse;
        }
        // Não está em cache, busca da rede
        return fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Se for imagem ou fonte, retorna placeholder
          if (request.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#0c1f1f"/></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
          return new Response('', { status: 408 });
        });
      })
    );
  }
});

// ========== MESSAGE ==========
// Permite que a página principal controle o SW
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    caches.open(CACHE_NAME).then(cache => {
      cache.addAll(urls).catch(err => {
        console.warn('[SW] Falha ao cachear URLs dinâmicas:', err);
      });
    });
  }
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { titulo, corpo, tag } = event.data;
    const options = {
      body: corpo,
      tag: tag || 'copa2026-jogo',
      icon: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 192 192\'%3E%3Crect width=\'192\' height=\'192\' rx=\'38\' fill=\'%230c1f1f\'/%3E%3Ccircle cx=\'96\' cy=\'100\' r=\'61\' fill=\'none\' stroke=\'%23e6b12e\' stroke-width=\'10\'/%3E%3Ctext x=\'96\' y=\'130\' text-anchor=\'middle\' font-size=\'80\'%3E🏆%3C/text%3E%3C/svg%3E',
      badge: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 96 96\'%3E%3Crect width=\'96\' height=\'96\' rx=\'20\' fill=\'%230c1f1f\'/%3E%3Ctext x=\'48\' y=\'64\' text-anchor=\'middle\' font-size=\'56\'%3E⚽%3C/text%3E%3C/svg%3E',
      renotify: true,
      requireInteraction: false,
      data: { url: OFFLINE_URL }
    };
    event.waitUntil(
      self.registration.showNotification(titulo, options)
    );
  }
});

// ========== PUSH NOTIFICATION (preparado para futuro) ==========
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json().catch(() => ({}));
  const options = {
    body: data.body || 'Confira os jogos da Copa 2026!',
    icon: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 192 192\'%3E%3Crect width=\'192\' height=\'192\' rx=\'38\' fill=\'%230c1f1f\'/%3E%3Ccircle cx=\'96\' cy=\'100\' r=\'61\' fill=\'none\' stroke=\'%23e6b12e\' stroke-width=\'10\'/%3E%3Ctext x=\'96\' y=\'130\' text-anchor=\'middle\' font-size=\'80\'%3E🏆%3C/text%3E%3Ctext x=\'96\' y=\'69\' text-anchor=\'middle\' font-size=\'42\' font-family=\'sans-serif\' fill=\'%23f5d98f\' font-weight=\'bold\'%3E26%3C/text%3E%3Ccircle cx=\'142\' cy=\'57\' r=\'14\' fill=\'%23f5b642\'/%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 96 96\'%3E%3Crect width=\'96\' height=\'96\' rx=\'20\' fill=\'%230c1f1f\'/%3E%3Ctext x=\'48\' y=\'64\' text-anchor=\'middle\' font-size=\'56\'%3E⚽%3C/text%3E%3C/svg%3E',
    tag: 'copa2026',
    renotify: true,
    data: data.url ? { url: data.url } : {}
  };
  
  event.waitUntil(
    self.registration.showNotification('🏆 Copa 2026', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || OFFLINE_URL;
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Se já tem uma aba aberta, foca nela
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Senão, abre nova aba
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
