'use client';

/**
 * @fileoverview Módulo de Informes y Analytics — Escala ADN.
 * Visualiza métricas agregadas de cobros, bitácora y pagos usando Recharts.
 * Solo accesible para CEO, TI y Contable.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, FileText, Clock, DollarSign, RefreshCw, Users } from 'lucide-react';
import { useAuth } from '@/lib/contexto-auth';
import { obtenerTodasLasCuentas } from '@/lib/actions/cobros-actions';
import { obtenerTodosLosRegistros, obtenerMisRegistros } from '@/lib/actions/bitacora-actions';
import { formatearMoneda } from '@/lib/utilidades';
import type { CuentaCobro, RegistroBitacora } from '@/lib/tipos';

// ─── Paleta de colores del sistema ───────────────────────────────────────────
const COLORES = {
  primario:  '#007a88',
  secundario:'#ba5628',
  verde:     '#059669',
  amarillo:  '#d97706',
  rojo:      '#dc2626',
  gris:      '#94a3b8',
};

const COLORES_PIE = [COLORES.verde, COLORES.amarillo, COLORES.rojo, COLORES.primario];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function agruparPorMes(cuentas: CuentaCobro[]) {
  const mapa: Record<string, { mes: string; total: number; autorizadas: number; rechazadas: number; pendientes: number }> = {};
  cuentas.forEach(c => {
    const fecha = c.fechaEnvio ? new Date(c.fechaEnvio) : new Date(c.fechaDocumento);
    const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    const etiqueta = fecha.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
    if (!mapa[clave]) mapa[clave] = { mes: etiqueta, total: 0, autorizadas: 0, rechazadas: 0, pendientes: 0 };
    mapa[clave].total += c.valorNumerico;
    if (c.estado === 'Autorizado') mapa[clave].autorizadas += c.valorNumerico;
    if (c.estado === 'Rechazado')  mapa[clave].rechazadas++;
    if (c.estado === 'Pendiente')  mapa[clave].pendientes++;
  });
  return Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}

function agruparBitacoraPorUsuario(registros: RegistroBitacora[]) {
  const mapa: Record<string, { nombre: string; horas: number; registros: number; promedioAvance: number }> = {};
  registros.forEach(r => {
    const nombre = r.nombreUsuario ?? r.usuarioId;
    if (!mapa[r.usuarioId]) mapa[r.usuarioId] = { nombre, horas: 0, registros: 0, promedioAvance: 0 };
    const totalHoras = r.actividades.reduce((s, a) => s + (a.horas || 0), 0);
    mapa[r.usuarioId].horas    += totalHoras;
    mapa[r.usuarioId].registros++;
    mapa[r.usuarioId].promedioAvance += r.porcentajeAvance;
  });
  return Object.values(mapa).map(u => ({
    ...u,
    promedioAvance: u.registros > 0 ? Math.round(u.promedioAvance / u.registros) : 0,
  })).sort((a, b) => b.horas - a.horas).slice(0, 8);
}

// ─── Tarjeta de KPI ──────────────────────────────────────────────────────────

function KPI({ titulo, valor, sub, icono: Icono, color }: {
  titulo: string; valor: string | number; sub?: string;
  icono: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-5 border shadow-sm" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>{titulo}</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--cd)' }}>{valor}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}18` }}>
          <Icono size={20} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

// ─── Tooltip personalizado para moneda ───────────────────────────────────────

function TooltipMoneda({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-xl shadow-lg p-3 text-xs" style={{ borderColor: 'var(--border)' }}>
      <p className="font-bold mb-1" style={{ color: 'var(--cd)' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: COLORES_PIE[i % COLORES_PIE.length] }}>
          {p.name}: {typeof p.value === 'number' && p.value > 1000 ? formatearMoneda(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Módulo principal ─────────────────────────────────────────────────────────

export default function ModuloInformes() {
  const { usuario } = useAuth();
  const [cuentas,   setCuentas]   = useState<CuentaCobro[]>([]);
  const [registros, setRegistros] = useState<RegistroBitacora[]>([]);
  const [cargando,  setCargando]  = useState(true);
  const [pestania,  setPestania]  = useState<'cobros' | 'bitacora'>('cobros');

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    try {
      const esCeoOTi = usuario.rol === 'CEO' || usuario.rol === 'TI' || usuario.rol === 'Contable';
      const [resCuentas, resRegistros] = await Promise.allSettled([
        obtenerTodasLasCuentas(),
        esCeoOTi ? obtenerTodosLosRegistros() : obtenerMisRegistros(usuario.id),
      ]);
      if (resCuentas.status   === 'fulfilled' && resCuentas.value.ok)   setCuentas(resCuentas.value.datos ?? []);
      if (resRegistros.status === 'fulfilled' && resRegistros.value.ok) setRegistros(resRegistros.value.datos ?? []);
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => { cargar(); }, [cargar]);

  if (!usuario) return null;

  // ── Cálculos ────────────────────────────────────────────────────────────────
  const totalPagado      = cuentas.filter(c => c.estado === 'Autorizado').reduce((s, c) => s + c.valorNumerico, 0);
  const tasaAprobacion   = cuentas.length > 0 ? Math.round((cuentas.filter(c => c.estado === 'Autorizado').length / cuentas.length) * 100) : 0;
  const totalHorasBitac  = registros.reduce((s, r) => s + r.actividades.reduce((ss, a) => ss + (a.horas || 0), 0), 0);
  const usuariosUnicos   = new Set(registros.map(r => r.usuarioId)).size;

  const datosMes     = agruparPorMes(cuentas);
  const datosUsuario = agruparBitacoraPorUsuario(registros);

  const datosPie = [
    { name: 'Autorizado', value: cuentas.filter(c => c.estado === 'Autorizado').length },
    { name: 'Pendiente',  value: cuentas.filter(c => c.estado === 'Pendiente').length },
    { name: 'Rechazado',  value: cuentas.filter(c => c.estado === 'Rechazado').length },
    { name: 'En revisión',value: cuentas.filter(c => c.estado === 'En revisión').length },
  ].filter(d => d.value > 0);

  const datosAnimico = (['Feliz', 'Productivo', 'Estresado', 'Agotado'] as const).map(e => ({
    name: e,
    value: registros.filter(r => r.estadoAnimico === e).length,
  })).filter(d => d.value > 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cd)' }}>Informes y Analytics</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Métricas consolidadas de la plataforma en tiempo real.
          </p>
        </div>
        <button onClick={cargar} disabled={cargando}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
          <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Pestañas */}
      <div className="flex gap-2">
        {(['cobros', 'bitacora'] as const).map(p => (
          <button key={p} onClick={() => setPestania(p)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: pestania === p ? 'var(--cp)' : 'transparent',
              color: pestania === p ? 'white' : 'var(--muted-foreground)',
              border: `1px solid ${pestania === p ? 'var(--cp)' : 'var(--border)'}`,
            }}>
            {p === 'cobros' ? 'Cobros y Pagos' : 'Bitácora Estratégica'}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--cp)', borderTopColor: 'transparent' }} />
        </div>
      ) : pestania === 'cobros' ? (
        <>
          {/* KPIs de cobros */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI titulo="Total Pagado"    valor={formatearMoneda(totalPagado)} sub="Cuentas autorizadas" icono={DollarSign}  color={COLORES.primario} />
            <KPI titulo="Total Cuentas"   valor={cuentas.length}               sub="Radicadas en total"  icono={FileText}    color={COLORES.amarillo} />
            <KPI titulo="Tasa Aprobación" valor={`${tasaAprobacion}%`}         sub="De las radicadas"    icono={TrendingUp}  color={COLORES.verde}    />
            <KPI titulo="Rechazadas"      valor={cuentas.filter(c => c.estado === 'Rechazado').length} sub="Requieren corrección" icono={FileText} color={COLORES.rojo} />
          </div>

          {/* Gráfico de barras por mes */}
          <div className="bg-white rounded-xl p-5 border shadow-sm" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--cd)' }}>Valor de Cuentas por Mes (COP)</h2>
            {datosMes.length === 0 ? (
              <p className="text-sm text-center py-10" style={{ color: 'var(--muted-foreground)' }}>Sin datos aún.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={datosMes} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip content={<TooltipMoneda />} />
                  <Legend />
                  <Bar dataKey="autorizadas" name="Autorizado" fill={COLORES.verde}    radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total"       name="Total"      fill={COLORES.primario} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Distribución por estado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-5 border shadow-sm" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--cd)' }}>Distribución por Estado</h2>
              {datosPie.length === 0 ? (
                <p className="text-sm text-center py-10" style={{ color: 'var(--muted-foreground)' }}>Sin datos.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={datosPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {datosPie.map((_, i) => <Cell key={i} fill={COLORES_PIE[i % COLORES_PIE.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Tendencia rechazos */}
            <div className="bg-white rounded-xl p-5 border shadow-sm" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--cd)' }}>Rechazos vs Pendientes por Mes</h2>
              {datosMes.length === 0 ? (
                <p className="text-sm text-center py-10" style={{ color: 'var(--muted-foreground)' }}>Sin datos.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={datosMes} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<TooltipMoneda />} />
                    <Legend />
                    <Line type="monotone" dataKey="rechazadas" name="Rechazadas" stroke={COLORES.rojo}    strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="pendientes" name="Pendientes" stroke={COLORES.amarillo} strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* KPIs de bitácora */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI titulo="Total Horas"      valor={`${totalHorasBitac}h`}  sub="Registradas en bitácora" icono={Clock}      color={COLORES.primario} />
            <KPI titulo="Registros"        valor={registros.length}        sub="Días de trabajo"         icono={FileText}   color={COLORES.amarillo} />
            <KPI titulo="Colaboradores"    valor={usuariosUnicos}          sub="Con registros activos"   icono={Users}      color={COLORES.verde}    />
            <KPI titulo="Promedio/Día"     valor={registros.length > 0 ? `${(totalHorasBitac / registros.length).toFixed(1)}h` : '0h'} sub="Horas promedio diarias" icono={TrendingUp} color={COLORES.secundario} />
          </div>

          {/* Horas por colaborador */}
          <div className="bg-white rounded-xl p-5 border shadow-sm" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--cd)' }}>Horas por Colaborador</h2>
            {datosUsuario.length === 0 ? (
              <p className="text-sm text-center py-10" style={{ color: 'var(--muted-foreground)' }}>Sin datos.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={datosUsuario} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                  <YAxis type="category" dataKey="nombre" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip content={<TooltipMoneda />} />
                  <Bar dataKey="horas" name="Horas" fill={COLORES.primario} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Avance promedio + Estado anímico */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-5 border shadow-sm" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--cd)' }}>Avance Promedio por Colaborador (%)</h2>
              {datosUsuario.length === 0 ? (
                <p className="text-sm text-center py-10" style={{ color: 'var(--muted-foreground)' }}>Sin datos.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={datosUsuario} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <XAxis dataKey="nombre" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip content={<TooltipMoneda />} />
                    <Bar dataKey="promedioAvance" name="Avance %" fill={COLORES.verde} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

          <div className="bg-white rounded-xl p-5 border shadow-sm" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--cd)' }}>Estado Anímico del Equipo</h2>
              {datosAnimico.length === 0 ? (
                <p className="text-sm text-center py-10" style={{ color: 'var(--muted-foreground)' }}>Sin datos.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie 
                      data={datosAnimico} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      outerRadius={80}
                      // CORRECCIÓN AQUÍ: Agregamos (percent ?? 0) para evitar el error de undefined
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {datosAnimico.map((_, i) => (
                        <Cell key={i} fill={COLORES_PIE[i % COLORES_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}