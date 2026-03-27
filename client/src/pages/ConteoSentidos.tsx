import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin, ArrowUpDown } from "lucide-react";

const SURVEY_POINTS = [
  "Mateos Gago",
  "Agua / Vida",
  "Plaza de Alfaro",
  "Virgen de los Reyes",
  "Patio de Banderas",
];

interface DirectionForm {
  surveyPoint: string;
  label: string;
  description: string;
  order: number;
}

const emptyForm: DirectionForm = { surveyPoint: "", label: "", description: "", order: 0 };

export default function ConteoSentidos() {
  const [selectedPoint, setSelectedPoint] = useState<string>(SURVEY_POINTS[0]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DirectionForm>(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data: directions = [], isLoading } = trpc.directions.byPoint.useQuery(
    { surveyPoint: selectedPoint },
    { enabled: !!selectedPoint }
  );

  const createDir = trpc.directions.create.useMutation({
    onSuccess: () => {
      utils.directions.byPoint.invalidate({ surveyPoint: selectedPoint });
      toast.success("Sentido creado");
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const updateDir = trpc.directions.update.useMutation({
    onSuccess: () => {
      utils.directions.byPoint.invalidate({ surveyPoint: selectedPoint });
      toast.success("Sentido actualizado");
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const deleteDir = trpc.directions.delete.useMutation({
    onSuccess: () => {
      utils.directions.byPoint.invalidate({ surveyPoint: selectedPoint });
      toast.success("Sentido eliminado");
      setDeleteConfirmId(null);
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, surveyPoint: selectedPoint, order: directions.length + 1 });
    setDialogOpen(true);
  };

  const openEdit = (d: typeof directions[0]) => {
    setEditingId(d.id);
    setForm({
      surveyPoint: d.surveyPoint,
      label: d.label,
      description: d.description ?? "",
      order: d.order ?? 0,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.label.trim()) { toast.error("El nombre del sentido es obligatorio"); return; }
    if (!form.surveyPoint) { toast.error("Selecciona un punto de conteo"); return; }
    if (editingId !== null) {
      updateDir.mutate({ id: editingId, label: form.label, description: form.description || undefined, order: form.order });
    } else {
      createDir.mutate({ surveyPoint: form.surveyPoint, label: form.label, description: form.description || undefined, order: form.order });
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowUpDown className="h-6 w-6 text-blue-700" />
            Sentidos de Conteo Peatonal
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configura los sentidos (origen → destino) disponibles para cada punto de conteo.
            Los encuestadores los verán al registrar pases.
          </p>
        </div>

        {/* Selector de punto */}
        <div className="mb-6">
          <Label className="text-sm font-medium text-gray-700 mb-2 block">Punto de conteo</Label>
          <div className="flex flex-wrap gap-2">
            {SURVEY_POINTS.map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPoint(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                  selectedPoint === p
                    ? "bg-blue-700 border-blue-700 text-white"
                    : "bg-white border-gray-200 text-gray-700 hover:border-blue-400"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Tarjeta de sentidos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-700" />
              {selectedPoint}
              <Badge variant="secondary" className="ml-1">{directions.length} sentidos</Badge>
            </CardTitle>
            <Button onClick={openCreate} size="sm" className="bg-blue-700 hover:bg-blue-800">
              <Plus className="h-4 w-4 mr-1" /> Añadir sentido
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-400">Cargando...</div>
            ) : directions.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <ArrowUpDown className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No hay sentidos configurados</p>
                <p className="text-sm mt-1">Añade sentidos para que los encuestadores puedan registrar pases</p>
                <Button onClick={openCreate} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-1" /> Añadir el primer sentido
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {directions.map((d, idx) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100"
                  >
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{d.label}</div>
                      {d.description && <div className="text-xs text-gray-500">{d.description}</div>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}>
                        <Pencil className="h-4 w-4 text-gray-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeleteConfirmId(d.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ayuda */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <strong>Ejemplos de sentidos:</strong> "Catedral → Alcázar", "Entrada por Mateos Gago", "Salida hacia Sierpes", "Norte → Sur", etc.
          Los encuestadores seleccionarán el sentido al registrar cada pase peatonal.
        </div>
      </div>

      {/* Dialog: crear/editar sentido */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar sentido" : "Nuevo sentido"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editingId && (
              <div className="space-y-1.5">
                <Label>Punto de conteo *</Label>
                <Select value={form.surveyPoint} onValueChange={(v) => setForm(f => ({ ...f, surveyPoint: v }))}>
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
            )}
            <div className="space-y-1.5">
              <Label>Nombre del sentido *</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Ej: Catedral → Alcázar"
                autoFocus
              />
              <p className="text-xs text-gray-500">Usa el formato "Origen → Destino" para mayor claridad</p>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción (opcional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ej: Flujo principal de turistas"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Orden de visualización</Label>
              <Input
                type="number"
                min={1}
                value={form.order}
                onChange={(e) => setForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={createDir.isPending || updateDir.isPending}
              className="bg-blue-700 hover:bg-blue-800"
            >
              {editingId ? "Guardar cambios" : "Crear sentido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar eliminación */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar sentido</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            ¿Estás seguro de que quieres eliminar este sentido? Los pases ya registrados con este sentido no se verán afectados.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId !== null && deleteDir.mutate({ id: deleteConfirmId })}
              disabled={deleteDir.isPending}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
