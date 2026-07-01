import React, { useState, useEffect } from 'react';
import { apiRequest, subscribeToEvents } from '../utils/api.js';
import {
  GraduationCap, Users, BookOpen, FileText, Video, Bell, CreditCard, AlertCircle, LogOut,
  UserPlus, Search, Edit, Trash, Plus, Check, CheckCircle, Clock, Calendar, ShieldAlert,
  Paperclip, ArrowRight, Eye, Upload, RefreshCw, Award, Play, Database, Sparkles, Download
} from 'lucide-react';
import { Student, Lecture, Assignment, Exam, Fee, Notification, Complaint, Department } from '../types.js';

interface AdminDashboardProps {
  user: any;
  onLogout: () => void;
}

export default function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'students' | 'departments' | 'fees' | 'complaints' | 'announcements' | 'supabase'>('students');

  // DB Collections State
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [allExamsList, setAllExamsList] = useState<Exam[]>([]);
  const [announcementsSubTab, setAnnouncementsSubTab] = useState<'news' | 'proctoring'>('news');
  const [openProctorVideoId, setOpenProctorVideoId] = useState<string | null>(null);
  
  // Supabase Sync States
  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [syncingSupabase, setSyncingSupabase] = useState(false);
  
  // Department specific sub-states
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  // Sub-tabs for Department view
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [deptSubTab, setDeptSubTab] = useState<'students' | 'lectures' | 'assignments' | 'exams' | 'attendance' | 'notifications'>('students');

  // Interactive detail overlay states
  const [activeStudentDetail, setActiveStudentDetail] = useState<Student | null>(null);
  const [isEditingStudent, setIsEditingStudent] = useState(false);

  // Form inputs for Student Registration / Editing
  const [studentForm, setStudentForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    familyName: '',
    email: '',
    departmentId: '',
    status: 'Active' as any,
    photo: '',
    documents: [] as { name: string; content: string; type: string }[]
  });

  // Form input for Lectures
  const [lectureForm, setLectureForm] = useState({
    courseName: '',
    lectureNumber: '',
    instructor: '',
    youtubeLink: '',
    pdfContent: '',
    diagrams: [] as string[]
  });

  // Form input for Assignments
  const [assignmentForm, setAssignmentForm] = useState({
    lectureId: '',
    title: '',
    description: '',
    dueDate: ''
  });

  // Form input for Exams
  const [examForm, setExamForm] = useState({
    courseName: '',
    date: '',
    time: '',
    duration: '60',
    questions: [
      { type: 'mcq' as const, questionText: '', options: ['', '', '', ''], correctAnswer: '' },
      { type: 'essay' as const, questionText: '' }
    ] as any[]
  });

  // Form input for Fees Update
  const [feeForm, setFeeForm] = useState({
    studentId: '',
    totalFees: '',
    amountPaid: ''
  });

  // Form input for Announcements
  const [announcementForm, setAnnouncementForm] = useState({
    departmentId: '' as string | null, // null for global
    title: '',
    message: ''
  });

  // Reply state for complaints
  const [complaintReply, setComplaintReply] = useState('');
  const [complaintStatus, setComplaintStatus] = useState<'pending' | 'in-progress' | 'resolved'>('pending');

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showLectureModal, setShowLectureModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState<Complaint | null>(null);
  const [viewingStudentProfile, setViewingStudentProfile] = useState<Student | null>(null);
  const [studentProfileActiveTab, setStudentProfileActiveTab] = useState<'basic' | 'assignments' | 'exams' | 'fees' | 'complaints'>('basic');

  // Selected Submission grading details
  const [examSubmissionGrading, setExamSubmissionGrading] = useState<{ exam: Exam; student: Student; result: any } | null>(null);
  const [assignmentSubmissionGrading, setAssignmentSubmissionGrading] = useState<{ assignment: Assignment; student: Student; submission: any } | null>(null);
  const [gradingScore, setGradingScore] = useState('');

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAllData = async () => {
    try {
      const depts = await apiRequest('/api/departments');
      setDepartments(depts);

      if (depts.length > 0 && !studentForm.departmentId) {
        setStudentForm(prev => ({ ...prev, departmentId: depts[0]._id }));
      }

      const studentsList = await apiRequest(`/api/admin/students?search=${searchQuery}`);
      setStudents(studentsList);

      const feesList = await apiRequest('/api/admin/fees');
      setFees(feesList);

      const complaintsList = await apiRequest('/api/complaints');
      setComplaints(complaintsList);

      const notifsList = await apiRequest('/api/notifications');
      setNotifications(notifsList);

      const globalExams = await apiRequest('/api/admin/exams');
      setAllExamsList(globalExams || []);

      if (selectedDept) {
        await fetchDeptData(selectedDept._id);
      }
    } catch (e: any) {
      console.error('Error fetching admin data:', e);
      showToast('error', 'فشل جلب وتحديث السجلات من قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeptData = async (deptId: string) => {
    try {
      const lecs = await apiRequest(`/api/departments/${deptId}/lectures`);
      setLectures(lecs);

      const assigns = await apiRequest(`/api/departments/${deptId}/assignments`);
      setAssignments(assigns);

      const exms = await apiRequest(`/api/departments/${deptId}/exams`);
      setExams(exms);
    } catch (err) {
      console.error('Error fetching department-specific details:', err);
    }
  };

  const fetchSupabaseStatus = async () => {
    try {
      const status = await apiRequest('/api/admin/supabase-status');
      setSupabaseStatus(status);
    } catch (e) {
      console.error('Error fetching Supabase status:', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'supabase') {
      fetchSupabaseStatus();
    }
  }, [activeTab]);

  useEffect(() => {
    fetchAllData();

    const unsubscribe = subscribeToEvents((event) => {
      console.log('SSE event received in Admin Workspace:', event);
      fetchAllData();
      showToast('success', 'تم تحديث مزامنة السجلات تلقائياً من الإدارة العامة.');
    });

    return () => {
      unsubscribe();
    };
  }, [searchQuery, selectedDept]);

  // Student Registration submission
  const handleStudentRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditingStudent && activeStudentDetail) {
        await apiRequest(`/api/admin/students/${activeStudentDetail._id}`, 'PUT', studentForm);
        showToast('success', 'تم تحديث الملف الشخصي للطالب بنجاح.');
        setIsEditingStudent(false);
        setActiveStudentDetail(null);
      } else {
        const result = await apiRequest('/api/admin/students', 'POST', studentForm);
        showToast('success', `تم تسجيل الطالب بنجاح! الرقم الأكاديمي الصادر: ${result.academicId}`);
      }
      setShowRegisterModal(false);
      setStudentForm({
        firstName: '',
        middleName: '',
        lastName: '',
        familyName: '',
        email: '',
        departmentId: departments[0]?._id || '',
        status: 'Active',
        photo: '',
        documents: []
      });
      fetchAllData();
    } catch (err: any) {
      showToast('error', err.message || 'فشلت العملية.');
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (confirm('هل أنت متأكد تماماً من رغبتك في حذف هذا الطالب وسجلاته بالكامل؟ لا يمكن التراجع عن هذا الإجراء.')) {
      try {
        await apiRequest(`/api/admin/students/${studentId}`, 'DELETE');
        showToast('success', 'تم شطب ملف الطالب نهائياً من قاعدة البيانات.');
        setActiveStudentDetail(null);
        fetchAllData();
      } catch (err: any) {
        showToast('error', err.message || 'فشل حذف الملف.');
      }
    }
  };

  const handleCreateLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept) return;

    try {
      await apiRequest(`/api/departments/${selectedDept._id}/lectures`, 'POST', lectureForm);
      showToast('success', 'تم نشر منهج المحاضرة ومفردات المقرر بنجاح.');
      setShowLectureModal(false);
      setLectureForm({
        courseName: '',
        lectureNumber: '',
        instructor: '',
        youtubeLink: '',
        pdfContent: '',
        diagrams: []
      });
      fetchAllData();
    } catch (err: any) {
      showToast('error', err.message || 'فشل إنشاء المحاضرة.');
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept) return;

    try {
      await apiRequest(`/api/departments/${selectedDept._id}/assignments`, 'POST', assignmentForm);
      showToast('success', 'تم نشر ورقة الواجب والنشاط الأكاديمي المرفق.');
      setShowAssignmentModal(false);
      setAssignmentForm({
        lectureId: '',
        title: '',
        description: '',
        dueDate: ''
      });
      fetchAllData();
    } catch (err: any) {
      showToast('error', err.message || 'فشل نشر الواجب.');
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept) return;

    try {
      await apiRequest(`/api/departments/${selectedDept._id}/exams`, 'POST', examForm);
      showToast('success', 'تم إعداد وجدولة ورقة الاختبار والمراقبة الإشرافية المباشرة.');
      setShowExamModal(false);
      setExamForm({
        courseName: '',
        date: '',
        time: '',
        duration: '60',
        questions: [
          { type: 'mcq', questionText: '', options: ['', '', '', ''], correctAnswer: '' },
          { type: 'essay', questionText: '' }
        ]
      });
      fetchAllData();
    } catch (err: any) {
      showToast('error', err.message || 'فشل جدولة الاختبار.');
    }
  };

  const handleUpdateFees = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/admin/fees/${feeForm.studentId}/update`, 'POST', {
        totalFees: feeForm.totalFees,
        amountPaid: feeForm.amountPaid
      });
      showToast('success', 'تم تحديث ومطابقة السجل المالي والمصرفي للطالب.');
      setShowFeeModal(false);
      fetchAllData();
    } catch (err: any) {
      showToast('error', err.message || 'فشل التحديث المالي.');
    }
  };

  const handleComplaintReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showComplaintModal) return;

    try {
      await apiRequest(`/api/complaints/${showComplaintModal._id}/respond`, 'POST', {
        status: complaintStatus,
        response: complaintReply
      });
      showToast('success', 'تم تسجيل الرد الإداري بنجاح وإغلاق التذكرة.');
      setShowComplaintModal(null);
      setComplaintReply('');
      fetchAllData();
    } catch (err: any) {
      showToast('error', err.message || 'فشل تسجيل الرد.');
    }
  };

  const handleGradeAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentSubmissionGrading) return;

    try {
      await apiRequest(`/api/assignments/${assignmentSubmissionGrading.assignment._id}/grade`, 'POST', {
        studentId: assignmentSubmissionGrading.student._id,
        grade: gradingScore
      });
      showToast('success', 'تم حفظ وتوثيق درجة الواجب الدراسي للطالب.');
      setAssignmentSubmissionGrading(null);
      setGradingScore('');
      fetchAllData();
    } catch (e: any) {
      showToast('error', e.message || 'فشل توثيق الدرجة.');
    }
  };

  const handleGradeExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examSubmissionGrading) return;

    try {
      await apiRequest(`/api/exams/${examSubmissionGrading.exam._id}/grade`, 'POST', {
        studentId: examSubmissionGrading.student._id,
        finalScore: gradingScore
      });
      showToast('success', 'تم تقييم ورقة إجابة الطالب وتحديث السجل الأكاديمي.');
      setExamSubmissionGrading(null);
      setGradingScore('');
      fetchAllData();
    } catch (e: any) {
      showToast('error', e.message || 'فشل تقييم الاختبار.');
    }
  };

  const handlePublishExamResults = async (examId: string) => {
    try {
      await apiRequest(`/api/exams/${examId}/publish`, 'POST');
      showToast('success', 'تم اعتماد ونشر نتائج الدرجات للطلاب رسمياً وبشكل فوري.');
      fetchAllData();
    } catch (e: any) {
      showToast('error', e.message || 'فشل نشر النتائج.');
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/notifications', 'POST', announcementForm);
      showToast('success', 'تم نشر وتعميم الإعلان الإداري للطلاب بنجاح.');
      setAnnouncementForm({ departmentId: null, title: '', message: '' });
      fetchAllData();
    } catch (err: any) {
      showToast('error', err.message || 'فشل تعميم الإعلان.');
    }
  };

  // Helper file uploader base64
  const handleStudentPhotoAndDoc = (e: React.ChangeEvent<HTMLInputElement>, field: 'photo' | 'doc') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      if (field === 'photo') {
        setStudentForm(prev => ({ ...prev, photo: b64 }));
        showToast('success', 'تم تجهيز الصورة الشخصية.');
      } else {
        setStudentForm(prev => ({
          ...prev,
          documents: [...prev.documents, { name: file.name, content: b64, type: file.type }]
        }));
        showToast('success', `تم تجهيز مستند ${file.name}.`);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col font-sans select-none text-[#101923]" dir="rtl">
      
      {/* Toast Alert popups */}
      {toast && (
        <div className={`fixed top-4 left-4 z-50 p-4 rounded-xl border shadow-xl flex items-center gap-3 animate-fade-in ${
          toast.type === 'success' 
            ? 'bg-indigo-950 border-indigo-500/30 text-indigo-200' 
            : 'bg-red-950 border-red-500/30 text-red-200'
        }`}>
          <CheckCircle className="h-5 w-5 text-indigo-400" />
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {/* Modern Top Header matching screenshots */}
      <header className="bg-[#0b1421] text-white px-6 py-4 shadow-md flex justify-between items-center border-b border-[#1e2d3e]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/30">
            <GraduationCap className="h-7 w-7 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight">أكاديمية الأسعد للتعليم عن بعد</h1>
            <p className="text-[10px] text-[#8ea0b4] font-semibold mt-0.5">لوحة التحكم والمكتب الأكاديمي الإداري</p>
          </div>
        </div>

        {/* Current user & Status */}
        <div className="flex items-center gap-4">
          <div className="bg-[#152230] border border-[#2d3e52] px-4 py-2 rounded-xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
            <div className="text-right">
              <span className="text-xs font-extrabold text-white block">{user.name || 'العمادة الأكاديمية'}</span>
              <span className="text-[10px] text-indigo-300 font-bold block mt-0.5">مسؤول إداري نشط</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center text-xs font-bold text-indigo-300">
              M
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard container */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Right Sidebar */}
        <aside className="w-full md:w-64 bg-[#152230] text-[#94a3b8] border-l border-[#2d3e52] flex flex-col justify-between select-none shrink-0">
          <div>
            <div className="p-4 border-b border-[#2d3e52] bg-[#121d28] text-center">
              <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">لوحة القيادة والمراقبة</span>
              <span className="block text-xs text-slate-400 mt-1 font-semibold">المكتب الإداري</span>
            </div>

            <nav className="p-4 space-y-1.5">
              <button
                onClick={() => { setActiveTab('students'); setSelectedDept(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'students' ? 'bg-[#1A2A3A] text-white border-r-4 border-indigo-500' : 'text-[#8ea0b4] hover:bg-white/5 hover:text-white'
                }`}
              >
                <Users className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                <span>شؤون وقبول الطلاب</span>
              </button>

              <button
                onClick={() => { setActiveTab('departments'); setSelectedDept(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'departments' ? 'bg-[#1A2A3A] text-white border-r-4 border-indigo-500' : 'text-[#8ea0b4] hover:bg-white/5 hover:text-white'
                }`}
              >
                <BookOpen className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                <span>المقررات والأقسام</span>
              </button>

              <button
                onClick={() => { setActiveTab('fees'); setSelectedDept(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'fees' ? 'bg-[#1A2A3A] text-white border-r-4 border-indigo-500' : 'text-[#8ea0b4] hover:bg-white/5 hover:text-white'
                }`}
              >
                <CreditCard className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                <span>المالية والرسوم الدراسية</span>
              </button>

              <button
                onClick={() => { setActiveTab('complaints'); setSelectedDept(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'complaints' ? 'bg-[#1A2A3A] text-white border-r-4 border-indigo-500' : 'text-[#8ea0b4] hover:bg-white/5 hover:text-white'
                }`}
              >
                <AlertCircle className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                <span>الشكاوى والتظلمات</span>
                {complaints.filter(c => c.status === 'pending').length > 0 && (
                  <span className="mr-auto bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold">
                    {complaints.filter(c => c.status === 'pending').length}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setActiveTab('announcements'); setSelectedDept(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'announcements' ? 'bg-[#1A2A3A] text-white border-r-4 border-indigo-500' : 'text-[#8ea0b4] hover:bg-white/5 hover:text-white'
                }`}
              >
                <Bell className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                <span>الأخبار والمراقبة</span>
              </button>

              <button
                onClick={() => { setActiveTab('supabase'); setSelectedDept(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'supabase' ? 'bg-[#1A2A3A] text-white border-r-4 border-indigo-500' : 'text-[#8ea0b4] hover:bg-white/5 hover:text-white'
                }`}
              >
                <Database className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                <span>ربط قاعدة سوبابيس (Supabase)</span>
              </button>
            </nav>
          </div>

          <div className="p-4 border-t border-[#2d3e52] bg-[#121d28]">
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 border border-red-500/10 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>تسجيل الخروج الإداري</span>
            </button>
          </div>
        </aside>

        {/* Workspace core pane */}
        <main className="flex-1 flex flex-col overflow-y-auto p-6 md:p-8">
          
          {loading ? (
            <div className="h-96 flex flex-col justify-center items-center gap-3">
              <RefreshCw className="h-9 w-9 text-indigo-600 animate-spin" />
              <p className="text-sm font-bold text-slate-500">جاري تحميل وتحديث السجلات الإدارية الشاملة...</p>
            </div>
          ) : (
            <>
              {/* === STUDENTS TAB === */}
              {activeTab === 'students' && (
                <div className="space-y-6">
                  {/* Summary row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-400 font-bold block">إجمالي الطلاب المسجلين</span>
                        <span className="text-2xl font-black mt-1 block font-mono text-slate-800">{students.length} طالب</span>
                      </div>
                      <Users className="h-10 w-10 text-indigo-500 p-2 bg-indigo-50 rounded-xl" />
                    </div>

                    <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-400 font-bold block">الطلاب النشطين حالياً</span>
                        <span className="text-2xl font-black mt-1 block font-mono text-emerald-600">{students.filter(s => s.status === 'Active').length} طالب</span>
                      </div>
                      <CheckCircle className="h-10 w-10 text-emerald-500 p-2 bg-emerald-50 rounded-xl" />
                    </div>

                    <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-400 font-bold block">سجلات قيد المراجعة</span>
                        <span className="text-2xl font-black mt-1 block font-mono text-amber-500">{students.filter(s => s.status === 'Suspended').length} طالب</span>
                      </div>
                      <ShieldAlert className="h-10 w-10 text-amber-500 p-2 bg-amber-50 rounded-xl" />
                    </div>
                  </div>

                  {/* Filter and search menu */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 border border-slate-200 rounded-2xl shadow-sm">
                    <div className="relative w-full sm:w-80">
                      <input
                        type="text"
                        placeholder="ابحث عن طالب بالاسم أو الرقم الأكاديمي..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-[#1e293b] placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                      />
                      <Search className="h-4 w-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>

                    <button
                      onClick={() => {
                        setIsEditingStudent(false);
                        setStudentForm({
                          firstName: '',
                          middleName: '',
                          lastName: '',
                          familyName: '',
                          email: '',
                          departmentId: departments[0]?._id || '',
                          status: 'Active',
                          photo: '',
                          documents: []
                        });
                        setShowRegisterModal(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 w-full sm:w-auto justify-center cursor-pointer shadow-sm"
                    >
                      <UserPlus className="h-4.5 w-4.5" />
                      <span>قبول وتسجيل طالب جديد</span>
                    </button>
                  </div>

                  {/* Student list table */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-bold">
                            <th className="p-4 pr-6">الطالب والمعلومات الأساسية</th>
                            <th className="p-4">الرقم الأكاديمي</th>
                            <th className="p-4">القسم والفرع الدراسي</th>
                            <th className="p-4">حالة القيد الشخصي</th>
                            <th className="p-4 pl-6 text-left">الإجراءات والعمليات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {students.map((student) => {
                            const dept = departments.find(d => d._id === student.departmentId);
                            return (
                              <tr key={student._id} className="hover:bg-slate-50/60 font-medium text-slate-700">
                                <td className="p-4 pr-6 flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                    {student.photo ? (
                                      <img src={student.photo} alt="Student" className="h-full w-full object-cover" />
                                    ) : (
                                      <span className="text-slate-400 font-bold">{student.fullName.firstName.charAt(0)}</span>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-bold text-[#101923] text-sm">
                                      {student.fullName.firstName} {student.fullName.lastName} {student.fullName.familyName}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">{student.email}</div>
                                  </div>
                                </td>
                                <td className="p-4 font-mono font-bold text-slate-600">
                                  {student.academicId}
                                </td>
                                <td className="p-4 font-bold text-slate-600">
                                  {dept?.name || 'غير محدد'}
                                </td>
                                <td className="p-4">
                                  <span className={`inline-flex items-center gap-1 font-bold px-2 py-1 rounded-lg ${
                                    student.status === 'Active' 
                                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                      : 'bg-red-50 text-red-600 border border-red-100'
                                  }`}>
                                    {student.status === 'Active' ? 'مستمر / نشط' : 'موقوف مؤقتاً'}
                                  </span>
                                </td>
                                <td className="p-4 pl-6 text-left">
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => {
                                        setActiveStudentDetail(student);
                                        setStudentForm({
                                          firstName: student.fullName.firstName,
                                          middleName: student.fullName.middleName,
                                          lastName: student.fullName.lastName,
                                          familyName: student.fullName.familyName,
                                          email: student.email,
                                          departmentId: student.departmentId,
                                          status: student.status,
                                          photo: student.photo,
                                          documents: student.documents
                                        });
                                        setIsEditingStudent(true);
                                        setShowRegisterModal(true);
                                      }}
                                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer border border-slate-200"
                                      title="تعديل بيانات الطالب"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteStudent(student._id)}
                                      className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors cursor-pointer border border-red-100"
                                      title="شطب الطالب نهائياً"
                                    >
                                      <Trash className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                          {students.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-sm font-bold text-slate-400 bg-slate-50">
                                لم يتم العثور على أي طلاب مطابقين لشروط البحث.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* === DEPARTMENTS TAB === */}
              {activeTab === 'departments' && !selectedDept && (
                <div className="space-y-6">
                  <div className="p-6 bg-[#152230] text-white rounded-2xl flex items-center gap-4 border border-[#2d3e52]">
                    <div className="p-3 bg-indigo-500/10 rounded-xl">
                      <BookOpen className="h-8 w-8 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold">إدارة المقررات الدراسية والأقسام الأكاديمية</h2>
                      <p className="text-xs text-[#8ea0b4] mt-1">اختر قسماً أكاديمياً لإدارة المحاضرات، الواجبات، بنك الأسئلة، تدوين الحضور والغياب، وتقييم وتصحيح اختبارات المراقبة الرقمية.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {departments.map((dept) => (
                      <div key={dept._id} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-all flex flex-col justify-between group">
                        <div>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 uppercase font-mono">
                            {dept.code}
                          </span>
                          <h3 className="text-base font-extrabold text-[#101923] mt-4 group-hover:text-indigo-600 transition-colors">
                            {dept.name}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1.5 font-medium leading-relaxed">{dept.description}</p>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100">
                          <button
                            onClick={() => {
                              setSelectedDept(dept);
                              setDeptSubTab('students');
                              fetchDeptData(dept._id);
                            }}
                            className="w-full bg-[#101923] hover:bg-[#1a2c3f] text-white py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>فتح القسم الأكاديمي</span>
                            <ArrowRight className="h-4 w-4 shrink-0 rotate-180" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EXPANDED DEPARTMENT WORKSPACE */}
              {activeTab === 'departments' && selectedDept && (
                <div className="space-y-6">
                  {/* Department Breadcrumb Header */}
                  <div className="flex justify-between items-center bg-white p-5 border border-slate-200 rounded-2xl shadow-sm">
                    <div>
                      <button
                        onClick={() => setSelectedDept(null)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer"
                      >
                        &larr; العودة لجميع الأقسام الأكاديمية
                      </button>
                      <h2 className="text-lg font-extrabold text-[#101923] mt-2 capitalize">{selectedDept.name} &bull; لوحة القيادة الفرعية</h2>
                    </div>

                    <div className="flex gap-2">
                      {deptSubTab === 'lectures' && (
                        <button
                          onClick={() => setShowLectureModal(true)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Plus className="h-4.5 w-4.5" />
                          <span>إضافة محاضرة جديدة</span>
                        </button>
                      )}
                      {deptSubTab === 'assignments' && (
                        <button
                          onClick={() => {
                            if (lectures.length === 0) {
                              showToast('error', 'يجب إنشاء محاضرة واحدة على الأقل قبل ربط وتكليف الطلاب بواجب.');
                              return;
                            }
                            setAssignmentForm(prev => ({ ...prev, lectureId: lectures[0]._id }));
                            setShowAssignmentModal(true);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Plus className="h-4.5 w-4.5" />
                          <span>إضافة واجب جديد</span>
                        </button>
                      )}
                      {deptSubTab === 'exams' && (
                        <button
                          onClick={() => setShowExamModal(true)}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Plus className="h-4.5 w-4.5" />
                          <span>جدولة اختبار رقمي جديد</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inner sub-tabs */}
                  <div className="flex border-b border-slate-200 bg-white p-1.5 rounded-2xl shadow-sm gap-1">
                    {[
                      { key: 'students', label: 'الطلاب المسجلين بالقسم' },
                      { key: 'lectures', label: 'المحاضرات والمناهج' },
                      { key: 'assignments', label: 'الواجبات والتصحيح' },
                      { key: 'exams', label: 'الاختبارات وتقييم المراقبة' },
                      { key: 'attendance', label: 'سجل الحضور والغياب الموحد' }
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setDeptSubTab(tab.key as any)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          deptSubTab === tab.key
                            ? 'bg-[#101923] text-white'
                            : 'text-[#52647c] hover:bg-slate-50'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* SUB-TAB DETAILS */}
                  {/* 1. DEPT STUDENTS LIST */}
                  {deptSubTab === 'students' && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6">
                      <h3 className="text-sm font-extrabold text-[#101923] mb-4 border-b border-slate-100 pb-2">قائمة طلاب القسم</h3>
                      <div className="space-y-3">
                        {students.filter(s => s.departmentId === selectedDept._id).map((student) => (
                          <div 
                            key={student._id} 
                            onClick={() => setViewingStudentProfile(student)}
                            className="p-3.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-xl flex items-center justify-between font-medium cursor-pointer transition-all duration-200 group"
                            title="اضغط لعرض كامل تفاصيل وبينات الطالب"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200 group-hover:border-indigo-300">
                                {student.photo ? (
                                  <img src={student.photo} alt="Avatar" className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-slate-400 font-bold">{student.fullName.firstName.charAt(0)}</span>
                                )}
                              </div>
                              <div>
                                <span className="font-extrabold text-[#101923] group-hover:text-indigo-900 block text-sm transition-colors">{student.fullName.firstName} {student.fullName.lastName}</span>
                                <span className="text-[10px] text-slate-400 group-hover:text-indigo-600 font-mono block mt-0.5 transition-colors">الرقم الأكاديمي: {student.academicId}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-500 font-bold font-mono group-hover:text-indigo-700 transition-colors hidden sm:inline">{student.email}</span>
                              <span className="text-[10px] bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                                <span>عرض السجل</span>
                                <span className="text-indigo-400 group-hover:translate-x-[-2px] transition-transform font-mono">&larr;</span>
                              </span>
                            </div>
                          </div>
                        ))}
                        {students.filter(s => s.departmentId === selectedDept._id).length === 0 && (
                          <p className="text-xs text-slate-400 py-6 text-center font-bold">لا يوجد أي طلاب مسجلين في هذا القسم الأكاديمي حالياً.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 2. DEPT LECTURES LIST */}
                  {deptSubTab === 'lectures' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {lectures.map((lecture) => (
                        <div key={lecture._id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:shadow-sm transition-all">
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-bold">
                                المحاضرة رقم #{lecture.lectureNumber}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">{lecture.instructor}</span>
                            </div>
                            <h4 className="text-sm font-extrabold text-[#101923] mt-4 leading-snug">{lecture.courseName}</h4>
                            <p className="text-xs text-slate-500 mt-2 font-medium line-clamp-3 leading-relaxed">
                              {lecture.pdfContent || "لا يوجد مرجع تفصيلي مكتوب مرفق."}
                            </p>
                          </div>

                          <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
                            <button
                              onClick={async () => {
                                if (confirm('هل أنت متأكد من حذف هذه المحاضرة نهائياً؟')) {
                                  try {
                                    await apiRequest(`/api/lectures/${lecture._id}`, 'DELETE');
                                    showToast('success', 'تم شطب المحاضرة بنجاح.');
                                    fetchAllData();
                                  } catch (err: any) {
                                    showToast('error', err.message || 'فشلت العملية.');
                                  }
                                }
                              }}
                              className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              حذف المحاضرة
                            </button>
                            {lecture.youtubeLink && (
                              <a
                                href={lecture.youtubeLink}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 text-center bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5"
                              >
                                <Play className="h-3.5 w-3.5 text-indigo-500" />
                                <span>معاينة البث المرئي</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}

                      {lectures.length === 0 && (
                        <div className="col-span-full py-16 text-center text-sm font-bold text-slate-400 bg-white border border-slate-200 border-dashed rounded-2xl">
                          لا يوجد محاضرات منشورة في خطة القسم الأكاديمية حالياً.
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. DEPT ASSIGNMENTS LIST & GRADING */}
                  {deptSubTab === 'assignments' && (
                    <div className="space-y-6">
                      {assignments.map((assign) => (
                        <div key={assign._id} className="bg-white border border-slate-200 rounded-2xl p-6 text-right">
                          <div className="border-b border-slate-100 pb-4 mb-4 flex justify-between items-center">
                            <div>
                              <h4 className="text-base font-extrabold text-[#101923]">{assign.title}</h4>
                              <p className="text-[10px] text-slate-400 font-bold mt-1 font-mono">آخر موعد: {new Date(assign.dueDate).toLocaleDateString('ar-EG')} | الدرجة الإجمالية: {assign.maxScore}</p>
                            </div>
                            <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-1 rounded-lg text-xs font-bold font-mono">
                              تاريخ الإسناد
                            </span>
                          </div>

                          <div className="space-y-3">
                            <span className="text-xs font-bold text-slate-400 block mb-1">تسليمات واجبات الطلاب:</span>
                            {assign.submissions.map((sub, sIdx) => {
                              const student = students.find(st => st._id === sub.studentId);
                              if (!student) return null;
                              return (
                                <div key={sIdx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-semibold">
                                  <div className="flex items-center gap-2">
                                    <div className="text-right">
                                      <span className="font-extrabold text-[#101923] block">{student.fullName.firstName} {student.fullName.lastName}</span>
                                      <span className="text-[9px] text-slate-400 font-mono block mt-0.5">اسم الملف: {sub.fileName}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    {sub.grade !== undefined ? (
                                      <span className="text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg text-xs font-mono">
                                        الدرجة: {sub.grade} / {assign.maxScore}
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setAssignmentSubmissionGrading({ assignment: assign, student, submission: sub });
                                          setGradingScore('');
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                                      >
                                        تصحيح وتقييم
                                      </button>
                                    )}
                                    <a
                                      href={sub.fileUrl}
                                      download={sub.fileName}
                                      className="text-indigo-600 hover:underline text-[11px] font-bold"
                                    >
                                      تحميل ورقة الإجابة
                                    </a>
                                  </div>
                                </div>
                              );
                            })}
                            {assign.submissions.length === 0 && (
                              <p className="text-xs text-slate-400 py-4 text-center">لا توجد تسليمات مرفوعة من الطلاب لهذا الواجب بعد.</p>
                            )}
                          </div>
                        </div>
                      ))}

                      {assignments.length === 0 && (
                        <div className="py-16 text-center text-sm font-bold text-slate-400 bg-white border border-slate-200 rounded-2xl">
                          لا يوجد واجبات منشورة لهذا القسم حالياً.
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. DEPT EXAMS LIST & PROCTOR EVALUATION */}
                  {deptSubTab === 'exams' && (
                    <div className="space-y-6">
                      {exams.map((exam) => (
                        <div key={exam._id} className="bg-white border border-slate-200 rounded-2xl p-6 text-right">
                          <div className="border-b border-slate-100 pb-4 mb-4 flex justify-between items-center">
                            <div>
                              <h4 className="text-base font-extrabold text-[#101923]">{exam.title || exam.courseName}</h4>
                              <p className="text-[10px] text-slate-400 font-bold mt-1 font-mono">التاريخ: {exam.date} | المدة: {exam.duration} دقيقة | الدرجة الكلية: {exam.maxScore || 100}</p>
                            </div>
                            <div className="flex gap-2">
                              {!exam.resultsPublished ? (
                                <button
                                  onClick={() => handlePublishExamResults(exam._id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all cursor-pointer"
                                >
                                  اعتماد ونشر نتائج التقييمات
                                </button>
                              ) : (
                                <span className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-3 py-1 rounded-lg text-xs font-bold">
                                  النتائج معتمدة ومنشورة
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <span className="text-xs font-bold text-slate-400 block mb-1">أوراق إجابات الطلاب ومراقبة الكاميرا:</span>
                            {(exam.results || exam.submissions)?.map((sub: any, sIdx: number) => {
                              const student = students.find(st => st._id === sub.studentId);
                              if (!student) return null;
                              const currentScore = sub.score !== undefined ? sub.score : sub.finalScore;
                              return (
                                <div key={sIdx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-xs font-semibold">
                                  <div className="space-y-1">
                                    <span className="font-extrabold text-[#101923] text-sm block">{student.fullName.firstName} {student.fullName.lastName}</span>
                                    <span className="text-[10px] text-red-500 font-mono block">حالة تدوين الحركات: مراقبة آمنة بنجاح</span>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    {currentScore !== undefined ? (
                                      <span className="text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-lg text-xs font-mono">
                                        التقييم: {currentScore} / {exam.maxScore || 100}
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setExamSubmissionGrading({ exam, student, result: sub });
                                          setGradingScore('');
                                        }}
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm"
                                      >
                                        معاينة الإجابات وتوثيق الدرجة
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {((exam.results || exam.submissions)?.length || 0) === 0 && (
                              <p className="text-xs text-slate-400 py-4 text-center font-bold">لم يتقدم أي طالب لأداء هذا الاختبار بعد.</p>
                            )}
                          </div>
                        </div>
                      ))}

                      {exams.length === 0 && (
                        <div className="py-16 text-center text-sm font-bold text-slate-400 bg-white border border-slate-200 rounded-2xl">
                          لا توجد اختبارات مجدولة لهذا القسم حالياً.
                        </div>
                      )}
                    </div>
                  )}

                  {/* 5. DEPT ATTENDANCE SUMMARY TABLE */}
                  {deptSubTab === 'attendance' && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-right">
                      <h3 className="text-sm font-extrabold text-[#101923] mb-4 border-b border-slate-100 pb-2">جدول وسجل الحضور والغياب العام</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                              <th className="p-3 pr-4">اسم الطالب</th>
                              <th className="p-3">الرقم الأكاديمي</th>
                              {lectures.map(l => (
                                <th key={l._id} className="p-3 text-center">محاضرة #{l.lectureNumber}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {students.filter(s => s.departmentId === selectedDept._id).map((student) => (
                              <tr key={student._id} className="hover:bg-slate-50/50 font-semibold text-slate-700">
                                <td className="p-3 pr-4 font-extrabold text-[#101923]">{student.fullName.firstName} {student.fullName.lastName}</td>
                                <td className="p-3 font-mono font-bold text-slate-500">{student.academicId}</td>
                                {lectures.map(lecture => {
                                  const didAttend = lecture.attendance.some(a => a.studentId === student._id);
                                  return (
                                    <td key={lecture._id} className="p-3 text-center">
                                      {didAttend ? (
                                        <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">حاضر</span>
                                      ) : (
                                        <span className="text-slate-300">غائب</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* === FEES TAB === */}
              {activeTab === 'fees' && (
                <div className="space-y-6">
                  <div className="p-6 bg-[#152230] text-white rounded-2xl flex items-center gap-4 border border-[#2d3e52]">
                    <div className="p-3 bg-indigo-500/10 rounded-xl">
                      <CreditCard className="h-8 w-8 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold">المالية وسندات الرسوم الدراسية للطلاب</h2>
                      <p className="text-xs text-[#8ea0b4] mt-1">راجع إيصالات دفع الطلاب المرفوعة، ودقّق المستحقات المتبقية في ذمة كل طالب، وقم بتنزيل إيصالات السداد الموثقة.</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-bold">
                            <th className="p-4 pr-6">اسم الطالب الأكاديمي</th>
                            <th className="p-4">إجمالي الرسوم المستحقة</th>
                            <th className="p-4">المبلغ المسدد بالفعل</th>
                            <th className="p-4">الرصيد المتبقي</th>
                            <th className="p-4 pl-6 text-left">التعديل والمطابقة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {fees.map((fee) => {
                            const student = students.find(s => s._id === fee.studentId);
                            if (!student) return null;
                            return (
                              <tr key={fee._id} className="hover:bg-slate-50/60">
                                <td className="p-4 pr-6">
                                  <div className="font-extrabold text-[#101923] text-sm">{student.fullName.firstName} {student.fullName.lastName}</div>
                                  <div className="text-[10px] text-slate-400 mt-1">الرقم الأكاديمي: {student.academicId}</div>
                                </td>
                                <td className="p-4 font-mono font-bold text-slate-600">${fee.totalFees}</td>
                                <td className="p-4 font-mono font-bold text-emerald-600">${fee.amountPaid}</td>
                                <td className="p-4 font-mono font-bold text-amber-600">${fee.remaining}</td>
                                <td className="p-4 pl-6 text-left">
                                  <button
                                    onClick={() => {
                                      setFeeForm({
                                        studentId: fee.studentId,
                                        totalFees: fee.totalFees.toString(),
                                        amountPaid: fee.amountPaid.toString()
                                      });
                                      setShowFeeModal(true);
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm"
                                  >
                                    تحديث السجل المالي
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* === COMPLAINTS TAB === */}
              {activeTab === 'complaints' && (
                <div className="space-y-6">
                  <div className="p-6 bg-[#152230] text-white rounded-2xl flex items-center gap-4 border border-[#2d3e52]">
                    <div className="p-3 bg-indigo-50/10 rounded-xl">
                      <AlertCircle className="h-8 w-8 text-[#8ea0b4]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold">إدارة الطلبات والتظلمات والمقترحات</h2>
                      <p className="text-xs text-[#8ea0b4] mt-1">راجع التظلمات الأكاديمية والطلبات المرفوعة من الطلاب، ووثق ردود العمادة لاتخاذ الإجراءات وتسوية التذاكر.</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-6 text-right space-y-4 shadow-sm">
                    {complaints.map((comp) => {
                      const student = students.find(s => s._id === comp.studentId);
                      return (
                        <div key={comp._id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 font-medium">
                          <div className="flex justify-between items-start flex-wrap gap-2">
                            <div>
                              <h4 className="text-sm font-extrabold text-[#101923]">{comp.subject}</h4>
                              <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                                الطالب: {student ? `${student.fullName.firstName} ${student.fullName.lastName}` : 'غير معروف'} (رقم: {student?.academicId}) | التوقيت: {new Date(comp.createdAt).toLocaleDateString('ar-EG')}
                              </span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                              comp.status === 'resolved' 
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                : 'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}>
                              {comp.status === 'resolved' ? 'تم الحل والإغلاق' : 'بانتظار المراجعة والرد'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed font-semibold">{comp.description}</p>
                          
                          {comp.resolution ? (
                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs">
                              <span className="text-emerald-700 font-extrabold block">&bull; الرد الإداري الصادر:</span>
                              <p className="text-emerald-800 font-semibold mt-1 leading-relaxed">{comp.resolution}</p>
                            </div>
                          ) : (
                            <div className="pt-2">
                              <button
                                onClick={() => {
                                  setShowComplaintModal(comp);
                                  setComplaintReply('');
                                  setComplaintStatus('resolved');
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm"
                              >
                                صياغة رد إداري واعتماد القرار
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {complaints.length === 0 && (
                      <p className="text-xs text-slate-400 py-10 text-center font-bold">لا يوجد تذاكر تظلمات أو شكاوى نشطة بالانتظار.</p>
                    )}
                  </div>
                </div>
              )}

              {/* === ANNOUNCEMENTS & PROCTORING TAB === */}
              {activeTab === 'announcements' && (
                <div className="space-y-6">
                  {/* Tab Selector buttons */}
                  <div className="flex bg-[#121d28] p-1.5 rounded-2xl border border-[#2d3e52]/60 gap-2">
                    <button
                      onClick={() => setAnnouncementsSubTab('news')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        announcementsSubTab === 'news'
                          ? 'bg-indigo-600 text-white shadow-lg'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Bell className="h-4.5 w-4.5" />
                      <span>الأخبار والتعميمات الإدارية</span>
                    </button>
                    <button
                      onClick={() => setAnnouncementsSubTab('proctoring')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        announcementsSubTab === 'proctoring'
                          ? 'bg-indigo-600 text-white shadow-lg'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Video className="h-4.5 w-4.5" />
                      <span>جلسات المراقبة وتدفق الفيديو السحابي</span>
                    </button>
                  </div>

                  {announcementsSubTab === 'news' ? (
                    <>
                      <div className="p-6 bg-[#152230] text-white rounded-2xl flex items-center gap-4 border border-[#2d3e52]">
                        <div className="p-3 bg-indigo-500/10 rounded-xl">
                          <Bell className="h-8 w-8 text-indigo-400" />
                        </div>
                        <div className="text-right">
                          <h2 className="text-lg font-extrabold">نشر وتعميم الإعلانات والقرارات الأكاديمية</h2>
                          <p className="text-xs text-[#8ea0b4] mt-1">قم بنشر إعلانات شاملة لكل طلاب الأكاديمية، أو حدّد قسماً معنياً لتظهر هذه التنبيهات في لوحة القيادة الخاصة بهم فورياً.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Announcement form */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-right">
                          <h3 className="text-sm font-extrabold text-[#101923] mb-4 border-b border-slate-100 pb-2">صياغة إعلان جديد</h3>
                          <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1.5">القسم المستهدف بالإعلان</label>
                              <select
                                value={announcementForm.departmentId || ''}
                                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, departmentId: e.target.value ? e.target.value : null }))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-[#1e293b] focus:outline-none focus:border-indigo-500 font-bold"
                              >
                                <option value="">عام (كامل طلاب الأكاديمية)</option>
                                {departments.map(d => (
                                  <option key={d._id} value={d._id}>{d.name}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1.5">عنوان التعميم</label>
                              <input
                                type="text"
                                required
                                placeholder="مثال: موعد بدء اختبارات الكلية النهائية"
                                value={announcementForm.title || ''}
                                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-[#1e293b] focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1.5">تفاصيل ومحتوى الإعلان</label>
                              <textarea
                                rows={5}
                                required
                                placeholder="اكتب كامل نص التنبيه أو القرار هنا..."
                                value={announcementForm.message || ''}
                                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, message: e.target.value }))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-[#1e293b] focus:outline-none focus:border-indigo-500 leading-relaxed"
                              />
                            </div>

                            <button
                              type="submit"
                              className="w-full bg-[#101923] hover:bg-[#1a2c3f] text-white py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <Bell className="h-4 w-4" />
                              <span>نشر وتعميم الإعلان للطلاب</span>
                            </button>
                          </form>
                        </div>

                        {/* Published list */}
                        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 text-right">
                          <h3 className="text-sm font-extrabold text-[#101923] mb-4 border-b border-slate-100 pb-2">سجل الإعلانات والتعميمات الحالية</h3>
                          <div className="space-y-4">
                            {notifications.map((notif) => {
                              const targetDept = departments.find(d => d._id === notif.departmentId);
                              return (
                                <div key={notif._id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1 font-medium">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h4 className="text-sm font-extrabold text-[#101923]">{notif.title}</h4>
                                      <span className="text-[9px] text-slate-400 font-mono block mt-0.5">الجهة المستهدفة: {targetDept ? targetDept.name : 'عام (الجميع)'} | تاريخ النشر: {new Date(notif.createdAt).toLocaleDateString('ar-EG')}</span>
                                    </div>
                                  </div>
                                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">{notif.message}</p>
                                </div>
                              );
                            })}
                            {notifications.length === 0 && (
                              <p className="text-xs text-slate-400 py-10 text-center font-bold">لم يتم نشر أي إعلانات تعميمية سابقاً.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* PROCTORING SUB-TAB VIEW */}
                      <div className="p-6 bg-[#0f1d2c] text-white rounded-2xl flex items-center gap-4 border border-emerald-500/20 shadow-md">
                        <div className="p-3 bg-emerald-500/10 rounded-xl">
                          <Video className="h-8 w-8 text-emerald-400" />
                        </div>
                        <div className="text-right flex-1">
                          <div className="flex items-center justify-between">
                            <h2 className="text-lg font-extrabold">منصة المراقبة السحابية وغرفة التحكم الذكية</h2>
                            <span className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[9px] px-2.5 py-1 rounded-full font-black animate-pulse">
                              بث سحابي نشط ☁️
                            </span>
                          </div>
                          <p className="text-xs text-[#8ea0b4] mt-1">
                            شاهد جلسات المراقبة المسجلة وبث كاميرا الويب ومشاركة الشاشة المرفوعة من قبل الطلاب لجميع أقسام الأكاديمية.
                          </p>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-right">
                        <h3 className="text-sm font-extrabold text-[#101923] mb-4 border-b border-slate-100 pb-2 flex items-center gap-2 justify-start">
                          <Video className="h-4 w-4 text-indigo-500" />
                          <span>جلسات وتوثيق المراقبة للاختبارات السحابية</span>
                        </h3>

                        <div className="space-y-4">
                          {(() => {
                            const proctoringItems: Array<{
                              exam: Exam;
                              student: Student;
                              sub: any;
                            }> = [];

                            allExamsList.forEach(exam => {
                              const subs = exam.results || exam.submissions || [];
                              subs.forEach(sub => {
                                const student = students.find(s => s._id === sub.studentId);
                                if (student) {
                                  proctoringItems.push({ exam, student, sub });
                                }
                              });
                            });

                            if (proctoringItems.length === 0) {
                              return (
                                <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                  <Video className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                                  <p className="text-xs text-slate-500 font-extrabold">لا توجد جلسات اختبار أو تسجيلات مراقبة مرفوعة حالياً.</p>
                                  <p className="text-[10px] text-slate-400 mt-1">ستظهر هنا تسجيلات الطلاب بمجرد بدء وإرسال اختباراتهم الرقمية.</p>
                                </div>
                              );
                            }

                            return proctoringItems.map(({ exam, student, sub }) => {
                              const uniqueId = `${exam._id}_${student._id}`;
                              const isExpanded = openProctorVideoId === uniqueId;
                              const studentDept = departments.find(d => d._id === student.departmentId);
                              const isCloudVideo = (sub.cameraRecording && sub.cameraRecording.startsWith('/uploads/')) || (sub.screenRecording && sub.screenRecording.startsWith('/uploads/'));

                              return (
                                <div key={uniqueId} className="border border-slate-100 bg-slate-50/50 hover:bg-slate-50 rounded-2xl p-5 transition-all text-right space-y-4">
                                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="space-y-1.5 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-sm font-black text-[#101923]">
                                          الطالب: {student.fullName.firstName} {student.fullName.lastName}
                                        </h4>
                                        <span className="bg-slate-200/70 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-lg font-mono">
                                          ID: {student.academicId}
                                        </span>
                                        {studentDept && (
                                          <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                                            {studentDept.name}
                                          </span>
                                        )}
                                        {isCloudVideo && (
                                          <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1">
                                            تخزين سحابي مباشر ☁️
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs font-semibold text-slate-600">
                                        الاختبار المقرر: <span className="text-indigo-600 font-extrabold">{exam.courseName}</span> | عنوان الاختبار: <span className="font-bold text-slate-800">{exam.title || 'الاختبار العام'}</span>
                                      </p>
                                      <p className="text-[10px] text-slate-400 font-mono">
                                        تاريخ تقديم الاختبار: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('ar-EG') : 'غير متوفر'} | النتيجة المحققة: <span className="font-extrabold text-indigo-600">{sub.score} / {exam.maxScore || 100}</span>
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                      <button
                                        onClick={() => setOpenProctorVideoId(isExpanded ? null : uniqueId)}
                                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                      >
                                        <Eye className="h-4 w-4" />
                                        <span>{isExpanded ? 'إغلاق نافذة العرض' : 'عرض تسجيل المراقبة'}</span>
                                      </button>

                                      <button
                                        onClick={() => setExamSubmissionGrading({ exam, student, result: sub })}
                                        className="bg-[#101923] hover:bg-[#1a2c3f] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                      >
                                        <Award className="h-4 w-4" />
                                        <span>تقييم وتصحيح الإجابات</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Toggleable video playback stream */}
                                  {isExpanded && (
                                    <div className="p-4 bg-[#090f16] text-white rounded-2xl border border-slate-800 space-y-3 animate-fade-in">
                                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                          <span className="text-[11px] font-black text-emerald-400">بث تسجيلات جلسة المراقبة الذكية المعتمدة</span>
                                        </div>
                                        <span className="text-[9px] text-slate-400 font-mono">المعرّف الرقمي للجلسة: PROCTOR-{uniqueId}</span>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                          <div className="flex items-center justify-between text-[10px]">
                                            <span className="text-slate-300 font-bold">بث كاميرا الويب المباشر للطالب:</span>
                                            {sub.cameraRecording && sub.cameraRecording.startsWith('/uploads/') ? (
                                              <span className="text-emerald-400 font-black">سحابي حقيقي 🟢</span>
                                            ) : (
                                              <span className="text-indigo-400 font-medium">مراقبة افتراضية</span>
                                            )}
                                          </div>
                                          {sub.cameraRecording ? (
                                            <>
                                              <video
                                                src={sub.cameraRecording}
                                                controls
                                                playsInline
                                                className="w-full aspect-video rounded-xl border border-slate-800 bg-black shadow-lg"
                                              />
                                              <div className="flex justify-end pt-1">
                                                <a
                                                  href={sub.cameraRecording}
                                                  download={`camera-proctor-${student.academicId || 'student'}.webm`}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="inline-flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg transition-all"
                                                >
                                                  <Download className="h-3 w-3 text-emerald-400" />
                                                  <span>تنزيل فيديو الكاميرا</span>
                                                </a>
                                              </div>
                                            </>
                                          ) : (
                                            <div className="w-full aspect-video bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500">
                                              تسجيل الكاميرا غير متوفر
                                            </div>
                                          )}
                                        </div>

                                        <div className="space-y-1.5">
                                          <div className="flex items-center justify-between text-[10px]">
                                            <span className="text-slate-300 font-bold">تسجيل مشاركة الشاشة وبث المتصفح:</span>
                                            {sub.screenRecording && sub.screenRecording.startsWith('/uploads/') ? (
                                              <span className="text-emerald-400 font-black">سحابي حقيقي 🟢</span>
                                            ) : (
                                              <span className="text-indigo-400 font-medium">مراقبة افتراضية</span>
                                            )}
                                          </div>
                                          {sub.screenRecording ? (
                                            <>
                                              <video
                                                src={sub.screenRecording}
                                                controls
                                                playsInline
                                                className="w-full aspect-video rounded-xl border border-slate-800 bg-black shadow-lg"
                                              />
                                              <div className="flex justify-end pt-1">
                                                <a
                                                  href={sub.screenRecording}
                                                  download={`screen-proctor-${student.academicId || 'student'}.webm`}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="inline-flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg transition-all"
                                                >
                                                  <Download className="h-3 w-3 text-emerald-400" />
                                                  <span>تنزيل فيديو الشاشة</span>
                                                </a>
                                              </div>
                                            </>
                                          ) : (
                                            <div className="w-full aspect-video bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500">
                                              تسجيل مشاركة الشاشة غير متوفر
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* === SUPABASE TAB === */}
              {activeTab === 'supabase' && (
                <div className="space-y-6">
                  <div className="p-6 bg-[#152230] text-white rounded-2xl flex items-center gap-4 border border-[#2d3e52]">
                    <div className="p-3 bg-indigo-500/10 rounded-xl">
                      <Database className="h-8 w-8 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold">ربط ومزامنة قاعدة بيانات Supabase السحابية</h2>
                      <p className="text-xs text-[#8ea0b4] mt-1">
                        يمكنك هنا ربط نظام التعليم EduStream بمشروع سوبابيس (Supabase) الخاص بك لتخزين آمن، دائم وسحابي، ومتابعة حالة الاتصال الحالية ومزامنة البيانات يدوياً أو تلقائياً.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Connection Status Panel */}
                    <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 text-right space-y-4">
                      <h3 className="text-sm font-extrabold text-[#101923] border-b border-slate-100 pb-2">حالة الاتصال بالسحابة</h3>
                      
                      {supabaseStatus ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">حالة الربط:</span>
                            {supabaseStatus.connected ? (
                              <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-bold flex items-center gap-1">
                                <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                متصل وسحابي 🟢
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold">
                                تخزين محلي فقط 💾
                              </span>
                            )}
                          </div>

                          {supabaseStatus.connected && (
                            <div className="bg-slate-50 p-3 rounded-xl space-y-2">
                              <div>
                                <span className="block text-[10px] text-slate-400">رابط خادم سوبابيس (URL)</span>
                                <span className="block text-[11px] font-mono text-slate-700 select-all truncate" dir="ltr">
                                  {supabaseStatus.url}
                                </span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-slate-400">توقيت المزامنة السحابية الأخيرة</span>
                                <span className="block text-xs font-bold text-indigo-600">
                                  {supabaseStatus.lastSyncTime 
                                    ? new Date(supabaseStatus.lastSyncTime).toLocaleString('ar-EG') 
                                    : 'لم تتم المزامنة بعد'}
                                </span>
                              </div>
                            </div>
                          )}

                          {supabaseStatus.lastSyncError && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 space-y-1">
                              <span className="block text-[10px] font-bold">تنبيه المزامنة الأخير:</span>
                              <p className="text-[11px] font-medium leading-relaxed">{supabaseStatus.lastSyncError}</p>
                            </div>
                          )}

                          <button
                            onClick={async () => {
                              if (syncingSupabase) return;
                              setSyncingSupabase(true);
                              try {
                                const res = await apiRequest('/api/admin/supabase-sync', 'POST');
                                showToast('success', res.message || 'تمت المزامنة مع سوبابيس بنجاح!');
                                fetchSupabaseStatus();
                                fetchAllData();
                              } catch (err: any) {
                                showToast('error', err.message || 'فشل الاتصال بسوبابيس. يرجى مراجعة إعدادات الجدول.');
                                fetchSupabaseStatus();
                              } finally {
                                setSyncingSupabase(false);
                              }
                            }}
                            disabled={!supabaseStatus.connected || syncingSupabase}
                            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              !supabaseStatus.connected 
                                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/10'
                            }`}
                          >
                            <RefreshCw className={`h-4 w-4 ${syncingSupabase ? 'animate-spin' : ''}`} />
                            <span>{syncingSupabase ? 'جاري مزامنة السجلات...' : 'مزامنة السجلات السحابية الآن'}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col justify-center items-center py-8 gap-2 text-slate-400">
                          <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
                          <p className="text-[10px]">جاري فحص حالة سوبابيس...</p>
                        </div>
                      )}
                    </div>

                    {/* Trial Data Seeding Panel */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-right space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
                          <Sparkles className="h-4 w-4 text-amber-500" />
                        </span>
                        <h3 className="text-sm font-extrabold text-[#101923]">تأسيس وتجربة البيانات النموذجية</h3>
                      </div>
                      
                      <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                        هل تريد تهيئة تجربة نظيفة ومثالية للنظام؟ بالضغط على الزر أدناه، سيقوم النظام تلقائياً بتأسيس <b>محاضرة تجريبية واحدة</b>، و<b>واجب دراسي واحد</b>، و<b>اختبار إلكتروني واحد</b> باللغة العربية في قسم علوم الحاسوب لتسهيل مراجعة وتجربة النظام من قبل الطلاب وأعضاء الإدارة.
                      </p>

                      <button
                        onClick={async () => {
                          if (!window.confirm('هل أنت متأكد من رغبتك في إعادة تهيئة المساقات والأكواد؟ سيقوم هذا الإجراء باستبدال المحاضرات والواجبات والاختبارات الحالية ببيانات تجريبية نموذجية واحدة باللغة العربية.')) {
                            return;
                          }
                          try {
                            const res = await apiRequest('/api/admin/reset-trial', 'POST');
                            showToast('success', res.message || 'تم تأسيس البيانات التجريبية بنجاح!');
                            fetchAllData();
                          } catch (err: any) {
                            showToast('error', err.message || 'فشل تأسيس البيانات التجريبية.');
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/10"
                      >
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        <span>تأسيس بيانات التجربة الآن</span>
                      </button>
                    </div>

                    {/* How to configure guide */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 text-right space-y-4 flex flex-col justify-between">
                      <div className="space-y-4">
                        <h3 className="text-sm font-extrabold text-[#101923] border-b border-slate-100 pb-2">كيفية إعداد وتهيئة مفاتيح الربط</h3>
                        
                        <div className="space-y-3 text-xs leading-relaxed text-slate-600">
                          <p>
                            لتوصيل نظام التعليم EduStream بقاعدة بيانات سوبابيس (Supabase) السحابية الخاصة بك، يُرجى تتبع الخطوات البسيطة التالية:
                          </p>
                          <ol className="list-decimal list-inside pr-2 space-y-2 font-bold text-slate-700">
                            <li>قم بإنشاء حساب أو تسجيل الدخول في منصة <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-mono text-indigo-600">supabase.com</a>.</li>
                            <li>افتح مشروعك (Project) وانتقل إلى <b>Settings (الضبط) &gt; API</b>.</li>
                            <li>انسخ كلاً من <b>Project URL</b> و <b>anon public API key</b>.</li>
                            <li>افتح قائمة <b>Settings (الترس) &gt; Secrets</b> في شريط بناء AI Studio.</li>
                            <li>أضف مفتاحين جديدين باسم:
                              <div className="font-mono bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 my-1 space-y-1 text-left" dir="ltr">
                                <div>SUPABASE_URL = "رابط المشروع الخاص بك"</div>
                                <div>SUPABASE_KEY = "المفتاح العام anon"</div>
                              </div>
                            </li>
                            <li>احفظ المفاتيح، وسيتم إعادة تشغيل الخادم وتوصيله بالسحابة فوراً مع حفظ نسختك المحلية السابقة!</li>
                          </ol>
                        </div>
                      </div>

                      {/* SQL script section */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-3 mt-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold text-slate-600">أمر تأسيس الجدول في سوبابيس (SQL Run Code):</span>
                          <button
                            onClick={() => {
                              const sqlCode = `-- تأسيس جدول المزامنة الشاملة للتطبيق بنظام EduStream\ncreate table if not exists lms_data (\n  id text primary key,\n  data jsonb not null,\n  updated_at timestamp with time zone default timezone('utc'::text, now()) not null\n);\n\n-- تمكين الصلاحيات للمستخدمين للوصول للجدول\nalter table lms_data enable row level security;\ncreate policy "Allow public access" on lms_data for all using (true) with check (true);`;
                              navigator.clipboard.writeText(sqlCode);
                              showToast('success', 'تم نسخ كود الـ SQL بنجاح! الصقه في الـ SQL Editor بسوبابيس.');
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <span>نسخ كود SQL</span>
                          </button>
                        </div>
                        <pre className="text-[9px] font-mono text-left bg-[#101923] text-emerald-400 p-3 rounded-lg overflow-x-auto leading-relaxed border border-slate-800" dir="ltr">
{`-- تأسيس جدول المزامنة الشاملة للتطبيق بنظام EduStream
create table if not exists lms_data (
  id text primary key,
  data jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- تمكين الصلاحيات للمستخدمين للوصول للجدول
alter table lms_data enable row level security;
create policy "Allow public access" on lms_data for all using (true) with check (true);`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* --- MODALS & OVERLAYS IN ARABIC --- */}
      {/* 1. STUDENT REGISTRATION & EDIT MODAL */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-[#101923]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 text-right relative shadow-2xl animate-scale-up overflow-y-auto max-h-[90vh]">
            <h3 className="text-base font-extrabold text-[#101923] mb-4 pb-2 border-b border-slate-100">
              {isEditingStudent ? 'تحديث الملف الشخصي للطالب' : 'قبول وتسجيل طالب جديد'}
            </h3>
            
            <form onSubmit={handleStudentRegistration} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">الاسم الأول</label>
                  <input
                    type="text"
                    required
                    value={studentForm.firstName || ''}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-[#1e293b]"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">اسم الأب</label>
                  <input
                    type="text"
                    required
                    value={studentForm.middleName || ''}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, middleName: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-[#1e293b]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">اللقب / العائلة</label>
                  <input
                    type="text"
                    required
                    value={studentForm.lastName || ''}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-[#1e293b]"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">القبيلة / الشهرة</label>
                  <input
                    type="text"
                    required
                    value={studentForm.familyName || ''}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, familyName: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-[#1e293b]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">البريد الإلكتروني الأساسي</label>
                <input
                  type="email"
                  required
                  value={studentForm.email || ''}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-left text-[#1e293b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">القسم الأكاديمي المسجل</label>
                  <select
                    value={studentForm.departmentId || ''}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, departmentId: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-[#1e293b]"
                  >
                    {departments.map(d => (
                      <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">حالة الطالب</label>
                  <select
                    value={studentForm.status || 'Active'}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-[#1e293b]"
                  >
                    <option value="Active">مستمر / نشط</option>
                    <option value="Suspended">موقوف مؤقتاً</option>
                  </select>
                </div>
              </div>

              {/* Student Photo upload */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-500 mb-1">الصورة الشخصية (صورة b64)</label>
                  <label className="w-full flex items-center justify-center border border-dashed border-slate-200 p-3 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100">
                    <span className="text-[10px] text-slate-500 font-bold">انقر لرفع ملف الصورة</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleStudentPhotoAndDoc(e, 'photo')}
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">الهوية الشخصية / المستندات</label>
                  <label className="w-full flex items-center justify-center border border-dashed border-slate-200 p-3 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100">
                    <span className="text-[10px] text-slate-500 font-bold">انقر لرفع المستندات</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleStudentPhotoAndDoc(e, 'doc')}
                    />
                  </label>
                </div>
              </div>

              {studentForm.photo && (
                <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-emerald-600 font-bold">&bull; تم تحميل الصورة الشخصية للطالب بنجاح</span>
                </div>
              )}

              {studentForm.documents.length > 0 && (
                <div className="text-[10px] text-slate-500 space-y-1 text-right">
                  <span>المستندات المرفقة:</span>
                  {studentForm.documents.map((d, dIdx) => (
                    <p key={dIdx} className="font-mono text-indigo-600">&bull; {d.name}</p>
                  ))}
                </div>
              )}

              {isEditingStudent && activeStudentDetail && (() => {
                const studentExams = exams.filter(e => (e.results || e.submissions)?.some((r: any) => r.studentId === activeStudentDetail._id));
                if (studentExams.length === 0) return null;
                return (
                  <div className="border-t border-slate-100 pt-4 mt-4 text-right space-y-3">
                    <h4 className="text-xs font-extrabold text-[#101923] flex items-center gap-1.5 justify-start">
                      <Video className="h-4 w-4 text-indigo-600 animate-pulse" />
                      <span>سجل وتسجيلات مراقبة الاختبارات للطالب</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-normal">فيديوهات تصوير الكاميرا ومشاركة الشاشة الملتقطة أثناء جلسات الاختبار الأكاديمية:</p>
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                      {studentExams.map(exam => {
                        const result = (exam.results || exam.submissions)?.find((r: any) => r.studentId === activeStudentDetail._id);
                        if (!result) return null;
                        return (
                          <div key={exam._id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-right">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-extrabold text-[#101923]">{exam.title || exam.courseName}</span>
                              <span className="text-[9px] text-slate-400 font-mono font-bold">
                                {result.submittedAt ? new Date(result.submittedAt).toLocaleDateString('ar-EG') : 'تم التأدية'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1 text-right">
                                <span className="text-[9px] text-slate-500 font-bold block">فيديو الكاميرا الشخصية:</span>
                                {result.cameraRecording ? (
                                  <video
                                    controls
                                    playsInline
                                    className="w-full aspect-video rounded-lg border border-slate-200 bg-black shadow-inner"
                                    src={result.cameraRecording}
                                  />
                                ) : (
                                  <div className="w-full aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-[9px] text-slate-400">غير متوفر</div>
                                )}
                              </div>
                              <div className="space-y-1 text-right">
                                <span className="text-[9px] text-slate-500 font-bold block">مشاركة الشاشة:</span>
                                {result.screenRecording ? (
                                  <video
                                    controls
                                    playsInline
                                    className="w-full aspect-video rounded-lg border border-slate-200 bg-black shadow-inner"
                                    src={result.screenRecording}
                                  />
                                ) : (
                                  <div className="w-full aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-[9px] text-slate-400">غير متوفر</div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="pt-4 flex gap-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 bg-[#101923] hover:bg-[#1a2c3f] text-white py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer shadow"
                >
                  {isEditingStudent ? 'حفظ التغييرات الأكاديمية' : 'إتمام القبول والإنشاء'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-5 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold transition-all text-xs text-slate-600 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1.5 VIEW STUDENT DETAILED PROFILE MODAL */}
      {viewingStudentProfile && (() => {
        const studentDept = departments.find(d => d._id === viewingStudentProfile.departmentId);
        const studentFees = fees.filter(f => f.studentId === viewingStudentProfile._id);
        const studentComplaints = complaints.filter(c => c.studentId === viewingStudentProfile._id);
        
        // Find all assignments in this department and see what they submitted
        const deptAssignments = assignments.filter(a => {
          const lec = lectures.find(l => l._id === a.lectureId);
          return lec && lec.departmentId === viewingStudentProfile.departmentId;
        });

        // Find all exams in this department and see what they did
        const deptExams = exams.filter(e => e.departmentId === viewingStudentProfile.departmentId);

        return (
          <div className="fixed inset-0 z-50 bg-[#101923]/75 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl p-6 text-right relative shadow-2xl animate-scale-up overflow-y-auto max-h-[90vh]">
              
              {/* Close Button */}
              <button 
                onClick={() => setViewingStudentProfile(null)}
                className="absolute left-6 top-6 h-8 w-8 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>

              {/* Profile Header */}
              <div className="flex flex-col md:flex-row items-center gap-5 border-b border-slate-100 pb-6 mb-6">
                <div className="h-20 w-20 rounded-2xl bg-indigo-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {viewingStudentProfile.photo ? (
                    <img src={viewingStudentProfile.photo} alt="Student" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-black text-indigo-600">{viewingStudentProfile.fullName.firstName.charAt(0)}</span>
                  )}
                </div>
                <div className="text-center md:text-right space-y-1 flex-1">
                  <div className="flex flex-col md:flex-row items-center gap-2 justify-center md:justify-start">
                    <h2 className="text-xl font-black text-[#101923]">
                      {viewingStudentProfile.fullName.firstName} {viewingStudentProfile.fullName.middleName} {viewingStudentProfile.fullName.lastName} {viewingStudentProfile.fullName.familyName}
                    </h2>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${
                      viewingStudentProfile.status === 'Active' 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                        : 'bg-red-50 text-red-600 border border-red-100'
                    }`}>
                      {viewingStudentProfile.status === 'Active' ? 'مستمر / نشط' : 'موقوف مؤقتاً'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold font-mono">{viewingStudentProfile.email}</p>
                  <p className="text-xs font-semibold text-slate-500">
                    القسم الأكاديمي: <span className="font-bold text-indigo-600">{studentDept?.name || 'غير محدد'}</span>
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center shrink-0 w-full md:w-auto">
                  <span className="text-[10px] text-slate-400 font-bold block">الرقم الأكاديمي المعتمد</span>
                  <span className="text-base font-black text-slate-800 font-mono tracking-wider block mt-1">{viewingStudentProfile.academicId}</span>
                </div>
              </div>

              {/* Navigation tabs inside profile */}
              <div className="flex border-b border-slate-100 pb-px mb-6 overflow-x-auto gap-2">
                {[
                  { key: 'basic', label: 'المعلومات والملفات', icon: Users },
                  { key: 'assignments', label: 'الواجبات والتسليمات', icon: FileText },
                  { key: 'exams', label: 'الاختبارات والمراقبة', icon: Video },
                  { key: 'fees', label: 'الرسوم والمستحقات', icon: CreditCard },
                  { key: 'complaints', label: 'الشكاوى والاستفسارات', icon: AlertCircle }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = studentProfileActiveTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setStudentProfileActiveTab(tab.key as any)}
                      className={`flex items-center gap-1.5 px-4 py-3 border-b-2 font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20 rounded-t-xl'
                          : 'border-transparent text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      <Icon className="h-4 w-4 text-slate-500" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Content Panels */}
              <div className="min-h-[250px]">
                
                {/* A. BASIC INFO TAB */}
                {studentProfileActiveTab === 'basic' && (
                  <div className="space-y-6 text-right">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 border border-slate-200/60 rounded-2xl space-y-2">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">البيانات الأكاديمية والشخصية</h4>
                        <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">تاريخ التسجيل بالمنصة</span>
                            <span className="font-bold text-[#101923]">{viewingStudentProfile.createdAt ? new Date(viewingStudentProfile.createdAt).toLocaleDateString('ar-EG') : 'غير محدد'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">البريد الإلكتروني</span>
                            <span className="font-bold text-[#101923] font-mono break-all">{viewingStudentProfile.email}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 border border-slate-200/60 rounded-2xl space-y-2">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">حالة الحساب والنظام</h4>
                        <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">صلاحية الدخول</span>
                            <span className="font-bold text-[#101923]">مفعلة بالرقم الأكاديمي</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">حالة المزامنة السحابية</span>
                            <span className="font-bold text-emerald-600">متصلة وسحابية 100%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 border border-slate-200/60 rounded-2xl space-y-3">
                      <h4 className="text-xs font-black text-slate-500 flex items-center gap-1.5 justify-start">
                        <Paperclip className="h-4 w-4 text-indigo-600" />
                        <span>الملفات الثبوتية والمستندات الأكاديمية</span>
                      </h4>
                      {viewingStudentProfile.documents && viewingStudentProfile.documents.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {viewingStudentProfile.documents.map((doc, idx) => (
                            <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center text-xs">
                              <span className="font-mono font-bold text-slate-700 truncate max-w-[180px]" title={doc.name}>{doc.name}</span>
                              <a 
                                href={doc.content} 
                                download={doc.name}
                                className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer"
                              >
                                تحميل الملف
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-bold py-2">لا توجد أي وثائق رسمية مرفوعة مع هذا الملف الطلابي حالياً.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* B. ASSIGNMENTS TAB */}
                {studentProfileActiveTab === 'basic' ? null : studentProfileActiveTab === 'assignments' ? (
                  <div className="space-y-4 text-right">
                    <h4 className="text-xs font-black text-slate-500 mb-2">تسليمات ودرجات الواجبات الأكاديمية</h4>
                    <div className="space-y-3">
                      {deptAssignments.map((assign) => {
                        const submission = assign.submissions?.find(sub => sub.studentId === viewingStudentProfile._id);
                        return (
                          <div key={assign._id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-extrabold text-[#101923] text-xs">{assign.title}</h5>
                                <p className="text-[10px] text-slate-400 mt-1">تاريخ الاستحقاق والتسليم: {assign.dueDate}</p>
                              </div>
                              {submission ? (
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                                  submission.grade !== undefined 
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                    : 'bg-amber-50 text-amber-600 border border-amber-100'
                                }`}>
                                  {submission.grade !== undefined ? `الدرجة: ${submission.grade} / 10` : 'قيد التصحيح والتقييم'}
                                </span>
                              ) : (
                                <span className="text-[10px] bg-slate-100 text-slate-400 border border-slate-200 font-bold px-2 py-1 rounded-lg">لم يتم التسليم بعد</span>
                              )}
                            </div>

                            {submission && (
                              <div className="bg-white p-3 border border-slate-200/60 rounded-xl text-xs space-y-2 mt-2">
                                <div>
                                  <span className="text-[9px] text-slate-400 font-bold block">محتوى الإجابة والتسليم المكتوب:</span>
                                  <p className="text-slate-700 font-medium leading-relaxed mt-1 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">{submission.textContent || "لم ترفق إجابة مكتوبة."}</p>
                                </div>
                                {submission.attachment && (
                                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                    <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                                      <Paperclip className="h-3 w-3" />
                                      الملف المرفق: <span className="font-mono text-indigo-600">{submission.attachment.name}</span>
                                    </span>
                                    <a 
                                      href={submission.attachment.content} 
                                      download={submission.attachment.name}
                                      className="text-[9px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold px-2 py-0.5 rounded"
                                    >
                                      تحميل
                                    </a>
                                  </div>
                                )}
                                {submission.feedback && (
                                  <div className="pt-2 border-t border-slate-100">
                                    <span className="text-[9px] text-indigo-600 font-bold block">ملاحظات مصحح الواجب:</span>
                                    <p className="text-indigo-800 font-bold text-[10px] mt-0.5">{submission.feedback}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {deptAssignments.length === 0 && (
                        <p className="text-xs text-slate-400 py-6 text-center font-bold">لم يتم جدولة أو تكليف طلاب هذا القسم بأي واجبات أكاديمية حتى الآن.</p>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* C. EXAMS TAB */}
                {studentProfileActiveTab === 'exams' && (
                  <div className="space-y-4 text-right">
                    <h4 className="text-xs font-black text-slate-500 mb-2">أداء الاختبارات الإلكترونية وجلسات المراقبة</h4>
                    <div className="space-y-3">
                      {deptExams.map((exam) => {
                        const result = exam.results?.find(r => r.studentId === viewingStudentProfile._id);
                        return (
                          <div key={exam._id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-extrabold text-[#101923] text-xs">{exam.courseName}</h5>
                                <p className="text-[10px] text-slate-400 mt-1">عنوان الاختبار: {exam.title || 'الاختبار الدوري'}</p>
                              </div>
                              {result ? (
                                <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold px-2.5 py-1 rounded-lg">
                                  درجة التقييم: {result.score} / {exam.questions.length * 10 || 100}
                                </span>
                              ) : (
                                <span className="text-[10px] bg-slate-100 text-slate-400 border border-slate-200 font-bold px-2 py-1 rounded-lg">غائب / لم يؤد الاختبار</span>
                              )}
                            </div>

                            {result && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 text-right">
                                <div className="space-y-1">
                                  <span className="text-[9px] text-slate-400 font-bold block text-right">تسجيل كاميرا الطالب الشخصية:</span>
                                  {result.cameraRecording ? (
                                    <video
                                      controls
                                      playsInline
                                      src={result.cameraRecording}
                                      className="w-full aspect-video rounded-xl bg-black border border-slate-200"
                                    />
                                  ) : (
                                    <div className="w-full aspect-video bg-slate-100 rounded-xl flex items-center justify-center text-[10px] text-slate-400">غير متوفر</div>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[9px] text-slate-400 font-bold block text-right">تسجيل مشاركة شاشة الطالب:</span>
                                  {result.screenRecording ? (
                                    <video
                                      controls
                                      playsInline
                                      src={result.screenRecording}
                                      className="w-full aspect-video rounded-xl bg-black border border-slate-200"
                                    />
                                  ) : (
                                    <div className="w-full aspect-video bg-slate-100 rounded-xl flex items-center justify-center text-[10px] text-slate-400">غير متوفر</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {deptExams.length === 0 && (
                        <p className="text-xs text-slate-400 py-6 text-center font-bold">لم يتم جدولة أو تفعيل أي اختبارات أكاديمية لهذا القسم بعد.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* D. FEES TAB */}
                {studentProfileActiveTab === 'fees' && (
                  <div className="space-y-4 text-right">
                    <h4 className="text-xs font-black text-slate-500 mb-2">سجل المصروفات الدراسية والرسوم المالية</h4>
                    <div className="space-y-3">
                      {studentFees.map((fee) => (
                        <div key={fee._id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between font-medium">
                          <div>
                            <span className="font-extrabold text-[#101923] block text-xs">{fee.description}</span>
                            <span className="text-[10px] text-slate-400 block mt-1">تاريخ الاستحقاق والوفاء: {fee.dueDate}</span>
                          </div>
                          <div className="text-left space-y-1.5">
                            <span className="text-xs font-black text-slate-800 block font-mono">{fee.amount} ريال</span>
                            <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded ${
                              fee.status === 'Paid' 
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                : 'bg-red-50 text-red-600 border border-red-100'
                            }`}>
                              {fee.status === 'Paid' ? 'مدفوعة وسددت' : 'غير مسددة ومتأخرة'}
                            </span>
                          </div>
                        </div>
                      ))}
                      {studentFees.length === 0 && (
                        <p className="text-xs text-slate-400 py-6 text-center font-bold">لا يوجد أي التزامات أو رسوم مالية مجدولة على هذا الطالب.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* E. COMPLAINTS TAB */}
                {studentProfileActiveTab === 'complaints' && (
                  <div className="space-y-4 text-right">
                    <h4 className="text-xs font-black text-slate-500 mb-2">الشكاوى والاستفسارات المرفوعة من الطالب</h4>
                    <div className="space-y-3">
                      {studentComplaints.map((comp) => (
                        <div key={comp._id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-right">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-bold font-mono">{comp.createdAt ? new Date(comp.createdAt).toLocaleDateString('ar-EG') : 'تاريخ غير محدد'}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              comp.status === 'resolved' 
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                : comp.status === 'in-progress' 
                                ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                : 'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}>
                              {comp.status === 'resolved' ? 'تم الحل والمراجعة' : comp.status === 'in-progress' ? 'قيد المتابعة حالياً' : 'بانتظار الرد والتدقيق'}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-150 text-right">{comp.message}</p>
                          {comp.reply && (
                            <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-xs text-right">
                              <span className="text-[9px] text-indigo-600 font-bold block text-right">رد الإدارة المعتمد:</span>
                              <p className="text-indigo-900 font-bold mt-1 leading-relaxed text-right">{comp.reply}</p>
                            </div>
                          )}
                        </div>
                      ))}
                      {studentComplaints.length === 0 && (
                        <p className="text-xs text-slate-400 py-6 text-center font-bold">لا توجد أي شكاوى أو تذاكر دعم فني مرفوعة من هذا الطالب.</p>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="pt-5 border-t border-slate-100 flex gap-2 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setViewingStudentProfile(null)}
                  className="bg-[#101923] hover:bg-[#1a2c3f] text-white px-6 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer shadow"
                >
                  إغلاق السجل الأكاديمي
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* 2. CREATE COURSE LECTURE MODAL */}
      {showLectureModal && selectedDept && (
        <div className="fixed inset-0 z-50 bg-[#101923]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 text-right relative shadow-2xl animate-scale-up">
            <h3 className="text-base font-extrabold text-[#101923] mb-4 pb-2 border-b border-slate-100">
              إضافة محاضرة ومنهج لطلاب قسم {selectedDept.name}
            </h3>
            
            <form onSubmit={handleCreateLecture} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">اسم المادة والمقرر</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: الذكاء الاصطناعي"
                    value={lectureForm.courseName || ''}
                    onChange={(e) => setLectureForm(prev => ({ ...prev, courseName: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-[#1e293b]"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">رقم المحاضرة التسلسلي</label>
                  <input
                    type="number"
                    required
                    placeholder="مثال: 1"
                    value={lectureForm.lectureNumber || ''}
                    onChange={(e) => setLectureForm(prev => ({ ...prev, lectureNumber: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">المحاضر / أستاذ المادة</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: د. عاصم الأسعد"
                  value={lectureForm.instructor || ''}
                  onChange={(e) => setLectureForm(prev => ({ ...prev, instructor: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-[#1e293b]"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">رابط بث المحاضرة (YouTube Iframe)</label>
                <input
                  type="text"
                  placeholder="مثال: https://www.youtube.com/embed/dQw4w9WgXcQ"
                  value={lectureForm.youtubeLink || ''}
                  onChange={(e) => setLectureForm(prev => ({ ...prev, youtubeLink: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-left text-[#1e293b] font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">المحتوى النصي للمرجع والمذكرة الرقمية</label>
                <textarea
                  rows={4}
                  required
                  placeholder="اكتب المحتوى العلمي النصي المرفق هنا بالتفصيل..."
                  value={lectureForm.pdfContent || ''}
                  onChange={(e) => setLectureForm(prev => ({ ...prev, pdfContent: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-[#1e293b]"
                />
              </div>

              <div className="pt-4 flex gap-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 bg-[#101923] hover:bg-[#1a2c3f] text-white py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer"
                >
                  اعتماد ونشر المنهج
                </button>
                <button
                  type="button"
                  onClick={() => setShowLectureModal(false)}
                  className="px-5 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold transition-all text-xs text-slate-600 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. CREATE ASSIGNMENT MODAL */}
      {showAssignmentModal && selectedDept && (
        <div className="fixed inset-0 z-50 bg-[#101923]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 text-right relative shadow-2xl animate-scale-up">
            <h3 className="text-base font-extrabold text-[#101923] mb-4 pb-2 border-b border-slate-100">
              إضافة واجب وتقييم دراسي جديد
            </h3>
            
            <form onSubmit={handleCreateAssignment} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 mb-1">ربط الواجب بمحاضرة محددة</label>
                <select
                  value={assignmentForm.lectureId || ''}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, lectureId: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-[#1e293b]"
                >
                  {lectures.map(l => (
                    <option key={l._id} value={l._id}>المحاضرة رقم #{l.lectureNumber}: {l.courseName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">عنوان النشاط / الواجب</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: واجب الفصل الأول - حل مسائل الدوائر"
                  value={assignmentForm.title || ''}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-[#1e293b]"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">تعليمات الواجب والمتطلبات</label>
                <textarea
                  rows={3}
                  required
                  placeholder="أدخل مبررات وتوجيهات النشاط وكيفية الحل..."
                  value={assignmentForm.description || ''}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-[#1e293b]"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">آخر توقيت لتسليم الواجب</label>
                <input
                  type="date"
                  required
                  value={assignmentForm.dueDate || ''}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-[#1e293b] font-mono text-left"
                />
              </div>

              <div className="pt-4 flex gap-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 bg-[#101923] hover:bg-[#1a2c3f] text-white py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer"
                >
                  إسناد وتكليف الواجب
                </button>
                <button
                  type="button"
                  onClick={() => setShowAssignmentModal(false)}
                  className="px-5 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold transition-all text-xs text-slate-600 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. CREATE EXAM MODAL */}
      {showExamModal && selectedDept && (
        <div className="fixed inset-0 z-50 bg-[#101923]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 text-right relative shadow-2xl animate-scale-up overflow-y-auto max-h-[90vh]">
            <h3 className="text-base font-extrabold text-[#101923] mb-4 pb-2 border-b border-slate-100">
              إعداد ورقة وجلسة اختبار رقمي جديد خاضع للمراقبة
            </h3>
            
            <form onSubmit={handleCreateExam} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">اسم المادة والمقرر</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: فيزياء حديثة"
                    value={examForm.courseName || ''}
                    onChange={(e) => setExamForm(prev => ({ ...prev, courseName: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-[#1e293b]"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">المدة الكلية (بالدقائق)</label>
                  <input
                    type="number"
                    required
                    value={examForm.duration || ''}
                    onChange={(e) => setExamForm(prev => ({ ...prev, duration: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">تاريخ الاختبار</label>
                  <input
                    type="date"
                    required
                    value={examForm.date || ''}
                    onChange={(e) => setExamForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">توقيت بدء الجلسة</label>
                  <input
                    type="time"
                    required
                    value={examForm.time || ''}
                    onChange={(e) => setExamForm(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 font-mono text-left"
                  />
                </div>
              </div>

              {/* Add Simple questions */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-indigo-600 block mb-1">بنك الأسئلة المباشرة:</span>
                
                {examForm.questions.map((q, qIdx) => (
                  <div key={qIdx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex justify-between">
                      <span className="font-extrabold text-slate-700">السؤال رقم #{qIdx + 1} ({q.type === 'mcq' ? 'خيارات متعددة' : 'مقالي تفصيلي'})</span>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="أدخل نص السؤال العلمي هنا..."
                      value={q.questionText || ''}
                      onChange={(e) => {
                        const newQs = [...examForm.questions];
                        newQs[qIdx].questionText = e.target.value;
                        setExamForm(prev => ({ ...prev, questions: newQs }));
                      }}
                      className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs font-semibold text-[#1e293b]"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4 flex gap-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
                >
                  جدولة ونشر ورقة الأسئلة
                </button>
                <button
                  type="button"
                  onClick={() => setShowExamModal(false)}
                  className="px-5 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold transition-all text-xs text-slate-600 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. STUDENT FEE ADJUSTMENT MODAL */}
      {showFeeModal && (
        <div className="fixed inset-0 z-50 bg-[#101923]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 text-right relative shadow-2xl animate-scale-up">
            <h3 className="text-base font-extrabold text-[#101923] mb-4 pb-2 border-b border-slate-100">
              تحديث وتطابق الرصيد والرسوم المالية للطالب
            </h3>
            
            <form onSubmit={handleUpdateFees} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 mb-1">إجمالي الرسوم المطلوبة لهذا الفصل ($)</label>
                <input
                  type="number"
                  required
                  value={feeForm.totalFees || ''}
                  onChange={(e) => setFeeForm(prev => ({ ...prev, totalFees: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 text-left font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">إجمالي المبلغ المسدد بالفعل من الطالب ($)</label>
                <input
                  type="number"
                  required
                  value={feeForm.amountPaid || ''}
                  onChange={(e) => setFeeForm(prev => ({ ...prev, amountPaid: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 text-left font-mono"
                />
              </div>

              <div className="pt-4 flex gap-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 bg-[#101923] hover:bg-[#1a2c3f] text-white py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer"
                >
                  تحديث وتسوية الحساب المالي
                </button>
                <button
                  type="button"
                  onClick={() => setShowFeeModal(false)}
                  className="px-5 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold transition-all text-xs text-slate-600 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. COMPLAINT RESPONSE MODAL */}
      {showComplaintModal && (
        <div className="fixed inset-0 z-50 bg-[#101923]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 text-right relative shadow-2xl animate-scale-up">
            <h3 className="text-base font-extrabold text-[#101923] mb-4 pb-2 border-b border-slate-100">
              صياغة رد واعتماد قرار بشأن الشكوى / المقترح
            </h3>
            
            <form onSubmit={handleComplaintReply} className="space-y-4 text-xs font-semibold">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 space-y-1">
                <span className="font-extrabold text-[#101923] block text-xs">موضوع التظلم: {showComplaintModal.subject}</span>
                <p className="text-[11px] font-medium leading-relaxed">{showComplaintModal.description}</p>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">حالة تذكرة الطلب</label>
                <select
                  value={complaintStatus || 'pending'}
                  onChange={(e) => setComplaintStatus(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-[#1e293b]"
                >
                  <option value="pending">قيد الانتظار والمراجعة</option>
                  <option value="resolved">تمت التسوية والحل الإداري</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">الرد المعتمد من العميد الإداري</label>
                <textarea
                  rows={4}
                  required
                  placeholder="اكتب كامل نص الإجراء الصادر والحل هنا لتبليغ الطالب..."
                  value={complaintReply || ''}
                  onChange={(e) => setComplaintReply(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-[#1e293b] leading-relaxed font-semibold"
                />
              </div>

              <div className="pt-4 flex gap-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 bg-[#101923] hover:bg-[#1a2c3f] text-white py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer shadow"
                >
                  تسجيل القرار وإبلاغ الطالب
                </button>
                <button
                  type="button"
                  onClick={() => setShowComplaintModal(null)}
                  className="px-5 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold transition-all text-xs text-slate-600 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. ASSIGNMENT GRADING OVERLAY MODAL */}
      {assignmentSubmissionGrading && (
        <div className="fixed inset-0 z-50 bg-[#101923]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 text-right relative shadow-2xl animate-scale-up">
            <h3 className="text-base font-extrabold text-[#101923] mb-4 pb-2 border-b border-slate-100">
              تقييم ورصد درجة الواجب الدراسي
            </h3>
            
            <form onSubmit={handleGradeAssignment} className="space-y-4 text-xs font-semibold">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-600 space-y-1">
                <span className="font-extrabold text-[#101923] text-xs block">الطالب: {assignmentSubmissionGrading.student.fullName.firstName} {assignmentSubmissionGrading.student.fullName.lastName}</span>
                <span className="text-[10px] block font-mono">الرقم الأكاديمي: {assignmentSubmissionGrading.student.academicId}</span>
                <span className="text-[10px] text-indigo-600 block font-mono">اسم الملف المرفوع: {assignmentSubmissionGrading.submission.fileName}</span>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">الدرجة المرصودة للطالب (الحد الأقصى: {assignmentSubmissionGrading.assignment.maxScore} درجة)</label>
                <input
                  type="number"
                  required
                  placeholder="أدخل التقييم كرقـم"
                  max={assignmentSubmissionGrading.assignment.maxScore}
                  value={gradingScore || ''}
                  onChange={(e) => setGradingScore(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 text-left font-mono"
                />
              </div>

              <div className="pt-4 flex gap-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
                >
                  اعتماد وحفظ الدرجة
                </button>
                <button
                  type="button"
                  onClick={() => setAssignmentSubmissionGrading(null)}
                  className="px-5 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold transition-all text-xs text-slate-600 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. EXAM GRADING OVERLAY MODAL */}
      {examSubmissionGrading && (
        <div className="fixed inset-0 z-50 bg-[#101923]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 text-right relative shadow-2xl animate-scale-up overflow-y-auto max-h-[90vh]">
            <h3 className="text-base font-extrabold text-[#101923] mb-4 pb-2 border-b border-slate-100">
              تقييم إجابات وتدقيق المراقبة الذكية للاختبار الرقمي
            </h3>
            
            <form onSubmit={handleGradeExam} className="space-y-4 text-xs font-semibold">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-slate-600 space-y-1">
                <span className="font-extrabold text-[#101923] text-xs block">الطالب: {examSubmissionGrading.student.fullName.firstName} {examSubmissionGrading.student.fullName.lastName}</span>
                <span className="text-[10px] block font-mono">رقم القيد الأكاديمي: {examSubmissionGrading.student.academicId}</span>
                <span className="text-[10px] text-red-500 font-extrabold block">جلسة المراقبة: تم بثها وتوثيقها بسلامة تامة</span>
              </div>

              {/* Proctoring Videos Review */}
              <div className="space-y-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-right">
                <span className="text-xs font-extrabold text-indigo-600 flex items-center gap-1.5 justify-start">
                  <Video className="h-4 w-4 text-indigo-500 animate-pulse" />
                  <span>تسجيلات المراقبة الذكية المرفقة بجلسة الاختبار</span>
                </span>
                <p className="text-[10px] text-slate-400">فيديوهات تصوير كاميرا الويب ومشاركة الشاشة الملتقطة أثناء الامتحان:</p>
                <div className="grid grid-cols-2 gap-2.5 pt-1.5">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 block">بث كاميرا الويب:</span>
                    {examSubmissionGrading.result.cameraRecording ? (
                      <>
                        <video
                          controls
                          playsInline
                          className="w-full aspect-video rounded-xl border border-slate-200 bg-black shadow-sm"
                          src={examSubmissionGrading.result.cameraRecording}
                        />
                        <div className="flex justify-end pt-1">
                          <a
                            href={examSubmissionGrading.result.cameraRecording}
                            download={`camera-proctor-${examSubmissionGrading.student.academicId || 'student'}.webm`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[9px] text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 px-2 py-1 rounded-lg transition-all shadow-sm font-bold"
                          >
                            <Download className="h-2.5 w-2.5 text-emerald-500" />
                            <span>تنزيل الفيديو</span>
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="w-full aspect-video bg-slate-200 rounded-xl flex items-center justify-center text-[9px] text-slate-400">غير متوفر</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 block">لقطة الشاشة الحية:</span>
                    {examSubmissionGrading.result.screenRecording ? (
                      <>
                        <video
                          controls
                          playsInline
                          className="w-full aspect-video rounded-xl border border-slate-200 bg-black shadow-sm"
                          src={examSubmissionGrading.result.screenRecording}
                        />
                        <div className="flex justify-end pt-1">
                          <a
                            href={examSubmissionGrading.result.screenRecording}
                            download={`screen-proctor-${examSubmissionGrading.student.academicId || 'student'}.webm`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[9px] text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 px-2 py-1 rounded-lg transition-all shadow-sm font-bold"
                          >
                            <Download className="h-2.5 w-2.5 text-emerald-500" />
                            <span>تنزيل الفيديو</span>
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="w-full aspect-video bg-slate-200 rounded-xl flex items-center justify-center text-[9px] text-slate-400">غير متوفر</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Display student's answers */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-indigo-600 block">إجابات الطالب المكتوبة على ورقة الأسئلة:</span>
                {examSubmissionGrading.exam.questions.map((q: any, qIdx: number) => {
                  const studentAns = examSubmissionGrading.result.answers.find((a: any) => a.questionId === q.id);
                  return (
                    <div key={q.id} className="p-3 bg-slate-100/60 border border-slate-200 rounded-lg text-xs space-y-1">
                      <span className="font-bold text-slate-700 block">س#{qIdx + 1}: {q.questionText}</span>
                      <p className="p-2 bg-white rounded-md border border-slate-100 text-slate-800 font-semibold leading-relaxed">
                        {studentAns?.answerText || "لم يتم كتابة إجابة من الطالب."}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-slate-500 mb-1">الدرجة النهائية المستحقة من الطالب (الدرجة الإجمالية: {examSubmissionGrading.exam.maxScore} درجة)</label>
                <input
                  type="number"
                  required
                  placeholder="أدخل الدرجة كرقـم"
                  max={examSubmissionGrading.exam.maxScore}
                  value={gradingScore || ''}
                  onChange={(e) => setGradingScore(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 text-left font-mono"
                />
              </div>

              <div className="pt-4 flex gap-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
                >
                  حفظ وتوثيق درجة التقييم النهائى
                </button>
                <button
                  type="button"
                  onClick={() => setExamSubmissionGrading(null)}
                  className="px-5 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold transition-all text-xs text-slate-600 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
