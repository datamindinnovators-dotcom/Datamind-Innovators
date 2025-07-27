
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/firebase-admin';
import { Textbook } from '@/lib/textbooks';

export type UniqueSubjectGrade = {
    subject: string;
    grade: number;
}

export async function getTextbooks(): Promise<Textbook[]> {
    if (!db) {
        console.warn('Firebase Admin SDK not initialized. Returning empty textbook list.');
        return [];
    }
    const textbooksCol = db.collection('classai_textbooks');
    const textbookSnapshot = await textbooksCol.get();
    const textbookList = textbookSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Textbook, 'id'>),
    }));
    // Sort in-memory to avoid needing a composite index in Firestore
    return textbookList.sort((a, b) => {
        if (a.grade !== b.grade) {
            return a.grade - b.grade;
        }
        return a.subject.localeCompare(b.subject);
    });
}

export async function addTextbookEntry(entryData: Omit<Textbook, 'id'>): Promise<Textbook> {
    if (!db) {
        throw new Error("Firebase Admin SDK not initialized.");
    }

    const { subject, grade, englishLink, kannadaLink } = entryData;

    // Basic validation
    if (!subject || !grade || !englishLink || !kannadaLink) {
        throw new Error("All fields are required.");
    }
    
    // Check if an entry for this subject and grade already exists
    const snapshot = await db.collection('classai_textbooks')
        .where('subject', '==', subject)
        .where('grade', '==', grade)
        .limit(1)
        .get();

    if (!snapshot.empty) {
        throw new Error(`A textbook for ${subject} - Grade ${grade} already exists.`);
    }
    
    const docRef = await db.collection('classai_textbooks').add(entryData);
    
    revalidatePath('/admin/textbooks');
    revalidatePath('/teacher/dashboard'); // Revalidate teacher dash to update subjects

    return {
        id: docRef.id,
        ...entryData,
    };
}

export async function deleteTextbookEntry(textbookId: string): Promise<void> {
    if (!db) {
        throw new Error("Firebase Admin SDK not initialized.");
    }
    if (!textbookId) {
        throw new Error("Textbook ID is required for deletion.");
    }
    await db.collection('classai_textbooks').doc(textbookId).delete();
    revalidatePath('/admin/textbooks');
    revalidatePath('/teacher/dashboard'); // Revalidate teacher dash to update subjects
}


export async function getTextbookLink(subject: string, grade: number, language: 'English' | 'Kannada'): Promise<string | null> {
    if (!db) {
        console.warn('Firebase Admin SDK not initialized. Cannot fetch textbook link.');
        return null;
    }
    try {
        const snapshot = await db.collection('classai_textbooks')
            .where('subject', '==', subject)
            .where('grade', '==', grade)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        const textbook = snapshot.docs[0].data() as Omit<Textbook, 'id'>;
        
        return language === 'English' ? textbook.englishLink : textbook.kannadaLink;
    } catch (error) {
        console.error(`Error fetching textbook for ${subject} Grade ${grade}:`, error);
        return null;
    }
}

// Function to get unique subjects and grades for dropdowns
export async function getUniqueSubjectsAndGrades(): Promise<UniqueSubjectGrade[]> {
    const allTextbooks = await getTextbooks();
    const uniqueCombinations = new Map<string, UniqueSubjectGrade>();

    allTextbooks.forEach(tb => {
        const key = `${tb.subject}-${tb.grade}`;
        if (!uniqueCombinations.has(key)) {
            uniqueCombinations.set(key, { subject: tb.subject, grade: tb.grade });
        }
    });

    return Array.from(uniqueCombinations.values());
}


// Function to seed the initial data
export async function seedInitialTextbooks() {
    console.log("Checking for initial textbook data...");
    if (!db) {
        console.error("DB not initialized, cannot seed data.");
        return;
    }
    try {
        const snapshot = await db.collection('classai_textbooks')
            .where('subject', '==', 'EVS')
            .where('grade', '==', 4)
            .limit(1)
            .get();

        if (snapshot.empty) {
            console.log("Seeding initial textbook for EVS Grade 4.");
            await db.collection('classai_textbooks').add({
                subject: 'EVS',
                grade: 4,
                englishLink: 'https://textbooks.karnataka.gov.in/uploads/pdf-files/2024-25%20Textbooks%20data/4th/4th%20Eng%20EVS%20Part-1%20%282024-25%29.pdf',
                kannadaLink: 'https://textbooks.karnataka.gov.in/uploads/pdf-files/2024-25%20Textbooks%20data/4th/4th%20Kan%20EVS%20Part-1%20(2024-25).pdf'
            });
            console.log("Initial textbook data seeded successfully.");
        } else {
            console.log("Initial textbook data already exists.");
        }
    } catch (error) {
        console.error("Error seeding initial textbook data:", error);
    }
}
