import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const QUESTION_TYPES = [
  { value: "single_choice", label: "Single choice" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "yes_no", label: "Yes / No" },
  { value: "scale", label: "Scale (1-5)" },
  { value: "text", label: "Free text" },
  { value: "number", label: "Number" },
];

function QuestionForm({
  templateId,
  order,
  onCreated,
}: {
  templateId: number;
  order: number;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    text: "",
    textEn: "",
    type: "single_choice",
    isRequired: true,
    requiresPhoto: false,
    options: [{ value: "opt1", label: "", labelEn: "" }],
  });

  const createMutation = trpc.questions.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      onCreated();
      toast.success("Question added");
    },
    onError: () => toast.error("Error creating question"),
  });

  const hasOptions = ["single_choice", "multiple_choice"].includes(form.type);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      templateId,
      order,
      text: form.text,
      textEn: form.textEn || undefined,
      type: form.type as any,
      isRequired: form.isRequired,
      requiresPhoto: form.requiresPhoto,
      options: hasOptions ? form.options.filter((o) => o.label.trim()) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full border-dashed">
          <Plus className="h-4 w-4 mr-1.5" />
          Add question
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New question</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium block mb-1.5">Text (default) *</label>
            <textarea
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              required
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="How many years have you lived in the neighbourhood?"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">English text</label>
            <textarea
              value={form.textEn}
              onChange={(e) => setForm({ ...form, textEn: e.target.value })}
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="How many years have you lived in the neighbourhood?"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Question type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {hasOptions && (
            <div>
              <label className="text-sm font-medium block mb-2">Answer options</label>
              <div className="space-y-2">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => {
                        const updated = [...form.options];
                        updated[i] = { ...updated[i], label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, "_") };
                        setForm({ ...form, options: updated });
                      }}
                      className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder={`Option ${i + 1}`}
                    />
                    <input
                      type="text"
                      value={opt.labelEn}
                      onChange={(e) => {
                        const updated = [...form.options];
                        updated[i] = { ...updated[i], labelEn: e.target.value };
                        setForm({ ...form, options: updated });
                      }}
                      className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder={`Option ${i + 1} (secondary)`}
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}
                      className="text-destructive hover:text-destructive/80 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm({ ...form, options: [...form.options, { value: `opt${form.options.length + 1}`, label: "", labelEn: "" }] })}
                >
                  <Plus className="h-3 w-3 mr-1" />Add option
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isRequired}
                onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
                className="rounded"
              />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.requiresPhoto}
                onChange={(e) => setForm({ ...form, requiresPhoto: e.target.checked })}
                className="rounded"
              />
              Requires photo
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save question"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({ template, onRefresh }: { template: any; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { data: questions = [] } = trpc.questions.byTemplate.useQuery(
    { templateId: template.id },
    { enabled: expanded }
  );

  const toggleMutation = trpc.templates.update.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Template updated"); },
  });

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                template.type === "residentes" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
              }`}>
                {template.type === "residentes" ? "Residents" : "Visitors"}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                template.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
              }`}>
                {template.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <CardTitle className="text-base">{template.nameEn || template.name}</CardTitle>
            {(template.descriptionEn || template.description) && (
              <p className="text-sm text-muted-foreground mt-1">{template.descriptionEn || template.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleMutation.mutate({ id: template.id, isActive: !template.isActive })}
              className="text-xs"
            >
              {template.isActive ? "Deactivate" : "Activate"}
            </Button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-3">
          <div className="h-px bg-border" />
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">There are no questions yet. Add the first one.</p>
          ) : (
            <div className="space-y-2">
              {questions.map((q: any, i: number) => (
                <div key={q.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <span className="text-xs font-bold text-muted-foreground w-5 shrink-0 mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{q.textEn || q.text}</p>
                    {q.textEn && q.text !== q.textEn && <p className="text-xs text-muted-foreground italic mt-0.5">Default: {q.text}</p>}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {QUESTION_TYPES.find((t) => t.value === q.type)?.label ?? q.type}
                      </span>
                      {q.isRequired && <span className="text-xs text-red-600">Required</span>}
                      {q.requiresPhoto && <span className="text-xs text-blue-600">📷 Photo</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <QuestionForm
            templateId={template.id}
            order={questions.length + 1}
            onCreated={() => { onRefresh(); }}
          />
        </CardContent>
      )}
    </Card>
  );
}

function CreateTemplateDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", nameEn: "", description: "", type: "visitantes" as "residentes" | "visitantes" });

  const createMutation = trpc.templates.create.useMutation({
    onSuccess: () => { setOpen(false); onCreated(); toast.success("Template created"); },
    onError: () => toast.error("Error creating template"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />New template</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New survey template</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium block mb-1.5">Default name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Residents Survey - Santa Cruz District" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">English name</label>
            <input type="text" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Residents Survey - Santa Cruz District" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="residentes">Residents (stratified sampling)</option>
              <option value="visitantes">Visitors (systematic sampling)</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Short survey description..." />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Configuracion() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: templates = [], isLoading } = trpc.templates.list.useQuery();
  const { data: countingPoints = [] } = trpc.countingPoints.list.useQuery();
  const { data: appSettings } = trpc.appSettings.get.useQuery();

  const chartOptions = [
    { key: "overview", label: "Resumen general" },
    { key: "survey_targets", label: "Progreso de objetivos" },
    { key: "survey_by_type", label: "Encuestas por tipo" },
    { key: "survey_by_point", label: "Encuestas por punto" },
    { key: "survey_by_interviewer", label: "Encuestas por encuestador" },
    { key: "survey_by_day", label: "Encuestas por día" },
    { key: "rejections_overview", label: "Resumen de rechazos" },
    { key: "rejections_by_type", label: "Rechazos por tipo" },
  ];

  const [projectName, setProjectName] = useState("");
  const [exportProjectName, setExportProjectName] = useState("");
  const [mapPrimaryPointCode, setMapPrimaryPointCode] = useState("");
  const [surveyTargetTotal, setSurveyTargetTotal] = useState(0);
  const [surveyTargetResidents, setSurveyTargetResidents] = useState(0);
  const [surveyTargetVisitors, setSurveyTargetVisitors] = useState(0);
  const [surveyWeeklyTargetTotal, setSurveyWeeklyTargetTotal] = useState(0);
  const [surveyWeeklyTargetResidents, setSurveyWeeklyTargetResidents] = useState(0);
  const [surveyWeeklyTargetVisitors, setSurveyWeeklyTargetVisitors] = useState(0);
  const [quotasEnabled, setQuotasEnabled] = useState(true);
  const [residentQuotaTotal, setResidentQuotaTotal] = useState(0);
  const [visitorQuotaTotal, setVisitorQuotaTotal] = useState(0);
  const [enabledCharts, setEnabledCharts] = useState<string[]>([]);
  const [openAiApiKey, setOpenAiApiKey] = useState("");

  const saveSettings = trpc.appSettings.update.useMutation({
    onSuccess: async () => {
      await utils.appSettings.get.invalidate();
      toast.success("Configuración guardada correctamente");
    },
    onError: (error) => toast.error(`Error al guardar la configuración: ${error.message}`),
  });

  const effectiveMapPrimaryPointCode = mapPrimaryPointCode || appSettings?.mapPrimaryPointCode || "";

  const deploymentVersion = import.meta.env.VITE_APP_VERSION || "v-dev";
  const deploymentDateRaw = import.meta.env.VITE_BUILD_DATE || new Date().toISOString();
  const deploymentDate = Number.isNaN(new Date(deploymentDateRaw).getTime())
    ? deploymentDateRaw
    : new Intl.DateTimeFormat("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(deploymentDateRaw));

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Acceso restringido solo para administradores.</p>
        </div>
      </DashboardLayout>
    );
  }

  const refresh = () => utils.templates.list.invalidate();

  useEffect(() => {
    if (!appSettings) return;
    setProjectName(appSettings.projectName ?? "");
    setExportProjectName(appSettings.exportProjectName ?? "");
    setMapPrimaryPointCode(appSettings.mapPrimaryPointCode ?? "");
    setSurveyTargetTotal(appSettings.surveyTargetTotal ?? 0);
    setSurveyTargetResidents(appSettings.surveyTargetResidents ?? 0);
    setSurveyTargetVisitors(appSettings.surveyTargetVisitors ?? 0);
    setSurveyWeeklyTargetTotal(appSettings.surveyWeeklyTargetTotal ?? 0);
    setSurveyWeeklyTargetResidents(appSettings.surveyWeeklyTargetResidents ?? 0);
    setSurveyWeeklyTargetVisitors(appSettings.surveyWeeklyTargetVisitors ?? 0);
    setQuotasEnabled(appSettings.quotasEnabled ?? true);
    setResidentQuotaTotal(appSettings.residentQuotaTotal ?? 0);
    setVisitorQuotaTotal(appSettings.visitorQuotaTotal ?? 0);
    setEnabledCharts(appSettings.enabledCharts ?? []);
    setOpenAiApiKey(appSettings.openAiApiKey ?? "");
  }, [appSettings]);

  const toggleChart = (chartKey: string, checked: boolean) => {
    setEnabledCharts((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, chartKey]));
      }
      return prev.filter((item) => item !== chartKey);
    });
  };

  const saveProjectSettings = () => {
    saveSettings.mutate({
      projectName,
      exportProjectName,
      mapPrimaryPointCode: mapPrimaryPointCode || null,
      surveyTargetTotal,
      surveyTargetResidents,
      surveyTargetVisitors,
      surveyWeeklyTargetTotal,
      surveyWeeklyTargetResidents,
      surveyWeeklyTargetVisitors,
      quotasEnabled,
      residentQuotaTotal,
      visitorQuotaTotal,
      enabledCharts,
      openAiApiKey,
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestiona la configuración general del proyecto, los objetivos, las cuotas, las visualizaciones y las plantillas de encuestas.
            </p>
          </div>
          <CreateTemplateDialog onCreated={refresh} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Proyecto y exportaciones</CardTitle>
              <p className="text-sm text-muted-foreground">
                Define el nombre visible del proyecto y el texto base que se utilizará en los archivos exportados.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Nombre del proyecto</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Survexia"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Nombre para exportaciones</label>
                <input
                  type="text"
                  value={exportProjectName}
                  onChange={(e) => setExportProjectName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="survexia"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Se utilizará como base en los nombres de los archivos CSV descargables.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Punto principal del mapa</CardTitle>
              <p className="text-sm text-muted-foreground">
                Selecciona el punto que se usará por defecto como foco inicial en los mapas del sistema.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Punto principal</label>
                <select
                  value={effectiveMapPrimaryPointCode}
                  onChange={(e) => setMapPrimaryPointCode(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecciona un punto</option>
                  {countingPoints.map((point) => (
                    <option key={point.code} value={point.code}>{point.fullName}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-muted-foreground">
                  Este punto se utilizará para centrar el mapa de campo y el mapa de conteos cuando exista información GPS disponible.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Objetivos de encuestas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configura tanto el objetivo global final como el objetivo semanal para el seguimiento del proyecto.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Objetivo total</label>
                  <input type="number" min={0} value={surveyTargetTotal} onChange={(e) => setSurveyTargetTotal(Number(e.target.value) || 0)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Residentes</label>
                  <input type="number" min={0} value={surveyTargetResidents} onChange={(e) => setSurveyTargetResidents(Number(e.target.value) || 0)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Visitantes</label>
                  <input type="number" min={0} value={surveyTargetVisitors} onChange={(e) => setSurveyTargetVisitors(Number(e.target.value) || 0)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Objetivo semanal total</label>
                  <input type="number" min={0} value={surveyWeeklyTargetTotal} onChange={(e) => setSurveyWeeklyTargetTotal(Number(e.target.value) || 0)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Semanal residentes</label>
                  <input type="number" min={0} value={surveyWeeklyTargetResidents} onChange={(e) => setSurveyWeeklyTargetResidents(Number(e.target.value) || 0)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Semanal visitantes</label>
                  <input type="number" min={0} value={surveyWeeklyTargetVisitors} onChange={(e) => setSurveyWeeklyTargetVisitors(Number(e.target.value) || 0)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cuotas y visualizaciones</CardTitle>
              <p className="text-sm text-muted-foreground">
                Controla si el panel de cuotas está activo y qué gráficos estarán disponibles en estadísticas.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="flex items-start gap-3 rounded-lg border border-border px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={quotasEnabled}
                  onChange={(e) => setQuotasEnabled(e.target.checked)}
                  className="mt-0.5 rounded"
                />
                <span>
                  <span className="block font-medium text-foreground">Activar módulo de cuotas</span>
                  <span className="text-muted-foreground">Si se desactiva, el panel puede ocultarse o mostrarse solo como información general.</span>
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Cuota total de residentes</label>
                  <input type="number" min={0} value={residentQuotaTotal} onChange={(e) => setResidentQuotaTotal(Number(e.target.value) || 0)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Cuota total de visitantes</label>
                  <input type="number" min={0} value={visitorQuotaTotal} onChange={(e) => setVisitorQuotaTotal(Number(e.target.value) || 0)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Gráficos habilitados en estadísticas</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {chartOptions.map((chart) => (
                    <label key={chart.key} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={enabledCharts.includes(chart.key)}
                        onChange={(e) => toggleChart(chart.key, e.target.checked)}
                        className="rounded"
                      />
                      <span>{chart.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm xl:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Integraciones y control de versión</CardTitle>
              <p className="text-sm text-muted-foreground">
                Guarda la clave API de OpenAI del proyecto y consulta la versión desplegada en la aplicación.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Clave API de OpenAI</label>
                <input
                  type="password"
                  value={openAiApiKey}
                  onChange={(e) => setOpenAiApiKey(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="sk-..."
                />
              </div>
              <div className="flex justify-end">
                <p className="text-right text-xs text-muted-foreground">
                  Versión {deploymentVersion}. {deploymentDate}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={saveProjectSettings} disabled={saveSettings.isPending || !effectiveMapPrimaryPointCode}>
            {saveSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar configuración"}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : templates.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">Todavía no hay plantillas.</p>
            <p className="mt-1 text-xs">Crea una plantilla para empezar a configurar las preguntas de la encuesta.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Plantillas de encuestas</h2>
              <p className="mt-1 text-sm text-muted-foreground">Gestiona las plantillas activas y la estructura de preguntas disponibles para cada tipo de encuesta.</p>
            </div>
            {templates.map((t) => (
              <TemplateCard key={t.id} template={t} onRefresh={refresh} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
