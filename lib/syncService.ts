import { db, SyncOperation } from './db';
import { supabase } from './supabaseClient';

class SyncService {
  private isSyncing = false;

  /**
   * Ejecuta el proceso de sincronización de la cola local con Supabase.
   */
  public async syncPendingQueue(): Promise<void> {
    if (this.isSyncing) return;
    if (typeof window === 'undefined' || !navigator.onLine) {
      console.log('📡 [Sync] Sin conexión o entorno del lado del servidor. Sincronización en espera.');
      return;
    }
    if (!supabase) {
      console.warn('⚠️ [Sync] Supabase no está configurado o corre en modo DEMO.');
      return;
    }

    this.isSyncing = true;
    console.log('🔄 [Sync] Iniciando sincronización de cola de cambios pendientes...');

    try {
      while (true) {
        // Obtener el primer elemento disponible de la cola de forma dinámica (FIFO)
        const firstOps: SyncOperation[] = await db.cola_sincronizacion
          .orderBy('id')
          .limit(1)
          .toArray();

        if (firstOps.length === 0) {
          console.log('🟢 [Sync] Cola vacía. Todos los dispositivos locales están al día.');
          break; // Salir del bucle, la cola está vacía
        }

        const op = firstOps[0];
        const success = await this.processOperation(op);
        
        if (success) {
          // Si es exitosa, eliminamos la tarea de la cola local
          await db.cola_sincronizacion.delete(op.id!);
          console.log(`✅ [Sync] Sincronización exitosa: ${op.tabla} (ID: ${op.registro_id})`);
        } else {
          // Si es error de red o de base de datos temporal, detenemos para reintentar después
          console.warn(`⏳ [Sync] Error de red o bloqueo al sincronizar ${op.tabla} (ID: ${op.registro_id}). Se reintentará luego.`);
          await db.cola_sincronizacion.update(op.id!, { reintentos: (op.reintentos || 0) + 1 });
          break; // Salir del bucle para mantener el orden secuencial estricto
        }
      }
    } catch (error) {
      console.error('❌ [Sync] Error crítico en el motor de sincronización:', error);
    } finally {
      this.isSyncing = false;
      // Notificar a la UI que la cola de sincronización ha cambiado
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('sync_queue_updated'));
      }
    }
  }

  /**
   * Procesa un evento de sincronización individual con Supabase
   */
  private async processOperation(op: SyncOperation): Promise<boolean> {
    if (!supabase) return false;

    try {
      // Caso 1: Operación de eliminación
      if (op.tipo_operacion === 'DELETE') {
        const { error } = await supabase
          .from(op.tabla)
          .delete()
          .eq('id', op.registro_id);

        if (error) {
          console.error(`❌ [Sync] Error de eliminación en Supabase para la tabla ${op.tabla}:`, error);
          return this.handleSyncError(error, op);
        }
        return true;
      }

      // Caso 2: Inserciones y Actualizaciones (Filtrado de columnas de Supabase)
      const dataPayload = this.cleanPayloadForSupabase(op.tabla, op.datos);

      // Tratamientos específicos por tabla
      if (op.tabla === 'mesas') {
        return await this.syncMesaConResolucion(dataPayload);
      }

      // Operación de sincronización por upsert estándar para el resto de tablas
      const { error } = await supabase
        .from(op.tabla)
        .upsert(dataPayload);

      if (error) {
        console.error(`❌ [Sync] Error en upsert en Supabase para la tabla ${op.tabla}:`, error);
        return this.handleSyncError(error, op);
      }

      return true;
    } catch (err) {
      console.error(`❌ [Sync] Falla en la petición HTTP para ${op.tabla} (ID: ${op.registro_id}):`, err);
      return false; // Error de conectividad, reintentar
    }
  }

  /**
   * Sincroniza la mesa utilizando el RPC PL/pgSQL personalizado en Supabase para resolución de conflictos.
   */
  private async syncMesaConResolucion(mesaLocal: any): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { data, error } = await supabase.rpc('sincronizar_mesa_offline', {
        p_mesa_id: mesaLocal.id,
        p_sede_id: mesaLocal.sede_id,
        p_numero_mesa: mesaLocal.numero_mesa,
        p_estado: mesaLocal.estado,
        p_cliente_nombre: mesaLocal.cliente_nombre || '',
        p_consumos: mesaLocal.consumos || [],
        p_updated_at: mesaLocal.updated_at || new Date().toISOString()
      });

      if (error) {
        console.error(`❌ [Sync Mesa RPC] Error al ejecutar RPC para mesa ${mesaLocal.id}:`, error);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sync_error_occurred', {
            detail: {
              tabla: 'mesas',
              registro_id: mesaLocal.id,
              tipo_operacion: 'UPDATE',
              code: error.code || 'N/A',
              message: error.message || error.details || 'Error en el RPC de mesas'
            }
          }));
        }
        return this.handleSyncError(error, { tabla: 'mesas', registro_id: mesaLocal.id } as any);
      }

      // La base de datos remota nos devuelve el estado unificado/fusionado final.
      // Lo guardamos de vuelta en IndexedDB local para consolidar la "verdad" del servidor.
      if (data && data[0]) {
        const mesaConsolidada = data[0];
        const localMesa = {
          id: mesaConsolidada.id,
          sede_id: mesaConsolidada.sede_id,
          numero_mesa: mesaConsolidada.numero_mesa,
          estado: mesaConsolidada.estado,
          cliente_nombre: mesaConsolidada.cliente_nombre,
          consumos: mesaConsolidada.consumos || [],
          updated_at: mesaConsolidada.updated_at
        };
        await db.mesas.put(localMesa);

        // Actualizar caché de memoria (RAM)
        try {
          const { memoryDb } = await import('./supabaseClient');
          if (memoryDb && memoryDb.mesas) {
            const idx = memoryDb.mesas.findIndex(m => m.id === mesaConsolidada.id);
            if (idx !== -1) {
              memoryDb.mesas[idx] = localMesa;
            } else {
              memoryDb.mesas.push(localMesa);
            }
          }
        } catch (memErr) {
          console.error('❌ [Sync Mesa RPC] Error actualizando memoryDb:', memErr);
        }

        // Notificar a la UI
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('cloudSync'));
        }
      }

      return true;
    } catch (err) {
      console.error(`❌ [Sync Mesa RPC] Error de red inesperado al ejecutar RPC:`, err);
      return false;
    }
  }

  /**
   * Filtra las propiedades del payload para que coincidan exactamente con el esquema de Supabase,
   * evitando errores de columnas inexistentes (code: 42703).
   */
  private cleanPayloadForSupabase(tabla: string, data: any): any {
    const cleaned: any = {};
    const tableSchemas: Record<string, string[]> = {
      sedes: ['id', 'nombre'],
      productos: ['id', 'sede_id', 'codigo_barras', 'nombre', 'categoria', 'precio_compra', 'precio_venta', 'stock_actual', 'stock_minimo', 'tiene_receta', 'receta'],
      insumos: ['id', 'sede_id', 'nombre', 'unidad', 'stock_actual', 'stock_minimo', 'costo_unitario'],
      mesas: ['id', 'sede_id', 'numero_mesa', 'estado', 'cliente_nombre', 'consumos', 'updated_at'],
      movimientos: ['id', 'sede_id', 'producto_id', 'producto_nombre', 'tipo', 'cantidad', 'motivo', 'registrado_por', 'fecha_hora'],
      ventas: ['id', 'sede_id', 'cliente_nombre', 'total', 'metodo_pago', 'atendido_por', 'es_directa', 'items', 'estado', 'razon_anulacion', 'fecha_hora'],
      creditos: ['id', 'sede_id', 'cliente_nombre', 'venta_id', 'total_deuda', 'total_pagado', 'estado', 'fecha_registro', 'fecha_pago', 'registrado_por', 'notas'],
      prestamos: ['id', 'sede_id', 'cliente_nombre', 'botella_nombre', 'cantidad', 'estado', 'fecha_prestamo', 'fecha_devolucion', 'registrado_por', 'desconto_stock', 'producto_id', 'notas'],
      cierres: ['id', 'sede_id', 'fecha_hora', 'monto_apertura', 'ventas_efectivo', 'ventas_tarjeta', 'ventas_transferencia', 'ventas_credito', 'ventas_total', 'monto_real', 'descuadre', 'ventas_count', 'registrado_por', 'notas'],
      auditoria: ['id', 'sede_id', 'usuario', 'accion', 'detalle', 'fecha_hora']
    };

    const validColumns = tableSchemas[tabla];
    if (!validColumns) {
      const { creado_en, updated_at, ...rest } = data;
      return rest;
    }

    // Mapeos especiales de nombres de atributos locales -> Supabase
    const sourceData = { ...data };
    if (tabla === 'prestamos' && 'descontó_stock' in sourceData) {
      sourceData.desconto_stock = sourceData.descontó_stock;
    }

    // Si es auditoría y la sede es global-system, mapear a null para evitar violar la FK
    if (tabla === 'auditoria' && sourceData.sede_id === 'global-system') {
      sourceData.sede_id = null;
    }

    // Filtrar solo las columnas válidas de la tabla en Supabase
    for (const key of validColumns) {
      if (key in sourceData) {
        cleaned[key] = sourceData[key];
      }
    }

    return cleaned;
  }

  /**
   * Gestiona errores de base de datos vs errores de conectividad temporal.
   */
  private handleSyncError(error: any, op: SyncOperation): boolean {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync_error_occurred', {
        detail: {
          tabla: op.tabla,
          registro_id: op.registro_id,
          tipo_operacion: op.tipo_operacion,
          code: error.code || 'N/A',
          message: error.message || error.details || 'Error de base de datos'
        }
      }));
    }
    // Lista de códigos de error de Postgres SQL que representan fallos permanentes
    // (ej. Restricción de llave foránea inválida, violación de check constraint, etc.)
    const permanentDbErrors = ['23503', '23505', '23514', '42P01', '42703', '22P02'];
    
    if (permanentDbErrors.includes(error.code) || op.reintentos > 15) {
      console.error(`⚠️ [Sync] Descartando transacción bloqueada/corrupta de la cola para evitar atascar el POS:`, op, 'Detalle:', error);
      // Retorna true para removerla de la cola de IndexedDB y evitar el bloqueo indefinido del sistema
      return true; 
    }
    
    return false; // Error temporal (502, 503, CORS, Timeout), reintentar después
  }
}

export const syncService = new SyncService();
