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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { nanoid } from "nanoid";
import { Calendar, Eye, EyeOff, KeyRound, Loader2, Plus, Shield, Trash2, User, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  encuestador: "Interviewer",
  revisor: "Reviewer",
  user: "User",
};

const ROLE_ICONS: Record<string, any> = {
  admin: Shield,
  encuestador: UserCheck,
  revisor: User,
  user: User,
};

// ─── Gestión de Turnos ────────────────────────────────────────────────────────────────

const SURVEY_POINTS_LABELS = [
  "01 Virgen de los Reyes",
  "02 Mateos Gago",
  "03 Patio de Banderas",
  "04 Agua / Vida",
  "05 Plaza Alfaro",
];

function TurnosSection({ encuestadores }: { encuestadores: { id: number; name: string | null }[] }) {
  const utils = trpc.useUtils();
  const { data: shifts, isLoading: shiftsLoading } = trpc.shifts.getAll.useQuery();
  const createMutation = trpc.shifts.create.useMutation({
    onSuccess: () => { utils.shifts.getAll.invalidate(); toast.success("Shift created"); setOpen(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.shifts.delete.useMutation({
    onSuccess: () => { utils.shifts.getAll.invalidate(); toast.success("Shift deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const [open, setOpen] = useState(false);
  const [encuestadorId, setEncuestadorId] = useState("");
  const [shiftDate, setShiftDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("14:00");
  const [surveyPoint, setSurveyPoint] = useState("");
  const [surveyType, setSurveyType] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setEncuestadorId(""); setShiftDate(""); setStartTime("09:00"); setEndTime("14:00");
    setSurveyPoint(""); setSurveyType(""); setNotes("");
  };

  const handleCreate = () => {
    if (!encuestadorId || !shiftDate) { toast.error("Select interviewer and date"); return; }
    createMutation.mutate({
      encuestadorId: Number(encuestadorId),
      shiftDate, startTime, endTime,
      surveyPoint: surveyPoint || undefined,
      surveyType: (surveyType as any) || undefined,
      notes: notes || undefined,
    });
  };

  // Agrupar por fecha
  const byDate: Record<string, typeof shifts> = {};
  for (const s of shifts ?? []) {
    if (!byDate[s.shiftDate]) byDate[s.shiftDate] = [];
    byDate[s.shiftDate]!.push(s);
  }
  const sortedDates = Object.keys(byDate).sort().reverse();

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Assigned shifts
          </CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Add shift
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>New shift</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Interviewer</Label>
                  <select value={encuestadorId} onChange={(e) => setEncuestadorId(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm mt-1 bg-background">
                    <option value="">Select...</option>
                    {encuestadores.map((e) => <option key={e.id} value={e.id}>{e.name ?? `ID ${e.id}`}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Start time</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1" /></div>
                  <div><Label>End time</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1" /></div>
                </div>
                <div>
                  <Label>Survey point</Label>
                  <select value={surveyPoint} onChange={(e) => setSurveyPoint(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm mt-1 bg-background">
                    <option value="">Unassigned</option>
                    {SURVEY_POINTS_LABELS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Work type</Label>
                  <select value={surveyType} onChange={(e) => setSurveyType(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm mt-1 bg-background">
                    <option value="">Unassigned</option>
                    <option value="visitantes">Visitors</option>
                    <option value="residentes">Residents</option>
                    <option value="conteo">Pedestrian counting</option>
                  </select>
                </div>
                <div>
                  <Label>Notes / Instructions</Label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm mt-1 bg-background resize-none" />
                </div>
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create shift"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {shiftsLoading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {!shiftsLoading && sortedDates.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">There are no assigned shifts yet. Create the first one.</p>
        )}
        <div className="space-y-4">
          {sortedDates.map((date) => (
            <div key={date}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <div className="space-y-2">
                {byDate[date]!.map((s) => {
                  const enc = encuestadores.find((e) => e.id === s.encuestadorId);
                  return (
                    <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{enc?.name ?? `ID ${s.encuestadorId}`}</p>
                        <p className="text-xs text-gray-500">
                          {s.startTime} – {s.endTime}
                          {s.surveyPoint && ` · ${s.surveyPoint}`}
                          {s.surveyType && ` · ${s.surveyType}`}
                        </p>
                        {s.notes && <p className="text-xs text-gray-400 mt-0.5">{s.notes}</p>}
                      </div>
                      <button
                        onClick={() => deleteMutation.mutate({ id: s.id })}
                        className="text-red-400 hover:text-red-600 transition-colors p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Set Password Dialog ────────────────────────────────────────────────────────────────

function SetPasswordDialog({ userId, userName }: { userId: number; userName: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);

  const setPasswordMutation = trpc.users.setPassword.useMutation({
    onSuccess: () => {
      setOpen(false);
      setPassword("");
      setConfirm("");
      toast.success(`Password updated for ${userName}`);
    },
    onError: (e) => toast.error(e.message ?? "Error changing password"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Minimum 6 characters"); return; }
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    setPasswordMutation.mutate({ id: userId, password });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5">
          <KeyRound className="h-3.5 w-3.5" />
          Password
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">User: <strong>{userName}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>New password</Label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="pr-10"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Confirm password</Label>
            <Input
              type={showPw ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat the password"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1" disabled={setPasswordMutation.isPending}>
              {setPasswordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────

function UserCard({ user, onUpdate }: { user: any; onUpdate: () => void }) {
  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => { onUpdate(); toast.success("User updated"); },
    onError: () => toast.error("Update failed"),
  });

  const Icon = ROLE_ICONS[user.role] ?? User;

  return (
    <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-foreground text-sm">{user.name || "No name"}</p>
          {user.identifier && (
            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{user.identifier}</span>
          )}
          {user.role === "encuestador" && user.surveyTypeAssigned && user.surveyTypeAssigned !== "ambos" && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              user.surveyTypeAssigned === "residentes"
                ? "bg-blue-100 text-blue-700"
                : "bg-amber-100 text-amber-700"
            }`}>
              {user.surveyTypeAssigned === "residentes" ? "Residents only" : "Visitors only"}
            </span>
          )}
          {!user.isActive && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Inactive</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{ROLE_LABELS[user.role] ?? user.role}</p>
        {user.username && (
          <p className="text-xs text-muted-foreground font-mono">
            Username: <span className="text-foreground">{user.username}</span>
            {user.passwordHash ? " · ✓ Password set" : " · ⚠ No password"}
          </p>
        )}
        {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        <SetPasswordDialog userId={user.id} userName={user.name ?? user.username ?? "User"} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => updateMutation.mutate({ id: user.id, isActive: !user.isActive })}
          disabled={updateMutation.isPending}
          className="text-xs"
        >
          {user.isActive ? "Deactivate" : "Activate"}
        </Button>
      </div>
    </div>
  );
}

// ─── Create User Dialog ───────────────────────────────────────────────────────

function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "encuestador" as "admin" | "encuestador" | "revisor",
    identifier: "",
    surveyTypeAssigned: "ambos" as "residentes" | "visitantes" | "ambos",
    openId: "",
    username: "",
    password: "",
  });

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      setForm({ name: "", email: "", role: "encuestador", identifier: "", surveyTypeAssigned: "ambos", openId: "", username: "", password: "" });
      onCreated();
      toast.success("User created successfully");
    },
    onError: (e) => toast.error(e.message ?? "Error creating user"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (form.username && form.password && form.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    createMutation.mutate({
      ...form,
      openId: form.openId || `manual-${nanoid(12)}`,
      username: form.username.trim().toLowerCase() || undefined,
      password: form.password || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create new user</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label className="mb-1.5 block">Full name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Example: Maria Garcia Lopez"
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Role *</Label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as any })}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="encuestador">Interviewer</option>
              <option value="revisor">Reviewer</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          {form.role === "encuestador" && (
            <>
              <div>
                <Label className="mb-1.5 block">Field identifier</Label>
                <Input
                  value={form.identifier}
                  onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                  className="font-mono"
                  placeholder="Example: INT-01"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Assigned survey type</Label>
                <select
                  value={form.surveyTypeAssigned}
                  onChange={(e) => setForm({ ...form, surveyTypeAssigned: e.target.value as any })}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="ambos">Both types (residents and visitors)</option>
                  <option value="residentes">Residents only (Technicians 1 and 3)</option>
                  <option value="visitantes">Visitors only (Technicians 2, 4 and 5)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">The interviewer will only see surveys of this type on their screen</p>
              </div>
            </>
          )}

          {/* Separator for credentials */}
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Access credentials (optional)
            </p>
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 block">Username</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Example: maria.garcia"
                />
                <p className="text-xs text-muted-foreground mt-1">The interviewer will use this to sign in</p>
              </div>
              <div>
                <Label className="mb-1.5 block">Password</Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Minimum 6 characters"
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create user"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Usuarios() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.users.list.useQuery();

  if (currentUser?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Restricted access for administrators only.</p>
        </div>
      </DashboardLayout>
    );
  }

  const encuestadores = users.filter((u) => u.role === "encuestador");
  const revisores = users.filter((u) => u.role === "revisor");
  const admins = users.filter((u) => u.role === "admin");

  const refresh = () => utils.users.list.invalidate();

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage interviewers, reviewers, and system administrators.
            </p>
          </div>
          <CreateUserDialog onCreated={refresh} />
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800 font-medium">Username and password access</p>
          <p className="text-xs text-blue-700 mt-1">
            When creating a user, you can assign a <strong>username</strong> and <strong>password</strong> so they can access the app directly from the login screen without needing a Manus account. You can change the password at any time using the <strong>Password</strong> button.
          </p>
        </div>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Encuestadores */}
        {encuestadores.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                Interviewers ({encuestadores.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {encuestadores.map((u) => (
                <UserCard key={u.id} user={u} onUpdate={refresh} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Revisores */}
        {revisores.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Reviewers ({revisores.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {revisores.map((u) => (
                <UserCard key={u.id} user={u} onUpdate={refresh} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Admins */}
        {admins.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Administrators ({admins.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {admins.map((u) => (
                <UserCard key={u.id} user={u} onUpdate={refresh} />
              ))}
            </CardContent>
          </Card>
        )}

        {!isLoading && users.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">There are no users yet. Create the first interviewer.</p>
          </div>
        )}

        {/* Sección de turnos */}
        <TurnosSection encuestadores={encuestadores} />
      </div>
    </DashboardLayout>
  );
}
