
"use client";

import React, { useState, useTransition, useEffect } from 'react';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";

import { GeneratePracticeHandoutOutput, generatePracticeHandout } from "@/ai/flows/generate-practice-tasks";
import { generateImageFromPrompt } from "@/ai/flows/generate-image-from-prompt";
import { generateLessonPlan, GenerateLessonPlanOutput } from '@/ai/flows/generate-lesson-plan';
import { getTextbookLink, getUniqueSubjectsAndGrades, UniqueSubjectGrade } from '@/lib/textbook-actions';
import { getLatestLessonPlan, saveLessonPlan } from '@/lib/lesson-plan-actions';
import { generateBlackboardLayout } from '@/ai/flows/generate-blackboard-layout';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, Sparkles, ClipboardList, AlertCircle, Image as ImageIcon, BookOpen, FileText, Save, Download, Brush } from 'lucide-react';
import { getStrugglingStudents, StrugglingStudent } from '@/lib/student-actions';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '../ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Textarea } from '../ui/textarea';
import { TeacherChatbot } from './teacher-chatbot';

const handoutFormSchema = z.object({
  studentId: z.string().nonempty("Please select a student."),
  topic: z.string().min(3, "Topic must be at least 3 characters."),
});

const lessonPlanFormSchema = z.object({
    subject: z.string().nonempty("Please select a subject."),
    grade: z.coerce.number({invalid_type_error: "Please select a grade."}).positive(),
    chapterName: z.string().min(3, "Chapter name must be at least 3 characters."),
    duration: z.coerce.number().positive("Duration must be a positive number."),
});

const blackboardFormSchema = z.object({
    lessonTopic: z.string().min(3, "Lesson topic must be at least 3 characters."),
    lessonDescription: z.string().min(10, "Lesson description must be at least 10 characters."),
});

type ActivityWithImage = GeneratePracticeHandoutOutput['handsOnActivities'][0] & {
    imageDataUri?: string;
    isGeneratingImage?: boolean;
}

function StudentSupportTab() {
    const { toast } = useToast();
    const [isHandoutPending, startHandoutTransition] = useTransition();
    
    const [generatedHandout, setGeneratedHandout] = useState<GeneratePracticeHandoutOutput | null>(null);
    const [activities, setActivities] = useState<ActivityWithImage[]>([]);

    const [strugglingStudents, setStrugglingStudents] = useState<StrugglingStudent[]>([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(true);
    const [isFetchingLinks, setIsFetchingLinks] = useState(false);

    const handoutForm = useForm<z.infer<typeof handoutFormSchema>>({
        resolver: zodResolver(handoutFormSchema),
        defaultValues: { studentId: "", topic: "" },
    });

    useEffect(() => {
        const fetchStrugglingStudents = async () => {
            setIsLoadingStudents(true);
            try {
                const students = await getStrugglingStudents();
                setStrugglingStudents(students);
            } catch (error) {
                 console.error("Failed to fetch struggling students:", error);
                 toast({ variant: "destructive", title: "Error", description: "Could not fetch student performance data." });
            } finally {
                setIsLoadingStudents(false);
            }
        };

        fetchStrugglingStudents();
    }, [toast]);

    const onHandoutSubmit = async (values: z.infer<typeof handoutFormSchema>) => {
        const student = strugglingStudents.find(s => `${s.id}-${s.subject}` === values.studentId);
        if (!student) {
             toast({ variant: "destructive", title: "Error", description: "Could not find the selected student. Please select a student again." });
             return;
        }

        startHandoutTransition(async () => {
            setGeneratedHandout(null);
            setActivities([]);
            
            try {
                setIsFetchingLinks(true);
                const [englishUrl, kannadaUrl] = await Promise.all([
                    getTextbookLink(student.subject, student.grade, 'English'),
                    getTextbookLink(student.subject, student.grade, 'Kannada')
                ]);

                if (!englishUrl || !kannadaUrl) {
                    toast({ variant: "destructive", title: "Textbook Not Found", description: `Could not find a required textbook for ${student.subject}. Please check admin settings.` });
                    setIsFetchingLinks(false);
                    return;
                }
                setIsFetchingLinks(false);

                const result = await generatePracticeHandout({
                    studentName: student.name,
                    engagementHistory: `Struggling with ${student.subject} with an average attention score of ${student.score.toFixed(0)}.`,
                    topic: values.topic,
                    englishTextbookUrl: englishUrl,
                    kannadaTextbookUrl: kannadaUrl,
                });
                
                setGeneratedHandout(result);
                setActivities(result.handsOnActivities.map(a => ({...a, isGeneratingImage: true})));
                toast({ title: "Handout Generated", description: "Personalized handout is ready. Generating images..." });

                result.handsOnActivities.forEach((activity, index) => {
                    generateImageFromPrompt(activity.imagePrompt).then(imageResult => {
                        setActivities(prev => {
                            const newActivities = [...prev];
                            newActivities[index] = { ...newActivities[index], imageDataUri: imageResult.imageDataUri, isGeneratingImage: false };
                            return newActivities;
                        });
                    }).catch(err => {
                        console.error("Image generation failed:", err);
                        toast({ variant: "destructive", title: "Image Error", description: `Failed to generate image for: ${activity.title.english}` });
                         setActivities(prev => {
                            const newActivities = [...prev];
                            newActivities[index] = { ...newActivities[index], isGeneratingImage: false };
                            return newActivities;
                        });
                    })
                });

            } catch (error) {
                toast({ variant: "destructive", title: "Error", description: "Failed to generate handout." });
                setIsFetchingLinks(false);
            }
        });
    };
    
    const handleGenerateHandoutClick = async (student: StrugglingStudent) => {
        handoutForm.reset();
        setGeneratedHandout(null);
        setActivities([]);

        // Fetch the latest lesson plan to get the topic
        const latestPlan = await getLatestLessonPlan(student.subject, student.grade);
        const topic = latestPlan ? latestPlan.lessonName : student.subject; // Fallback to subject name
        if (latestPlan) {
            toast({title: "Context Found", description: `Using recently planned lesson: "${topic}"`});
        }

        handoutForm.setValue('studentId', `${student.id}-${student.subject}`);
        handoutForm.setValue('topic', topic);
        document.getElementById('handout-section')?.scrollIntoView({ behavior: 'smooth' });
    }

    const BilingualDisplay = ({ title, content }: { title: string, content?: { english: string, kannada: string }}) => {
        if (!content) return null;
        return (
            <div className='mb-4'>
                <h4 className="font-semibold text-lg text-primary">{title}</h4>
                <p className="font-bold">English:</p>
                <p className="text-sm pl-2 mb-2">{content.english}</p>
                <p className="font-bold">ಕನ್ನಡ (Kannada):</p>
                <p className="text-sm pl-2 font-kannada">{content.kannada}</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mt-6">
            <div className="lg:col-span-2">
                <Card className="shadow-lg h-full">
                    <CardHeader>
                        <CardTitle className="font-headline flex items-center gap-2">Inattentive Students</CardTitle>
                        <CardDescription>Students who may need additional support, based on recent performance.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <ScrollArea className="h-[600px] pr-4">
                            <div className="space-y-4">
                                 {isLoadingStudents ? (
                                    [...Array(3)].map((_, i) => (
                                        <Card key={i} className="p-4">
                                            <div className="flex items-center gap-4">
                                                <Skeleton className="h-16 w-16 rounded-full" />
                                                <div className="space-y-2 flex-1">
                                                    <Skeleton className="h-4 w-3/4" />
                                                    <Skeleton className="h-4 w-1/2" />
                                                </div>
                                            </div>
                                        </Card>
                                    ))
                                ) : strugglingStudents.length > 0 ? (
                                    strugglingStudents.map((student) => (
                                        <Card key={`${student.id}-${student.subject}`} className="p-4">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                                <Avatar className="h-16 w-16">
                                                    <AvatarImage src={student.photoDataUri} alt={student.name} />
                                                    <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1">
                                                    <p className="font-bold text-lg">{student.name}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        Grade {student.grade} &bull; Needs help in <span className="font-semibold text-primary">{student.subject}</span>
                                                    </p>
                                                     <p className="text-xs text-muted-foreground">
                                                        Score: <span className="font-semibold text-destructive">{student.score.toFixed(0)}</span>
                                                    </p>
                                                </div>
                                                <Button size="sm" variant="outline" onClick={() => handleGenerateHandoutClick(student)}>
                                                    <Sparkles className="mr-2 h-4 w-4" />
                                                    Generate Handout
                                                </Button>
                                            </div>
                                        </Card>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-muted-foreground">
                                        <AlertCircle className="mx-auto h-12 w-12" />
                                        <p className="mt-4 text-sm">No students are currently flagged as inattentive.</p>
                                        <p className="text-xs mt-1">Ensure performance data is being logged and lesson plans are created.</p>
                                    </div>
                                )}
                            </div>
                       </ScrollArea>
                    </CardContent>
                </Card>
            </div>
            <div id="handout-section" className="lg:col-span-3 space-y-8">
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="font-headline flex items-center gap-2"><Sparkles/>Generate Personalized Handout</CardTitle>
                        <CardDescription>Create a detailed, bilingual handout for a selected student.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...handoutForm}>
                            <form onSubmit={handoutForm.handleSubmit(onHandoutSubmit)} className="space-y-4">
                                 <FormField
                                    control={handoutForm.control}
                                    name="studentId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Student</FormLabel>
                                            <FormControl>
                                                <Input
                                                    readOnly
                                                    value={strugglingStudents.find(s => `${s.id}-${s.subject}` === field.value)?.name || 'Select a student from the list'}
                                                    className="font-medium text-primary bg-primary/10"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField control={handoutForm.control} name="topic" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Topic (from latest lesson plan, or can be overridden)</FormLabel>
                                        <FormControl><Input placeholder="e.g., Photosynthesis" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>

                                <Button type="submit" disabled={isHandoutPending || isFetchingLinks}>
                                    {(isHandoutPending || isFetchingLinks) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                                    {isFetchingLinks ? 'Fetching textbooks...' : 'Generate Handout'}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card className="shadow-lg">
                     <CardHeader>
                        <CardTitle className="font-headline flex items-center gap-2"><ClipboardList/>Generated Handout</CardTitle>
                        <CardDescription>The personalized content for the student will appear below.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <ScrollArea className="h-[800px] mt-2 pr-4">
                            {isHandoutPending && !generatedHandout && (
                                 <div className="text-center py-10 text-muted-foreground flex flex-col items-center justify-center gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                    <p className="text-sm">Generating handout content...</p>
                                </div>
                            )}
                            {generatedHandout ? (
                                <div className='space-y-6'>
                                    <BilingualDisplay title='Chapter Title' content={generatedHandout.chapterTitle} />
                                    <BilingualDisplay title='Motto / Proverb' content={generatedHandout.proverb} />
                                    <Separator/>
                                    <BilingualDisplay title='Learning Objective' content={generatedHandout.learningObjective} />
                                    <Separator/>
                                    <div>
                                        <h4 className="font-semibold text-lg text-primary mb-2">Key Vocabulary</h4>
                                        <ul className="space-y-2 list-disc list-inside">
                                            {generatedHandout.keyVocabulary.map((item, i) => (
                                                <li key={i}>
                                                    <strong>{item.word}:</strong>
                                                    <p className="text-sm pl-4"><b>EN:</b> {item.englishExplanation}</p>
                                                    <p className="text-sm pl-4"><b>KA:</b> {item.kannadaExplanation}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                     <Separator/>
                                    <BilingualDisplay title='Opening Activity' content={generatedHandout.openingActivity} />
                                     <Separator/>
                                    <BilingualDisplay title='Concept Explanation' content={generatedHandout.conceptExplanation} />
                                     <Separator/>
                                    <div>
                                        <h4 className="font-semibold text-lg text-primary mb-2">Hands-on Activities</h4>
                                        <Accordion type="single" collapsible className="w-full">
                                            {activities.map((activity, i) => (
                                                <AccordionItem value={`item-${i}`} key={i}>
                                                    <AccordionTrigger>
                                                        <div className='text-left'>
                                                            <p className='font-bold'>{activity.title.english}</p>
                                                            <p className='font-kannada'>{activity.title.kannada}</p>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent>
                                                        <BilingualDisplay title="Description" content={activity.description} />
                                                        {activity.isGeneratingImage ? (
                                                            <div className='flex items-center gap-2 text-muted-foreground'>
                                                                <Loader2 className='h-4 w-4 animate-spin' /> Generating image...
                                                            </div>
                                                        ) : activity.imageDataUri ? (
                                                            <div className="mt-4">
                                                                <h5 className="font-semibold mb-2">Generated Image:</h5>
                                                                <Image src={activity.imageDataUri} alt={activity.title.english} width={400} height={400} className="rounded-lg border shadow-sm" />
                                                            </div>
                                                        ) : (
                                                            <div className='flex items-center gap-2 text-destructive'>
                                                                <AlertCircle className='h-4 w-4' /> Image generation failed.
                                                            </div>
                                                        )}
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                        </Accordion>
                                    </div>
                                     <Separator/>
                                    <div>
                                        <h4 className="font-semibold text-lg text-primary mb-2">Assessment Questions</h4>
                                        <ol className="space-y-2 list-decimal list-inside">
                                           {generatedHandout.assessmentQuestions.map((q, i) => (
                                                <li key={i}>
                                                    <p className="text-sm"><b>EN:</b> {q.english}</p>
                                                    <p className="text-sm font-kannada"><b>KA:</b> {q.kannada}</p>
                                                </li>
                                           ))}
                                        </ol>
                                    </div>
                                    <Separator/>
                                    <BilingualDisplay title='Conclusion' content={generatedHandout.conclusion} />
                                </div>
                            ) : (
                                !isHandoutPending && <p className="text-sm text-muted-foreground">The generated handout will appear here.</p>
                            )}
                         </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function LessonPlannerTab() {
    const { toast } = useToast();
    const [isLessonPlanPending, startLessonPlanTransition] = useTransition();
    const [isSavingPlan, startSavingTransition] = useTransition();
    const [generatedPlan, setGeneratedPlan] = useState<GenerateLessonPlanOutput | null>(null);
    const [availableSubjects, setAvailableSubjects] = useState<UniqueSubjectGrade[]>([]);
    const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);

    const lessonPlanForm = useForm<z.infer<typeof lessonPlanFormSchema>>({
        resolver: zodResolver(lessonPlanFormSchema),
        defaultValues: { subject: "", chapterName: "", duration: '' as any, grade: undefined },
    });
    
    useEffect(() => {
        const fetchSubjects = async () => {
            setIsLoadingSubjects(true);
            try {
                const subjects = await getUniqueSubjectsAndGrades();
                setAvailableSubjects(subjects);
            } catch (error) {
                console.error("Failed to fetch subjects and grades:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not load available subjects for the lesson planner." });
            } finally {
                setIsLoadingSubjects(false);
            }
        };
        fetchSubjects();
    }, [toast]);

    const onLessonPlanSubmit = (values: z.infer<typeof lessonPlanFormSchema>) => {
        startLessonPlanTransition(async () => {
            setGeneratedPlan(null);
            try {
                const result = await generateLessonPlan({
                    subject: values.subject,
                    grade: values.grade,
                    chapterName: values.chapterName,
                    duration: values.duration,
                });
                setGeneratedPlan(result);
                toast({ title: "Lesson Plan Generated", description: "Your new lesson plan is ready." });
            } catch (error) {
                console.error("Lesson plan generation failed:", error);
                toast({ variant: "destructive", title: "Generation Failed", description: "Could not generate the lesson plan. Ensure textbooks for the selected subject and grade exist." });
            }
        });
    };

    const handleSavePlan = () => {
        if (!generatedPlan) return;
        startSavingTransition(async () => {
            try {
                await saveLessonPlan(generatedPlan);
                toast({ title: "Lesson Plan Saved", description: "The plan has been saved to Firestore." });
            } catch (error) {
                console.error("Failed to save lesson plan:", error);
                toast({ variant: "destructive", title: "Save Failed", description: "Could not save the lesson plan." });
            }
        });
    }

    const uniqueSubjects = [...new Set(availableSubjects.map(item => item.subject))];
    const selectedSubject = lessonPlanForm.watch('subject');
    const gradesForSubject = availableSubjects
        .filter(item => item.subject === selectedSubject)
        .map(item => item.grade.toString())
        .sort((a,b) => parseInt(a, 10) - parseInt(b, 10));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
            <div className="lg:col-span-1">
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="font-headline flex items-center gap-2"><BookOpen/>Generate Lesson Plan</CardTitle>
                        <CardDescription>Select a subject and grade to generate a weekly lesson plan using the textbooks in Firestore.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...lessonPlanForm}>
                            <form onSubmit={lessonPlanForm.handleSubmit(onLessonPlanSubmit)} className="space-y-4">
                                <FormField
                                    control={lessonPlanForm.control}
                                    name="subject"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Subject</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingSubjects}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={isLoadingSubjects ? "Loading subjects..." : "Select a subject"} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {uniqueSubjects.map(subject => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                               <FormField
                                    control={lessonPlanForm.control}
                                    name="grade"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Grade</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value?.toString()} disabled={!selectedSubject}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={!selectedSubject ? "Select a subject first" : "Select a grade"} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {gradesForSubject.map(grade => <SelectItem key={grade} value={grade}>{`Grade ${grade}`}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={lessonPlanForm.control}
                                    name="chapterName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Chapter Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g., The Living World" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={lessonPlanForm.control}
                                    name="duration"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Duration (in days)</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="e.g., 5" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" disabled={isLessonPlanPending || isLoadingSubjects}>
                                    {isLessonPlanPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Generate Plan
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
             <div className="lg:col-span-2">
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="font-headline flex items-center justify-between">
                            <span className='flex items-center gap-2'><FileText/>Generated Plan</span>
                            {generatedPlan && (
                                <Button variant="outline" size="sm" onClick={handleSavePlan} disabled={isSavingPlan}>
                                    {isSavingPlan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Plan for Next Class
                                </Button>
                            )}
                        </CardTitle>
                        <CardDescription>The generated lesson plan will appear below.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[600px] w-full">
                            {isLessonPlanPending ? (
                                <div className="text-center py-10 text-muted-foreground flex flex-col items-center justify-center gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                    <p className="text-sm">Generating lesson plan...</p>
                                </div>
                            ) : generatedPlan ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 rounded-lg border bg-muted/50">
                                        <div><span className="font-semibold">Board:</span> {generatedPlan.board}</div>
                                        <div><span className="font-semibold">Grade:</span> {generatedPlan.grade}</div>
                                        <div><span className="font-semibold">Subject:</span> {generatedPlan.subject}</div>
                                        <div><span className="font-semibold">Lesson:</span> {generatedPlan.lessonName}</div>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[15%]">Day</TableHead>
                                                <TableHead className="w-[20%]">Learning Objectives</TableHead>
                                                <TableHead className="w-[25%]">Teaching Activities</TableHead>
                                                <TableHead className="w-[20%]">Learning Resources</TableHead>
                                                <TableHead className="w-[20%]">Assessment / Homework</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {generatedPlan.dailyBreakdown.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="font-medium align-top">{item.day}</TableCell>
                                                    <TableCell className="align-top">
                                                        <ul className="list-disc pl-4 space-y-1">
                                                            {item.learningObjectives.map((li, i) => <li key={i}>{li}</li>)}
                                                        </ul>
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                         <ul className="list-disc pl-4 space-y-1">
                                                            {item.teachingActivities.map((li, i) => <li key={i} >{li}</li>)}
                                                        </ul>
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                         <ul className="list-disc pl-4 space-y-1">
                                                            {item.learningResources.map((li, i) => <li key={i}>{li}</li>)}
                                                        </ul>
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                         <ul className="list-disc pl-4 space-y-1">
                                                            {item.assessmentHomework.map((li, i) => <li key={i}>{li}</li>)}
                                                        </ul>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground p-4">Your lesson plan will appear here.</p>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function BlackboardDesignerTab() {
    const { toast } = useToast();
    const [isGenerating, startTransition] = useTransition();
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);

    const form = useForm<z.infer<typeof blackboardFormSchema>>({
        resolver: zodResolver(blackboardFormSchema),
        defaultValues: { lessonTopic: "", lessonDescription: "" },
    });

    const onSubmit = (values: z.infer<typeof blackboardFormSchema>) => {
        startTransition(async () => {
            setGeneratedImage(null);
            try {
                const result = await generateBlackboardLayout(values);
                setGeneratedImage(result.imageDataUri);
                toast({ title: "Layout Generated", description: "Your blackboard layout is ready." });
            } catch (error) {
                console.error("Blackboard layout generation failed:", error);
                toast({ variant: "destructive", title: "Generation Failed", description: "Could not generate the blackboard layout." });
            }
        });
    };
    
    const handleDownload = () => {
        if (!generatedImage) return;
        const link = document.createElement('a');
        link.href = generatedImage;
        link.download = 'blackboard-layout.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
            <div className="lg:col-span-1">
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="font-headline flex items-center gap-2"><Brush />Generate Blackboard Layout</CardTitle>
                        <CardDescription>Describe your lesson, and the AI will design a visual layout for your blackboard.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="lessonTopic"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Lesson Topic</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g., The Water Cycle" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="lessonDescription"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Key Concepts & Diagrams</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Describe the main points, text, and diagrams to include. For example:&#10;- A large diagram showing evaporation, condensation, and precipitation.&#10;- Key vocabulary: Evaporation, Condensation, Precipitation, Collection.&#10;- A simple explanation of each stage."
                                                    className="min-h-[150px]"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={isGenerating}>
                                    {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Generate Layout
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2">
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="font-headline flex items-center justify-between">
                            <span className="flex items-center gap-2"><ImageIcon />Generated Layout</span>
                            {generatedImage && (
                                <Button variant="outline" size="sm" onClick={handleDownload}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download
                                </Button>
                            )}
                        </CardTitle>
                        <CardDescription>The generated blackboard layout will appear below. You can draw this on your board.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center p-6">
                        {isGenerating ? (
                            <div className="w-full aspect-video bg-muted/50 rounded-lg flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <p className="text-sm">Generating your visual layout...</p>
                                <p className="text-xs">(This can take up to 30 seconds)</p>
                            </div>
                        ) : generatedImage ? (
                            <Image
                                src={generatedImage}
                                alt="Generated blackboard layout"
                                width={800}
                                height={450}
                                className="rounded-lg border shadow-sm object-contain"
                            />
                        ) : (
                             <div className="w-full aspect-video bg-muted/50 rounded-lg flex flex-col items-center justify-center text-center text-muted-foreground">
                                <ImageIcon className="h-12 w-12" />
                                <p className="mt-4 text-sm">Your generated layout will be displayed here.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


export function TeacherDashboard() {
    return (
        <div className="container mx-auto p-4 md:p-8">
            <h2 className="text-3xl font-bold font-headline mb-4">Teacher Dashboard</h2>
             <Tabs defaultValue="student_support">
                <TabsList>
                    <TabsTrigger value="student_support">Student Support</TabsTrigger>
                    <TabsTrigger value="lesson_planner">Lesson Planner</TabsTrigger>
                    <TabsTrigger value="blackboard_designer">Blackboard Designer</TabsTrigger>
                </TabsList>
                <TabsContent value="student_support">
                    <StudentSupportTab />
                </TabsContent>
                <TabsContent value="lesson_planner">
                    <LessonPlannerTab />
                </TabsContent>
                <TabsContent value="blackboard_designer">
                    <BlackboardDesignerTab />
                </TabsContent>
            </Tabs>
            <TeacherChatbot />
        </div>
    );
}

    
