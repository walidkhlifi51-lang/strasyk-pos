
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ShoppingCart, Truck, Package } from "lucide-react";

const ORDER_TYPE_CONFIG = {
  livraison: { 
    label: 'Livraison', 
    color: '#3B82F6', 
    icon: Truck,
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800'
  },
  sur_place: { 
    label: 'Sur Place', 
    color: '#10B981', 
    icon: ShoppingCart,
    bgColor: 'bg-green-100',
    textColor: 'text-green-800'
  },
  emporter: { 
    label: 'À Emporter', 
    color: '#F59E0B', 
    icon: Package,
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-800'
  }
};

export default function OrderTypesChart({ orders }) {
  const getOrderTypesData = () => {
    if (!orders || orders.length === 0) {
      return [];
    }

    const orderTypeStats = {};
    
    orders.forEach(order => {
      const type = order.type_commande || 'sur_place';
      if (!orderTypeStats[type]) {
        orderTypeStats[type] = {
          count: 0,
          revenue: 0
        };
      }
      orderTypeStats[type].count += 1;
      orderTypeStats[type].revenue += order.total_ttc || 0;
    });

    const totalRevenue = Object.values(orderTypeStats).reduce((sum, stat) => sum + stat.revenue, 0);
    const totalCount = Object.values(orderTypeStats).reduce((sum, stat) => sum + stat.count, 0);

    return Object.entries(orderTypeStats).map(([type, stats]) => {
      const config = ORDER_TYPE_CONFIG[type] || ORDER_TYPE_CONFIG.sur_place;
      return {
        type,
        name: config.label,
        revenue: stats.revenue,
        count: stats.count,
        revenuePercentage: totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0,
        countPercentage: totalCount > 0 ? (stats.count / totalCount) * 100 : 0,
        color: config.color,
        icon: config.icon,
        bgColor: config.bgColor,
        textColor: config.textColor
      };
    }).sort((a, b) => b.revenue - a.revenue);
  };

  const data = getOrderTypesData();
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const totalOrders = data.reduce((sum, item) => sum + item.count, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 shadow-lg rounded-lg border">
          <p className="font-semibold">{data.name}</p>
          <p className="text-blue-600">{data.revenue.toFixed(2)}€ ({data.revenuePercentage.toFixed(1)}%)</p>
          <p className="text-gray-600">{data.count} commande{data.count > 1 ? 's' : ''} ({data.countPercentage.toFixed(1)}%)</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5 text-purple-500" />
          Répartition par Mode de Commande
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="space-y-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="revenue"
                  >
                    {data.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    formatter={(value, entry) => `${value} (${entry.payload.revenuePercentage.toFixed(1)}%)`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800 mb-3">Détail par type :</h4>
              {data.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div key={item.type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${item.bgColor} flex items-center justify-center`}>
                        <IconComponent className={`w-5 h-5 ${item.textColor}`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-600">
                          {item.count} commande{item.count > 1 ? 's' : ''} ({item.countPercentage.toFixed(1)}%)
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg" style={{ color: item.color }}>
                        {item.revenue.toFixed(2)}€
                      </p>
                      <p className="text-sm text-gray-600">
                        {item.revenuePercentage.toFixed(1)}% du CA
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-purple-700">Total général</p>
                  <p className="font-bold text-xl text-purple-900">{totalRevenue.toFixed(2)}€</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-purple-700">Commandes</p>
                  <p className="font-bold text-xl text-purple-900">{totalOrders}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucune donnée disponible pour cette période</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

