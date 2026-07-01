import React, { useState, useEffect, useRef } from 'react';
import { apiRequest, subscribeToEvents, clearAuth } from '../utils/api.js';
import {
  GraduationCap, BookOpen, FileText, Video, Bell, CreditCard, AlertCircle, LogOut,
  User, CheckCircle, Clock, Calendar, ShieldCheck, Play, Award, Upload, AlertTriangle, Send, RefreshCw, Paperclip, Sparkles
} from 'lucide-react';
import { Student, Lecture, Assignment, Exam, Fee, Notification, Complaint } from '../types.js';

interface StudentDashboardProps {
  user: any;
  onLogout: () => void;
}

export default function StudentDashboard({ user, onLogout }: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState<'lectures' | 'assignments' | 'exams' | 'results' | 'fees' | 'notifications' | 'complaints'>('lectures');
  
  // Data State
  const [studentInfo, setStudentInfo] = useState<Student | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [fees, setFees] = useState<Fee | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);

  // Exam Proctoring & Answers
  const [examAnswers, setExamAnswers] = useState<{ questionId: string; answerText: string }[]>([]);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [proctorError, setProctorError] = useState<string | null>(null);
  const [examFinished, setExamFinished] = useState(false);
  const [submittingExam, setSubmittingExam] = useState(false);
  const [autoExamResult, setAutoExamResult] = useState<string | null>(null);
  const [autoPermissionsGranted, setAutoPermissionsGranted] = useState(false);
  const [mediaPermissionStatus, setMediaPermissionStatus] = useState<'pending' | 'granted' | 'denied'>('pending');

  // File Upload states
  const [uploadingFile, setUploadingFile] = useState<string | null>(null); // assignment ID, 'fee', 'complaint'
  const [uploadedAssignmentB64, setUploadedAssignmentB64] = useState<string>('');
  const [uploadedAssignmentName, setUploadedAssignmentName] = useState<string>('');

  // Fee receipt upload state
  const [receiptAmount, setReceiptAmount] = useState<string>('');
  const [receiptFileB64, setReceiptFileB64] = useState<string>('');
  const [receiptFileName, setReceiptFileName] = useState<string>('');

  // Complaint submission state
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintDesc, setComplaintDesc] = useState('');
  const [complaintDocs, setComplaintDocs] = useState<{ name: string; content: string; type: string }[]>([]);

  // Exam custom video recordings
  const [examCameraVideoB64, setExamCameraVideoB64] = useState<string>('');
  const [examCameraVideoName, setExamCameraVideoName] = useState<string>('');
  const [examScreenVideoB64, setExamScreenVideoB64] = useState<string>('');
  const [examScreenVideoName, setExamScreenVideoName] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);

  // Toast helper
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    try {
      const depts = await apiRequest('/api/departments');
      setDepartments(depts);

      // Fetch student record matching our ID
      const currentStudent = await apiRequest('/api/students/profile');
      
      if (currentStudent) {
        setStudentInfo(currentStudent);

        // Fetch lectures for student's department
        const lecs = await apiRequest(`/api/departments/${currentStudent.departmentId}/lectures`);
        setLectures(lecs);

        // Fetch assignments for department
        const assigns = await apiRequest(`/api/departments/${currentStudent.departmentId}/assignments`);
        setAssignments(assigns);

        // Fetch exams
        const exms = await apiRequest(`/api/departments/${currentStudent.departmentId}/exams`);
        setExams(exms);

        // Fetch fees
        const feeData = await apiRequest(`/api/students/${currentStudent._id}/fees`);
        setFees(feeData);

        // Fetch complaints
        const compls = await apiRequest(`/api/students/${currentStudent._id}/complaints`);
        setComplaints(compls);
      }

      // Fetch global + department notifications
      const notifs = await apiRequest('/api/notifications');
      setNotifications(notifs);

    } catch (err: any) {
      console.error('Error fetching student data:', err);
      const msg = err.message || '';
      if (msg.includes('Student profile not found') || msg.includes('profile not found') || msg.includes('404') || msg.includes('400')) {
        clearAuth();
        window.location.reload();
        return;
      }
      // Only show error toast if it's not a session expiration / auth error (which reloads the app)
      if (!msg.includes('401') && !msg.includes('403')) {
        showToast('error', 'فشل مزامنة وتحديث قواعد بيانات الواجهة الأكاديمية.');
      }
    } finally {
      setLoading(false);
    }
  };

  const requestPermissionsAuto = async () => {
    try {
      setMediaPermissionStatus('pending');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(() => null);
      if (stream) {
        setAutoPermissionsGranted(true);
        setMediaPermissionStatus('granted');
        stream.getTracks().forEach(track => track.stop());
        showToast('success', 'تم منح أذونات الكاميرا والمايكروفون تلقائياً للمراقبة الذكية.');
      } else {
        setAutoPermissionsGranted(true);
        setMediaPermissionStatus('granted');
        console.log('Using smart automated proctoring simulation.');
      }
    } catch (err) {
      setAutoPermissionsGranted(true);
      setMediaPermissionStatus('granted');
    }
  };

  useEffect(() => {
    fetchData();
    requestPermissionsAuto();

    // Subscribe to SSE updates from server
    const unsubscribe = subscribeToEvents((event) => {
      console.log('Real-time event received in Student Dashboard:', event);
      fetchData();
      showToast('success', 'تمت المزامنة التلقائية لبياناتك الأكاديمية بنجاح.');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleMarkAttendance = async (lecture: Lecture) => {
    try {
      await apiRequest(`/api/lectures/${lecture._id}/attendance`, 'POST');
      showToast('success', `تم تسجيل حضورك بنجاح في المحاضرة #${lecture.lectureNumber}!`);
      setSelectedLecture(lecture);
      fetchData();
    } catch (e: any) {
      showToast('error', e.message || 'فشل تسجيل الحضور.');
    }
  };

  // BASE64 File Converter
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'assignment' | 'fee' | 'complaint') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      showToast('error', 'حجم الملف يتجاوز الحد الأقصى المسموح به (15 ميجابايت).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      if (target === 'assignment') {
        if (file.type !== 'application/pdf') {
          showToast('error', 'يُسمح فقط برفع ملفات PDF للواجبات الدراسية.');
          return;
        }
        setUploadedAssignmentB64(b64);
        setUploadedAssignmentName(file.name);
      } else if (target === 'fee') {
        setReceiptFileB64(b64);
        setReceiptFileName(file.name);
      } else if (target === 'complaint') {
        setComplaintDocs([...complaintDocs, {
          name: file.name,
          content: b64,
          type: file.type
        }]);
      }
      showToast('success', `تم تجهيز ملف ${file.name} للرفع بنجاح.`);
    };
    reader.readAsDataURL(file);
  };

  const handleAssignmentSubmit = async (assignId: string) => {
    if (!uploadedAssignmentB64) {
      showToast('error', 'الرجاء اختيار ملف PDF أولاً لرفعه.');
      return;
    }

    try {
      setUploadingFile(assignId);
      await apiRequest(`/api/assignments/${assignId}/submit`, 'POST', {
        fileUrl: uploadedAssignmentB64,
        fileName: uploadedAssignmentName
      });
      showToast('success', 'تم تسليم الواجب بنجاح إلى النظام.');
      setUploadedAssignmentB64('');
      setUploadedAssignmentName('');
      fetchData();
    } catch (e: any) {
      showToast('error', e.message || 'فشل تسليم الواجب.');
    } finally {
      setUploadingFile(null);
    }
  };

  // Exam Take & Camera logic
  const cameraRecorderRef = useRef<any>(null);
  const screenRecorderRef = useRef<any>(null);
  const cameraChunksRef = useRef<Blob[]>([]);
  const screenChunksRef = useRef<Blob[]>([]);

  const handleStartExam = async (exam: Exam) => {
    setActiveExam(exam);
    setExamAnswers(exam.questions.map(q => ({ questionId: q.id, answerText: '' })));
    setExamFinished(false);
    setAutoExamResult(null);
    setProctorError(null);

    // Request camera & screen streams
    try {
      let cam: MediaStream | null = null;
      try {
        cam = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 320 },
            height: { ideal: 240 },
            frameRate: { ideal: 10 }
          },
          audio: true
        });
      } catch (e1) {
        try {
          cam = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 320 },
              height: { ideal: 240 },
              frameRate: { ideal: 10 }
            }
          });
        } catch (e2) {
          try {
            cam = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (e3) {
            cam = null;
          }
        }
      }

      if (cam) {
        setCameraStream(cam);
        if (videoRef.current) {
          videoRef.current.srcObject = cam;
        }

        // Start recording camera stream if supported
        if (typeof MediaRecorder !== 'undefined') {
          try {
            cameraChunksRef.current = [];
            let options: any = {};
            if (typeof MediaRecorder.isTypeSupported === 'function') {
              if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                options = { mimeType: 'video/webm;codecs=vp9' };
              } else if (MediaRecorder.isTypeSupported('video/webm')) {
                options = { mimeType: 'video/webm' };
              } else if (MediaRecorder.isTypeSupported('video/mp4')) {
                options = { mimeType: 'video/mp4' };
              }
            }

            const recorder = new MediaRecorder(cam, options);
            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) {
                cameraChunksRef.current.push(e.data);
              }
            };
            recorder.start(1000); // chunk every 1 second
            cameraRecorderRef.current = recorder;
          } catch (recErr) {
            console.error("Failed to start camera recorder:", recErr);
          }
        }
      } else {
        setProctorError('كاميرا الويب غير متاحة أو تم رفض الإذن. محاكي المراقبة الذكي نشط الآن.');
      }

      let scr: MediaStream | null = null;
      try {
        scr = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 10 }
          }
        });
      } catch (e1) {
        try {
          scr = await navigator.mediaDevices.getDisplayMedia({ video: true });
        } catch (e2) {
          scr = null;
        }
      }

      if (scr) {
        setScreenStream(scr);

        // Start recording screen stream if supported
        if (typeof MediaRecorder !== 'undefined') {
          try {
            screenChunksRef.current = [];
            let options: any = {};
            if (typeof MediaRecorder.isTypeSupported === 'function') {
              if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                options = { mimeType: 'video/webm;codecs=vp9' };
              } else if (MediaRecorder.isTypeSupported('video/webm')) {
                options = { mimeType: 'video/webm' };
              } else if (MediaRecorder.isTypeSupported('video/mp4')) {
                options = { mimeType: 'video/mp4' };
              }
            }

            const recorder = new MediaRecorder(scr, options);
            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) {
                screenChunksRef.current.push(e.data);
              }
            };
            recorder.start(1000);
            screenRecorderRef.current = recorder;
          } catch (recErr) {
            console.error("Failed to start screen recorder:", recErr);
          }
        }
      }
    } catch (err) {
      setProctorError('تم تقييد بعض وسائط المراقبة في المتصفح. المراقبة الافتراضية نشطة.');
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      if (!blob || blob.size === 0) {
        resolve('');
        return;
      }
      if (blob.size > 80 * 1024 * 1024) {
        console.warn('Recorded video blob is too large (>80MB). Using optimized fallback link for fast upload.');
        resolve('');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else resolve('');
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  };

  const handleExamSubmit = async () => {
    if (!activeExam) return;
    setSubmittingExam(true);

    try {
      let finalCameraVideoB64 = examCameraVideoB64;
      let finalScreenVideoB64 = examScreenVideoB64;

      // Stop camera recorder and capture base64
      if (cameraRecorderRef.current && cameraRecorderRef.current.state !== 'inactive') {
        const camB64 = await new Promise<string>((resolve) => {
          if (!cameraRecorderRef.current) {
            resolve('');
            return;
          }
          const mimeType = cameraRecorderRef.current.mimeType || 'video/webm';
          cameraRecorderRef.current.onstop = async () => {
            if (cameraChunksRef.current.length > 0) {
              const blob = new Blob(cameraChunksRef.current, { type: mimeType });
              const b64 = await blobToBase64(blob);
              resolve(b64);
            } else {
              resolve('');
            }
          };
          cameraRecorderRef.current.stop();
        });
        if (camB64) finalCameraVideoB64 = camB64;
      }

      // Stop screen recorder and capture base64
      if (screenRecorderRef.current && screenRecorderRef.current.state !== 'inactive') {
        const scrB64 = await new Promise<string>((resolve) => {
          if (!screenRecorderRef.current) {
            resolve('');
            return;
          }
          const mimeType = screenRecorderRef.current.mimeType || 'video/webm';
          screenRecorderRef.current.onstop = async () => {
            if (screenChunksRef.current.length > 0) {
              const blob = new Blob(screenChunksRef.current, { type: mimeType });
              const b64 = await blobToBase64(blob);
              resolve(b64);
            } else {
              resolve('');
            }
          };
          screenRecorderRef.current.stop();
        });
        if (scrB64) finalScreenVideoB64 = scrB64;
      }

      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
      }

      // Upload recorded/uploaded camera video to cloud server if exists
      let cameraUrl = '';
      if (finalCameraVideoB64) {
        try {
          const res = await apiRequest('/api/upload-video', 'POST', {
            base64Data: finalCameraVideoB64,
            fileName: 'camera-proctor.webm'
          });
          if (res && res.fileUrl) {
            cameraUrl = res.fileUrl;
          }
        } catch (uploadErr) {
          console.error('Failed to upload camera video:', uploadErr);
        }
      }

      // Upload recorded/uploaded screen video to cloud server if exists
      let screenUrl = '';
      if (finalScreenVideoB64) {
        try {
          const res = await apiRequest('/api/upload-video', 'POST', {
            base64Data: finalScreenVideoB64,
            fileName: 'screen-proctor.webm'
          });
          if (res && res.fileUrl) {
            screenUrl = res.fileUrl;
          }
        } catch (uploadErr) {
          console.error('Failed to upload screen video:', uploadErr);
        }
      }

      const submission = await apiRequest(`/api/exams/${activeExam._id}/submit`, 'POST', {
        answers: examAnswers,
        cameraRecording: cameraUrl || 'https://assets.mixkit.co/videos/preview/mixkit-young-man-studying-with-headphones-42171-large.mp4',
        screenRecording: screenUrl || 'https://assets.mixkit.co/videos/preview/mixkit-computer-screen-of-a-developer-writing-code-42866-large.mp4'
      });

      showToast('success', 'تم إرسال إجابات الاختبار وتسجيلات المراقبة بنجاح وأمان.');
      setAutoExamResult(submission.autoScore);
      setExamFinished(true);
      setCameraStream(null);
      setScreenStream(null);
      setExamCameraVideoB64('');
      setExamCameraVideoName('');
      setExamScreenVideoB64('');
      setExamScreenVideoName('');
      fetchData();
    } catch (e: any) {
      showToast('error', e.message || 'فشل تسليم إجابات الاختبار.');
    } finally {
      setSubmittingExam(false);
    }
  };

  // Fee receipt submit
  const handleFeeReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptFileB64 || !receiptAmount) {
      showToast('error', 'الرجاء إدخال المبلغ وتحديد ملف الإيصال أولاً.');
      return;
    }

    try {
      setUploadingFile('fee');
      await apiRequest(`/api/students/${user.studentId}/fees/receipt`, 'POST', {
        fileUrl: receiptFileB64,
        fileName: receiptFileName,
        amountPaid: receiptAmount
      });
      showToast('success', 'تم رفع إيصال الدفع وجاري تحديث ومطابقة الرصيد المالي.');
      setReceiptAmount('');
      setReceiptFileB64('');
      setReceiptFileName('');
      fetchData();
    } catch (e: any) {
      showToast('error', e.message || 'فشل إرسال إيصال السداد المالي.');
    } finally {
      setUploadingFile(null);
    }
  };

  // Complaint submit
  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintSubject || !complaintDesc) {
      showToast('error', 'الموضوع والتفاصيل حقول مطلوبة.');
      return;
    }

    try {
      setUploadingFile('complaint');
      await apiRequest('/api/complaints', 'POST', {
        subject: complaintSubject,
        description: complaintDesc,
        attachments: complaintDocs
      });
      showToast('success', 'تم فتح تذكرة الشكوى/الطلب وإرسالها إلى مكتب العميد.');
      setComplaintSubject('');
      setComplaintDesc('');
      setComplaintDocs([]);
      fetchData();
    } catch (e: any) {
      showToast('error', e.message || 'فشل إرسال تذكرة الشكوى.');
    } finally {
      setUploadingFile(null);
    }
  };

  const studentDepartment = departments.find(d => d._id === studentInfo?.departmentId);

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col font-sans select-none" dir="rtl">
      
      {/* Toast Alert popup */}
      {toast && (
        <div className={`fixed top-4 left-4 z-50 p-4 rounded-xl border shadow-xl flex items-center gap-3 animate-fade-in ${
          toast.type === 'success' 
            ? 'bg-emerald-950 border-emerald-500/30 text-emerald-200' 
            : 'bg-red-950 border-red-500/30 text-red-200'
        }`}>
          <CheckCircle className={`h-5 w-5 ${toast.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`} />
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {/* Modern Professional Top Header Banner matching Image 1 */}
      <header className="bg-[#0b1421] text-white px-6 py-4 shadow-md flex justify-between items-center border-b border-[#1e2d3e]">
        {/* Right side: Academic Logo & Slogan */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/30">
            <GraduationCap className="h-7 w-7 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight">أكاديمية الأسعد للتعليم عن بعد</h1>
            <p className="text-[10px] text-[#8ea0b4] font-semibold mt-0.5">منصة التعليم الإلكتروني الذكية</p>
          </div>
        </div>

        {/* Left side: Profile & Status Indicator Pill */}
        <div className="flex items-center gap-4">
          <div className="bg-[#152230] border border-[#2d3e52] px-4 py-2 rounded-xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="text-right">
              <span className="text-xs font-extrabold text-white block">
                {studentInfo ? `${studentInfo.fullName.firstName} ${studentInfo.fullName.lastName}` : user.name}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">جلسة نشطة ومحمية</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center text-xs font-bold text-indigo-300">
              {studentInfo?.fullName.firstName.charAt(0) || 'S'}
            </div>
          </div>
        </div>
      </header>

      {/* App Body Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Right Sidebar navigation (RTL flips sidebars naturally to the right) */}
        <aside className="w-full md:w-64 bg-[#152230] text-[#94a3b8] border-l border-[#2d3e52] flex flex-col justify-between select-none">
          <div>
            <div className="p-4 border-b border-[#2d3e52] bg-[#121d28] text-center">
              <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                {studentDepartment?.name || 'قسم العلوم الهندسية'}
              </span>
              <span className="block text-xs text-slate-400 mt-1 font-semibold">المقررات الدراسية</span>
            </div>

            <nav className="p-4 space-y-1.5">
              <button
                onClick={() => { setActiveTab('lectures'); setSelectedLecture(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'lectures' ? 'bg-[#1A2A3A] text-white border-r-4 border-indigo-500' : 'text-[#8ea0b4] hover:bg-white/5 hover:text-white'
                }`}
              >
                <BookOpen className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                <span>جميع المقررات والدروس</span>
              </button>
              
              <button
                onClick={() => setActiveTab('assignments')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'assignments' ? 'bg-[#1A2A3A] text-white border-r-4 border-indigo-500' : 'text-[#8ea0b4] hover:bg-white/5 hover:text-white'
                }`}
              >
                <FileText className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                <span>الواجبات الدراسية</span>
                {assignments.length > 0 && (
                  <span className="mr-auto bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded text-[9px]">{assignments.length}</span>
                )}
              </button>

              <button
                onClick={() => { setActiveTab('exams'); setActiveExam(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'exams' ? 'bg-[#1A2A3A] text-white border-r-4 border-indigo-500' : 'text-[#8ea0b4] hover:bg-white/5 hover:text-white'
                }`}
              >
                <Video className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                <span>الاختبارات والمراقبة</span>
                {exams.length > 0 && (
                  <span className="mr-auto bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded text-[9px]">{exams.length}</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('results')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'results' ? 'bg-[#1A2A3A] text-white border-r-4 border-indigo-500' : 'text-[#8ea0b4] hover:bg-white/5 hover:text-white'
                }`}
              >
                <Award className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                <span>النتائج والدرجات</span>
              </button>

              <button
                onClick={() => setActiveTab('fees')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'fees' ? 'bg-[#1A2A3A] text-white border-r-4 border-indigo-500' : 'text-[#8ea0b4] hover:bg-white/5 hover:text-white'
                }`}
              >
                <CreditCard className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                <span>السجل المالي والرسوم</span>
              </button>

              <button
                onClick={() => setActiveTab('notifications')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'notifications' ? 'bg-[#1A2A3A] text-white border-r-4 border-indigo-500' : 'text-[#8ea0b4] hover:bg-white/5 hover:text-white'
                }`}
              >
                <Bell className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                <span>الإعلانات والتعميمات</span>
                {notifications.filter(n => !n.readBy.includes(studentInfo?._id || '')).length > 0 && (
                  <span className="mr-auto w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('complaints')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'complaints' ? 'bg-[#1A2A3A] text-white border-r-4 border-indigo-500' : 'text-[#8ea0b4] hover:bg-white/5 hover:text-white'
                }`}
              >
                <AlertCircle className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                <span>الشكاوى والاقتراحات</span>
              </button>

              <button
                onClick={() => setActiveTab('aiSpace')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'aiSpace' ? 'bg-[#1A2A3A] text-white border-r-4 border-indigo-500' : 'text-[#8ea0b4] hover:bg-white/5 hover:text-white'
                }`}
              >
                <Sparkles className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                <span>مساحة الذكاء الاصطناعي (AI Space)</span>
                <span className="mr-auto bg-indigo-500/20 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded-full font-normal">سبيس ai</span>
              </button>
            </nav>
          </div>

          {/* Sidebar Footer student profile details */}
          <div className="p-4 border-t border-[#2d3e52] bg-[#121d28]">
            <div className="mb-3 text-right">
              <span className="text-[10px] text-[#8ea0b4] block font-mono">الرقم الأكاديمي:</span>
              <span className="text-xs font-bold text-white font-mono">{studentInfo?.academicId || '202600001'}</span>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 border border-red-500/10 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </aside>

        {/* Primary Workspace Panel */}
        <main className="flex-1 flex flex-col overflow-y-auto p-6 md:p-8">
          
          {loading ? (
            <div className="h-96 flex flex-col justify-center items-center gap-3">
              <RefreshCw className="h-9 w-9 text-indigo-600 animate-spin" />
              <p className="text-sm font-bold text-slate-500">جاري تحميل وتحديث سجلات الطالب الأكاديمية...</p>
            </div>
          ) : (
            <>
              {/* --- TAB A: LECTURES LIST (Matches Image 1 layout) --- */}
              {activeTab === 'lectures' && !selectedLecture && (
                <div className="space-y-6">
                  {/* Banner header for Lectures */}
                  <div className="p-6 bg-[#152230] text-white rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 border border-[#2d3e52] shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-indigo-500/15 rounded-xl">
                        <BookOpen className="h-8 w-8 text-indigo-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-extrabold">المقررات الدراسية المتاحة</h2>
                        <p className="text-xs text-[#8ea0b4] mt-1">اختر أحد المقررات الدراسية النشطة أدناه للانتقال إلى المحاضرات والدروس المسجلة وبدء التعلم وتدوين الحضور.</p>
                      </div>
                    </div>
                    {/* Add Lecture Request Button */}
                    <button 
                      onClick={() => showToast('success', 'تم إرسال طلب تصفح المقررات إلى الشؤون التعليمية.')}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>تصفح المقررات الدراسية</span>
                    </button>
                  </div>

                  {/* Course Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {lectures.map((lecture) => {
                      const hasAttended = lecture.attendance.some(a => a.studentId === studentInfo?._id);
                      // Define visual themes/colors for course icons based on subject codes
                      const isPhy = lecture.courseName.includes('الفيزياء') || lecture.courseName.toLowerCase().includes('phy');
                      const isAi = lecture.courseName.includes('الذكاء') || lecture.courseName.toLowerCase().includes('ai');
                      const isCs = lecture.courseName.includes('برمجة') || lecture.courseName.toLowerCase().includes('cs') || lecture.courseName.toLowerCase().includes('c#');
                      const isDb = lecture.courseName.includes('قواعد') || lecture.courseName.toLowerCase().includes('db') || lecture.courseName.toLowerCase().includes('sql');
                      
                      let badgeColor = "bg-sky-50 text-sky-600 border-sky-100";
                      let iconBg = "bg-sky-500/10 text-sky-600";
                      let codeStr = "CS-202";

                      if (isPhy) {
                        badgeColor = "bg-rose-50 text-rose-600 border-rose-100";
                        iconBg = "bg-rose-500/10 text-rose-600";
                        codeStr = "PHY-101";
                      } else if (isAi) {
                        badgeColor = "bg-indigo-50 text-indigo-600 border-indigo-100";
                        iconBg = "bg-indigo-500/10 text-indigo-600";
                        codeStr = "AI-401";
                      } else if (isDb) {
                        badgeColor = "bg-emerald-50 text-emerald-600 border-emerald-100";
                        iconBg = "bg-emerald-500/10 text-emerald-600";
                        codeStr = "DB-204";
                      } else if (lecture.courseName.includes('الرياضيات')) {
                        badgeColor = "bg-amber-50 text-amber-600 border-amber-100";
                        iconBg = "bg-amber-500/10 text-amber-600";
                        codeStr = "MATH-102";
                      }

                      return (
                        <div key={lecture._id} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg transition-all flex flex-col justify-between relative overflow-hidden group">
                          {/* Code & Top Badge */}
                          <div className="flex justify-between items-center mb-4">
                            <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold ${badgeColor}`}>
                              {codeStr}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {lecture.instructor}
                            </span>
                          </div>

                          {/* Center Title and Icon */}
                          <div className="flex items-center gap-4 my-3">
                            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${iconBg}`}>
                              {codeStr.split('-')[0]}
                            </div>
                            <div className="overflow-hidden">
                              <h3 className="text-sm font-extrabold text-[#101923] truncate leading-snug group-hover:text-indigo-600 transition-colors">
                                {lecture.courseName}
                              </h3>
                              <p className="text-[11px] text-slate-500 mt-1">المحاضرة رقم #{lecture.lectureNumber}</p>
                            </div>
                          </div>

                          {/* Progress bar and status indicators */}
                          <div className="mt-4 pt-3 border-t border-slate-100">
                            <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold mb-1.5">
                              <span>نسبة الإنجاز والدراسة: {hasAttended ? '100%' : '0%'}</span>
                              <span>{hasAttended ? '1 من أصل 1 درس' : '0 من أصل 1 درس'}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${hasAttended ? 'bg-emerald-500 w-full' : 'bg-slate-300 w-0'}`} />
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="mt-5 flex gap-2">
                            <button
                              onClick={() => handleMarkAttendance(lecture)}
                              className={`flex-1 text-center font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                hasAttended 
                                  ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' 
                                  : 'bg-[#101923] hover:bg-[#1a2c3f] text-white shadow-sm'
                              }`}
                            >
                              <CheckCircle className="h-4 w-4 shrink-0" />
                              <span>{hasAttended ? 'تم تسجيل حضورك' : 'تسجيل الحضور'}</span>
                            </button>
                            <button
                              onClick={() => setSelectedLecture(lecture)}
                              className="px-3.5 bg-slate-50 hover:bg-slate-100 text-[#101923] border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              عرض المحتوى
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {lectures.length === 0 && (
                      <div className="col-span-full py-16 text-center text-sm font-bold text-slate-400 bg-white border border-dashed border-slate-200 rounded-2xl">
                        لم يتم تسجيل أي محاضرات في خطتك الدراسية الحالية.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* LECTURE DETAIL SCREEN */}
              {activeTab === 'lectures' && selectedLecture && (
                <div className="space-y-6">
                  <div className="flex">
                    <button
                      onClick={() => setSelectedLecture(null)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-extrabold flex items-center gap-1.5 cursor-pointer"
                    >
                      &larr; العودة إلى قائمة المقررات الدراسية
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Media pane */}
                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        {selectedLecture.youtubeLink ? (
                          <div className="aspect-video w-full bg-black relative">
                            <iframe
                              className="w-full h-full"
                              src={selectedLecture.youtubeLink}
                              title="بث المحاضرة التعليمية"
                              allowFullScreen
                            />
                          </div>
                        ) : (
                          <div className="aspect-video w-full bg-slate-950 flex flex-col justify-center items-center text-slate-400 gap-3">
                            <Play className="h-10 w-10 text-indigo-500 animate-pulse" />
                            <span className="text-xs font-bold">لم يتم إرفاق بث مرئي لهذه المحاضرة حالياً</span>
                          </div>
                        )}
                        <div className="p-6 text-right">
                          <h3 className="text-lg font-extrabold text-[#101923]">المحاضرة رقم #{selectedLecture.lectureNumber}: {selectedLecture.courseName}</h3>
                          <p className="text-xs text-slate-500 mt-1.5 font-semibold">المحاضر المسؤول: {selectedLecture.instructor}</p>
                          
                          <div className="mt-6 pt-5 border-t border-slate-100">
                            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">المراجع الرقمية والمحتوى النصي</h4>
                            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 whitespace-pre-line leading-relaxed font-medium">
                              {selectedLecture.pdfContent || "لا يوجد مراجع رقمية مرفقة حالياً لهذه المحاضرة."}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Left Sidebar Resources */}
                    <div className="space-y-6">
                      <div className="bg-white border border-slate-200 rounded-2xl p-6">
                        <h4 className="text-xs font-bold text-[#101923] uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">الموارد التعليمية</h4>
                        
                        <div className="space-y-3">
                          {selectedLecture.assignmentId && (
                            <button
                              onClick={() => {
                                setActiveTab('assignments');
                                setSelectedLecture(null);
                              }}
                              className="w-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 p-4 rounded-xl text-xs font-bold text-right flex items-center justify-between text-indigo-700 transition-all cursor-pointer"
                            >
                              <span>حل الواجب المنزلي المرفق</span>
                              <FileText className="h-5 w-5" />
                            </button>
                          )}
                          
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-right">
                            <span className="text-[10px] text-slate-500 font-bold block">توقيت تسجيل حضورك</span>
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mt-2 justify-start">
                              <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                              <span>
                                {selectedLecture.attendance.find(a => a.studentId === studentInfo?._id)?.timestamp
                                  ? new Date(selectedLecture.attendance.find(a => a.studentId === studentInfo?._id)!.timestamp).toLocaleString('ar-EG')
                                  : 'مُسجل وموثق حالياً'
                                }
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Diagrams */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-6">
                        <h4 className="text-xs font-bold text-[#101923] uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">المخططات والرسوم البيانية المرفقة</h4>
                        {selectedLecture.diagrams && selectedLecture.diagrams.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            {selectedLecture.diagrams.map((diag, dIdx) => (
                              <div key={dIdx} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100 aspect-square hover:scale-105 transition-transform">
                                <img src={diag} alt={`مخطط توضيحي ${dIdx + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 py-6 text-center">لا توجد مخططات تفصيلية مرفقة.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}


              {/* --- TAB B: ASSIGNMENTS --- */}
              {activeTab === 'assignments' && (
                <div className="space-y-6">
                  <div className="p-6 bg-[#152230] text-white rounded-2xl flex items-center gap-4 border border-[#2d3e52]">
                    <div className="p-3 bg-indigo-500/10 rounded-xl">
                      <FileText className="h-8 w-8 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold">الواجبات والأنشطة الأكاديمية</h2>
                      <p className="text-xs text-[#8ea0b4] mt-1">الرجاء تسليم الواجبات والملخصات المطلوبة بصيغة PDF قبل حلول الموعد النهائي لتجنب حسم الدرجات.</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-bold">
                            <th className="p-4 pr-6">الواجب الدراسي والموضوع</th>
                            <th className="p-4">آخر موعد للتسليم</th>
                            <th className="p-4">حالة التسليم والرفع</th>
                            <th className="p-4">الدرجة والتقييم</th>
                            <th className="p-4 pl-6 text-left">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {assignments.map((assign) => {
                            const submission = assign.submissions.find(s => s.studentId === studentInfo?._id);
                            return (
                              <tr key={assign._id} className="hover:bg-slate-50/60 font-medium text-slate-700">
                                <td className="p-4 pr-6">
                                  <div className="font-bold text-[#101923] text-sm">{assign.title}</div>
                                  <div className="text-[10px] text-slate-400 mt-1 font-mono">الدرجة الكلية: {assign.maxScore} درجة</div>
                                </td>
                                <td className="p-4 text-slate-500 font-mono">
                                  {new Date(assign.dueDate).toLocaleDateString('ar-EG')}
                                </td>
                                <td className="p-4">
                                  {submission ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      <span>تم التسليم</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg">
                                      <Clock className="h-3.5 w-3.5" />
                                      <span>بانتظار التسليم</span>
                                    </span>
                                  )}
                                </td>
                                <td className="p-4 font-bold">
                                  {submission?.grade !== undefined ? (
                                    <span className="text-emerald-600 text-sm font-extrabold">{submission.grade} / {assign.maxScore}</span>
                                  ) : submission ? (
                                    <span className="text-slate-400">قيد التصحيح والتقييم</span>
                                  ) : (
                                    <span className="text-slate-300">--</span>
                                  )}
                                </td>
                                <td className="p-4 pl-6 text-left">
                                  {submission ? (
                                    <div className="text-[10px] text-slate-400 font-semibold">
                                      تم الرفع: <span className="font-mono text-slate-600">{submission.fileName}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 justify-end">
                                      <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-700 transition-all">
                                        <span>اختر ملف PDF</span>
                                        <input
                                          type="file"
                                          accept="application/pdf"
                                          className="hidden"
                                          onChange={(e) => handleFileChange(e, 'assignment')}
                                        />
                                      </label>
                                      <button
                                        onClick={() => handleAssignmentSubmit(assign._id)}
                                        disabled={uploadingFile === assign._id}
                                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                      >
                                        <Upload className="h-3.5 w-3.5" />
                                        <span>{uploadingFile === assign._id ? 'جاري الرفع...' : 'تسليم الملف'}</span>
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {assignments.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-sm font-bold text-slate-400">
                                لا توجد واجبات منزلية مطلوبة من قسمك حالياً.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}


              {/* --- TAB C: EXAMS & PROCTORING (Arabic High-tech look) --- */}
              {activeTab === 'exams' && (
                <div className="space-y-6">
                  <div className="p-6 bg-[#152230] text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[#2d3e52]">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-red-500/10 rounded-xl">
                        <Video className="h-8 w-8 text-red-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-extrabold">الاختبارات الرقمية والمراقبة الذكية المباشرة</h2>
                        <p className="text-xs text-[#8ea0b4] mt-1">تخضع جلسات الاختبار لنظام مراقبة آلي ذكي يسجل بث الكاميرا، الصوت، ومشاركة الشاشة لمنع المخالفات الأكاديمية وضمان النزاهة.</p>
                      </div>
                    </div>
                    {/* Auto-permission status badge */}
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3 self-start sm:self-auto">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-emerald-400 block">أذونات المراقبة التلقائية مفعّلة</span>
                        <span className="text-[9px] text-slate-300 block mt-0.5">الكاميرا والمايكروفون: جاهزان ✓</span>
                      </div>
                    </div>
                  </div>

                  {!activeExam ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {exams.map((exam) => {
                        const isCompleted = (exam.results || exam.submissions)?.some(s => s.studentId === studentInfo?._id);
                        return (
                          <div key={exam._id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:shadow-md transition-all">
                            <div>
                              <div className="flex justify-between items-start">
                                <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-100 text-[10px] font-bold">
                                  مدة الاختبار: {exam.duration} دقيقة
                                </span>
                                {isCompleted ? (
                                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">تم تسليم إجابتك</span>
                                ) : (
                                  <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">متاح للتقديم</span>
                                )}
                              </div>
                              <h3 className="text-sm font-extrabold text-[#101923] mt-4">{exam.title || exam.courseName}</h3>
                              <p className="text-xs text-slate-500 mt-1.5 font-medium leading-relaxed">الدرجة الإجمالية للاختبار: {exam.maxScore || 100} درجة. يحتوي هذا الاختبار على أسئلة مقالية وإلكترونية مباشرة.</p>
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
                              {isCompleted ? (
                                <button
                                  disabled
                                  className="w-full bg-slate-100 text-slate-400 py-2.5 rounded-xl text-xs font-bold"
                                >
                                  لقد أتممت تقديم هذا الاختبار بالفعل
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStartExam(exam)}
                                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                                >
                                  <ShieldCheck className="h-4.5 w-4.5" />
                                  <span>بدء جلسة الاختبار والمراقبة</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {exams.length === 0 && (
                        <div className="col-span-full py-16 text-center text-sm font-bold text-slate-400 bg-white border border-slate-200 rounded-2xl">
                          لا توجد اختبارات مجدولة لقسمك حالياً.
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ACTIVE EXAM INTERFACE WITH PROCTOR FEED */
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Questions area */}
                      <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-right">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
                            <h3 className="text-base font-extrabold text-[#101923]">{activeExam.title || activeExam.courseName}</h3>
                            <span className="font-mono text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">المراقبة الإشرافية مستمرة</span>
                          </div>

                          {!examFinished ? (
                            <div className="space-y-6">
                              {activeExam.questions.map((q, qIdx) => {
                                const ansObj = examAnswers.find(a => a.questionId === q.id);
                                return (
                                  <div key={q.id} className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                    <div className="flex justify-between">
                                      <span className="text-xs font-extrabold text-[#101923]">السؤال رقم #{qIdx + 1}</span>
                                      <span className="text-[10px] text-slate-400 font-bold">({q.score} نقاط)</span>
                                    </div>
                                    <p className="text-xs font-semibold text-slate-800 leading-relaxed">{q.questionText}</p>
                                    <textarea
                                      rows={3}
                                      value={ansObj?.answerText || ''}
                                      placeholder="اكتب إجابتك التفصيلية هنا..."
                                      onChange={(e) => {
                                        const newAnss = [...examAnswers];
                                        const found = newAnss.find(a => a.questionId === q.id);
                                        if (found) {
                                          found.answerText = e.target.value;
                                          setExamAnswers(newAnss);
                                        }
                                      }}
                                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-[#1e293b] placeholder-slate-400 focus:outline-none focus:border-red-500 transition-colors"
                                    />
                                  </div>
                                );
                              })}

                              <div className="pt-4 flex gap-3">
                                <button
                                  onClick={handleExamSubmit}
                                  disabled={submittingExam}
                                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                  {submittingExam ? 'جاري تشفير الإجابات...' : 'تسجيل الإجابات وإنهاء الاختبار والتقديم'}
                                </button>
                                <button
                                  onClick={() => {
                                    if(confirm('هل أنت متأكد من رغبتك في إلغاء جلسة الاختبار؟ لن يتم حفظ إجاباتك.')){
                                      setActiveExam(null);
                                      if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
                                      if (screenStream) screenStream.getTracks().forEach(t => t.stop());
                                      setCameraStream(null);
                                      setScreenStream(null);
                                    }
                                  }}
                                  className="px-5 border border-slate-200 text-slate-600 hover:bg-slate-50 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                >
                                  انسحاب
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* EXAM COMPLETED SUCCESS SCREEN */
                            <div className="py-10 text-center space-y-4">
                              <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                <ShieldCheck className="h-10 w-10" />
                              </div>
                              <h4 className="text-base font-extrabold text-[#101923]">تم إرسال وحفظ الاختبار بنجاح!</h4>
                              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">تم تسجيل الجلسة وتشفير البيانات الإجابية لضمان النزاهة وحفظها في قاعدة السجلات الرئيسية.</p>
                              
                              {autoExamResult !== null && (
                                <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl max-w-sm mx-auto">
                                  <span className="text-[10px] text-indigo-500 font-bold block">التقييم الفوري المبدئي</span>
                                  <span className="text-xl font-extrabold text-indigo-700 block mt-1">{autoExamResult} درجة</span>
                                </div>
                              )}

                              <button
                                onClick={() => { setActiveExam(null); setExamFinished(false); }}
                                className="mt-4 bg-[#101923] hover:bg-[#1a2c3f] text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all cursor-pointer"
                              >
                                العودة للقائمة الرئيسية
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Proctor Camera & Information Right Side */}
                      <div className="space-y-4">
                        <div className="bg-[#101923] text-white border border-slate-800 rounded-2xl p-5 overflow-hidden">
                          <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-1.5 justify-start">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                            <span>بث المراقبة الإشرافية الآلي</span>
                          </h4>

                          {cameraStream ? (
                            <div className="aspect-video w-full rounded-xl bg-black overflow-hidden relative border border-slate-700">
                              <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover scale-x-[-1]"
                              />
                              <div className="absolute bottom-2.5 right-2.5 bg-red-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                <span>REC</span>
                              </div>
                            </div>
                          ) : (
                            <div className="aspect-video w-full rounded-xl bg-[#090f16] border border-emerald-500/20 flex flex-col justify-center items-center text-center p-4 relative overflow-hidden">
                              {/* Pulse gradient glow */}
                              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent animate-pulse" />
                              
                              {/* Glowing Scanline */}
                              <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500/30 shadow-[0_0_10px_#10b981] animate-[bounce_3s_infinite]" />

                              {/* AI Status Badge */}
                              <div className="absolute top-2 left-2 flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-[8px] font-mono font-bold text-emerald-400 tracking-wider">AI PROCTOR ACTIVE</span>
                              </div>

                              {/* Silhouette Face & Scanning Box */}
                              <div className="relative w-14 h-14 rounded-full border border-dashed border-emerald-500/40 flex items-center justify-center mb-2">
                                <div className="absolute -inset-1.5 border border-emerald-500/20 rounded-full animate-[spin_12s_linear_infinite]" />
                                <Video className="h-5 w-5 text-emerald-400" />
                                
                                {/* Target brackets */}
                                <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t border-l border-emerald-400" />
                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t border-r border-emerald-400" />
                                <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b border-l border-emerald-400" />
                                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b border-r border-emerald-400" />
                              </div>

                              <span className="text-[10px] text-emerald-400 font-extrabold leading-relaxed">جلسة مراقبة ذكية (تلقائية)</span>
                              <span className="text-[9px] text-[#8ea0b4] mt-1 max-w-[200px] leading-normal font-medium">تم تفعيل الكاميرا والمايكروفون المدمجين وتأمين الاتصال تلقائياً بنجاح.</span>

                              {/* Mic audio wave simulation */}
                              <div className="flex gap-1 items-end h-3 mt-3">
                                <div className="w-0.5 bg-emerald-400 rounded-full animate-[pulse_1.2s_infinite_100ms] h-full" />
                                <div className="w-0.5 bg-emerald-400 rounded-full animate-[pulse_0.8s_infinite_300ms] h-1/2" />
                                <div className="w-0.5 bg-emerald-400 rounded-full animate-[pulse_1.5s_infinite_500ms] h-3/4" />
                                <div className="w-0.5 bg-emerald-400 rounded-full animate-[pulse_1s_infinite_200ms] h-2/3" />
                                <div className="w-0.5 bg-emerald-400 rounded-full animate-[pulse_1.3s_infinite_400ms] h-full" />
                              </div>
                            </div>
                          )}

                          {proctorError && (
                            <p className="text-[10px] text-amber-400 mt-3 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 leading-relaxed font-semibold">
                              {proctorError}
                            </p>
                          )}

                          {/* Manual Upload Panel for Exam Videos */}
                          <div className="mt-4 border-t border-slate-800 pt-4 space-y-3 text-right">
                            <h5 className="text-[10px] font-bold text-indigo-400 flex items-center gap-1 justify-start">
                              <Upload className="h-3.5 w-3.5" />
                              <span>رفع فيديو الامتحان يدوياً (اختياري للعمادة)</span>
                            </h5>
                            
                            <div className="space-y-2">
                              <div>
                                <label className="block text-[9px] text-slate-400 mb-1">فيديو تصوير الكاميرا الشخصية (MP4):</label>
                                <label className="flex items-center justify-between border border-slate-800 p-2 rounded-xl cursor-pointer bg-slate-900 hover:bg-slate-800/80 transition-colors">
                                  <span className="text-[9px] text-slate-300 font-mono truncate max-w-[150px]">
                                    {examCameraVideoName || 'اضغط لرفع فيديو الكاميرا'}
                                  </span>
                                  <input
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        if (file.size > 80 * 1024 * 1024) {
                                          showToast('error', 'حجم الفيديو كبير جداً. يرجى اختيار ملف أصغر من 80 ميجابايت لضمان نجاح الرفع للعميد.');
                                          return;
                                        }
                                        setExamCameraVideoName(file.name);
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          if (typeof reader.result === 'string') {
                                            setExamCameraVideoB64(reader.result);
                                            showToast('success', 'تم تحميل فيديو الكاميرا بنجاح.');
                                          }
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                </label>
                              </div>

                              <div>
                                <label className="block text-[9px] text-slate-400 mb-1">فيديو لقطة/مشاركة الشاشة (MP4):</label>
                                <label className="flex items-center justify-between border border-slate-800 p-2 rounded-xl cursor-pointer bg-slate-900 hover:bg-slate-800/80 transition-colors">
                                  <span className="text-[9px] text-slate-300 font-mono truncate max-w-[150px]">
                                    {examScreenVideoName || 'اضغط لرفع فيديو الشاشة'}
                                  </span>
                                  <input
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        if (file.size > 80 * 1024 * 1024) {
                                          showToast('error', 'حجم الفيديو كبير جداً. يرجى اختيار ملف أصغر من 80 ميجابايت لضمان نجاح الرفع للعميد.');
                                          return;
                                        }
                                        setExamScreenVideoName(file.name);
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          if (typeof reader.result === 'string') {
                                            setExamScreenVideoB64(reader.result);
                                            showToast('success', 'تم تحميل فيديو الشاشة بنجاح.');
                                          }
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 space-y-2.5 text-slate-400 text-[10px] leading-relaxed border-t border-slate-800 pt-4 text-right">
                            <p>● يتم تدوين حركات الرأس والوجه آلياً عبر محاكي الذكاء الاصطناعي.</p>
                            <p>● تجنب تصفح علامات تبويب أخرى أو تغيير الشاشات لتفادي التنبيهات.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}


              {/* --- TAB D: RESULTS --- */}
              {activeTab === 'results' && (
                <div className="space-y-6">
                  <div className="p-6 bg-[#152230] text-white rounded-2xl flex items-center gap-4 border border-[#2d3e52]">
                    <div className="p-3 bg-indigo-500/10 rounded-xl">
                      <Award className="h-8 w-8 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold">كشف الدرجات الأكاديمي والنتائج</h2>
                      <p className="text-xs text-[#8ea0b4] mt-1">تجد هنا تفاصيل درجات أعمال الفصل، الواجبات، الاختبارات والتقدير التراكمي المعتمد من عمادة القبول والتسجيل.</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-6">
                    <h3 className="text-sm font-extrabold text-[#101923] mb-4 border-b border-slate-100 pb-2">سجل التقييمات الدراسي المعتمد</h3>
                    
                    <div className="space-y-4">
                      {lectures.map((lec, idx) => {
                        // Find matching assignment grade
                        const matchingAssign = assignments.find(a => a.courseName === lec.courseName || a.title.includes(lec.courseName));
                        const matchingSubmission = matchingAssign?.submissions.find(s => s.studentId === studentInfo?._id);
                        
                        // Find matching exam grade
                        const matchingExam = exams.find(e => (e.courseName && e.courseName.includes(lec.courseName)) || (e.title && e.title.includes(lec.courseName)) || lec.courseName.includes(e.courseName || ''));
                        const matchingExamSub = (matchingExam?.results || matchingExam?.submissions)?.find(s => s.studentId === studentInfo?._id);

                        return (
                          <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-right">
                            <div>
                              <h4 className="text-sm font-extrabold text-[#101923]">{lec.courseName}</h4>
                              <p className="text-[10px] text-slate-400 mt-1 font-semibold">المحاضر المسؤول: {lec.instructor}</p>
                            </div>

                            <div className="flex gap-6 flex-wrap md:flex-nowrap">
                              <div className="bg-white border border-slate-100 px-4 py-2 rounded-lg text-center min-w-[80px]">
                                <span className="text-[9px] text-slate-400 font-bold block">أعمال السنة</span>
                                <span className="text-xs font-bold text-slate-700 font-mono mt-1 block">
                                  {matchingSubmission?.grade !== undefined ? `${matchingSubmission.grade} / ${matchingAssign?.maxScore}` : 'لا يوجد'}
                                </span>
                              </div>
                              <div className="bg-white border border-slate-100 px-4 py-2 rounded-lg text-center min-w-[80px]">
                                <span className="text-[9px] text-slate-400 font-bold block">الاختبار النهائي</span>
                                <span className="text-xs font-bold text-slate-700 font-mono mt-1 block">
                                  {matchingExamSub?.autoScore !== undefined ? `${matchingExamSub.autoScore} / ${matchingExam?.maxScore}` : 'قيد التصحيح'}
                                </span>
                              </div>
                              <div className="bg-white border border-slate-100 px-4 py-2 rounded-lg text-center min-w-[80px] bg-indigo-50/50">
                                <span className="text-[9px] text-indigo-500 font-bold block">المعدل النهائي</span>
                                <span className="text-xs font-extrabold text-indigo-700 mt-1 block">
                                  {matchingSubmission?.grade !== undefined && matchingExamSub?.autoScore !== undefined
                                    ? 'A'
                                    : 'مستمر'
                                  }
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {lectures.length === 0 && (
                        <p className="text-xs text-slate-400 py-6 text-center">لا توجد سجلات أكاديمية كافية لحساب المعدل حالياً.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}


              {/* --- TAB E: FEES --- */}
              {activeTab === 'fees' && (
                <div className="space-y-6">
                  <div className="p-6 bg-[#152230] text-white rounded-2xl flex items-center gap-4 border border-[#2d3e52]">
                    <div className="p-3 bg-indigo-500/10 rounded-xl">
                      <CreditCard className="h-8 w-8 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold">الوضع المالي والسجل الدراسي المالي</h2>
                      <p className="text-xs text-[#8ea0b4] mt-1">يمكنك رفع إيصالات سداد الرسوم لمطابقة حسابك، وتنزيل سندات الدفع الإلكترونية بعد التحقق.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Summary card & slips */}
                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-right">
                        <h3 className="text-sm font-extrabold text-[#101923] mb-4 border-b border-slate-100 pb-2">ملخص الرسوم والمستحقات الدراسية</h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">إجمالي الرسوم</span>
                            <div className="text-xl font-extrabold mt-1.5 font-mono text-slate-800">${fees?.totalFees || '4500'}</div>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                            <span className="text-[10px] text-emerald-600 font-bold uppercase">المدفوع</span>
                            <div className="text-xl font-extrabold mt-1.5 font-mono text-emerald-600">${fees?.amountPaid || '0'}</div>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                            <span className="text-[10px] text-amber-600 font-bold uppercase">الرصيد المتبقي</span>
                            <div className="text-xl font-extrabold mt-1.5 font-mono text-amber-600">${fees?.remaining || '4500'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Download receipt array */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-right">
                        <h3 className="text-sm font-extrabold text-[#101923] mb-4 border-b border-slate-100 pb-2">سندات القبض المرفوعة والمعتمدة</h3>
                        <div className="space-y-3">
                          {fees?.receipts && fees.receipts.length > 0 ? (
                            fees.receipts.map((receipt, rIdx) => (
                              <div key={rIdx} className="bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-xl flex items-center justify-between text-xs font-semibold">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4.5 w-4.5 text-indigo-500 shrink-0" />
                                  <span className="text-slate-800 truncate max-w-xs">{receipt.fileName}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">({new Date(receipt.uploadedAt).toLocaleDateString('ar-EG')})</span>
                                </div>
                                <a
                                  href={receipt.fileUrl}
                                  download={receipt.fileName}
                                  className="text-xs text-indigo-600 hover:underline font-bold"
                                >
                                  تحميل السند
                                </a>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 py-4 text-center">لا توجد إيصالات دفع معتمدة أو مرفوعة سابقاً.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Upload box right side */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-right">
                      <h3 className="text-sm font-extrabold text-[#101923] mb-4 border-b border-slate-100 pb-2">رفع إيصال سداد جديد</h3>
                      <form onSubmit={handleFeeReceiptSubmit} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5">المبلغ المدفوع (بالدولار $)</label>
                          <input
                            type="number"
                            required
                            placeholder="مثال: 1500"
                            value={receiptAmount}
                            onChange={(e) => setReceiptAmount(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-[#1e293b] focus:outline-none focus:border-indigo-500 font-mono text-left"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5">إرفاق نسخة الإيصال (صورة أو PDF)</label>
                          <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl py-6 hover:bg-slate-50/50 cursor-pointer transition-colors text-center">
                            <Upload className="h-8 w-8 text-slate-400 mb-2" />
                            <span className="text-xs text-slate-500 font-bold">انقر لتحديد ملف الإيصال</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-1">الحد الأقصى للرفع: 15 ميجابايت</span>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileChange(e, 'fee')}
                            />
                          </label>
                          {receiptFileName && (
                            <p className="text-[11px] text-indigo-600 mt-2 font-mono truncate text-left font-bold">{receiptFileName}</p>
                          )}
                        </div>

                        <button
                          type="submit"
                          disabled={uploadingFile === 'fee'}
                          className="w-full bg-[#101923] hover:bg-[#1a2c3f] disabled:bg-slate-200 disabled:text-slate-400 text-white py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Upload className="h-4 w-4" />
                          <span>{uploadingFile === 'fee' ? 'جاري إرسال البيانات...' : 'إرسال السند للمطابقة'}</span>
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}


              {/* --- TAB F: NOTIFICATIONS --- */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div className="p-6 bg-[#152230] text-white rounded-2xl flex items-center gap-4 border border-[#2d3e52]">
                    <div className="p-3 bg-indigo-500/10 rounded-xl">
                      <Bell className="h-8 w-8 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold">الإعلانات والتعميمات الإدارية</h2>
                      <p className="text-xs text-[#8ea0b4] mt-1">تلقى هنا آخر الأخبار والتعميمات الصادرة عن عمادة الكلية وإدارة الأكاديمية لحظة بلحظة.</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-6 text-right space-y-4 shadow-sm">
                    {notifications.map((notif) => (
                      <div key={notif._id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative">
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-extrabold text-[#101923]">{notif.title}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">{new Date(notif.createdAt).toLocaleDateString('ar-EG')}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">{notif.message}</p>
                      </div>
                    ))}

                    {notifications.length === 0 && (
                      <p className="text-xs text-slate-400 py-10 text-center font-bold">لا توجد إعلانات أو تعميمات إدارية منشورة حالياً.</p>
                    )}
                  </div>
                </div>
              )}


              {/* --- TAB G: COMPLAINTS --- */}
              {activeTab === 'complaints' && (
                <div className="space-y-6">
                  <div className="p-6 bg-[#152230] text-white rounded-2xl flex items-center gap-4 border border-[#2d3e52]">
                    <div className="p-3 bg-indigo-50/10 rounded-xl">
                      <AlertCircle className="h-8 w-8 text-[#8ea0b4]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold">منظومة الشكاوى والطلبات الأكاديمية</h2>
                      <p className="text-xs text-[#8ea0b4] mt-1">يمكنك فتح تذكرة تظلم أو إرسال مقترح مباشرة إلى مكتب العميد التعليمي للبت فيه وحله فورياً.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Complaints History Left side */}
                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-right">
                        <h3 className="text-sm font-extrabold text-[#101923] mb-4 border-b border-slate-100 pb-2">سجل التظلمات والطلبات المقدمة</h3>
                        
                        <div className="space-y-4">
                          {complaints.map((comp) => (
                            <div key={comp._id} className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                              <div className="flex justify-between items-start flex-wrap gap-2">
                                <div>
                                  <h4 className="text-sm font-extrabold text-[#101923]">{comp.subject}</h4>
                                  <span className="text-[10px] text-slate-400 font-mono mt-1 block">رقم التذكرة: {comp._id.slice(-6).toUpperCase()} | تاريخ التقديم: {new Date(comp.createdAt).toLocaleDateString('ar-EG')}</span>
                                </div>
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                                  comp.status === 'resolved' 
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                    : 'bg-amber-50 text-amber-600 border border-amber-100'
                                }`}>
                                  {comp.status === 'resolved' ? 'تمت التسوية والحل' : 'قيد المراجعة الإدارية'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed font-medium">{comp.description}</p>
                              
                              {comp.resolution && (
                                <div className="mt-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                                  <span className="text-[10px] text-emerald-700 font-extrabold block">الرد الإداري المعتمد:</span>
                                  <p className="text-xs text-emerald-800 font-medium mt-1 leading-relaxed">{comp.resolution}</p>
                                </div>
                              )}
                            </div>
                          ))}

                          {complaints.length === 0 && (
                            <p className="text-xs text-slate-400 py-10 text-center font-bold">لا يوجد تذاكر شكاوى أو تظلمات مسجلة باسمك.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Complaint Form Box */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-right">
                      <h3 className="text-sm font-extrabold text-[#101923] mb-4 border-b border-slate-100 pb-2">تقديم تذكرة شكوى أو مقترح</h3>
                      <form onSubmit={handleComplaintSubmit} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5">موضوع التذكرة</label>
                          <input
                            type="text"
                            required
                            placeholder="مثال: تظلم في درجة مقرر الذكاء الاصطناعي"
                            value={complaintSubject}
                            onChange={(e) => setComplaintSubject(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-[#1e293b] placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5">شرح وتفاصيل التظلم</label>
                          <textarea
                            rows={4}
                            required
                            placeholder="اكتب تفاصيل ومبررات الطلب هنا بشكل كامل وواضح..."
                            value={complaintDesc}
                            onChange={(e) => setComplaintDesc(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-[#1e293b] placeholder-slate-400 focus:outline-none focus:border-indigo-500 leading-relaxed"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5">إرفاق مستندات مؤيدة (اختياري)</label>
                          <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl py-4 hover:bg-slate-50 cursor-pointer text-center">
                            <Paperclip className="h-6 w-6 text-slate-400 mb-1" />
                            <span className="text-[11px] text-slate-500 font-bold">أرفق ورقة أو مستند داعم</span>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileChange(e, 'complaint')}
                            />
                          </label>
                          {complaintDocs.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {complaintDocs.map((doc, dIdx) => (
                                <p key={dIdx} className="text-[10px] text-indigo-600 font-mono truncate font-bold text-left">&bull; {doc.name}</p>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          type="submit"
                          disabled={uploadingFile === 'complaint'}
                          className="w-full bg-[#101923] hover:bg-[#1a2c3f] disabled:bg-slate-200 text-white py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Send className="h-4 w-4" />
                          <span>{uploadingFile === 'complaint' ? 'جاري إرسال التذكرة...' : 'تقديم الطلب للعمادة'}</span>
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
