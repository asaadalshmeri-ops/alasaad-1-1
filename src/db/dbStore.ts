import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import {
  User,
  Student,
  Department,
  Lecture,
  Assignment,
  Exam,
  Fee,
  Notification,
  Complaint
} from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE_PATH = path.join(process.cwd(), 'db.json');

// Lazy initialization of Supabase client to prevent boot errors if credentials are not yet set
let supabaseInstance: any = null;
let isSupabaseChecked = false;

export function getSupabase() {
  if (isSupabaseChecked) return supabaseInstance;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (supabaseUrl && supabaseKey && supabaseUrl !== 'MY_SUPABASE_URL' && supabaseKey !== 'MY_SUPABASE_KEY') {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false
        }
      });
      console.log('[SUPABASE] Supabase client successfully initialized with URL:', supabaseUrl);
    } catch (error) {
      console.error('[SUPABASE] Failed to initialize Supabase client:', error);
    }
  } else {
    console.log('[SUPABASE] Supabase credentials not found or placeholder used. Falling back to local storage.');
  }

  isSupabaseChecked = true;
  return supabaseInstance;
}

export interface DatabaseSchema {
  users: User[];
  students: Student[];
  departments: Department[];
  lectures: Lecture[];
  assignments: Assignment[];
  exams: Exam[];
  fees: Fee[];
  notifications: Notification[];
  complaints: Complaint[];
}

const DEFAULT_DEPARTMENTS: Department[] = [
  {
    _id: 'dept_cs',
    name: 'Computer Science',
    description: 'Study of computation, information, and automation, covering AI, systems, and algorithms.',
    headOfDepartment: 'Dr. Alan Turing'
  },
  {
    _id: 'dept_ee',
    name: 'Electrical Engineering',
    description: 'Focuses on electricity, electronics, and electromagnetism, including power systems and digital logic.',
    headOfDepartment: 'Dr. Nikola Tesla'
  },
  {
    _id: 'dept_me',
    name: 'Mechanical Engineering',
    description: 'Deals with the design, analysis, manufacturing, and maintenance of mechanical systems.',
    headOfDepartment: 'Dr. James Watt'
  }
];

function getInitialData(): DatabaseSchema {
  // Generate bcrypt hashes for seed users
  const salt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync('admin123', salt);
  // Default student: first login sets password, so we hash empty initially or set a flag.
  // We'll set a hashed password for seed student so they can also login or start first time.
  const studentPasswordHash = bcrypt.hashSync('student123', salt);

  const adminUser: User = {
    _id: 'user_admin_1',
    name: 'Admin Director',
    email: 'admin@lms.edu',
    role: 'admin',
    passwordHash: adminPasswordHash
  };

  const studentUser: User = {
    _id: 'user_student_1',
    name: 'Alice Johnson',
    email: 'alice.j@lms.edu',
    role: 'student',
    passwordHash: '' // Empty means first login sets password, enabling first-time setup!
  };

  const seedStudent: Student = {
    _id: 'student_1',
    userId: 'user_student_1',
    fullName: {
      firstName: 'Alice',
      middleName: 'Marie',
      lastName: 'Johnson',
      familyName: 'Smith'
    },
    academicId: '202600001',
    photo: '', // will be set or default placeholder
    documents: [],
    departmentId: 'dept_cs',
    status: 'Active',
    createdAt: new Date().toISOString()
  };

  const seedLecture: Lecture = {
    _id: 'lec_1',
    departmentId: 'dept_cs',
    courseName: 'مقدمة في علم خوارزميات الحاسوب',
    lectureNumber: 1,
    instructor: 'د. آلان تورينج (Dr. Alan Turing)',
    youtubeLink: 'https://www.youtube.com/embed/0IAPZzGSbME',
    pdfContent: 'مرحباً بكم في المحاضرة الأولى من مساق تحليل وتصميم الخوارزميات (Algorithms).\n\nالخوارزمية هي مجموعة من الخطوات الرياضية والمنطقية المتسلسلة المحددة لحل مشكلة ما.\n\nمحاور المحاضرة الأولى:\n1. مفهوم الخوارزميات وأهميتها في البرمجة وهندسة البرمجيات.\n2. قياس الأداء وتحليل الكفاءة الزمنية والمساحية (Time & Space Complexity).\n3. تدوين الرمز الرياضي Big O Notation لتحديد الحدود العليا لزمن التنفيذ.\n4. مقارنة سريعة بين خوارزميات الترتيب البسيطة (Bubble Sort, Selection Sort).\n\nيرجى مراجعة محتوى المحاضرة جيداً وحل الواجب التجريبي المرفق في نهاية الصفحة لتقييم استيعابك للمفاهيم ومتابعة تقدمك الأكاديمي.',
    diagrams: [],
    assignmentId: 'assign_1',
    attendance: []
  };

  const seedAssignment: Assignment = {
    _id: 'assign_1',
    lectureId: 'lec_1',
    title: 'تحليل الكفاءة الزمنية وتعقيد الخوارزميات',
    description: 'قم بتحليل التعقيد الزمني (Time Complexity) للأكواد البرمجية التالية المذكورة في المحاضرة الأولى، واثبت رياضياً حدود الـ Big O الخاصة بكل منها. الرجاء كتابة الحل بوضوح في حقل الإجابة أو رفع الحل في ملف PDF واضح منسق لتصحيحه من قبل دكتور المساق.',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    submissions: []
  };

  const seedExam: Exam = {
    _id: 'exam_1',
    departmentId: 'dept_cs',
    courseName: 'مقدمة في علم خوارزميات الحاسوب',
    title: 'الاختبار التجريبي القصير الأول (Quiz 1)',
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days from now
    time: '10:00',
    duration: 30,
    questions: [
      {
        id: 'q1',
        type: 'mcq',
        questionText: 'ما هو أسوأ تعقيد زمني (Worst-case Time Complexity) لخوارزمية الترتيب السريع Quick Sort؟',
        options: ['O(N log N)', 'O(N^2)', 'O(N)', 'O(1)'],
        correctAnswer: 'O(N^2)'
      },
      {
        id: 'q2',
        type: 'mcq',
        questionText: 'أي من بنيات البيانات التالية يعتمد على مبدأ LIFO (ما يدخل آخراً يخرج أولاً)؟',
        options: ['الطابور (Queue)', 'المكدس (Stack)', 'القائمة المتصلة (Linked List)', 'شجرة البحث الثنائية'],
        correctAnswer: 'المكدس (Stack)'
      },
      {
        id: 'q3',
        type: 'essay',
        questionText: 'اشرح بأسلوبك الخاص الفرق الجوهري بين البرمجة الديناميكية (Dynamic Programming) والخوارزميات الجشعة (Greedy Algorithms) مع ذكر مثال بسيط لكل منهما.'
      }
    ],
    results: []
  };

  const seedFee: Fee = {
    _id: 'fee_1',
    studentId: 'student_1',
    semester: 'Fall 2026',
    totalFees: 5000,
    amountPaid: 3200,
    remaining: 1800,
    receipts: []
  };

  const seedNotification: Notification = {
    _id: 'notif_1',
    departmentId: null, // Global
    title: 'Welcome to the New Academic Semester!',
    message: 'Welcome all students! Please ensure your document uploads are complete in your profile and review the fee schedules for Fall 2026.',
    createdAt: new Date().toISOString(),
    readBy: []
  };

  return {
    users: [adminUser, studentUser],
    students: [seedStudent],
    departments: DEFAULT_DEPARTMENTS,
    lectures: [seedLecture],
    assignments: [seedAssignment],
    exams: [seedExam],
    fees: [seedFee],
    notifications: [seedNotification],
    complaints: []
  };
}

export class DBStore {
  private data: DatabaseSchema;
  private lastSyncTime: string | null = null;
  private lastSyncError: string | null = null;

  constructor() {
    this.data = getInitialData();
    this.load();
  }

  public load(): void {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const fileContent = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(fileContent);
        // Ensure all top level collections exist
        this.data = {
          users: parsed.users || [],
          students: parsed.students || [],
          departments: parsed.departments || DEFAULT_DEPARTMENTS,
          lectures: parsed.lectures || [],
          assignments: parsed.assignments || [],
          exams: parsed.exams || [],
          fees: parsed.fees || [],
          notifications: parsed.notifications || [],
          complaints: parsed.complaints || []
        };
        // Reset password hashes of all students to enable first-time registration from scratch
        let adjusted = false;
        this.data.users = this.data.users.map(u => {
          if (u.role === 'student' && u.passwordHash !== '') {
            adjusted = true;
            return { ...u, passwordHash: '' };
          }
          return u;
        });
        if (adjusted) {
          console.log('[DB] Restored student accounts for first-time setup.');
          this.saveLocallyOnly();
        }
      } else {
        this.saveLocallyOnly();
      }
    } catch (e) {
      console.error('Error loading database file, using in-memory default:', e);
    }
  }

  public saveLocallyOnly(): void {
    try {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving database file locally:', e);
    }
  }

  public async saveToSupabaseAsync(): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('lms_data')
        .upsert({ id: 'main_database', data: this.data, updated_at: new Date().toISOString() });

      if (error) {
        const isMissingTable = 
          error.code === '42P01' || 
          error.code === 'PGRST116' ||
          (error.message && (
            (error.message.includes('relation') && error.message.includes('does not exist')) ||
            error.message.includes('schema cache') ||
            error.message.includes('Could not find the table')
          ));
        if (isMissingTable) {
          console.warn('[SUPABASE] Background save skipped: Table lms_data does not exist yet.');
        } else {
          console.error('[SUPABASE] Background save failed:', error.message);
        }
        this.lastSyncError = error.message;
      } else {
        console.log('[SUPABASE] Background save to cloud database successful.');
        this.lastSyncTime = new Date().toISOString();
        this.lastSyncError = null;
      }
    } catch (e: any) {
      console.error('[SUPABASE] Unexpected error in async cloud save:', e);
      this.lastSyncError = e.message || String(e);
    }
  }

  public save(): void {
    this.saveLocallyOnly();
    // Fire-and-forget async upload to Supabase to keep API responses instantaneous
    this.saveToSupabaseAsync().catch(err => {
      console.error('[SUPABASE] Failed to upload state:', err);
    });
  }

  // Fetch state from Supabase on startup or manual sync
  public async syncWithSupabase(): Promise<{ success: boolean; message: string; error?: any }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, message: 'سوبابيس غير مهيأ. يرجى تزويد مفاتيح الوصول في لوحة الإعدادات أو Secrets.' };
    }

    try {
      const { data, error } = await supabase
        .from('lms_data')
        .select('data, updated_at')
        .eq('id', 'main_database')
        .maybeSingle();

      if (error) {
        const isMissingTable = 
          error.code === '42P01' || 
          error.code === 'PGRST116' ||
          (error.message && (
            (error.message.includes('relation') && error.message.includes('does not exist')) ||
            error.message.includes('schema cache') ||
            error.message.includes('Could not find the table')
          ));
        if (isMissingTable) {
          console.warn('[SUPABASE] Table lms_data does not exist yet. Please create it using the SQL script on the Admin > Supabase dashboard tab.');
        } else {
          console.error('[SUPABASE] Fetch failed:', error.message || error);
        }
        this.lastSyncError = error.message;
        return {
          success: false,
          message: isMissingTable 
            ? 'جدول lms_data غير موجود في سوبابيس. يُرجى الانتقال إلى تبويب سوبابيس في لوحة الإدارة ونسخ كود SQL لإنشائه في مشروعك.'
            : `خطأ في الاتصال بسوبابيس: ${error.message}. تأكد من صحة الصلاحيات ومفاتيح الربط.`,
          error
        };
      }

      if (!data) {
        // Table exists but row is empty, let's bootstrap it with our local default
        console.log('[SUPABASE] Cloud database is empty. Bootstrapping with local data...');
        const { error: insertError } = await supabase
          .from('lms_data')
          .insert([{ id: 'main_database', data: this.data }]);

        if (insertError) {
          console.error('[SUPABASE] Bootstrapping insert failed:', insertError);
          this.lastSyncError = insertError.message;
          return {
            success: false,
            message: `فشل رفع البيانات الأولية إلى سوبابيس: ${insertError.message}. تأكد من صلاحيات الوصول (RLS) للجدول.`,
            error: insertError
          };
        }

        this.lastSyncTime = new Date().toISOString();
        this.lastSyncError = null;
        console.log('[SUPABASE] Successfully bootstrapped cloud database with local data.');
        return { success: true, message: 'تم ربط سوبابيس لأول مرة بنجاح ورفع البيانات المحلية لتأسيس قاعدة البيانات!' };
      }

      // Sync local database with fetched cloud data
      if (data && data.data) {
        console.log('[SUPABASE] Found main_database row on Supabase. Updating memory and local database file.');
        this.data = {
          users: data.data.users || [],
          students: data.data.students || [],
          departments: data.data.departments || DEFAULT_DEPARTMENTS,
          lectures: data.data.lectures || [],
          assignments: data.data.assignments || [],
          exams: data.data.exams || [],
          fees: data.data.fees || [],
          notifications: data.data.notifications || [],
          complaints: data.data.complaints || []
        };
        this.saveLocallyOnly();
        this.lastSyncTime = data.updated_at || new Date().toISOString();
        this.lastSyncError = null;
        return { success: true, message: 'تمت مزامنة البيانات السحابية من سوبابيس وتحديث التخزين المحلي بنجاح!' };
      }

      return { success: false, message: 'بيانات سوبابيس فارغة أو غير صالحة.' };
    } catch (err: any) {
      console.error('[SUPABASE] Unexpected error in sync:', err);
      this.lastSyncError = err.message || String(err);
      return { success: false, message: `حدث خطأ غير متوقع أثناء الاتصال بسوبابيس: ${err.message || String(err)}`, error: err };
    }
  }

  public getSupabaseSyncStatus() {
    const supabase = getSupabase();
    return {
      connected: !!supabase,
      url: process.env.SUPABASE_URL || null,
      lastSyncTime: this.lastSyncTime,
      lastSyncError: this.lastSyncError
    };
  }

  public getUsers(): User[] { return this.data.users; }
  public getStudents(): Student[] { return this.data.students; }
  public getDepartments(): Department[] { return this.data.departments; }
  public getLectures(): Lecture[] { return this.data.lectures; }
  public getAssignments(): Assignment[] { return this.data.assignments; }
  public getExams(): Exam[] { return this.data.exams; }
  public getFees(): Fee[] { return this.data.fees; }
  public getNotifications(): Notification[] { return this.data.notifications; }
  public getComplaints(): Complaint[] { return this.data.complaints; }

  // Generic write operations that trigger a save
  public saveUsers(users: User[]) { this.data.users = users; this.save(); }
  public saveStudents(students: Student[]) { this.data.students = students; this.save(); }
  public saveDepartments(depts: Department[]) { this.data.departments = depts; this.save(); }
  public saveLectures(lectures: Lecture[]) { this.data.lectures = lectures; this.save(); }
  public saveAssignments(assignments: Assignment[]) { this.data.assignments = assignments; this.save(); }
  public saveExams(exams: Exam[]) { this.data.exams = exams; this.save(); }
  public saveFees(fees: Fee[]) { this.data.fees = fees; this.save(); }
  public saveNotifications(notifications: Notification[]) { this.data.notifications = notifications; this.save(); }
  public saveComplaints(complaints: Complaint[]) { this.data.complaints = complaints; this.save(); }

  public resetToTrialData(): { success: boolean; message: string } {
    const fresh = getInitialData();
    this.data.lectures = fresh.lectures;
    this.data.assignments = fresh.assignments;
    this.data.exams = fresh.exams;
    this.save();
    return { 
      success: true, 
      message: 'تمت إعادة تهيئة البيانات بنجاح! تم وضع محاضرة واحدة، واجب واحد، واختبار واحد كتجربة عملية متكاملة.' 
    };
  }
}

export const dbStore = new DBStore();
