import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/local/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al iniciar sesión");
        return;
      }

      // Invalidate auth cache so useAuth() picks up the new session
      await utils.auth.me.invalidate();
      toast.success(`Bienvenido, ${data.name ?? username}`);
      setLocation("/");
    } catch {
      setError("Error de conexión. Inténtelo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo / Branding */}
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310419663031419078/nHD7C8PRaURA7Ubm8Aop3k/logos-institucionales_324d47d4.jpg"
            alt="Logos institucionales"
            className="h-16 w-auto object-contain"
          />
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Encuestas Sevilla FeelingLAND</h1>
            <p className="text-sm text-muted-foreground mt-1">Sistema de Trabajo de Campo · Sevilla</p>
          </div>
        </div>

        {/* Local login form */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Iniciar sesión</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Introduzca sus credenciales de campo</p>
          </div>

          <form onSubmit={handleLocalLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium">Usuario</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(null); }}
                  placeholder="nombre.usuario"
                  className="pl-9 h-11 text-base"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  placeholder="••••••••"
                  className="pl-9 pr-10 h-11 text-base"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium"
              disabled={loading || !username.trim() || !password}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accediendo...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>


        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-xs text-muted-foreground">
            Estudio IATUR · <a href="https://organizus.es" target="_blank" rel="noopener noreferrer" className="hover:underline">Organizus.es</a>
          </p>
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310419663031419078/nHD7C8PRaURA7Ubm8Aop3k/logos-institucionales_1f505402.jpg"
            alt="Logos institucionales: Ayuntamiento de Sevilla y Sevilla FeelingLand"
            className="h-16 object-contain opacity-80"
          />
        </div>
      </div>
    </div>
  );
}
