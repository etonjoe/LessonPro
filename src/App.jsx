import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from './components/Icons';
import * as api from './services/api';
import { supabase } from './supabaseClient';

const App = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userRole, setUserRole] = useState(null); 
    const [activeTab, setActiveTab] = useState('dashboard');
    
    // --- Auth State ---
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [authMode, setAuthMode] = useState('login');
    const [isAuthLoading, setIsAuthLoading] = useState(true); // Wait for auth init
    
    // --- State ---
    const [settings, setSettings] = useState({ currency: 'GBP' });
    const [students, setStudents] = useState([]);
    const [lessons, setLessons] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [activeSession, setActiveSession] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeSubjectId, setActiveSubjectId] = useState('all');

    // --- AI State ---
    const [aiQuery, setAiQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubModalOpen, setIsSubModalOpen] = useState(null);
    const [isBoardModalOpen, setIsBoardModalOpen] = useState(null);
    const [boardSelectedSubjectId, setBoardSelectedSubjectId] = useState('all');
    const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);

    // --- Data Loading & Auth ---
    useEffect(() => {
        const loadData = async () => {
            try {
                const [sSettings, sStudents, sLessons, sInvoices] = await Promise.all([
                    api.fetchSettings(),
                    api.fetchStudents(),
                    api.fetchLessons(),
                    api.fetchInvoices()
                ]);
                setSettings(sSettings);
                setStudents(sStudents);
                setLessons(sLessons);
                setInvoices(sInvoices);
            } catch (error) {
                console.error("Failed to load application data:", error);
                // Even on error, we must allow the app to render (perhaps with empty data) to avoid infinite loading screens.
            } finally {
                setIsLoading(false);
            }
        };

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                setIsLoggedIn(true);
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                setUserRole(profile?.role || 'student');
                loadData();
            } else {
                setIsLoggedIn(false);
                setUserRole(null);
                setIsLoading(false);
            }
            setIsAuthLoading(false);
        });

        // Initial check
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                setIsAuthLoading(false);
                setIsLoading(false);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    // --- Persist Data (Effectively mimicking sync) ---
    useEffect(() => {
        if (!isLoading) {
            api.saveStudents(students);
            api.saveLessons(lessons);
            api.saveInvoices(invoices);
            api.saveSettings(settings);
        }
    }, [students, lessons, invoices, settings, isLoading]);

    // --- Handlers ---
    const handleClockIn = (studentId, subjectId) => {
        const subject = students.find(s => s.id === studentId)?.subjects.find(sub => sub.id === subjectId);
        setActiveSession({
            startTime: new Date(),
            studentId,
            subjectId,
            subjectName: subject?.name || 'Session'
        });
    };

    const handleClockOut = () => {
        if (!activeSession) return;
        const mins = Math.floor((new Date() - activeSession.startTime) / 60000);
        const newLesson = {
            id: 'l' + Date.now(),
            studentId: activeSession.studentId,
            subjectId: activeSession.subjectId,
            date: new Date().toLocaleDateString('en-GB'),
            topic: `Live ${activeSession.subjectName} Session`,
            homework: 'To be assigned',
            status: 'Pending',
            duration: `${mins} mins`
        };
        setLessons([newLesson, ...lessons]);
        setActiveSession(null);
    };

    const addSubjectToStudent = async (studentId, subjectName, rate, startDate, endDate) => {
        const newSubject = { id: 'sub' + Date.now(), student_id: studentId, name: subjectName, rate: parseFloat(rate), start_date: startDate, end_date: endDate };
        await api.saveSubject(newSubject);
        setStudents(students.map(s => {
            if (s.id === studentId) {
                return {
                    ...s,
                    subjects: [...(s.subjects || []), newSubject]
                };
            }
            return s;
        }));
    };

    const toggleHomework = (lessonId) => {
        setLessons(lessons.map(l => 
            l.id === lessonId ? { ...l, status: l.status === 'Completed' ? 'Pending' : 'Completed' } : l
        ));
    };

    const updateHomework = (lessonId, newHomework) => {
        setLessons(lessons.map(l => 
            l.id === lessonId ? { ...l, homework: newHomework } : l
        ));
    };

    const confirmSignOut = async () => {
        await api.signOut();
        setIsLoggedIn(false);
        setUserRole(null);
        setActiveTab('dashboard');
        setIsSignOutModalOpen(false);
    };

    const formatCurrency = (val) => {
        const options = { style: 'currency' };
        if (settings.currency === 'NGN') return new Intl.NumberFormat('en-NG', { ...options, currency: 'NGN' }).format(val);
        if (settings.currency === 'USD') return new Intl.NumberFormat('en-US', { ...options, currency: 'USD' }).format(val);
        return new Intl.NumberFormat('en-GB', { ...options, currency: 'GBP' }).format(val);
    };
    
    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        return { firstDay: firstDay === 0 ? 7 : firstDay, totalDays, monthName: new Date(year, month).toLocaleString('en-GB', { month: 'long', year: 'numeric' }) };
    }, [currentDate]);

    const filteredLessons = useMemo(() => {
        if (activeSubjectId === 'all') return lessons;
        return lessons.filter(l => l.subjectId === activeSubjectId);
    }, [lessons, activeSubjectId]);

    const askAI = async () => {
        if (!aiQuery.trim()) return;
        setIsAiLoading(true);
        // Note: Set your Gemini API key in the environment variables (e.g., VITE_GEMINI_API_KEY)
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""; 
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: `You are an expert tutor assistant for Lesson Pro. Answer: ${aiQuery}` }] }] })
            });
            const data = await res.json();
            setAiResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to reach AI.");
        } catch (err) { setAiResponse("Connection error."); }
        finally { setIsAiLoading(false); }
    };

    if (isLoading) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-bold animate-pulse">Loading Application...</div>;
    }

    // --- Main Screens ---
    if (isAuthLoading) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-bold animate-pulse">Initializing Security...</div>;
    }

    if (!isLoggedIn) {
        const handleAuth = async (e) => {
            e.preventDefault();
            setAuthError('');
            try {
                if (authMode === 'login') {
                    await api.signIn(authEmail, authPassword);
                } else {
                    await api.signUpTutor(authEmail, authPassword);
                    setAuthMode('login');
                    alert('Tutor account created! Please sign in.');
                }
            } catch (err) {
                setAuthError(err.message);
            }
        };

        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
                    <div className="bg-indigo-600 p-10 text-center text-white">
                        <Icons.Book size={56} className="mx-auto mb-4" />
                        <h1 className="text-3xl font-bold tracking-tight text-white">Lesson Pro</h1>
                        <p className="opacity-75 mt-2 text-indigo-100">Secure Access</p>
                    </div>
                    <div className="p-8">
                        {authError && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm font-bold rounded-xl border border-red-100">{authError}</div>}
                        <form onSubmit={handleAuth} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
                            </div>
                            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg mt-4 active:scale-95">
                                {authMode === 'login' ? 'Sign In' : 'Create Tutor Account'}
                            </button>
                        </form>
                        <div className="mt-6 text-center">
                            <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors">
                                {authMode === 'login' ? 'Need a Tutor account? Sign up' : 'Already have an account? Sign in'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Sidebar */}
            <nav className="w-64 bg-slate-900 h-screen flex flex-col text-slate-300 p-6 fixed left-0 top-0 z-20 shadow-2xl">
                <div className="flex items-center gap-3 mb-10 text-white">
                    <div className="bg-indigo-600 p-2 rounded-lg shadow-lg"><Icons.Book size={24} /></div>
                    <h2 className="text-xl font-bold tracking-tight">Lesson Pro</h2>
                </div>
                
                <div className="space-y-1 flex-1">
                    <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
                        <Icons.Dashboard size={20}/> Dashboard
                    </button>
                    {userRole === 'tutor' && (
                        <button onClick={() => setActiveTab('students')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'students' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
                            <Icons.Users size={20}/> My Students
                        </button>
                    )}
                    {userRole === 'student' && (
                        <button onClick={() => setActiveTab('billing')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'billing' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
                            <Icons.CreditCard size={20}/> Invoices
                        </button>
                    )}
                    <button onClick={() => setActiveTab('calendar')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
                        <Icons.Calendar size={20}/> Calendar
                    </button>
                    <button onClick={() => setActiveTab('ai')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'ai' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
                        <Icons.Bot size={20}/> AI Support
                    </button>
                </div>

                <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
                    {userRole === 'tutor' && (
                        <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
                            <Icons.Settings size={20}/> Settings
                        </button>
                    )}
                    <button onClick={() => setIsSignOutModalOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-95 group">
                        <Icons.LogOut size={18} className="group-hover:rotate-180 transition-transform duration-500" /> Sign Out
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8">
                {/* Global Section Header */}
                <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 animate-fade-in">
                    <div className="flex items-center gap-4">
                        {activeTab !== 'dashboard' && (
                            <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm transition-colors group">
                                <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-indigo-50 transition-colors">
                                    <Icons.ArrowLeft size={18} />
                                </div>
                                Overview
                            </button>
                        )}
                        <div className="h-6 w-px bg-slate-200 mx-2"></div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{activeTab === 'dashboard' ? 'Overview' : activeTab}</p>
                    </div>
                    <button onClick={() => setIsSignOutModalOpen(true)} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-red-500 transition-colors">
                        <Icons.LogOut size={18} /> Exit Application
                    </button>
                </div>
                
                {/* TUTOR DASHBOARD */}
                {userRole === 'tutor' && activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-fade-in">
                        <header className="flex justify-between items-center">
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tutor Overview</h1>
                            <div className="flex gap-4">
                                <div className="bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm text-right">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Programme Revenue</p>
                                    <p className="text-xl font-bold text-indigo-600">{formatCurrency(invoices.reduce((a, b) => a + (b.status === 'Paid' ? b.amount : 0), 0))}</p>
                                </div>
                            </div>
                        </header>

                        {/* Live Session Tracker */}
                        <div className="bg-white rounded-3xl border-2 border-indigo-100 shadow-xl overflow-hidden">
                            <div className="p-8 flex flex-col md:flex-row justify-between items-center gap-6">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Live Session Clock</h3>
                                    <p className="text-slate-500 text-sm">Select a student and subject to begin tracking.</p>
                                </div>
                                {activeSession ? (
                                    <div className="flex items-center gap-6">
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-bold text-red-500 flex items-center gap-1 animate-pulse"><div className="w-2 h-2 bg-red-500 rounded-full" /> {activeSession.subjectName}</span>
                                            <span className="text-2xl font-mono font-bold text-slate-800">Active Session...</span>
                                        </div>
                                        <button onClick={handleClockOut} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg hover:bg-red-700 transition-all active:scale-95">Clock Out</button>
                                    </div>
                                ) : (
                                    <div className="flex gap-3">
                                        <select id="student-clock" className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm">
                                            {students.map(s => s.subjects.map(sub => (
                                                <option key={`${s.id}-${sub.id}`} value={`${s.id}|${sub.id}`}>{s.name} - {sub.name}</option>
                                            )))}
                                        </select>
                                        <button onClick={() => {
                                            const val = document.getElementById('student-clock').value.split('|');
                                            handleClockIn(val[0], val[1]);
                                        }} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95">Clock In</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
                                <div className="p-6 border-b border-slate-100 font-bold flex items-center justify-between sticky top-0 bg-white">
                                    <span>Recent Global Activity</span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                                    {lessons.map(l => (
                                        <div key={l.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all">
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{students.find(s => s.id === l.studentId)?.name}</p>
                                                <p className="text-xs text-slate-500 font-medium">{l.date} • {l.duration}</p>
                                            </div>
                                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-tighter">
                                                {students.find(s => s.id === l.studentId)?.subjects.find(sub => sub.id === l.subjectId)?.name || 'Subject'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex flex-col justify-center gap-6">
                                <h3 className="font-bold text-slate-800">Quick Stats</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-6 rounded-3xl text-center shadow-inner">
                                        <p className="text-3xl font-bold text-indigo-600">{lessons.length}</p>
                                        <p className="text-xs text-slate-400 font-bold uppercase mt-1">Total Lessons</p>
                                    </div>
                                    <div className="bg-slate-50 p-6 rounded-3xl text-center shadow-inner">
                                        <p className="text-3xl font-bold text-indigo-600">{students.length}</p>
                                        <p className="text-xs text-slate-400 font-bold uppercase mt-1">Active Students</p>
                                    </div>
                                </div>
                                <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                                    <p className="text-xs text-indigo-600 font-bold uppercase mb-2 tracking-widest">Active Currency</p>
                                    <div className="flex items-center gap-3 text-slate-800">
                                        <Icons.CreditCard className="text-indigo-600" />
                                        <p className="text-xl font-bold">{settings.currency} Preferences</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STUDENT DASHBOARD */}
                {userRole === 'student' && activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-fade-in">
                        <header className="flex justify-between items-end">
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Student Dashboard</h1>
                                <p className="text-slate-500 mt-1">Your subject-specific lesson boards are below.</p>
                            </div>
                            <div className="flex gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                                <button onClick={() => setActiveSubjectId('all')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubjectId === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>All</button>
                                {students[0]?.subjects?.map(sub => (
                                    <button key={sub.id} onClick={() => setActiveSubjectId(sub.id)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubjectId === sub.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>{sub.name}</button>
                                ))}
                            </div>
                        </header>

                        {/* Subject-Specific Lesson Board */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 font-bold flex items-center gap-2 text-slate-800">
                                <Icons.CheckCircle className="text-indigo-600" size={18} />
                                {activeSubjectId === 'all' ? 'Consolidated Lesson Board' : `${students[0]?.subjects?.find(s => s.id === activeSubjectId)?.name} Board`}
                            </div>
                            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto custom-scrollbar">
                                {filteredLessons.length > 0 ? filteredLessons.map(l => (
                                    <div key={l.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="text-sm font-bold text-slate-800">{l.topic}</span>
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">{l.date}</span>
                                                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase">{students[0]?.subjects?.find(s => s.id === l.subjectId)?.name}</span>
                                            </div>
                                            <p className="text-sm text-slate-500 leading-relaxed">Homework: <span className="italic">"{l.homework}"</span></p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{l.duration}</span>
                                            <button 
                                                onClick={() => toggleHomework(l.id)}
                                                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${l.status === 'Completed' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                            >
                                                {l.status === 'Completed' ? 'Completed ✓' : 'Mark Done'}
                                            </button>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="p-20 text-center text-slate-400 italic">No history found for this board.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* STUDENT MANAGEMENT (TUTOR ONLY) */}
                {userRole === 'tutor' && activeTab === 'students' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-slate-800">My Students</h2>
                            <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-indigo-700 flex items-center gap-2 active:scale-95 transition-all">
                                <Icons.UserPlus size={18} /> New Student
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {students.map(s => (
                                <div key={s.id} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-6 hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl font-bold">{s.name[0]}</div>
                                            <div>
                                                <h4 className="text-xl font-bold text-slate-800 tracking-tight">{s.name}</h4>
                                                <p className="text-xs text-slate-400">Guardian: {s.parentName}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setIsSubModalOpen(s.id)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors" title="Add Subject"><Icons.Plus size={18}/></button>
                                            <button onClick={() => { setIsBoardModalOpen({studentId: s.id}); setBoardSelectedSubjectId('all'); }} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors" title="Manage Boards"><Icons.CheckCircle size={18}/></button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Programme Subjects</p>
                                        <div className="grid grid-cols-1 gap-2">
                                            {s.subjects?.map(sub => (
                                                <div key={sub.id} className="bg-slate-50/50 p-4 rounded-2xl flex justify-between items-center border border-slate-100">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-slate-800">{sub.name}</p>
                                                        <p className="text-xs text-slate-500">{formatCurrency(sub.rate)} / session hr</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TUTOR SETTINGS */}
                {userRole === 'tutor' && activeTab === 'settings' && (
                    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">App Settings</h2>
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 space-y-10">
                            <section>
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Financial Preferences</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[
                                        { code: 'GBP', label: 'Pounds', symbol: '£' },
                                        { code: 'NGN', label: 'Naira', symbol: '₦' },
                                        { code: 'USD', label: 'Dollar', symbol: '$' }
                                    ].map(cur => (
                                        <button 
                                            key={cur.code}
                                            onClick={() => setSettings({ ...settings, currency: cur.code })}
                                            className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${settings.currency === cur.code ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 hover:border-slate-200 text-slate-500'}`}
                                        >
                                            <span className="text-2xl font-bold">{cur.symbol}</span>
                                            <span className="text-xs font-bold uppercase tracking-widest">{cur.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>
                )}

                {/* BILLING (STUDENT ONLY) */}
                {userRole === 'student' && activeTab === 'billing' && (
                    <div className="space-y-8 animate-fade-in">
                        <h2 className="text-2xl font-bold text-slate-800">Invoices</h2>
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden shadow-lg">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="px-8 py-4">Ref</th>
                                        <th className="px-8 py-4">Date</th>
                                        <th className="px-8 py-4">Total</th>
                                        <th className="px-8 py-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {invoices.map(inv => (
                                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-8 py-4 text-sm font-bold text-slate-800">{inv.id.toUpperCase()}</td>
                                            <td className="px-8 py-4 text-sm text-slate-500">{inv.date}</td>
                                            <td className="px-8 py-4 text-sm font-bold text-slate-900">{formatCurrency(inv.amount)}</td>
                                            <td className="px-8 py-4">
                                                <span className={`px-4 py-1 rounded-full text-[10px] font-bold border ${inv.status === 'Paid' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                                    {inv.status.toUpperCase()}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* SHARED CALENDAR */}
                {activeTab === 'calendar' && (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 animate-fade-in max-w-5xl mx-auto">
                        <div className="flex justify-between items-center mb-10">
                            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{calendarDays.monthName}</h2>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition-colors"><Icons.ChevronLeft /></button>
                                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition-colors"><Icons.ChevronRight /></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 border-t border-l border-slate-100 rounded-2xl overflow-hidden shadow-inner bg-slate-200 gap-px">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                <div key={d} className="bg-slate-50/50 p-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>
                            ))}
                            {Array.from({ length: calendarDays.firstDay - 1 }).map((_, i) => (
                                <div key={`empty-${i}`} className="bg-white h-32 opacity-20" />
                            ))}
                            {Array.from({ length: calendarDays.totalDays }).map((_, i) => {
                                const day = i + 1;
                                return (
                                    <div key={day} className="bg-white h-32 p-3 group relative hover:bg-indigo-50/30 transition-colors">
                                        <span className="text-sm font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">{day}</span>
                                        {(day % 7 === 1 || day % 7 === 4) && (
                                            <div className="mt-2 bg-indigo-600 text-[9px] text-white p-2 rounded-lg font-bold shadow-sm truncate">
                                                {userRole === 'tutor' ? 'Programme: Maths' : 'Lesson: Maths'}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* AI SUPPORT */}
                {activeTab === 'ai' && (
                    <div className="max-w-3xl mx-auto py-10 animate-fade-in">
                        <div className="text-center mb-10">
                            <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-100">
                                <Icons.Bot size={40} />
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900 tracking-tight text-slate-800">Lesson Pro AI</h2>
                            <p className="text-slate-500 mt-2 text-sm">Personalised pedagogical assistance for students and tutors.</p>
                        </div>
                        <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-xl space-y-6">
                            <textarea 
                                value={aiQuery}
                                onChange={(e) => setAiQuery(e.target.value)}
                                placeholder={userRole === 'tutor' ? "How can I explain specific heat capacity effectively?" : "Explain the concept of differentiation in Calculus..."}
                                className="w-full h-44 p-6 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-lg leading-relaxed shadow-inner"
                            />
                            <button 
                                onClick={askAI}
                                disabled={isAiLoading || !aiQuery}
                                className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 text-lg"
                            >
                                {isAiLoading ? 'Synthesising Guidance...' : <><Icons.Send size={20}/> Send to AI Assistant</>}
                            </button>
                            {aiResponse && (
                                <div className="mt-8 p-8 bg-indigo-50/50 border-l-4 border-indigo-600 rounded-r-2xl animate-fade-in text-slate-700 leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                                    {aiResponse}
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </main>

            {/* MODAL: REGISTER STUDENT */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-fade-in my-8">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white">
                            <h3 className="text-xl font-bold text-slate-800 tracking-tight">Onboard New Student</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold p-2 transition-colors">×</button>
                        </div>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            const details = {
                                name: e.target.sName.value,
                                parentName: e.target.pName.value,
                                parentEmail: e.target.pEmail.value,
                                parentPhone: e.target.pPhone.value,
                                studentEmail: e.target.sEmail.value,
                                studentPhone: e.target.sPhone.value,
                                address: e.target.address.value,
                                classYear: e.target.classYear.value
                            };
                            const password = Math.random().toString(36).slice(-8) + 'A1!';
                            try {
                                const newStudent = await api.createStudentUser(details, password);
                                setStudents([...students, { ...newStudent, subjects: [] }]);
                                setIsModalOpen(false);
                                alert(`Student created successfully!\n\nLogin Email: ${details.studentEmail}\nPassword: ${password}\n\nPlease share these credentials with the student.`);
                            } catch (err) {
                                alert('Error creating student: ' + err.message);
                            }
                        }} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Student Name</label>
                                    <input name="sName" type="text" required className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Student Email (Login)</label>
                                    <input name="sEmail" type="email" required className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Student Phone</label>
                                    <input name="sPhone" type="tel" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Class/Year</label>
                                    <input name="classYear" type="text" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Parent Name</label>
                                    <input name="pName" type="text" required className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Parent Email</label>
                                    <input name="pEmail" type="email" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Parent Phone</label>
                                    <input name="pPhone" type="tel" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Physical Address</label>
                                    <input name="address" type="text" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg transition-all active:scale-95">Complete Registration</button>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 border border-slate-200 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: ASSIGN SUBJECT */}
            {isSubModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800 tracking-tight">Assign Subject</h3>
                            <button onClick={() => setIsSubModalOpen(null)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold p-2 transition-colors">×</button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Subject Name</label>
                                <input id="as-sub-name" type="text" placeholder="e.g. Chemistry GCSE" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Hourly Rate ({settings.currency})</label>
                                <input id="as-sub-rate" type="number" placeholder="45" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                                    <input id="as-sub-start" type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                                    <input id="as-sub-end" type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600" />
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button onClick={() => {
                                    const sub = document.getElementById('as-sub-name').value;
                                    const rate = document.getElementById('as-sub-rate').value;
                                    const start = document.getElementById('as-sub-start').value;
                                    const end = document.getElementById('as-sub-end').value;
                                    if (sub && rate && start && end) {
                                        addSubjectToStudent(isSubModalOpen, sub, rate, start, end);
                                        setIsSubModalOpen(null);
                                    } else {
                                        alert("Please fill all fields including Start and End Dates.");
                                    }
                                }} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg transition-all active:scale-95">Confirm Assignment</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: MANAGE SUBJECT BOARDS (TUTOR ONLY) */}
            {isBoardModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-fade-in">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 tracking-tight">Manage Lesson Boards</h3>
                                <p className="text-xs text-slate-500 uppercase font-bold mt-1 tracking-wider">Student: {students.find(s => s.id === isBoardModalOpen.studentId)?.name}</p>
                            </div>
                            <div className="flex gap-4 items-center">
                                <select 
                                    value={boardSelectedSubjectId}
                                    onChange={(e) => setBoardSelectedSubjectId(e.target.value)}
                                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                >
                                    <option value="all">View All Subjects</option>
                                    {students.find(s => s.id === isBoardModalOpen.studentId)?.subjects?.map(sub => (
                                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                                    ))}
                                </select>
                                <button onClick={() => setIsBoardModalOpen(null)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold p-2 transition-colors">×</button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-slate-50/30">
                            <div className="space-y-4">
                                {lessons.filter(l => l.studentId === isBoardModalOpen.studentId && (boardSelectedSubjectId === 'all' || l.subjectId === boardSelectedSubjectId)).map(l => (
                                    <div key={l.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4 hover:border-indigo-100 transition-colors">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-bold text-slate-800">{l.topic}</span>
                                                    <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase">{l.date}</span>
                                                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase">{students.find(s => s.id === l.studentId)?.subjects?.find(sub => sub.id === l.subjectId)?.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 italic font-medium">
                                                    <Icons.Clock size={12} /> Duration: {l.duration}
                                                </div>
                                            </div>
                                            <button onClick={() => toggleHomework(l.id)} className={`px-4 py-1.5 rounded-xl text-[10px] font-bold transition-all shadow-sm ${l.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                                                {l.status === 'Completed' ? 'Homework Done' : 'Set as Done'}
                                            </button>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1 relative">
                                                <input 
                                                    type="text" 
                                                    defaultValue={l.homework}
                                                    onBlur={(e) => updateHomework(l.id, e.target.value)}
                                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner"
                                                    placeholder="Set homework task..."
                                                />
                                                <Icons.Edit className="absolute left-3 top-3 text-slate-400" size={14} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {lessons.filter(l => l.studentId === isBoardModalOpen.studentId && (boardSelectedSubjectId === 'all' || l.subjectId === boardSelectedSubjectId)).length === 0 && (
                                    <div className="p-20 text-center text-slate-400 italic">No session history found for this board.</div>
                                )}
                            </div>
                        </div>
                        <div className="p-6 bg-white border-t border-slate-100 flex justify-center italic text-xs text-slate-400 font-medium">
                            Changes to homework are saved automatically when you click away.
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: SIGN OUT CONFIRMATION */}
            {isSignOutModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-fade-in p-8 text-center space-y-6">
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <Icons.AlertCircle size={32} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-slate-800 tracking-tight">Confirm Sign Out</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">Are you sure you wish to exit Lesson Pro? Any unsaved administrative changes may be lost.</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={confirmSignOut} 
                                className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95"
                            >
                                Yes, Sign Out
                            </button>
                            <button 
                                onClick={() => setIsSignOutModalOpen(false)} 
                                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
