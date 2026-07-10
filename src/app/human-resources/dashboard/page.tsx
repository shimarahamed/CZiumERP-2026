
'use client'

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import { useAppContext } from "@/context/AppContext";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';
import { User, Calendar, CheckSquare, Users, UserCheck, UserX, Plane, ArrowRight, UserPlus } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageSkeleton } from '@/components/PageSkeleton';

const QuickLinkCard = ({ href, title, description, icon: Icon }: { href: string, title: string, description: string, icon: React.ElementType }) => (
    <Link href={href}>
        <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors flex items-start gap-4">
            <div className="p-2 bg-primary/10 rounded-lg mt-1">
                <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground ml-auto self-center" />
        </div>
    </Link>
);


export default function HRDashboardPage() {
    const { user, employees, attendance, leaveRequests, isDataLoaded } = useAppContext();
    
    const canManage = user?.role === 'admin' || user?.role === 'manager';

    const currentEmployee = useMemo(() => employees.find(e => e.userId === user?.id), [employees, user?.id]);
    
    const leaveBalance = useMemo(() => {
        if (!currentEmployee) return { allowance: 0, taken: 0, balance: 0 };
        const allowance = currentEmployee.annualLeaveAllowance || 0;
        const taken = currentEmployee.leaveTaken || 0;
        return { allowance, taken, balance: allowance - taken };
    }, [currentEmployee]);
    
    const pendingApprovals = useMemo(() => {
        if (!canManage) return 0;
        return leaveRequests.filter(lr => lr.status === 'pending').length;
    }, [leaveRequests, canManage]);
    
    const attendanceForToday = useMemo(() => {
        const dateStr = format(new Date(), 'yyyy-MM-dd');
        return attendance.filter(a => a.date === dateStr);
    }, [attendance]);
    
    const attendanceSummary = useMemo(() => {
        const present = attendanceForToday.filter(a => a.status === 'present').length;
        const onLeave = attendanceForToday.filter(a => a.status === 'leave' || a.status === 'half-day').length;
        const absent = employees.length - present - onLeave;
        return { present, absent, onLeave };
    }, [employees, attendanceForToday]);
    
    
    if (!isDataLoaded) return <PageSkeleton cardCount={6} hasFilters={false} />;

    return (
        <div className="flex flex-col h-full">
            <Header title="Human Resources Dashboard" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">My Leave Balance</CardTitle>
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{leaveBalance.balance} Days</div>
                            <p className="text-xs text-muted-foreground">Remaining of {leaveBalance.allowance} days</p>
                        </CardContent>
                    </Card>
                    {canManage && (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                                <CheckSquare className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{pendingApprovals}</div>
                                <p className="text-xs text-muted-foreground">Leave requests needing review</p>
                            </CardContent>
                        </Card>
                    )}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{employees.length}</div>
                            <p className="text-xs text-muted-foreground">Across all departments</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Today&apos;s Attendance</CardTitle>
                        </CardHeader>
                        <CardContent className="flex justify-around items-center">
                            <div className="text-center">
                                <UserCheck className="h-6 w-6 text-green-500 mx-auto"/>
                                <p className="font-bold text-lg">{attendanceSummary.present}</p>
                                <p className="text-xs text-muted-foreground">Present</p>
                            </div>
                            <div className="text-center">
                                <UserX className="h-6 w-6 text-red-500 mx-auto"/>
                                <p className="font-bold text-lg">{attendanceSummary.absent}</p>
                                <p className="text-xs text-muted-foreground">Absent</p>
                            </div>
                            <div className="text-center">
                                <Plane className="h-6 w-6 text-blue-500 mx-auto"/>
                                <p className="font-bold text-lg">{attendanceSummary.onLeave}</p>
                                <p className="text-xs text-muted-foreground">On Leave</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <Card>
                        <CardHeader><CardTitle>Quick Links</CardTitle><CardDescription>Navigate to key HR functions.</CardDescription></CardHeader>
                        <CardContent className="space-y-4">
                        <QuickLinkCard href="/human-resources/employees" title="Employee Directory" description="View and manage all employees." icon={Users} />
                        <QuickLinkCard href="/human-resources/leave-requests" title="Leave Management" description="Request leave and manage approvals." icon={Calendar} />
                        <QuickLinkCard href="/human-resources/recruitment" title="Recruitment Pipeline" description="Track candidates and manage hiring." icon={UserPlus} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>My Profile</CardTitle><CardDescription>Your personal information at a glance.</CardDescription></CardHeader>
                        <CardContent className="space-y-4">
                        <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={user?.avatar} data-ai-hint="person user"/>
                                    <AvatarFallback>{user?.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="text-lg font-bold">{user?.name}</h3>
                                    <p className="text-sm text-muted-foreground">{currentEmployee?.jobTitle}</p>
                                    <p className="text-sm text-muted-foreground">{currentEmployee?.department}</p>
                                </div>
                        </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
