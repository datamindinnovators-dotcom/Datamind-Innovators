
'use server';

/**
 * @fileOverview A Genkit flow for a chatbot that answers questions grounded in textbook content.
 * The AI determines the appropriate subject and grade from the user's question.
 *
 * - textbookChat - A function that answers a question based on a specific textbook.
 * - TextbookChatInput - The input type for the textbookChat function.
 * - TextbookChatOutput - The return type for the textbookChat function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getTextbooks, Textbook } from '@/lib/textbook-actions';

const TextbookChatInputSchema = z.object({
  question: z.string().describe('The question the user is asking.'),
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).optional().describe('The history of the conversation.'),
});
export type TextbookChatInput = z.infer<typeof TextbookChatInputSchema>;

const TextbookChatOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer to the question.'),
});
export type TextbookChatOutput = z.infer<typeof TextbookChatOutputSchema>;

export async function textbookChat(input: TextbookChatInput): Promise<TextbookChatOutput> {
  return textbookChatFlow(input);
}

const contextSelectionPrompt = ai.definePrompt({
    name: 'textbookContextSelectionPrompt',
    input: {
        schema: z.object({
            question: z.string(),
            availableContexts: z.array(z.object({
                subject: z.string(),
                grade: z.number(),
            })),
        }),
    },
    output: {
        schema: z.object({
            isAcademic: z.boolean().describe("Set to true if the user's question seems to be about a school subject and requires a textbook to answer. Otherwise, set to false."),
            subject: z.string().optional().describe("The subject that best matches the user's question, if academic."),
            grade: z.coerce.number().optional().describe("The grade that best matches the user's question, if academic."),
            reasoning: z.string().describe("A brief explanation for why this context was chosen."),
        }),
    },
    prompt: `You are an expert at routing student questions.
    
    First, determine if the user's question is academic and requires a textbook to answer, or if it's a general greeting or conversational question.
  
    If it is academic, determine the single most appropriate subject and grade from the list of available options.
  
    Available Subject and Grade Contexts:
    {{#each availableContexts}}
    - Subject: {{{subject}}}, Grade: {{{grade}}}
    {{/each}}
  
    User Question: "{{{question}}}"
  
    Your task is to select the best subject and grade from the list if the question is academic. Do not make up a subject or grade that is not in the provided list.
    Provide your answer in the specified JSON format.`,
});


const answerPrompt = ai.definePrompt({
  name: 'textbookAnswerPrompt',
  input: {
    schema: z.object({
      question: z.string(),
      subject: z.string(),
      grade: z.number(),
      englishTextbookUrl: z.string().optional(),
      kannadaTextbookUrl: z.string().optional(),
      chatHistory: z.array(z.object({
        role: z.enum(['user', 'model']),
        content: z.string(),
      })).optional(),
    }),
  },
  output: { schema: TextbookChatOutputSchema },
  prompt: `You are a friendly and helpful teaching assistant for young students in Karnataka, India. Your role is to answer student questions clearly and simply.

  You MUST base your answers strictly on the content provided in the following Grade {{{grade}}} {{{subject}}} textbooks. Do not use any external knowledge. If the answer is not in the textbooks, say "I can't find the answer to that in the textbook. Please ask your teacher for help."

  Here is the content of the textbooks:
  - English Textbook: {{media url=englishTextbookUrl}}
  - Kannada Textbook: {{media url=kannadaTextbookUrl}}

  Here is the history of our conversation so far:
  {{#each chatHistory}}
    {{this.role}}: {{{this.content}}}
  {{/each}}

  Now, please answer the following question:
  Question: {{{question}}}
  `,
});


const conversationalPrompt = ai.definePrompt({
    name: 'conversationalPrompt',
    input: {
        schema: z.object({
            question: z.string(),
            chatHistory: z.array(z.object({
                role: z.enum(['user', 'model']),
                content: z.string(),
            })).optional(),
        }),
    },
    output: { schema: TextbookChatOutputSchema },
    prompt: `You are a friendly and helpful teaching assistant chatbot named Knowledge Hub. Answer the following question conversationally.
    
    History:
    {{#each chatHistory}}
        {{this.role}}: {{{this.content}}}
    {{/each}}

    Question: {{{question}}}
    `
});

const textbookChatFlow = ai.defineFlow(
  {
    name: 'textbookChatFlow',
    inputSchema: TextbookChatInputSchema,
    outputSchema: TextbookChatOutputSchema,
  },
  async ({ question, chatHistory }) => {
    // 1. Get all available subjects and grades
    const allTextbooks = await getTextbooks();
    if (allTextbooks.length === 0) {
      return { answer: "I'm sorry, no textbooks have been configured. Please ask the administrator to add some." };
    }

    const availableContexts = allTextbooks.map(tb => ({
        subject: tb.subject,
        grade: tb.grade,
    }));


    // 2. Ask the AI to determine if the question is academic and which context to use
    const contextResult = await contextSelectionPrompt({
        question,
        availableContexts,
    });
    
    if (!contextResult.output) {
      return { answer: "I'm sorry, I had trouble understanding your question. Could you please rephrase it?" };
    }

    // 3. If the question is not academic, provide a conversational response.
    if (!contextResult.output.isAcademic) {
        const { output } = await conversationalPrompt({ question, chatHistory });
        return output!;
    }
    
    const { subject, grade } = contextResult.output;
    
    // 4. If academic, find the selected textbook.
    if (!subject || !grade) {
        return { answer: "I'm sorry, I wasn't able to determine the correct subject for your question. Could you be more specific?" };
    }

    const selectedTextbook = allTextbooks.find(tb => tb.subject === subject && tb.grade === grade);

    if (!selectedTextbook) {
      return { answer: `I'm sorry, I could not find the right textbook for that question. I can answer questions about the following subjects: ${[...new Set(allTextbooks.map(tb => tb.subject))].join(', ')}.` };
    }

    // 5. Ask the AI to answer the question using the determined textbooks
    const { output } = await answerPrompt({
      question,
      subject: selectedTextbook.subject,
      grade: selectedTextbook.grade,
      englishTextbookUrl: selectedTextbook.englishLink,
      kannadaTextbookUrl: selectedTextbook.kannadaLink,
      chatHistory,
    });

    if (!output) {
        return { answer: "I'm sorry, I had trouble generating an answer. Please try again." };
    }

    return output;
  }
);
