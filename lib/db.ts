import Dexie, { type Table } from 'dexie';
import { 
  Sede, 
  Insumo, 
  Producto, 
  Mesa, 
  Movimiento, 
  Venta, 
  CreditoCliente, 
  PrestamoBotella, 
  CierreCaja, 
  AuditLog 
} from './supabaseClient';

export interface LocalMesa extends Omit<Mesa, 'consumos'> {
  consumos: any[];
  updated_at: string;
}

export interface LocalVenta extends Venta {
  updated_at: string;
}

export interface LocalProducto extends Producto {
  updated_at?: string;
}

export interface LocalInsumo extends Insumo {
  updated_at?: string;
}

export interface SyncOperation {
  id?: number; // Autoincremental local
  tabla: 'sedes' | 'insumos' | 'productos' | 'mesas' | 'movimientos' | 'ventas' | 'creditos' | 'prestamos' | 'cierres' | 'auditoria';
  registro_id: string; // UUID del registro afectado
  tipo_operacion: 'INSERT' | 'UPDATE' | 'DELETE';
  datos: any; // Payload del registro
  creado_en: number; // Unix timestamp
  reintentos: number;
}

class GastrobarDatabase extends Dexie {
  sedes!: Table<Sede, string>;
  insumos!: Table<LocalInsumo, string>;
  productos!: Table<LocalProducto, string>;
  mesas!: Table<LocalMesa, string>;
  movimientos!: Table<Movimiento, string>;
  ventas!: Table<LocalVenta, string>;
  creditos!: Table<CreditoCliente, string>;
  prestamos!: Table<PrestamoBotella, string>;
  cierres!: Table<CierreCaja, string>;
  auditoria!: Table<AuditLog, string>;
  cola_sincronizacion!: Table<SyncOperation, number>;

  constructor() {
    super('GastrobarOfflineDB');
    
    // Configura el esquema de IndexedDB.
    // Solo indexamos los campos críticos para búsquedas de clave primaria o filtrados rápidos.
    this.version(2).stores({
      sedes: 'id',
      insumos: 'id, sede_id',
      productos: 'id, sede_id, categoria, codigo_barras',
      mesas: 'id, sede_id, numero_mesa, estado, updated_at',
      movimientos: 'id, sede_id, producto_id, fecha_hora',
      ventas: 'id, sede_id, estado, fecha_hora, updated_at',
      creditos: 'id, sede_id, estado, cliente_nombre',
      prestamos: 'id, sede_id, estado, cliente_nombre',
      cierres: 'id, sede_id, fecha_hora',
      auditoria: 'id, sede_id, usuario, fecha_hora',
      cola_sincronizacion: '++id, tabla, registro_id, tipo_operacion, creado_en'
    });
  }
}

// Inicialización de la base de datos solo en el cliente (SSR Safety)
export const db = typeof window !== 'undefined' ? new GastrobarDatabase() : null!;
