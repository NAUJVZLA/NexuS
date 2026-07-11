-- ==============================================================
-- PLAN DE BASE DE DATOS: ALCO-JCCG GASTRO BAR POS (Lógica Multisede)
-- Ejecuta este script en el editor SQL de Supabase para configurar tu Base de Datos remota.
-- ==============================================================

-- 1. EXTENSIONES Y LIMPIEZA (Opcional)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Limpieza preventiva
DROP TABLE IF EXISTS creditos CASCADE;
DROP TABLE IF EXISTS prestamos CASCADE;
DROP TABLE IF EXISTS cierres CASCADE;
DROP TABLE IF EXISTS auditoria CASCADE;
DROP TABLE IF EXISTS detalle_ventas CASCADE; -- Obsoleta (reemplazada por JSONB en ventas)
DROP TABLE IF EXISTS ventas CASCADE;
DROP TABLE IF EXISTS movimientos CASCADE;
DROP TABLE IF EXISTS consumos_mesa CASCADE; -- Obsoleta (reemplazada por JSONB en mesas)
DROP TABLE IF EXISTS mesas CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS insumos CASCADE;
DROP TABLE IF EXISTS sedes CASCADE;

-- 2. TABLA SEDES
CREATE TABLE sedes (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    nombre VARCHAR(100) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA PRODUCTOS (Inventario)
CREATE TABLE productos (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    sede_id VARCHAR(100) NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    codigo_barras VARCHAR(50) DEFAULT 'SIN-CODIGO',
    nombre VARCHAR(150) NOT NULL,
    categoria VARCHAR(80) DEFAULT 'Varios',
    precio_compra NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    precio_venta NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    stock_actual INTEGER DEFAULT 0 NOT NULL,
    stock_minimo INTEGER DEFAULT 5 NOT NULL,
    tiene_receta BOOLEAN DEFAULT FALSE NOT NULL,
    receta JSONB DEFAULT '[]'::jsonb,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.1 TABLA INSUMOS (Inventario de Cocina/Ingredientes)
CREATE TABLE insumos (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    sede_id VARCHAR(100) NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    unidad VARCHAR(20) NOT NULL, -- ej: 'g', 'und', 'ml'
    stock_actual NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    stock_minimo NUMERIC(12, 2) DEFAULT 5 NOT NULL,
    costo_unitario NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de consulta rápida por sede
CREATE INDEX idx_productos_sede ON productos(sede_id);
CREATE INDEX idx_productos_codigo ON productos(codigo_barras);
CREATE INDEX idx_insumos_sede ON insumos(sede_id);

-- 4. TABLA MESAS
CREATE TABLE mesas (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    sede_id VARCHAR(100) NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    numero_mesa VARCHAR(50) NOT NULL,
    estado VARCHAR(20) DEFAULT 'DISPONIBLE' CHECK (estado IN ('DISPONIBLE', 'OCUPADA', 'PAGANDO')),
    cliente_nombre VARCHAR(100) DEFAULT '',
    consumos JSONB DEFAULT '[]'::jsonb, -- Ahora los pedidos viven íntegramente en la mesa
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABLA MOVIMIENTOS (Historial de Inventario)
CREATE TABLE movimientos (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    sede_id VARCHAR(100) NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    producto_id VARCHAR(100) NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    producto_nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(10) CHECK (tipo IN ('INGRESO', 'EGRESO')) NOT NULL,
    cantidad INTEGER NOT NULL,
    motivo VARCHAR(255),
    registrado_por VARCHAR(100) NOT NULL,
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TABLA VENTAS
CREATE TABLE ventas (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    sede_id VARCHAR(100) NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    cliente_nombre VARCHAR(100) DEFAULT 'Cliente General',
    total NUMERIC(12, 2) NOT NULL,
    metodo_pago VARCHAR(50) DEFAULT 'EFECTIVO',
    atendido_por VARCHAR(100) NOT NULL,
    es_directa BOOLEAN DEFAULT FALSE,
    items JSONB DEFAULT '[]'::jsonb, -- Ahora los detalles de venta viven íntegramente en la venta
    estado VARCHAR(20) DEFAULT 'COMPLETADA' CHECK (estado IN ('COMPLETADA', 'ANULADA')),
    razon_anulacion TEXT,
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. TABLA CREDITOS (Fiados)
CREATE TABLE creditos (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    sede_id VARCHAR(100) NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    cliente_nombre VARCHAR(100) NOT NULL,
    venta_id VARCHAR(100) REFERENCES ventas(id) ON DELETE SET NULL,
    total_deuda NUMERIC(12, 2) NOT NULL,
    total_pagado NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    estado VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PAGADO')),
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    fecha_pago TIMESTAMP WITH TIME ZONE,
    registrado_por VARCHAR(100) NOT NULL,
    notas TEXT
);

-- 10. TABLA PRESTAMOS (Botellas vacías)
CREATE TABLE prestamos (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    sede_id VARCHAR(100) NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    cliente_nombre VARCHAR(100) NOT NULL,
    botella_nombre VARCHAR(150) NOT NULL,
    cantidad INTEGER NOT NULL,
    estado VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'DEVUELTO')),
    fecha_prestamo TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    fecha_devolucion TIMESTAMP WITH TIME ZONE,
    registrado_por VARCHAR(100) NOT NULL,
    desconto_stock BOOLEAN DEFAULT FALSE,
    producto_id VARCHAR(100) REFERENCES productos(id) ON DELETE SET NULL,
    notas TEXT
);

-- 11. TABLA CIERRES DE CAJA (Arqueo por turno)
CREATE TABLE cierres (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    sede_id VARCHAR(100) NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    monto_apertura NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    ventas_efectivo NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    ventas_tarjeta NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    ventas_transferencia NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    ventas_credito NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    ventas_total NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    monto_real NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    descuadre NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    ventas_count INTEGER DEFAULT 0 NOT NULL,
    registrado_por VARCHAR(100) NOT NULL,
    notas TEXT
);

-- 12. TABLA AUDITORIA (Historial de Auditoría)
CREATE TABLE auditoria (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    sede_id VARCHAR(100) REFERENCES sedes(id) ON DELETE CASCADE,
    usuario VARCHAR(100) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    detalle TEXT NOT NULL,
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================
-- POLÍTICAS DE SEGURIDAD (RLS - Row Level Security)
-- ==============================================================
-- Habilitamos RLS en todas las tablas
ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE creditos ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cierres ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

-- Permisos
CREATE POLICY "Acceso total sedes" ON sedes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total productos" ON productos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total insumos" ON insumos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total mesas" ON mesas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total movimientos" ON movimientos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total ventas" ON ventas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total creditos" ON creditos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total prestamos" ON prestamos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total cierres" ON cierres FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total auditoria" ON auditoria FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================
-- SUPABASE REALTIME (WebSockets)
-- Permite que los computadores escuchen cambios en tiempo real
-- ==============================================================
BEGIN;
  -- Borrar publication si existe para evitar errores
  DROP PUBLICATION IF EXISTS supabase_realtime;
  -- Crear publication
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE mesas;
ALTER PUBLICATION supabase_realtime ADD TABLE ventas;
ALTER PUBLICATION supabase_realtime ADD TABLE movimientos;
ALTER PUBLICATION supabase_realtime ADD TABLE productos;
ALTER PUBLICATION supabase_realtime ADD TABLE insumos;

-- Identity Full asegura que se manden todos los datos en el payload (útil para updates)
ALTER TABLE mesas REPLICA IDENTITY FULL;
ALTER TABLE ventas REPLICA IDENTITY FULL;
ALTER TABLE movimientos REPLICA IDENTITY FULL;

-- ==============================================================
-- 13. DATOS DE PRUEBA / SEMILLA (Seed Data)
-- Evita fallos de restricciones de clave foránea en modo offline-first
-- ==============================================================
INSERT INTO sedes (id, nombre) VALUES 
('sede-norte', 'Licorera & Bar ALCO-JCCG Norte'),
('sede-centro', 'ALCO-JCCG Express Centro')
ON CONFLICT (id) DO NOTHING;

INSERT INTO mesas (id, sede_id, numero_mesa, estado, cliente_nombre, consumos, updated_at) VALUES
('m1', 'sede-norte', '1', 'DISPONIBLE', '', '[]'::jsonb, timezone('utc'::text, now())),
('m2', 'sede-norte', '2', 'DISPONIBLE', '', '[]'::jsonb, timezone('utc'::text, now())),
('m3', 'sede-norte', '3', 'DISPONIBLE', '', '[]'::jsonb, timezone('utc'::text, now())),
('m4', 'sede-norte', 'Barra Principal', 'DISPONIBLE', '', '[]'::jsonb, timezone('utc'::text, now())),
('m5', 'sede-centro', 'Express 1', 'DISPONIBLE', '', '[]'::jsonb, timezone('utc'::text, now())),
('m6', 'sede-centro', 'Express 2', 'DISPONIBLE', '', '[]'::jsonb, timezone('utc'::text, now()))
ON CONFLICT (id) DO NOTHING;

-- ==============================================================
-- 14. FUNCIÓN RPC PARA RESOLUCIÓN DE CONFLICTOS DE MESAS
-- ==============================================================
CREATE OR REPLACE FUNCTION sincronizar_mesa_offline(
    p_mesa_id VARCHAR(100),
    p_sede_id VARCHAR(100),
    p_numero_mesa VARCHAR(50),
    p_estado VARCHAR(20),
    p_cliente_nombre VARCHAR(100),
    p_consumos JSONB,
    p_updated_at TIMESTAMP WITH TIME ZONE
)
RETURNS SETOF mesas AS $$
DECLARE
    v_mesa_nube record;
    v_consumo_fusionado JSONB;
    v_nuevo_estado VARCHAR(20);
    v_nuevo_cliente VARCHAR(100);
BEGIN
    -- 1. Consultar el estado actual de la mesa en la nube
    SELECT * INTO v_mesa_nube FROM mesas WHERE id = p_mesa_id;

    -- Si la mesa no existe en la nube, la creamos directamente
    IF NOT FOUND THEN
        INSERT INTO mesas (id, sede_id, numero_mesa, estado, cliente_nombre, consumos, updated_at)
        VALUES (p_mesa_id, p_sede_id, p_numero_mesa, p_estado, p_cliente_nombre, p_consumos, p_updated_at);
        
        RETURN QUERY SELECT * FROM mesas WHERE id = p_mesa_id;
        RETURN;
    END IF;

    -- 2. RESOLVER CONFLICTOS DE ESTADO Y CONSUMO
    
    -- Caso A: La mesa en la nube ya fue facturada/liberada (DISPONIBLE), pero offline se agregaron nuevos consumos
    IF v_mesa_nube.estado = 'DISPONIBLE' AND p_estado = 'OCUPADA' THEN
        v_nuevo_estado := 'OCUPADA';
        v_nuevo_cliente := p_cliente_nombre;
        v_consumo_fusionado := p_consumos;
        
    -- Caso B: Ambas están ocupadas. Fusión inteligente de consumos de forma acumulativa
    ELSIF v_mesa_nube.estado = 'OCUPADA' AND p_estado = 'OCUPADA' THEN
        v_nuevo_estado := 'OCUPADA';
        v_nuevo_cliente := COALESCE(v_mesa_nube.cliente_nombre, p_cliente_nombre);
        
        WITH consumos_unidos AS (
            SELECT 
                (elem->>'producto_id')::text as prod_id,
                (elem->>'nombre')::text as nombre,
                (elem->>'precio_unitario')::numeric as precio,
                (elem->>'registrado_por')::text as mesero,
                (elem->>'cantidad')::integer as cantidad
            FROM (
                SELECT jsonb_array_elements(v_mesa_nube.consumos) AS elem
                UNION ALL
                SELECT jsonb_array_elements(p_consumos) AS elem
            ) t
        ),
        consumos_agrupados AS (
            SELECT 
                prod_id,
                nombre,
                MAX(cantidad) as cantidad,
                MAX(precio) as precio_unitario,
                MAX(mesero) as registrado_por
            FROM consumos_unidos
            GROUP BY prod_id, nombre
        )
        SELECT jsonb_agg(json_build_object(
            'producto_id', prod_id,
            'nombre', nombre,
            'cantidad', cantidad,
            'precio_unitario', precio_unitario,
            'registrado_por', registrado_por
        )) INTO v_consumo_fusionado FROM consumos_agrupados;
        
    -- Caso C: LWW clásico (Last-Write-Wins)
    ELSE
        IF p_updated_at > v_mesa_nube.updated_at THEN
            v_nuevo_estado := p_estado;
            v_nuevo_cliente := p_cliente_nombre;
            v_consumo_fusionado := p_consumos;
        ELSE
            v_nuevo_estado := v_mesa_nube.estado;
            v_nuevo_cliente := v_mesa_nube.cliente_nombre;
            v_consumo_fusionado := v_mesa_nube.consumos;
        END IF;
    END IF;

    -- 3. Actualizar el registro
    UPDATE mesas
    SET 
        estado = v_nuevo_estado,
        cliente_nombre = v_nuevo_cliente,
        consumos = COALESCE(v_consumo_fusionado, '[]'::jsonb),
        updated_at = GREATEST(v_mesa_nube.updated_at, p_updated_at)
    WHERE id = p_mesa_id;

    RETURN QUERY SELECT * FROM mesas WHERE id = p_mesa_id;
END;
$$ LANGUAGE plpgsql;
