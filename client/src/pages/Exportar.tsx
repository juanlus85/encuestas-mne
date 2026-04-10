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
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

// ─── Definición de campos exportables ────────────────────────────────────────

type FieldDef = { key: string; label: string; group: string; defaultOn: boolean };

const META_FIELDS: FieldDef[] = [
  { key: "ID",               label: "ID encuesta",                group: "Metadatos",   defaultOn: true },
  { key: "Tipo",             label: "Tipo (visitantes/residentes)", group: "Metadatos",  defaultOn: true },
  { key: "Encuestador",      label: "Nombre encuestador",          group: "Metadatos",   defaultOn: true },
  { key: "CodEncuestador",   label: "Código encuestador",          group: "Metadatos",   defaultOn: true },
  { key: "PuntoEncuesta",    label: "Punto de encuesta",           group: "Metadatos",   defaultOn: true },
  { key: "FranjaHoraria",    label: "Franja horaria",              group: "Metadatos",   defaultOn: true },
  { key: "VentanaMedia",     label: "Ventana 30 min",              group: "Metadatos",   defaultOn: false },
  { key: "MinutoInicio",     label: "Minuto inicio entrevista",    group: "Metadatos",   defaultOn: false },
  { key: "MinutoFin",        label: "Minuto fin entrevista",       group: "Metadatos",   defaultOn: false },
  { key: "Inicio",           label: "Fecha/hora inicio",           group: "Metadatos",   defaultOn: true },
  { key: "Fin",              label: "Fecha/hora fin",              group: "Metadatos",   defaultOn: false },
  { key: "DuracionMin",      label: "Duración (minutos)",          group: "Metadatos",   defaultOn: false },
  { key: "Idioma",           label: "Idioma encuesta",             group: "Metadatos",   defaultOn: false },
  { key: "Estado",           label: "Estado (completa/incompleta)", group: "Metadatos",  defaultOn: true },
  { key: "SalidaAnticipada", label: "Salida anticipada (residentes)", group: "Metadatos", defaultOn: true },
  { key: "Latitud",          label: "Latitud GPS",                 group: "Metadatos",   defaultOn: false },
  { key: "Longitud",         label: "Longitud GPS",                group: "Metadatos",   defaultOn: false },
  { key: "GPS_m",            label: "Precisión GPS (m)",           group: "Metadatos",   defaultOn: false },
];

const V_LABELS: [string, string][] = [
  ["v_p01", "V_P01 · País de residencia"],
  ["v_p02", "V_P02 · Provincia/Ciudad (si España)"],
  ["v_p03", "V_P03 · Nº visitas a Sevilla"],
  ["v_p04", "V_P04 · Días en Sevilla"],
  ["v_p05", "V_P05 · Rango de edad"],
  ["v_p06", "V_P06 · Género"],
  ["v_p07", "V_P07 · Tipo de alojamiento"],
  ["v_p08", "V_P08 · Zona de alojamiento"],
  ["v_p09", "V_P09 · Motivo principal de la visita"],
  ["v_p10", "V_P10 · Tamaño del grupo"],
  ["v_p11", "V_P11 · Tiempo en este lugar (min)"],
  ["v_p12", "V_P12 · Actividad principal"],
  ["v_p13", "V_P13 · Gasto aproximado hoy"],
  ["v_p14", "V_P14 · Densidad percibida (1-5)"],
  ["v_p15", "V_P15 · Satisfacción general (1-5)"],
  ["v_p16", "V_P16 · Adaptación del espacio (1-5)"],
  ["v_p17", "V_P17 · ¿Volvería?"],
  ["v_p18", "V_P18 · ¿Recomendaría?"],
  ["v_p19", "V_P19 · Comentario libre"],
  ["v_p20", "V_P20 · Nombre (opcional)"],
];

const R_LABELS: [string, string][] = [
  ["r_p01", "R_P01 · ¿Reside habitualmente en este barrio?"],
  ["r_p02", "R_P02 · ¿En qué calle?"],
  ["r_p03", "R_P03 · Años viviendo en el barrio"],
  ["r_p04", "R_P04 · ¿Percibe beneficios económicos del turismo?"],
  ["r_p05", "R_P05 · Género"],
  ["r_p06", "R_P06 · Edad"],
  ["r_p07", "R_P07 · P6.01 Turismo mejora economía local (1-5)"],
  ["r_p08", "R_P08 · P6.02 Turismo genera congestión (1-5)"],
  ["r_p09", "R_P09 · P6.03 Turismo atrae inversores (1-5)"],
  ["r_p10", "R_P10 · P6.04 Turismo encarece viviendas (1-5)"],
  ["r_p11", "R_P11 · P6.05 Turismo aumenta calidad de vida (1-5)"],
  ["r_p12", "R_P12 · P6.06 Turismo provoca desplazamientos (1-5)"],
  ["r_p13", "R_P13 · P6.07 Turismo mejora imagen ciudad (1-5)"],
  ["r_p14", "R_P14 · P6.08 Turismo pérdida de identidad (1-5)"],
  ["r_p15", "R_P15 · P6.09 Turismo conserva monumentos (1-5)"],
  ["r_p16", "R_P16 · P6.10 Turismo genera ruido/suciedad (1-5)"],
  ["r_p17", "R_P17 · P6.11 Turismo dificulta comercio local (1-5)"],
  ["r_p18", "R_P18 · P6.12 Turismo mejora oferta cultural (1-5)"],
  ["r_p19", "R_P19 · P6.13 Turismo encarece coste de vida (1-5)"],
  ["r_p20", "R_P20 · P6.14 Turismo fomenta inseguridad (1-5)"],
  ["r_p21", "R_P21 · P7 Valoración gestión turismo barrio (1-5)"],
  ["r_p22", "R_P22 · P8 ¿Hay demasiados turistas? (1-5)"],
  ["r_p23", "R_P23 · P9 ¿Ha pensado en mudarse por el turismo?"],
  ["r_p24", "R_P24 · P10 Frecuencia uso espacio público"],
  ["r_p25", "R_P25 · P10b Frecuencia uso en verano"],
  ["r_p26", "R_P26 · P10c Frecuencia uso en invierno"],
  ["r_p27", "R_P27 · P10d Frecuencia uso fines de semana"],
  ["r_p28", "R_P28 · P10e Motivo reducción de uso"],
  ["r_p29", "R_P29 · P10f Problemas en espacio público"],
  ["r_p30", "R_P30 · P10g Valoración espacio público (1-5)"],
  ["r_p31", "R_P31 · P10h Valoración limpieza (1-5)"],
  ["r_p32", "R_P32 · P10i Valoración seguridad (1-5)"],
  ["r_p33", "R_P33 · P11 ¿Cómo le afecta el turismo? (1-5)"],
  ["r_p34", "R_P34 · P12 ¿Cómo afecta el turismo a su comunidad? (1-5)"],
  ["r_p35a", "R_P35a · P13 Medida prioritaria 1 (múltiple)"],
  ["r_p35b", "R_P35b · P13 Medida prioritaria 2 (múltiple)"],
  ["r_p35c", "R_P35c · P13 Medida prioritaria 3 (múltiple)"],
  ["r_p36", "R_P36 · P14 Observaciones finales"],
];

const CONTEO_FIELDS: FieldDef[] = [
  { key: "ID",              label: "ID registro",                   group: "Conteos", defaultOn: true },
  { key: "Fecha",           label: "Fecha",                         group: "Conteos", defaultOn: true },
  { key: "Hora",            label: "Hora",                          group: "Conteos", defaultOn: true },
  { key: "Tramo30min",      label: "Tramo 30 min",                  group: "Conteos", defaultOn: true },
  { key: "Punto_Nombre",    label: "Punto de conteo (nombre)",      group: "Conteos", defaultOn: true },
  { key: "Punto_Codigo",    label: "Punto de conteo (código)",      group: "Conteos", defaultOn: true },
  { key: "Sentido",         label: "Sentido (etiqueta completa)",   group: "Conteos", defaultOn: true },
  { key: "Origen_Codigo",   label: "Código origen del flujo",       group: "Conteos", defaultOn: true },
  { key: "Destino_Codigo",  label: "Código destino del flujo",      group: "Conteos", defaultOn: true },
  { key: "Encuestador",     label: "Nombre encuestador",            group: "Conteos", defaultOn: true },
  { key: "Identificador",   label: "Código encuestador",            group: "Conteos", defaultOn: true },
  { key: "Personas",        label: "Número de personas",            group: "Conteos", defaultOn: true },
  { key: "Latitud",         label: "Latitud GPS",                   group: "Conteos", defaultOn: false },
  { key: "Longitud",        label: "Longitud GPS",                  group: "Conteos", defaultOn: false },
  { key: "Precision_GPS_m", label: "Precisión GPS (m)",             group: "Conteos", defaultOn: false },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadCsv(csvContent: string, filename: string, separator: "," | ";" | "\t") {
  let content = csvContent;
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
            {fields.filter(f => selected.has(f.key)).length}/{fields.length} seleccionados
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

function ExportEncuestasSection() {
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    encuestadorId: undefined as number | undefined,
    templateId: undefined as number | undefined,
  });
  const [separator, setSeparator] = useState<"," | ";" | "\t">(";");
  const [isExporting, setIsExporting] = useState(false);

  // Campos seleccionados
  const defaultSelected = useMemo(() => {
    const s = new Set<string>();
    META_FIELDS.filter(f => f.defaultOn).forEach(f => s.add(f.key));
    V_LABELS.forEach(([key]) => s.add(key));
    R_LABELS.forEach(([key]) => s.add(key));
    return s;
  }, []);
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
  const { data: templates = [] } = trpc.templates.list.useQuery();

  const { refetch } = trpc.export.csv.useQuery(
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

      // Filtrar columnas según selección
      const allHeaders = [
        ...META_FIELDS.map(f => f.key),
        ...V_LABELS.map(([k]) => k.toUpperCase().replace("_", "_")),
        ...R_LABELS.map(([k]) => k.toUpperCase().replace("_", "_")),
      ];
      // Mapear claves del CSV a nuestras keys
      const csvHeaderMap: Record<string, string> = {
        "ID": "ID", "Tipo": "Tipo", "Encuestador": "Encuestador", "CodEncuestador": "CodEncuestador",
        "PuntoEncuesta": "PuntoEncuesta", "FranjaHoraria": "FranjaHoraria", "VentanaMedia": "VentanaMedia",
        "MinutoInicio": "MinutoInicio", "MinutoFin": "MinutoFin", "Inicio": "Inicio", "Fin": "Fin",
        "DuracionMin": "DuracionMin", "Idioma": "Idioma", "Estado": "Estado",
        "SalidaAnticipada": "SalidaAnticipada", "Latitud": "Latitud", "Longitud": "Longitud", "GPS_m": "GPS_m",
      };
      V_LABELS.forEach(([k]) => { csvHeaderMap[`V_P${k.slice(-2).toUpperCase()}`] = k; });
      R_LABELS.forEach(([k]) => {
        const upper = k.replace("r_p", "R_P").replace("a", "a").replace("b", "b").replace("c", "c");
        csvHeaderMap[upper] = k;
      });

      const lines = result.data.csv.split("\n");
      if (lines.length === 0) { toast.error("CSV vacío"); return; }

      const originalHeaders = lines[0].split(",").map(h => h.replace(/^"|"$/g, ""));
      const keepIndices = originalHeaders
        .map((h, i) => {
          const key = csvHeaderMap[h] ?? h;
          return selectedFields.has(key) ? i : -1;
        })
        .filter(i => i >= 0);

      const filteredLines = lines.map(line => {
        const cells = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
        return keepIndices.map(i => cells[i] ?? '""').join(",");
      });

      const dateStr = new Date().toISOString().split("T")[0];
      downloadCsv(filteredLines.join("\n"), `Encuestas_Sevilla_${dateStr}.csv`, separator);
      toast.success(`Exportadas ${result.data.count} encuestas (${keepIndices.length} columnas)`);
    } catch {
      toast.error("Error al exportar. Inténtelo de nuevo.");
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
            <FileDown className="h-4 w-4 text-primary" />
            Filtros de exportación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Desde</label>
              <input type="date" value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Hasta</label>
              <input type="date" value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Encuestador</label>
              <select value={filters.encuestadorId ?? ""}
                onChange={(e) => setFilters({ ...filters, encuestadorId: e.target.value ? Number(e.target.value) : undefined })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Todos los encuestadores</option>
                {encuestadores.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} {e.identifier ? `(${e.identifier})` : ""}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo de encuesta</label>
              <select value={filters.templateId ?? ""}
                onChange={(e) => setFilters({ ...filters, templateId: e.target.value ? Number(e.target.value) : undefined })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Todos los tipos</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Separador de columnas</label>
            <div className="flex gap-2 flex-wrap">
              {([["," , "Coma  ,"], [";", "Punto y coma  ;"], ["\t", "Tabulador  ⇥"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => setSeparator(val)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    separator === val ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
                  }`}>{label}</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Usa <strong>punto y coma</strong> si abres el CSV con Excel en español.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Selección de campos */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Campos a exportar</CardTitle>
            <div className="flex gap-2">
              <button onClick={() => {
                const all = new Set<string>();
                META_FIELDS.forEach(f => all.add(f.key));
                V_LABELS.forEach(([k]) => all.add(k));
                R_LABELS.forEach(([k]) => all.add(k));
                setSelectedFields(all);
              }} className="text-xs text-primary hover:underline">Todos</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={() => setSelectedFields(new Set())} className="text-xs text-muted-foreground hover:underline">Ninguno</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={() => setSelectedFields(defaultSelected)} className="text-xs text-muted-foreground hover:underline">Por defecto</button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedFields.size} campos seleccionados de {META_FIELDS.length + V_LABELS.length + R_LABELS.length}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <FieldCheckboxGroup
            title="Metadatos de la encuesta"
            fields={META_FIELDS.map(f => ({ key: f.key, label: f.label }))}
            selected={selectedFields}
            onChange={toggleField}
          />
          <FieldCheckboxGroup
            title="Preguntas Visitantes (V_P01 – V_P20)"
            fields={V_LABELS.map(([k, l]) => ({ key: k, label: l }))}
            selected={selectedFields}
            onChange={toggleField}
          />
          <FieldCheckboxGroup
            title="Preguntas Residentes (R_P01 – R_P36)"
            fields={R_LABELS.map(([k, l]) => ({ key: k, label: l }))}
            selected={selectedFields}
            onChange={toggleField}
          />
        </CardContent>
      </Card>

      <Button onClick={handleExport} disabled={isExporting || selectedFields.size === 0} className="w-full sm:w-auto">
        {isExporting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exportando...</>
        ) : (
          <><Download className="h-4 w-4 mr-2" />Descargar CSV ({selectedFields.size} columnas)</>
        )}
      </Button>
    </div>
  );
}

// ─── Exportar Conteos ─────────────────────────────────────────────────────────

function ExportConteosSection() {
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
      if (!result.data) { toast.error("No hay datos para exportar"); return; }

      const lines = result.data.csv.split("\n");
      if (lines.length === 0) { toast.error("CSV vacío"); return; }

      const originalHeaders = lines[0].split(",").map(h => h.replace(/^"|"$/g, ""));
      const keepIndices = originalHeaders
        .map((h, i) => selectedFields.has(h) ? i : -1)
        .filter(i => i >= 0);

      const filteredLines = lines.map(line => {
        const cells = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
        return keepIndices.map(i => cells[i] ?? '""').join(",");
      });

      const dateStr = new Date().toISOString().split("T")[0];
      downloadCsv(filteredLines.join("\n"), `Conteos_Sevilla_${dateStr}.csv`, separator);
      toast.success(`Exportados ${result.data.count} registros (${keepIndices.length} columnas)`);
    } catch {
      toast.error("Error al exportar. Inténtelo de nuevo.");
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
            Filtros de exportación de conteos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Desde</label>
              <input type="date" value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Hasta</label>
              <input type="date" value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Encuestador</label>
              <select value={filters.encuestadorId ?? ""}
                onChange={(e) => setFilters({ ...filters, encuestadorId: e.target.value ? Number(e.target.value) : undefined })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Todos los encuestadores</option>
                {encuestadores.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} {e.identifier ? `(${e.identifier})` : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Separador de columnas</label>
            <div className="flex gap-2 flex-wrap">
              {([["," , "Coma  ,"], [";", "Punto y coma  ;"], ["\t", "Tabulador  ⇥"]] as const).map(([val, label]) => (
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
            <CardTitle className="text-base font-semibold">Campos a exportar</CardTitle>
            <div className="flex gap-2">
              <button onClick={() => setSelectedFields(new Set(CONTEO_FIELDS.map(f => f.key)))} className="text-xs text-primary hover:underline">Todos</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={() => setSelectedFields(new Set())} className="text-xs text-muted-foreground hover:underline">Ninguno</button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedFields.size} campos seleccionados de {CONTEO_FIELDS.length}
          </p>
        </CardHeader>
        <CardContent>
          <FieldCheckboxGroup
            title="Campos de conteo peatonal"
            fields={CONTEO_FIELDS.map(f => ({ key: f.key, label: f.label }))}
            selected={selectedFields}
            onChange={toggleField}
          />
        </CardContent>
      </Card>

      <Button onClick={handleExport} disabled={isExporting || selectedFields.size === 0}
        variant="outline" className="w-full sm:w-auto border-amber-300 text-amber-700 hover:bg-amber-50">
        {isExporting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exportando...</>
        ) : (
          <><Download className="h-4 w-4 mr-2" />Descargar CSV conteos ({selectedFields.size} columnas)</>
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
  const [selectedEncuestador, setSelectedEncuestador] = useState<number | undefined>();
  const [form, setForm] = useState({ completed: 0, rejected: 0, substitutions: 0, notes: "" });
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
              <input type="date" value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Encuestador</label>
              <select value={selectedEncuestador ?? ""}
                onChange={(e) => setSelectedEncuestador(e.target.value ? Number(e.target.value) : undefined)}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
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
              <input type="number" min={0} value={form.completed}
                onChange={(e) => setForm({ ...form, completed: Number(e.target.value) })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring text-center font-semibold" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-600" />Rechazadas
              </label>
              <input type="number" min={0} value={form.rejected}
                onChange={(e) => setForm({ ...form, rejected: Number(e.target.value) })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring text-center font-semibold" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3 text-amber-600" />Sustituciones
              </label>
              <input type="number" min={0} value={form.substitutions}
                onChange={(e) => setForm({ ...form, substitutions: Number(e.target.value) })}
                className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring text-center font-semibold" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Observaciones</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Incidencias, condiciones del campo, observaciones..." />
          </div>
          <Button onClick={handleSave} disabled={saving || !selectedEncuestador} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Guardar parte
          </Button>
        </CardContent>
      </Card>

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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Exportar() {
  const [tab, setTab] = useState<"export" | "conteos" | "metrics">("export");

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exportación y Métricas</h1>
          <p className="text-muted-foreground text-sm mt-1">Descarga de datos para análisis en SPSS, Excel o SIG</p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg border border-border overflow-hidden w-fit">
          <button onClick={() => setTab("export")}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors ${
              tab === "export" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"
            }`}>
            <FileDown className="h-4 w-4" />Encuestas
          </button>
          <button onClick={() => setTab("conteos")}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors ${
              tab === "conteos" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"
            }`}>
            <PersonStanding className="h-4 w-4" />Conteos
          </button>
          <button onClick={() => setTab("metrics")}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors ${
              tab === "metrics" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"
            }`}>
            <ClipboardList className="h-4 w-4" />Partes de campo
          </button>
        </div>

        {tab === "export" && <ExportEncuestasSection />}
        {tab === "conteos" && <ExportConteosSection />}
        {tab === "metrics" && <FieldMetricsSection />}
      </div>
    </DashboardLayout>
  );
}
