import { apiRequest } from "../lib/apiClient";
import { DoctorLeave } from "../types/hms";
import {
  getStoredDoctorLeaves,
  saveStoredDoctorLeaves,
  addStoredDoctorLeave,
  removeStoredDoctorLeave,
} from "../lib/storage";

export const doctorService = {
  // Helper to match doctor identity against leave record
  isDoctorMatchingLeave(lv: DoctorLeave, doctorId?: string, doctorName?: string): boolean {
    if (!doctorId && !doctorName) return true;
    if (doctorId && (lv.doctorId === doctorId || lv.userId === doctorId)) return true;
    if (doctorName && lv.doctorName) {
      const cleanTarget = lv.doctorName.toLowerCase();
      const cleanName = doctorName.toLowerCase().replace(/dr\.|\,md|md/gi, "").trim();
      const parts = cleanName.split(/\s+/).filter((p) => p.length >= 3);
      if (parts.some((p) => cleanTarget.includes(p))) return true;
    }
    return false;
  },

  // Fetch all doctor leaves (from PostgreSQL backend or local storage fallback)
  async getDoctorLeaves(
    doctorId?: string,
    doctorName?: string
  ): Promise<{ success: boolean; data: DoctorLeave[]; isLiveBackend: boolean }> {
    let allLeaves: DoctorLeave[] = [];
    let isLiveBackend = false;

    try {
      const res = await apiRequest("/common/getDoctorLeaves");
      if (res.success && Array.isArray(res.data)) {
        allLeaves = res.data;
        saveStoredDoctorLeaves(allLeaves);
        isLiveBackend = true;
      }
    } catch (e) {
      console.warn("Failed to fetch leaves from backend, using local store:", e);
    }

    if (!isLiveBackend || allLeaves.length === 0) {
      allLeaves = getStoredDoctorLeaves();
    }

    const filtered =
      doctorId || doctorName
        ? allLeaves.filter((lv) => this.isDoctorMatchingLeave(lv, doctorId, doctorName))
        : allLeaves;

    return { success: true, data: filtered, isLiveBackend };
  },

  // Apply for doctor leave
  async applyLeave(data: {
    doctorId: string;
    doctorName: string;
    startDate: string;
    endDate?: string;
    leaveType?: string;
    reason?: string;
  }): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await apiRequest("/common/applyDoctorLeave", {
        method: "POST",
        body: JSON.stringify(data),
      });

      if (res && res.success && res.data) {
        // Refresh local cache with latest database state
        await this.getDoctorLeaves();
        return {
          success: true,
          data: res.data,
          message: res.message || "Leave applied successfully",
        };
      }

      if (res && !res.success) {
        return {
          success: false,
          message:
            res.message ||
            "Doctor already has approved leave on these dates or request could not be processed.",
        };
      }
    } catch (e: any) {
      console.warn("Backend applyLeave failed or threw error:", e);
      if (e?.message && e.message.includes("already has approved leave")) {
        return { success: false, message: e.message };
      }
    }

    // Local fallback check
    const localLeaves = getStoredDoctorLeaves();
    const cleanName = data.doctorName.toLowerCase().replace(/dr\.|\,md|md/gi, "").trim();
    const parts = cleanName.split(/\s+/).filter((p) => p.length >= 3);
    const isDoc = (lv: DoctorLeave) =>
      lv.doctorId === data.doctorId ||
      lv.userId === data.doctorId ||
      (lv.doctorName && parts.some((p) => lv.doctorName.toLowerCase().includes(p)));

    const docLeaves = localLeaves.filter(isDoc);
    const existingDates = new Set(docLeaves.map((l) => l.date));

    const start = new Date(data.startDate);
    const end = new Date(data.endDate || data.startDate);
    const cur = new Date(start);
    const conflicts: string[] = [];
    while (cur <= end) {
      const dStr = cur.toISOString().split("T")[0];
      if (existingDates.has(dStr)) conflicts.push(dStr);
      cur.setDate(cur.getDate() + 1);
    }

    if (conflicts.length > 0) {
      return {
        success: false,
        message: `Doctor already has an approved leave on ${conflicts.join(", ")}. Cannot re-apply for already booked dates.`,
      };
    }

    // Local fallback: generate dates
    const curAdd = new Date(start);
    while (curAdd <= end) {
      const dateStr = curAdd.toISOString().split("T")[0];
      const newLeave: DoctorLeave = {
        id: `LEAVE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        doctorId: data.doctorId,
        doctorName: data.doctorName,
        date: dateStr,
        isAllDay: true,
        reason: data.reason || "Doctor Leave",
        leaveType: data.leaveType || "Casual Leave",
        createdAt: new Date().toISOString(),
      };
      addStoredDoctorLeave(newLeave);
      curAdd.setDate(curAdd.getDate() + 1);
    }

    return { success: true, message: "Doctor leave applied successfully!" };
  },

  // Cancel doctor leave
  async cancelLeave(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await apiRequest(`/common/cancelDoctorLeave/${id}`, {
        method: "DELETE",
      });

      if (res.success) {
        removeStoredDoctorLeave(id);
        return { success: true, message: res.message || "Doctor leave cancelled" };
      }
    } catch (e) {
      console.warn("Backend cancelLeave failed, updating local cache:", e);
    }

    removeStoredDoctorLeave(id);
    return { success: true, message: "Leave cancelled successfully" };
  },
};
