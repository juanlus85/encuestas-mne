import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  FileDown,
  Loader2,
  PersonStanding,
  Plus,
  RefreshCw,
  Timer,
  LogOut,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Definición de campos exportables ────────────────────────────────────────

type FieldDef = { key: string; label: string; group: string; defaultOn: boolean };
type ExportSchemaField = { key: string; label: string; defaultOn: boolean };
type ExportSchemaGroup = { key: string; title: string; fields: ExportSchemaField[] };

const CONTEO_FIELDS: FieldDef[] = [
  { key: "ID",              label: "Record ID",                    group: "Counts",   defaultOn: true },
  { key: "Fecha",           label: "Date",                         group: "Counts",   defaultOn: true },
  { key: "Hora",            label: "Time",                         group: "Counts",   defaultOn: true },
  { key: "Tramo30min",      label: "30-minute segment",            group: "Counts",   defaultOn: true },
  { key: "Punto_Nombre",    label: "Counting point (name)",        group: "Counts",   defaultOn: true },
  { key: "Punto_Codigo",    label: "Counting point (code)",        group: "Counts",   defaultOn: true },
  { key: "Sentido",         label: "Direction (full label)",       group: "Counts",   defaultOn: true },
  { key: "Origen_Codigo",   label: "Flow origin code",             group: "Counts",   defaultOn: true },
  { key: "Destino_Codigo",  label: "Flow destination code",        group: "Counts",   defaultOn: true },
  { key: "Encuestador",    label: "Interviewer name",             group: "Counts",   defaultOn: true },
  { key: "Identificador",   label: "Interviewer code",             group: "Counts",   defaultOn: true },
  { key: "Personas",        label: "Number of people",             group: "Counts",   defaultOn: true },
  { key: "Latitud",         label: "GPS latitude",                 group: "Counts",   defaultOn: false },
  { key: "Longitud",        label: "GPS longitude",                group: "Counts",   defaultOn: false },
  { key: "Precision_GPS_m", label: "GPS accuracy (m)",             group: "Counts",   defaultOn: false },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadCsv(csvContent: string, filename: string, separator: "," | ";" | "\t") {
  let content = csvContent;
  // The server generates CSV using commas. If the user chooses ";" or "\t", convert from commas.
  if (separator !== ",") {
    content = content.split("\n").map(line =>
      line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).join(separator)
    ).join("\n");
  }
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Checkbox group component ─────────────────────────────────────────────────

function FieldCheckboxGroup({
  title,
  fields,
  selected,
  onChange,
}: {
  title: string;
  fields: { key: string; label: string }[];
  selected: Set<string>;
  onChange: (key: string, checked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const allSelected = fields.every(f => selected.has(f.key));
  const someSelected = fields.some(f => selected.has(f.key));

  const toggleAll = () => {
    if (allSelected) {
      fields.forEach(f => onChange(f.key, false));
    } else {
      fields.forEach(f => onChange(f.key, true));
    }
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
            onChange={toggleAll}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">
            {fields.filter(f => selected.has(f.key)).length}/{fields.length} selected
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y divide-border/30">
          {fields.map(f => (
            <label key={f.key} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={selected.has(f.key)}
                onChange={(e) => onChange(f.key, e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary shrink-0"
              />
              <span className="text-xs text-foreground font-mono">{f.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Exportar Encuestas ───────────────────────────────────────────────────────

function ExportEncuestasSection({ exportProjectName }: { exportProjectName: string }) {
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    encuestadorId: undefined as number | undefined,
    templateId: undefined as number | undefined,
  });
  const [separator, setSeparator] = useState<"," | ";" | "\t">(";");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  const toggleField = (key: string, checked: boolean) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const { data: encuestadores = [] } = trpc.users.encuestadores.useQuery();
  const { data: templates = [] } = trpc.templates.list.useQuery();
  const { data: exportSchema } = trpc.export.csvSchema.useQuery({
    templateId: filters.templateId,
  });

  const schemaFields = useMemo(() => {
    const meta = exportSchema?.metaFields ?? [];
    const questionFields = (exportSchema?.groups ?? []).flatMap((group: ExportSchemaGroup) => group.fields);
    return [...meta, ...questionFields];
  }, [exportSchema]);

  const defaultSelected = useMemo(
    () => new Set(schemaFields.filter((field) => field.defaultOn).map((field) => field.key)),
    [schemaFields],
  );

  useEffect(() => {
    const available = new Set(schemaFields.map((field) => field.key));
    setSelectedFields((prev) => {
      const preserved = new Set(Array.from(prev).filter((key) => available.has(key)));
      if (preserved.size > 0 || prev.size === 0) {
        return preserved.size > 0 ? preserved : new Set(defaultSelected);
      }
      return new Set(defaultSelected);
    });
  }, [defaultSelected, schemaFields]);

  const { refetch } = trpc.export.csv.useQuery(
    {
      encuestadorId: filters.encuestadorId,
      templateId: filters.templateId,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo + "T23:59:59") : undefined,
    },
    { enabled: false },
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await refetch();
      if (!result.data) { toast.error("There is no data to export"); return; }
      if (result.data.count === 0) { toast.error("There are no surveys in the selected range"); return; }

      const lines = result.data.csv.split("\n");
      if (lines.length === 0) { toast.error("The CSV is empty"); return; }

      const originalHeaders = lines[0].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((h) => h.replace(/^"|"$/g, ""));
      const keepIndices = originalHeaders
        .map((header, index) => selectedFields.has(header) ? index : -1)
        .filter((index) => index >= 0);

      const filteredLines = lines.map((line) => {
        const cells = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
        return keepIndices.map((index) => cells[index] ?? '""').join(",");
      });

      const dateStr = new Date().toISOString().split("T")[0];
      downloadCsv(filteredLines.join("\n"), `encuestas_${exportProjectName}_${dateStr}.csv`, separator);
      toast.success(`${result.data.count} surveys exported (${keepIndices.length} columns)`);
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const allFieldKeys = schemaFields.map((field) => field.key);

  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileDown className="h-4 w-4 text-primary" />
            Export filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <input type="date" value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <input type="date" value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Interviewer</label>
              <select value={filters.encuestadorId ?? ""}
                onChange={(e) => setFilters({ ...filters, encuestadorId: e.target.value ? Number(e.target.value) : undefined })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">All interviewers</option>
                {encuestadores.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} {e.identifier ? `(${e.identifier})` : ""}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Survey type</label>
              <select value={filters.templateId ?? ""}
                onChange={(e) => setFilters({ ...filters, templateId: e.target.value ? Number(e.target.value) : undefined })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">All types</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Column separator</label>
            <div className="flex gap-2 flex-wrap">
              {([["," , "Comma ,"], [";", "Semicolon ;"], ["\t", "Tab ⇥"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => setSeparator(val)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    separator === val ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
                  }`}>{label}</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Use a <strong>semicolon</strong> if you are going to open the CSV in Excel with Spanish regional settings.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Fields to export</CardTitle>
            <div className="flex gap-2">
              <button onClick={() => setSelectedFields(new Set(allFieldKeys))} className="text-xs text-primary hover:underline">All</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={() => setSelectedFields(new Set())} className="text-xs text-muted-foreground hover:underline">None</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={() => setSelectedFields(new Set(defaultSelected))} className="text-xs text-muted-foreground hover:underline">Default</button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedFields.size} fields selected out of {schemaFields.length}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {exportSchema?.metaFields?.length ? (
            <FieldCheckboxGroup
              title="Survey metadata"
              fields={exportSchema.metaFields.map((field: ExportSchemaField) => ({ key: field.key, label: field.label }))}
              selected={selectedFields}
              onChange={toggleField}
            />
          ) : null}
          {(exportSchema?.groups ?? []).map((group: ExportSchemaGroup) => (
            <FieldCheckboxGroup
              key={group.key}
              title={group.title}
              fields={group.fields.map((field) => ({ key: field.key, label: field.label }))}
              selected={selectedFields}
              onChange={toggleField}
            />
          ))}
          {schemaFields.length === 0 && (
            <p className="text-sm text-muted-foreground">There are no templates with questions available for export.</p>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleExport} disabled={isExporting || selectedFields.size === 0 || schemaFields.length === 0} className="w-full sm:w-auto">
        {isExporting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exporting...</>
        ) : (
          <><Download className="h-4 w-4 mr-2" />Download CSV ({selectedFields.size} columns)</>
        )}
      </Button>
    </div>
  );
}


// ─── Exportar Conteos ─────────────────────────────────────────────────────────

function ExportConteosSection({ exportProjectName }: { exportProjectName: string }) {
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    encuestadorId: undefined as number | undefined,
    surveyPoint: undefined as string | undefined,
  });
  const [separator, setSeparator] = useState<"," | ";" | "\t">(";");
  const [isExporting, setIsExporting] = useState(false);

  const defaultSelected = useMemo(() => new Set(CONTEO_FIELDS.filter(f => f.defaultOn).map(f => f.key)), []);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(defaultSelected);

  const toggleField = (key: string, checked: boolean) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const { data: encuestadores = [] } = trpc.users.encuestadores.useQuery();

  const { refetch } = trpc.export.csvConteos.useQuery(
    {
      encuestadorId: filters.encuestadorId,
      surveyPoint: filters.surveyPoint,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    },
    { enabled: false }
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await refetch();
      if (!result.data) { toast.error("There is no data to export"); return; }

      const lines = result.data.csv.split("\n");
      if (lines.length === 0) { toast.error("Empty CSV"); return; }

      const originalHeaders = lines[0].split(",").map(h => h.replace(/^"|"$/g, ""));
      const keepIndices = originalHeaders
        .map((h, i) => selectedFields.has(h) ? i : -1)
        .filter(i => i >= 0);

      const filteredLines = lines.map(line => {
        const cells = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
        return keepIndices.map(i => cells[i] ?? '""').join(",");
      });

      const dateStr = new Date().toISOString().split("T")[0];
      downloadCsv(filteredLines.join("\n"), `conteos_${exportProjectName}_${dateStr}.csv`, separator);
      toast.success(`${result.data.count} records exported (${keepIndices.length} columns)`);
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <PersonStanding className="h-4 w-4 text-amber-600" />
Count export filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <input type="date" value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <input type="date" value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Interviewer</label>
              <select value={filters.encuestadorId ?? ""}
                onChange={(e) => setFilters({ ...filters, encuestadorId: e.target.value ? Number(e.target.value) : undefined })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">All interviewers</option>
                {encuestadores.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} {e.identifier ? `(${e.identifier})` : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Column separator</label>
            <div className="flex gap-2 flex-wrap">
              {([["," , "Comma ,"], [";", "Semicolon ;"], ["\t", "Tab ⇥"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => setSeparator(val)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    separator === val ? "bg-amber-600 text-white border-amber-600" : "bg-background border-border hover:bg-muted"
                  }`}>{label}</button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selección de campos */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Fields to export</CardTitle>
            <div className="flex gap-2">
              <button onClick={() => setSelectedFields(new Set(CONTEO_FIELDS.map(f => f.key)))} className="text-xs text-primary hover:underline">All</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={() => setSelectedFields(new Set())} className="text-xs text-muted-foreground hover:underline">None</button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedFields.size} fields selected out of {CONTEO_FIELDS.length}
          </p>
        </CardHeader>
        <CardContent>
          <FieldCheckboxGroup
            title="Pedestrian count fields"
            fields={CONTEO_FIELDS.map(f => ({ key: f.key, label: f.label }))}
            selected={selectedFields}
            onChange={toggleField}
          />
        </CardContent>
      </Card>

      <Button onClick={handleExport} disabled={isExporting || selectedFields.size === 0}
        variant="outline" className="w-full sm:w-auto border-amber-300 text-amber-700 hover:bg-amber-50">
        {isExporting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exporting...</>
        ) : (
          <><Download className="h-4 w-4 mr-2" />Download count CSV ({selectedFields.size} columns)</>
        )}
      </Button>
    </div>
  );
}

// ─── Partes de campo ──────────────────────────────────────────────────────────

function FieldMetricsSection() {
  const utils = trpc.useUtils();
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedInterviewer, setSelectedInterviewer] = useState<number | undefined>();
  const [form, setForm] = useState({ completed: 0, rejected: 0, substitutions: 0, notes: "" });
  const [saving, setSaving] = useState(false);

  const { data: encuestadores = [] } = trpc.users.encuestadores.useQuery();
  const { data: metrics = [] } = trpc.fieldMetrics.list.useQuery({
    dateFrom: new Date(selectedDate),
    dateTo: new Date(selectedDate + "T23:59:59"),
    encuestadorId: selectedInterviewer,
  });

  const saveMutation = trpc.fieldMetrics.upsert.useMutation({
    onSuccess: () => {
      utils.fieldMetrics.list.invalidate();
      toast.success("Field report saved");
      setForm({ completed: 0, rejected: 0, substitutions: 0, notes: "" });
    },
    onError: () => toast.error("Error saving"),
  });

  const handleSave = async () => {
    if (!selectedInterviewer) { toast.error("Select an interviewer"); return; }
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
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Register field report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <input type="date" value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Interviewer</label>
              <select value={selectedInterviewer ?? ""}
                onChange={(e) => setSelectedInterviewer(e.target.value ? Number(e.target.value) : undefined)}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Select...</option>
                {encuestadores.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} {e.identifier ? `(${e.identifier})` : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" />Completed
              </label>
              <input type="number" min={0} value={form.completed}
                onChange={(e) => setForm({ ...form, completed: Number(e.target.value) })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring text-center font-semibold" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-600" />Rejected
              </label>
              <input type="number" min={0} value={form.rejected}
                onChange={(e) => setForm({ ...form, rejected: Number(e.target.value) })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring text-center font-semibold" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3 text-amber-600" />Substitutions
              </label>
              <input type="number" min={0} value={form.substitutions}
                onChange={(e) => setForm({ ...form, substitutions: Number(e.target.value) })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring text-center font-semibold" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Incidents, field conditions, notes..." />
          </div>
          <Button onClick={handleSave} disabled={saving || !selectedInterviewer} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Save shift report
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Registered field reports</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">There are no shift reports for the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Interviewer</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-green-600 uppercase tracking-wide">Completed</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-red-600 uppercase tracking-wide">Rejected</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-amber-600 uppercase tracking-wide">Substitutions</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Response rate</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</th>
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
                        <td className="px-3 py-3 text-center"><span className="font-bold text-green-600">{m.completed}</span></td>
                        <td className="px-3 py-3 text-center"><span className="font-bold text-red-600">{m.rejected}</span></td>
                        <td className="px-3 py-3 text-center"><span className="font-bold text-amber-600">{m.substitutions}</span></td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-sm font-semibold ${rate >= 70 ? "text-green-600" : rate >= 50 ? "text-amber-600" : "text-red-600"}`}>{rate}%</span>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground max-w-xs truncate">{m.notes || "—"}</td>
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
// ─── Sesiones de Conteo ────────────────────────────────────────────────────────────────────────────────

function ExportCountingSessionsSection({ exportProjectName }: { exportProjectName: string }) {
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "", encuestadorId: undefined as number | undefined });
  const [separator, setSeparator] = useState<"," | ";" | "\t">(";" );
  const [isExporting, setIsExporting] = useState(false);
  const { data: encuestadores = [] } = trpc.users.encuestadores.useQuery();
  const { refetch } = trpc.exportExtra.csvCountingSessions.useQuery(
    { encuestadorId: filters.encuestadorId, dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined },
    { enabled: false }
  );
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await refetch();
      if (!result.data) { toast.error("There is no data to export"); return; }
      if (result.data.count === 0) { toast.error("There are no counting sessions in the selected range"); return; }
      const dateStr = new Date().toISOString().split("T")[0];
      downloadCsv(result.data.csv, `counting_sessions_${exportProjectName}_${dateStr}.csv`, separator);
      toast.success(`${result.data.count} counting sessions exported`);
    } catch { toast.error("Export failed. Please try again."); }
    finally { setIsExporting(false); }
  };
  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Timer className="h-4 w-4 text-teal-600" />
            Filters — counting sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Interviewer</label>
              <select value={filters.encuestadorId ?? ""} onChange={(e) => setFilters({ ...filters, encuestadorId: e.target.value ? Number(e.target.value) : undefined })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">All interviewers</option>
                {encuestadores.map((e) => <option key={e.id} value={e.id}>{e.name} {e.identifier ? `(${e.identifier})` : ""}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Column separator</label>
            <div className="flex gap-2 flex-wrap">
              {(["," , ";", "\t"] as const).map((val) => (
                <button key={val} onClick={() => setSeparator(val)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    separator === val ? "bg-teal-600 text-white border-teal-600" : "bg-background border-border hover:bg-muted"
                  }`}>{val === "," ? "Comma ," : val === ";" ? "Semicolon ;" : "Tab ⇥"}</button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">The CSV includes: ID, interviewer, point, subpoint, start, end, duration, total people, and GPS.</p>
      <Button onClick={handleExport} disabled={isExporting} variant="outline" className="w-full sm:w-auto border-teal-300 text-teal-700 hover:bg-teal-50">
        {isExporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exporting...</> : <><Download className="h-4 w-4 mr-2" />Download counting sessions CSV</>}
      </Button>
    </div>
  );
}

// ─── Cierres de Turno ────────────────────────────────────────────────────────────────────────────────

function ExportShiftClosuresSection({ exportProjectName }: { exportProjectName: string }) {
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "", encuestadorId: undefined as number | undefined });
  const [separator, setSeparator] = useState<"," | ";" | "\t">(";" );
  const [isExporting, setIsExporting] = useState(false);
  const { data: encuestadores = [] } = trpc.users.encuestadores.useQuery();
  const { refetch } = trpc.exportExtra.csvShiftClosures.useQuery(
    { encuestadorId: filters.encuestadorId, dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined },
    { enabled: false }
  );
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await refetch();
      if (!result.data) { toast.error("There is no data to export"); return; }
      if (result.data.count === 0) { toast.error("There are no shift closures in the selected range"); return; }
      const dateStr = new Date().toISOString().split("T")[0];
      downloadCsv(result.data.csv, `shift_closures_${exportProjectName}_${dateStr}.csv`, separator);
      toast.success(`${result.data.count} shift closures exported`);
    } catch { toast.error("Export failed. Please try again."); }
    finally { setIsExporting(false); }
  };
  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <LogOut className="h-4 w-4 text-purple-600" />
            Filters — shift closures
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Interviewer</label>
              <select value={filters.encuestadorId ?? ""} onChange={(e) => setFilters({ ...filters, encuestadorId: e.target.value ? Number(e.target.value) : undefined })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">All interviewers</option>
                {encuestadores.map((e) => <option key={e.id} value={e.id}>{e.name} {e.identifier ? `(${e.identifier})` : ""}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Column separator</label>
            <div className="flex gap-2 flex-wrap">
              {(["," , ";", "\t"] as const).map((val) => (
                <button key={val} onClick={() => setSeparator(val)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    separator === val ? "bg-purple-600 text-white border-purple-600" : "bg-background border-border hover:bg-muted"
                  }`}>{val === "," ? "Comma ," : val === ";" ? "Semicolon ;" : "Tab ⇥"}</button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">The CSV includes: interviewer, closing date and time, total surveys, counts, rejections, point, type, rating, and incidents.</p>
      <Button onClick={handleExport} disabled={isExporting} variant="outline" className="w-full sm:w-auto border-purple-300 text-purple-700 hover:bg-purple-50">
        {isExporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exporting...</> : <><Download className="h-4 w-4 mr-2" />Download shift closures CSV</>}
      </Button>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────────────────

export default function Exportar() {
  const [tab, setTab] = useState<"export" | "conteos" | "sessions" | "closures" | "metrics">("export");
  const { data: appSettings } = trpc.appSettings.get.useQuery();
  const exportProjectName = (appSettings?.exportProjectName || "survexia").trim().toLowerCase();

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exportación y métricas</h1>
          <p className="text-muted-foreground text-sm mt-1">Descarga datos para su análisis en SPSS, Excel o GIS</p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap rounded-lg border border-border overflow-hidden w-fit">
          <button onClick={() => setTab("export")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === "export" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"
            }`}>
            <FileDown className="h-4 w-4" />Encuestas
          </button>
          <button onClick={() => setTab("conteos")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === "conteos" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"
            }`}>
            <PersonStanding className="h-4 w-4" />Counts
          </button>
          <button onClick={() => setTab("sessions")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === "sessions" ? "bg-teal-600 text-white" : "bg-background text-foreground hover:bg-muted"
            }`}>
            <Timer className="h-4 w-4" />Sessions
          </button>
          <button onClick={() => setTab("closures")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === "closures" ? "bg-purple-600 text-white" : "bg-background text-foreground hover:bg-muted"
            }`}>
            <LogOut className="h-4 w-4" />Cierres de turno
          </button>
          <button onClick={() => setTab("metrics")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === "metrics" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"
            }`}>
            <ClipboardList className="h-4 w-4" />Field reports
          </button>
        </div>

        {tab === "export" && <ExportEncuestasSection exportProjectName={exportProjectName} />}
        {tab === "conteos" && <ExportConteosSection exportProjectName={exportProjectName} />}
        {tab === "sessions" && <ExportCountingSessionsSection exportProjectName={exportProjectName} />}
        {tab === "closures" && <ExportShiftClosuresSection exportProjectName={exportProjectName} />}
        {tab === "metrics" && <FieldMetricsSection />}
      </div>
    </DashboardLayout>
  );
}
