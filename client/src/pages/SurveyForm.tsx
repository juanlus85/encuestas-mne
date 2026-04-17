import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { NOMBRES_BARRIO_TURISTICO, NOMBRES_OTRAS_CALLES } from "../../../shared/calles";

// ─── Types ────────────────────────────────────────────────────────────────────

type Answer = { questionId: number; answer: any };
type GpsState = { lat: number; lng: number; accuracy: number } | null;
type PhotoData = { base64: string; preview: string; questionId?: number };

interface QuestionOption { value: string; label: string; labelEn?: string }
interface Question {
  id: number;
  order: number;
  type: string;
  text: string;
  textEn?: string | null;
  options?: unknown;
  isRequired: boolean;
  requiresPhoto: boolean;
}

// ─── GPS Hook ─────────────────────────────────────────────────────────────────

function useGPS() {
  const [gps, setGps] = useState<GpsState>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const acquire = useCallback(() => {
    if (!navigator.geolocation) { setGpsStatus("error"); return; }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsStatus("ok");
      },
      () => setGpsStatus("error"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => { acquire(); }, [acquire]);

  return { gps, gpsStatus, retryGps: acquire };
}

// ─── Photo Capture ────────────────────────────────────────────────────────────

function PhotoCapture({ onCapture, photos }: { onCapture: (data: PhotoData) => void; photos: PhotoData[] }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64Full = ev.target?.result as string;
      const base64 = base64Full.split(",")[1];
      onCapture({ base64, preview: base64Full });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 border-dashed border-2"
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="h-4 w-4 mr-2" />
        Tomar fotografía
      </Button>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
              <img src={p.preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Question Renderer ────────────────────────────────────────────────────────

function QuestionRenderer({
  question,
  answer,
  onAnswer,
  photos,
  onPhoto,
  textOverride,
  onNotResident,
}: {
  question: Question;
  lang?: "es" | "en";
  answer: any;
  onAnswer: (val: any) => void;
  photos: PhotoData[];
  onPhoto: (data: PhotoData) => void;
  textOverride?: { es: string; en?: string };
  onNotResident?: (questionId: number) => void;
}) {
  const textEs = textOverride?.es ?? question.text;
  const textEn = textOverride?.en ?? question.textEn ?? "";
  const opts = question.options as QuestionOption[] | null | undefined ?? null;

  return (
    <div className="space-y-4">
      {/* Question text — bilingual */}
      <div>
        <p className="text-lg font-semibold text-foreground leading-snug">{textEs}</p>
        {textEn && (
          <p className="text-sm text-muted-foreground italic mt-1 leading-snug">{textEn}</p>
        )}
        {question.isRequired && (
          <span className="text-xs text-destructive font-medium mt-1 inline-block">* Obligatorio / Required</span>
        )}
      </div>

      {/* Single choice */}
      {question.type === "single_choice" && opts && (
        <div className="space-y-2">
          {opts.map((opt) => {
            const labelEs = opt.label;
            const labelEn = opt.labelEn ?? "";
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onAnswer(opt.value)}
                className={`survey-option-btn ${answer === opt.value ? "selected" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                    answer === opt.value ? "border-primary bg-primary" : "border-border"
                  }`}>
                    {answer === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-medium">{labelEs}</span>
                    {labelEn && <span className="text-xs text-muted-foreground italic block">{labelEn}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Yes/No */}
      {question.type === "yes_no" && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { val: "si", labelEs: "Sí", labelEn: "Yes" },
            { val: "no", labelEs: "No", labelEn: "No" },
          ].map(({ val, labelEs, labelEn }) => (
            <button
              key={val}
              type="button"
              onClick={() => onAnswer(val)}
              className={`py-4 rounded-xl border-2 font-semibold text-base transition-all ${
                answer === val
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <span className="block">{labelEs}</span>
              <span className="block text-xs font-normal opacity-75">{labelEn}</span>
            </button>
          ))}
        </div>
      )}

      {/* Scale */}
      {question.type === "scale" && opts && (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {opts.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onAnswer(opt.value)}
                className={`py-3 rounded-xl border-2 font-bold text-base transition-all ${
                  answer === opt.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {opt.value}
              </button>
            ))}
          </div>
          {opts.length > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>{opts[0]?.label}</span>
              <span>{opts[opts.length - 1]?.label}</span>
            </div>
          )}
        </div>
      )}

      {/* Number */}
      {question.type === "number" && (
        <input
          type="number"
          value={answer ?? ""}
          onChange={(e) => onAnswer(e.target.value ? Number(e.target.value) : undefined)}
          className="w-full border border-border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          placeholder="Número / Number..."
        />
      )}

      {/* Text — P1.1 calle: desplegable especial */}
      {question.type === "text" && question.text.includes("P1.1") && (
        <div className="space-y-3">
          <select
            value={answer === undefined || answer === null || (!NOMBRES_BARRIO_TURISTICO.includes(answer as string) && !NOMBRES_OTRAS_CALLES.includes(answer as string) && answer !== "") ? "__otra__" : (answer ?? "")}
            onChange={(e) => {
              if (e.target.value === "__otra__") {
                onAnswer(""); // limpia para que el usuario escriba
              } else {
                onAnswer(e.target.value);
              }
            }}
            className="w-full border border-border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          >
            <option value="">-- Seleccione una calle / Select a street --</option>
            <optgroup label="Calles del barrio turístico (Sección 037)">
              {NOMBRES_BARRIO_TURISTICO.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </optgroup>
            <optgroup label="Otras calles del barrio">
              {NOMBRES_OTRAS_CALLES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </optgroup>
            <option value="__otra__">Otra calle / Other street</option>
          </select>
          {/* Campo libre si elige "Otra calle" */}
          {(answer !== undefined && answer !== null && answer !== "" && !NOMBRES_BARRIO_TURISTICO.includes(answer as string) && !NOMBRES_OTRAS_CALLES.includes(answer as string)) && (
            <input
              type="text"
              value={answer as string}
              onChange={(e) => onAnswer(e.target.value)}
              placeholder="Escriba el nombre de la calle / Enter street name..."
              className="w-full border border-border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring bg-background"
              autoFocus
            />
          )}
          {onNotResident && (
            <button
              type="button"
              onClick={() => {
                onNotResident(question.id);
              }}
              className="w-full py-3 px-4 rounded-xl border-2 border-destructive/60 text-destructive font-medium text-sm hover:bg-destructive/10 transition-colors"
            >
              No es Residente de la zona objeto de estudio
              <span className="block text-xs font-normal opacity-75 mt-0.5">Not a resident of the study area → End survey</span>
            </button>
          )}
        </div>
      )}

      {/* Text — campo libre (resto de preguntas tipo text) */}
      {question.type === "text" && !question.text.includes("P1.1") && (
        <textarea
          value={answer ?? ""}
          onChange={(e) => onAnswer(e.target.value)}
          rows={4}
          className="w-full border border-border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring bg-background resize-none"
          placeholder="Escriba su respuesta / Enter your answer..."
        />
      )}

      {/* Multiple choice */}
      {question.type === "multiple_choice" && opts && (
        <div className="space-y-2">
          {opts.map((opt) => {
            const labelEs = opt.label;
            const labelEn = opt.labelEn ?? "";
            const selected = Array.isArray(answer) && answer.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const current = Array.isArray(answer) ? answer : [];
                  onAnswer(selected ? current.filter((v: string) => v !== opt.value) : [...current, opt.value]);
                }}
                className={`survey-option-btn ${selected ? "selected" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                    selected ? "border-primary bg-primary" : "border-border"
                  }`}>
                    {selected && <div className="w-2 h-1.5 border-l-2 border-b-2 border-white rotate-[-45deg] mt-[-1px]" />}
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-medium">{labelEs}</span>
                    {labelEn && <span className="text-xs text-muted-foreground italic block">{labelEn}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Photo */}
      {question.requiresPhoto && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm font-medium text-muted-foreground mb-2">
            Fotografía requerida / Required photo
          </p>
          <PhotoCapture
            onCapture={(d) => onPhoto({ ...d, questionId: question.id })}
            photos={photos.filter((p) => p.questionId === question.id)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcTimeSlot(d: Date): string {
  // Franjas: Mañana 9:30-12:00 | Mediodía 12:00-14:30 | Tarde 16:00-18:30 | Noche 18:30-21:00
  const totalMin = d.getHours() * 60 + d.getMinutes();
  if (totalMin >= 9 * 60 + 30 && totalMin < 12 * 60) return "manana";
  if (totalMin >= 12 * 60 && totalMin < 14 * 60 + 30) return "mediodia";
  if (totalMin >= 16 * 60 && totalMin < 18 * 60 + 30) return "tarde";
  if (totalMin >= 18 * 60 + 30 && totalMin < 21 * 60) return "noche";
  // Fuera de franja: asignar el turno más cercano
  if (totalMin < 9 * 60 + 30) return "manana";   // antes de mañana → mañana
  if (totalMin < 16 * 60) return "mediodia";       // entre mediodía y tarde → mediodía
  return "noche";                                   // después de noche → noche
}

// Inicio de cada franja en minutos desde medianoche
const SLOT_START_MIN: Record<string, number> = {
  manana: 9 * 60 + 30,
  mediodia: 12 * 60,
  tarde: 16 * 60,
  noche: 18 * 60 + 30,
};

function calcWindowCode(d: Date): string {
  const slot = calcTimeSlot(d);
  if (!slot) return "";
  const totalMin = d.getHours() * 60 + d.getMinutes();
  const elapsed = totalMin - SLOT_START_MIN[slot];
  if (elapsed < 0) return "";
  if (elapsed <= 30) return "V1";
  if (elapsed <= 60) return "V2";
  if (elapsed <= 90) return "V3";
  if (elapsed <= 120) return "V4";
  if (elapsed <= 150) return "V5";
  return "";
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

const TIME_SLOT_LABELS: Record<string, string> = {
  manana: "Mañana (9:30–12:00)",
  mediodia: "Mediodía (12:00–14:30)",
  tarde: "Tarde (16:00–18:30)",
  noche: "Noche (18:30–21:00)",
};

const SURVEY_POINTS = [
  { val: "01", label: "01 · Virgen de los Reyes" },
  { val: "02", label: "02 · Mateos Gago" },
  { val: "03", label: "03 · Patio de Banderas" },
  { val: "04", label: "04 · Agua / Vida" },
  { val: "05", label: "05 · Plaza Alfaro" },
];

// ─── Early Exit Screen ────────────────────────────────────────────────────────

function EarlyExitScreen({ onRestart }: { onRestart: () => void }) {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <AlertCircle className="h-10 w-10 text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Encuesta finalizada</h2>
          <p className="text-muted-foreground text-sm mt-2">
            La persona indicó que <strong>no reside habitualmente en este barrio</strong>.
            La encuesta ha concluido anticipadamente.
          </p>
          <p className="text-muted-foreground text-xs mt-1 italic">
            The person indicated they do not usually reside in this neighbourhood. Survey ended early.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button onClick={onRestart} className="w-full" size="lg">
            Nueva encuesta
          </Button>
          <Button onClick={() => setLocation("/")} variant="outline" className="w-full">
            Volver al inicio
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Survey Form ─────────────────────────────────────────────────────────

export default function SurveyForm() {
  const { id } = useParams<{ id: string }>();
  const templateId = parseInt(id ?? "0");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: templateData, isLoading } = trpc.templates.byId.useQuery({ id: templateId });
  const submitMutation = trpc.responses.submit.useMutation();
  const uploadPhotoMutation = trpc.photos.upload.useMutation();

  const { gps, gpsStatus, retryGps } = useGPS();
  const [lang] = useState<"es" | "en">("es");
  const [currentStep, setCurrentStep] = useState(0); // 0 = metadata, 1..n = real questions
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [surveyPoint, setSurveyPoint] = useState("");
  const [startedAt] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);
  const [earlyExit, setEarlyExit] = useState(false);

  const isVisitantes = templateData?.type === "visitantes";
  const isResidentes = templateData?.type === "residentes";

  // Filtrar preguntas META (orden 1-6 visitantes, 1-4 residentes) — no se muestran en el formulario
  const allQuestions: Question[] = (templateData?.questions ?? []) as Question[];
  const questions = allQuestions.filter((q) => !q.text.startsWith("META:"));
  const totalSteps = questions.length;

  const getAnswer = (qId: number) => answers.find((a) => a.questionId === qId)?.answer;
  const setAnswer = (qId: number, val: any) => {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === qId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { questionId: qId, answer: val };
        return updated;
      }
      return [...prev, { questionId: qId, answer: val }];
    });
  };

  const currentQuestion = currentStep > 0 ? questions[currentStep - 1] : null;

  // Scroll al inicio al cambiar de paso
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [currentStep]);

  const canProceed = () => {
    if (currentStep === 0) {
      // El punto de encuesta es obligatorio para visitantes
      if (isVisitantes && !surveyPoint) return false;
      return true;
    }
    if (!currentQuestion) return true;
    if (!currentQuestion.isRequired) return true;
    const ans = getAnswer(currentQuestion.id);
    if (ans === undefined || ans === null || ans === "") return false;
    if (Array.isArray(ans) && ans.length === 0) return false;
    return true;
  };

  // Lógica de salida anticipada: P1 de residentes (¿Reside habitualmente en este barrio?)
  // Es la primera pregunta real (order 5 en el seed, pero la primera no-META)
  const handleNext = () => {
    if (isResidentes && currentStep === 1 && currentQuestion) {
      const ans = getAnswer(currentQuestion.id);
      if (ans === "no") {
        // Guardar encuesta como salida anticipada y mostrar pantalla de fin
        handleEarlyExit();
        return;
      }
    }
    setCurrentStep((s) => s + 1);
  };

  const handleEarlyExit = async (extraAnswers?: Answer[]) => {
    setSubmitting(true);
    const finalAnswers = extraAnswers ? [...answers, ...extraAnswers.filter(ea => !answers.find(a => a.questionId === ea.questionId))] : answers;
    try {
      const result = await submitMutation.mutateAsync({
        templateId,
        surveyPoint: surveyPoint || undefined,
        timeSlot: calcTimeSlot(startedAt) as any,
        latitude: gps?.lat,
        longitude: gps?.lng,
        gpsAccuracy: gps?.accuracy,
        startedAt,
        finishedAt: new Date(),
        language: lang,
        answers: finalAnswers,
        status: "incompleta",
        deviceInfo: navigator.userAgent.substring(0, 200),
        earlyExit: true,
      });
      setSubmittedId(result.id as number);
      setEarlyExit(true);
    } catch {
      toast.error("Error al guardar. Inténtelo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await submitMutation.mutateAsync({
        templateId,
        surveyPoint: surveyPoint || undefined,
        timeSlot: calcTimeSlot(startedAt) as any,
        latitude: gps?.lat,
        longitude: gps?.lng,
        gpsAccuracy: gps?.accuracy,
        startedAt,
        finishedAt: new Date(),
        language: lang,
        answers,
        status: "completa",
        deviceInfo: navigator.userAgent.substring(0, 200),
        windowCode: calcWindowCode(startedAt) || undefined,
      });

      const responseId = result.id as number;
      setSubmittedId(responseId);

      // Upload photos
      for (const photo of photos) {
        await uploadPhotoMutation.mutateAsync({
          responseId,
          questionId: photo.questionId,
          base64: photo.base64,
          mimeType: "image/jpeg",
          sizeBytes: Math.round(photo.base64.length * 0.75),
        });
      }

      setSubmitted(true);
    } catch {
      toast.error("Error al enviar la encuesta. Inténtelo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Pantalla de salida anticipada ────────────────────────────────────────────
  if (earlyExit) {
    return <EarlyExitScreen onRestart={() => setLocation("/")} />;
  }

  // ── Pantalla de éxito ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">¡Encuesta enviada!</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Referencia #{submittedId} · {fmtTime(new Date())}
            </p>
          </div>
          <Button onClick={() => setLocation("/")} className="w-full" size="lg">
            Nueva encuesta
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!templateData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground">Encuesta no encontrada.</p>
          <Button onClick={() => setLocation("/")} variant="outline" className="mt-4">Volver</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="bg-primary text-primary-foreground sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1.5 text-primary-foreground/80 hover:text-primary-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold leading-tight">{templateData.name}</p>
            {templateData.nameEn && (
              <p className="text-xs text-primary-foreground/70 italic">{templateData.nameEn}</p>
            )}
            <p className="text-xs text-primary-foreground/60">
              {currentStep === 0
                ? "Datos de campo / Field data"
                : currentStep <= totalSteps
                  ? `Pregunta ${currentStep} de ${totalSteps}`
                  : "Resumen"}
            </p>
          </div>
          <div className="w-8" />
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-primary-foreground/20">
          <div
            className="h-full bg-primary-foreground transition-all duration-300"
            style={{ width: `${totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">

        {/* ── Step 0: Datos de campo ── */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">Datos de campo</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Complete la información antes de iniciar la encuesta.
              </p>
            </div>

            {/* GPS status */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${
              gpsStatus === "ok" ? "bg-green-50 border-green-200" :
              gpsStatus === "error" ? "bg-red-50 border-red-200" :
              "bg-muted border-border"
            }`}>
              <MapPin className={`h-5 w-5 shrink-0 ${
                gpsStatus === "ok" ? "text-green-600" :
                gpsStatus === "error" ? "text-red-600" : "text-muted-foreground"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {gpsStatus === "ok" ? "Ubicación capturada" :
                   gpsStatus === "loading" ? "Obteniendo ubicación..." :
                   gpsStatus === "error" ? "Ubicación no disponible" : "GPS inactivo"}
                </p>
                {gpsStatus === "ok" && gps && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} · ±{Math.round(gps.accuracy)}m
                  </p>
                )}
              </div>
              {gpsStatus === "error" && (
                <button
                  onClick={retryGps}
                  className="text-xs text-red-600 font-medium underline shrink-0"
                >
                  Reintentar
                </button>
              )}
              {gpsStatus === "loading" && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
              )}
            </div>

            {/* Punto de encuesta */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Punto de encuesta
                {isVisitantes && <span className="text-destructive ml-1">*</span>}
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  ...SURVEY_POINTS,
                  ...(!isVisitantes ? [{ val: "Otro", label: "Otro" }] : []),
                ].map(({ val, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSurveyPoint(val)}
                    className={`py-3 px-4 rounded-lg border-2 text-sm font-medium text-left transition-all ${
                      surveyPoint === val
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50 bg-background"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Datos automáticos */}
            <div className="bg-muted/50 rounded-xl p-4 text-sm space-y-2">
              <p className="text-muted-foreground font-medium mb-1">Datos asignados automáticamente:</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Franja horaria</span>
                <span className="font-medium">
                  {TIME_SLOT_LABELS[calcTimeSlot(startedAt)] ?? calcTimeSlot(startedAt)}
                </span>
              </div>
              {isVisitantes && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ventana (tramo 30 min)</span>
                  <span className="font-medium">{calcWindowCode(startedAt)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hora de inicio</span>
                <span className="font-medium">{fmtTime(startedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Encuestador</span>
                <span className="font-medium">
                  {user?.name}{user?.identifier ? ` (${user.identifier})` : ""}
                </span>
              </div>
            </div>

            {/* Idioma de la encuesta */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Encuesta en español · Survey in Spanish</span>
            </div>
          </div>
        )}

        {/* ── Steps 1..n: Questions ── */}
        {currentStep > 0 && currentQuestion && (() => {
          // Lógica P1b: si es visitantes y es la 2ª pregunta real (P1b),
          // cambiar el texto según la respuesta de P1 (1ª pregunta real)
          let p1bOverride: { es: string; en?: string } | undefined;
          if (isVisitantes && questions.length >= 2 && currentQuestion.id === questions[1].id) {
            const p1Answer = getAnswer(questions[0].id);
            if (p1Answer === "espana") {
              p1bOverride = {
                es: "P1b. ¿Provincia/Ciudad de residencia?",
                en: "P1b. Province/City of residence?",
              };
            } else {
              p1bOverride = {
                es: "P1b. ¿Cuál es su país de origen?",
                en: "P1b. What is your country of origin?",
              };
            }
          }
          return (
          <div className="space-y-5">
            <QuestionRenderer
              question={currentQuestion}
              lang={lang}
              answer={getAnswer(currentQuestion.id)}
              onAnswer={(val) => setAnswer(currentQuestion.id, val)}
              photos={photos.filter((p) => p.questionId === currentQuestion.id)}
              onPhoto={(d) => setPhotos((prev) => [...prev, d])}
              textOverride={p1bOverride}
              onNotResident={isResidentes && currentQuestion.text.includes("P1.1") ? (qId: number) => handleEarlyExit([{ questionId: qId, answer: "No es residente de la zona objeto de estudio" }]) : undefined}
            />
            {/* Navigation buttons */}
            <div className="flex gap-3 pt-2">
              {currentStep > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep((s) => s - 1)}
                  className="flex-1"
                  disabled={submitting}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
              )}
              {currentStep < totalSteps ? (
                <Button
                  onClick={handleNext}
                  className="flex-1"
                  disabled={!canProceed() || submitting}
                  size="lg"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Guardando...</>
                  ) : (
                    <>Siguiente <ChevronRight className="h-4 w-4 ml-1" /></>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={submitting}
                  size="lg"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4 mr-2" />Enviar encuesta</>
                  )}
                </Button>
              )}
            </div>
          </div>
          );
        })()}

        {/* ── Last step: Summary + extra photos ── */}
        {currentStep === totalSteps && totalSteps > 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">Resumen y envío</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Revise y añada fotografías adicionales antes de enviar.
              </p>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Encuestador</span>
                <span className="font-medium">
                  {user?.name}{user?.identifier ? ` (${user.identifier})` : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Punto</span>
                <span className="font-medium">{surveyPoint || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Franja</span>
                <span className="font-medium">
                  {TIME_SLOT_LABELS[calcTimeSlot(startedAt)] ?? calcTimeSlot(startedAt)}
                </span>
              </div>
              {isVisitantes && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ventana</span>
                  <span className="font-medium">{calcWindowCode(startedAt)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Inicio</span>
                <span className="font-medium">{fmtTime(startedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GPS</span>
                <span className={`font-medium ${gpsStatus === "ok" ? "text-green-600" : "text-amber-600"}`}>
                  {gpsStatus === "ok" ? "Capturado" : "No disponible"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Respuestas</span>
                <span className="font-medium">{answers.length} / {totalSteps}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fotos</span>
                <span className="font-medium">{photos.length}</span>
              </div>
            </div>

            {/* Extra photos */}
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Fotografías adicionales</p>
              <PhotoCapture
                onCapture={(d) => setPhotos((prev) => [...prev, d])}
                photos={photos.filter((p) => !p.questionId)}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Step 0 navigation ── */}
      {currentStep === 0 && (
        <div className="max-w-2xl mx-auto w-full px-4 pb-6">
          <Button
            onClick={() => setCurrentStep(1)}
            className="w-full"
            size="lg"
            disabled={!canProceed()}
          >
            Iniciar encuesta
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ── Last step navigation ── */}
      {currentStep === totalSteps && totalSteps > 0 && (
        <div className="max-w-2xl mx-auto w-full px-4 pb-6">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setCurrentStep((s) => s - 1)}
              className="flex-1"
              disabled={submitting}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              disabled={submitting}
              size="lg"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" />Enviar encuesta</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
