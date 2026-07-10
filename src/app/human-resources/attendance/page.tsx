
'use client'

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DatePicker } from '@/components/ui/date-picker';
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useAppContext } from "@/context/AppContext";
import { format } from 'date-fns';
import type { AttendanceEntry, AttendanceStatus } from '@/types';
import { UserCheck, UserX, Plane, Clock, Users } from '@/components/icons';
import { TableSkeleton } from '@/components/TableSkeleton';

const AttendanceSummaryCard = ({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

export default function AttendancePage() {
  const { employees, attendance, setAttendance, addActivityLog, user: currentUser, isDataLoaded } = useAppContext();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const attendanceForDate = useMemo(() => {
    const dateStr = format(selectedDate ?? new Date(), 'yyyy-MM-dd');
    return attendance.filter(a => a.date === dateStr);
  }, [attendance, selectedDate]);
  
  const summary = useMemo(() => {
    const employeeStatuses = employees.map(emp => {
      const attendanceRecord = attendanceForDate.find(a => a.employeeId === emp.id);
      return attendanceRecord ? attendanceRecord.status : 'absent';
    });

    return {
      present: employeeStatuses.filter(s => s === 'present').length,
      absent: employeeStatuses.filter(s => s === 'absent').length,
      leave: employeeStatuses.filter(s => s === 'leave').length,
      'half-day': employeeStatuses.filter(s => s === 'half-day').length
    };
  }, [employees, attendanceForDate]);

  const handleMarkAttendance = (employeeId: string, status: AttendanceStatus) => {
    if (!canManage) return;

    const formattedDate = format(selectedDate ?? new Date(), 'yyyy-MM-dd');
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;

    setAttendance(prev => {
        const existingEntryIndex = prev.findIndex(
            a => a.employeeId === employeeId && a.date === formattedDate
        );

        const newEntry: AttendanceEntry = {
            id: `att-${Date.now()}-${employeeId}`,
            employeeId: employeeId,
            date: formattedDate,
            status: status,
        };

        if (existingEntryIndex > -1) {
            const updatedAttendance = [...prev];
            updatedAttendance[existingEntryIndex] = newEntry;
            return updatedAttendance;
        } else {
            return [newEntry, ...prev];
        }
    });

    addActivityLog(
        'Attendance Marked', 
        `Marked ${employee.name} as ${status.replace('-', ' ')} for ${format(selectedDate ?? new Date(), 'PPP')}`
    );
  };
  
  return (
    <div className="flex flex-col h-full">
      <Header title="Manual Attendance" />
      <Breadcrumb items={[{ label: 'Human Resources', href: '/human-resources/employees' }, { label: 'Attendance' }]} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
            <AttendanceSummaryCard title="Total Employees" value={employees.length} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
            <AttendanceSummaryCard title="Present" value={summary.present} icon={<UserCheck className="h-4 w-4 text-green-500" />} />
            <AttendanceSummaryCard title="Absent" value={summary.absent} icon={<UserX className="h-4 w-4 text-red-500" />} />
            <AttendanceSummaryCard title="On Leave" value={summary.leave} icon={<Plane className="h-4 w-4 text-blue-500" />} />
            <AttendanceSummaryCard title="Half-day" value={summary['half-day']} icon={<Clock className="h-4 w-4 text-yellow-500" />} />
        </div>
        <div className="flex flex-col md:flex-row justify-end md:items-center gap-4 mb-4">
             <DatePicker date={selectedDate} setDate={setSelectedDate} />
        </div>
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead className="w-[180px]">Status for {format(selectedDate ?? new Date(), 'PPP')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    {!isDataLoaded ? (
                      <TableSkeleton rows={8} cols={4} />
                    ) : (
                    <TableBody>
                        {employees.map(employee => {
                            const currentStatus = attendanceForDate.find(a => a.employeeId === employee.id)?.status;
                            return (
                            <TableRow key={employee.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarImage src={employee.avatar} alt={employee.name} data-ai-hint="person user" />
                                            <AvatarFallback>{employee.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col min-w-0">
                                           <span className="truncate">{employee.name}</span>
                                           <span className="text-sm text-muted-foreground truncate">{employee.jobTitle}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Select
                                        value={currentStatus || 'absent'}
                                        onValueChange={(status: AttendanceStatus) => handleMarkAttendance(employee.id, status)}
                                        disabled={!canManage}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="present">Present</SelectItem>
                                            <SelectItem value="absent">Absent</SelectItem>
                                            <SelectItem value="leave">On Leave</SelectItem>
                                            <SelectItem value="half-day">Half-day</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                            </TableRow>
                            )
                        })}
                    </TableBody>
                    )}
                </Table>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}

    

