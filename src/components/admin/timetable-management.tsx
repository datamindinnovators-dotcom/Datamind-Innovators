
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2, CalendarPlus, Clock, Book, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { TimetableEntry } from '@/lib/timetable';
import { getTimetable, addTimetableEntry, deleteTimetableEntry, getTodaysTimetable } from '@/lib/timetable-actions';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function TimetableManagement() {
    const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
    const [todaysTimetable, setTodaysTimetable] = useState<TimetableEntry[]>([]);
    const [liveClassId, setLiveClassId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    // Form state
    const [day, setDay] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [subject, setSubject] = useState('');

    useEffect(() => {
        const fetchTimetableData = async () => {
            setIsLoading(true);
            try {
                const [allTimetableData, todaysTimetableData] = await Promise.all([
                    getTimetable(),
                    getTodaysTimetable()
                ]);
                setTimetable(allTimetableData);
                setTodaysTimetable(todaysTimetableData);
            } catch (error) {
                console.error("Failed to load timetable data:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load timetable data.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchTimetableData();
    }, [toast]);

    useEffect(() => {
        const checkLiveClass = () => {
            if (todaysTimetable.length === 0) {
                setLiveClassId(null);
                return;
            }

            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            const currentClass = todaysTimetable.find(c => {
                return c.startTime <= currentTime && c.endTime > currentTime;
            });
            
            setLiveClassId(currentClass?.id || null);
        };

        checkLiveClass();
        const interval = setInterval(checkLiveClass, 10000); // Check every 10 seconds

        return () => clearInterval(interval);
    }, [todaysTimetable]);

    const handleAddEntry = (e: React.FormEvent) => {
        e.preventDefault();
        if (!day || !startTime || !endTime || !subject) {
            toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill out all fields.' });
            return;
        }
        if (startTime >= endTime) {
            toast({ variant: 'destructive', title: 'Invalid Time', description: 'Start time must be before end time.' });
            return;
        }

        startTransition(async () => {
            try {
                const newEntry = await addTimetableEntry({
                    day: day as TimetableEntry['day'],
                    startTime,
                    endTime,
                    subject,
                });
                setTimetable(prev => [...prev, newEntry].sort((a, b) => {
                    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                    if (dayOrder.indexOf(a.day) !== dayOrder.indexOf(b.day)) {
                      return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
                    }
                    return a.startTime.localeCompare(b.startTime);
                }));
                toast({ title: 'Success', description: 'Timetable entry added.' });
                // Reset form
                setDay('');
                setStartTime('');
                setEndTime('');
                setSubject('');
            } catch (error) {
                console.error("Failed to add entry:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not add timetable entry.' });
            }
        });
    };

    const handleDeleteEntry = (entryId: string) => {
        startTransition(async () => {
            try {
                await deleteTimetableEntry(entryId);
                setTimetable(prev => prev.filter(entry => entry.id !== entryId));
                toast({ title: 'Success', description: 'Timetable entry deleted.' });
            } catch (error) {
                console.error("Failed to delete entry:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not delete timetable entry.' });
            }
        });
    };


    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold font-headline">Timetable Management</h2>
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
                            <CardTitle className="flex items-center gap-2"><CalendarPlus />Add Timetable Entry</CardTitle>
                            <CardDescription>Add a new class to the schedule.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleAddEntry} className="space-y-4">
                                <Select onValueChange={setDay} value={day}>
                                    <SelectTrigger><SelectValue placeholder="Select Day" /></SelectTrigger>
                                    <SelectContent>
                                        {daysOfWeek.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <div className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-muted-foreground" />
                                    <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} disabled={isPending} />
                                    <span>-</span>
                                    <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} disabled={isPending} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Book className="h-5 w-5 text-muted-foreground" />
                                    <Input placeholder="Subject Name" value={subject} onChange={e => setSubject(e.target.value)} disabled={isPending} />
                                </div>
                                <Button type="submit" className="w-full" disabled={isPending}>
                                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Add Entry
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Weekly Schedule</CardTitle>
                            <CardDescription>Overview of all classes scheduled for the week.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Day</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Subject</TableHead>
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
                                    ) : timetable.length > 0 ? (
                                        timetable.map(entry => (
                                            <TableRow key={entry.id} className={liveClassId === entry.id ? "bg-primary/10" : ""}>
                                                <TableCell className="font-medium">{entry.day}</TableCell>
                                                <TableCell>{entry.startTime} - {entry.endTime}</TableCell>
                                                <TableCell>
                                                    <div className='flex items-center gap-2'>
                                                        {entry.subject}
                                                        {liveClassId === entry.id && (
                                                             <Badge className="bg-green-500 hover:bg-green-500/90 text-white">LIVE</Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteEntry(entry.id)} disabled={isPending}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                                                No timetable entries found.
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
