"use client";

import React, { useState, useRef, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MessageSquare, Loader2, Send, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { textbookChat } from '@/ai/flows/textbook-chat';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { Icons } from '../icons';

type Message = {
    role: 'user' | 'model';
    content: string;
};

const chatFormSchema = z.object({
  question: z.string().min(1, 'Please enter a question.'),
});


export function TeacherChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [messages, setMessages] = useState<Message[]>([]);

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    const chatForm = useForm<z.infer<typeof chatFormSchema>>({
        resolver: zodResolver(chatFormSchema),
        defaultValues: { question: '' },
    });
    
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                { role: 'model', content: "Hi! I can answer questions based on the class textbooks. What would you like to know?" }
            ]);
        }
    }, [isOpen, messages.length]);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);
    
    const handleChatSubmit = (values: z.infer<typeof chatFormSchema>) => {
        const question = values.question;
        
        const newMessages: Message[] = [...messages, { role: 'user', content: question }];
        setMessages(newMessages);
        chatForm.reset();

        startTransition(async () => {
            try {
                const result = await textbookChat({
                    question,
                    chatHistory: messages,
                });
                setMessages([...newMessages, { role: 'model', content: result.answer }]);
            } catch (error) {
                console.error('Chatbot error:', error);
                setMessages([
                    ...newMessages,
                    { role: 'model', content: "Sorry, I encountered an error. Please try again." },
                ]);
                toast({ variant: 'destructive', title: 'Chatbot Error', description: 'Could not get an answer from the AI.' });
            }
        });
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button className="fixed bottom-8 right-8 rounded-full h-16 w-16 shadow-lg z-50">
                    {isOpen ? <X className="h-8 w-8" /> : <MessageSquare className="h-8 w-8" />}
                </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-[400px] p-0 mr-4 mb-2" sideOffset={16}>
                <Card className="flex flex-col h-[60vh] shadow-none border-none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <Icons.logo className="h-6 w-6 text-primary" /> Knowledge Hub
                        </CardTitle>
                        <CardDescription>Answers questions based on textbook content.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden p-4 pt-0">
                        <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
                            <div className="space-y-4">
                                {messages.map((message, index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            'flex gap-2 text-sm',
                                            message.role === 'user' ? 'justify-end' : 'justify-start'
                                        )}
                                    >
                                        {message.role === 'model' && <Icons.logo className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />}
                                        <div
                                            className={cn(
                                                'rounded-lg px-3 py-2 max-w-[80%]',
                                                message.role === 'user'
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted'
                                            )}
                                        >
                                            {message.content}
                                        </div>
                                    </div>
                                ))}
                                {isPending && (
                                     <div className='flex gap-2 text-sm justify-start'>
                                         <Icons.logo className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                                         <div className='rounded-lg px-3 py-2 max-w-[80%] bg-muted flex items-center gap-2'>
                                             <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
                                         </div>
                                     </div>
                                )}
                            </div>
                        </ScrollArea>
                        <Form {...chatForm}>
                            <form onSubmit={chatForm.handleSubmit(handleChatSubmit)} className="flex items-start gap-2 pt-4 border-t">
                                 <FormField
                                    control={chatForm.control}
                                    name="question"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <Input {...field} placeholder="Ask a question..." autoComplete="off" disabled={isPending}/>
                                            </FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" size="icon" disabled={isPending}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </PopoverContent>
        </Popover>
    );
}
