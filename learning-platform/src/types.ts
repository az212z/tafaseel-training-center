export type Role = "admin" | "instructor" | "student" | "guardian";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: number;
  created_at: string;
}
export interface Student extends User {
  birth_date?: string;
  city?: string;
}
export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  status: string;
  instructor_id: string | null;
  instructor_name: string | null;
  duration: number;
  capacity: number;
  students_count: number;
  lessons_count: number;
  created_at: string;
}
export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  kind: "text" | "video" | "file";
  body: string;
  video_url: string;
  file_id: string | null;
  duration: number;
  sort_order: number;
}
export interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description: string;
  due_at: string;
  points: number;
}
export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  body: string;
  file_id: string | null;
  score: number | null;
  feedback: string;
  submitted_at: string;
}
export interface Quiz {
  id: string;
  course_id: string;
  title: string;
  minutes: number;
  passing: number;
  max_attempts: number;
}
export interface Question {
  text: string;
  options: string[];
  correct?: number;
}
export interface Attempt {
  id: string;
  quiz_id: string;
  student_id: string;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  score: number | null;
  total: number;
  questions?: Question[];
}
export interface ClassSession {
  id: string;
  course_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string;
  join_url: string | null;
}
export interface Attendance {
  id: string;
  class_id: string;
  student_id: string;
  status: string;
  note: string;
  updated_at: string;
}
export interface FileRecord {
  id: string;
  owner_id: string;
  course_id: string | null;
  student_id: string | null;
  purpose: string;
  name: string;
  mime: string;
  bytes: number;
  created_at: string;
}
export interface Certificate {
  id: string;
  course_id: string;
  student_id: string;
  student_name: string;
  course_title: string;
  serial: string;
  duration: number;
  issued_at: string;
}
export interface Announcement {
  id: string;
  course_id: string | null;
  title: string;
  body: string;
  author_name: string;
  created_at: string;
}
export interface Support {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body: string;
  reply: string | null;
  status: string;
  created_at: string;
}
export interface Audit {
  id: string;
  actor_name: string | null;
  action: string;
  entity_id: string | null;
  created_at: string;
}
export interface Profile {
  legacy_contact?: string;
  phone?: string;
  birth_date?: string;
  city?: string;
  identity_number?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_id?: string | null;
}
export interface Data {
  user: User;
  demo: boolean;
  courses: Course[];
  students: Student[];
  instructors: { id: string; name: string }[];
  enrollments: { id: string; course_id: string; student_id: string }[];
  lessons: Lesson[];
  assignments: Assignment[];
  submissions: Submission[];
  quizzes: Quiz[];
  attempts: Attempt[];
  classes: ClassSession[];
  attendance: Attendance[];
  progress: { id: string; lesson_id: string; student_id: string }[];
  files: FileRecord[];
  announcements: Announcement[];
  certificates: Certificate[];
  users?: User[];
  audit?: Audit[];
  support: Support[];
  mfa: boolean;
  settings: {
    name: string;
    email: string;
    phone: string;
    certificate_attendance: number;
  };
}
