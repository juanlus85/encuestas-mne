import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { ArrowDownLeft, ArrowUpRight, BarChart3, Camera, Clock, Eye, MapPin, Users } from "lucide-react";
import { useState } from "react";

export default function ConteoResultados() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [encuestadorId, setEncuestadorId] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<number | null>(null);

  const { data: encuestadores } = trpc.users.encuestadores.useQuery();
  const { data: sessions, isLoading } = trpc.pedestrian.listSessions.useQuery({
    encuestadorId: encuestadorId && encuestadorId !== "all" ? Number(encuestadorId) : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const { data: sessionDetail } = trpc.pedestrian.sessionDetail.useQuery(
    { id: selectedSession! },
    { enabled: selectedSession !== null }
  );

  const totalIn = sessions?.reduce((s, r) => s + (r.totalIn ?? 0), 0) ?? 0;
  const totalOut = sessions?.reduce((s, r) => s + (r.totalOut ?? 0), 0) ?? 0;

  const formatDuration = (start: Date | null, end: Date | null) => {
    if (!start || !end) return "—";
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    return `${mins} min`;
  };

  return (
    <DashboardLayout>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Conteos Peatonales
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Resultados de las sesiones de conteo de flujo peatonal
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sessions?.length ?? 0}</p>
                <p className="text-sm text-muted-foreground">Sesiones</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ArrowUpRight className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{totalIn.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total entradas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <ArrowDownLeft className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-700">{totalOut.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total salidas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Encuestador</Label>
              <Select value={encuestadorId} onValueChange={setEncuestadorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {encuestadores?.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.identifier ? `${e.identifier} — ` : ""}{e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando sesiones...</div>
          ) : !sessions?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              No hay sesiones de conteo con los filtros seleccionados
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Fecha</th>
                    <th className="text-left p-3 font-medium">Encuestador</th>
                    <th className="text-left p-3 font-medium">Punto</th>
                    <th className="text-left p-3 font-medium">Franja</th>
                    <th className="text-right p-3 font-medium text-blue-700">Entradas</th>
                    <th className="text-right p-3 font-medium text-orange-700">Salidas</th>
                    <th className="text-right p-3 font-medium">Duración</th>
                    <th className="text-center p-3 font-medium">GPS</th>
                    <th className="text-center p-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-muted-foreground">{s.date}</td>
                      <td className="p-3">
                        <div className="font-medium">{s.encuestadorName}</div>
                        {s.encuestadorIdentifier && (
                          <div className="text-xs text-muted-foreground">{s.encuestadorIdentifier}</div>
                        )}
                      </td>
                      <td className="p-3 max-w-[160px] truncate">{s.surveyPoint}</td>
                      <td className="p-3">
                        {s.timeSlot && (
                          <Badge variant="secondary" className="text-xs">
                            {s.timeSlot === "manana" ? "Mañana" :
                             s.timeSlot === "tarde" ? "Tarde" :
                             s.timeSlot === "noche" ? "Noche" : "Fin semana"}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold text-blue-700">{s.totalIn}</td>
                      <td className="p-3 text-right font-bold text-orange-700">{s.totalOut}</td>
                      <td className="p-3 text-right text-muted-foreground">
                        {formatDuration(s.startedAt, s.finishedAt)}
                      </td>
                      <td className="p-3 text-center">
                        {s.latitude ? (
                          <MapPin className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedSession(s.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session detail dialog */}
      <Dialog open={selectedSession !== null} onOpenChange={(open) => { if (!open) setSelectedSession(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Detalle de sesión #{selectedSession}
            </DialogTitle>
          </DialogHeader>
          {sessionDetail && (
            <div className="space-y-4">
              {/* Session info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Punto:</span> <span className="font-medium">{sessionDetail.surveyPoint}</span></div>
                <div><span className="text-muted-foreground">Fecha:</span> <span className="font-medium">{sessionDetail.date}</span></div>
                <div><span className="text-muted-foreground">Encuestador:</span> <span className="font-medium">{sessionDetail.encuestadorName}</span></div>
                <div><span className="text-muted-foreground">Duración:</span> <span className="font-medium">{formatDuration(sessionDetail.startedAt, sessionDetail.finishedAt)}</span></div>
                {sessionDetail.latitude && (
                  <div className="col-span-2 text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {sessionDetail.latitude}, {sessionDetail.longitude}
                    {sessionDetail.gpsAccuracy && ` (±${sessionDetail.gpsAccuracy} m)`}
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-blue-700">{sessionDetail.totalIn}</p>
                  <p className="text-sm text-blue-600">Total entradas</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-orange-700">{sessionDetail.totalOut}</p>
                  <p className="text-sm text-orange-600">Total salidas</p>
                </div>
              </div>

              {/* Intervals */}
              {sessionDetail.intervals?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-1">
                    <Clock className="h-4 w-4" /> Intervalos de 5 minutos
                  </h3>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {sessionDetail.intervals.map((iv) => (
                      <div key={iv.id} className="flex items-center justify-between text-sm py-2 px-3 bg-muted/30 rounded">
                        <span className="text-muted-foreground font-mono">{iv.intervalMinute}–{iv.intervalMinute + 5} min</span>
                        <div className="flex items-center gap-4">
                          <span className="text-blue-700 font-medium">↑ {iv.countIn}</span>
                          <span className="text-orange-700 font-medium">↓ {iv.countOut}</span>
                          {iv.photoUrl && (
                            <a href={iv.photoUrl} target="_blank" rel="noopener noreferrer">
                              <Camera className="h-4 w-4 text-green-500" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sessionDetail.notes && (
                <div>
                  <h3 className="font-semibold text-sm mb-1">Observaciones</h3>
                  <p className="text-sm text-muted-foreground bg-muted/30 rounded p-3">{sessionDetail.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
