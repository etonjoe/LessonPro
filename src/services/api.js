import { supabase } from '../supabaseClient';

// --- SUPABASE DATA ACCESS LAYER ---
// These functions wrap your data access. Currently, they fall back to LocalStorage
// so the app continues to work immediately. To switch to Supabase, simply uncomment
// the Supabase queries and comment out the LocalStorage logic once your tables are set up.

export const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').single();
    return data || { currency: 'GBP' };
    // const saved = localStorage.getItem('lp_settings');
    // return saved ? JSON.parse(saved) : { currency: 'GBP' };
};

export const saveSettings = async (settings) => {
    await supabase.from('settings').upsert(settings);
    // localStorage.setItem('lp_settings', JSON.stringify(settings));
};

export const fetchStudents = async () => {
    const { data } = await supabase.from('students').select(`*, subjects(*)`);
    return data || [];
    /*
    const saved = localStorage.getItem('lp_students_v3');
    return saved ? JSON.parse(saved) : [
        { 
            id: 's1', 
            name: 'Alex Thompson', 
            parentName: 'Sarah Thompson', 
            registrationDate: '2023-10-01',
            subjects: [
                { id: 'sub1', name: 'Mathematics (GCSE)', rate: 45 },
                { id: 'sub2', name: 'Physics (A-Level)', rate: 55 }
            ]
        }
    ];
    */
};

export const saveStudents = async (students) => {
    // Basic array save implementation - in production, this should update individual records.
    for (const student of students) {
        await supabase.from('students').upsert(student);
    }
    // localStorage.setItem('lp_students_v3', JSON.stringify(students));
};

export const fetchLessons = async () => {
    const { data } = await supabase.from('lessons').select('*');
    return data || [];
    /*
    const saved = localStorage.getItem('lp_lessons_v3');
    return saved ? JSON.parse(saved) : [
        { id: 'l1', studentId: 's1', subjectId: 'sub1', date: '2023-10-23', topic: 'Quadratic Equations', homework: 'Complete Worksheet 4', status: 'Pending', duration: '60 mins' },
        { id: 'l2', studentId: 's1', subjectId: 'sub2', date: '2023-10-25', topic: 'Thermal Physics', homework: 'Review textbook pages 12-20', status: 'Completed', duration: '90 mins' }
    ];
    */
};

export const saveLessons = async (lessons) => {
    for (const lesson of lessons) {
        await supabase.from('lessons').upsert(lesson);
    }
    // localStorage.setItem('lp_lessons_v3', JSON.stringify(lessons));
};

export const fetchInvoices = async () => {
    const { data } = await supabase.from('invoices').select('*');
    return data || [];
    /*
    const saved = localStorage.getItem('lp_invoices_v3');
    return saved ? JSON.parse(saved) : [
        { id: 'i1', studentId: 's1', amount: 180, date: '2023-10-15', status: 'Paid' },
        { id: 'i2', studentId: 's1', amount: 90, date: '2023-10-30', status: 'Pending' }
    ];
    */
};

export const saveInvoices = async (invoices) => {
    for (const invoice of invoices) {
        await supabase.from('invoices').upsert(invoice);
    }
    // localStorage.setItem('lp_invoices_v3', JSON.stringify(invoices));
};
