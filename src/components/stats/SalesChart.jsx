
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from "lucide-react";
import { format, eachDayOfInterval, eachMonthOfInterval, eachYearOfInterval, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

export default function SalesChart({ orders, dateInterval }) {
  const getChartData = () => {
    if (!orders || orders.length === 0 || !dateInterval || !dateInterval.from) {
        return [];
    }

    const { from: start, to: end } = dateInterval;
    const daysDiff = differenceInDays(end, start);
    const dataMap = new Map();
    let interval;
    let formatKey;

    if (daysDiff < 2) { // Journée unique
        interval = [{ date: format(start, 'dd/MM/yy', { locale: fr }), revenue: 0, orders: 0 }];
        formatKey = (d) => format(d, 'dd/MM/yy', { locale: fr });
        interval.forEach(i => dataMap.set(i.date, { ...i }));
    } else if (daysDiff <= 45) { // Vue par jour
        interval = eachDayOfInterval({ start, end });
        formatKey = (d) => format(d, 'dd/MM', { locale: fr });
        interval.forEach(d => dataMap.set(formatKey(d), { date: formatKey(d), revenue: 0, orders: 0 }));
    } else if (daysDiff <= 366) { // Vue par mois
        interval = eachMonthOfInterval({ start, end });
        formatKey = (d) => format(d, 'MMM yy', { locale: fr });
        interval.forEach(d => dataMap.set(formatKey(d), { date: formatKey(d), revenue: 0, orders: 0 }));
    } else { // Vue par année
        interval = eachYearOfInterval({ start, end });
        formatKey = (d) => format(d, 'yyyy', { locale: fr });
        interval.forEach(d => dataMap.set(formatKey(d), { date: formatKey(d), revenue: 0, orders: 0 }));
    }

    orders.forEach(order => {
        if (!order.created_date) return;
        const orderDate = new Date(order.created_date);
        const dateKey = formatKey(orderDate);
        
        if (dataMap.has(dateKey)) {
            const current = dataMap.get(dateKey);
            current.revenue += order.total_ttc || 0;
            current.orders += 1;
        }
    });

    return Array.from(dataMap.values());
  };

  const chartData = getChartData();

  if (chartData.length === 0) {
    return (
        <Card className="shadow-lg border-0">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    Évolution des Ventes
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                    Aucune donnée disponible pour cette période
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          Évolution des Ventes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                stroke="#666"
                fontSize={12}
              />
              <YAxis 
                stroke="#666"
                fontSize={12}
                tickFormatter={(value) => `${value.toFixed(0)}€`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '8px'
                }}
                formatter={(value, name) => [
                  name === 'revenue' ? `${value.toFixed(2)}€` : value,
                  name === 'revenue' ? 'CA' : 'Commandes'
                ]}
              />
              <Bar 
                dataKey="revenue" 
                fill="url(#gradient)" 
                radius={[4, 4, 0, 0]}
              />
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.3}/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

