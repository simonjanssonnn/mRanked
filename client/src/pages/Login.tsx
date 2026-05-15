import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";

export function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { login, register } = useAuth();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "login") await login(username, password);
      else await register(username, password);
      navigate("/", { replace: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      setErr(humanizeError(msg));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="font-serif text-4xl tracking-tight">Math Ranked</div>
          <div className="mt-2 text-sm text-ink-600">Climb the ladder, one problem at a time.</div>
        </div>

        <div className="card p-6">
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${mode === "login" ? "bg-clay text-cream-50" : "text-ink-700 hover:bg-cream-100"}`}
              onClick={() => setMode("login")}
            >Log in</button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${mode === "register" ? "bg-clay text-cream-50" : "text-ink-700 hover:bg-cream-100"}`}
              onClick={() => setMode("register")}
            >Create account</button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus maxLength={24} autoComplete="username" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </div>
            {err && <div className="text-bad text-sm">{err}</div>}
            <button className="btn-primary w-full text-lg py-3" disabled={busy} type="submit">
              {busy ? "…" : mode === "login" ? "Log in" : "Create account & play"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function humanizeError(code: string): string {
  switch (code) {
    case "user_exists": return "That username is already taken.";
    case "invalid_credentials": return "Wrong username or password.";
    case "invalid_body": return "Username 2–24 letters/numbers/_, password ≥ 6 chars.";
    default: return code;
  }
}
