# ALCO-JCCG POS - Licorera & Mini Bar Multisede 🌟

¡Bienvenido a **ALCO-JCCG POS**! Un sistema de punto de venta (POS) y administración de licores, mesas y bodegas premium diseñado específicamente para licoreras y bares con múltiples sedes físicas. 

Esta aplicación está desarrollada con **Next.js (App Router)**, **TypeScript**, **Tailwind CSS v4** y cuenta con integración lista para **Supabase (PostgreSQL)**, operando automáticamente en **Modo Demo (Persistencia Local)** si no se configuran variables de entorno.

---

## 🚀 Características Clave

1. **Lógica Multisede Inteligente (Multi-tenancy):**
   - Aislamiento de datos por `sede_id`. Un administrador de sede solo opera y visualiza métricas de la sucursal activa.
   - Selector rápido de sede (`SedeSwitcher`) integrado en la barra lateral para perfiles administradores autorizados.
2. **Terminal POS en Barra:**
   - Carrito de compras interactivo con desglose de subtotales, IPO (8% impoconsumo típico de bares) y descuentos.
   - Simulación integrada de **lector de código de barras**. Escribe un código (ej. `770123456782`) y pulsa enter para escanear en caliente.
3. **Plano de Control de Mesas:**
   - Mapa interactivo de mesas con estados dinámicos por colores:
     - 🟢 **Libre/Disponible:** Permite registrar cliente y mesero para abrirla.
     - 🔴 **Ocupada/Consumiendo:** Muestra el total de la cuenta. Permite cargar nuevas rondas/bebidas descontando stock de bodega al instante, o cancelar consumos con reintegro auditado.
     - 🟡 **Pidiendo Cuenta (Pagar):** Muestra el desglose final para cobro rápido y liberación inmediata de la mesa.
4. **Inventario y Auditoría Kárdex Completo:**
   - Alertas visuales de **Stock Crítico** (rojo intermitente) para productos que bajen de su umbral mínimo.
   - Historial detallado de movimientos (Ingresos por reabastecimiento, Egresos por POS o mesa) con registro de fecha, hora, cantidad, motivo y operador responsable para evitar fugas.
5. **Consola Super Administrador:**
   - Control financiero consolidado de ingresos globales de todos los locales comerciales.
   - Provisionamiento rápido de nuevas sedes (locales físicos) e inyección simulada de transacciones rápidas.

---

## 📁 Estructura de la Carpeta

El proyecto está organizado bajo los estándares de Next.js App Router:

```text
bar/
├── app/
│   ├── globals.css          # Variables de diseño premium, temas oscuros y glassmorphism
│   ├── layout.tsx           # Layout base, metadatos SEO e integración de Plus Jakarta Sans
│   ├── page.tsx             # Enrutador inteligente (Redirección de sesión por rol)
│   ├── login/               # Pantalla de Acceso Premium con tabs demo precargadas
│   ├── super-admin/         # Consola de dueños, simulación e ingresos consolidados
│   └── dashboard/           # Entorno de trabajo de Administración de Sede
│       ├── layout.tsx       # Sidebar con selector de sedes y control de sesión
│       ├── page.tsx         # KPIs, Alertas de stock crítico y Resumen de mesas
│       ├── ventas/          # Terminal POS en barra
│       ├── mesas/           # Mapa dinámico de comandas de mesa
│       └── inventario/      # Gestión de stock y bitácora Kárdex de auditoría
├── lib/
│   └── supabaseClient.ts    # Conexión remota a Supabase + Base de Datos Mock (localStorage)
├── supabase_schema.sql      # Script de base de datos PostgreSQL remoto
└── package.json             # Dependencias del proyecto
```

---

## 🛠️ Cómo Iniciar el Proyecto

1. **Instalar Dependencias:**
   Abre una terminal en esta carpeta y ejecuta:
   ```bash
   npm install
   ```

2. **Correr Servidor de Desarrollo:**
   Inicia el servidor local de Next.js con:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la interfaz.

3. **Credenciales de Acceso Rápido (Demo):**
   - **Administrador de Sede (Cliente):** `admin@bar.com` / `admin123` *(Redirige a la gestión de barra/mesas)*.
   - **Super Administrador (Tú):** `superadmin@bar.com` / `jccg2105@.**` *(Redirige a métricas globales)*.

---

## ⚡ Conectando una Base de Datos Real de Supabase

Cuando estés listo para conectar ALCO-JCCG POS a una base de datos real en la nube:

1. **Crear base de datos en Supabase:**
   Crea un nuevo proyecto en [Supabase](https://supabase.com).
2. **Ejecutar el Schema SQL:**
   Copia el contenido del archivo `supabase_schema.sql` y pégalo directamente en la herramienta **SQL Editor** de tu consola de Supabase, luego pulsa **Run**. Esto creará todas las tablas, relaciones, índices y datos iniciales de prueba de forma automática.
3. **Configurar Variables de Entorno:**
   Crea un archivo llamado `.env.local` en la raíz de este proyecto e introduce tus credenciales de API de Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu-supabase-url-aqui
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-supabase-anon-key-aqui
   ```
4. **¡Listo!** El archivo `lib/supabaseClient.ts` detectará automáticamente las variables y apagará el *Modo Demo*, conectando tu sistema POS en tiempo real con Supabase.

---

## 💎 Diseño Premium e Interfaz Inmersiva

- **Estética Bar/Nightlife first:** Interfaz oscura refinada en tonos Slate, Zinc y fondos puros `#030303` combinados con acentos ámbar/oro (`#f59e0b`) simulando licores finos.
- **Glassmorphism:** Tarjetas y paneles semi-transparentes con desenfoques fluidos (`backdrop-filter`) que le otorgan un aspecto de cristal esmerilado de alta gama.
- **Micro-interacciones:** Bordes iluminados animados, efectos hover suaves y transiciones optimizadas para pantallas táctiles de 120Hz.
# bar
