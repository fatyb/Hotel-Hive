"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle, Smartphone, Key, LogIn,
  ArrowRight, Hotel, Shield, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Step card ─────────────────────────────────────────────────────────────────
function Step({
  number, title, description, icon: Icon, active,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active?: boolean;
}) {
  return (
    <div className={cn(
      "flex gap-4 p-5 rounded-2xl border transition-all",
      active
        ? "bg-primary/5 border-primary/30"
        : "bg-card border-border"
    )}>
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        <Icon className="w-5 h-5" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn(
            "w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center",
            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            {number}
          </span>
          <p className="font-semibold text-sm">{title}</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ── Main (inner) ──────────────────────────────────────────────────────────────
function BienvenueContent() {
  const params = useSearchParams();
  const router = useRouter();

  const email = params.get("email") ?? "";
  const [step, setStep] = useState(0);

  // Auto-advance intro
  useEffect(() => {
    const t = setTimeout(() => setStep(1), 800);
    return () => clearTimeout(t);
  }, []);

  const loginHref = email
    ? `/login?email=${encodeURIComponent(email)}`
    : "/login";

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-background to-background dark:from-orange-950/20 flex flex-col items-center justify-center p-6">

      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <Hotel className="w-5 h-5 text-primary-foreground" strokeWidth={2} />
        </div>
        <span className="text-xl font-black text-foreground">HotelHive</span>
      </div>

      {/* Card */}
      <div className={cn(
        "w-full max-w-md bg-card border border-border rounded-3xl shadow-xl overflow-hidden transition-all duration-500",
        step >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>

        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 px-8 py-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-black text-white mb-1">Bienvenue dans l'équipe !</h1>
          <p className="text-sm text-white/80">Votre responsable a créé votre compte</p>
        </div>

        {/* Steps */}
        <div className="p-6 space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
            Comment accéder à votre espace
          </p>

          <Step
            number={1}
            title="Connectez-vous"
            description={email
              ? `Utilisez l'email ${email} avec le mot de passe temporaire reçu.`
              : "Utilisez l'email et le mot de passe temporaire fournis par votre responsable."}
            icon={LogIn}
            active
          />
          <Step
            number={2}
            title="Entrez votre code PIN"
            description="Utilisez votre code PIN à 6 chiffres pour accéder à l'interface kiosk depuis n'importe quel appareil."
            icon={Key}
          />
          <Step
            number={3}
            title="Installez l'application"
            description={`Dans votre navigateur, tapez "Ajouter à l'écran d'accueil" pour installer HotelHive comme une application native.`}
            icon={Smartphone}
          />
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 space-y-3">
          <Link
            href={loginHref}
            className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:bg-primary/90 transition-colors"
          >
            Se connecter maintenant
            <ArrowRight className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5" />
            Votre compte est sécurisé — changez votre mot de passe après la première connexion
          </div>
        </div>

        {/* Footer badge */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs text-muted-foreground">
            Propulsé par <strong className="text-foreground">HotelHive</strong>
          </span>
        </div>
      </div>

      {/* Already have account */}
      <p className="mt-6 text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link href="/login" className="text-primary font-semibold hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}

// ── Page (wrapped in Suspense for useSearchParams) ────────────────────────────
export default function BienvenueePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BienvenueContent />
    </Suspense>
  );
}
