
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CreditCard } from "lucide-react";

const COLORS = {
  especes: '#FF6B35',
  carte_bancaire: '#3B82F6',
  cheque: '#10B981',
  ticket_restaurant: '#F59E0B'
};

const LABELS = {
  especes: 'Espèces',
  carte_bancaire: 'Carte bancaire',
  cheque: 'Chèque',
  ticket_restaurant: 'Ticket restaurant'
};

export default function PaymentMethodsChart({ orders }) {
  const getPaymentData = () => {
    if (!orders || orders.length === 0) {
      return [];
    }

    const paymentMethods = {};
    orders.forEach(order => {
      if (order.mode_paiement && Array.isArray(order.mode_paiement)) {
        order.mode_paiement.forEach(payment => {
          const method = payment.methode;
          if (!paymentMethods[method]) {
            paymentMethods[method] = { count: 0, amount: 0 };
          }
          paymentMethods[method].amount += payment.montant || 0;
          // Corrected: Increment count for each individual payment entry
          paymentMethods[method].count++; 
        });
        // Removed the previous logic that counted methods per order, 
        // as count should now reflect individual payment transactions.
      }
    });

    return Object.entries(paymentMethods).map(([method, data]) => ({
      name: LABELS[method] || method,
      value: data.amount,
      count: data.count,
      color: COLORS[method] || '#8B5CF6'
    }));
  };

  const data = getPaymentData();

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 shadow-lg rounded-lg border">
          <p className="font-semibold">{data.name}</p>
          <p className="text-blue-600">{data.value.toFixed(2)}€</p>
          <p className="text-gray-600">{data.count} transaction{data.count > 1 ? 's' : ''}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-green-500" />
          Modes de Paiement
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  formatter={(value, entry) => `${value} (${entry.payload.value.toFixed(2)}€)`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            <p>Aucune donnée disponible pour cette période</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

