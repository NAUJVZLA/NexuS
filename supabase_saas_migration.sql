-- ==========================================
-- SCRIPT DE MIGRACIÓN: SAAS MULTI-TENANT (NEXUS)
-- Ejecutar este script en el editor SQL de Supabase para activar el multi-inquilino.
-- ==========================================

-- 1. Crear tabla de Negocios (Clientes SaaS)
CREATE TABLE IF NOT EXISTS negocios (
    id VARCHAR(100) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    rut VARCHAR(50),
    direccion VARCHAR(255),
    plan_activo VARCHAR(100) DEFAULT 'Básico',
    estado_suscripcion VARCHAR(50) DEFAULT 'ACTIVO' CHECK (estado_suscripcion IN ('ACTIVO', 'SUSPENDIDO', 'DEMO')),
    fecha_vencimiento DATE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Crear tabla de Usuarios (Credenciales dinámicas)
CREATE TABLE IF NOT EXISTS usuarios (
    id VARCHAR(100) PRIMARY KEY,
    negocio_id VARCHAR(100) REFERENCES negocios(id) ON DELETE CASCADE, -- NULL para super_admin
    email VARCHAR(150) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    password VARCHAR(150) NOT NULL,
    rol VARCHAR(50) DEFAULT 'admin' CHECK (rol IN ('admin', 'super_admin')),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Modificar la tabla de sedes para relacionarla con un Negocio
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='sedes' AND column_name='negocio_id'
    ) THEN
        ALTER TABLE sedes ADD COLUMN negocio_id VARCHAR(100) REFERENCES negocios(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Habilitar tiempo real para las nuevas tablas
ALTER PUBLICATION supabase_realtime ADD TABLE negocios;
ALTER PUBLICATION supabase_realtime ADD TABLE usuarios;

-- 5. Sembrar un Negocio y Usuario administrador inicial de prueba (opcional)
INSERT INTO negocios (id, nombre, rut, direccion, plan_activo, estado_suscripcion, fecha_vencimiento)
VALUES ('negocio-defecto', 'Licorera & Bar NexuS', '901.234.567-1', 'Avenida Principal #102', 'Premium', 'ACTIVO', '2026-12-31')
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios (id, negocio_id, email, nombre, password, rol)
VALUES 
  ('usr-super', NULL, 'superadmin@alcobar.com', 'Juan Carlos Caridad', 'jccg2105@.**', 'super_admin'),
  ('usr-admin', 'negocio-defecto', 'admin@alcobar.com', 'Administrador', 'admin123', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Asociar las sedes iniciales al negocio por defecto si existen
UPDATE sedes SET negocio_id = 'negocio-defecto' WHERE negocio_id IS NULL;
