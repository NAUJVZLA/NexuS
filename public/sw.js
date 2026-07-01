const CACHE_NAME = 'alco-pos-cache-v1';
const PRECACHE_ASSETS = [
  '/',
  '/dashboard',
  '/dashboard/mesas',
  '/dashboard/ventas',
  '/dashboard/inventario',
  '/dashboard/cierre',
  '/dashboard/cartera',
  '/dashboard/auditoria',
  '/login',
  '/favicon.ico?v=4',
  '/apple-touch-icon.png?v=4',
  '/icon-192.png?v=4',
  '/icon-512.png?v=4'
];

// Instalar Service Worker y almacenar en caché los recursos estáticos esenciales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precachando archivos estáticos esenciales');
      // Usamos map para agregar individualmente y evitar que falle toda la lista si un recurso no existe temporalmente
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url => 
          cache.add(url).catch(err => console.warn(`[Service Worker] Error al precachar ${url}:`, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activar y limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Borrando caché antigua:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptar peticiones para servir desde caché cuando no hay conexión
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // No interceptar peticiones a Supabase (base de datos externa) o llamadas de API
  if (url.origin.includes('supabase.co') || url.pathname.includes('/api/')) {
    return;
  }

  // Solo interceptar peticiones GET
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    // Estrategia Network First, fallback to Cache para páginas y recursos
    fetch(request)
      .then((response) => {
        // Guardar copia en la caché si la respuesta es válida y del mismo origen
        if (response && response.status === 200 && (url.origin === self.location.origin)) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si no hay internet, buscar en la caché
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Si es una petición de navegación y no está en caché, devolver la raíz o página offline alternativa
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
