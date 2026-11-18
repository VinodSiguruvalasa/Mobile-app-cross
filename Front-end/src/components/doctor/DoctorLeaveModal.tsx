import React, { useState, useEffect } from "react";
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

  const [startDate, setStartDate] = useState<string>(getTomorrowStr());
  const [endDate, setEndDate] = useState<string>(getTomorrowStr());
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

  // Helper to match doctor name or doctor id
  const isDoctorMatching = (lv: DoctorLeave) => {
    if (lv.doctorId === activeDoctor.id || lv.userId === activeDoctor.id) return true;
    if (lv.doctorName) {
      const cleanTarget = lv.doctorName.toLowerCase();
      const cleanCurrent = activeDoctor.name.toLowerCase().replace(/dr\.|\,md|md/gi, "").trim();
      const parts = cleanCurrent.split(/\s+/).filter((p) => p.length >= 3);
      if (parts.some((p) => cleanTarget.includes(p))) return true;
    }
    return false;
  };

  const loadLeaves = async () => {
    setIsLoadingLeaves(true);
    const res = await doctorService.getDoctorLeaves(activeDoctor.id);
    if (res.success && res.data) {
      // Filter for active doctor
      const myLeaves = res.data.filter(isDoctorMatching);
      setDoctorLeaves(myLeaves.length > 0 ? myLeaves : res.data);
    }
    setIsLoadingLeaves(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadLeaves();
      setStartDate(getTomorrowStr());
      setEndDate(getTomorrowStr());
      setReason("");
    }
  }, [isOpen]);

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
      showToast("Failed to apply leave. Please try again.");
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
            Admin and patients will not be able to book appointments on your blocked dates.
          </p>
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
              <label className="text-slate-400 block mb-1 font-semibold">Start Date *</label>
              <input
                type="date"
                min={getTodayStr()}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500 [color-scheme:dark]"
                required
              />
            </div>

            {/* End Date */}
            <div>
              <label className="text-slate-400 block mb-1 font-semibold">End Date (Inclusive) *</label>
              <input
                type="date"
                min={startDate || getTodayStr()}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500 [color-scheme:dark]"
                required
              />
            </div>
          </div>

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
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
          >
            {isSubmitting ? (
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
