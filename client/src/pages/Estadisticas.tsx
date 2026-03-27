import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";

// ─── Color palette ────────────────────────────────────────────────────────────

const COLORS = {
  primary: "#1e4d8c",
  secondary: "#2e7dc7",
  accent: "#0ea5c9",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  muted: "#94a3b8",
};

const CHART_COLORS = [
  COLORS.primary, COLORS.secondary, COLORS.accent,
  COLORS.success, COLORS.warning, COLORS.danger,
];

// ─── Progress Ring ────────────────────────────────────────────────────────────

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
          <circle
            cx="48" cy="48" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
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

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="text-xs">
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Estadisticas() {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const defaultTo = today.toISOString().split("T")[0];

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

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
  const { data: byStatus = [] } = trpc.dashboard.byStatus.useQuery({
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo + "T23:59:59") : undefined,
  });

  const TARGET_RESIDENTES = 300;
  const TARGET_VISITANTES = 450;
  const TARGET_TOTAL = 750;

  const residentes = Number(stats?.residentes ?? 0);
  const visitantes = Number(stats?.visitantes ?? 0);
  const total = Number(stats?.total ?? 0);

  // Pie data for type distribution
  const typePieData = [
    { name: "Residentes", value: residentes, color: COLORS.primary },
    { name: "Visitantes", value: visitantes, color: COLORS.warning },
  ].filter((d) => d.value > 0);

  // Status pie
  const statusPieData = (byStatus as any[]).map((s, i) => ({
    name: s.status,
    value: Number(s.count),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  // By encuestador bar data
  const encuestadorData = (byEncuestador as any[]).map((e) => ({
    name: e.name?.split(" ")[0] ?? "—",
    fullName: e.name ?? "—",
    identifier: e.identifier ?? "",
    residentes: Number(e.residentes ?? 0),
    visitantes: Number(e.visitantes ?? 0),
    total: Number(e.total ?? 0),
  }));

  // By day
  const dayData = (byDay as any[]).map((d) => ({
    date: new Date(d.date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }),
    residentes: Number(d.residentes ?? 0),
    visitantes: Number(d.visitantes ?? 0),
    total: Number(d.total ?? 0),
  }));

  // Time slot
  const timeSlotLabels: Record<string, string> = {
    manana: "Mañana", tarde: "Tarde", noche: "Noche", fin_semana: "Fin semana",
  };
  const timeSlotData = (byTimeSlot as any[]).map((t) => ({
    name: timeSlotLabels[t.timeSlot] ?? t.timeSlot ?? "Sin franja",
    value: Number(t.count ?? 0),
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Estadísticas</h1>
            <p className="text-muted-foreground text-sm mt-1">Análisis del trabajo de campo en tiempo real</p>
          </div>
          {/* Date filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Progress rings */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Progreso del estudio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap justify-around gap-6 py-4">
                  <ProgressRing value={total} max={TARGET_TOTAL} color={COLORS.primary} label="Total" sublabel="objetivo 750" />
                  <ProgressRing value={residentes} max={TARGET_RESIDENTES} color={COLORS.secondary} label="Residentes" sublabel="objetivo 300" />
                  <ProgressRing value={visitantes} max={TARGET_VISITANTES} color={COLORS.warning} label="Visitantes" sublabel="objetivo 450" />
                </div>
              </CardContent>
            </Card>

            {/* Charts row 1 */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* By encuestador */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Encuestas por encuestador</CardTitle>
                </CardHeader>
                <CardContent>
                  {encuestadorData.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Sin datos</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={encuestadorData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="residentes" name="Residentes" fill={COLORS.primary} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="visitantes" name="Visitantes" fill={COLORS.warning} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Type distribution */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Distribución por tipo</CardTitle>
                </CardHeader>
                <CardContent>
                  {typePieData.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Sin datos</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={typePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={false}
                        >
                          {typePieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => [v, "Encuestas"]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* By day */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Evolución diaria</CardTitle>
              </CardHeader>
              <CardContent>
                {dayData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Sin datos para el período seleccionado</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dayData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="residentes" name="Residentes" fill={COLORS.primary} stackId="a" />
                      <Bar dataKey="visitantes" name="Visitantes" fill={COLORS.warning} stackId="a" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Charts row 3 */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Time slot */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Distribución por franja horaria</CardTitle>
                </CardHeader>
                <CardContent>
                  {timeSlotData.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Sin datos</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={timeSlotData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                        <Tooltip formatter={(v: any) => [v, "Encuestas"]} />
                        <Bar dataKey="value" name="Encuestas" fill={COLORS.accent} radius={[0, 3, 3, 0]}>
                          {timeSlotData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Status distribution */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Estado de encuestas</CardTitle>
                </CardHeader>
                <CardContent>
                  {statusPieData.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Sin datos</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={statusPieData}
                          cx="50%"
                          cy="50%"
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={false}
                        >
                          {statusPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => [v, "Encuestas"]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
