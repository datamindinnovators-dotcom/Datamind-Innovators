

export type PerformanceSubject = {
  attention: 'High' | 'Medium' | 'Low';
  score: number;
  readings?: number; // Internal counter for averaging
};

export type WeeklyPerformance = {
  [subject: string]: PerformanceSubject;
};

export interface Student {
  id: string;
  name: string;
  standard: string; // e.g., "4th"
  photoDataUri: string;
  parentconsent: boolean;
  performance: {
    [week: string]: WeeklyPerformance;
  }[];
}

// This is now just a type definition. The data is fetched from Firestore.
export const students: Student[] = [];
