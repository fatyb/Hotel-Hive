"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function LoginForm() {
  const params   = useSearchParams();
  const supabase = createClient();

  const [email,    setEmail]    = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  // If email came from invite link, focus the password field
  const fromInvite = !!params.get("email");

  useEffect(() => {
    if (fromInvite) {
      document.getElementById("password")?.focus();
    }
  }, [fromInvite]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }

    const { data: prof, error: profError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    console.log("✅ Logged in:", data.user.email);
    console.log("📋 Profile:", prof, "Error:", profError);

    const destination = prof?.role === "manager" ? "/dashboard" : "/mes-taches";
    console.log("➡️ Redirecting to:", destination);

    window.location.href = destination;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">

        <div className="flex justify-center mb-8">
          <Logo width={160} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Connexion</CardTitle>
            <CardDescription>
              {fromInvite
                ? "Utilisez votre mot de passe temporaire pour accéder à votre espace."
                : "Accédez à votre espace de travail."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Adresse email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@hotel.com"
                  readOnly={fromInvite}
                  className={fromInvite ? "bg-muted text-muted-foreground" : ""}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">
                  {fromInvite ? "Mot de passe temporaire" : "Mot de passe"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus={fromInvite}
                />
                {fromInvite && (
                  <p className="text-xs text-muted-foreground">
                    Votre mot de passe temporaire se trouve dans l&apos;email de bienvenue.
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={loading} className="w-full mt-2">
                {loading ? "Connexion en cours..." : "Se connecter"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          HotelHive · Gestion hôtelière simplifiée
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
