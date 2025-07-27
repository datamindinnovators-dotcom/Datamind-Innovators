
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/firebase-admin';
import { Student, WeeklyPerformance, PerformanceSubject } from '@/lib/students';
import { getWeek } from 'date-fns';
import { Textbook } from './textbooks';
import { GenerateLessonPlanOutput } from '@/ai/flows/generate-lesson-plan';

type PerformanceUpdate = {
    studentId: string;
    score: number;
}

type UpdatePayload = {
    subject: string;
    updates: PerformanceUpdate[];
}

export type StrugglingStudent = {
    id: string;
    name: string;
    photoDataUri: string;
    subject: string;
    score: number;
    attention: 'High' | 'Low' | 'Medium';
    grade: number; // Added grade to know which textbook to fetch
}

// This helper gets the current week number in the format "weekX"
const getCurrentWeekKey = () => {
    const weekNumber = getWeek(new Date(), { weekStartsOn: 1 }); // week starts on Monday
    return `week${weekNumber}`;
}


export async function getStudents(): Promise<Student[]> {
  if (!db) {
    console.warn('Firebase Admin SDK not initialized. Returning empty student list.');
    return [];
  }
  const studentsCol = db.collection('classai_students');
  const studentSnapshot = await studentsCol.get();
  const studentList = studentSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Student, 'id'>),
  }));
  return studentList;
}

export async function addStudent(studentData: { name: string, standard: string, photoDataUri: string | null }): Promise<Student> {
    if (!db) {
        throw new Error("Firebase Admin SDK not initialized. Please configure server-side environment variables.");
    }

    try {
        const { name, standard, photoDataUri } = studentData;

        if (!name || !standard) {
            throw new Error('Name and standard are required');
        }
        
        const finalPhotoDataUri = photoDataUri || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        const weekKey = getCurrentWeekKey();

        const newStudentData = { 
            name, 
            standard,
            photoDataUri: finalPhotoDataUri,
            parentconsent: false,
            performance: [
                {
                    [weekKey]: {
                        'EVS': {
                            attention: 'Low',
                            score: 0,
                            readings: 1
                        }
                    }
                }
            ],
        };
        const docRef = await db.collection('classai_students').add(newStudentData);

        revalidatePath('/admin/students');
        revalidatePath('/admin/dashboard');
        revalidatePath('/teacher/dashboard');

        const newStudentDoc = await docRef.get();

        return {
            id: newStudentDoc.id,
            ...(newStudentDoc.data() as Omit<Student, 'id'>),
        };
    } catch (error) {
        console.error("Error adding student:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to add student: ${error.message}`);
        }
        throw new Error("An unknown error occurred while adding the student.");
    }
}


export async function deleteStudent(studentId: string): Promise<void> {
    if (!db) {
        throw new Error("Firebase Admin SDK not initialized. Please configure server-side environment variables.");
    }

    if (!studentId) {
        throw new Error("Student ID is required for deletion.");
    }
    
    await db.collection('classai_students').doc(studentId).delete();

    revalidatePath('/admin/students');
    revalidatePath('/admin/dashboard');
}

export async function updateStudentPerformance(payload: UpdatePayload): Promise<void> {
    if (!db) {
        throw new Error("Firebase Admin SDK not initialized.");
    }

    const { subject, updates } = payload;
    const weekKey = getCurrentWeekKey();

    const batch = db.batch();

    for (const update of updates) {
        const studentRef = db.collection('classai_students').doc(update.studentId);
        const studentDoc = await studentRef.get();

        if (!studentDoc.exists) {
            console.warn(`Student with ID ${update.studentId} not found. Skipping performance update.`);
            continue;
        }

        const studentData = studentDoc.data() as Student;
        const performance = studentData.performance || [];

        // Find if there's an entry for the current week
        let weekPerformance = performance.find(p => p[weekKey])?.[weekKey];

        if (!weekPerformance) {
            // If no entry for this week, create a new one
            weekPerformance = {};
        }

        // Get current subject data or initialize it
        const subjectPerformance = weekPerformance[subject] || { attention: 'Medium', score: 0, readings: 0 };
        
        // Calculate new average score
        const newTotalScore = (subjectPerformance.score * (subjectPerformance.readings || 0)) + update.score;
        const newReadings = (subjectPerformance.readings || 0) + 1;
        const newAverageScore = newTotalScore / newReadings;

        let newAttention: 'High' | 'Medium' | 'Low';
        if (newAverageScore > 75) {
            newAttention = 'High';
        } else if (newAverageScore > 35) {
            newAttention = 'Medium';
        } else {
            newAttention = 'Low';
        }

        // Update subject performance
        weekPerformance[subject] = {
            attention: newAttention,
            score: newAverageScore,
            readings: newReadings, // Keep track of how many readings we've averaged
        };

        // Find the index of the current week's performance to update or add it
        const weekIndex = performance.findIndex(p => p[weekKey]);
        if (weekIndex > -1) {
            performance[weekIndex][weekKey] = weekPerformance;
        } else {
            performance.push({ [weekKey]: weekPerformance });
        }

        batch.update(studentRef, { performance });
    }

    await batch.commit();

    // Revalidate teacher dashboard to show new struggling students.
    revalidatePath('/teacher/dashboard');
}

export async function getStrugglingStudents(): Promise<StrugglingStudent[]> {
    if (!db) {
        return [];
    }

    const students = await getStudents();
    const strugglingStudents: StrugglingStudent[] = [];
    const weekKey = getCurrentWeekKey();

    const textbooksSnapshot = await db.collection('classai_textbooks').get();
    const allTextbooks = textbooksSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Textbook));

    const lessonPlansSnapshot = await db.collection('classai_lessonplans').orderBy('createdAt', 'desc').get();
    const allLessonPlans = lessonPlansSnapshot.docs.map(doc => doc.data() as GenerateLessonPlanOutput);

    for (const student of students) {
        const weeklyDataContainer = student.performance?.find(p => p[weekKey]);
        
        if (weeklyDataContainer && weeklyDataContainer[weekKey]) {
            const weekPerformance: WeeklyPerformance = weeklyDataContainer[weekKey];

            for (const subject in weekPerformance) {
                const perf: PerformanceSubject = weekPerformance[subject];
                
                // Ensure grade is a number for comparisons
                const grade = parseInt(student.standard, 10);
                if (isNaN(grade)) continue; // Skip if standard is not a valid number

                // Check for low score
                if (perf.score < 35) {
                    const hasEnglishTextbook = allTextbooks.some(tb => tb.subject === subject && tb.grade === grade && tb.englishLink);
                    const hasKannadaTextbook = allTextbooks.some(tb => tb.subject === subject && tb.grade === grade && tb.kannadaLink);
                    
                    // IMPORTANT: Check that a lesson plan for this subject/grade actually exists
                    const hasLessonPlan = allLessonPlans.some(lp => lp.subject === subject && lp.grade === grade);

                    if (hasEnglishTextbook && hasKannadaTextbook && hasLessonPlan) {
                        strugglingStudents.push({
                            id: student.id,
                            name: student.name,
                            photoDataUri: student.photoDataUri,
                            subject: subject,
                            score: perf.score,
                            attention: perf.attention,
                            grade: grade,
                        });
                    }
                }
            }
        }
    }

    // Sort by score, lowest first
    return strugglingStudents.sort((a, b) => a.score - b.score);
}
