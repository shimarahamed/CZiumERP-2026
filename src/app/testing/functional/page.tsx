
'use client';

import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ShieldCheck, Laptop, Smartphone, Rocket, Users as UsersIcon } from "@/components/icons";

const functionalTests = [
    { title: "Core Workflows", description: "Verify user authentication, registration, search, and core business processes." },
    { title: "Transactions/Forms", description: "Test inputs, data submission, and validation rules for all forms." },
    { title: "Integrations", description: "Validate connections between modules, API endpoints, or third-party tools." },
];

const nonFunctionalTests = [
    { title: "Performance & Load", description: "Test response times, stress, and stability under high traffic.", icon: Rocket },
    { title: "Usability (UX)", description: "Evaluate ease of use, navigation, and accessibility.", icon: UsersIcon },
    { title: "Security", description: "Scan for vulnerabilities like SQL injection, cross-site scripting (XSS), and data leakage.", icon: ShieldCheck },
    { title: "Compatibility", description: "Check app behavior across different mobile OS (Android/iOS), browsers (Chrome, Firefox, Safari), and screen resolutions.", icon: Smartphone },
];

export default function FunctionalTestingPage() {
    return (
        <div className="flex flex-col h-full">
            <Header title="System Testing Checklist" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                 <div className="grid md:grid-cols-2 gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Functional Testing</CardTitle>
                            <CardDescription>Does the application work as expected?</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {functionalTests.map((item) => (
                                <div key={item.title} className="flex items-start gap-3">
                                    <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-semibold">{item.title}</h4>
                                        <p className="text-sm text-muted-foreground">{item.description}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>Non-Functional Testing</CardTitle>
                            <CardDescription>How well does the application work?</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             {nonFunctionalTests.map((item) => (
                                <div key={item.title} className="flex items-start gap-3">
                                    <item.icon className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-semibold">{item.title}</h4>
                                        <p className="text-sm text-muted-foreground">{item.description}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
