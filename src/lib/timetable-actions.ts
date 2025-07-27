
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/firebase-admin';
import { TimetableEntry } from '@/lib/timetable';

export async function getTimetable(): Promise<TimetableEntry[]> {
  if (!db) {
    console.warn('Firebase Admin SDK not initialized. Returning empty timetable.');
    return [];
  }
  const timetableCol = db.collection('classai_timetables');
  const timetableSnapshot = await timetableCol.get();
  const timetableList = timetableSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<TimetableEntry, 'id'>),
  }));
   return timetableList.sort((a, b) => {
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (dayOrder.indexOf(a.day) !== dayOrder.indexOf(b.day)) {
      return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    }
    return a.startTime.localeCompare(b.startTime);
  });
}

export async function addTimetableEntry(entryData: Omit<TimetableEntry, 'id'>): Promise<TimetableEntry> {
    if (!db) {
        throw new Error("Firebase Admin SDK not initialized.");
    }
    const docRef = await db.collection('classai_timetables').add(entryData);
    revalidatePath('/admin/timetable');
    return {
        id: docRef.id,
        ...entryData,
    };
}

export async function deleteTimetableEntry(entryId: string): Promise<void> {
    if (!db) {
        throw new Error("Firebase Admin SDK not initialized.");
    }
    await db.collection('classai_timetables').doc(entryId).delete();
    revalidatePath('/admin/timetable');
}

async function getDayOfWeekFromApi(): Promise<string> {
    try {
        const response = await fetch('http://worldtimeapi.org/api/ip', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`World Time API failed with status: ${response.status}`);
        }
        const data = await response.json();
        const now = new Date(data.datetime);
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return daysOfWeek[now.getDay()];
    } catch (error) {
        console.error("Failed to fetch authoritative day of week, falling back to server's local day:", error);
        const now = new Date();
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return daysOfWeek[now.getDay()];
    }
}


export async function getTodaysTimetable(): Promise<TimetableEntry[]> {
    if (!db) {
        console.warn('Firebase Admin SDK not initialized. Returning empty timetable.');
        return [];
    }

    try {
        const dayOfWeek = await getDayOfWeekFromApi();
        const timetableCol = db.collection('classai_timetables');
        const snapshot = await timetableCol.where('day', '==', dayOfWeek).get();

        if (snapshot.empty) {
            return [];
        }

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimetableEntry));
    } catch (error) {
        console.error("Error fetching today's timetable:", error);
        return [];
    }
}

    