// Big hospitals run many OPDs — each doctor holds an OPD room. Reception assigns a
// patient to a specific doctor; the display board groups rooms under departments.

export type OpdRoom = { doctor: string; department: string; room: string }

export const OPD_ROOMS: OpdRoom[] = [
  { doctor: "Dr. Priya Nair", department: "General Medicine", room: "Room 1" },
  { doctor: "Dr. Arjun Kuldeep", department: "General Medicine", room: "Room 2" },
  { doctor: "Dr. Rohan Mehta", department: "Cardiology", room: "Room 5" },
  { doctor: "Dr. Ananya Iyer", department: "Dermatology", room: "Room 8" },
  { doctor: "Dr. Vikram Rao", department: "Orthopaedics", room: "Room 6" },
]

export const OPD_DEPARTMENTS = Array.from(new Set(OPD_ROOMS.map(r => r.department)))
export const doctorsForDept = (dept: string) => OPD_ROOMS.filter(r => r.department === dept)
export const roomFor = (doctor: string) => OPD_ROOMS.find(r => r.doctor === doctor)
