import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Download,
  FileDown,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── CSV Export ───────────────────────────────────────────────────────────────

function ExportSection() {
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    encuestadorId: undefined as number | undefined,
    templateId: undefined as number | undefined,
  });
  const [separator, setSeparator] = useState<"," | ";" | "\t">(",");
  const [isExporting, setIsExporting] = useState(false);

  const { data: encuestadores = [] } = trpc.users.encuestadores.useQuery();
  const { data: templates = [] } = trpc.templates.list.useQuery();

  const { data: csvData, refetch } = trpc.export.csv.useQuery(
    {
      encuestadorId: filters.encuestadorId,
      templateId: filters.templateId,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo + "T23:59:59") : undefined,
    },
    { enabled: false }
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await refetch();
      if (!result.data) { toast.error("No hay datos para exportar"); return; }

      // Apply custom separator if not comma
      let csvContent = result.data.csv;
      if (separator !== ",") {
        csvContent = csvContent.split("\n").map(line =>
          line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).join(separator)
        ).join("\n");
      }
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().split("T")[0];
      a.download = `IATUR_Encuestas_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exportadas ${result.data.count} encuestas`);
    } catch {
      toast.error("Error al exportar. Inténtelo de nuevo.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileDown className="h-4 w-4 text-primary" />
          Exportar encuestas (CSV)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Desde</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Hasta</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Encuestador</label>
            <select
              value={filters.encuestadorId ?? ""}
              onChange={(e) => setFilters({ ...filters, encuestadorId: e.target.value ? Number(e.target.value) : undefined })}
              className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos los encuestadores</option>
              {encuestadores.map((e) => (
                <option key={e.id} value={e.id}>{e.name} {e.identifier ? `(${e.identifier})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Tipo de encuesta</label>
            <select
              value={filters.templateId ?? ""}
              onChange={(e) => setFilters({ ...filters, templateId: e.target.value ? Number(e.target.value) : undefined })}
              className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos los tipos</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Separator selector */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Separador de columnas</label>
          <div className="flex gap-2">
            {([[",", "Coma  ,"], [";", "Punto y coma  ;"], ["\t", "Tabulador  ⇥"]] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setSeparator(val)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  separator === val
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Usa <strong>punto y coma</strong> si abres el CSV con Excel en español. Usa <strong>tabulador</strong> para compatibilidad con SIG.
          </p>
        </div>

        <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Campos incluidos en el CSV:</p>
          <p>ID · Plantilla · Tipo · Encuestador · Identificador · Dispositivo · Punto de encuesta · Franja horaria · Tramo 30 min · Latitud · Longitud · Precisión GPS (m) · Inicio · Fin · Idioma · Estado · Respuestas (JSON)</p>
        </div>

        <Button onClick={handleExport} disabled={isExporting} className="w-full sm:w-auto">
          {isExporting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exportando...</>
          ) : (
            <><Download className="h-4 w-4 mr-2" />Descargar CSV</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Field Metrics ────────────────────────────────────────────────────────────

function FieldMetricsSection() {
  const utils = trpc.useUtils();
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedEncuestador, setSelectedEncuestador] = useState<number | undefined>();
  const [form, setForm] = useState({
    completed: 0,
    rejected: 0,
    substitutions: 0,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: encuestadores = [] } = trpc.users.encuestadores.useQuery();
  const { data: metrics = [] } = trpc.fieldMetrics.list.useQuery({
    dateFrom: new Date(selectedDate),
    dateTo: new Date(selectedDate + "T23:59:59"),
    encuestadorId: selectedEncuestador,
  });

  const saveMutation = trpc.fieldMetrics.upsert.useMutation({
    onSuccess: () => {
      utils.fieldMetrics.list.invalidate();
      toast.success("Parte de campo guardado");
      setForm({ completed: 0, rejected: 0, substitutions: 0, notes: "" });
    },
    onError: () => toast.error("Error al guardar"),
  });

  const handleSave = async () => {
    if (!selectedEncuestador) { toast.error("Seleccione un encuestador"); return; }
    setSaving(true);
    try {
      await saveMutation.mutateAsync({
        date: selectedDate,
        completed: form.completed,
        rejected: form.rejected,
        substituted: form.substitutions,
        notes: form.notes,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* New metric form */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Registrar parte de campo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Fecha</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Encuestador</label>
              <select
                value={selectedEncuestador ?? ""}
                onChange={(e) => setSelectedEncuestador(e.target.value ? Number(e.target.value) : undefined)}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Seleccionar...</option>
                {encuestadores.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} {e.identifier ? `(${e.identifier})` : ""}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" />Completadas
              </label>
              <input
                type="number"
                min={0}
                value={form.completed}
                onChange={(e) => setForm({ ...form, completed: Number(e.target.value) })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring text-center font-semibold"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-600" />Rechazadas
              </label>
              <input
                type="number"
                min={0}
                value={form.rejected}
                onChange={(e) => setForm({ ...form, rejected: Number(e.target.value) })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring text-center font-semibold"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3 text-amber-600" />Sustituciones
              </label>
              <input
                type="number"
                min={0}
                value={form.substitutions}
                onChange={(e) => setForm({ ...form, substitutions: Number(e.target.value) })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring text-center font-semibold"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Observaciones</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Incidencias, condiciones del campo, observaciones..."
            />
          </div>

          <Button onClick={handleSave} disabled={saving || !selectedEncuestador} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Guardar parte
          </Button>
        </CardContent>
      </Card>

      {/* Metrics list */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Partes de campo registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay partes registrados para los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Encuestador</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-green-600 uppercase tracking-wide">Completadas</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-red-600 uppercase tracking-wide">Rechazadas</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-amber-600 uppercase tracking-wide">Sustituciones</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tasa resp.</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m: any) => {
                    const total = (m.completed ?? 0) + (m.rejected ?? 0) + (m.substitutions ?? 0);
                    const rate = total > 0 ? Math.round((m.completed / total) * 100) : 0;
                    return (
                      <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-3 text-sm">
                          {new Date(m.date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </td>
                        <td className="px-3 py-3">
                          <div>
                            <p className="text-sm font-medium">{m.encuestadorName}</p>
                            {m.encuestadorIdentifier && (
                              <p className="text-xs text-muted-foreground font-mono">{m.encuestadorIdentifier}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="font-bold text-green-600">{m.completed}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="font-bold text-red-600">{m.rejected}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="font-bold text-amber-600">{m.substitutions}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-sm font-semibold ${rate >= 70 ? "text-green-600" : rate >= 50 ? "text-amber-600" : "text-red-600"}`}>
                            {rate}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground max-w-xs truncate">
                          {m.notes || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Exportar() {
  const [tab, setTab] = useState<"export" | "metrics">("export");

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exportación y Métricas</h1>
          <p className="text-muted-foreground text-sm mt-1">Descarga de datos y registro de partes de campo</p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg border border-border overflow-hidden w-fit">
          <button
            onClick={() => setTab("export")}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors ${
              tab === "export" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"
            }`}
          >
            <FileDown className="h-4 w-4" />
            Exportar CSV
          </button>
          <button
            onClick={() => setTab("metrics")}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors ${
              tab === "metrics" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Partes de campo
          </button>
        </div>

        {tab === "export" ? <ExportSection /> : <FieldMetricsSection />}
      </div>
    </DashboardLayout>
  );
}
