import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart, LabelList,
} from "recharts";
import { useState } from "react";
import {
  Loader2, TrendingUp, Users, MapPin, BarChart2, Activity,
  Home, Eye, ArrowLeftRight,
} from "lucide-react";

// ─── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  primary: "#1e4d8c",
  secondary: "#2e7dc7",
  accent: "#0ea5c9",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  purple: "#7c3aed",
  teal: "#0d9488",
  muted: "#94a3b8",
};
const PIE_COLORS = [C.primary, C.warning, C.success, C.accent, C.purple, C.teal, C.danger];
const FREQ_COLORS: Record<string, string> = {
  diario: "#1e4d8c", varias_semana: "#2e7dc7", "1_semana": "#0ea5c9",
  menos_1_semana: "#94a3b8", nunca: "#e2e8f0",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="text-xs">
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function StatBadge({ value, label, color = "text-primary", sub }: { value: any; label: string; color?: string; sub?: string }) {
  return (
    <div className="text-center px-4 py-3">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-medium text-foreground mt-1">{label}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ProgressRing({ value, max, color, label, sublabel }: {
  value: number; max: number; color: string; label: string; sublabel: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const r = 38;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
          <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-foreground">{pct}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{value} / {max}</p>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, color = "text-primary" }: { icon: any; title: string; color?: string }) {
  return (
    <div className={`flex items-center gap-2 mb-4 ${color}`}>
      <Icon className="h-5 w-5" />
      <h2 className="text-base font-bold">{title}</h2>
    </div>
  );
}

function EmptyState() {
  return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No hay datos suficientes</div>;
}

// Etiqueta de porcentaje dentro del segmento (solo si > 8%)
const RADIAN = Math.PI / 180;
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.08) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 700, pointerEvents: 'none' }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ─── Tab: General ─────────────────────────────────────────────────────────────
function TabGeneral({
  dateFrom,
  dateTo,
  surveyTargetResidents,
  surveyTargetVisitors,
  surveyTargetTotal,
}: {
  dateFrom: string;
  dateTo: string;
  surveyTargetResidents: number;
  surveyTargetVisitors: number;
  surveyTargetTotal: number;
}) {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: byEncuestador = [] } = trpc.dashboard.byEncuestador.useQuery({
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo + "T23:59:59") : undefined,
  });
  const { data: byDay = [] } = trpc.dashboard.byDay.useQuery({
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo + "T23:59:59") : undefined,
  });
  const { data: byTimeSlot = [] } = trpc.dashboard.byTimeSlot.useQuery({
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo + "T23:59:59") : undefined,
  });
  const { data: rejStats } = trpc.rejections.stats.useQuery({
    dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
  });

  const TARGET_R = surveyTargetResidents;
  const TARGET_V = surveyTargetVisitors;
  const TARGET_T = surveyTargetTotal;
  const residentes = Number(stats?.residentes ?? 0);
  const visitantes = Number(stats?.visitantes ?? 0);
  const total = Number(stats?.total ?? 0);

  const encuestadorData = (byEncuestador as any[]).map((e) => ({
    name: e.encuestadorIdentifier ?? (e.name ?? "—").split(" ")[0],
    fullName: e.encuestadorName ?? e.name ?? "—",
    identifier: e.encuestadorIdentifier ?? "—",
    residentes: Number(e.residentes ?? 0),
    visitantes: Number(e.visitantes ?? 0),
    total: Number(e.total ?? 0),
  }));

  const dayData = (byDay as any[]).map((d) => ({
    date: new Date(d.date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }),
    residentes: Number(d.residentes ?? 0),
    visitantes: Number(d.visitantes ?? 0),
  }));

  const timeSlotLabels: Record<string, string> = {
    manana: "Mañana", tarde: "Tarde", noche: "Noche", fin_semana: "Fin de semana",
    mediodia: "Mediodía", mañana: "Mañana", Mañana: "Mañana", Tarde: "Tarde", Noche: "Noche",
  };
  const timeSlotOrder = ["manana", "mediodia", "tarde", "noche", "fin_semana"];
  const timeSlotData = [...(byTimeSlot as any[])]
    .sort((a, b) => {
      const ia = timeSlotOrder.indexOf(a.timeSlot ?? "");
      const ib = timeSlotOrder.indexOf(b.timeSlot ?? "");
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map((t) => ({
      name: timeSlotLabels[t.timeSlot] ?? t.timeSlot ?? "—",
      value: Number(t.total ?? t.count ?? 0),
    }));

  const rejTotal = Number((rejStats as any)?.total ?? 0);
  const rejResidentes = Number((rejStats as any)?.byType?.residentes ?? 0);
  const rejVisitantes = Number((rejStats as any)?.byType?.visitantes ?? 0);
  const tasaRechazo = total + rejTotal > 0
    ? ((rejTotal / (total + rejTotal)) * 100).toFixed(1) + "%"
    : "—";

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Progreso */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Progreso del estudio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-around gap-6 py-4">
            <ProgressRing value={total} max={TARGET_T} color={C.primary} label="Total" sublabel={`objetivo ${TARGET_T}`} />
            <ProgressRing value={residentes} max={TARGET_R} color={C.secondary} label="Residentes" sublabel={`objetivo ${TARGET_R}`} />
            <ProgressRing value={visitantes} max={TARGET_V} color={C.warning} label="Visitantes" sublabel={`objetivo ${TARGET_V}`} />
          </div>
        </CardContent>
      </Card>

      {/* Rechazos */}
      <Card className="border-0 shadow-sm border-l-4 border-l-red-400">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Rechazos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 divide-x divide-border">
            <StatBadge value={rejTotal} label="Rechazos totales" color="text-red-600" />
            <StatBadge value={rejResidentes} label="Residentes" color="text-blue-700" />
            <StatBadge value={rejVisitantes} label="Visitantes" color="text-amber-600" />
            <StatBadge value={tasaRechazo} label="Tasa de rechazo" color="text-muted-foreground" />
          </div>
          {(rejStats as any)?.byPoint && Object.keys((rejStats as any).byPoint).length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground mb-2">Por punto de encuesta</p>
              {Object.entries((rejStats as any).byPoint as Record<string, number>)
                .sort(([, a], [, b]) => b - a)
                .map(([point, count]) => (
                  <div key={point} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-36 truncate shrink-0">{point}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className="bg-red-400 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (count / Math.max(1, rejTotal)) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-semibold w-6 text-right">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Por encuestador + franja */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Encuestas por encuestador</CardTitle>
          </CardHeader>
          <CardContent>
            {encuestadorData.length === 0 ? <EmptyState /> : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={encuestadorData} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const enc = encuestadorData.find(e => e.name === label);
                        return (
                          <div className="bg-white border border-gray-200 rounded shadow p-2 text-xs">
                            <p className="font-semibold mb-1">{enc?.fullName ?? label}</p>
                            <p className="text-muted-foreground mb-1">Código: {enc?.identifier}</p>
                            {payload.map((p: any) => (
                              <p key={p.dataKey} style={{ color: p.fill }}>{p.name}: {p.value}</p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="residentes" name="Residentes" fill={C.primary} radius={[3, 3, 0, 0]} stackId="a" />
                    <Bar dataKey="visitantes" name="Visitantes" fill={C.warning} radius={[3, 3, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-1 pr-2 font-medium">Código</th>
                        <th className="text-left py-1 pr-2 font-medium">Nombre</th>
                        <th className="text-right py-1 pr-2 font-medium">Res.</th>
                        <th className="text-right py-1 pr-2 font-medium">Vis.</th>
                        <th className="text-right py-1 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {encuestadorData.map((e, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-1 pr-2 font-mono font-semibold text-primary">{e.identifier}</td>
                          <td className="py-1 pr-2 text-muted-foreground">{e.fullName}</td>
                          <td className="py-1 pr-2 text-right">{e.residentes}</td>
                          <td className="py-1 pr-2 text-right">{e.visitantes}</td>
                          <td className="py-1 text-right font-semibold">{e.total || e.residentes + e.visitantes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribución por franja horaria</CardTitle>
          </CardHeader>
          <CardContent>
            {timeSlotData.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={timeSlotData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => [v, "Encuestas"]} />
                  <Bar dataKey="value" name="Encuestas" radius={[4, 4, 0, 0]}>
                    {timeSlotData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    <LabelList dataKey="value" position="top" style={{ fontSize: 12, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evolución diaria */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Evolución diaria de encuestas</CardTitle>
        </CardHeader>
        <CardContent>
          {dayData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dayData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.warning} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.warning} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="residentes" name="Residentes" stroke={C.primary} fill="url(#gradR)" strokeWidth={2} />
                <Area type="monotone" dataKey="visitantes" name="Visitantes" stroke={C.warning} fill="url(#gradV)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Visitantes ──────────────────────────────────────────────────────────
function TabVisitantes({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data: d, isLoading } = trpc.dashboard.visitantesStats.useQuery({
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo + "T23:59:59") : undefined,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!d || d.total === 0) return <EmptyState />;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-bold text-amber-600">{d.total}</p>
          <p className="text-xs text-muted-foreground mt-1">Total visitantes</p>
        </Card>
        <Card className="border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-bold text-primary">{d.avgValoracion}</p>
          <p className="text-xs text-muted-foreground mt-1">Space rating ★</p>
        </Card>
        <Card className="border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-bold text-teal-600">{d.avgSatisfaccion}</p>
          <p className="text-xs text-muted-foreground mt-1">Satisfacción general ★</p>
        </Card>
        <Card className="border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-bold text-purple-600">
            {d.pais.find((p) => p.name === "Extranjero")?.value ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Visitantes extranjeros</p>
        </Card>
      </div>

      {/* Procedencia + Género */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Procedencia</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={d.pais} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  paddingAngle={3} dataKey="value"
                  label={renderPieLabel} labelLine={false}>
                  {d.pais.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any, name: any, props: any) => [v, props.payload?.name ?? name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Género y edad</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={d.genero} cx="50%" cy="50%" outerRadius={65}
                    paddingAngle={3} dataKey="value"
                    label={renderPieLabel} labelLine={false}>
                    {d.genero.map((_, i) => <Cell key={i} fill={[C.secondary, C.accent, C.muted][i % 3]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, name: any, props: any) => [v, props.payload?.name ?? name]} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={d.edad} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={40} />
                  <Tooltip formatter={(v: any) => [v, "Encuestas"]} />
                  <Bar dataKey="value" fill={C.primary} radius={[0, 3, 3, 0]}>
                    <LabelList dataKey="value" position="right" style={{ fontSize: 10 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Motivo + Grupo */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Motivo de la visita</CardTitle></CardHeader>
          <CardContent>
            {d.motivo.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d.motivo} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: any) => [v, "Encuestas"]} />
                  <Bar dataKey="value" fill={C.warning} radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Tipo de grupo</CardTitle></CardHeader>
          <CardContent>
            {d.grupo.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={d.grupo} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    paddingAngle={3} dataKey="value"
                    label={renderPieLabel} labelLine={false}>
                    {d.grupo.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, name: any, props: any) => [v, props.payload?.name ?? name]} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Frecuencia visita + Estancia */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Frecuencia de visita</CardTitle></CardHeader>
          <CardContent>
            {d.frecuencia.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d.frecuencia} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [v, "Encuestas"]} />
                  <Bar dataKey="value" fill={C.accent} radius={[4, 4, 0, 0]}>
                    {d.frecuencia.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    <LabelList dataKey="value" position="top" style={{ fontSize: 11, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Duración de la estancia</CardTitle></CardHeader>
          <CardContent>
            {d.estancia.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d.estancia} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [v, "Encuestas"]} />
                  <Bar dataKey="value" fill={C.teal} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="value" position="top" style={{ fontSize: 11, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transporte + Actividad */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Medio de transporte</CardTitle></CardHeader>
          <CardContent>
            {d.transporte.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d.transporte} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: any) => [v, "Encuestas"]} />
                  <Bar dataKey="value" fill={C.success} radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Actividad principal</CardTitle></CardHeader>
          <CardContent>
            {d.actividad.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d.actividad} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: any) => [v, "Encuestas"]} />
                  <Bar dataKey="value" fill={C.purple} radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Valoración + Masificación */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Valoración del espacio (1-5 ★)</CardTitle></CardHeader>
          <CardContent>
            {d.valoracionDist.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={d.valoracionDist} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [v, "Encuestas"]} />
                  <Bar dataKey="value" fill={C.warning} radius={[4, 4, 0, 0]}>
                    {d.valoracionDist.map((entry, i) => {
                      const n = parseInt(entry.name);
                      const fill = n >= 4 ? C.success : n === 3 ? C.warning : C.danger;
                      return <Cell key={i} fill={fill} />;
                    })}
                    <LabelList dataKey="value" position="top" style={{ fontSize: 11, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Impacto de la masificación en la visita</CardTitle></CardHeader>
          <CardContent>
            {d.masificacion.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={d.masificacion} cx="50%" cy="50%" outerRadius={70}
                    paddingAngle={3} dataKey="value"
                    label={renderPieLabel} labelLine={false}>
                    {d.masificacion.map((entry, i) => {
                      const fill = entry.name === "No afecta" ? C.success : i === 0 ? C.success : PIE_COLORS[(i + 1) % PIE_COLORS.length];
                      return <Cell key={i} fill={fill} />;
                    })}
                  </Pie>
                  <Tooltip formatter={(v: any, name: any, props: any) => [v, props.payload?.name ?? name]} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Por punto */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Encuestas por punto de encuesta</CardTitle></CardHeader>
        <CardContent>
          {d.byPunto.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={d.byPunto} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [v, "Encuestas"]} />
                <Bar dataKey="value" fill={C.warning} radius={[4, 4, 0, 0]}>
                  {d.byPunto.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  <LabelList dataKey="value" position="top" style={{ fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Residentes ──────────────────────────────────────────────────────────
function TabResidentes({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data: d, isLoading } = trpc.dashboard.residentesStats.useQuery({
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo + "T23:59:59") : undefined,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!d || d.total === 0) return <EmptyState />;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-bold text-primary">{d.total}</p>
          <p className="text-xs text-muted-foreground mt-1">Total residentes</p>
        </Card>
        <Card className="border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-bold text-teal-600">{(d as any).centroHistorico ?? d.territorio.find((t) => t.name === "Centro histórico")?.value ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Centro histórico</p>
        </Card>
        <Card className="border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-bold text-amber-600">{(d as any).conVinculo ?? d.vinculo.filter((v) => v.name !== "No").reduce((a, b) => a + b.value, 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">Con vínculo turístico</p>
        </Card>
        <Card className="border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-bold text-danger">{(d as any).adaptanComp ?? d.comportamiento.filter((c) => c.name !== "No cambia").reduce((a, b) => a + b.value, 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">Adaptan comportamiento</p>
        </Card>
      </div>

      {/* Género + Edad */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Género</CardTitle></CardHeader>
          <CardContent>
            {d.genero.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={d.genero} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    paddingAngle={3} dataKey="value"
                    label={renderPieLabel} labelLine={false}>
                    {d.genero.map((_, i) => <Cell key={i} fill={[C.secondary, C.accent, C.muted][i % 3]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, name: any, props: any) => [v, props.payload?.name ?? name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Grupos de edad</CardTitle></CardHeader>
          <CardContent>
            {d.edad.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d.edad} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [v, "Encuestas"]} />
                  <Bar dataKey="value" fill={C.primary} radius={[4, 4, 0, 0]}>
                    {d.edad.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    <LabelList dataKey="value" position="top" style={{ fontSize: 11, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Satisfacción radar */}
      {d.satisfaccion.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Satisfacción con el barrio (media 1-5 ★)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 items-center">
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={d.satisfaccion.map((s) => ({ subject: s.name, value: s.avg }))}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9 }} tickCount={6} />
                  <Radar name="Media" dataKey="value" stroke={C.primary} fill={C.primary} fillOpacity={0.25} />
                  <Tooltip formatter={(v: any) => [Number(v).toFixed(1), "Media"]} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {d.satisfaccion.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-32 truncate shrink-0">{s.name}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className="h-2 rounded-full transition-all"
                        style={{
                          width: `${(s.avg / 5) * 100}%`,
                          background: s.avg >= 4 ? C.success : s.avg >= 3 ? C.warning : C.danger,
                        }} />
                    </div>
                    <span className="text-xs font-bold w-8 text-right">{s.avg.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Problemas percibidos */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Problemas percibidos por el turismo (múltiple respuesta)</CardTitle></CardHeader>
        <CardContent>
          {d.problemas.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={d.problemas} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                <Tooltip formatter={(v: any) => [v, "Menciones"]} />
                <Bar dataKey="value" fill={C.danger} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Comportamiento adaptación */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Comportamiento de adaptación al turismo</CardTitle></CardHeader>
          <CardContent>
            {d.comportamiento.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={d.comportamiento} cx="50%" cy="50%" outerRadius={75}
                    paddingAngle={3} dataKey="value"
                    label={renderPieLabel} labelLine={false}>
                    {d.comportamiento.map((entry, i) => {
                      const fill = entry.name === "No cambia" ? C.success : PIE_COLORS[(i + 1) % PIE_COLORS.length];
                      return <Cell key={i} fill={fill} />;
                    })}
                  </Pie>
                  <Tooltip formatter={(v: any, name: any, props: any) => [v, props.payload?.name ?? name]} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Territorio de residencia</CardTitle></CardHeader>
          <CardContent>
            {d.territorio.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={d.territorio} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    paddingAngle={3} dataKey="value"
                    label={renderPieLabel} labelLine={false}>
                    {d.territorio.map((_, i) => <Cell key={i} fill={[C.primary, C.teal][i % 2]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, name: any, props: any) => [v, props.payload?.name ?? name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Impacto turismo */}
      {d.impacto.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Impacto percibido del turismo (media 1-5)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {d.impacto.map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-40 shrink-0">{item.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-3">
                    <div className="h-3 rounded-full transition-all"
                      style={{
                        width: `${(item.avg / 5) * 100}%`,
                        background: item.avg >= 4 ? C.success : item.avg >= 3 ? C.warning : C.danger,
                      }} />
                  </div>
                  <span className="text-xs font-bold w-10 text-right">{item.avg.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground w-12">({item.n} resp.)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Conteos ─────────────────────────────────────────────────────────────
function TabConteos({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data: d, isLoading } = trpc.dashboard.conteosStats.useQuery({
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo + "T23:59:59") : undefined,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!d || d.total === 0) return <EmptyState />;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-bold text-primary">{d.total.toLocaleString("es-ES")}</p>
          <p className="text-xs text-muted-foreground mt-1">Total people counted</p>
        </Card>
        <Card className="border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-bold text-teal-600">{d.byPunto.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Points with data</p>
        </Card>
        <Card className="border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-bold text-amber-600">{d.sessions.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Sesiones de conteo</p>
        </Card>
      </div>

      {/* Por punto */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">People by counting point (sum of all flows)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={d.byPunto.map(p => ({ ...p, shortName: p.name.substring(0, 2) }))}
              margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="shortName" tick={{ fontSize: 12, fontWeight: 600 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
                      <p className="font-semibold text-gray-800">{item.name}</p>
                      <p className="text-blue-600 font-bold">{Number(item.value).toLocaleString("en-GB")} people</p>
                      {item.registros > 0 && <p className="text-gray-500">{item.registros} records</p>}
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" name="People" fill={C.primary} radius={[4, 4, 0, 0]}>
                {d.byPunto.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                <LabelList dataKey="value" position="top" style={{ fontSize: 11, fontWeight: 700 }} formatter={(v: any) => v > 0 ? v.toLocaleString("en-GB") : ""} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Leyenda de puntos */}
          <div className="mt-3 grid grid-cols-3 gap-1">
            {d.byPunto.map((p, i) => (
              <div key={i} className="flex items-center gap-1 text-xs text-gray-600">
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="truncate" title={p.name}>{p.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Evolución por tramo */}
      {d.byTramo.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Pedestrian flow by 30-minute slot</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={d.byTramo} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradPeat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.primary} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [v.toLocaleString("en-GB"), "People"]} />
                <Area type="monotone" dataKey="value" name="People" stroke={C.primary} fill="url(#gradPeat)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top sentidos */}
      {d.bySentido.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top flow directions (people)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {d.bySentido.slice(0, 12).map((s, i) => (
                <div key={s.name} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                  <span className="text-xs text-foreground flex-1 truncate">{s.name}</span>
                  <div className="w-32 bg-muted rounded-full h-2 shrink-0">
                    <div className="h-2 rounded-full" style={{
                      width: `${Math.min(100, (s.value / (d.bySentido[0]?.value ?? 1)) * 100)}%`,
                      background: PIE_COLORS[i % PIE_COLORS.length],
                    }} />
                  </div>
                  <span className="text-xs font-bold w-14 text-right shrink-0">{s.value.toLocaleString("en-GB")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla de sesiones */}
      {d.sessions.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Sesiones de conteo</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Point</th>
                    <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Subpoint</th>
                    <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Encuestador</th>
                    <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Start</th>
                    <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">End</th>
                    <th className="text-right py-2 font-semibold text-muted-foreground">People</th>
                  </tr>
                </thead>
                <tbody>
                  {d.sessions.sort((a, b) => b.total - a.total).map((s, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-1.5 pr-3 font-medium">{s.punto}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{s.subpunto}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{s.encuestador.split(" ")[0]}</td>
                      <td className="py-1.5 pr-3 text-right">{s.inicio}</td>
                      <td className="py-1.5 pr-3 text-right">{s.fin || "—"}</td>
                      <td className="py-1.5 text-right font-bold text-primary">{s.total.toLocaleString("es-ES")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "general", label: "General", icon: BarChart2 },
  { id: "visitantes", label: "Visitantes", icon: Eye },
  { id: "residentes", label: "Residentes", icon: Home },
  { id: "conteos", label: "Conteos", icon: ArrowLeftRight },
];

export default function Estadisticas() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTab, setActiveTab] = useState("general");
  const { data: appSettings } = trpc.appSettings.get.useQuery();
  const surveyTargetResidents = appSettings?.surveyTargetResidents ?? 300;
  const surveyTargetVisitors = appSettings?.surveyTargetVisitors ?? 450;
  const surveyTargetTotal = appSettings?.surveyTargetTotal ?? 750;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Estadísticas</h1>
            <p className="text-muted-foreground text-sm mt-1">Análisis en tiempo real del trabajo de campo</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Desde</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Hasta</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "general" && (
          <TabGeneral
            dateFrom={dateFrom}
            dateTo={dateTo}
            surveyTargetResidents={surveyTargetResidents}
            surveyTargetVisitors={surveyTargetVisitors}
            surveyTargetTotal={surveyTargetTotal}
          />
        )}
        {activeTab === "visitantes" && <TabVisitantes dateFrom={dateFrom} dateTo={dateTo} />}
        {activeTab === "residentes" && <TabResidentes dateFrom={dateFrom} dateTo={dateTo} />}
        {activeTab === "conteos" && <TabConteos dateFrom={dateFrom} dateTo={dateTo} />}
      </div>
    </DashboardLayout>
  );
}
