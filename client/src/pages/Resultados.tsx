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
  Camera,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  Loader2,
  MapPin,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Filters ──────────────────────────────────────────────────────────────────

function FilterBar({
  encuestadores,
  templates,
  filters,
  onChange,
}: {
  encuestadores: any[];
  templates: any[];
  filters: any;
  onChange: (f: any) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">From</label>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">To</label>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Interviewer</label>
        <select
          value={filters.encuestadorId ?? ""}
          onChange={(e) => onChange({ ...filters, encuestadorId: e.target.value ? Number(e.target.value) : undefined })}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All</option>
          {encuestadores.map((e) => (
            <option key={e.id} value={e.id}>{e.name} {e.identifier ? `(${e.identifier})` : ""}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Type</label>
        <select
          value={filters.templateId ?? ""}
          onChange={(e) => onChange({ ...filters, templateId: e.target.value ? Number(e.target.value) : undefined })}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange({ dateFrom: "", dateTo: "", encuestadorId: undefined, templateId: undefined })}
      >
        Clear
      </Button>
    </div>
  );
}

// ─── Response row ─────────────────────────────────────────────────────────────

function formatAnswerForInput(answer: any, type: string) {
  if (type === "multiple_choice") return Array.isArray(answer) ? answer : [];
  if (answer === null || answer === undefined) return "";
  return String(answer);
}

function EditResponseDialog({ response, onSaved }: { response: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [surveyPoint, setSurveyPoint] = useState("");
  const [status, setStatus] = useState<"completa" | "incompleta" | "rechazada" | "sustitucion">("completa");
  const [language, setLanguage] = useState<"es" | "en">("en");
  const [answers, setAnswers] = useState<Record<number, any>>({});

  const detailQuery = trpc.responses.byId.useQuery({ id: response.id }, { enabled: open });
  const templateQuery = trpc.templates.byId.useQuery({ id: response.templateId }, { enabled: open });

  useEffect(() => {
    if (!open || !detailQuery.data || !templateQuery.data) return;
    setSurveyPoint(detailQuery.data.surveyPoint ?? "");
    setStatus((detailQuery.data.status ?? "completa") as any);
    setLanguage((detailQuery.data.language ?? "en") as any);
    const nextAnswers: Record<number, any> = {};
    for (const answer of detailQuery.data.answers as Array<{ questionId: number; answer: any }>) {
      const question = templateQuery.data.questions.find((q: any) => q.id === answer.questionId);
      nextAnswers[answer.questionId] = formatAnswerForInput(answer.answer, question?.type ?? "text");
    }
    setAnswers(nextAnswers);
  }, [open, detailQuery.data, templateQuery.data]);

  const updateMutation = trpc.responses.update.useMutation({
    onSuccess: () => {
      setOpen(false);
      onSaved();
      toast.success("Survey updated");
    },
    onError: (error) => toast.error(error.message || "Error updating survey"),
  });

  const questions = (templateQuery.data?.questions ?? []).filter((q: any) => !q.text.startsWith("META:"));
  const busy = updateMutation.isPending || detailQuery.isLoading || templateQuery.isLoading;

  const setAnswer = (questionId: number, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const renderQuestionInput = (question: any) => {
    const value = answers[question.id] ?? (question.type === "multiple_choice" ? [] : "");

    if (question.type === "single_choice" || question.type === "yes_no") {
      const baseOptions = Array.isArray(question.options) ? question.options : [];
      const options = question.type === "yes_no" && baseOptions.length === 0
        ? [
            { value: "yes", labelEn: "Yes", label: "Sí" },
            { value: "no", labelEn: "No", label: "No" },
          ]
        : baseOptions;
      return (
        <select
          value={value}
          onChange={(e) => setAnswer(question.id, e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Select an option</option>
          {options.map((option: any) => (
            <option key={option.value} value={option.value}>{option.labelEn || option.label || option.value}</option>
          ))}
        </select>
      );
    }

    if (question.type === "multiple_choice") {
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          {(Array.isArray(question.options) ? question.options : []).map((option: any) => {
            const checked = selectedValues.includes(option.value);
            return (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) setAnswer(question.id, [...selectedValues, option.value]);
                    else setAnswer(question.id, selectedValues.filter((item: string) => item !== option.value));
                  }}
                />
                <span>{option.labelEn || option.label || option.value}</span>
              </label>
            );
          })}
        </div>
      );
    }

    if (question.type === "scale") {
      return (
        <select
          value={value}
          onChange={(e) => setAnswer(question.id, e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Select a value</option>
          {[1, 2, 3, 4, 5].map((option) => (
            <option key={option} value={String(option)}>{option}</option>
          ))}
        </select>
      );
    }

    if (question.type === "number") {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => setAnswer(question.id, e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      );
    }

    return (
      <textarea
        value={value}
        onChange={(e) => setAnswer(question.id, e.target.value)}
        rows={question.type === "text" ? 3 : 2}
        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />
    );
  };

  const handleSave = () => {
    if (!detailQuery.data) return;
    updateMutation.mutate({
      id: response.id,
      templateId: response.templateId,
      surveyPoint: surveyPoint || undefined,
      timeSlot: detailQuery.data.timeSlot || undefined,
      windowCode: detailQuery.data.windowCode || undefined,
      latitude: detailQuery.data.latitude != null ? Number(detailQuery.data.latitude) : undefined,
      longitude: detailQuery.data.longitude != null ? Number(detailQuery.data.longitude) : undefined,
      gpsAccuracy: detailQuery.data.gpsAccuracy != null ? Number(detailQuery.data.gpsAccuracy) : undefined,
      startedAt: detailQuery.data.startedAt ? new Date(detailQuery.data.startedAt) : undefined,
      finishedAt: detailQuery.data.finishedAt ? new Date(detailQuery.data.finishedAt) : undefined,
      language,
      status,
      deviceInfo: detailQuery.data.deviceInfo || undefined,
      earlyExit: detailQuery.data.earlyExit ?? false,
      answers: questions.map((question: any) => ({
        questionId: question.id,
        answer: answers[question.id] ?? (question.type === "multiple_choice" ? [] : ""),
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit survey #{response.id}</DialogTitle>
        </DialogHeader>
        {busy && !detailQuery.data ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Loading survey...
          </div>
        ) : (
          <div className="space-y-6 mt-2">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Survey point</label>
                <input
                  type="text"
                  value={surveyPoint}
                  onChange={(e) => setSurveyPoint(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="completa">Complete</option>
                  <option value="incompleta">Incomplete</option>
                  <option value="rechazada">Rejected</option>
                  <option value="sustitucion">Replacement</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="en">EN</option>
                  <option value="es">ES</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {questions.map((question: any, index: number) => (
                <div key={question.id} className="rounded-xl border border-border p-4 space-y-2">
                  <div>
                    <p className="text-sm font-semibold">{index + 1}. {question.textEn || question.text}</p>
                    {question.textEn && question.textEn !== question.text && (
                      <p className="text-xs text-muted-foreground mt-1">Default text: {question.text}</p>
                    )}
                  </div>
                  {renderQuestionInput(question)}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResponseRow({ response, templates, onRefresh }: { response: any; templates: any[]; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { data: detail } = trpc.responses.byId.useQuery(
    { id: response.id },
    { enabled: expanded }
  );

  const deleteMutation = trpc.responses.delete.useMutation({
    onSuccess: () => {
      onRefresh();
      toast.success("Survey deleted");
    },
    onError: (error) => toast.error(error.message || "Error deleting survey"),
  });

  const template = templates.find((t) => t.id === response.templateId);

  const handleDelete = () => {
    const confirmed = window.confirm(`Delete survey #${response.id}? This action cannot be undone.`);
    if (!confirmed) return;
    deleteMutation.mutate({ id: response.id });
  };

  return (
    <>
      <tr className="border-b border-border hover:bg-muted/30 transition-colors">
        <td className="px-4 py-3 text-sm font-mono text-muted-foreground">#{response.id}</td>
        <td className="px-4 py-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            template?.type === "residentes" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
          }`}>
            {template?.type === "residentes" ? "Resident" : "Visitor"}
          </span>
        </td>
        <td className="px-4 py-3 text-sm font-medium">{response.encuestadorName}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{response.encuestadorIdentifier}</td>
        <td className="px-4 py-3 text-sm">
          {new Date(response.startedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </td>
        <td className="px-4 py-3 text-sm">
          {new Date(response.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">{response.surveyPoint || "—"}</td>
        <td className="px-4 py-3">
          {response.latitude ? (
            <a
              href={`https://maps.google.com/?q=${response.latitude},${response.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <MapPin className="h-3 w-3" />
              View
            </a>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="px-4 py-3">
          <span className={`badge-${response.status}`}>{response.status}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <EditResponseDialog response={response} onSaved={onRefresh} />
            <Button variant="destructive" size="sm" type="button" onClick={handleDelete} disabled={deleteMutation.isPending}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              type="button"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Hide" : "View"}
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={10} className="px-4 py-4">
            {!detail ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Loading details...
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Answers</p>
                  <div className="space-y-2">
                    {(detail.answers as any[]).map((a: any, i: number) => (
                      <div key={i} className="text-sm">
                        <span className="font-medium text-muted-foreground">P{a.questionId}: </span>
                        <span>{Array.isArray(a.answer) ? a.answer.join(", ") : String(a.answer ?? "—")}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {detail.photos && detail.photos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Photos ({detail.photos.length})</p>
                    <div className="grid grid-cols-3 gap-2">
                      {detail.photos.map((p: any) => (
                        <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="relative aspect-square rounded-lg overflow-hidden border border-border hover:opacity-90 transition-opacity">
                          <img src={p.url} alt="Survey photo" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/30 transition-opacity">
                            <ExternalLink className="h-5 w-5 text-white" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="md:col-span-2 border-t border-border pt-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Language: </span>
                      <span className="font-medium uppercase">{detail.language}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time slot: </span>
                      <span className="font-medium">{detail.timeSlot || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Start: </span>
                      <span className="font-medium">{new Date(detail.startedAt).toLocaleTimeString("en-GB")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">End: </span>
                      <span className="font-medium">{detail.finishedAt ? new Date(detail.finishedAt).toLocaleTimeString("en-GB") : "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Resultados() {
  const utils = trpc.useUtils();
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    encuestadorId: undefined as number | undefined,
    templateId: undefined as number | undefined,
    status: "",
  });

  const { data: encuestadores = [] } = trpc.users.encuestadores.useQuery();
  const { data: templates = [] } = trpc.templates.list.useQuery();
  const { data: responses = [], isLoading } = trpc.responses.list.useQuery({
    encuestadorId: filters.encuestadorId,
    templateId: filters.templateId,
    dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
    dateTo: filters.dateTo ? new Date(filters.dateTo + "T23:59:59") : undefined,
    status: filters.status || undefined,
  });

  const refreshResponses = async () => {
    await utils.responses.list.invalidate();
    await utils.responses.byId.invalidate();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Field Results</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {responses.length} survey{responses.length !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4" />Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FilterBar
              encuestadores={encuestadores}
              templates={templates}
              filters={filters}
              onChange={setFilters}
            />
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-0 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : responses.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No surveys were found for the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Interviewer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Point</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">GPS</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r) => (
                    <ResponseRow key={r.id} response={r} templates={templates} onRefresh={refreshResponses} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
