"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Users, CalendarClock, BookOpen } from "lucide-react";

const navLinks = [
    { href: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
    { href: "/admin/students", label: "Students", icon: <Users /> },
    { href: "/admin/timetable", label: "Timetable", icon: <CalendarClock /> },
    { href: "/admin/textbooks", label: "Textbooks", icon: <BookOpen /> },
];

export function AdminNav() {
    const pathname = usePathname();

    return (
        <div className="border-b">
            <Tabs value={pathname} className="container mx-auto px-4 md:px-8 my-4">
                <TabsList className="h-auto p-0 bg-transparent rounded-none gap-2">
                    {navLinks.map((link) => (
                        <TabsTrigger key={link.href} value={link.href} asChild className="data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-12 px-4 font-semibold">
                            <Link href={link.href} className="flex items-center gap-2">
                                {link.icon}
                                {link.label}
                            </Link>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
        </div>
    );
}
