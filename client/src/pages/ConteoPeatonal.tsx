import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { MapPin, Users, ChevronLeft, Plus, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "wouter";

const SURVEY_POINTS = [
  "Mateos Gago",
  "Agua / Vida",
  "Plaza de Alfaro",
  "Virgen de los Reyes",
  "Patio de Banderas",
];

export default function ConteoPeatonal() {
  const { user } = useAuth();
  const [step, setStep] = useState<"punto" | "conteo">("punto");
  const [selectedPoint, setSelectedPoint] = useState<string>("");
  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<{ id?: number; label: string } | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupCount, setGroupCount] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [recentPasses, setRecentPasses] = useState<{ count: number; direction: string; time: string }[]>([]);
  const [totalToday, setTotalToday] = useState(0);
  const groupInputRef = useRef<HTMLInputElement>(null);

  const { data: directions = [] } = trpc.directions.byPoint.useQuery(
    { surveyPoint: selectedPoint },
    { enabled: !!selectedPoint }
  );

  const addPass = trpc.passes.add.useMutation({
    onSuccess: () => {
      if (selectedCount !== null && selectedDirection) {
        const newPass = {
          count: selectedCount,
          direction: selectedDirection.label,
          time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        };
        setRecentPasses(prev => [newPass, ...prev.slice(0, 9)]);
        setTotalToday(prev => prev + (selectedCount ?? 0));
        toast.success(`+${selectedCount} persona${selectedCount !== 1 ? "s" : ""} · ${selectedDirection.label}`, {
          duration: 1500,
        });
        setSelectedCount(null);
        setSelectedDirection(null);
      }
    },
    onError: (err) => toast.error("Error al guardar: " + err.message),
  });

  useEffect(() => {
    if (step === "conteo" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
        () => setGps(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [step]);

  const handleAddPass = () => {
    if (!selectedCount || !selectedDirection) {
      toast.error("Selecciona el número de personas y el sentido");
      return;
    }
    addPass.mutate({
      surveyPoint: selectedPoint,
      directionId: selectedDirection.id,
      directionLabel: selectedDirection.label,
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

  // ─── Pantalla 1: Selección de punto ──────────────────────────────────────────
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
                key={point}
                onClick={() => {
                  setSelectedPoint(point);
                  setStep("conteo");
                }}
                className="w-full text-left bg-white border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 rounded-xl p-5 transition-all duration-150 flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center shrink-0 transition-colors">
                  <MapPin className="h-6 w-6 text-blue-700" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-base">{point}</div>
                  <div className="text-sm text-gray-500">Barrio de Santa Cruz</div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 ml-auto transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Pantalla 2: Conteo ───────────────────────────────────────────────────────
  const canAdd = selectedCount !== null && selectedDirection !== null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => { setStep("punto"); setSelectedCount(null); setSelectedDirection(null); }}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">{selectedPoint}</h1>
          <p className="text-xs text-gray-500">
            {gps
              ? `GPS ±${Math.round(gps.acc)}m`
              : "Obteniendo GPS..."}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-blue-700">{totalToday}</div>
          <div className="text-xs text-gray-500">hoy</div>
        </div>
      </div>

      <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-5">

        {/* Sección: Número de personas */}
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
          {/* Botón grupo */}
          <button
            onClick={() => setGroupDialogOpen(true)}
            className={`w-full h-14 rounded-xl text-base font-semibold border-2 transition-all duration-100 flex items-center justify-center gap-2 ${
              selectedCount !== null && selectedCount > 8
                ? "bg-amber-500 border-amber-500 text-white shadow-md"
                : "bg-white border-dashed border-gray-300 text-gray-600 hover:border-amber-400 hover:bg-amber-50"
            }`}
          >
            <Plus className="h-5 w-5" />
            {selectedCount !== null && selectedCount > 8
              ? `Grupo: ${selectedCount} personas`
              : "Grupo grande (9+)"}
          </button>
        </div>

        {/* Sección: Sentido */}
        <div>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Sentido
          </h2>
          {directions.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-sm text-amber-700">
              No hay sentidos configurados para este punto.<br />
              <span className="font-medium">El administrador debe añadirlos en Configuración → Sentidos.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {directions.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDirection({ id: d.id, label: d.label })}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 font-medium text-base transition-all duration-100 ${
                    selectedDirection?.id === d.id
                      ? "bg-blue-700 border-blue-700 text-white shadow-md"
                      : "bg-white border-gray-200 text-gray-800 hover:border-blue-400 hover:bg-blue-50"
                  }`}
                >
                  {d.label}
                  {d.description && (
                    <span className={`block text-xs mt-0.5 ${selectedDirection?.id === d.id ? "text-blue-200" : "text-gray-400"}`}>
                      {d.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Botón Añadir */}
        <Button
          onClick={handleAddPass}
          disabled={!canAdd || addPass.isPending}
          className={`w-full h-16 text-xl font-bold rounded-xl transition-all duration-150 ${
            canAdd
              ? "bg-green-600 hover:bg-green-700 text-white shadow-lg"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {addPass.isPending ? (
            "Guardando..."
          ) : canAdd ? (
            <>
              <CheckCircle2 className="h-6 w-6 mr-2" />
              Añadir · {selectedCount} persona{selectedCount !== 1 ? "s" : ""} · {selectedDirection?.label}
            </>
          ) : (
            "Selecciona personas y sentido"
          )}
        </Button>

        {/* Historial reciente */}
        {recentPasses.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Últimos registros</h2>
            <div className="space-y-1.5">
              {recentPasses.map((p, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-lg px-4 py-2.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-blue-700 text-base">{p.count}</span>
                    <span className="text-gray-700">{p.direction}</span>
                  </div>
                  <span className="text-gray-400 text-xs">{p.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dialog: grupo grande */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Grupo grande</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-gray-600 mb-3">Introduce el número exacto de personas del grupo:</p>
            <Input
              ref={groupInputRef}
              type="number"
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
            <Button variant="outline" onClick={() => { setGroupDialogOpen(false); setGroupCount(""); }}>
              Cancelar
            </Button>
            <Button onClick={handleGroupConfirm} disabled={!groupCount || parseInt(groupCount) < 1}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
