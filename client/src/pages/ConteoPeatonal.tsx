import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  CheckCircle,
  Clock,
  MapPin,
  Play,
  Square,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const SURVEY_POINTS = [
  "Calle Mateos Gago",
  "Calles Agua / Vida",
  "Plaza de Alfaro",
  "Puerta Virgen de los Reyes",
  "Patio de Banderas",
];

const TIME_SLOTS = [
  { value: "manana", label: "Mañana (10:00–12:30)" },
  { value: "tarde", label: "Tarde (12:30–15:00 / 17:00–19:30)" },
  { value: "noche", label: "Noche (19:30–22:00)" },
  { value: "fin_semana", label: "Fin de semana" },
];

type SessionPhase = "setup" | "counting" | "finished";

interface Interval {
  id?: number;
  intervalMinute: number;
  countIn: number;
  countOut: number;
  photoUrl?: string;
  saved: boolean;
}

export default function ConteoPeatonal() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Setup state
  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [surveyPoint, setSurveyPoint] = useState("");
  const [timeSlot, setTimeSlot] = useState<string>("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);

  // GPS
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);

  // Counting state
  const [intervals, setIntervals] = useState<Interval[]>([]);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [currentIn, setCurrentIn] = useState(0);
  const [currentOut, setCurrentOut] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [showFinishDialog, setShowFinishDialog] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // tRPC mutations
  const createSession = trpc.pedestrian.createSession.useMutation();
  const finishSession = trpc.pedestrian.finishSession.useMutation();
  const addInterval = trpc.pedestrian.addInterval.useMutation();

  // GPS capture
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Timer
  useEffect(() => {
    if (phase === "counting") {
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Auto-save interval every 5 minutes
  useEffect(() => {
    if (phase !== "counting" || !sessionId) return;
    if (elapsed > 0 && elapsed % 300 === 0) {
      // 5 minutes elapsed → save current interval
      saveCurrentInterval();
    }
  }, [elapsed, phase, sessionId]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, "0");
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const startCounting = async () => {
    if (!surveyPoint) { toast.error("Selecciona el punto de encuesta"); return; }
    const now = new Date();
    try {
      const result = await createSession.mutateAsync({
        surveyPoint,
        timeSlot: timeSlot as any || undefined,
        date: now.toISOString().split("T")[0],
        latitude: gps?.lat,
        longitude: gps?.lng,
        gpsAccuracy: gps?.acc,
        startedAt: now,
      });
      setSessionId(result.id ?? null);
      setSessionStart(now);
      setPhase("counting");
      toast.success("Sesión de conteo iniciada");
    } catch {
      toast.error("Error al iniciar la sesión");
    }
  };

  const saveCurrentInterval = useCallback(async (photo?: string) => {
    if (!sessionId || !sessionStart) return;
    const now = new Date();
    const intervalStart = new Date(sessionStart.getTime() + currentMinute * 60000);
    try {
      const result = await addInterval.mutateAsync({
        sessionId,
        intervalStart,
        intervalEnd: now,
        intervalMinute: currentMinute,
        countIn: currentIn,
        countOut: currentOut,
        photoBase64: photo || pendingPhoto || undefined,
        photoMimeType: "image/jpeg",
      });
      setIntervals((prev) => [
        ...prev,
        {
          id: result.id,
          intervalMinute: currentMinute,
          countIn: currentIn,
          countOut: currentOut,
          photoUrl: undefined,
          saved: true,
        },
      ]);
      setCurrentMinute((m) => m + 5);
      setCurrentIn(0);
      setCurrentOut(0);
      setPendingPhoto(null);
      toast.success(`Intervalo ${currentMinute}–${currentMinute + 5} min guardado`);
    } catch {
      toast.error("Error al guardar el intervalo");
    }
  }, [sessionId, sessionStart, currentMinute, currentIn, currentOut, pendingPhoto, addInterval]);

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch {
      toast.error("No se puede acceder a la cámara");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    const base64 = canvasRef.current.toDataURL("image/jpeg", 0.8).split(",")[1];
    setPendingPhoto(base64);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setShowCamera(false);
    toast.success("Foto capturada");
  };

  const finishCounting = async () => {
    if (!sessionId) return;
    const totalIn = intervals.reduce((s, i) => s + i.countIn, 0) + currentIn;
    const totalOut = intervals.reduce((s, i) => s + i.countOut, 0) + currentOut;
    try {
      // Save last interval if has data
      if (currentIn > 0 || currentOut > 0) await saveCurrentInterval();
      await finishSession.mutateAsync({
        id: sessionId,
        finishedAt: new Date(),
        notes,
        totalIn,
        totalOut,
      });
      setPhase("finished");
      setShowFinishDialog(false);
      toast.success("Sesión de conteo finalizada y guardada");
    } catch {
      toast.error("Error al finalizar la sesión");
    }
  };

  const totalIn = intervals.reduce((s, i) => s + i.countIn, 0) + currentIn;
  const totalOut = intervals.reduce((s, i) => s + i.countOut, 0) + currentOut;

  // ── SETUP SCREEN ──────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="min-h-screen bg-background p-4 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Conteo Peatonal
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configura la sesión antes de iniciar el conteo
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos de la sesión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Punto de conteo *</Label>
              <Select value={surveyPoint} onValueChange={setSurveyPoint}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el punto..." />
                </SelectTrigger>
                <SelectContent>
                  {SURVEY_POINTS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Franja horaria</Label>
              <Select value={timeSlot} onValueChange={setTimeSlot}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la franja..." />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {gps ? (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg p-3">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>GPS capturado — precisión: {Math.round(gps.acc)} m</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>Obteniendo GPS...</span>
              </div>
            )}

            <Button
              className="w-full h-14 text-lg"
              onClick={startCounting}
              disabled={!surveyPoint || createSession.isPending}
            >
              <Play className="h-5 w-5 mr-2" />
              Iniciar conteo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── FINISHED SCREEN ───────────────────────────────────────────────────────
  if (phase === "finished") {
    return (
      <div className="min-h-screen bg-background p-4 max-w-2xl mx-auto flex flex-col items-center justify-center gap-6">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Sesión completada</h1>
          <p className="text-muted-foreground mt-2">Los datos han sido guardados correctamente</p>
        </div>
        <Card className="w-full">
          <CardContent className="pt-6 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-blue-600">{totalIn}</p>
              <p className="text-sm text-muted-foreground">Entradas</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-orange-600">{totalOut}</p>
              <p className="text-sm text-muted-foreground">Salidas</p>
            </div>
            <div className="col-span-2">
              <p className="text-2xl font-bold">{intervals.length} intervalos</p>
              <p className="text-sm text-muted-foreground">de 5 minutos registrados</p>
            </div>
          </CardContent>
        </Card>
        <Button className="w-full" onClick={() => navigate("/")}>
          Volver al inicio
        </Button>
      </div>
    );
  }

  // ── COUNTING SCREEN ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-3 max-w-2xl mx-auto space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-foreground text-lg">{surveyPoint}</h1>
          <p className="text-xs text-muted-foreground">{timeSlot ? TIME_SLOTS.find(t => t.value === timeSlot)?.label : "Sin franja"}</p>
        </div>
        <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="font-mono font-bold text-primary">{formatTime(elapsed)}</span>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 text-center">
            <p className="text-4xl font-bold text-blue-700">{totalIn}</p>
            <p className="text-sm text-blue-600 font-medium flex items-center justify-center gap-1 mt-1">
              <ArrowUpRight className="h-4 w-4" /> Entradas
            </p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-4 text-center">
            <p className="text-4xl font-bold text-orange-700">{totalOut}</p>
            <p className="text-sm text-orange-600 font-medium flex items-center justify-center gap-1 mt-1">
              <ArrowDownLeft className="h-4 w-4" /> Salidas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Current interval */}
      <Card className="border-2 border-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            Intervalo actual: {currentMinute}–{currentMinute + 5} min
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* IN counter */}
            <div className="space-y-2">
              <Label className="text-blue-700 font-semibold flex items-center gap-1">
                <ArrowUpRight className="h-4 w-4" /> Entradas
              </Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-12 w-12 text-xl"
                  onClick={() => setCurrentIn((v) => Math.max(0, v - 1))}>−</Button>
                <span className="text-3xl font-bold text-blue-700 flex-1 text-center">{currentIn}</span>
                <Button size="sm" className="h-12 w-12 text-xl bg-blue-600 hover:bg-blue-700"
                  onClick={() => setCurrentIn((v) => v + 1)}>+</Button>
              </div>
            </div>
            {/* OUT counter */}
            <div className="space-y-2">
              <Label className="text-orange-700 font-semibold flex items-center gap-1">
                <ArrowDownLeft className="h-4 w-4" /> Salidas
              </Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-12 w-12 text-xl"
                  onClick={() => setCurrentOut((v) => Math.max(0, v - 1))}>−</Button>
                <span className="text-3xl font-bold text-orange-700 flex-1 text-center">{currentOut}</span>
                <Button size="sm" className="h-12 w-12 text-xl bg-orange-600 hover:bg-orange-700"
                  onClick={() => setCurrentOut((v) => v + 1)}>+</Button>
              </div>
            </div>
          </div>

          {pendingPhoto && (
            <div className="text-xs text-green-600 bg-green-50 rounded p-2 flex items-center gap-1">
              <Camera className="h-3 w-3" /> Foto adjunta al intervalo
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={openCamera}>
              <Camera className="h-4 w-4 mr-1" /> Foto
            </Button>
            <Button size="sm" onClick={() => saveCurrentInterval()}
              disabled={addInterval.isPending}>
              Guardar intervalo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Intervals history */}
      {intervals.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Intervalos guardados ({intervals.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {intervals.map((iv) => (
                <div key={iv.intervalMinute} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                  <span className="text-muted-foreground">{iv.intervalMinute}–{iv.intervalMinute + 5} min</span>
                  <div className="flex gap-3">
                    <span className="text-blue-600 font-medium">↑ {iv.countIn}</span>
                    <span className="text-orange-600 font-medium">↓ {iv.countOut}</span>
                    {iv.photoUrl && <Camera className="h-3 w-3 text-green-500" />}
                    <Badge variant="secondary" className="text-xs py-0">✓</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Finish button */}
      <Button variant="destructive" className="w-full h-12"
        onClick={() => setShowFinishDialog(true)}>
        <Square className="h-4 w-4 mr-2" /> Finalizar sesión
      </Button>

      {/* Finish dialog */}
      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar sesión de conteo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-700">{totalIn}</p>
                <p className="text-xs text-muted-foreground">Total entradas</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-orange-700">{totalOut}</p>
                <p className="text-xs text-muted-foreground">Total salidas</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observaciones (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Incidencias, condiciones especiales..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowFinishDialog(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={finishCounting}
                disabled={finishSession.isPending}>
                Confirmar y guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Camera dialog */}
      <Dialog open={showCamera} onOpenChange={(open) => {
        if (!open) { streamRef.current?.getTracks().forEach((t) => t.stop()); setShowCamera(false); }
      }}>
        <DialogContent className="max-w-lg p-2">
          <DialogHeader>
            <DialogTitle className="text-sm">Capturar foto del intervalo</DialogTitle>
          </DialogHeader>
          <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" />
          <canvas ref={canvasRef} className="hidden" />
          <Button className="w-full mt-2" onClick={capturePhoto}>
            <Camera className="h-4 w-4 mr-2" /> Capturar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
