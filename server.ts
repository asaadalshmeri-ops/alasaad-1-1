import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { dbStore } from './src/db/dbStore.js';
import { User, Student, Department, Lecture, Assignment, Exam, Fee, Notification, Complaint, ExamQuestion, ExamResult } from './src/types.js';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-lms-jwt-token-key-2026';

// Initialize Gemini AI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Body size limit increased to handle base64 files (photos, documents, recordings)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// SSE Connections list for real-time synchronization
interface SSEClient {
  id: string;
  res: Response;
}
let sseClients: SSEClient[] = [];

// Helper to broadcast refresh event to all connected clients
function broadcastEvent(type: string, data: any = {}) {
  const payload = JSON.stringify({ type, data });
  sseClients.forEach(client => {
    client.res.write(`data: ${payload}\n\n`);
  });
}

// SSE Connection endpoint
app.get('/api/events', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const clientId = Date.now().toString();
  const newClient: SSEClient = { id: clientId, res };
  sseClients.push(newClient);

  req.on('close', () => {
    sseClients = sseClients.filter(client => client.id !== clientId);
  });
});

// Authentication middleware
interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    role: 'admin' | 'student';
    name: string;
    email: string;
    studentId?: string; // only if student
  };
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }
    req.user = user;
    next();
  });
}

function requireRole(role: 'admin' | 'student') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({ error: 'Unauthorized access for this role' });
      return;
    }
    next();
  };
}

// --- AUTHENTICATION API ---

// Login endpoint
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { loginId, password, role } = req.body; // loginId can be email (admin) or Academic ID (student)

  if (!loginId || (!password && role !== 'student')) {
    res.status(400).json({ error: 'Missing login ID or password' });
    return;
  }

  const users = dbStore.getUsers();
  
  if (role === 'admin') {
    // Admin login using email
    const adminUser = users.find(u => u.email.toLowerCase() === loginId.toLowerCase() && u.role === 'admin');
    if (!adminUser) {
      res.status(401).json({ error: 'Admin account not found' });
      return;
    }
    const match = bcrypt.compareSync(password, adminUser.passwordHash);
    if (!match) {
      res.status(401).json({ error: 'Incorrect password' });
      return;
    }

    const token = jwt.sign(
      { _id: adminUser._id, role: 'admin', name: adminUser.name, email: adminUser.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        _id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: 'admin'
      }
    });
  } else {
    // Real Student login using Academic ID & password
    const students = dbStore.getStudents();
    const student = students.find(s => s.academicId === loginId);
    
    if (!student) {
      res.status(401).json({ error: 'الرقم الأكاديمي غير مسجل بالنظام' });
      return;
    }

    const studentUser = users.find(u => u._id === student.userId);
    if (!studentUser) {
      res.status(404).json({ error: 'حساب الطالب غير موجود في النظام' });
      return;
    }

    // Check if first-time setup is needed
    if (!studentUser.passwordHash || studentUser.passwordHash === '') {
      res.json({
        firstTime: true,
        academicId: student.academicId
      });
      return;
    }

    // Standard password verification
    if (!password) {
      res.status(400).json({ error: 'يرجى إدخال كلمة المرور' });
      return;
    }

    const match = bcrypt.compareSync(password, studentUser.passwordHash);
    if (!match) {
      res.status(401).json({ error: 'كلمة المرور المدخلة غير صحيحة' });
      return;
    }

    const token = jwt.sign(
      { 
        _id: studentUser._id, 
        role: 'student', 
        name: studentUser.name, 
        email: studentUser.email,
        studentId: student._id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        _id: studentUser._id,
        name: studentUser.name,
        email: studentUser.email,
        role: 'student',
        studentId: student._id,
        academicId: student.academicId,
        departmentId: student.departmentId,
        status: student.status,
        photo: student.photo
      }
    });
  }
});

// First-time student password setup
app.post('/api/auth/first-time-setup', (req: Request, res: Response) => {
  const { academicId, password } = req.body;

  if (!academicId || !password) {
    res.status(400).json({ error: 'Academic ID and Password are required' });
    return;
  }

  const students = dbStore.getStudents();
  const student = students.find(s => s.academicId === academicId);

  if (!student) {
    res.status(404).json({ error: 'Academic ID not found' });
    return;
  }

  const users = dbStore.getUsers();
  const userIndex = users.findIndex(u => u._id === student.userId);

  if (userIndex === -1) {
    res.status(404).json({ error: 'User record not found for student' });
    return;
  }

  // Set the password hash
  const salt = bcrypt.genSaltSync(10);
  users[userIndex].passwordHash = bcrypt.hashSync(password, salt);
  dbStore.saveUsers(users);

  const token = jwt.sign(
    { 
      _id: users[userIndex]._id, 
      role: 'student', 
      name: users[userIndex].name, 
      email: users[userIndex].email,
      studentId: student._id
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  broadcastEvent('student_password_setup', { academicId });

  res.json({
    success: true,
    token,
    user: {
      _id: users[userIndex]._id,
      name: users[userIndex].name,
      email: users[userIndex].email,
      role: 'student',
      studentId: student._id,
      academicId: student.academicId,
      departmentId: student.departmentId,
      status: student.status,
      photo: student.photo
    }
  });
});


// --- GITHUB OAUTH API ---

app.get('/api/auth/github/url', (req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID || 'dummy_client_id';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const redirectUri = `${protocol}://${req.get('host')}/auth/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  res.json({ url });
});

app.get(['/auth/callback', '/auth/callback/'], async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) {
    res.status(400).send('Missing authorization code');
    return;
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId === 'MY_GITHUB_CLIENT_ID' || clientSecret === 'MY_GITHUB_CLIENT_SECRET') {
    // If credentials are not set yet, fallback to a wonderful simulated mock GitHub login to let user test and preview instantly!
    console.log('[GITHUB] Client ID or Secret not set. Falling back to Mock GitHub User for instant preview.');
    
    // Let's find "اسعد الشميري" or another registered student
    const students = dbStore.getStudents();
    const targetStudent = students.find(s => s.fullName.firstName === 'اسعد') || students[0];
    const users = dbStore.getUsers();
    const targetUser = users.find(u => u._id === targetStudent.userId) || users[0];
    
    const token = jwt.sign(
      { 
        _id: targetUser._id, 
        role: targetUser.role, 
        name: targetUser.name, 
        email: targetUser.email,
        studentId: targetStudent._id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const fullUserPayload = {
      _id: targetUser._id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      studentId: targetStudent._id,
      academicId: targetStudent.academicId,
      departmentId: targetStudent.departmentId,
      status: targetStudent.status,
      photo: targetStudent.photo
    };

    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #101923; color: white;">
          <div style="text-align: center; max-width: 400px; padding: 25px; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; background: rgba(255,255,255,0.05); box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <h3 style="color: #10b981; margin-bottom: 12px;">✓ تم الاتصال بمحاكي GitHub بنجاح!</h3>
            <p style="font-size: 13px; color: #94a3b8; line-height: 1.6;">تم محاكاة تسجيل الدخول بحساب GitHub بنجاح. سيتم توجيهك إلى واجهتك الأكاديمية خلال ثوانٍ.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  token: '${token}', 
                  user: ${JSON.stringify(fullUserPayload)} 
                }, '*');
                setTimeout(() => window.close(), 1500);
              } else {
                window.location.href = '/';
              }
            </script>
          </div>
        </body>
      </html>
    `);
    return;
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });

    const tokenData: any = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error(tokenData.error_description || 'Failed to exchange authorization code for access token.');
    }

    // Fetch user profile from GitHub
    const userProfileResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'User-Agent': 'Ais-LMS-Platform'
      }
    });
    const githubUser: any = await userProfileResponse.json();

    let email = githubUser.email;
    if (!email) {
      // Fetch private emails
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `token ${accessToken}`,
          'User-Agent': 'Ais-LMS-Platform'
        }
      });
      const emails: any = await emailsResponse.json();
      if (Array.isArray(emails)) {
        const primaryEmail = emails.find((e: any) => e.primary);
        email = primaryEmail ? primaryEmail.email : (emails[0]?.email || null);
      }
    }

    const users = dbStore.getUsers();
    let user = users.find(u => u.email === email || u.githubId === githubUser.id);
    let studentRecord: any = null;

    if (!user) {
      // Auto-create registered user
      const newUserId = `user_${Date.now()}`;
      user = {
        _id: newUserId,
        name: githubUser.name || githubUser.login,
        email: email || `${githubUser.login}@github.com`,
        role: 'student',
        passwordHash: '',
        githubId: githubUser.id
      };
      users.push(user);
      dbStore.saveUsers(users);

      const students = dbStore.getStudents();
      studentRecord = {
        _id: `student_${Date.now()}`,
        userId: newUserId,
        fullName: {
          firstName: githubUser.name?.split(' ')[0] || githubUser.login,
          middleName: '',
          lastName: githubUser.name?.split(' ').slice(1).join(' ') || '',
          familyName: ''
        },
        academicId: `2026${Math.floor(10000 + Math.random() * 90000)}`,
        photo: githubUser.avatar_url || '',
        documents: [],
        departmentId: 'dept_cs',
        status: 'Active',
        createdAt: new Date().toISOString()
      };
      students.push(studentRecord);
      dbStore.saveStudents(students);

      // Create tuition fees
      const fees = dbStore.getFees();
      fees.push({
        _id: `fee_${Date.now()}`,
        studentId: studentRecord._id,
        semester: 'Fall 2026',
        totalFees: 4500,
        amountPaid: 0,
        remaining: 4500,
        receipts: []
      });
      dbStore.saveFees(fees);
    } else {
      const students = dbStore.getStudents();
      studentRecord = students.find(s => s.userId === user!._id);
    }

    const token = jwt.sign(
      { 
        _id: user._id, 
        role: user.role, 
        name: user.name, 
        email: user.email,
        studentId: studentRecord?._id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const fullUserPayload = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: studentRecord?._id,
      academicId: studentRecord?.academicId,
      departmentId: studentRecord?.departmentId,
      status: studentRecord?.status,
      photo: studentRecord?.photo
    };

    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #101923; color: white;">
          <div style="text-align: center; max-width: 400px; padding: 25px; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; background: rgba(255,255,255,0.05); box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <h3 style="color: #10b981; margin-bottom: 12px;">✓ تم تسجيل الدخول بنجاح!</h3>
            <p style="font-size: 13px; color: #94a3b8; line-height: 1.6;">جاري توجيهك إلى لوحتك التعليمية...</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  token: '${token}', 
                  user: ${JSON.stringify(fullUserPayload)} 
                }, '*');
                setTimeout(() => window.close(), 1000);
              } else {
                window.location.href = '/';
              }
            </script>
          </div>
        </body>
      </html>
    `);

  } catch (err: any) {
    console.error('[GITHUB OAUTH EXCEPTION]:', err);
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #101923; color: white;">
          <div style="text-align: center; max-width: 400px; padding: 25px; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 16px; background: rgba(239,68,68,0.05); box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <h3 style="color: #ef4444; margin-bottom: 12px;">✗ فشل تسجيل الدخول عبر GitHub</h3>
            <p style="font-size: 13px; color: #94a3b8; line-height: 1.6;">${err.message || String(err)}</p>
            <button onclick="window.close()" style="margin-top: 15px; background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer;">إغلاق</button>
          </div>
        </body>
      </html>
    `);
  }
});


// --- ADMIN STUDENT MANAGEMENT ---

// Register student
app.post('/api/admin/students', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { firstName, middleName, lastName, familyName, email, departmentId, photo, documents } = req.body;

  if (!firstName || !lastName || !familyName || !email || !departmentId) {
    res.status(400).json({ error: 'Missing required registration details' });
    return;
  }

  const users = dbStore.getUsers();
  const students = dbStore.getStudents();

  // Check if email already registered
  const emailExists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
  if (emailExists) {
    res.status(400).json({ error: 'Email already registered' });
    return;
  }

  // Generate unique Academic ID in format YYYYXXXXX
  const currentYear = new Date().getFullYear().toString();
  const yearStudents = students.filter(s => s.academicId.startsWith(currentYear));
  let nextSeq = 1;
  if (yearStudents.length > 0) {
    const seqs = yearStudents.map(s => parseInt(s.academicId.substring(4)));
    nextSeq = Math.max(...seqs) + 1;
  }
  const seqString = nextSeq.toString().padStart(5, '0');
  const academicId = `${currentYear}${seqString}`;

  // Create User
  const userId = `user_${Date.now()}`;
  const newUser: User = {
    _id: userId,
    name: `${firstName} ${lastName}`,
    email: email.toLowerCase(),
    role: 'student',
    passwordHash: '' // Empty means first login sets password
  };

  // Create Student profile
  const studentId = `student_${Date.now()}`;
  const newStudent: Student = {
    _id: studentId,
    userId,
    fullName: {
      firstName,
      middleName: middleName || '',
      lastName,
      familyName
    },
    academicId,
    photo: photo || '',
    documents: documents || [],
    departmentId,
    status: 'Active',
    createdAt: new Date().toISOString()
  };

  // Create empty Fee structure for student
  const fees = dbStore.getFees();
  const newFee: Fee = {
    _id: `fee_${Date.now()}`,
    studentId,
    semester: 'Fall 2026',
    totalFees: 4500, // standard default
    amountPaid: 0,
    remaining: 4500,
    receipts: []
  };

  users.push(newUser);
  students.push(newStudent);
  fees.push(newFee);

  dbStore.saveUsers(users);
  dbStore.saveStudents(students);
  dbStore.saveFees(fees);

  broadcastEvent('student_registered', { studentId, academicId });

  res.status(201).json({ success: true, student: newStudent, academicId });
});

// Student Profile API (for students to view their own profile)
app.get('/api/students/profile', authenticateToken, requireRole('student'), (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !req.user.studentId) {
    res.status(400).json({ error: 'Student ID not found in session' });
    return;
  }
  const students = dbStore.getStudents();
  const student = students.find(s => s._id === req.user!.studentId);
  if (!student) {
    res.status(404).json({ error: 'Student profile not found' });
    return;
  }
  res.json(student);
});

// Search / list students
app.get('/api/admin/students', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { search } = req.query;
  const students = dbStore.getStudents();
  const users = dbStore.getUsers();

  let filtered = students;
  if (search) {
    const query = (search as string).toLowerCase();
    filtered = students.filter(s => {
      const u = users.find(user => user._id === s.userId);
      const emailMatch = u ? u.email.toLowerCase().includes(query) : false;
      const idMatch = s.academicId.includes(query);
      const nameMatch = `${s.fullName.firstName} ${s.fullName.middleName} ${s.fullName.lastName} ${s.fullName.familyName}`.toLowerCase().includes(query);
      return idMatch || nameMatch || emailMatch;
    });
  }

  res.json(filtered);
});

// View / Edit / Delete Student
app.get('/api/admin/students/:id', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const students = dbStore.getStudents();
  const student = students.find(s => s._id === req.params.id);
  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }
  const users = dbStore.getUsers();
  const user = users.find(u => u._id === student.userId);

  res.json({ ...student, email: user?.email || '' });
});

app.put('/api/admin/students/:id', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { firstName, middleName, lastName, familyName, email, departmentId, status, photo, documents } = req.body;
  const students = dbStore.getStudents();
  const studentIndex = students.findIndex(s => s._id === req.params.id);

  if (studentIndex === -1) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  const student = students[studentIndex];
  const users = dbStore.getUsers();
  const userIndex = users.findIndex(u => u._id === student.userId);

  if (userIndex !== -1) {
    if (email) users[userIndex].email = email.toLowerCase();
    if (firstName && lastName) users[userIndex].name = `${firstName} ${lastName}`;
    dbStore.saveUsers(users);
  }

  students[studentIndex] = {
    ...student,
    fullName: {
      firstName: firstName || student.fullName.firstName,
      middleName: middleName || student.fullName.middleName,
      lastName: lastName || student.fullName.lastName,
      familyName: familyName || student.fullName.familyName
    },
    departmentId: departmentId || student.departmentId,
    status: status || student.status,
    photo: photo !== undefined ? photo : student.photo,
    documents: documents !== undefined ? documents : student.documents
  };

  dbStore.saveStudents(students);
  broadcastEvent('student_updated', { studentId: req.params.id });

  res.json({ success: true, student: students[studentIndex] });
});

app.delete('/api/admin/students/:id', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const students = dbStore.getStudents();
  const student = students.find(s => s._id === req.params.id);

  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  const updatedStudents = students.filter(s => s._id !== req.params.id);
  const users = dbStore.getUsers().filter(u => u._id !== student.userId);
  const fees = dbStore.getFees().filter(f => f.studentId !== req.params.id);

  dbStore.saveStudents(updatedStudents);
  dbStore.saveUsers(users);
  dbStore.saveFees(fees);

  broadcastEvent('student_deleted', { studentId: req.params.id });

  res.json({ success: true, message: 'Student deleted successfully' });
});


// --- DEPARTMENTS API ---
app.get('/api/departments', authenticateToken, (req: Request, res: Response) => {
  res.json(dbStore.getDepartments());
});


// --- LECTURES API ---

// Get lectures for a department
app.get('/api/departments/:deptId/lectures', authenticateToken, (req: Request, res: Response) => {
  const lectures = dbStore.getLectures();
  let filtered = lectures.filter(l => l.departmentId === req.params.deptId);
  
  // Guarantee trial lecture is available for every department so any student can preview it
  if (!filtered.some(l => l._id === 'lec_1')) {
    const trialLec = lectures.find(l => l._id === 'lec_1');
    if (trialLec) {
      filtered = [{ ...trialLec, departmentId: req.params.deptId }, ...filtered];
    }
  }
  res.json(filtered);
});

// Add lecture
app.post('/api/departments/:deptId/lectures', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { courseName, lectureNumber, instructor, youtubeLink, pdfContent, diagrams } = req.body;

  if (!courseName || !lectureNumber || !instructor) {
    res.status(400).json({ error: 'Missing lecture required fields' });
    return;
  }

  const lectures = dbStore.getLectures();
  const newLecture: Lecture = {
    _id: `lec_${Date.now()}`,
    departmentId: req.params.deptId,
    courseName,
    lectureNumber: parseInt(lectureNumber),
    instructor,
    youtubeLink: youtubeLink || '',
    pdfContent: pdfContent || '',
    diagrams: diagrams || [],
    attendance: []
  };

  lectures.push(newLecture);
  dbStore.saveLectures(lectures);

  broadcastEvent('lecture_added', { departmentId: req.params.deptId });

  res.status(201).json({ success: true, lecture: newLecture });
});

// Update lecture
app.put('/api/lectures/:id', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const lectures = dbStore.getLectures();
  const index = lectures.findIndex(l => l._id === req.params.id);

  if (index === -1) {
    res.status(404).json({ error: 'Lecture not found' });
    return;
  }

  const { courseName, lectureNumber, instructor, youtubeLink, pdfContent, diagrams, assignmentId } = req.body;

  lectures[index] = {
    ...lectures[index],
    courseName: courseName || lectures[index].courseName,
    lectureNumber: lectureNumber !== undefined ? parseInt(lectureNumber) : lectures[index].lectureNumber,
    instructor: instructor || lectures[index].instructor,
    youtubeLink: youtubeLink !== undefined ? youtubeLink : lectures[index].youtubeLink,
    pdfContent: pdfContent !== undefined ? pdfContent : lectures[index].pdfContent,
    diagrams: diagrams !== undefined ? diagrams : lectures[index].diagrams,
    assignmentId: assignmentId !== undefined ? assignmentId : lectures[index].assignmentId
  };

  dbStore.saveLectures(lectures);
  broadcastEvent('lecture_updated', { lectureId: req.params.id, departmentId: lectures[index].departmentId });

  res.json({ success: true, lecture: lectures[index] });
});

// Delete lecture
app.delete('/api/lectures/:id', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const lectures = dbStore.getLectures();
  const lecture = lectures.find(l => l._id === req.params.id);

  if (!lecture) {
    res.status(404).json({ error: 'Lecture not found' });
    return;
  }

  const updatedLectures = lectures.filter(l => l._id !== req.params.id);
  dbStore.saveLectures(updatedLectures);

  broadcastEvent('lecture_deleted', { lectureId: req.params.id, departmentId: lecture.departmentId });

  res.json({ success: true, message: 'Lecture deleted' });
});

// Record Student Lecture Attendance
app.post('/api/lectures/:id/attendance', authenticateToken, requireRole('student'), (req: AuthenticatedRequest, res: Response) => {
  const lectures = dbStore.getLectures();
  const index = lectures.findIndex(l => l._id === req.params.id);

  if (index === -1) {
    res.status(404).json({ error: 'Lecture not found' });
    return;
  }

  const studentId = req.user?.studentId;
  if (!studentId) {
    res.status(400).json({ error: 'Student ID not resolved' });
    return;
  }

  // Prevent duplicate attendance
  const alreadyAttended = lectures[index].attendance.some(a => a.studentId === studentId);
  if (!alreadyAttended) {
    lectures[index].attendance.push({
      studentId,
      timestamp: new Date().toISOString()
    });
    dbStore.saveLectures(lectures);
    broadcastEvent('attendance_marked', { lectureId: req.params.id, studentId });
  }

  res.json({ success: true, message: 'Attendance registered' });
});


// --- ASSIGNMENTS API ---

// Get assignments for a department
app.get('/api/departments/:deptId/assignments', authenticateToken, (req: Request, res: Response) => {
  const lectures = dbStore.getLectures();
  let deptLectures = lectures.filter(l => l.departmentId === req.params.deptId);
  if (!deptLectures.some(l => l._id === 'lec_1')) {
    const trialLec = lectures.find(l => l._id === 'lec_1');
    if (trialLec) {
      deptLectures = [{ ...trialLec, departmentId: req.params.deptId }, ...deptLectures];
    }
  }
  const lectureIds = deptLectures.map(l => l._id);
  const assignments = dbStore.getAssignments();
  let filteredAssignments = assignments.filter(a => lectureIds.includes(a.lectureId));
  
  if (!filteredAssignments.some(a => a._id === 'assign_1')) {
    const trialAssign = assignments.find(a => a._id === 'assign_1');
    if (trialAssign) {
      filteredAssignments = [trialAssign, ...filteredAssignments];
    }
  }
  res.json(filteredAssignments);
});

// Create assignment
app.post('/api/departments/:deptId/assignments', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { lectureId, title, description, dueDate } = req.body;

  if (!lectureId || !title || !dueDate) {
    res.status(400).json({ error: 'Missing assignment details' });
    return;
  }

  const assignments = dbStore.getAssignments();
  const newAssignment: Assignment = {
    _id: `assign_${Date.now()}`,
    lectureId,
    title,
    description: description || '',
    dueDate,
    submissions: []
  };

  assignments.push(newAssignment);
  dbStore.saveAssignments(assignments);

  // Link assignment to its lecture
  const lectures = dbStore.getLectures();
  const lIdx = lectures.findIndex(l => l._id === lectureId);
  if (lIdx !== -1) {
    lectures[lIdx].assignmentId = newAssignment._id;
    dbStore.saveLectures(lectures);
  }

  broadcastEvent('assignment_created', { departmentId: req.params.deptId });

  res.status(201).json({ success: true, assignment: newAssignment });
});

// Submit assignment
app.post('/api/assignments/:id/submit', authenticateToken, requireRole('student'), (req: AuthenticatedRequest, res: Response) => {
  const { fileUrl, fileName } = req.body;
  const studentId = req.user?.studentId;

  if (!fileUrl || !studentId) {
    res.status(400).json({ error: 'Missing submission files' });
    return;
  }

  const assignments = dbStore.getAssignments();
  const index = assignments.findIndex(a => a._id === req.params.id);

  if (index === -1) {
    res.status(404).json({ error: 'Assignment not found' });
    return;
  }

  // Remove existing student submission if any to allow re-submission
  const submissions = assignments[index].submissions.filter(s => s.studentId !== studentId);
  submissions.push({
    studentId,
    fileUrl,
    fileName: fileName || 'submission.pdf',
    submittedAt: new Date().toISOString()
  });

  assignments[index].submissions = submissions;
  dbStore.saveAssignments(assignments);

  broadcastEvent('assignment_submitted', { assignmentId: req.params.id, studentId });

  res.json({ success: true, message: 'Assignment submitted successfully' });
});

// Grade assignment
app.post('/api/assignments/:id/grade', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { studentId, grade } = req.body;

  if (!studentId || grade === undefined) {
    res.status(400).json({ error: 'Missing grading parameters' });
    return;
  }

  const assignments = dbStore.getAssignments();
  const aIdx = assignments.findIndex(a => a._id === req.params.id);

  if (aIdx === -1) {
    res.status(404).json({ error: 'Assignment not found' });
    return;
  }

  const subIdx = assignments[aIdx].submissions.findIndex(s => s.studentId === studentId);
  if (subIdx === -1) {
    res.status(404).json({ error: 'Submission not found' });
    return;
  }

  assignments[aIdx].submissions[subIdx].grade = parseFloat(grade);
  dbStore.saveAssignments(assignments);

  broadcastEvent('assignment_graded', { assignmentId: req.params.id, studentId });

  res.json({ success: true, message: 'Grade saved successfully' });
});


// --- EXAMS API ---

// List department exams
app.get('/api/departments/:deptId/exams', authenticateToken, (req: Request, res: Response) => {
  let exams = dbStore.getExams().filter(e => e.departmentId === req.params.deptId);
  const allExams = dbStore.getExams();
  
  if (!exams.some(e => e._id === 'exam_1')) {
    const trialExam1 = allExams.find(e => e._id === 'exam_1');
    if (trialExam1) {
      exams = [{ ...trialExam1, departmentId: req.params.deptId }, ...exams];
    }
  }
  if (!exams.some(e => e._id === 'exam_demo')) {
    const trialExamDemo = allExams.find(e => e._id === 'exam_demo');
    if (trialExamDemo) {
      exams = [{ ...trialExamDemo, departmentId: req.params.deptId }, ...exams];
    }
  }
  res.json(exams);
});

// Create exam
app.post('/api/departments/:deptId/exams', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { courseName, date, time, duration, questions } = req.body;

  if (!courseName || !date || !time || !duration || !questions) {
    res.status(400).json({ error: 'Missing exam creation parameters' });
    return;
  }

  const exams = dbStore.getExams();
  const newExam: Exam = {
    _id: `exam_${Date.now()}`,
    departmentId: req.params.deptId,
    courseName,
    date,
    time,
    duration: parseInt(duration),
    questions: questions.map((q: any, idx: number) => ({
      id: `q_${idx}_${Date.now()}`,
      type: q.type,
      questionText: q.questionText,
      options: q.options || [],
      correctAnswer: q.correctAnswer || ''
    })),
    results: [],
    resultsPublished: false
  };

  exams.push(newExam);
  dbStore.saveExams(exams);

  broadcastEvent('exam_created', { departmentId: req.params.deptId });

  res.status(201).json({ success: true, exam: newExam });
});

// Submit exam answers + recordings
app.post('/api/exams/:id/submit', authenticateToken, requireRole('student'), (req: AuthenticatedRequest, res: Response) => {
  const { answers, cameraRecording, screenRecording } = req.body;
  const studentId = req.user?.studentId;

  if (!studentId || !answers) {
    res.status(400).json({ error: 'Missing student credentials or answers' });
    return;
  }

  const exams = dbStore.getExams();
  const examIndex = exams.findIndex(e => e._id === req.params.id);

  if (examIndex === -1) {
    res.status(404).json({ error: 'Exam not found' });
    return;
  }

  const exam = exams[examIndex];

  // Auto grade MCQ questions
  let mcqScore = 0;
  let mcqCount = 0;
  let totalMcqMax = 0;

  exam.questions.forEach(q => {
    if (q.type === 'mcq') {
      mcqCount++;
      const studentAnsObj = answers.find((a: any) => a.questionId === q.id);
      if (studentAnsObj && studentAnsObj.answerText.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase()) {
        mcqScore++;
      }
    }
  });

  // Score represents the MCQ points right now. Essays require manual grading.
  // We can calculate starting score based on MCQs percentage or direct points.
  const initialScore = mcqCount > 0 ? (mcqScore / mcqCount) * 50 : 0; // standard out of 50 for now

  const newResult: ExamResult = {
    studentId,
    answers,
    score: initialScore, // will be final once admin grades essays
    cameraRecording: cameraRecording || '',
    screenRecording: screenRecording || '',
    submittedAt: new Date().toISOString()
  };

  // Remove previous result if exists
  const results = exam.results.filter(r => r.studentId !== studentId);
  results.push(newResult);
  exams[examIndex].results = results;

  dbStore.saveExams(exams);

  broadcastEvent('exam_submitted', { examId: req.params.id, studentId });

  res.json({
    success: true,
    message: 'Exam submitted successfully and recordings uploaded.',
    autoScore: mcqCount > 0 ? `${mcqScore}/${mcqCount} MCQs correct` : 'No MCQs'
  });
});

// Grade essay questions
app.post('/api/exams/:id/grade', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { studentId, finalScore } = req.body;

  if (!studentId || finalScore === undefined) {
    res.status(400).json({ error: 'Missing grading requirements' });
    return;
  }

  const exams = dbStore.getExams();
  const examIdx = exams.findIndex(e => e._id === req.params.id);

  if (examIdx === -1) {
    res.status(404).json({ error: 'Exam not found' });
    return;
  }

  const resIdx = exams[examIdx].results.findIndex(r => r.studentId === studentId);
  if (resIdx === -1) {
    res.status(404).json({ error: 'Student exam submission not found' });
    return;
  }

  exams[examIdx].results[resIdx].score = parseFloat(finalScore);
  dbStore.saveExams(exams);

  broadcastEvent('exam_graded', { examId: req.params.id, studentId });

  res.json({ success: true, message: 'Exam manually graded' });
});

// Publish exam results
app.post('/api/exams/:id/publish', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const exams = dbStore.getExams();
  const idx = exams.findIndex(e => e._id === req.params.id);

  if (idx === -1) {
    res.status(404).json({ error: 'Exam not found' });
    return;
  }

  exams[idx].resultsPublished = true;
  dbStore.saveExams(exams);

  broadcastEvent('exam_published', { examId: req.params.id });

  res.json({ success: true, message: 'Exam results published to student dashboards' });
});


// --- FEES API ---

// View fees for all students (Admin)
app.get('/api/admin/fees', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  res.json(dbStore.getFees());
});

// Get student fees
app.get('/api/students/:studentId/fees', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const fees = dbStore.getFees();
  const studentFee = fees.find(f => f.studentId === req.params.studentId);
  res.json(studentFee || null);
});

// Upload student fee receipt
app.post('/api/students/:studentId/fees/receipt', authenticateToken, requireRole('student'), (req: AuthenticatedRequest, res: Response) => {
  const { fileUrl, fileName, amountPaid } = req.body;

  if (!fileUrl) {
    res.status(400).json({ error: 'Receipt file is required' });
    return;
  }

  const fees = dbStore.getFees();
  const index = fees.findIndex(f => f.studentId === req.params.studentId);

  if (index === -1) {
    res.status(404).json({ error: 'Fee details not found for student' });
    return;
  }

  const paidVal = parseFloat(amountPaid || '0');

  fees[index].receipts.push({
    fileUrl,
    fileName: fileName || 'receipt.pdf',
    uploadedAt: new Date().toISOString()
  });

  // Optionally update paid sum dynamically
  fees[index].amountPaid += paidVal;
  fees[index].remaining = Math.max(0, fees[index].totalFees - fees[index].amountPaid);

  dbStore.saveFees(fees);

  broadcastEvent('fee_receipt_uploaded', { studentId: req.params.studentId });

  res.json({ success: true, message: 'Receipt uploaded successfully', fee: fees[index] });
});

// Admin update fees
app.post('/api/admin/fees/:studentId/update', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { totalFees, amountPaid } = req.body;
  const fees = dbStore.getFees();
  const index = fees.findIndex(f => f.studentId === req.params.studentId);

  if (index === -1) {
    res.status(404).json({ error: 'Fee details not found' });
    return;
  }

  fees[index].totalFees = parseFloat(totalFees);
  fees[index].amountPaid = parseFloat(amountPaid);
  fees[index].remaining = Math.max(0, fees[index].totalFees - fees[index].amountPaid);

  dbStore.saveFees(fees);

  broadcastEvent('fee_updated', { studentId: req.params.studentId });

  res.json({ success: true, fee: fees[index] });
});


// --- ANNOUNCEMENTS / NOTIFICATIONS API ---

app.get('/api/notifications', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const notifications = dbStore.getNotifications();
  res.json(notifications);
});

// Add announcements
app.post('/api/notifications', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { departmentId, title, message } = req.body;

  if (!title || !message) {
    res.status(400).json({ error: 'Missing title or message' });
    return;
  }

  const notifications = dbStore.getNotifications();
  const newNotif: Notification = {
    _id: `notif_${Date.now()}`,
    departmentId: departmentId || null, // null = global
    title,
    message,
    createdAt: new Date().toISOString(),
    readBy: []
  };

  notifications.push(newNotif);
  dbStore.saveNotifications(notifications);

  broadcastEvent('notification_added', { departmentId: departmentId || 'global' });

  res.status(201).json({ success: true, notification: newNotif });
});

// Mark as read by student
app.post('/api/notifications/:id/read', authenticateToken, requireRole('student'), (req: AuthenticatedRequest, res: Response) => {
  const studentId = req.user?.studentId;
  if (!studentId) {
    res.status(400).json({ error: 'Student ID unknown' });
    return;
  }

  const notifications = dbStore.getNotifications();
  const idx = notifications.findIndex(n => n._id === req.params.id);

  if (idx !== -1) {
    if (!notifications[idx].readBy.includes(studentId)) {
      notifications[idx].readBy.push(studentId);
      dbStore.saveNotifications(notifications);
    }
  }

  res.json({ success: true });
});


// --- COMPLAINTS / GRIEVANCES API ---

// Admin view all complaints
app.get('/api/complaints', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  res.json(dbStore.getComplaints());
});

// Student view their complaints
app.get('/api/students/:studentId/complaints', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const studentId = req.params.studentId;
  const filtered = dbStore.getComplaints().filter(c => c.studentId === studentId);
  res.json(filtered);
});

// Submit complaint (Student)
app.post('/api/complaints', authenticateToken, requireRole('student'), (req: AuthenticatedRequest, res: Response) => {
  const { subject, description, attachments } = req.body;
  const studentId = req.user?.studentId;

  if (!subject || !description || !studentId) {
    res.status(400).json({ error: 'Subject and description are required' });
    return;
  }

  const complaints = dbStore.getComplaints();
  const newComplaint: Complaint = {
    _id: `complaint_${Date.now()}`,
    studentId,
    subject,
    description,
    attachments: attachments || [],
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  complaints.push(newComplaint);
  dbStore.saveComplaints(complaints);

  broadcastEvent('complaint_submitted', { studentId });

  res.status(201).json({ success: true, complaint: newComplaint });
});

// Respond / update status (Admin)
app.post('/api/complaints/:id/respond', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { status, response } = req.body;

  if (!status) {
    res.status(400).json({ error: 'Status is required' });
    return;
  }

  const complaints = dbStore.getComplaints();
  const idx = complaints.findIndex(c => c._id === req.params.id);

  if (idx === -1) {
    res.status(404).json({ error: 'Complaint not found' });
    return;
  }

  complaints[idx].status = status;
  if (response !== undefined) {
    complaints[idx].response = response;
  }

  dbStore.saveComplaints(complaints);

  broadcastEvent('complaint_responded', { complaintId: req.params.id, studentId: complaints[idx].studentId });

  res.json({ success: true, complaint: complaints[idx] });
});


// --- SUPABASE INTEGRATION API ---
app.get('/api/admin/supabase-status', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  res.json(dbStore.getSupabaseSyncStatus());
});

app.post('/api/admin/supabase-sync', authenticateToken, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await dbStore.syncWithSupabase();
    if (result.success) {
      broadcastEvent('supabase_synced', { lastSyncTime: new Date().toISOString() });
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || String(err) });
  }
});

app.post('/api/admin/reset-trial', authenticateToken, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = dbStore.resetToTrialData();
    broadcastEvent('supabase_synced', { lastSyncTime: new Date().toISOString() });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || String(err) });
  }
});


// --- AI SPACE (سبيس ai) API ---
app.post('/api/ai/chat', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { prompt, history } = req.body;

  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt' });
    return;
  }

  const isStudent = req.user?.role === 'student';
  const systemInstruction = isStudent
    ? `أنت مساعد أكاديمي ذكي ودود في بوابة الطالب الجامعية (LMS AI Space).
مهمتك مساعدة الطالب بأسلوب تفاعلي، مشجع وداعم باللغة العربية الفصحى.
- ساعده في الإجابة على الأسئلة الأكاديمية والتقنية.
- قدم شروحات وتلخيصات للمحاضرات والمفاهيم العلمية.
- ساعده في التحضير للاختبارات وحل نماذج الأسئلة للمذاكرة.
- كن إيجابياً ومحفزاً واجعل ردودك واضحة ومنسقة بنقاط سهلة القراءة.`
    : `أنت مساعد قرارات وإدارة ذكي في بوابة الإدارة الجامعية (LMS AI Space).
مهمتك مساعدة المدير/المسؤول بأسلوب احترافي، دقيق ومباشر باللغة العربية الفصحى.
- ساعده في صياغة الإعلانات والأخبار والإشعارات الرسمية.
- ساعده في اقتراح أو صياغة أسئلة الامتحانات والواجبات المنزلية.
- ساعده في تلخيص شكاوى واقتراحات الطلاب وصياغة الردود عليها.
- قدم له نصائح لتطوير الأداء الإداري والتعليمي بالجامعة.
- اجعل ردودك مهنية، منظمة ومنسقة بشكل ممتاز.`;

  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      const roleName = isStudent ? 'الطالب' : 'المدير';
      const fallbackResponse = `مرحباً بك في **LMS AI Space (سبيس ai)**! 🚀\n\nلقد تم تصميم هذه المساحة الذكية لخدمتك يا ${roleName}.\n\n*ملاحظة إدارية: للربط الفعلي المباشر بنظام الذكاء الاصطناعي Gemini، يرجى تزويد مفتاح الواجهة البرمجية (GEMINI_API_KEY) في إعدادات المنصة (Settings > Secrets).* \n\n**كيف يمكنني مساعدتك اليوم؟**\n1. ${isStudent ? 'شرح أو تلخيص المحاضرات الحالية.' : 'صياغة الإعلانات الرسمية والأخبار لجميع الأقسام.'}\n2. ${isStudent ? 'المساعدة في المذاكرة وحل نماذج من أسئلة الاختبارات.' : 'اقتراح وتصميم أسئلة الاختبارات والواجبات.'}\n3. ${isStudent ? 'تقديم نصائح لتنظيم الوقت والدراسة.' : 'تحليل وتلخيص الشكاوى الواردة من الطلاب وصياغة الردود.'}`;
      res.json({ text: fallbackResponse });
      return;
    }

    const contents = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        contents.push({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.text }]
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error('Error in AI Space Chat API:', err);
    res.status(500).json({ error: 'فشل في الاتصال بمحرك الذكاء الاصطناعي: ' + (err.message || String(err)) });
  }
});


// --- VITE MIDDLEWARE SETUP ---

async function startServer() {
  // Synchronize with Supabase on startup
  console.log('[LMS SERVER] Initiating startup sync with Supabase...');
  try {
    const syncRes = await dbStore.syncWithSupabase();
    console.log(`[LMS SERVER] Supabase sync completed: ${syncRes.message}`);
  } catch (err) {
    console.error('[LMS SERVER] Failed to sync with Supabase during boot:', err);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LMS SERVER] Server active on http://localhost:${PORT}`);
  });
}

startServer();
