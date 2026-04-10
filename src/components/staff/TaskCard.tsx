"use client";

import Link from "next/link";
import { MapPin, ChevronRight, CheckCircle } from "lucide-react";
import { Task, TaskStatus, Department } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  task: Task;
  onStart: (id: string) => void;
  onDone: (id: string) => void;
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  a_faire:  "À faire",
  en_cours: "En cours",
  terminee: "Terminé",
  annulee:  "Annulé",
};

const DEPT_CONFIG: Record<Department, { label: string; className: string }> = {
  housekeeping: { label: "Housekeeping", className: "bg-sky-50 text-sky-600 border-sky-200"    },
  maintenance:  { label: "Maintenance",  className: "bg-amber-50 text-amber-600 border-amber-200" },
  it:           { label: "IT",           className: "bg-purple-50 text-purple-600 border-purple-200" },
  reception:    { label: "Réception",    className: "bg-green-50 text-green-600 border-green-200" },
};

const STATUS_VARIANT: Record<TaskStatus, "default" | "secondary" | "outline"> = {
  a_faire:  "secondary",
  en_cours: "default",
  terminee: "outline",
  annulee:  "outline",
};

export default function TaskCard({ task, onStart, onDone }: Props) {
  const isUrgent = task.type === "urgente";
  const isDone   = task.status === "terminee" || task.status === "annulee";
  const dept     = DEPT_CONFIG[task.department];

  return (
    <Card className={`overflow-hidden ${isDone ? "opacity-60" : ""}`}>
      {/* Urgency accent bar */}
      <div className={`h-1 w-full ${isUrgent ? "bg-primary" : "bg-border"}`} />

      <CardContent className="p-4">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {isUrgent && (
            <Badge className="text-[11px] uppercase tracking-wide">Urgent</Badge>
          )}
          <Badge variant={STATUS_VARIANT[task.status]} className="text-[11px]">
            {STATUS_LABEL[task.status]}
          </Badge>
          <Badge variant="outline" className={`text-[11px] ${dept.className}`}>
            {dept.label}
          </Badge>
        </div>

        {/* Title & description */}
        <h3 className="mt-2 text-[15px] font-bold leading-snug">{task.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {task.description}
        </p>

        {/* Location */}
        {task.location && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
            {task.location}
          </div>
        )}

        {/* Quick actions */}
        {!isDone && (
          <div className="mt-4 flex gap-2">
            {task.status === "a_faire" && (
              <Button
                variant="secondary"
                className="flex-1 font-bold"
                onClick={() => onStart(task.id)}
              >
                Démarrer
              </Button>
            )}
            {task.status === "en_cours" && (
              <Button
                className="flex-1 font-bold gap-1.5"
                onClick={() => onDone(task.id)}
              >
                <CheckCircle className="w-4 h-4" strokeWidth={1.5} />
                Terminé
              </Button>
            )}
            <Link href={`/mes-taches/${task.id}`} className={cn(buttonVariants({ variant: "outline", size: "icon" }))}>
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </Link>
          </div>
        )}

        {isDone && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-green-500 font-semibold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
              Tâche terminée
            </p>
            <Link href={`/mes-taches/${task.id}`} className="text-xs text-muted-foreground underline underline-offset-2">
              Voir le détail
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
