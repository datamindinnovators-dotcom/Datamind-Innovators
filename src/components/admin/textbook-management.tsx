
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2, BookOpen, BookPlus, ArrowLeft, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Textbook } from '@/lib/textbooks';
import { getTextbooks, addTextbookEntry, deleteTextbookEntry } from '@/lib/textbook-actions';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function TextbookManagement() {
    const [textbooks, setTextbooks] = useState<Textbook[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [textbookToDelete, setTextbookToDelete] = useState<Textbook | null>(null);

    // Form state
    const [subject, setSubject] = useState('');
    const [grade, setGrade] = useState('');
    const [englishLink, setEnglishLink] = useState('');
    const [kannadaLink, setKannadaLink] = useState('');

    useEffect(() => {
        const fetchTextbooks = async () => {
            setIsLoading(true);
            try {
                const textbookList = await getTextbooks();
                setTextbooks(textbookList);
            } catch (error: any) {
                console.error(error);
                toast({
                    variant: 'destructive',
                    title: 'Failed to load textbooks',
                    description: error.message || 'Could not fetch textbook data.'
                });
            } finally {
                setIsLoading(false);
            }
        };
        fetchTextbooks();
    }, [toast]);

    const handleAddEntry = (e: React.FormEvent) => {
        e.preventDefault();
        const gradeNumber = parseInt(grade, 10);
        if (!subject || !grade || !englishLink || !kannadaLink || isNaN(gradeNumber)) {
            toast({ variant: 'destructive', title: 'Missing or Invalid Fields', description: 'Please fill out all fields correctly.' });
            return;
        }

        startTransition(async () => {
            try {
                const newEntry = await addTextbookEntry({
                    subject,
                    grade: gradeNumber,
                    englishLink,
                    kannadaLink
                });
                setTextbooks(prev => [...prev, newEntry].sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject)));
                toast({ title: 'Success', description: 'Textbook entry added.' });
                // Reset form
                setSubject('');
                setGrade('');
                setEnglishLink('');
                setKannadaLink('');
            } catch (error: any) {
                console.error("Failed to add entry:", error);
                toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not add textbook entry.' });
            }
        });
    };

    const handleDeleteEntry = (textbookId: string) => {
        startTransition(async () => {
            try {
                await deleteTextbookEntry(textbookId);
                setTextbooks(prev => prev.filter(entry => entry.id !== textbookId));
                toast({ title: 'Success', description: 'Textbook entry deleted.' });
            } catch (error) {
                console.error("Failed to delete entry:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not delete textbook entry.' });
            } finally {
                setTextbookToDelete(null);
            }
        });
    };

    return (
        <div className="container mx-auto p-4 md:p-8">
             <AlertDialog open={!!textbookToDelete} onOpenChange={(open) => !open && setTextbookToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the textbook for <span className='font-bold'>{textbookToDelete?.subject} - Grade {textbookToDelete?.grade}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setTextbookToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => textbookToDelete && handleDeleteEntry(textbookToDelete.id)}
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={isPending}
                        >
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold font-headline">Textbook Management</h2>
                <Button asChild variant="outline">
                    <Link href="/admin/dashboard">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><BookPlus />Add Textbook</CardTitle>
                            <CardDescription>Add a new textbook to the collection.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleAddEntry} className="space-y-4">
                                <Input placeholder="Subject Name (e.g. EVS)" value={subject} onChange={e => setSubject(e.target.value)} disabled={isPending} />
                                <Input type="number" placeholder="Grade (e.g. 4)" value={grade} onChange={e => setGrade(e.target.value)} disabled={isPending} />
                                <Input placeholder="English PDF Link" value={englishLink} onChange={e => setEnglishLink(e.target.value)} disabled={isPending} />
                                <Input placeholder="Kannada PDF Link" value={kannadaLink} onChange={e => setKannadaLink(e.target.value)} disabled={isPending} />
                                <Button type="submit" className="w-full" disabled={isPending}>
                                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Add Textbook
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'><BookOpen/>Textbook Collection</CardTitle>
                            <CardDescription>List of all textbooks in the database.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Subject</TableHead>
                                        <TableHead>Grade</TableHead>
                                        <TableHead>Links</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center">
                                                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                                            </TableCell>
                                        </TableRow>
                                    ) : textbooks.length > 0 ? (
                                        textbooks.map(entry => (
                                            <TableRow key={entry.id}>
                                                <TableCell className="font-medium">{entry.subject}</TableCell>
                                                <TableCell>{entry.grade}</TableCell>
                                                <TableCell>
                                                    <div className='flex items-center gap-4'>
                                                        <a href={entry.englishLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                                                           <LinkIcon className="h-4 w-4" /> English
                                                        </a>
                                                        <a href={entry.kannadaLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                                                            <LinkIcon className="h-4 w-4" /> Kannada
                                                        </a>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => setTextbookToDelete(entry)} disabled={isPending}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                                                No textbooks found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
