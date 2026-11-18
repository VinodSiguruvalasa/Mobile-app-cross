import { apiRequest } from "../lib/apiClient";
import { DoctorLeave } from "../types/hms";
import {
  getStoredDoctorLeaves,
  saveStoredDoctorLeaves,
  addStoredDoctorLeave,
  removeStoredDoctorLeave,
} from "../lib/storage";

export const doctorService = {
  // Fetch all doctor leaves (from PostgreSQL backend or local storage fallback)
  async getDoctorLeaves(
    doctorId?: string
  ): Promise<{ success: boolean; data: DoctorLeave[]; isLiveBackend: boolean }> {
    try {
      const endpoint = doctorId
        ? `/common/getDoctorLeaves?doctorId=${encodeURIComponent(doctorId)}`
        : "/common/getDoctorLeaves";
      const res = await apiRequest(endpoint);

      if (res.success && Array.isArray(res.data)) {
        saveStoredDoctorLeaves(res.data);
        return { success: true, data: res.data, isLiveBackend: true };
      }
    } catch (e) {
      console.warn("Failed to fetch leaves from backend, using local store:", e);
    }

    const localList = getStoredDoctorLeaves();
    return { success: true, data: localList, isLiveBackend: false };
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

      if (res.success && res.data) {
        // Refresh local cache with latest database state
        await this.getDoctorLeaves();
        return {
          success: true,
          data: res.data,
          message: res.message || "Leave applied successfully",
        };
      }
    } catch (e) {
      console.warn("Backend applyLeave failed, saving to local cache:", e);
    }

    // Local fallback: generate dates
    const start = new Date(data.startDate);
    const end = new Date(data.endDate || data.startDate);
    const cur = new Date(start);
    while (cur <= end) {
      const dateStr = cur.toISOString().split("T")[0];
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
      cur.setDate(cur.getDate() + 1);
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
