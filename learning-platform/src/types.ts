export type Role = "admin" | "instructor" | "student" | "guardian";
export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  is_supervisor?: boolean | number;
  invitation_status?: "pending" | "expired" | "revoked";
  role: Role;
  active: number;
  created_at: string;
}
export interface Student extends User {
  birth_date?: string;
  city?: string;
}
export interface Course {
  progress_percent?: number;
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
  video_asset_id?: string;
  video_status?: string;
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
export interface QuizDraft {
  answers: (number | null)[];
  revision: number;
  saved_at: string | null;
}
export interface ClassSession {
  attendance_automation?: {
    enabled: boolean;
    mode: "manual" | "zoom";
    started_at: string | null;
    deadline: string | null;
    grace_minutes: number;
    needs_review?: boolean;
  } | null;
  zoom_status?: string | null;
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
  file_limits?: { regular: number; lesson_video: number };
  statistics?: {
    students: number;
    enrollments: number;
    progress: number;
    certificates: number;
    graded: number;
    pending: number;
    attendance_percent: number;
    classes_today: number;
  };
  dataset?: {
    scoped: boolean;
    overview: boolean;
    course_id: string;
    student_id: string;
  };
  commerce?: {
    course_id: string;
    price_minor: number;
    enrollment_open: number;
  }[];
  capabilities?: {
    video: boolean;
    zoom: boolean;
    zoom_embed?: boolean;
    payments: boolean;
  };
  mfa_setup_required?: boolean;
  mfa_available?: boolean;
  user: User;
  demo: boolean;
  courses: Course[];
  students: Student[];
  instructors: { id: string; name: string }[];
  enrollments: {
    id: string;
    course_id: string;
    student_id: string;
    created_at?: string;
  }[];
  lessons: Lesson[];
  assignments: Assignment[];
  submissions: Submission[];
  quizzes: Quiz[];
  attempts: Attempt[];
  classes: ClassSession[];
  attendance: Attendance[];
  progress: {
    id: string;
    lesson_id: string;
    student_id: string;
    completed_at?: string;
  }[];
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
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
export interface OrderLedger extends PageResult<Order> {
  summary: { paid: number; pending: number; refunded: number; review: number };
}
export interface CatalogCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  duration: number;
  capacity: number;
  instructor_name: string | null;
  price_minor: number;
  currency: string;
  students_count: number;
}
export interface Order {
  updated_at?: string;
  id: string;
  student_id: string;
  course_id: string;
  amount: number;
  currency: string;
  status: string;
  checkout_url: string | null;
  expires_at: string;
  created_at: string;
  paid_at: string | null;
  failure_code: string | null;
  student_name?: string;
  course_title?: string;
}
export interface BagItem {
  id: string;
  bag_id: string;
  file_id: string;
  label: string;
  sort_order: number;
  name: string;
  mime: string;
  bytes: number;
}
export interface LearningBag {
  id: string;
  course_id: string;
  title: string;
  description: string;
  version: string;
  updated_at: string;
  items: BagItem[];
}
export interface VideoAsset {
  id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  status: string;
  bytes: number;
  created_at: string;
  updated_at: string;
}
export interface NotificationRecord {
  id: string;
  student_id: string;
  class_id: string;
  status: string;
  attempts?: number;
  provider_id?: string | null;
  error_code?: string | null;
  created_at: string;
  updated_at: string;
  recipient: string;
  student_name: string;
  class_title: string;
}
