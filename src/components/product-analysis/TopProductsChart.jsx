import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Package } from 'lucide-react';

const safeToFixed = (num) => (typeof num === 'number' ? num.toFixed(2) : '0.00');

export default function TopProductsChart({ productStats }) {
    const chartData = useMemo(() => {
        if (!productStats) return [];
        return [...productStats]
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10)
            .reverse();
    }, [productStats]);

    if (chartData.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                        Top 10 Produits
                    </CardTitle>
                </CardHeader>
                <CardContent className="h-96 flex flex-col items-center justify-center text-center text-gray-500">
                    <Package className="w-12 h-12 mb-4 opacity-50"/>
                    <p className="font-semibold">Aucune donnée à afficher</p>
                    <p className="text-sm">Il n'y a pas de ventes pour la période sélectionnée.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-lg border-0">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    Top 10 Produits par Chiffre d'Affaires
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={chartData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(value) => `${value.toFixed(0)}€`} />
                            <YAxis 
                                type="category" 
                                dataKey="name" 
                                width={150} 
                                tick={{ fontSize: 12 }} 
                                interval={0}
                            />
                            <Tooltip 
                                cursor={{fill: 'rgba(240, 240, 240, 0.5)'}}
                                formatter={(value, name) => [
                                    name === 'Chiffre d\'affaires' ? `${safeToFixed(value)}€` : value,
                                    name
                                ]} 
                            />
                            <Legend />
                            <Bar dataKey="revenue" name="Chiffre d'affaires" fill="#3b82f6" />
                            <Bar dataKey="quantity" name="Quantité" fill="#82ca9d" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
