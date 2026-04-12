"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { Logo } from "@/components/ui/Logo";
import {
  ArrowRight, CheckCircle2, X, Zap, BedDouble, ClipboardList,
  Wrench, Bell, BarChart3, Users, Smartphone, Shield,
  ChevronRight, Star, Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── useInView hook ─────────────────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref  = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, inView };
}

// ── useCountUp hook ────────────────────────────────────────────────────────

function useCountUp(target: number, inView: boolean, duration = 1500) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start     = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease     = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.round(ease * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target, duration]);

  return count;
}

// ── Animated section wrapper ───────────────────────────────────────────────

function Reveal({
  children, className = "", delay = 0, animation = "fade-up",
}: {
  children: React.ReactNode; className?: string; delay?: number; animation?: string;
}) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={cn(className, inView ? `animate-${animation}` : "opacity-0")}
      style={inView ? { animationDelay: `${delay}ms` } : {}}
    >
      {children}
    </div>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
      scrolled ? "bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm" : "bg-transparent"
    )}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="animate-fade-in">
          <Logo width={120} />
        </div>

        <nav className="hidden md:flex items-center gap-8 animate-fade-in delay-100">
          {["Fonctionnalités", "Tarifs", "À propos"].map((item) => (
            <a key={item} href="#" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">{item}</a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3 animate-fade-in delay-200">
          <Link href="/login" className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors px-4 py-2">
            Connexion
          </Link>
          <Link href="/login" className="inline-flex items-center gap-2 bg-[#A4F5A6] hover:bg-[#6FCF71] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-[#A4F5A6]/30 hover:shadow-md hover:shadow-[#A4F5A6]/30 hover:-translate-y-0.5">
            Démarrer gratuitement
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
        </div>

        <button className="md:hidden p-2 rounded-lg hover:bg-gray-100 animate-fade-in" onClick={() => setMenuOpen(!menuOpen)}>
          <Menu className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-4 animate-fade-up">
          {["Fonctionnalités", "Tarifs", "À propos"].map((item) => (
            <a key={item} href="#" className="text-sm font-medium text-gray-600">{item}</a>
          ))}
          <Link href="/login" className="inline-flex items-center justify-center gap-2 bg-[#A4F5A6] text-[#222222] text-sm font-bold px-5 py-3 rounded-xl">
            Démarrer gratuitement <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
        </div>
      )}
    </header>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-white pt-16">
      {/* Animated blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-[#A4F5A6]/8 rounded-full blur-3xl animate-float" />
        <div className="absolute top-1/2 -left-32 w-[400px] h-[400px] bg-[#A4F5A6]/5 rounded-full blur-3xl animate-float-rev" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-blue-50 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <div>
          <div className="animate-fade-up inline-flex items-center gap-2 bg-[#D4DCD3] text-[#222222] text-xs font-bold px-3.5 py-1.5 rounded-full mb-6 border border-[#A4F5A6]/20">
            <Zap className="w-3.5 h-3.5 animate-pulse-dot" strokeWidth={2} />
            Nouveau · Rapports en temps réel
          </div>

          <h1 className="animate-fade-up delay-100 text-[52px] leading-[1.08] font-extrabold text-gray-900 tracking-tight mb-6">
            Pilotez votre hôtel{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-shimmer">en temps réel.</span>
              <svg className="svg-draw absolute -bottom-1 left-0 w-full" viewBox="0 0 300 12" fill="none">
                <path d="M2 9C60 3 120 1 150 1C180 1 240 3 298 9" stroke="#A4F5A6" strokeWidth="3" strokeLinecap="round" opacity="0.4"/>
              </svg>
            </span>
          </h1>

          <p className="animate-fade-up delay-200 text-[18px] text-gray-500 leading-relaxed mb-8 max-w-lg">
            HotelHive centralise le statut des chambres, les tâches de nettoyage et la maintenance dans un tableau de bord intuitif. Réduisez les délais de 30% et boostez la satisfaction client.
          </p>

          <div className="animate-fade-up delay-300 flex flex-wrap items-center gap-4 mb-10">
            <Link href="/login" className="group inline-flex items-center gap-2 bg-[#A4F5A6] hover:bg-[#6FCF71] text-white font-bold px-7 py-4 rounded-2xl transition-all shadow-lg shadow-[#A4F5A6]/25 hover:shadow-xl hover:shadow-[#A4F5A6]/30 hover:-translate-y-1">
              Démarrer gratuitement
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" strokeWidth={2} />
            </Link>
            <a href="#demo" className="inline-flex items-center gap-2 text-gray-600 font-semibold hover:text-gray-900 transition-colors group">
              <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 ml-0.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 3.5L12 8L6 12.5V3.5Z"/>
                </svg>
              </div>
              Voir la démo
            </a>
          </div>

          <div className="animate-fade-up delay-400 flex flex-wrap items-center gap-6">
            {["Essai gratuit 14 jours", "Sans carte bancaire", "Annulation facile"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-gray-500">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" strokeWidth={2} />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Dashboard mockup */}
        <div className="animate-slide-right delay-200 relative">
          <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden hover:shadow-3xl transition-shadow duration-500">
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="flex-1 mx-3 bg-white rounded-md px-3 py-1 text-[11px] text-gray-400 border border-gray-200">
                app.hotelhive.io/dashboard
              </div>
            </div>

            {/* Dashboard preview */}
            <div className="p-5 bg-[#F5F5F5] min-h-[380px]">
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { label: "Occupées",    value: "24", color: "text-blue-600",    bg: "bg-blue-500"    },
                  { label: "Disponibles", value: "8",  color: "text-green-600",   bg: "bg-green-500"   },
                  { label: "Nettoyage",   value: "5",  color: "text-amber-600",   bg: "bg-amber-500"   },
                  { label: "Urgentes",    value: "2",  color: "text-[#222222]",   bg: "bg-[#A4F5A6]"   },
                ].map((s, i) => (
                  <div key={s.label} className="bg-white rounded-xl p-3 shadow-sm animate-scale-in" style={{ animationDelay: `${0.4 + i * 0.1}s` }}>
                    <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center mb-2", s.bg + "/10")}>
                      <div className={cn("w-2.5 h-2.5 rounded-full", s.bg)} />
                    </div>
                    <p className={cn("text-lg font-extrabold", s.color)}>{s.value}</p>
                    <p className="text-[10px] text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-3">
                <div className="px-3 py-2 border-b border-gray-50 flex items-center justify-between">
                  <p className="text-[11px] font-bold text-gray-600">Tâches en cours</p>
                  <span className="text-[10px] bg-[#D4DCD3] text-[#222222] font-bold px-1.5 py-0.5 rounded-full animate-pulse">3 urgentes</span>
                </div>
                {[
                  { room: "201", task: "Nettoyage complet",        dept: "Housekeeping", color: "bg-sky-500",   dot: "bg-sky-100 text-sky-700"     },
                  { room: "315", task: "Réparation climatisation",  dept: "Maintenance",  color: "bg-amber-500", dot: "bg-amber-100 text-amber-700"  },
                  { room: "108", task: "Changement literie",        dept: "Housekeeping", color: "bg-sky-500",   dot: "bg-sky-100 text-sky-700"     },
                ].map((t, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0 animate-slide-left" style={{ animationDelay: `${0.6 + i * 0.1}s` }}>
                    <div className={cn("w-1 h-8 rounded-full shrink-0", t.color)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-gray-800 truncate">{t.task}</p>
                      <p className="text-[10px] text-gray-400">Chambre {t.room}</p>
                    </div>
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0", t.dot)}>{t.dept}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl shadow-sm p-3 animate-fade-up" style={{ animationDelay: "1s" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-gray-600">Performance aujourd&apos;hui</p>
                  <span className="text-[11px] font-extrabold text-[#222222]">78%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#A4F5A6] rounded-full transition-all duration-1000" style={{ width: "78%", animation: "slideWidth 1.5s 1.2s ease both" }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">42 sur 54 tâches terminées</p>
              </div>
            </div>
          </div>

          {/* Floating notification badges */}
          <div className="absolute -left-8 top-1/3 bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 flex items-center gap-2.5 animate-float">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-800">Chambre 205 prête</p>
              <p className="text-[10px] text-gray-400">À l&apos;instant</p>
            </div>
          </div>

          <div className="absolute -right-6 bottom-1/3 bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 flex items-center gap-2.5 animate-float-rev">
            <div className="w-8 h-8 rounded-full bg-[#D4DCD3] flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#222222]" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-800">Tâche urgente assignée</p>
              <p className="text-[10px] text-gray-400">Maintenance · Chambre 412</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────

function StatItem({ target, suffix, label }: { target: number; suffix: string; label: string }) {
  const { ref, inView } = useInView(0.3);
  const count = useCountUp(target, inView);
  return (
    <div ref={ref} className={cn("text-center transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
      <p className="text-[42px] font-extrabold text-gray-900 leading-none">
        {count}{suffix}
      </p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function Stats() {
  return (
    <section className="py-20 bg-white border-y border-gray-100">
      <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-10">
        <StatItem target={30}  suffix="%" label="Réduction des délais" />
        <StatItem target={500} suffix="+" label="Hôtels utilisateurs" />
        <StatItem target={98}  suffix="%" label="Satisfaction client" />
        <StatItem target={14}  suffix="j" label="Essai gratuit" />
      </div>
    </section>
  );
}

// ── Social proof ───────────────────────────────────────────────────────────

function SocialProof() {
  return (
    <section className="border-b border-gray-100 bg-gray-50 py-10">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-8">
          Utilisé par des hôtels dans toute la France
        </Reveal>
        <div className="flex flex-wrap items-center justify-center gap-10">
          {["Grand Hôtel", "Les Bains", "Résidence du Parc", "Château Blanc", "Villa Mer"].map((name, i) => (
            <Reveal key={name} delay={i * 80} animation="fade-up" className="opacity-40 hover:opacity-70 transition-opacity cursor-default">
              <span className="text-lg font-extrabold text-gray-700 tracking-tight">{name}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Comparison ─────────────────────────────────────────────────────────────

function Comparison() {
  const oldWay = [
    "Communication par walkie-talkie ou SMS dispersés",
    "Retards de nettoyage non détectés → clients mécontents",
    "Aucune visibilité sur la charge de travail de l'équipe",
    "Rapports manuels sur Excel chaque semaine",
    "Tâches de maintenance oubliées ou en doublon",
  ];
  const newWay = [
    "Notifications instantanées à tout le personnel en temps réel",
    "Statut des chambres mis à jour automatiquement à la fin des tâches",
    "Tableau de bord de performance de chaque employé",
    "Rapports générés en 1 clic, exportables en CSV",
    "Assignation intelligente selon la charge de travail",
  ];

  return (
    <section className="py-28 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <Reveal className="text-center mb-16">
          <p className="text-[#222222] text-sm font-bold uppercase tracking-widest mb-3">Le problème</p>
          <h2 className="text-[40px] font-extrabold text-gray-900 tracking-tight">Arrêtez de subir. Commencez à piloter.</h2>
          <p className="text-gray-500 mt-4 text-lg max-w-2xl mx-auto">Les hôtels perdent en moyenne 2h par jour en coordination manuelle. HotelHive automatise tout ça.</p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Reveal animation="slide-left" className="rounded-3xl border-2 border-red-100 bg-red-50/50 p-8">
            <div className="inline-flex items-center gap-2 bg-red-100 text-red-600 text-xs font-bold px-3 py-1.5 rounded-full mb-6">
              <X className="w-3.5 h-3.5" strokeWidth={2.5} />
              L&apos;ancienne méthode
            </div>
            <ul className="flex flex-col gap-4">
              {oldWay.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                  <div className="w-5 h-5 rounded-full bg-red-200 flex items-center justify-center shrink-0 mt-0.5">
                    <X className="w-3 h-3 text-red-600" strokeWidth={2.5} />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal animation="slide-right" className="rounded-3xl border-2 border-[#A4F5A6]/20 bg-[#D4DCD3]/40 p-8">
            <div className="inline-flex items-center gap-2 bg-[#A4F5A6] text-[#222222] text-xs font-bold px-3 py-1.5 rounded-full mb-6">
              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />
              Avec HotelHive
            </div>
            <ul className="flex flex-col gap-4">
              {newWay.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-[#A4F5A6] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={2.5} />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ── Features ───────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: BedDouble,    color: "bg-blue-50 text-blue-600",       title: "Statut des chambres en direct",    desc: "Suivez chaque chambre en temps réel. Disponible, occupée, nettoyage, maintenance — tout est visible en un coup d'œil." },
  { icon: ClipboardList,color: "bg-[#D4DCD3] text-[#222222]",    title: "Gestion des tâches",               desc: "Créez, assignez et suivez les tâches de votre équipe. Vue kanban ou liste, avec priorités et délais." },
  { icon: Wrench,       color: "bg-amber-50 text-amber-600",      title: "Maintenance intégrée",             desc: "Tickets de maintenance directement liés aux chambres. L'équipe reçoit une notification immédiate sur son téléphone." },
  { icon: Bell,         color: "bg-purple-50 text-purple-600",    title: "Notifications en temps réel",      desc: "Chaque changement d'état déclenche une alerte à la bonne personne. Fini les oublis, fini les retards." },
  { icon: BarChart3,    color: "bg-green-50 text-green-600",      title: "Rapports & analytics",             desc: "Performance par employé, par département, par période. Exportez en CSV pour vos réunions d'équipe." },
  { icon: Smartphone,   color: "bg-sky-50 text-sky-600",          title: "Application mobile PWA",           desc: "Votre staff accède à ses tâches depuis n'importe quel smartphone. Sans installation, directement depuis le navigateur." },
];

function Features() {
  return (
    <section className="py-28 bg-gray-50" id="demo">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal className="text-center mb-16">
          <p className="text-[#222222] text-sm font-bold uppercase tracking-widest mb-3">Fonctionnalités</p>
          <h2 className="text-[40px] font-extrabold text-gray-900 tracking-tight">Tout ce dont vous avez besoin.</h2>
          <p className="text-gray-500 mt-4 text-lg max-w-xl mx-auto">Un seul outil pour coordonner toutes vos équipes, du manager au personnel de ménage.</p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, color, title, desc }, i) => (
            <Reveal
              key={title}
              delay={i * 80}
              animation="fade-up"
              className="bg-white rounded-3xl p-7 border border-gray-100 hover:shadow-lg hover:-translate-y-2 transition-all duration-300 group cursor-default"
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110 duration-300", color)}>
                <Icon className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <h3 className="text-[17px] font-extrabold text-gray-900 mb-2 group-hover:text-[#222222] transition-colors duration-300">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How it works ───────────────────────────────────────────────────────────

const STEPS = [
  { num: "01", icon: BedDouble,    title: "Sélectionnez une chambre et changez son statut",    desc: "Le manager ou la réception indique qu'une chambre nécessite un nettoyage ou une maintenance directement depuis le tableau de bord.",    badge: "Temps réel",  badgeColor: "bg-blue-50 text-blue-600"         },
  { num: "02", icon: Users,         title: "La tâche est assignée automatiquement",              desc: "HotelHive sélectionne le membre du personnel le moins chargé et lui envoie une notification immédiate sur son téléphone.",              badge: "Automatique", badgeColor: "bg-[#D4DCD3] text-[#222222]"     },
  { num: "03", icon: CheckCircle2,  title: "Le staff complète et confirme",                     desc: "Le personnel valide la tâche depuis son téléphone, ajoute des photos si besoin, et la chambre passe automatiquement en disponible.",     badge: "Mobile",      badgeColor: "bg-green-50 text-green-600"       },
  { num: "04", icon: Shield,        title: "Le statut se met à jour pour tous",                 desc: "En temps réel, tout le monde voit la chambre disponible. La réception peut immédiatement attribuer la chambre au prochain client.",      badge: "Instantané",  badgeColor: "bg-purple-50 text-purple-600"     },
];

function HowItWorks() {
  return (
    <section className="py-28 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <Reveal className="text-center mb-16">
          <p className="text-[#222222] text-sm font-bold uppercase tracking-widest mb-3">Fonctionnement</p>
          <h2 className="text-[40px] font-extrabold text-gray-900 tracking-tight">Simple. Rapide. Efficace.</h2>
          <p className="text-gray-500 mt-4 text-lg">4 étapes pour une opération hôtelière sans friction.</p>
        </Reveal>

        <div className="flex flex-col gap-4">
          {STEPS.map(({ num, icon: Icon, title, desc, badge, badgeColor }, i) => (
            <Reveal
              key={num}
              delay={i * 120}
              animation="fade-up"
              className="flex items-start gap-6 bg-gray-50 rounded-3xl p-6 border border-gray-100 hover:border-[#A4F5A6]/20 hover:bg-[#D4DCD3]/20 transition-all duration-300 group cursor-default"
            >
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shadow-sm group-hover:border-[#A4F5A6]/30 group-hover:shadow-md transition-all duration-300">
                  <Icon className="w-5 h-5 text-gray-500 group-hover:text-[#222222] transition-colors duration-300" strokeWidth={1.5} />
                </div>
                {i < STEPS.length - 1 && <div className="w-px h-4 bg-gray-200" />}
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-extrabold text-gray-300">{num}</span>
                  <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full", badgeColor)}>{badge}</span>
                </div>
                <h3 className="text-[17px] font-extrabold text-gray-900 mb-1">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ───────────────────────────────────────────────────────────

const TESTIMONIALS = [
  { name: "Sophie Martin",  role: "Directrice, Hôtel Belle Époque",  avatar: "SM", color: "bg-blue-100 text-blue-700",         stars: 5, quote: "Depuis HotelHive, nos délais de nettoyage ont été réduits de 40%. L'équipe adore recevoir ses tâches directement sur le téléphone."               },
  { name: "Karim Benali",   role: "Manager, Résidence du Parc",      avatar: "KB", color: "bg-amber-100 text-amber-700",        stars: 5, quote: "La page rapports m'a permis d'identifier nos bottlenecks en 10 minutes. J'aurais mis des semaines avec Excel."                                       },
  { name: "Claire Dumont",  role: "Responsable, Grand Hôtel",        avatar: "CD", color: "bg-[#D4DCD3] text-[#222222]",       stars: 5, quote: "L'interface est tellement claire que mon équipe a été autonome dès le premier jour. Zéro formation nécessaire."                                       },
];

function Testimonials() {
  return (
    <section className="py-28 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal className="text-center mb-16">
          <p className="text-[#222222] text-sm font-bold uppercase tracking-widest mb-3">Témoignages</p>
          <h2 className="text-[40px] font-extrabold text-gray-900 tracking-tight">Ils nous font confiance.</h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ name, role, avatar, color, stars, quote }, i) => (
            <Reveal key={name} delay={i * 120} animation="fade-up"
              className="bg-white rounded-3xl p-7 border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex items-center gap-1 mb-4">
                {[...Array(stars)].map((_, j) => (
                  <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-6">&ldquo;{quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold shrink-0", color)}>
                  {avatar}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{name}</p>
                  <p className="text-xs text-gray-400">{role}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pricing ────────────────────────────────────────────────────────────────

const PLANS = [
  { name: "Basic",      price: "29",        desc: "Idéal pour les petits établissements", color: "border-gray-200", badge: null,             features: ["Jusqu'à 10 utilisateurs", "Gestion des chambres", "Tâches et assignation", "Notifications in-app", "Mode hors-ligne", "Support email"]                                 },
  { name: "Pro",        price: "89",        desc: "Pour les hôtels qui veulent performer", color: "border-[#A4F5A6]", badge: "Le plus populaire", features: ["Jusqu'à 50 utilisateurs", "Tout le plan Basic", "Notifications push mobile", "Rapports & export CSV", "Tâches récurrentes", "Support prioritaire"]           },
  { name: "Enterprise", price: "Sur mesure", desc: "Pour les groupes hôteliers",           color: "border-gray-200", badge: null,             features: ["Utilisateurs illimités", "Multi-hôtels", "White-label", "Intégration PMS / API", "SSO & sécurité avancée", "Account manager dédié"]                               },
];

function Pricing() {
  return (
    <section className="py-28 bg-white" id="tarifs">
      <div className="max-w-5xl mx-auto px-6">
        <Reveal className="text-center mb-16">
          <p className="text-[#222222] text-sm font-bold uppercase tracking-widest mb-3">Tarifs</p>
          <h2 className="text-[40px] font-extrabold text-gray-900 tracking-tight">Simple et transparent.</h2>
          <p className="text-gray-500 mt-4 text-lg">Commencez gratuitement pendant 14 jours. Sans carte bancaire.</p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map(({ name, price, desc, color, badge, features }, i) => (
            <Reveal key={name} delay={i * 120} animation="fade-up"
              className={cn(
                "relative rounded-3xl border-2 p-7 flex flex-col hover:-translate-y-2 transition-all duration-300",
                color,
                badge ? "bg-[#EEF1EE] shadow-xl shadow-[#A4F5A6]/10" : "bg-white"
              )}
            >
              {badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#A4F5A6] text-[#222222] text-[11px] font-bold px-4 py-1.5 rounded-full whitespace-nowrap animate-pulse-dot">
                  {badge}
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-[17px] font-extrabold text-gray-900 mb-1">{name}</h3>
                <p className="text-xs text-gray-400 mb-4">{desc}</p>
                <div className="flex items-end gap-1">
                  {price === "Sur mesure" ? (
                    <span className="text-[32px] font-extrabold text-gray-900">{price}</span>
                  ) : (
                    <>
                      <span className="text-[40px] font-extrabold text-gray-900">{price}€</span>
                      <span className="text-gray-400 mb-2">/mois</span>
                    </>
                  )}
                </div>
              </div>
              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-[#222222] shrink-0" strokeWidth={2} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/login" className={cn(
                "group inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all",
                badge ? "bg-[#A4F5A6] hover:bg-[#6FCF71] text-white shadow-md shadow-[#A4F5A6]/25 hover:shadow-lg" : "bg-gray-100 hover:bg-gray-200 text-gray-800"
              )}>
                {price === "Sur mesure" ? "Nous contacter" : "Commencer gratuitement"}
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" strokeWidth={2} />
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA ────────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section className="py-28 px-6">
      <div className="max-w-4xl mx-auto">
        <Reveal animation="scale-in">
          <div className="relative bg-[#A4F5A6] rounded-[40px] overflow-hidden px-12 py-16 text-center">
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full animate-float" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/10 rounded-full animate-float-rev" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full" />
            </div>
            <div className="relative z-10">
              <h2 className="text-[42px] font-extrabold text-white tracking-tight leading-tight mb-4">
                Prêt à transformer<br />la gestion de votre hôtel ?
              </h2>
              <p className="text-white/80 text-lg mb-10 max-w-xl mx-auto">
                Rejoignez des centaines d&apos;hôtels qui ont réduit leurs délais et boosté leur satisfaction client.
              </p>
              <Link href="/login" className="group inline-flex items-center gap-2 bg-white text-[#222222] font-extrabold px-8 py-4 rounded-2xl hover:bg-gray-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1">
                Démarrer gratuitement — 14 jours
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" strokeWidth={2} />
              </Link>
              <div className="flex flex-wrap items-center justify-center gap-6 mt-8">
                {["Sans carte bancaire", "Annulation à tout moment", "Support inclus"].map((item) => (
                  <div key={item} className="flex items-center gap-1.5 text-white/70 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-white/90" strokeWidth={2} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4"><Logo width={110} /></div>
            <p className="text-gray-400 text-sm leading-relaxed">La plateforme de gestion hôtelière pensée pour les équipes modernes.</p>
          </div>
          {[
            { title: "Produit",    links: ["Fonctionnalités", "Tarifs", "Nouveautés", "Roadmap"] },
            { title: "Entreprise", links: ["À propos", "Blog", "Carrières", "Contact"]          },
            { title: "Support",    links: ["Documentation", "API", "Statut", "RGPD"]            },
          ].map(({ title, links }) => (
            <div key={title}>
              <p className="text-sm font-bold text-white mb-4">{title}</p>
              <ul className="flex flex-col gap-2.5">
                {links.map((l) => (
                  <li key={l}><a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">© 2026 HotelHive. Tous droits réservés.</p>
          <div className="flex items-center gap-6">
            {["Confidentialité", "CGU", "Cookies"].map((item) => (
              <a key={item} href="#" className="text-xs text-gray-500 hover:text-white transition-colors">{item}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <Stats />
      <SocialProof />
      <Comparison />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <CTA />
      <Footer />
    </main>
  );
}
