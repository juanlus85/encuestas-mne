import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ArrowLeftRight, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { getFlowsForPoint, type CountingPoint, type CountingSubPoint } from "../../../shared/countingPoints";

type PointDialogState = {
  open: boolean;
  mode: "create" | "edit";
  code: string;
  name: string;
};

type SubPointDialogState = {
  open: boolean;
  mode: "create" | "edit";
  pointCode: string;
  code: string;
  name: string;
};

const EMPTY_POINT_DIALOG: PointDialogState = {
  open: false,
  mode: "create",
  code: "",
  name: "",
};

const EMPTY_SUBPOINT_DIALOG: SubPointDialogState = {
  open: false,
  mode: "create",
  pointCode: "",
  code: "",
  name: "",
};

export default function ConteoSentidos() {
  const pointsQuery = trpc.countingPoints.list.useQuery();
  const points = pointsQuery.data ?? [];

  const [selectedCode, setSelectedCode] = useState<string>("");
  const [pointDialog, setPointDialog] = useState<PointDialogState>(EMPTY_POINT_DIALOG);
  const [subPointDialog, setSubPointDialog] = useState<SubPointDialogState>(EMPTY_SUBPOINT_DIALOG);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createPoint = trpc.countingPoints.createPoint.useMutation();
  const updatePoint = trpc.countingPoints.updatePoint.useMutation();
  const deletePoint = trpc.countingPoints.deletePoint.useMutation();
  const createSubPoint = trpc.countingPoints.createSubPoint.useMutation();
  const updateSubPoint = trpc.countingPoints.updateSubPoint.useMutation();
  const deleteSubPoint = trpc.countingPoints.deleteSubPoint.useMutation();

  useEffect(() => {
    if (!points.length) {
      setSelectedCode("");
      return;
    }

    if (!selectedCode || !points.some((point) => point.code === selectedCode)) {
      setSelectedCode(points[0].code);
    }
  }, [points, selectedCode]);

  const selectedPoint = useMemo(
    () => points.find((point) => point.code === selectedCode) ?? points[0] ?? null,
    [points, selectedCode],
  );

  const flows = selectedPoint ? getFlowsForPoint(selectedPoint) : [];

  const busy =
    createPoint.isPending ||
    updatePoint.isPending ||
    deletePoint.isPending ||
    createSubPoint.isPending ||
    updateSubPoint.isPending ||
    deleteSubPoint.isPending;

  function openCreatePoint() {
    setErrorMessage(null);
    setPointDialog({ open: true, mode: "create", code: "", name: "" });
  }

  function openEditPoint(point: CountingPoint) {
    setErrorMessage(null);
    setPointDialog({ open: true, mode: "edit", code: point.code, name: point.name });
  }

  function openCreateSubPoint(point: CountingPoint) {
    setErrorMessage(null);
    setSubPointDialog({ open: true, mode: "create", pointCode: point.code, code: "", name: "" });
  }

  function openEditSubPoint(point: CountingPoint, subPoint: CountingSubPoint) {
    setErrorMessage(null);
    setSubPointDialog({
      open: true,
      mode: "edit",
      pointCode: point.code,
      code: subPoint.code,
      name: subPoint.name,
    });
  }

  async function refreshPoints() {
    await pointsQuery.refetch();
  }

  async function handlePointSubmit() {
    try {
      setErrorMessage(null);

      if (pointDialog.mode === "create") {
        await createPoint.mutateAsync({
          code: pointDialog.code.trim() || undefined,
          name: pointDialog.name.trim(),
        });
      } else {
        await updatePoint.mutateAsync({
          code: pointDialog.code,
          name: pointDialog.name.trim(),
        });
      }

      await refreshPoints();
      setSelectedCode(pointDialog.code || selectedCode);
      setPointDialog(EMPTY_POINT_DIALOG);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar el punto.");
    }
  }

  async function handleSubPointSubmit() {
    try {
      setErrorMessage(null);

      if (subPointDialog.mode === "create") {
        await createSubPoint.mutateAsync({
          pointCode: subPointDialog.pointCode,
          code: subPointDialog.code.trim() || undefined,
          name: subPointDialog.name.trim(),
        });
      } else {
        await updateSubPoint.mutateAsync({
          pointCode: subPointDialog.pointCode,
          code: subPointDialog.code,
          name: subPointDialog.name.trim(),
        });
      }

      await refreshPoints();
      setSelectedCode(subPointDialog.pointCode);
      setSubPointDialog(EMPTY_SUBPOINT_DIALOG);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save the subpoint.");
    }
  }

  async function handleDeletePoint(point: CountingPoint) {
    if (!window.confirm(`Delete point ${point.fullName} and all its subpoints?`)) {
      return;
    }

    try {
      setErrorMessage(null);
      await deletePoint.mutateAsync({ code: point.code });
      await refreshPoints();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not delete the point.");
    }
  }

  async function handleDeleteSubPoint(point: CountingPoint, subPoint: CountingSubPoint) {
    if (!window.confirm(`Delete subpoint ${subPoint.fullName}?`)) {
      return;
    }

    try {
      setErrorMessage(null);
      await deleteSubPoint.mutateAsync({ pointCode: point.code, code: subPoint.code });
      await refreshPoints();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not delete the subpoint.");
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Counting Directions</h1>
            <p className="text-gray-500 mt-1 max-w-3xl">
              Manage the master list of counting points and subpoints used in pedestrian counting, results, and flow selection.
            </p>
          </div>
          <Button onClick={openCreatePoint} disabled={busy} className="bg-blue-700 hover:bg-blue-800">
            <Plus className="h-4 w-4 mr-2" />
            Add point
          </Button>
        </div>

        {errorMessage && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6 text-sm text-red-700">{errorMessage}</CardContent>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Counting Points</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pointsQuery.isLoading ? (
                <p className="text-sm text-gray-500">Loading points...</p>
              ) : points.length === 0 ? (
                <p className="text-sm text-gray-500">No points are available yet.</p>
              ) : (
                points.map((point) => (
                  <button
                    key={point.code}
                    onClick={() => setSelectedCode(point.code)}
                    className={`w-full rounded-lg border-2 px-4 py-3 text-left transition-all ${
                      selectedPoint?.code === point.code
                        ? "border-blue-700 bg-blue-700 text-white"
                        : "border-gray-200 bg-white text-gray-800 hover:border-blue-400"
                    }`}
                  >
                    <div className="font-semibold">{point.fullName}</div>
                    <div className={`text-xs mt-1 ${selectedPoint?.code === point.code ? "text-blue-100" : "text-gray-500"}`}>
                      {point.subPoints.length} subpoints · {getFlowsForPoint(point).length} flows
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {selectedPoint ? (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-blue-700" />
                        </div>
                        <div>
                          <div className="text-lg">{selectedPoint.fullName}</div>
                          <div className="text-sm font-normal text-gray-500">
                            {selectedPoint.subPoints.length} subpoints · {flows.length} bidirectional flows
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => openEditPoint(selectedPoint)} disabled={busy}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit point
                        </Button>
                        <Button variant="destructive" onClick={() => handleDeletePoint(selectedPoint)} disabled={busy}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete point
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Subpoints</h3>
                        <Button size="sm" onClick={() => openCreateSubPoint(selectedPoint)} disabled={busy}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add subpoint
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {selectedPoint.subPoints.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                            This point does not have any subpoints yet.
                          </div>
                        ) : (
                          selectedPoint.subPoints.map((subPoint) => (
                            <div key={subPoint.code} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <Badge variant="secondary" className="shrink-0">{subPoint.code}</Badge>
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-900 truncate">{subPoint.name}</div>
                                  <div className="text-xs text-gray-500 truncate">{subPoint.fullName}</div>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEditSubPoint(selectedPoint, subPoint)} disabled={busy}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => handleDeleteSubPoint(selectedPoint, subPoint)} disabled={busy}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <ArrowLeftRight className="h-4 w-4" />
                        Generated flows
                      </h3>
                      <div className="space-y-2">
                        {flows.map((flow) => (
                          <div
                            key={flow.label}
                            className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800"
                          >
                            {flow.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Global summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 pr-4 font-semibold text-gray-600">Point</th>
                            <th className="text-left py-2 pr-4 font-semibold text-gray-600">Subpoints</th>
                            <th className="text-left py-2 font-semibold text-gray-600">Flows</th>
                          </tr>
                        </thead>
                        <tbody>
                          {points.map((point) => (
                            <tr key={point.code} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 pr-4 font-medium">{point.fullName}</td>
                              <td className="py-2 pr-4 text-gray-600">{point.subPoints.map((sub) => sub.fullName).join(", ") || "—"}</td>
                              <td className="py-2 text-gray-600">{getFlowsForPoint(point).length} flows</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="pt-6 text-sm text-gray-500">Create the first point to start configuring the counting structure.</CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={pointDialog.open} onOpenChange={(open) => setPointDialog((current) => ({ ...current, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
          <DialogTitle>{pointDialog.mode === "create" ? "Create point" : "Edit point"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {pointDialog.mode === "create" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Point code</label>
                <Input
                  placeholder="01"
                  maxLength={2}
                  value={pointDialog.code}
                  onChange={(event) => setPointDialog((current) => ({ ...current, code: event.target.value.replace(/\D/g, "").slice(0, 2) }))}
                />
                <p className="text-xs text-gray-500">Leave this field empty to automatically assign the next available code.</p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Point name</label>
              <Input
                placeholder="Virgen de los Reyes"
                value={pointDialog.name}
                onChange={(event) => setPointDialog((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPointDialog(EMPTY_POINT_DIALOG)}>Cancel</Button>
            <Button onClick={handlePointSubmit} disabled={busy || !pointDialog.name.trim()}>
              {pointDialog.mode === "create" ? "Create point" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={subPointDialog.open} onOpenChange={(open) => setSubPointDialog((current) => ({ ...current, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{subPointDialog.mode === "create" ? "Create subpoint" : "Edit subpoint"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {subPointDialog.mode === "create" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Subpoint code</label>
                <Input
                  placeholder={`${subPointDialog.pointCode || "01"}.01`}
                  value={subPointDialog.code}
                  onChange={(event) => setSubPointDialog((current) => ({ ...current, code: event.target.value }))}
                />
                <p className="text-xs text-gray-500">Use the same point prefix. If you leave it empty, the next available code will be generated automatically.</p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Subpoint name</label>
              <Input
                placeholder="Alemanes"
                value={subPointDialog.name}
                onChange={(event) => setSubPointDialog((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubPointDialog(EMPTY_SUBPOINT_DIALOG)}>Cancel</Button>
            <Button onClick={handleSubPointSubmit} disabled={busy || !subPointDialog.name.trim()}>
              {subPointDialog.mode === "create" ? "Create subpoint" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
