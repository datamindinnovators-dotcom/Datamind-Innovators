
'use server';

/**
 * @fileOverview A flow for logging student performance based on engagement analysis.
 *
 * - logStudentPerformance - A function that takes engagement data, determines the current subject from the timetable, and logs the performance.
 * - LogStudentPerformanceInput - The input type for the logStudentPerformance function.
 * - LogStudentPerformanceOutput - The return type for the logStudentPerformance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { updateStudentPerformance } from '@/lib/student-actions';

// Corresponds to EngagementIcon on the client
const engagementToScore = {
    attentive: 100,
    confused: 50,
    distracted: 0,
};

const LogStudentPerformanceInputSchema = z.object({
  studentEngagements: z.array(
    z.object({
      studentId: z.string().optional().describe('Unique identifier for the recognized student.'),
      studentName: z.string().optional().describe('Name of the recognized student.'),
      engagementLevel: z
        .string()
        .describe(
          'The engagement level of the student (e.g., attentive, distracted, confused).'
        ),
    })
  ).describe('Array of student engagement levels from a snapshot.'),
  subject: z.string().optional().describe('The subject of the class currently in session.')
});
export type LogStudentPerformanceInput = z.infer<typeof LogStudentPerformanceInputSchema>;

const LogStudentPerformanceOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  subject: z.string().optional(),
});
export type LogStudentPerformanceOutput = z.infer<typeof LogStudentPerformanceOutputSchema>;

export async function logStudentPerformance(
  input: LogStudentPerformanceInput
): Promise<LogStudentPerformanceOutput> {
  return logStudentPerformanceFlow(input);
}


const logStudentPerformanceFlow = ai.defineFlow(
  {
    name: 'logStudentPerformanceFlow',
    inputSchema: LogStudentPerformanceInputSchema,
    outputSchema: LogStudentPerformanceOutputSchema,
  },
  async ({ studentEngagements, subject }) => {
    
    if (!subject) {
        return {
            success: false,
            message: "No active class subject was provided. Cannot log performance.",
        };
    }

    if (studentEngagements.length === 0) {
        return {
            success: false,
            message: "No students were provided to log performance for.",
            subject: subject,
        }
    }

    // Convert engagement levels to numerical scores and filter out unknown students
    const performanceUpdates = studentEngagements
        .filter(e => e.studentId) // Only process recognized students
        .map(e => ({
            studentId: e.studentId!,
            score: engagementToScore[e.engagementLevel.toLowerCase() as keyof typeof engagementToScore] ?? 50 // Default to 'confused' score
        }));

    if (performanceUpdates.length === 0) {
        return {
            success: false,
            message: "No recognized students were found in the analysis.",
            subject: subject,
        }
    }

    try {
        await updateStudentPerformance({
            subject: subject,
            updates: performanceUpdates
        });

        return {
            success: true,
            message: `Logged performance for ${performanceUpdates.length} students in ${subject}.`,
            subject: subject
        };

    } catch (error) {
         console.error("Error in updateStudentPerformance:", error);
         const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
         return {
            success: false,
            message: `Failed to update student performance: ${errorMessage}`,
            subject: subject
         }
    }
  }
);
