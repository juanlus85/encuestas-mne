import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, ChevronLeft, Plus, CheckCircle2, ArrowRight, ArrowLeftRight, Play, Square, Timer } from "lucide-react";
import { Link } from "wouter";
import { getFlowsForPoint, type CountingPoint as SurveyPoint, type CountingSubPoint as SurveySubPoint } from "../../../shared/countingPoints";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ConteoPeatonal() {
  const { user } = useAuth();
  const { data: surveyPoints = [], isLoading: pointsLoading } = trpc.countingPoints.list.useQuery();

  // Pasos: punto → subpunto → conteo
  const [step, setStep] = useState<"punto" | "subpunto" | "conteo">("punto");
  const [selectedPoint, setSelectedPoint] = useState<SurveyPoint | null>(null);
  const [selectedSubPoint, setSelectedSubPoint] = useState<SurveySubPoint | null>(null);

  // Conteo
  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<{ label: string; from: string; to: string; fromCode: string; toCode: string } | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupCount, setGroupCount] = useState("");
  const groupInputRef = useRef<HTMLInputElement>(null);

  // GPS
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);

  // Registros recientes y total
  const [recentPasses, setRecentPasses] = useState<{ count: number; direction: string; time: string }[]>([]);
  const [totalToday, setTotalToday] = useState(0);

  // Sesión cronometrada
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0); // total de personas en esta sesión

  // Mantener sincronizado el punto seleccionado con la lista dinámica
  useEffect(() => {
    if (!selectedPoint) return;

    const freshPoint = surveyPoints.find((point) => point.code === selectedPoint.code);
    if (!freshPoint) {
      setStep("punto");
      setSelectedPoint(null);
      setSelectedSubPoint(null);
      return;
    }

    setSelectedPoint(freshPoint);

    if (selectedSubPoint) {
      const freshSubPoint = freshPoint.subPoints.find((subPoint) => subPoint.code === selectedSubPoint.code) ?? null;
      setSelectedSubPoint(freshSubPoint);
      if (!freshSubPoint && step === "conteo") {
        setStep("subpunto");
      }
    }
  }, [surveyPoints, selectedPoint?.code, selectedSubPoint?.code, step]);

  // Scroll al inicio al cambiar de paso
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);

  // GPS watch cuando estamos en el paso de conteo
  useEffect(() => {
    if (step !== "conteo" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
      () => setGps(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [step]);

  // Temporizador
  useEffect(() => {
    if (!sessionStartedAt) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartedAt]);

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const startSession = trpc.countingSessions.start.useMutation({
    onSuccess: (data: any) => {
      const id = data?.insertId ?? data?.id ?? null;
      if (id) {
        setSessionId(Number(id));
        setSessionStartedAt(new Date());
        setSessionTotal(0);
        setElapsed(0);
        toast.success("Counting started");
      }
    },
    onError: (err) => toast.error("Error starting count: " + err.message),
  });

  const finishSession = trpc.countingSessions.finish.useMutation({
    onSuccess: () => {
      toast.success(`Counting finished · ${sessionTotal} people in total`);
      setSessionId(null);
      setSessionStartedAt(null);
      setElapsed(0);
    },
    onError: (err) => toast.error("Error finishing count: " + err.message),
  });

  const addPass = trpc.passes.add.useMutation({
    onSuccess: () => {
      if (selectedCount !== null && selectedFlow) {
        const newPass = {
          count: selectedCount,
          direction: selectedFlow.label,
          time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        };
        setRecentPasses((prev) => [newPass, ...prev.slice(0, 9)]);
        setTotalToday((prev) => prev + selectedCount);
        setSessionTotal((prev) => prev + selectedCount);
        toast.success(`+${selectedCount} person${selectedCount !== 1 ? "s" : ""} · ${selectedFlow.label}`, { duration: 1500 });
        setSelectedCount(null);
        setSelectedFlow(null);
      }
    },
    onError: (err) => toast.error("Error saving: " + err.message),
  });

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleAddPass = () => {
    if (!selectedCount || !selectedFlow || !selectedPoint) {
      toast.error("Select the number of people and the flow");
      return;
    }
    addPass.mutate({
      surveyPoint: selectedPoint.fullName,
      surveyPointCode: selectedPoint.code,
      directionLabel: selectedFlow.label,
      flowOrigin: selectedFlow.fromCode,
      flowDestination: selectedFlow.toCode,
      count: selectedCount,
      latitude: gps?.lat,
      longitude: gps?.lng,
      gpsAccuracy: gps?.acc,
      recordedAt: new Date(),
    });
  };

  const handleGroupConfirm = () => {
    const n = parseInt(groupCount, 10);
    if (!isNaN(n) && n > 0) {
      setSelectedCount(n);
      setGroupDialogOpen(false);
      setGroupCount("");
    }
  };

  const handleStartSession = () => {
    if (!selectedPoint) return;
    startSession.mutate({
      surveyPointCode: selectedPoint.code,
      surveyPointName: selectedPoint.fullName,
      subPointCode: selectedSubPoint?.code ?? undefined,
      subPointName: selectedSubPoint?.fullName ?? undefined,
      latitude: gps?.lat,
      longitude: gps?.lng,
      gpsAccuracy: gps?.acc,
    });
  };

  const handleFinishSession = () => {
    if (!sessionId) return;
    finishSession.mutate({ id: sessionId, totalPersons: sessionTotal });
  };

  const handleBackToSubpunto = () => {
    setStep("subpunto");
    setSelectedSubPoint(null);
    setSelectedCount(null);
    setSelectedFlow(null);
    // Si hay sesión activa, la finalizamos
    if (sessionId) {
      finishSession.mutate({ id: sessionId, totalPersons: sessionTotal });
    }
  };

  const handleBackToPunto = () => {
    setStep("punto");
    setSelectedPoint(null);
    setSelectedSubPoint(null);
    setSelectedCount(null);
    setSelectedFlow(null);
    if (sessionId) {
      finishSession.mutate({ id: sessionId, totalPersons: sessionTotal });
    }
  };

  // ─── PASO 1: Selección de punto principal ────────────────────────────────────

  if (step === "punto") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Pedestrian Counting</h1>
            <p className="text-sm text-gray-500">{user?.name}</p>
          </div>
        </div>
        <div className="flex-1 p-4 max-w-lg mx-auto w-full">
          <div className="mb-6 mt-4">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Select the counting point</h2>
            <p className="text-sm text-gray-500">Choose the main point where you will perform the count</p>
          </div>
          <div className="space-y-3">
            {pointsLoading ? (
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
                Loading counting points...
              </div>
            ) : surveyPoints.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-sm text-gray-500">
                No counting points are configured yet.
              </div>
            ) : surveyPoints.map((point) => (
              <button
                key={point.code}
                onClick={() => { setSelectedPoint(point); setStep("subpunto"); }}
                className="w-full text-left bg-white border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 rounded-xl p-5 transition-all duration-150 flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center shrink-0 transition-colors">
                  <span className="text-blue-700 font-bold text-lg">{point.code}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-base">{point.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {point.subPoints.map((s) => s.name).join(" · ")}
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 ml-auto transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── PASO 2: Selección de subpunto ───────────────────────────────────────────

  if (step === "subpunto" && selectedPoint) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={handleBackToPunto}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {selectedPoint.code} {selectedPoint.name}
            </h1>
            <p className="text-sm text-gray-500">Select the subpoint</p>
          </div>
        </div>
        <div className="flex-1 p-4 max-w-lg mx-auto w-full">
          <div className="mb-6 mt-4">
            <h2 className="text-xl font-bold text-gray-800 mb-1">¿Desde qué subpunto?</h2>
            <p className="text-sm text-gray-500">
              Elige el subpunto. El conteo mostrará solo los flujos hacia ese subpunto en ambos sentidos.
            </p>
          </div>
          <div className="space-y-3">
            {selectedPoint.subPoints.map((sub) => (
              <button
                key={sub.code}
                onClick={() => { setSelectedSubPoint(sub); setStep("conteo"); }}
                className="w-full text-left bg-white border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 rounded-xl p-5 transition-all duration-150 flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center shrink-0 transition-colors">
                  <span className="text-indigo-700 font-bold text-sm">{sub.code}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-base">{sub.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {selectedPoint.fullName} ↔ {sub.fullName}
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 ml-auto transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── PASO 3: Pantalla de conteo ──────────────────────────────────────────────

  // Flujos filtrados: solo los que involucran el subpunto seleccionado
  const allFlows = selectedPoint ? getFlowsForPoint(selectedPoint) : [];
  const flows = selectedSubPoint
    ? allFlows.filter((f) => f.fromCode === selectedSubPoint.code || f.toCode === selectedSubPoint.code)
    : allFlows;

  const canAdd = selectedCount !== null && selectedFlow !== null;
  const sessionActive = sessionId !== null && sessionStartedAt !== null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={handleBackToSubpunto}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">
            {selectedPoint?.code} {selectedPoint?.name}
            {selectedSubPoint && <span className="text-gray-500 font-normal"> · {selectedSubPoint.name}</span>}
          </h1>
          <p className="text-xs text-gray-500">
            {gps ? `GPS ±${Math.round(gps.acc)}m` : "Obteniendo GPS..."}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-blue-700">{totalToday}</div>
          <div className="text-xs text-gray-500">hoy</div>
        </div>
      </div>

      <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-5">

        {/* ─── Barra de sesión cronometrada ─── */}
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="grid grid-cols-3 gap-2 items-center">
            {/* Botón Iniciar */}
            <Button
              onClick={handleStartSession}
              disabled={sessionActive || startSession.isPending}
              className="h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-40"
            >
              <Play className="h-4 w-4 mr-1.5" />
              Iniciar
            </Button>

            {/* Temporizador central */}
            <div className="flex flex-col items-center justify-center">
              <div className={`flex items-center gap-1.5 ${sessionActive ? "text-blue-700" : "text-gray-400"}`}>
                <Timer className="h-4 w-4" />
                <span className="text-xl font-mono font-bold tabular-nums">
                  {formatElapsed(elapsed)}
                </span>
              </div>
              {sessionActive && (
                <span className="text-xs text-green-600 font-medium mt-0.5">{sessionTotal} personas</span>
              )}
              {!sessionActive && (
                <span className="text-xs text-gray-400 mt-0.5">sin sesión</span>
              )}
            </div>

            {/* Botón Finalizar */}
            <Button
              onClick={handleFinishSession}
              disabled={!sessionActive || finishSession.isPending}
              className="h-12 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg disabled:opacity-40"
            >
              <Square className="h-4 w-4 mr-1.5" />
              Finalizar
            </Button>
          </div>
        </div>

        {/* ─── Personas ─── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" /> Personas
          </h2>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                onClick={() => setSelectedCount(n)}
                className={`h-16 rounded-xl text-2xl font-bold transition-all duration-100 border-2 ${
                  selectedCount === n
                    ? "bg-blue-700 border-blue-700 text-white shadow-md scale-105"
                    : "bg-white border-gray-200 text-gray-800 hover:border-blue-400 hover:bg-blue-50"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setGroupDialogOpen(true);
              setTimeout(() => groupInputRef.current?.focus(), 100);
            }}
            className={`w-full h-14 rounded-xl border-2 flex items-center justify-center gap-2 font-semibold text-base transition-all duration-100 ${
              selectedCount !== null && selectedCount > 8
                ? "bg-amber-500 border-amber-500 text-white shadow-md"
                : "bg-white border-dashed border-gray-300 text-gray-600 hover:border-amber-400 hover:bg-amber-50"
            }`}
          >
            <Plus className="h-5 w-5" />
            {selectedCount !== null && selectedCount > 8 ? `Grupo: ${selectedCount} personas` : "Grupo grande (9+)"}
          </button>
        </div>

        {/* ─── Flujos (solo los del subpunto seleccionado) ─── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" /> Flujo (sentido)
          </h2>
          <div className="space-y-2">
            {flows.map((flow) => (
              <button
                key={flow.label}
                onClick={() => setSelectedFlow(flow)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border-2 font-medium text-sm transition-all duration-100 ${
                  selectedFlow?.label === flow.label
                    ? "bg-blue-700 border-blue-700 text-white shadow-md"
                    : "bg-white border-gray-200 text-gray-800 hover:border-blue-400 hover:bg-blue-50"
                }`}
              >
                {flow.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Botón Añadir ─── */}
        <Button
          onClick={handleAddPass}
          disabled={!canAdd || addPass.isPending}
          className={`w-full h-16 text-lg font-bold rounded-xl transition-all duration-150 ${
            canAdd
              ? "bg-green-600 hover:bg-green-700 text-white shadow-lg"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {addPass.isPending ? "Saving..." : canAdd ? (
            <><CheckCircle2 className="h-6 w-6 mr-2" />Add · {selectedCount} person{selectedCount !== 1 ? "s" : ""} · {selectedFlow?.label}</>
          ) : "Select people and flow"}
        </Button>

        {/* ─── Últimos registros ─── */}
        {recentPasses.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Últimos registros</h2>
            <div className="space-y-1.5">
              {recentPasses.map((p, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-lg px-4 py-2.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-bold text-blue-700 text-base shrink-0">{p.count}</span>
                    <span className="text-gray-700 truncate">{p.direction}</span>
                  </div>
                  <span className="text-gray-400 text-xs shrink-0 ml-2">{p.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dialog grupo grande */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Large group</DialogTitle></DialogHeader>
          <div className="py-2">
            <p className="text-sm text-gray-600 mb-3">Enter the exact number of people in the group:</p>
            <Input
              ref={groupInputRef}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={9}
              max={999}
              value={groupCount}
              onChange={(e) => setGroupCount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGroupConfirm()}
              placeholder="Ej: 20"
              className="text-center text-2xl font-bold h-14"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setGroupDialogOpen(false); setGroupCount(""); }}>Cancel</Button>
            <Button onClick={handleGroupConfirm} disabled={!groupCount || parseInt(groupCount) < 1}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
