
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export const StatCard = ({ title, value, icon: Icon, trend, color, isProtected }) => (
    <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                    {title}
                </CardTitle>
                {Icon && (
                    <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                )}
            </div>
        </CardHeader>
        <CardContent className="pt-0">
            <div className="space-y-2">
                <div className={`text-2xl font-bold text-gray-900 ${isProtected ? 'blur-sm' : ''}`}>{value}</div>
                {trend && (
                    <div className={`flex items-center gap-1 text-sm ${trend.startsWith('-') ? 'text-red-600' : 'text-green-600'} ${isProtected ? 'blur-sm' : ''}`}>
                        {trend.startsWith('-') ? (
                            <TrendingUp className="w-4 h-4 rotate-180" />
                        ) : (
                            <TrendingUp className="w-4 h-4" />
                        )}
                        <span>{trend}</span>
                    </div>
                )}
            </div>
        </CardContent>
    </Card>
);

