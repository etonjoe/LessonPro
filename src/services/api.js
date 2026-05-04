import { supabase } from '../supabaseClient';

// --- AUTHENTICATION ---
export const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    // Fetch profile role
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    return { user: data.user, role: profile?.role || 'student', profile };
};

export const signUpTutor = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    
    if (data.user) {
        await supabase.from('profiles').insert([{ id: data.user.id, role: 'tutor' }]);
    }
    return data;
};

export const signOut = async () => {
    await supabase.auth.signOut();
};

export const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
    });
    if (error) throw error;
};

export const createStudentUser = async (studentDetails, password) => {
    // 1. Save student record to students table
    const { data: student, error: studentError } = await supabase.from('students').insert([
        {
            id: 's' + Date.now(),
            name: studentDetails.name,
            parentName: studentDetails.parentName,
            registrationDate: new Date().toLocaleDateString('en-GB'),
            parent_email: studentDetails.parentEmail,
            parent_phone: studentDetails.parentPhone,
            student_email: studentDetails.studentEmail,
            student_phone: studentDetails.studentPhone,
            address: studentDetails.address,
            class_year: studentDetails.classYear
        }
    ]).select().single();
    
    if (studentError) throw studentError;

    // 2. Call edge function to create auth user securely
    const { data, error } = await supabase.functions.invoke('create_student_user', {
        body: {
            email: studentDetails.studentEmail, // login with student email
            password: password,
            name: studentDetails.name,
            studentId: student.id
        }
    });

    if (error) throw error;
    return student;
};

// --- DATA ACCESS ---

export const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').single();
    return data || { currency: 'GBP' };
};

export const saveSettings = async (settings) => {
    await supabase.from('settings').upsert(settings);
};

export const fetchStudents = async () => {
    const { data } = await supabase.from('students').select(`*, subjects(*)`);
    return data || [];
};

export const saveStudents = async (students) => {
    for (const student of students) {
        const { subjects, ...studentData } = student;
        await supabase.from('students').upsert(studentData);
    }
};

export const saveSubject = async (subject) => {
    await supabase.from('subjects').upsert(subject);
};

export const fetchLessons = async () => {
    const { data } = await supabase.from('lessons').select('*');
    return data || [];
};

export const saveLessons = async (lessons) => {
    for (const lesson of lessons) {
        await supabase.from('lessons').upsert(lesson);
    }
};

export const fetchInvoices = async () => {
    const { data } = await supabase.from('invoices').select('*');
    return data || [];
};

export const saveInvoices = async (invoices) => {
    for (const invoice of invoices) {
        await supabase.from('invoices').upsert(invoice);
    }
};

