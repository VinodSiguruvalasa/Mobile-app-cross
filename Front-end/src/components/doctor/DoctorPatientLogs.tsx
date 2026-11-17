import React, { useState, useMemo } from "react";
import {
  Users,
  Search,
  User,
  Clock,
  Phone,
  Activity,
  ChevronRight,
  X,
  FileText,
  BedDouble,
  Calendar,
  AlertCircle,
  Pill,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { Patient, Appointment, Admission, Prescription, User as UserType } from "../../types/hms";
import { getPatients } from "../../lib/storage";

interface DoctorPatientLogsProps {
  activeDoctor: UserType;
  appointments: Appointment[];
  admissions: Admission[];
  prescriptions: Prescription[];
  onOpenPrint: () => void;
}

interface DoctorPatientRecord {
  patient: Patient;
  lastVisitDate: string;
  lastComplaint: string;
  totalVisits: number;
  status: "Inpatient" | "Outpatient" | "Discharged";
  appointments: Appointment[];
  prescriptions: Prescription[];
  admissions: Admission[];
}

export const DoctorPatientLogs: React.FC<DoctorPatientLogsProps> = ({
  activeDoctor,
  appointments,
  admissions,
  prescriptions,
  onOpenPrint,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Inpatient" | "Outpatient">("ALL");
  const [selectedRecord, setSelectedRecord] = useState<DoctorPatientRecord | null>(null);

  // Helper: check if a doctor record matches the currently logged-in doctor
  const isDoctorMatching = (docId?: string, docName?: string): boolean => {
    if (!docId && !docName) return false;

    const currentDocName = activeDoctor.name.toLowerCase();
    const currentDocId = activeDoctor.id;

    if (docId && (docId === currentDocId || (currentDocId === "U-101" && (docId === "U-101" || docId === "DOC000001")))) {
      return true;
    }

    if (docName) {
      const target = docName.toLowerCase();
      if (target === currentDocName) return true;

      // Match core name tokens (e.g. "sarah", "vance", "srivani", "gurrala")
      const cleanCurrent = currentDocName.replace(/dr\.|\,md|md/gi, "").trim();
      const parts = cleanCurrent.split(/\s+/).filter((p) => p.length >= 3);
      if (parts.some((p) => target.includes(p))) {
        return true;
      }
    }

    return false;
  };

  // Compile unique patients who visited or are assigned to this specific doctor
  const doctorPatientRecords: DoctorPatientRecord[] = useMemo(() => {
    const allPatients = getPatients();
    const recordsMap = new Map<string, DoctorPatientRecord>();

    // 1. Process matching appointments
    appointments.forEach((apt) => {
      if (isDoctorMatching(apt.doctorId, apt.doctorName)) {
        const patId = apt.patientId || `PAT-${apt.patientName.replace(/\s+/g, "").toLowerCase()}`;
        if (!recordsMap.has(patId)) {
          const matchedPat = allPatients.find(
            (p) => p.id === apt.patientId || p.name.toLowerCase() === apt.patientName.toLowerCase()
          ) || {
            id: patId,
            uhid: `HMS-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            name: apt.patientName,
            age: 38,
            gender: "Male" as const,
            bloodGroup: "O+",
            phone: apt.patientPhone || "+91 98765 43210",
            email: "patient@hms.org",
            address: "Main Ward, Sector 3",
            emergencyContact: { name: "Family Contact", relationship: "Spouse", phone: "+91 98765 00000" },
            allergies: [],
            chronicConditions: [],
            registeredDate: apt.date || "2026-01-01",
            status: "Outpatient" as const,
            assignedDoctor: activeDoctor.name,
          };

          recordsMap.set(patId, {
            patient: matchedPat,
            lastVisitDate: apt.date || "Recent",
            lastComplaint: apt.chiefComplaint || apt.type || "General Consultation",
            totalVisits: 1,
            status: (matchedPat.status as any) || "Outpatient",
            appointments: [apt],
            prescriptions: [],
            admissions: [],
          });
        } else {
          const existing = recordsMap.get(patId)!;
          existing.totalVisits += 1;
          existing.appointments.push(apt);
          if (apt.date && (!existing.lastVisitDate || apt.date > existing.lastVisitDate)) {
            existing.lastVisitDate = apt.date;
            if (apt.chiefComplaint) existing.lastComplaint = apt.chiefComplaint;
          }
        }
      }
    });

    // 2. Process matching admissions
    admissions.forEach((adm) => {
      if (isDoctorMatching(adm.doctorId, adm.admittingDoctor)) {
        const patId = adm.patientId;
        if (!recordsMap.has(patId)) {
          const matchedPat = allPatients.find(
            (p) => p.id === adm.patientId || p.name.toLowerCase() === adm.patientName.toLowerCase()
          ) || {
            id: patId,
            uhid: `HMS-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            name: adm.patientName,
            age: 45,
            gender: "Male" as const,
            bloodGroup: "B+",
            phone: "+91 98765 11111",
            email: "admitted@hms.org",
            address: "Inpatient Ward",
            emergencyContact: { name: "Next of Kin", relationship: "Family", phone: "+91 98765 22222" },
            allergies: [],
            chronicConditions: [],
            registeredDate: adm.admitDate || "2026-01-01",
            status: "Inpatient" as const,
            assignedDoctor: activeDoctor.name,
            assignedRoom: adm.roomNumber,
            assignedBed: adm.bedNumber,
          };

          recordsMap.set(patId, {
            patient: matchedPat,
            lastVisitDate: adm.admitDate || "Current Admission",
            lastComplaint: adm.diagnosis || "Inpatient Care",
            totalVisits: 1,
            status: "Inpatient",
            appointments: [],
            prescriptions: [],
            admissions: [adm],
          });
        } else {
          const existing = recordsMap.get(patId)!;
          existing.status = "Inpatient";
          existing.admissions.push(adm);
          if (adm.diagnosis) existing.lastComplaint = adm.diagnosis;
          if (adm.admitDate && (!existing.lastVisitDate || adm.admitDate > existing.lastVisitDate)) {
            existing.lastVisitDate = adm.admitDate;
          }
        }
      }
    });

    // 3. Process matching prescriptions
    prescriptions.forEach((rx) => {
      if (isDoctorMatching(rx.doctorId, rx.doctorName)) {
        const patId = rx.patientId;
        if (recordsMap.has(patId)) {
          const existing = recordsMap.get(patId)!;
          existing.prescriptions.push(rx);
          if (rx.date && (!existing.lastVisitDate || rx.date > existing.lastVisitDate)) {
            existing.lastVisitDate = rx.date;
          }
        }
      }
    });

    // 4. Process patients explicitly assigned to this doctor in storage
    allPatients.forEach((p) => {
      if (p.assignedDoctor && isDoctorMatching(undefined, p.assignedDoctor)) {
        if (!recordsMap.has(p.id)) {
          recordsMap.set(p.id, {
            patient: p,
            lastVisitDate: p.registeredDate || "2026-08-10",
            lastComplaint: p.chronicConditions?.[0] || "Routine Doctor Consultation",
            totalVisits: 1,
            status: p.status || "Outpatient",
            appointments: [],
            prescriptions: [],
            admissions: [],
          });
        }
      }
    });

    return Array.from(recordsMap.values());
  }, [activeDoctor, appointments, admissions, prescriptions]);

  // Filtered by search and status
  const filteredRecords = useMemo(() => {
    return doctorPatientRecords.filter((rec) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        rec.patient.name.toLowerCase().includes(q) ||
        rec.patient.uhid.toLowerCase().includes(q) ||
        rec.patient.id.toLowerCase().includes(q) ||
        rec.patient.phone.toLowerCase().includes(q) ||
        rec.lastComplaint.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "ALL" || rec.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [doctorPatientRecords, searchQuery, statusFilter]);

  const inpatientCount = doctorPatientRecords.filter((r) => r.status === "Inpatient").length;
  const outpatientCount = doctorPatientRecords.filter((r) => r.status === "Outpatient").length;

  return (
    <div className="space-y-4 w-full">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                Doctor Patient Logs & Consultations
              </h3>
              <p className="text-[11px] text-slate-400">
                Patient directory and medical visit history
              </p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-xl bg-blue-500/20 text-blue-300 font-mono text-xs font-bold border border-blue-500/30 uppercase tracking-wider shrink-0">
            {doctorPatientRecords.length} Patients
          </span>
        </div>

        {/* 3 Metric Summary Cards in 3 Columns / Mobile 2-row */}
        <div className="grid grid-cols-3 gap-2 text-xs pt-0.5">
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-center">
            <span className="text-[10px] text-slate-400 block font-semibold">Total Visited</span>
            <strong className="text-base sm:text-lg font-black text-white font-mono mt-0.5 block">
              {doctorPatientRecords.length}
            </strong>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-center">
            <span className="text-[10px] text-purple-400 block font-semibold">Inpatients</span>
            <strong className="text-base sm:text-lg font-black text-purple-300 font-mono mt-0.5 block">
              {inpatientCount}
            </strong>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-center">
            <span className="text-[10px] text-emerald-400 block font-semibold">Outpatients</span>
            <strong className="text-base sm:text-lg font-black text-emerald-300 font-mono mt-0.5 block">
              {outpatientCount}
            </strong>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient name, UHID, phone, or clinical complaint..."
            className="w-full h-9 bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 scrollbar-none">
          {[
            { id: "ALL", label: `All Patients (${doctorPatientRecords.length})` },
            { id: "Inpatient", label: `Inpatients (${inpatientCount})` },
            { id: "Outpatient", label: `Outpatients (${outpatientCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Patient Logs List */}
      <div className="space-y-3 w-full">
        {filteredRecords.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <User className="w-10 h-10 mx-auto text-slate-600" />
            <p className="font-bold text-slate-300 text-sm">No patient records found</p>
            <p className="text-xs text-slate-500">
              {searchQuery
                ? `No patients matching "${searchQuery}" visited ${activeDoctor.name}.`
                : `No patients have consulted with ${activeDoctor.name} yet.`}
            </p>
          </div>
        ) : (
          filteredRecords.map((rec) => (
            <div
              key={rec.patient.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 sm:p-4 text-xs transition-all flex flex-col space-y-3 shadow-md w-full"
            >
              {/* Row 1: Patient Header with Avatar, Name, UHID, and Status Badge */}
              <div className="flex items-start justify-between gap-2.5 w-full">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-300 font-bold flex items-center justify-center text-sm border border-blue-500/30 shrink-0">
                    {rec.patient.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-extrabold text-white text-sm sm:text-base truncate">
                      {rec.patient.name}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="font-mono text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-semibold">
                        {rec.patient.uhid}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        ID: {rec.patient.id}
                      </span>
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 ${
                    rec.status === "Inpatient"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {rec.status}
                </span>
              </div>

              {/* Row 2: Demographics Box (Age, Gender, Blood Group, Phone) */}
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/70 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                <div className="truncate">
                  <span className="text-slate-500 text-[10px] block">Age / Gender</span>
                  <span className="font-medium text-white">
                    {rec.patient.age} Y • {rec.patient.gender}
                  </span>
                </div>
                <div className="truncate">
                  <span className="text-slate-500 text-[10px] block">Blood Group</span>
                  <strong className="font-extrabold text-red-400">{rec.patient.bloodGroup}</strong>
                </div>
                <div className="col-span-2 truncate pt-1 border-t border-slate-800/50 flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                  <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>{rec.patient.phone}</span>
                </div>
              </div>

              {/* Row 3: Clinical Visit Summary (Last Visit, Diagnosis / Complaint, Total Visits) */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5 flex-wrap gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">
                    Last Visit: <strong className="text-slate-200">{rec.lastVisitDate}</strong>
                  </span>
                </div>
                <span className="font-mono text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg shrink-0">
                  {rec.totalVisits} {rec.totalVisits === 1 ? "Visit" : "Visits"}
                </span>
              </div>

              {/* Row 4: Medical Reason / Diagnosis Tag */}
              {rec.lastComplaint && (
                <div className="text-[11px] bg-slate-950/50 px-2.5 py-1.5 rounded-xl border border-slate-800/50 flex items-start gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300 break-words">
                    <strong className="text-purple-300">Reason / Diagnosis:</strong>{" "}
                    {rec.lastComplaint}
                  </span>
                </div>
              )}

              {/* Row 5: Action Button to View Details */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(rec)}
                  className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Patient Clinical Record</span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Patient Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3.5 sm:p-5 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-4 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    {selectedRecord.patient.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    UHID: {selectedRecord.patient.uhid} • ID: {selectedRecord.patient.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Demographics Summary */}
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block">Age & Gender</span>
                <span className="font-bold text-white">
                  {selectedRecord.patient.age} Y • {selectedRecord.patient.gender}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Blood Group</span>
                <span className="font-bold text-red-400">
                  {selectedRecord.patient.bloodGroup}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Phone</span>
                <span className="font-mono text-slate-300">{selectedRecord.patient.phone}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Emergency Contact</span>
                <span className="text-slate-300">
                  {selectedRecord.patient.emergencyContact?.name} ({selectedRecord.patient.emergencyContact?.relationship})
                </span>
              </div>
            </div>

            {/* Known Allergies & Chronic Conditions */}
            {((selectedRecord.patient.allergies && selectedRecord.patient.allergies.length > 0) ||
              (selectedRecord.patient.chronicConditions && selectedRecord.patient.chronicConditions.length > 0)) && (
              <div className="space-y-1.5 text-xs bg-slate-950/70 p-3 rounded-2xl border border-slate-800/70">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Medical Alerts & Chronic History</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedRecord.patient.allergies?.map((alg, i) => (
                    <span
                      key={`alg-${i}`}
                      className="px-2 py-0.5 rounded-lg bg-red-500/10 text-red-300 border border-red-500/20 text-[10px] font-bold"
                    >
                      Allergy: {alg}
                    </span>
                  ))}
                  {selectedRecord.patient.chronicConditions?.map((cond, i) => (
                    <span
                      key={`c-${i}`}
                      className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-bold"
                    >
                      {cond}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Doctor Visit & Consultation Log */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>Consultation Visits with {activeDoctor.name}</span>
              </h4>

              {selectedRecord.appointments.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  Assigned patient via clinical admission / consultation history.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {selectedRecord.appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-white block">
                          {apt.date} • {apt.timeSlot || "Consultation"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {apt.chiefComplaint || apt.type}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                        {apt.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prescriptions by this Doctor */}
            {selectedRecord.prescriptions.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Prescriptions Issued</span>
                </h4>
                <div className="space-y-1.5">
                  {selectedRecord.prescriptions.map((rx) => (
                    <div
                      key={rx.id}
                      className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white font-mono text-[11px]">{rx.id}</span>
                        <span className="text-slate-400 text-[10px]">{rx.date}</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        {rx.items.map((it) => `${it.drugName} (${it.dosage})`).join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onOpenPrint}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span>Print Record</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

