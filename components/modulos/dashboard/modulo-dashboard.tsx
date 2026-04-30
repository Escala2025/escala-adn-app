/**
 * @fileoverview Panel de estadísticas (Dashboard).
 * 100% dinámico: carga conteos reales desde PostgreSQL al montar el componente.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, KeyRound, Building2, FileText,
  TrendingUp, Clock, CheckCircle, XCircle, RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/lib/contexto-auth';
import { obtenerUsuarios } from '@/lib/actions/usuarios-actions';
import { obtenerProveedores } from '@/lib/actions/proveedores-actions';
import { obtenerTodasLasCuentas } from '@/lib/actions/cobros-actions';
import { obtenerCredenciales } from '@/lib/actions/contrasenas-actions';
import { formatearMoneda } from '@/lib/utilidades';
import type { CuentaCobro } from '@/lib/tipos';

// ─────────────────────────────────────────────────────────────────────────────
// TARJETA DE ESTADÍSTICA
// ─────────────────────────────────────────────────────────────────────────────

interface TarjetaEstadisticaProps {
  titulo:      string;
  valor:       string | number;
  descripcion: string;
  icono:       React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  colorIcono:  string;
  fondoIcono:  string;
  cargando?:   boolean;
}

function TarjetaEstadistica({
  titulo, valor, descripcion, icono: Icono, colorIcono, fondoIcono, cargando,
}: TarjetaEstadisticaProps) {
  return (
    <div
      className="rounded-xl p-5 flex items-start gap-4"
      style={{
        backgroundColor: 'white',
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: fondoIcono }}
      >
        <Icono size={22} style={{ color: colorIcono }} />
      </div>
      <div className="min-w-0 flex-1">
        {cargando ? (
          <div className="h-7 w-16 rounded-md animate-pulse mb-1" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }} />
        ) : (
          <p className="text-2xl font-bold leading-tight" style={{ color: 'var(--cd)' }}>
            {valor}
          </p>
        )}
        <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--cd)' }}>{titulo}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{descripcion}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO DE ESTADÍSTICAS
// ─────────────────────────────────────────────────────────────────────────────

interface Estadisticas {
  usuariosActivos:    number;
  totalCredenciales:  number;
  proveedoresActivos: number;
  cuentasPendientes:  number;
  cuentasAutorizadas: number;
  cuentasRechazadas:  number;
  totalCuentas:       number;
  totalPagado:        number;
  actividadReciente:  CuentaCobro[];
}

const estadisticasVacias: Estadisticas = {
  usuariosActivos:    0,
  totalCredenciales:  0,
  proveedoresActivos: 0,
  cuentasPendientes:  0,
  cuentasAutorizadas: 0,
  cuentasRechazadas:  0,
  totalCuentas:       0,
  totalPagado:        0,
  actividadReciente:  [],
};

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function ModuloDashboard() {
  const { usuario } = useAuth();
  const [stats, setStats]       = useState<Estadisticas>(estadisticasVacias);
  const [cargando, setCargando] = useState(true);

  const esAdmin    = usuario?.rol === 'CEO' || usuario?.rol === 'TI';
  const esContable = usuario?.rol === 'Contable';

  const cargarEstadisticas = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);

    try {
      // Carga en paralelo solo las consultas que el rol necesita
      const promesas = await Promise.allSettled([
        (esAdmin || esContable) ? obtenerUsuarios()                                  : Promise.resolve(null),
        esAdmin                 ? obtenerCredenciales(usuario.id, usuario.rol)       : Promise.resolve(null),
        (esAdmin || esContable) ? obtenerProveedores()                               : Promise.resolve(null),
        (esAdmin || esContable) ? obtenerTodasLasCuentas()                           : Promise.resolve(null),
      ]);

      const [resUsuarios, resCredenciales, resProveedores, resCuentas] = promesas;

      const usuarios    = resUsuarios?.status     === 'fulfilled' && resUsuarios.value?.ok     ? resUsuarios.value.datos     ?? [] : [];
      const credenciales = resCredenciales?.status === 'fulfilled' && resCredenciales.value?.ok ? resCredenciales.value.datos ?? [] : [];
      const proveedores  = resProveedores?.status  === 'fulfilled' && resProveedores.value?.ok  ? resProveedores.value.datos  ?? [] : [];
      const cuentas      = resCuentas?.status      === 'fulfilled' && resCuentas.value?.ok      ? resCuentas.value.datos      ?? [] : [];

      setStats({
        usuariosActivos:    (usuarios as { activo: boolean }[]).filter(u => u.activo).length,
        totalCredenciales:  credenciales.length,
        proveedoresActivos: (proveedores as { activo: boolean }[]).filter(p => p.activo).length,
        cuentasPendientes:  cuentas.filter((c: CuentaCobro) => c.estado === 'Pendiente').length,
        cuentasAutorizadas: cuentas.filter((c: CuentaCobro) => c.estado === 'Autorizado').length,
        cuentasRechazadas:  cuentas.filter((c: CuentaCobro) => c.estado === 'Rechazado').length,
        totalCuentas:       cuentas.length,
        totalPagado:        cuentas
          .filter((c: CuentaCobro) => c.estado === 'Autorizado')
          .reduce((acc: number, c: CuentaCobro) => acc + c.valorNumerico, 0),
        actividadReciente:  (cuentas as CuentaCobro[])
          .sort((a, b) => new Date(b.fechaEnvio ?? 0).getTime() - new Date(a.fechaEnvio ?? 0).getTime())
          .slice(0, 8),
      });
    } finally {
      setCargando(false);
    }
  }, [usuario, esAdmin, esContable]);

  useEffect(() => { cargarEstadisticas(); }, [cargarEstadisticas]);

  if (!usuario) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Saludo */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cd)' }}>
            Bienvenido, {usuario.nombreCompleto?.split(' ')[0]}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {new Date().toLocaleDateString('es-CO', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <button
          onClick={cargarEstadisticas}
          disabled={cargando}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          title="Actualizar estadísticas"
        >
          <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(esAdmin || esContable) && (
          <TarjetaEstadistica
            titulo="Usuarios Activos"
            valor={stats.usuariosActivos}
            descripcion="Miembros del equipo"
            icono={Users}
            colorIcono="var(--cp)"
            fondoIcono="rgba(0,122,136,0.1)"
            cargando={cargando}
          />
        )}

        {esAdmin && (
          <TarjetaEstadistica
            titulo="Credenciales"
            valor={stats.totalCredenciales}
            descripcion="En el gestor de contraseñas"
            icono={KeyRound}
            colorIcono="#7c3aed"
            fondoIcono="rgba(124,58,237,0.1)"
            cargando={cargando}
          />
        )}

        {(esAdmin || esContable) && (
          <TarjetaEstadistica
            titulo="Proveedores"
            valor={stats.proveedoresActivos}
            descripcion="Proveedores activos"
            icono={Building2}
            colorIcono="var(--cs)"
            fondoIcono="rgba(186,86,40,0.1)"
            cargando={cargando}
          />
        )}

        <TarjetaEstadistica
          titulo="Cuentas Pendientes"
          valor={stats.cuentasPendientes}
          descripcion="Requieren revisión contable"
          icono={Clock}
          colorIcono="#d97706"
          fondoIcono="rgba(217,119,6,0.1)"
          cargando={cargando}
        />

        <TarjetaEstadistica
          titulo="Pagos Autorizados"
          valor={stats.cuentasAutorizadas}
          descripcion="Aprobados este período"
          icono={CheckCircle}
          colorIcono="#059669"
          fondoIcono="rgba(5,150,105,0.1)"
          cargando={cargando}
        />

        <TarjetaEstadistica
          titulo="Total Pagado"
          valor={cargando ? '—' : formatearMoneda(stats.totalPagado)}
          descripcion="Valor acumulado autorizado"
          icono={TrendingUp}
          colorIcono="var(--cp)"
          fondoIcono="rgba(0,122,136,0.1)"
          cargando={cargando}
        />

        <TarjetaEstadistica
          titulo="Rechazadas"
          valor={stats.cuentasRechazadas}
          descripcion="Requieren corrección"
          icono={XCircle}
          colorIcono="#dc2626"
          fondoIcono="rgba(220,38,38,0.1)"
          cargando={cargando}
        />

        <TarjetaEstadistica
          titulo="Total Cuentas"
          valor={stats.totalCuentas}
          descripcion="Radicadas en el sistema"
          icono={FileText}
          colorIcono="var(--cd)"
          fondoIcono="rgba(4,40,66,0.08)"
          cargando={cargando}
        />
      </div>

      {/* Actividad reciente */}
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: 'white',
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}
      >
        <h2 className="font-bold text-base mb-4" style={{ color: 'var(--cd)' }}>
          Actividad Reciente — Cuentas de Cobro
        </h2>

        {cargando ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />
            ))}
          </div>
        ) : stats.actividadReciente.length === 0 ? (
          <div className="text-center py-10" style={{ color: 'var(--muted-foreground)' }}>
            <FileText size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No hay cuentas de cobro registradas aún.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['N°', 'Solicitante', 'Valor', 'Fecha Envío', 'Estado'].map(h => (
                    <th
                      key={h}
                      className="text-left pb-3 pr-4 text-xs font-bold uppercase tracking-wide"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.actividadReciente.map(cc => (
                  <tr key={cc.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <td className="py-3 pr-4 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      #{cc.numeroCuenta}
                    </td>
                    <td className="py-3 pr-4 font-medium" style={{ color: 'var(--cd)' }}>
                      {cc.nombreSolicitante}
                    </td>
                    <td className="py-3 pr-4 font-semibold" style={{ color: 'var(--cp)' }}>
                      {formatearMoneda(cc.valorNumerico)}
                    </td>
                    <td className="py-3 pr-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {cc.fechaEnvio
                        ? new Date(cc.fechaEnvio).toLocaleDateString('es-CO')
                        : '—'}
                    </td>
                    <td className="py-3">
                      <span className={`insignia-estado ${
                        cc.estado === 'Autorizado'  ? 'insignia-autorizado' :
                        cc.estado === 'Rechazado'   ? 'insignia-rechazado'  :
                        cc.estado === 'En revisión' ? 'insignia-revision'   :
                        'insignia-pendiente'
                      }`}>
                        {cc.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
