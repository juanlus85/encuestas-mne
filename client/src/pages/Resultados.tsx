import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  Loader2,
  MapPin,
  Search,
} from "lucide-react";
import { useState } from "react";

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

function ResponseRow({ response, templates }: { response: any; templates: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const { data: detail } = trpc.responses.byId.useQuery(
    { id: response.id },
    { enabled: expanded }
  );

  const template = templates.find((t) => t.id === response.templateId);
  const answers = Array.isArray(response.answers) ? response.answers : [];

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
          {new Date(response.startedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </td>
        <td className="px-4 py-3 text-sm">
          {new Date(response.startedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
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
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide" : "View"}
          </button>
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
                {/* Answers */}
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

                {/* Photos */}
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

                {/* Metadata */}
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
                      <span className="font-medium">{new Date(detail.startedAt).toLocaleTimeString("es-ES")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">End: </span>
                      <span className="font-medium">{detail.finishedAt ? new Date(detail.finishedAt).toLocaleTimeString("es-ES") : "—"}</span>
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
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    encuestadorId: undefined as number | undefined,
    templateId: undefined as number | undefined,
  });

  const { data: encuestadores = [] } = trpc.users.encuestadores.useQuery();
  const { data: templates = [] } = trpc.templates.list.useQuery();
  const { data: responses = [], isLoading } = trpc.responses.list.useQuery({
    encuestadorId: filters.encuestadorId,
    templateId: filters.templateId,
    dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
    dateTo: filters.dateTo ? new Date(filters.dateTo + "T23:59:59") : undefined,
  });

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
                    <ResponseRow key={r.id} response={r} templates={templates} />
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
