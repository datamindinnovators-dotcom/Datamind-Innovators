
'use server';

import { db } from '@/lib/firebase-admin';
import type { GenerateLessonPlanOutput } from '@/ai/flows/generate-lesson-plan';
import { revalidatePath } from 'next/cache';

// Firestore collection name
const COLLECTION_NAME = 'classai_lessonplans';

/**
 * Saves a generated lesson plan to Firestore.
 * It also adds a 'createdAt' timestamp to track when the plan was saved.
 * @param plan The lesson plan object to save.
 */
export async function saveLessonPlan(plan: GenerateLessonPlanOutput): Promise<void> {
  if (!db) {
    throw new Error("Firebase Admin SDK not initialized.");
  }
  
  try {
    const planWithTimestamp = {
      ...plan,
      grade: plan.grade,
      createdAt: new Date().toISOString(), // Add a timestamp for sorting
    };

    await db.collection(COLLECTION_NAME).add(planWithTimestamp);

    // Revalidate the teacher dashboard to ensure any dependent data is fresh.
    revalidatePath('/teacher/dashboard');
  } catch (error) {
    console.error("Error saving lesson plan:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to save lesson plan: ${error.message}`);
    }
    throw new Error("An unknown error occurred while saving the lesson plan.");
  }
}

/**
 * Retrieves the most recently saved lesson plan for a specific subject and grade.
 * @param subject The subject of the lesson plan.
 * @param grade The grade of the lesson plan.
 * @returns The most recent lesson plan object, or null if not found.
 */
export async function getLatestLessonPlan(subject: string, grade: number): Promise<GenerateLessonPlanOutput | null> {
    if (!db) {
        console.warn('Firebase Admin SDK not initialized. Cannot fetch lesson plan.');
        return null;
    }

    try {
        const snapshot = await db.collection(COLLECTION_NAME)
            .where('subject', '==', subject)
            .where('grade', '==', grade) // Query with grade as a number
            .orderBy('createdAt', 'desc') // Order by the timestamp to get the latest one
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null; // No plan found
        }

        const doc = snapshot.docs[0];
        const data = doc.data();
        
        return data as GenerateLessonPlanOutput;

    } catch (error) {
        console.error(`Error fetching latest lesson plan for ${subject} Grade ${grade}:`, error);
        return null;
    }
}
