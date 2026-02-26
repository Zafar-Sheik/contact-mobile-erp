import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle, Circle, Clock, AlertCircle } from "lucide-react";

export type TimelineStatus = "pending" | "completed" | "current" | "skipped" | "error";

export interface TimelineStep {
  id: string;
  label: string;
  status: TimelineStatus;
  date?: string;
  description?: string;
}

interface TimelineProps {
  steps: TimelineStep[];
  className?: string;
  orientation?: "horizontal" | "vertical";
}

const statusConfig = {
  pending: {
    icon: Circle,
    dot: "bg-gray-200",
    line: "bg-gray-200",
    text: "text-gray-500",
  },
  completed: {
    icon: CheckCircle,
    dot: "bg-green-500",
    line: "bg-green-500",
    text: "text-gray-900",
  },
  current: {
    icon: Clock,
    dot: "bg-blue-500 animate-pulse",
    line: "bg-gray-200",
    text: "text-blue-600",
  },
  skipped: {
    icon: Circle,
    dot: "bg-gray-300",
    line: "bg-gray-300",
    text: "text-gray-400",
  },
  error: {
    icon: AlertCircle,
    dot: "bg-red-500",
    line: "bg-gray-200",
    text: "text-red-600",
  },
};

export function Timeline({ steps, className, orientation = "horizontal" }: TimelineProps) {
  if (orientation === "vertical") {
    return (
      <div className={cn("space-y-0", className)}>
        {steps.map((step, index) => {
          const config = statusConfig[step.status];
          const Icon = config.icon;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex gap-3">
              {/* Timeline indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    config.dot
                  )}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
                {!isLast && (
                  <div className={cn("w-0.5 h-full", config.line)} />
                )}
              </div>

              {/* Step content */}
              <div className={cn("pb-6", isLast && "pb-0")}>
                <p className={cn("font-medium", config.text)}>{step.label}</p>
                {step.description && (
                  <p className="text-sm text-gray-500">{step.description}</p>
                )}
                {step.date && (
                  <p className="text-xs text-gray-400 mt-1">{step.date}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal orientation
  return (
    <div className={cn("flex items-center w-full", className)}>
      {steps.map((step, index) => {
        const config = statusConfig[step.status];
        const Icon = config.icon;
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            {/* Step */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                  config.dot
                )}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className={cn("text-xs mt-2 font-medium", config.text)}>{step.label}</p>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  "flex-1 h-1 mx-2 rounded",
                  index < steps.findIndex(s => s.status === "current" || s.status === "pending")
                    ? "bg-green-500" 
                    : "bg-gray-200"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Helper to generate standard P2P timelines
export function getP2PTimeline(
  documentStatus: string,
  createdAt?: string,
  postedAt?: string,
  paidAt?: string
): TimelineStep[] {
  const timelineMap: Record<string, TimelineStep[]> = {
    Draft: [
      { id: "created", label: "Created", status: "completed", date: createdAt },
      { id: "submitted", label: "Submitted", status: "pending" },
      { id: "posted", label: "Posted", status: "pending" },
      { id: "paid", label: "Paid", status: "pending" },
    ],
    Issued: [
      { id: "created", label: "Created", status: "completed", date: createdAt },
      { id: "submitted", label: "Submitted", status: "completed" },
      { id: "posted", label: "Posted", status: "pending" },
      { id: "paid", label: "Paid", status: "pending" },
    ],
    Posted: [
      { id: "created", label: "Created", status: "completed", date: createdAt },
      { id: "submitted", label: "Submitted", status: "completed" },
      { id: "posted", label: "Posted", status: "completed", date: postedAt },
      { id: "paid", label: "Paid", status: "pending" },
    ],
    Paid: [
      { id: "created", label: "Created", status: "completed", date: createdAt },
      { id: "submitted", label: "Submitted", status: "completed" },
      { id: "posted", label: "Posted", status: "completed", date: postedAt },
      { id: "paid", label: "Paid", status: "completed", date: paidAt },
    ],
    Cancelled: [
      { id: "created", label: "Created", status: "completed", date: createdAt },
      { id: "cancelled", label: "Cancelled", status: "error" },
    ],
  };

  return timelineMap[documentStatus] || timelineMap.Draft;
}
