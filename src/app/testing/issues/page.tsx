
'use client';

import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle } from "@/components/icons";

const limitations = [
  {
    title: "Authentication and Security",
    status: "critical",
    description: "The current login system is a mock-up and not secure for production use. There are also no database security rules, leaving your data vulnerable.",
    fix: "Implement Firebase Authentication for secure user logins and session management. Create and deploy Firestore Security Rules to control data access based on user roles.",
  },
  {
    title: "Data Scalability",
    status: "in-progress",
    description: "Some pages still load all data into memory, which is not scalable. This can lead to slow performance as your business grows.",
    fix: "Apply server-side querying patterns to all remaining pages (Products, Customers, etc.) to only fetch necessary data from the database.",
  },
  {
    title: "Build & Hosting Configuration",
    status: "fixed",
    description: "The build process was configured to ignore code quality checks and image optimization was disabled.",
    fix: "The build configuration has been hardened to enforce code quality, and image optimization should be enabled before a final production deployment.",
  },
  {
    title: "Offline Data Merge Conflicts",
    status: "critical",
    description: "If two users edit the same record while offline, the last person to sync their data will overwrite the other's changes without warning.",
    fix: "This requires implementing a data merge strategy. This is a complex feature that involves detecting conflicts and potentially asking the user to manually resolve them.",
  },
   {
    title: "Real-time Collaboration",
    status: "in-progress",
    description: "The application was previously offline-by-default, meaning users would not see real-time updates from others.",
    fix: "The app now defaults to an online mode, enabling real-time data synchronization. This is a major step forward.",
  },
];

export default function SystemIssuesPage() {
    return (
        <div className="flex flex-col h-full">
            <Header title="System Issues & Production Readiness" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>System Status</CardTitle>
                        <CardDescription>A summary of remaining limitations for a production-ready system.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {limitations.map((item) => (
                            <Card key={item.title}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg">{item.title}</CardTitle>
                                        <Badge variant={item.status === 'critical' ? 'destructive' : item.status === 'fixed' ? 'outline' : 'default'}>
                                            {item.status === 'critical' && <AlertTriangle className="mr-2 h-4 w-4" />}
                                            {item.status === 'fixed' && <CheckCircle className="mr-2 h-4 w-4" />}
                                            {item.status}
                                        </Badge>
                                    </div>
                                    <CardDescription>{item.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <h4 className="font-semibold mb-2">Recommended Fix</h4>
                                    <p className="text-sm text-muted-foreground">{item.fix}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
