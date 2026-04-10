import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, ChevronLeft, Plus, CheckCircle2, ArrowRight, ArrowLeftRight } from "lucide-react";
import { Link } from "wouter";
import { SURVEY_POINTS, getFlowsForPoint, type SurveyPoint } from "../../../shared/surveyPoints";

export default function ConteoPeatonal() {
  const { user } = useAuth();
  const [step, setStep] = useState<"punto" | "conteo">("punto");
  const [selectedPoint, setSelectedPoint] = useState<SurveyPoint | null>(null);
  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<{ label: string; from: string; to: string } | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupCount, setGroupCount] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [recentPasses, setRecentPasses] = useState<{ count: number; direction: string; time: string }[]>([]);
  const [totalToday, setTotalToday] = useState(0);
  const groupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);

  const addPass = trpc.passes.add.useMutation({
    onSuccess: () => {
      if (selectedCount !== null && selectedFlow) {
        const newPass = {
          count: selectedCount,
          direction: selectedFlow?.label ?? "",
          time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        };
        setRecentPasses((prev) => [newPass, ...prev.slice(0, 9)]);
        setTotalToday((prev) => prev + (selectedCount ?? 0));
        toast.success(`+${selectedCount} persona${selectedCount !== 1 ? "s" : ""} · ${selectedFlow?.label}`, { duration: 1500 });
        setSelectedCount(null);
        setSelectedFlow(null as any);
      }
    },
    onError: (err) => toast.error("Error al guardar: " + err.message),
  });

  useEffect(() => {
    if (step !== "conteo" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
      () => setGps(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [step]);

  const handleAddPass = () => {
    if (!selectedCount || !selectedFlow || !selectedPoint) {
      toast.error("Selecciona el número de personas y el flujo");
      return;
    }
    addPass.mutate({
      surveyPoint: selectedPoint.fullName,       // nombre completo para mostrar
      surveyPointCode: selectedPoint.code,        // solo código para BD
      directionLabel: selectedFlow.label,
      flowOrigin: selectedFlow.from,              // origen del flujo
      flowDestination: selectedFlow.to,           // destino del flujo
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
            <h1 className="text-lg font-semibold text-gray-900">Conteo Peatonal</h1>
            <p className="text-sm text-gray-500">{user?.name}</p>
          </div>
        </div>
        <div className="flex-1 p-4 max-w-lg mx-auto w-full">
          <div className="mb-6 mt-4">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Selecciona el punto de conteo</h2>
            <p className="text-sm text-gray-500">Elige el punto donde vas a realizar el conteo peatonal</p>
          </div>
          <div className="space-y-3">
            {SURVEY_POINTS.map((point) => (
              <button
                key={point.code}
                onClick={() => { setSelectedPoint(point); setStep("conteo"); }}
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

  const flows = selectedPoint ? getFlowsForPoint(selectedPoint) : [];
  const canAdd = selectedCount !== null && selectedFlow !== null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => { setStep("punto"); setSelectedCount(null); setSelectedFlow(null); }}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">
            {selectedPoint?.code} {selectedPoint?.name}
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

        <Button
          onClick={handleAddPass}
          disabled={!canAdd || addPass.isPending}
          className={`w-full h-16 text-lg font-bold rounded-xl transition-all duration-150 ${
            canAdd
              ? "bg-green-600 hover:bg-green-700 text-white shadow-lg"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {addPass.isPending ? "Guardando..." : canAdd ? (
            <><CheckCircle2 className="h-6 w-6 mr-2" />Añadir · {selectedCount} persona{selectedCount !== 1 ? "s" : ""} · {selectedFlow?.label}</>
          ) : "Selecciona personas y flujo"}
        </Button>

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

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Grupo grande</DialogTitle></DialogHeader>
          <div className="py-2">
            <p className="text-sm text-gray-600 mb-3">Introduce el número exacto de personas del grupo:</p>
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
            <Button variant="outline" onClick={() => { setGroupDialogOpen(false); setGroupCount(""); }}>Cancelar</Button>
            <Button onClick={handleGroupConfirm} disabled={!groupCount || parseInt(groupCount) < 1}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
