import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Users, MapPin, Clock, TrendingUp, Calendar } from "lucide-react";

const SURVEY_POINTS = [
  "Todos",
  "Mateos Gago",
  "Agua / Vida",
  "Plaza de Alfaro",
  "Virgen de los Reyes",
  "Patio de Banderas",
];

const TIME_GRANULARITIES = [
  { value: "hour", label: "Por hora" },
  { value: "slot30", label: "Franjas de 30 min" },
  { value: "day", label: "Por día" },
];

function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

function formatSlot30(slot: number) {
  const h = Math.floor(slot / 2);
  const m = slot % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}

export default function ConteoResultados() {
  const [selectedPoint, setSelectedPoint] = useState("Todos");
  const [selectedEncuestador, setSelectedEncuestador] = useState("all");
  const [granularity, setGranularity] = useState("hour");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: encuestadores = [] } = trpc.users.encuestadores.useQuery();

  const listInput = useMemo(() => ({
    surveyPoint: selectedPoint !== "Todos" ? selectedPoint : undefined,
    encuestadorId: selectedEncuestador !== "all" ? parseInt(selectedEncuestador) : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [selectedPoint, selectedEncuestador, dateFrom, dateTo]);

  const { data: passes = [], isLoading } = trpc.passes.list.useQuery(listInput);

  // Agrupar pases por granularidad temporal
  const chartData = useMemo(() => {
    if (!passes.length) return [];

    if (granularity === "hour") {
      const byHour: Record<number, number> = {};
      passes.forEach((p) => {
        const d = new Date(p.recordedAt);
        const h = d.getHours();
        byHour[h] = (byHour[h] ?? 0) + p.count;
      });
      return Array.from({ length: 24 }, (_, h) => ({
        label: formatHour(h),
        personas: byHour[h] ?? 0,
      })).filter(d => d.personas > 0);
    }

    if (granularity === "slot30") {
      const bySlot: Record<number, number> = {};
      passes.forEach((p) => {
        const d = new Date(p.recordedAt);
        const slot = d.getHours() * 2 + (d.getMinutes() >= 30 ? 1 : 0);
        bySlot[slot] = (bySlot[slot] ?? 0) + p.count;
      });
      return Array.from({ length: 48 }, (_, s) => ({
        label: formatSlot30(s),
        personas: bySlot[s] ?? 0,
      })).filter(d => d.personas > 0);
    }

    if (granularity === "day") {
      const byDay: Record<string, number> = {};
      passes.forEach((p) => {
        const d = new Date(p.recordedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
        byDay[d] = (byDay[d] ?? 0) + p.count;
      });
      return Object.entries(byDay).map(([label, personas]) => ({ label, personas }));
    }

    return [];
  }, [passes, granularity]);

  // Agrupar por sentido
  const byDirection = useMemo(() => {
    const map: Record<string, number> = {};
    passes.forEach((p) => {
      const key = p.directionLabel ?? "Sin sentido";
      map[key] = (map[key] ?? 0) + p.count;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [passes]);

  // Agrupar por punto
  const byPoint = useMemo(() => {
    const map: Record<string, number> = {};
    passes.forEach((p) => {
      map[p.surveyPoint] = (map[p.surveyPoint] ?? 0) + p.count;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [passes]);

  const totalPeople = passes.reduce((s, p) => s + p.count, 0);
  const totalPasses = passes.length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-700" />
            Resultados de Conteo Peatonal
          </h1>
          <p className="text-sm text-gray-500 mt-1">Análisis de flujos peatonales por punto, sentido y franja horaria</p>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Punto</label>
                <Select value={selectedPoint} onValueChange={setSelectedPoint}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SURVEY_POINTS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Encuestador</label>
                <Select value={selectedEncuestador} onValueChange={setSelectedEncuestador}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {encuestadores.map((e: { id: number; name: string | null; identifier: string | null }) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.name ?? e.identifier ?? `#${e.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{totalPeople.toLocaleString("es-ES")}</div>
                  <div className="text-xs text-gray-500">Total personas</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{totalPasses}</div>
                  <div className="text-xs text-gray-500">Registros</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-purple-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{byPoint.length}</div>
                  <div className="text-xs text-gray-500">Puntos activos</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {totalPasses > 0 ? Math.round(totalPeople / totalPasses) : 0}
                  </div>
                  <div className="text-xs text-gray-500">Media por registro</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico temporal */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-700" />
              Distribución temporal
            </CardTitle>
            <Select value={granularity} onValueChange={setGranularity}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_GRANULARITIES.map((g) => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center text-gray-400">Cargando...</div>
            ) : chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400">Sin datos para los filtros seleccionados</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => [`${v} personas`, "Flujo"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="personas" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Desglose por sentido y por punto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Por sentido</CardTitle>
            </CardHeader>
            <CardContent>
              {byDirection.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Sin datos</p>
              ) : (
                <div className="space-y-2">
                  {byDirection.map(([label, count]) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{label}</div>
                        <div className="mt-1 bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${totalPeople > 0 ? (count / totalPeople) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-gray-900">{count}</span>
                        <span className="text-xs text-gray-400 ml-1">
                          ({totalPeople > 0 ? Math.round((count / totalPeople) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Por punto de conteo</CardTitle>
            </CardHeader>
            <CardContent>
              {byPoint.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Sin datos</p>
              ) : (
                <div className="space-y-2">
                  {byPoint.map(([point, count]) => (
                    <div key={point} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{point}</div>
                        <div className="mt-1 bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${totalPeople > 0 ? (count / totalPeople) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-gray-900">{count}</span>
                        <span className="text-xs text-gray-400 ml-1">
                          ({totalPeople > 0 ? Math.round((count / totalPeople) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabla de últimos registros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Últimos registros</CardTitle>
          </CardHeader>
          <CardContent>
            {passes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin registros</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Fecha/Hora</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Punto</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Sentido</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Encuestador</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Personas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {passes.slice(0, 50).map((p) => (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                          {new Date(p.recordedAt).toLocaleString("es-ES", {
                            day: "2-digit", month: "2-digit",
                            hour: "2-digit", minute: "2-digit", second: "2-digit"
                          })}
                        </td>
                        <td className="py-2 px-3 text-gray-700">{p.surveyPoint}</td>
                        <td className="py-2 px-3 text-gray-700">{p.directionLabel ?? "—"}</td>
                        <td className="py-2 px-3 text-gray-600">{p.encuestadorName ?? `#${p.encuestadorId}`}</td>
                        <td className="py-2 px-3 text-right">
                          <Badge variant="secondary" className="font-bold">{p.count}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {passes.length > 50 && (
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Mostrando 50 de {passes.length} registros
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
