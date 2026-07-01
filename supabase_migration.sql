-- ==============================================================
-- MIGRACIÓN SUPABASE: RESOLUCIÓN DE CONFLICTOS OFFLINE-FIRST
-- Ejecuta este script en el editor SQL de tu panel de Supabase.
-- ==============================================================

-- 1. Agregar columna de control de tiempo 'updated_at' a la tabla mesas si no existe
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- 2. Crear o reemplazar la función RPC de sincronización de mesas con fusión de consumos
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
        -- Si la modificación offline es posterior al cierre de la mesa,
        -- significa que el mesero abrió un nuevo consumo offline sin enterarse del cobro.
        -- Reabrimos la mesa e incorporamos los nuevos consumos.
        v_nuevo_estado := 'OCUPADA';
        v_nuevo_cliente := p_cliente_nombre;
        v_consumo_fusionado := p_consumos;
        
    -- Caso B: Ambas están ocupadas. Fusión inteligente de consumos de forma acumulativa
    ELSIF v_mesa_nube.estado = 'OCUPADA' AND p_estado = 'OCUPADA' THEN
        v_nuevo_estado := 'OCUPADA';
        v_nuevo_cliente := COALESCE(v_mesa_nube.cliente_nombre, p_cliente_nombre);
        
        -- Algoritmo SQL de fusión JSONB por id de producto.
        -- Agrupa consumos de ambos dispositivos seleccionando la cantidad máxima o sumándolos.
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
            -- Agrupamos por producto para evitar duplicados en la mesa.
            -- Tomamos el mesero que registró la última acción y el precio unitario correcto.
            SELECT 
                prod_id,
                nombre,
                MAX(cantidad) as cantidad, -- Evita duplicar si es el mismo envío sincronizado tarde
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
        
    -- Caso C: LWW clásico (Last-Write-Wins) en base a marcas de tiempo updated_at para otros estados
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

    -- 3. Actualizar el registro con los datos saneados y el timestamp más reciente
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
