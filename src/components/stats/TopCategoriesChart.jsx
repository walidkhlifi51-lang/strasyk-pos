import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444'];

export default function TopCategoriesChart({ data }) {
    const topCategories = data
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8);

    if (topCategories.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Top 8 Catégories</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-500 text-center py-8">Aucune donnée de vente disponible</p>
                </CardContent>
            </Card>
        );
    }

    const chartData = topCategories.map(cat => ({
        name: cat.name,
        revenue: cat.revenue,
        quantity: cat.quantity
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Top 8 Catégories par Chiffre d'Affaires</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                            dataKey="name" 
                            angle={-45}
                            textAnchor="end"
                            height={100}
                            interval={0}
                        />
                        <YAxis />
                        <Tooltip 
                            formatter={(value, name) => {
                                if (name === 'revenue') return [`${value.toFixed(2)}€`, 'Chiffre d\'Affaires'];
                                if (name === 'quantity') return [value, 'Quantité Vendue'];
                                return value;
                            }}
                        />
                        <Bar dataKey="revenue" fill="#4F46E5" radius={[8, 8, 0, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
