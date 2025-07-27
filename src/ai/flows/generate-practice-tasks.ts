'use server';

/**
 * @fileOverview A flow for generating personalized, bilingual (English & Kannada) practice handouts for struggling students.
 *
 * - generatePracticeHandout - A function that generates a detailed handout for a student.
 * - GeneratePracticeHandoutInput - The input type for the function.
 * - GeneratePracticeHandoutOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BilingualContentSchema = z.object({
  english: z.string(),
  kannada: z.string(),
});

const VocabularyItemSchema = z.object({
    word: z.string(),
    englishExplanation: z.string(),
    kannadaExplanation: z.string(),
});

const ActivitySchema = z.object({
  title: BilingualContentSchema,
  description: BilingualContentSchema,
  imagePrompt: z.string().describe("A descriptive prompt for an AI image generation model to create a relevant image for this activity."),
});

const GeneratePracticeHandoutInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  engagementHistory: z.string().describe('A summary of the student\'s engagement history, including subjects they struggle with.'),
  englishTextbookUrl: z.string().describe('The URL of the English version of the textbook.'),
  kannadaTextbookUrl: z.string().describe('The URL of the Kannada version of the textbook.'),
  topic: z.string().describe('The specific topic or chapter for which to generate the handout.'),
});
export type GeneratePracticeHandoutInput = z.infer<typeof GeneratePracticeHandoutInputSchema>;

const GeneratePracticeHandoutOutputSchema = z.object({
  chapterTitle: BilingualContentSchema,
  proverb: BilingualContentSchema,
  learningObjective: BilingualContentSchema,
  keyVocabulary: z.array(VocabularyItemSchema),
  openingActivity: BilingualContentSchema,
  conceptExplanation: BilingualContentSchema,
  handsOnActivities: z.array(ActivitySchema),
  assessmentQuestions: z.array(BilingualContentSchema),
  conclusion: BilingualContentSchema,
});
export type GeneratePracticeHandoutOutput = z.infer<typeof GeneratePracticeHandoutOutputSchema>;


export async function generatePracticeHandout(input: GeneratePracticeHandoutInput): Promise<GeneratePracticeHandoutOutput> {
  return generatePracticeHandoutFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePracticeHandoutPrompt',
  input: {schema: GeneratePracticeHandoutInputSchema},
  output: {schema: GeneratePracticeHandoutOutputSchema},
  prompt: `You are an expert educational content creator for young students in Karnataka, India. You are fluent in both English and Kannada.

Your task is to create a detailed, engaging, and bilingual (English and Kannada) handout for a student who is struggling with a specific topic. The handout should be based on the provided textbook content from both English and Kannada textbook URLs.

**Student Information:**
- Name: {{{studentName}}}
- Engagement History: {{{engagementHistory}}}
- Topic: {{{topic}}}

**Source Material:**
Use the content from the following textbook URLs as the primary source of truth for the chapter's content. Use both to create accurate bilingual content.
- English Textbook URL: {{{englishTextbookUrl}}}
- Kannada Textbook URL: {{{kannadaTextbookUrl}}}

**Instructions:**
Generate the content for the handout following the specified JSON structure. For every field requiring bilingual content, you MUST provide a version in both English and a phonetically accurate, grammatically correct Kannada translation.

**Handout Structure:**

1.  **chapterTitle**: The title of the chapter.
2.  **proverb**: A simple, inspiring proverb or motto related to the chapter's theme.
3.  **learningObjective**: A concise and creative explanation of what the chapter is about.
4.  **keyVocabulary**: A list of important words from the chapter. For each word, provide a simple explanation in both English and Kannada.
5.  **openingActivity**: A simple and engaging opening activity or question for the student.
6.  **conceptExplanation**: Explain the core concepts in an interesting and engaging way, perhaps using a simple story or a relatable analogy. Focus on providing maximum clarity on the basics.
7.  **handsOnActivities**: Suggest 2-3 simple, interesting, hands-on activities. For each activity, provide a title, a description, and a detailed 'imagePrompt' that can be fed into an AI image generator to create a visual aid for the activity.
8.  **assessmentQuestions**: Create 10-15 assessment questions that cover all the key content from the chapter.
9.  **conclusion**: Write a strong conclusion that emphasizes the importance of the chapter in the student's real life and its potential future impact, inspiring a sense of seriousness and curiosity.

Ensure all Kannada text is accurate and appropriate for a young learner.
`,
});

const generatePracticeHandoutFlow = ai.defineFlow(
  {
    name: 'generatePracticeHandoutFlow',
    inputSchema: GeneratePracticeHandoutInputSchema,
    outputSchema: GeneratePracticeHandoutOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
