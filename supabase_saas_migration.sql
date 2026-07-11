-- ==========================================
-- SCRIPT DE MIGRACIÓN: SAAS MULTI-TENANT (NEXUS)
-- Ejecutar este script en el editor SQL de Supabase para activar el multi-inquilino.
-- ==========================================

-- 1. Crear tabla de Negocios (Clientes SaaS)
CREATE TABLE IF NOT EXISTS negocios (
    id VARCHAR(100) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    subdominio VARCHAR(100) UNIQUE,
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
    rol VARCHAR(50) DEFAULT 'admin' CHECK (rol IN ('admin', 'super_admin', 'vendedor', 'mesero')),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Modificar la tabla de sedes para relacionarla con un Negocio
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='sedes' AND column_name='negocio_id'
    ) THEN
        ALTER TABLE sedes ADD COLUMN negocio_id VARCHAR(100);
    END IF;
END $$;

-- Asegurar relaciones en Cascada (ON DELETE CASCADE)
ALTER TABLE sedes DROP CONSTRAINT IF EXISTS sedes_negocio_id_fkey;
ALTER TABLE sedes ADD CONSTRAINT sedes_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_negocio_id_fkey;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_negocio_id_fkey FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE;
-- 4. Habilitar tiempo real para las nuevas tablas (comentado porque ya se agregaron previamente)
-- ALTER PUBLICATION supabase_realtime ADD TABLE negocios;
-- ALTER PUBLICATION supabase_realtime ADD TABLE usuarios;

-- 5. Sembrar un Negocio y Usuario administrador inicial de prueba (opcional)
INSERT INTO negocios (id, nombre, subdominio, rut, direccion, plan_activo, estado_suscripcion, fecha_vencimiento)
VALUES ('negocio-defecto', 'Licorera & Bar NexuS', 'alcobar', '901.234.567-1', 'Avenida Principal #102', 'Premium', 'ACTIVO', '2026-12-31')
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios (id, negocio_id, email, nombre, password, rol)
VALUES 
  ('usr-super', NULL, 'superadmin@nexusaas.com', 'Juan Carlos Caridad', 'jccg2105@.**', 'super_admin'),
  ('usr-admin', 'negocio-defecto', 'admin@nexusaas.com', 'Administrador', 'admin123', 'admin')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password = EXCLUDED.password;

-- Asociar las sedes iniciales al negocio por defecto si existen
UPDATE sedes SET negocio_id = 'negocio-defecto' WHERE negocio_id IS NULL;


-- ==============================================================
-- INTEGRACIÓN SUPABASE AUTH Y USUARIOS PÚBLICOS
-- Trigger para sincronizar auth.users -> public.usuarios
-- ==============================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_nombre VARCHAR(150);
    v_rol VARCHAR(50);
    v_negocio_id VARCHAR(100);
BEGIN
    v_nombre := COALESCE(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'full_name', 'Nuevo Empleado');
    v_rol := COALESCE(new.raw_user_meta_data->>'rol', 'mesero');
    v_negocio_id := new.raw_user_meta_data->>'negocio_id';

    INSERT INTO public.usuarios (id, negocio_id, email, nombre, password, rol)
    VALUES (
        new.id::text,
        v_negocio_id,
        new.email,
        v_nombre,
        'supabase-auth-managed',
        v_rol
    )
    ON CONFLICT (email) DO UPDATE
    SET 
        id = new.id::text,
        negocio_id = COALESCE(public.usuarios.negocio_id, v_negocio_id),
        nombre = COALESCE(v_nombre, public.usuarios.nombre),
        rol = COALESCE(v_rol, public.usuarios.rol);
        
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- ==============================================================
-- FUNCIONES DE SEGURIDAD (SECURITY DEFINER)
-- Evitan la recursión infinita en las políticas RLS
-- ==============================================================

CREATE OR REPLACE FUNCTION public.es_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.usuarios 
        WHERE id = auth.uid()::text AND rol = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.obtener_mi_negocio_id()
RETURNS VARCHAR AS $$
BEGIN
    RETURN (
        SELECT negocio_id FROM public.usuarios 
        WHERE id = auth.uid()::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.es_admin_local()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.usuarios 
        WHERE id = auth.uid()::text AND rol = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================
-- POLÍTICAS DE RLS PARA SAAS (NEGOCIOS Y USUARIOS)
-- ==============================================================

ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Limpieza preventiva de políticas
DROP POLICY IF EXISTS "Negocios visibles por todos (para login/subdominio)" ON negocios;
DROP POLICY IF EXISTS "Super Admins tienen control total sobre negocios" ON negocios;
DROP POLICY IF EXISTS "Usuarios legibles por su propio negocio o super_admin" ON usuarios;
DROP POLICY IF EXISTS "Super Admins y Admins locales editan usuarios" ON usuarios;

-- Políticas de Negocios
CREATE POLICY "Negocios visibles por todos (para login/subdominio)" ON negocios
    FOR SELECT USING (true);

CREATE POLICY "Super Admins tienen control total sobre negocios" ON negocios
    FOR ALL USING (public.es_super_admin());

-- Políticas de Usuarios
CREATE POLICY "Usuarios legibles por su propio negocio o super_admin" ON usuarios
    FOR SELECT USING (
        public.es_super_admin()
        OR negocio_id = public.obtener_mi_negocio_id()
    );

CREATE POLICY "Super Admins y Admins locales editan usuarios" ON usuarios
    FOR ALL USING (
        public.es_super_admin()
        OR (
            negocio_id = public.obtener_mi_negocio_id()
            AND public.es_admin_local()
        )
    );
