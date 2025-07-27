
'use server';

/**
 * @fileOverview Lesson plan generation flow for teachers.
 *
 * - generateLessonPlan - A function that generates a lesson plan based on the course and resource links.
 * - GenerateLessonPlanInput - The input type for the generateLessonPlan function.
 * - GenerateLessonPlanOutput - The return type for the generateLessonPlan function.
 */

import {ai} from '@/ai/genkit';
import { getTextbookLink } from '@/lib/textbook-actions';
import {z} from 'genkit';

const GenerateLessonPlanInputSchema = z.object({
  subject: z.string().describe('The subject for which to generate a lesson plan.'),
  grade: z.coerce.number().describe('The grade level for the lesson plan.'),
  chapterName: z.string().describe('The name of the chapter to focus on.'),
  duration: z.coerce.number().describe('The number of days to complete the chapter.'),
});
export type GenerateLessonPlanInput = z.infer<typeof GenerateLessonPlanInputSchema>;

const DailyPlanSchema = z.object({
    day: z.string().describe("The day's topic or title (e.g., 'Day 1 - Introduction to Water Pollution')."),
    learningObjectives: z.array(z.string()).describe("A list of what students will learn."),
    teachingActivities: z.array(z.string()).describe("A list of activities the teacher will conduct."),
    learningResources: z.array(z.string()).describe("A list of resources needed for the lesson."),
    assessmentHomework: z.array(z.string()).describe("A list of assessment tasks or homework assignments."),
});

const GenerateLessonPlanOutputSchema = z.object({
    board: z.string().describe("The educational board (e.g., 'Karnataka State Board')."),
    grade: z.coerce.number().describe("The grade level (e.g., 4)."),
    subject: z.string().describe("The subject (e.g., 'EVS Part 1')."),
    lessonName: z.string().describe("The name of the lesson or chapter."),
    dailyBreakdown: z.array(DailyPlanSchema).describe("An array representing the day-by-day lesson plan."),
});
export type GenerateLessonPlanOutput = z.infer<typeof GenerateLessonPlanOutputSchema>;

export async function generateLessonPlan(input: GenerateLessonPlanInput): Promise<GenerateLessonPlanOutput> {
  return generateLessonPlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateLessonPlanPrompt',
  input: {schema: z.object({
    subject: z.string(),
    grade: z.number(),
    chapterName: z.string(),
    duration: z.number(),
    englishTextbookUrl: z.string().optional(),
    kannadaTextbookUrl: z.string().optional(),
  })},
  output: {schema: GenerateLessonPlanOutputSchema},
  prompt: `You are an expert lesson plan creator for elementary school teachers in Karnataka, India.

  Your task is to generate a detailed, day-by-day lesson plan based on the provided information. The plan must be structured to cover the specified chapter over the given duration.
  You MUST adhere to the JSON output format provided, ensuring the 'grade' is a number.
  For each day, provide clear and concise lists for learning objectives, teaching activities, required resources, and assessment/homework.
  Base the content on the provided textbook URLs.

  **Input Information:**
  - Subject: {{{subject}}}
  - Grade: {{{grade}}}
  - Chapter Name: {{{chapterName}}}
  - Duration: {{{duration}}} days
  - English Textbook URL: {{{englishTextbookUrl}}}
  - Kannada Textbook URL: {{{kannadaTextbookUrl}}}
  - Educational Board: Karnataka State Board

  **Required JSON Output Structure:**

  For the 'dailyBreakdown' array, create one object for each day of the specified duration.
  Example for a single day's object:
  {
    "day": "Day 1 - Introduction to Topic",
    "learningObjectives": ["Objective 1", "Objective 2"],
    "teachingActivities": ["Activity 1", "Activity 2"],
    "learningResources": ["Resource 1", "Resource 2"],
    "assessmentHomework": ["Homework task 1"]
  }

  Generate the complete lesson plan now based on these instructions.
  `,
});

const generateLessonPlanFlow = ai.defineFlow(
  {
    name: 'generateLessonPlanFlow',
    inputSchema: GenerateLessonPlanInputSchema,
    outputSchema: GenerateLessonPlanOutputSchema,
  },
  async ({ subject, grade, chapterName, duration }) => {
    
    const [englishTextbookUrl, kannadaTextbookUrl] = await Promise.all([
        getTextbookLink(subject, grade, 'English'),
        getTextbookLink(subject, grade, 'Kannada')
    ]);

    if (!englishTextbookUrl || !kannadaTextbookUrl) {
        throw new Error(`Textbooks for subject '${subject}' and grade ${grade} not found.`);
    }

    const {output} = await prompt({
        subject,
        grade,
        chapterName,
        duration,
        englishTextbookUrl,
        kannadaTextbookUrl
    });
    return output!;
  }
);
