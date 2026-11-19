import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Calendar,
  CalendarOff,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Loader2,
  PlusCircle,
  FileText,
  ShieldAlert,
  Ban,
  Check,
} from "lucide-react";
import { User, DoctorLeave } from "../../types/hms";
import { doctorService } from "../../services/doctorService";

interface DoctorLeaveModalProps {
  activeDoctor: User;
  isOpen: boolean;
  onClose: () => void;
  onLeaveUpdated?: () => void;
}

export const DoctorLeaveModal: React.FC<DoctorLeaveModalProps> = ({
  activeDoctor,
  isOpen,
  onClose,
  onLeaveUpdated,
}) => {
  const getTodayStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [leaveType, setLeaveType] = useState<string>("Casual Leave");
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [doctorLeaves, setDoctorLeaves] = useState<DoctorLeave[]>([]);
  const [isLoadingLeaves, setIsLoadingLeaves] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Set of all dates where this doctor already has approved leave
  const approvedLeaveDateSet = useMemo(() => {
    return new Set(doctorLeaves.map((lv) => lv.date));
  }, [doctorLeaves]);

  // Find the first available upcoming date that is NOT already an approved leave
  const getFirstAvailableDateStr = (bookedDates: Set<string>) => {
    const now = new Date();
    for (let i = 1; i <= 365; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dStr = `${year}-${month}-${day}`;
      if (!bookedDates.has(dStr)) {
        return dStr;
      }
    }
    return getTomorrowStr();
  };

  const loadLeaves = async () => {
    setIsLoadingLeaves(true);
    const res = await doctorService.getDoctorLeaves(activeDoctor.id, activeDoctor.name);
    if (res.success && res.data) {
      setDoctorLeaves(res.data);
      const bookedSet = new Set(res.data.map((l) => l.date));
      const firstFree = getFirstAvailableDateStr(bookedSet);
      setStartDate(firstFree);
      setEndDate(firstFree);
    }
    setIsLoadingLeaves(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadLeaves();
      setReason("");
    }
  }, [isOpen]);

  // Next 14 upcoming days for interactive calendar view
  const upcomingCalendarDays = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;
      const weekday = i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short" });
      const dayNum = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
      const isBlocked = approvedLeaveDateSet.has(dateStr);
      list.push({ dateStr, weekday, dayNum, isBlocked, offset: i });
    }
    return list;
  }, [approvedLeaveDateSet]);

  // Detect any conflicting dates in currently selected [startDate, endDate] range
  const rangeConflicts = useMemo(() => {
    if (!startDate) return [];
    const start = new Date(startDate);
    const end = new Date(endDate || startDate);
    const cur = new Date(start);
    const conflicts: string[] = [];
    while (cur <= end) {
      const year = cur.getFullYear();
      const month = String(cur.getMonth() + 1).padStart(2, "0");
      const day = String(cur.getDate()).padStart(2, "0");
      const dStr = `${year}-${month}-${day}`;
      if (approvedLeaveDateSet.has(dStr)) {
        conflicts.push(dStr);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return conflicts;
  }, [startDate, endDate, approvedLeaveDateSet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) {
      showToast("Please select a start date!");
      return;
    }

    const today = getTodayStr();
    if (startDate < today) {
      showToast("Cannot apply leave for past dates!");
      return;
    }

    if (rangeConflicts.length > 0) {
      showToast(`⚠️ You already have an approved leave on ${rangeConflicts.join(", ")}! Duplicate leave cannot be applied.`);
      return;
    }

    const finalEnd = endDate && endDate >= startDate ? endDate : startDate;

    setIsSubmitting(true);
    const res = await doctorService.applyLeave({
      doctorId: activeDoctor.id,
      doctorName: activeDoctor.name,
      startDate,
      endDate: finalEnd,
      leaveType,
      reason: reason.trim() || `${leaveType} - Doctor unavailable`,
    });

    setIsSubmitting(false);

    if (res.success) {
      showToast(res.message || "Leave applied successfully! Calendar blocked.");
      await loadLeaves();
      onLeaveUpdated?.();
      setReason("");
    } else {
      showToast(res.message || "Failed to apply leave. Please try again.");
    }
  };

  const handleCancelLeave = async (leaveId: string, date: string) => {
    if (!window.confirm(`Are you sure you want to cancel leave for ${date}? This date will be reopened for bookings.`)) {
      return;
    }
    const res = await doctorService.cancelLeave(leaveId);
    if (res.success) {
      showToast(`Leave for ${date} cancelled. Date reopened for bookings.`);
      await loadLeaves();
      onLeaveUpdated?.();
    } else {
      showToast("Failed to cancel leave.");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-16 right-4 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl font-bold text-xs flex items-center gap-2 animate-bounce border border-emerald-400/30">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-4 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold shrink-0">
              <CalendarOff className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                <span>Apply Doctor Leave</span>
                <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                  Blocks Calendar
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {activeDoctor.name} • {activeDoctor.department || "Consultant Physician"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning / Calendar Notice Banner */}
        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl flex items-start gap-2.5 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <p className="leading-relaxed">
            Applying leave will <strong>block your schedule in the hospital booking calendar</strong>.
            Dates already on approved leave are <strong>blocked out</strong> to prevent double-booking.
          </p>
        </div>

        {/* Visual Calendar Strip: Shows Blocked vs Available Upcoming Dates */}
        <div className="space-y-1.5 bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Calendar Availability (Next 14 Days)</span>
            </span>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                Blocked
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-700 inline-block" />
                Available
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                Selected
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
            {upcomingCalendarDays.map((item) => {
              const isBlocked = item.isBlocked;
              const isSelected =
                !isBlocked &&
                startDate &&
                item.dateStr >= startDate &&
                item.dateStr <= (endDate || startDate);

              return (
                <button
                  key={item.dateStr}
                  type="button"
                  disabled={isBlocked}
                  onClick={() => {
                    if (isBlocked) {
                      showToast(`⚠️ ${item.dateStr} is already an approved leave!`);
                      return;
                    }
                    setStartDate(item.dateStr);
                    setEndDate(item.dateStr);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl border text-center transition-all shrink-0 text-xs min-w-[70px] ${
                    isBlocked
                      ? "bg-rose-950/30 border-rose-500/40 text-rose-400 cursor-not-allowed opacity-75 shadow-none"
                      : isSelected
                      ? "bg-amber-600 text-white border-amber-500 font-bold shadow-md shadow-amber-600/30 cursor-pointer"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white cursor-pointer"
                  }`}
                  title={
                    isBlocked
                      ? `${item.dateStr}: Already on approved leave (Blocked)`
                      : `${item.dateStr}: Click to select this date`
                  }
                >
                  <span className={`block text-[10px] font-bold leading-tight ${isBlocked ? "line-through opacity-80" : ""}`}>
                    {item.weekday}
                  </span>
                  <span className="block text-[9px] font-mono opacity-80">{item.dayNum}</span>
                  {isBlocked ? (
                    <span className="mt-0.5 block text-[8px] font-mono font-bold text-rose-400 uppercase tracking-tight">
                      On Leave
                    </span>
                  ) : isSelected ? (
                    <span className="mt-0.5 block text-[8px] font-mono font-bold text-amber-200 uppercase tracking-tight">
                      Selected
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-[8px] font-mono opacity-50">
                      Open
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Leave Application Form */}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs bg-slate-950/70 p-3.5 sm:p-4 rounded-2xl border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-white font-bold pb-1 border-b border-slate-800">
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Schedule New Leave</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Start Date */}
            <div>
              <label className="text-slate-400 block mb-1 font-semibold flex items-center justify-between">
                <span>Start Date *</span>
                {approvedLeaveDateSet.has(startDate) && (
                  <span className="text-[10px] text-rose-400 font-bold font-mono">Blocked (On Leave)</span>
                )}
              </label>
              <input
                type="date"
                min={getTomorrowStr()}
                value={startDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (approvedLeaveDateSet.has(val)) {
                    showToast(`⚠️ Note: You already have an approved leave on ${val}!`);
                  }
                  setStartDate(val);
                  if (endDate < val) setEndDate(val);
                }}
                className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-white font-mono focus:outline-none [color-scheme:dark] ${
                  approvedLeaveDateSet.has(startDate)
                    ? "border-rose-500 bg-rose-950/20 text-rose-300"
                    : "border-slate-800 focus:border-amber-500"
                }`}
                required
              />
            </div>

            {/* End Date */}
            <div>
              <label className="text-slate-400 block mb-1 font-semibold flex items-center justify-between">
                <span>End Date (Inclusive) *</span>
                {approvedLeaveDateSet.has(endDate) && (
                  <span className="text-[10px] text-rose-400 font-bold font-mono">Blocked (On Leave)</span>
                )}
              </label>
              <input
                type="date"
                min={startDate || getTomorrowStr()}
                value={endDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (approvedLeaveDateSet.has(val)) {
                    showToast(`⚠️ Note: You already have an approved leave on ${val}!`);
                  }
                  setEndDate(val);
                }}
                className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-white font-mono focus:outline-none [color-scheme:dark] ${
                  approvedLeaveDateSet.has(endDate)
                    ? "border-rose-500 bg-rose-950/20 text-rose-300"
                    : "border-slate-800 focus:border-amber-500"
                }`}
                required
              />
            </div>
          </div>

          {/* Leave Conflict Warning Banner */}
          {rangeConflicts.length > 0 && (
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5 animate-pulse">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white font-bold text-xs">
                  Leave Conflict Detected!
                </strong>
                <p className="text-[11px] text-rose-200/90 mt-0.5">
                  You already have an approved leave on <strong>{rangeConflicts.join(", ")}</strong>. These dates are blocked out and cannot be re-applied. Please select open dates from the calendar above.
                </p>
              </div>
            </div>
          )}

          {/* Leave Type */}
          <div>
            <label className="text-slate-400 block mb-1 font-semibold">Leave Category *</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500"
            >
              <option value="Casual Leave">Casual Leave</option>
              <option value="Sick / Medical Leave">Sick / Medical Leave</option>
              <option value="Emergency Leave">Emergency Leave</option>
              <option value="Annual / Vacation Leave">Annual / Vacation Leave</option>
              <option value="Medical Conference / Training">Medical Conference / Training</option>
              <option value="Other / Personal">Other / Personal</option>
            </select>
          </div>

          {/* Reason / Clinical Handover Notes */}
          <div>
            <label className="text-slate-400 block mb-1 font-semibold">
              Reason / Handover Notes (Optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Attending Cardiology Summit, Urgent Family Event"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || rangeConflicts.length > 0 || !startDate}
            className={`w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
              rangeConflicts.length > 0
                ? "bg-rose-800/60 border border-rose-700/50 text-rose-200 cursor-not-allowed"
                : "bg-amber-600 hover:bg-amber-500 shadow-amber-600/20 cursor-pointer disabled:opacity-50"
            }`}
          >
            {rangeConflicts.length > 0 ? (
              <>
                <Ban className="w-4 h-4 text-rose-300" />
                <span>Blocked: Resolve Conflicting Date(s) Above</span>
              </>
            ) : isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Blocking Calendar Dates in Database...</span>
              </>
            ) : (
              <>
                <CalendarOff className="w-4 h-4" />
                <span>Confirm Leave & Block Calendar</span>
              </>
            )}
          </button>
        </form>

        {/* Existing Leaves List */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Your Scheduled Leaves ({doctorLeaves.length})</span>
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">Database Synced</span>
          </div>

          {isLoadingLeaves ? (
            <div className="p-4 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span>Loading leave records...</span>
            </div>
          ) : doctorLeaves.length === 0 ? (
            <div className="p-4 text-center bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-500 text-xs">
              No upcoming leaves scheduled. Your calendar is open for appointments.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
              {doctorLeaves.map((lv) => (
                <div
                  key={lv.id}
                  className="bg-slate-950 p-3 rounded-2xl border border-slate-800/90 flex items-center justify-between gap-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-white text-xs">{lv.date}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
                        {lv.leaveType}
                      </span>
                      <span className="text-[9px] font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 font-bold">
                        BLOCKED
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {lv.reason || "Full Day Leave"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCancelLeave(lv.id, lv.date)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800/50 transition-colors shrink-0 cursor-pointer"
                    title="Cancel this leave and reopen calendar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
