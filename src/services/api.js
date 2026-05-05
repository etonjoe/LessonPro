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
    const studentId = 's' + Date.now();

    // 1. Call edge function to create auth user securely FIRST
    const { data, error } = await supabase.functions.invoke('create_student_user', {
        body: {
            email: studentDetails.studentEmail, // login with student email
            password: password,
            name: studentDetails.name,
            studentId: studentId
        }
    });

    if (error) {
        throw new Error(error.message || 'Error creating auth user');
    }
    
    // In v2 supabase functions, error messages are often inside the JSON response data
    if (data && data.error) {
        throw new Error(data.error);
    }

    // 2. Save student record to students table ONLY if auth succeeds
    const newStudent = {
        id: studentId,
        name: studentDetails.name,
        parentname: studentDetails.parentName,
        registrationdate: new Date().toLocaleDateString('en-GB'),
        parent_email: studentDetails.parentEmail,
        parent_phone: studentDetails.parentPhone,
        student_email: studentDetails.studentEmail,
        student_phone: studentDetails.studentPhone,
        address: studentDetails.address,
        class_year: studentDetails.classYear
    };

    const { data: student, error: studentError } = await supabase.from('students').insert([
        newStudent
    ]).select().single();
    
    if (studentError) throw studentError;

    return student;
};

// --- DATA ACCESS ---

export const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').limit(1).maybeSingle();
    return data || { currency: 'NGN' };
};

export const saveSettings = async (settings) => {
    if (!settings.id) {
        const { data } = await supabase.from('settings').select('id').limit(1).maybeSingle();
        if (data) settings.id = data.id;
    }
    await supabase.from('settings').upsert(settings);
};

export const fetchStudents = async (studentId = null) => {
    let query = supabase.from('students').select(`*, subjects(*)`);
    if (studentId) query = query.eq('id', studentId);
    const { data } = await query;
    if (!data) return [];
    return data.map(s => ({
        ...s,
        parentName: s.parentname,
        registrationDate: s.registrationdate,
        parentEmail: s.parent_email,
        parentPhone: s.parent_phone,
        studentEmail: s.student_email,
        studentPhone: s.student_phone,
        classYear: s.class_year
    }));
};

export const saveStudents = async (students) => {
    if (!students || students.length === 0) return;
    const studentData = students.map(student => {
        const { subjects, parentName, registrationDate, parentEmail, parentPhone, studentEmail, studentPhone, classYear, ...rest } = student;
        return {
            ...rest,
            parentname: parentName || rest.parentname,
            registrationdate: registrationDate || rest.registrationdate,
            parent_email: parentEmail || rest.parent_email,
            parent_phone: parentPhone || rest.parent_phone,
            student_email: studentEmail || rest.student_email,
            student_phone: studentPhone || rest.student_phone,
            class_year: classYear || rest.class_year
        };
    });
    await supabase.from('students').upsert(studentData);
};

export const saveSubject = async (subject) => {
    await supabase.from('subjects').upsert(subject);
};

export const fetchLessons = async (studentId = null) => {
    let query = supabase.from('lessons').select('*');
    if (studentId) query = query.eq('studentId', studentId);
    const { data } = await query;
    return data || [];
};

export const saveLessons = async (lessons) => {
    if (!lessons || lessons.length === 0) return;
    await supabase.from('lessons').upsert(lessons);
};

export const fetchInvoices = async (studentId = null) => {
    let query = supabase.from('invoices').select('*');
    if (studentId) query = query.eq('studentId', studentId);
    const { data } = await query;
    return data || [];
};

export const saveInvoices = async (invoices) => {
    if (!invoices || invoices.length === 0) return;
    await supabase.from('invoices').upsert(invoices);
};

// --- NEW 11-POINT UPDATES ---

export const updateStudent = async (studentId, studentDetails) => {
    const updatedData = {
        name: studentDetails.name,
        parentname: studentDetails.parentName,
        parent_email: studentDetails.parentEmail,
        parent_phone: studentDetails.parentPhone,
        student_email: studentDetails.studentEmail,
        student_phone: studentDetails.studentPhone,
        address: studentDetails.address,
        class_year: studentDetails.classYear
    };
    const { error } = await supabase.from('students').update(updatedData).eq('id', studentId);
    if (error) throw error;
};

export const deleteStudent = async (studentId) => {
    const { data, error } = await supabase.functions.invoke('delete_student_user', {
        body: { studentId }
    });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
};

export const approveInvoice = async (invoiceId) => {
    const { error } = await supabase.from('invoices').update({ status: 'Approved' }).eq('id', invoiceId);
    if (error) throw error;
};

export const scheduleLesson = async (lesson) => {
    const { data, error } = await supabase.from('lessons').insert([lesson]).select().single();
    if (error) throw error;
    return data;
};

export const updateLessonStudentWork = async (lessonId, updates) => {
    const { error } = await supabase.from('lessons').update(updates).eq('id', lessonId);
    if (error) throw error;
};

export const uploadHomework = async (file, fileName) => {
    const { data, error } = await supabase.storage.from('homework').upload(`submissions/${Date.now()}_${fileName}`, file, {
        cacheControl: '3600',
        upsert: false
    });
    if (error) throw error;
    
    const { data: publicUrlData } = supabase.storage.from('homework').getPublicUrl(data.path);
    return publicUrlData.publicUrl;
};

// Chat Methods
export const fetchMessages = async (userId) => {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
};

export const sendMessage = async (receiverId, content) => {
    const { data: { user } } = await supabase.auth.getUser();
    let finalReceiverId = receiverId;
    if (!finalReceiverId) {
        const { data: tutor } = await supabase.from('profiles').select('id').eq('role', 'tutor').limit(1).single();
        finalReceiverId = tutor?.id;
    }
    const { error } = await supabase.from('messages').insert([
        { sender_id: user.id, receiver_id: finalReceiverId, content }
    ]);
    if (error) throw error;
};

