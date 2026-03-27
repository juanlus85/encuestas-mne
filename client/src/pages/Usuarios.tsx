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
import { Eye, EyeOff, KeyRound, Loader2, Plus, Shield, User, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  encuestador: "Encuestador",
  revisor: "Revisor",
  user: "Usuario",
};

const ROLE_ICONS: Record<string, any> = {
  admin: Shield,
  encuestador: UserCheck,
  revisor: User,
  user: User,
};

// ─── Set Password Dialog ──────────────────────────────────────────────────────

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
      toast.success(`Contraseña actualizada para ${userName}`);
    },
    onError: (e) => toast.error(e.message ?? "Error al cambiar contraseña"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    if (password !== confirm) { toast.error("Las contraseñas no coinciden"); return; }
    setPasswordMutation.mutate({ id: userId, password });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5">
          <KeyRound className="h-3.5 w-3.5" />
          Contraseña
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">Usuario: <strong>{userName}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nueva contraseña</Label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="pr-10"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar contraseña</Label>
            <Input
              type={showPw ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita la contraseña"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={setPasswordMutation.isPending}>
              {setPasswordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
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
    onSuccess: () => { onUpdate(); toast.success("Usuario actualizado"); },
    onError: () => toast.error("Error al actualizar"),
  });

  const Icon = ROLE_ICONS[user.role] ?? User;

  return (
    <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-foreground text-sm">{user.name || "Sin nombre"}</p>
          {user.identifier && (
            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{user.identifier}</span>
          )}
          {user.role === "encuestador" && user.surveyTypeAssigned && user.surveyTypeAssigned !== "ambos" && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              user.surveyTypeAssigned === "residentes"
                ? "bg-blue-100 text-blue-700"
                : "bg-amber-100 text-amber-700"
            }`}>
              {user.surveyTypeAssigned === "residentes" ? "Solo residentes" : "Solo visitantes"}
            </span>
          )}
          {!user.isActive && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Inactivo</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{ROLE_LABELS[user.role] ?? user.role}</p>
        {user.username && (
          <p className="text-xs text-muted-foreground font-mono">
            Usuario: <span className="text-foreground">{user.username}</span>
            {user.passwordHash ? " · ✓ Contraseña configurada" : " · ⚠ Sin contraseña"}
          </p>
        )}
        {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        <SetPasswordDialog userId={user.id} userName={user.name ?? user.username ?? "Usuario"} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => updateMutation.mutate({ id: user.id, isActive: !user.isActive })}
          disabled={updateMutation.isPending}
          className="text-xs"
        >
          {user.isActive ? "Desactivar" : "Activar"}
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
      toast.success("Usuario creado correctamente");
    },
    onError: (e) => toast.error(e.message ?? "Error al crear usuario"),
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
          <DialogTitle>Crear nuevo usuario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label className="mb-1.5 block">Nombre completo *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Ej: María García López"
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Rol *</Label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as any })}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="encuestador">Encuestador</option>
              <option value="revisor">Revisor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {form.role === "encuestador" && (
            <>
              <div>
                <Label className="mb-1.5 block">Identificador de campo</Label>
                <Input
                  value={form.identifier}
                  onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                  className="font-mono"
                  placeholder="Ej: ENC-01"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Tipo de encuesta asignado</Label>
                <select
                  value={form.surveyTypeAssigned}
                  onChange={(e) => setForm({ ...form, surveyTypeAssigned: e.target.value as any })}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="ambos">Ambos tipos (residentes y visitantes)</option>
                  <option value="residentes">Solo Residentes (Técnicos 1 y 3)</option>
                  <option value="visitantes">Solo Visitantes (Técnicos 2, 4 y 5)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">El encuestador solo verá las encuestas de este tipo en su pantalla</p>
              </div>
            </>
          )}

          {/* Separator for credentials */}
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Credenciales de acceso (opcional)
            </p>
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 block">Nombre de usuario</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Ej: maria.garcia"
                />
                <p className="text-xs text-muted-foreground mt-1">El encuestador usará esto para iniciar sesión</p>
              </div>
              <div>
                <Label className="mb-1.5 block">Contraseña</Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
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
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear usuario"}
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
          <p className="text-muted-foreground">Acceso restringido a administradores.</p>
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
            <h1 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Administre encuestadores, revisores y administradores del sistema.
            </p>
          </div>
          <CreateUserDialog onCreated={refresh} />
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800 font-medium">Acceso con usuario y contraseña</p>
          <p className="text-xs text-blue-700 mt-1">
            Al crear un usuario, puede asignarle un <strong>nombre de usuario</strong> y <strong>contraseña</strong> para que acceda directamente desde la pantalla de login sin necesidad de cuenta Manus. Puede cambiar la contraseña en cualquier momento con el botón <strong>Contraseña</strong>.
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
                Encuestadores ({encuestadores.length})
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
                Revisores ({revisores.length})
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
                Administradores ({admins.length})
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
            <p className="text-sm">No hay usuarios creados. Cree el primer encuestador.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
