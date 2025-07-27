// The AI flow for analyzing student engagement in a classroom snapshot.
//
// - analyzeStudentEngagement - Analyzes the student engagement levels from a snapshot.
// - AnalyzeStudentEngagementInput - Input type for the analyzeStudentEngagement function.
// - AnalyzeStudentEngagementOutput - Output type for the analyzeStudentEngagement function.

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeStudentEngagementInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A classroom snapshot as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
    students: z.array(z.object({
      id: z.string(),
      name: z.string(),
      photoDataUri: z.string().describe(
        "A photo of a student, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
      ),
    })).describe('An array of known students with their reference photos.')
});
export type AnalyzeStudentEngagementInput = z.infer<typeof AnalyzeStudentEngagementInputSchema>;

const AnalyzeStudentEngagementOutputSchema = z.object({
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
  ).describe('Array of student engagement levels.'),
});
export type AnalyzeStudentEngagementOutput = z.infer<typeof AnalyzeStudentEngagementOutputSchema>;

export async function analyzeStudentEngagement(
  input: AnalyzeStudentEngagementInput
): Promise<AnalyzeStudentEngagementOutput> {
  return analyzeStudentEngagementFlow(input);
}

const analyzeStudentEngagementPrompt = ai.definePrompt({
  name: 'analyzeStudentEngagementPrompt',
  input: {schema: AnalyzeStudentEngagementInputSchema},
  output: {schema: AnalyzeStudentEngagementOutputSchema},
  prompt: `You are an AI assistant that analyzes student engagement levels from classroom snapshots and recognizes students.

  Analyze the provided classroom image to identify student faces, recognize them against the provided list of known students, and classify their engagement levels.
  For each detected face, determine if it matches any of the students from the \`students\` array by comparing the face in the classroom snapshot with the student's reference photo.
  If a match is found, include the student's ID and name in the output. If no match is found, you can omit studentId and studentName.
  
  Determine for each student, based on their facial expression and body language, if they are attentive, distracted, or confused.

  Return the analysis in the specified JSON format.

  Classroom Snapshot: {{media url=photoDataUri}}

  Known Students:
  {{#each students}}
  - Student ID: {{{id}}}, Name: {{{name}}}, Photo: {{media url=photoDataUri}}
  {{/each}}
  `,
});

const analyzeStudentEngagementFlow = ai.defineFlow(
  {
    name: 'analyzeStudentEngagementFlow',
    inputSchema: AnalyzeStudentEngagementInputSchema,
    outputSchema: AnalyzeStudentEngagementOutputSchema,
  },
  async input => {
    // Filter out students with placeholder images before sending to the prompt.
    const filteredStudents = input.students.filter(student => !student.photoDataUri.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='));

    if (filteredStudents.length === 0) {
        // If no students have real photos, return an empty result to avoid calling the AI with no references.
        return { studentEngagements: [] };
    }
      
    const {output} = await analyzeStudentEngagementPrompt({
        ...input,
        students: filteredStudents,
    });
    return output!;
  }
);
