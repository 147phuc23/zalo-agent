"use client";

import React, { useState, useEffect } from "react";
import { User, ClipboardList, CheckCircle, XCircle, ChevronRight, MessageSquare, Clock, RefreshCw, FileText, ArrowRight } from "lucide-react";

interface Application {
  id: string;
  tenant_id: string;
  job_posting_id: string;
  contact_id: string | null;
  guest_access_id: string | null;
  candidate_profile_id: string | null;
  stage: "submitted" | "screening" | "interviewing" | "offer";
  status: "active" | "hired" | "rejected" | "withdrawn";
  applied_via: "chat" | "admin";
  note: string | null;
  created_at: string;
  updated_at: string;
  job_title: string;
  company_name: string;
  candidate_name: string | null;
  company_interview_process?: Array<{ round: number; name: string; description: string }>;
}

interface ApplicationEvent {
  id: string;
  from_stage: string | null;
  to_stage: string;
  from_status: string | null;
  to_status: string;
  actor_type: string;
  actor_id: string | null;
  note: string | null;
  created_at: string;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  
  // Filter/Tabs state
  const [activeStage, setActiveStage] = useState<"submitted" | "screening" | "interviewing" | "offer">("submitted");
  const [showStatus, setShowStatus] = useState<"active" | "all">("active");
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Transition Form state
  const [transitionStage, setTransitionStage] = useState<string>("");
  const [transitionStatus, setTransitionStatus] = useState<string>("");
  const [transitionNote, setTransitionNote] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadApplications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/applications`);
      const data = await res.json();
      if (data.ok) {
        setApplications(data.applications || []);
      } else {
        showToast(data.error || "Cannot load applications", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Network error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const loadEvents = async (appId: string) => {
    try {
      const res = await fetch(`/api/applications/${appId}/events`);
      const data = await res.json();
      if (data.ok) {
        setEvents(data.events || []);
      }
    } catch (err: any) {
      console.error("Failed to load events", err);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      loadEvents(selectedApp.id);
      // Reset transition form
      setTransitionStage(selectedApp.stage);
      setTransitionStatus(selectedApp.status);
      setTransitionNote("");
    } else {
      setEvents([]);
    }
  }, [selectedApp]);

  const handleTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    setIsTransitioning(true);
    try {
      const res = await fetch(`/api/applications/${selectedApp.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStage: transitionStage !== selectedApp.stage ? transitionStage : undefined,
          toStatus: transitionStatus !== selectedApp.status ? transitionStatus : undefined,
          note: transitionNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        showToast("Application stage updated successfully!");
        setSelectedApp(data.application);
        // Refresh list
        await loadApplications();
      } else {
        showToast(data.error || "Transition failed", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Transition failed", "error");
    } finally {
      setIsTransitioning(false);
    }
  };

  // Filter applications based on UI controls
  const filteredApps = applications.filter((app) => {
    const stageMatch = app.stage === activeStage;
    const statusMatch = showStatus === "active" ? app.status === "active" : true;
    return stageMatch && statusMatch;
  });

  const stages: Array<{ id: typeof activeStage; label: string }> = [
    { id: "submitted", label: "Nộp hồ sơ (Submitted)" },
    { id: "screening", label: "Sàng lọc (Screening)" },
    { id: "interviewing", label: "Phỏng vấn (Interviewing)" },
    { id: "offer", label: "Đề nghị (Offer)" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-stone-50 font-sans">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-stone-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-indigo-600" />
          <h1 className="text-xl font-semibold text-stone-900">Application Tracking</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={loadApplications}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Filter and List */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-stone-200">
          {/* Controls */}
          <div className="bg-white border-b border-stone-200 px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2 bg-stone-100 p-1 rounded-lg">
              {stages.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setActiveStage(st.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeStage === st.id
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-stone-500 font-medium">Status:</span>
              <select
                value={showStatus}
                onChange={(e: any) => setShowStatus(e.target.value)}
                className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-semibold text-stone-700 outline-none"
              >
                <option value="active">Active Only</option>
                <option value="all">Show All (Incl. Terminal)</option>
              </select>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center text-stone-400">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading applications...
              </div>
            ) : filteredApps.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-white text-stone-400">
                <ClipboardList className="h-8 w-8 mb-2" />
                No applications in this stage
              </div>
            ) : (
              filteredApps.map((app) => (
                <div
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className={`group relative flex flex-col justify-between rounded-xl border p-5 transition-all cursor-pointer ${
                    selectedApp?.id === app.id
                      ? "border-indigo-600 bg-indigo-50/10 ring-1 ring-indigo-600"
                      : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-semibold text-stone-900 group-hover:text-indigo-600">
                        {app.candidate_name || "Anonymous Candidate"}
                      </h3>
                      <p className="text-sm font-medium text-stone-500 mt-1">
                        {app.job_title} · <span className="text-stone-400">{app.company_name}</span>
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          app.status === "active"
                            ? "bg-amber-100 text-amber-800"
                            : app.status === "hired"
                            ? "bg-green-100 text-green-800"
                            : "bg-stone-200 text-stone-700"
                        }`}
                      >
                        {app.status}
                      </span>
                      <span className="text-xs text-stone-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(app.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {app.note && (
                    <div className="mt-3 rounded-lg bg-stone-50 p-2.5 text-xs text-stone-600 border border-stone-100">
                      <strong>Note:</strong> {app.note}
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-3 text-xs text-stone-400">
                    <span className="flex items-center gap-1 font-medium bg-stone-100 px-2 py-0.5 rounded text-stone-600">
                      Channel: {app.applied_via}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Detailed Details + Transitions */}
        <div className="w-[420px] bg-white border-l border-stone-200 flex flex-col overflow-y-auto p-6">
          {selectedApp ? (
            <div className="space-y-6 flex-1 flex flex-col">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Candidate Details</span>
                <h2 className="text-xl font-bold text-stone-900 mt-1">
                  {selectedApp.candidate_name || "Anonymous Candidate"}
                </h2>
                <p className="text-sm text-stone-500 mt-0.5">
                  Applied via: <strong className="text-indigo-600">{selectedApp.applied_via}</strong>
                </p>
              </div>

              {/* Status & Stage Tracker */}
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-stone-50 p-4 border border-stone-200/60">
                <div>
                  <span className="text-xs text-stone-400 font-semibold block">Pipeline Stage</span>
                  <span className="font-semibold text-stone-800 capitalize mt-1 block">{selectedApp.stage}</span>
                </div>
                <div>
                  <span className="text-xs text-stone-400 font-semibold block">Status</span>
                  <span className="font-semibold text-stone-800 capitalize mt-1 block">{selectedApp.status}</span>
                </div>
              </div>

              {/* Company Interview Process */}
              {selectedApp.company_interview_process && selectedApp.company_interview_process.length > 0 && (
                <div className="border-t border-stone-150 pt-5">
                  <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Hiring Process & Rounds</h4>
                  <div className="space-y-3.5">
                    {selectedApp.company_interview_process.map((round) => (
                      <div key={round.round} className="flex gap-3">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600 border border-indigo-200">
                          {round.round}
                        </div>
                        <div className="text-xs">
                          <span className="font-semibold text-stone-800 block">{round.name}</span>
                          <span className="text-stone-450 mt-0.5 block leading-relaxed">{round.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transition Form */}
              {selectedApp.status === "active" ? (
                <form onSubmit={handleTransition} className="space-y-4 border-t border-stone-200 pt-6">
                  <h4 className="text-sm font-semibold text-stone-900">Update Application State</h4>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-stone-600 block">Next Stage</label>
                    <select
                      value={transitionStage}
                      onChange={(e) => setTransitionStage(e.target.value)}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm bg-white outline-none focus:border-indigo-500"
                    >
                      <option value="submitted">Submitted</option>
                      <option value="screening">Screening</option>
                      <option value="interviewing">Interviewing</option>
                      <option value="offer">Offer</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-stone-600 block">Change Status</label>
                    <select
                      value={transitionStatus}
                      onChange={(e) => setTransitionStatus(e.target.value)}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm bg-white outline-none focus:border-indigo-500"
                    >
                      <option value="active">Active (Keep in Pipeline)</option>
                      <option value="hired">Hired (Terminal)</option>
                      <option value="rejected">Rejected (Terminal)</option>
                      <option value="withdrawn">Withdrawn (Terminal)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-stone-600 block">Transition Note</label>
                    <textarea
                      value={transitionNote}
                      onChange={(e) => setTransitionNote(e.target.value)}
                      placeholder="Add an internal note explaining the status change..."
                      rows={3}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isTransitioning}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isTransitioning ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <ArrowRight className="h-4 w-4" />
                        Apply Transitions
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 text-center text-sm text-stone-500">
                  This application is in a terminal status ({selectedApp.status}) and cannot be edited.
                </div>
              )}

              {/* Event Timeline History */}
              <div className="border-t border-stone-200 pt-6 flex-1">
                <h4 className="text-sm font-semibold text-stone-900 mb-4">Application History</h4>
                <div className="space-y-4">
                  {events.map((ev, index) => (
                    <div key={ev.id} className="relative flex gap-3 pb-2 last:pb-0">
                      {/* Timeline line */}
                      {index < events.length - 1 && (
                        <span className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-stone-200" />
                      )}
                      
                      {/* Timeline Dot */}
                      <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 border-2 border-stone-300">
                        <div className="h-2 w-2 rounded-full bg-stone-500" />
                      </div>

                      {/* Event Details */}
                      <div className="flex-1 text-xs">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-stone-850 flex flex-wrap items-center gap-1.5">
                            <span>{ev.from_stage ? `${ev.from_stage} → ${ev.to_stage}` : `Applied: ${ev.to_stage}`}</span>
                            {index > 0 && (
                              <span className="text-[10px] text-indigo-500 font-normal bg-indigo-50 px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Duration in previous stage">
                                ⏱️ {(() => {
                                  const diffMs = new Date(ev.created_at).getTime() - new Date(events[index - 1].created_at).getTime();
                                  const diffHours = diffMs / (1000 * 60 * 60);
                                  if (diffHours < 24) return `${diffHours.toFixed(1)}h`;
                                  return `${(diffHours / 24).toFixed(1)}d`;
                                })()}
                              </span>
                            )}
                          </span>
                          <span className="text-stone-400">{new Date(ev.created_at).toLocaleDateString()}</span>
                        </div>
                        {ev.to_status !== "active" && (
                          <div className="mt-0.5 font-bold text-amber-700">
                            Status changed to {ev.to_status}
                          </div>
                        )}
                        <div className="text-stone-400 mt-0.5">
                          by {ev.actor_type} ({ev.actor_id || "system"})
                        </div>
                        {ev.note && (
                          <div className="mt-1.5 rounded bg-stone-50 p-2 text-stone-600 italic border border-stone-100">
                            "{ev.note}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-stone-400 text-center h-full">
              <ClipboardList className="h-10 w-10 mb-2 text-stone-300" />
              Select an application to view details and history
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg transition-all ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
