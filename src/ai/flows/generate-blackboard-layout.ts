'use server';
/**
 * @fileOverview A Genkit flow for generating a blackboard layout from a lesson description using Genkit's image generation.
 *
 * - generateBlackboardLayout - A function that takes a lesson topic and description and returns a visual layout image.
 * - GenerateBlackboardLayoutInput - The input type for the generateBlackboardLayout function.
 * - GenerateBlackboardLayoutOutput - The return type for the generateBlackboardLayout function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateBlackboardLayoutInputSchema = z.object({
  lessonTopic: z.string().describe('The main topic of the lesson.'),
  lessonDescription: z.string().describe(
    'A detailed description of the key points, concepts, and diagrams to include in the layout.'
  ),
});
export type GenerateBlackboardLayoutInput = z.infer<
  typeof GenerateBlackboardLayoutInputSchema
>;

const GenerateBlackboardLayoutOutputSchema = z.object({
  imageDataUri: z.string().describe(
    'The generated blackboard layout image as a data URI.'
  ),
});
export type GenerateBlackboardLayoutOutput = z.infer<
  typeof GenerateBlackboardLayoutOutputSchema
>;

export async function generateBlackboardLayout(
  input: GenerateBlackboardLayoutInput
): Promise<GenerateBlackboardLayoutOutput> {
  return generateBlackboardLayoutFlow(input);
}

const generateBlackboardLayoutFlow = ai.defineFlow(
  {
    name: 'generateBlackboardLayoutFlow',
    inputSchema: GenerateBlackboardLayoutInputSchema,
    outputSchema: GenerateBlackboardLayoutOutputSchema,
  },
  async ({ lessonTopic, lessonDescription }) => {
    const prompt = `A visually engaging and well-structured blackboard layout for a lesson on "${lessonTopic}". The style should be a simple chalk sketch drawing on a dark chalkboard. The layout must be clear, easy to read, and suitable for a teacher to replicate.

Incorporate the following key elements from the lesson description:
${lessonDescription}

The final image should have distinct sections for different concepts, use simple sketches or diagrams without text labels, and have clear, legible handwriting-style text for the main content. Do not include any human figures or hands in the image.`;
    
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media?.url) {
      throw new Error("Image generation failed to produce an image.");
    }
    
    return { imageDataUri: media.url };
  }
);
