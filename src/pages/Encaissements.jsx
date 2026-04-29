import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Calendar as CalendarIcon,
  CheckSquare,
  CreditCard,
  FileText,
  History,
  Plus,
  RotateCcw,
  Trash2,
  Truck,
  User,
  Receipt,
  ShoppingBag,
  Save,
} from 'lucide-react';

import { appClient } from '@/api/appClient';
import { useTenant } from '@/components/contexts/TenantContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import NumericKeyboard from '../components/encaissements/NumericKeyboard';
import { toParisDate } from '@/lib/dateParsing';
import { createPageUrl } from '@/utils';

const safeToFixed = (value, decimals = 2) => {
  const num = Number(value);
  if (Number.isNaN(num) || value === null || value === undefined) return '0.00';
  return num.toFixed(decimals);
};

const getParisDateKey = (value) => {
  const date = toParisDate(value);
  return date ? format(date, 'yyyy-MM-dd') : null;
};

const isDeliveryOrder = (order) => {
  if (!order) return false;
  if (!order.delivery_person_id) return false;
  if (order.statut === 'annulee') return false;
  if (order.type_commande === 'livraison') return true;
  return Boolean(order.delivery_address);
};

const isSettlementCandidate = (order) => isDeliveryOrder(order) && !order.payee;
const isSettlementHistoryCandidate = (order) => isDeliveryOrder(order) && order.payee;
const isDriverVerificationCandidate = (order) => isDeliveryOrder(order);
const isCashDeskCandidate = (order) => {
  if (!order) return false;
  if (order.statut === 'annulee') return false;
  if (isDeliveryOrder(order)) return false;
  return order.type_commande === 'sur_place' || order.type_commande === 'emporter';
};

const LABELS = {
  especes: 'Especes',
  carte_bancaire: 'Carte bancaire',
  cheque: 'Cheque',
  ticket_restaurant: 'Ticket restaurant',
};

const emptyPayments = () => ({
  especes: [],
  carte_bancaire: [],
  ticket_restaurant: [],
  cheque: [],
});

const allocatePaymentBreakdownAcrossOrders = (orders, paymentBreakdown) => {
  const remainingPayments = paymentBreakdown
    .map((payment) => ({
      methode: payment.methode,
      montant: Number(payment.montant) || 0,
    }))
    .filter((payment) => payment.montant > 0);

  return orders.map((order) => {
    let remainingOrderAmount = Number(order.total_ttc) || 0;
    const orderPayments = [];

    for (const payment of remainingPayments) {
      if (remainingOrderAmount <= 0) break;
      if (payment.montant <= 0) continue;

      const allocated = Math.min(payment.montant, remainingOrderAmount);
      if (allocated > 0) {
        orderPayments.push({
          methode: payment.methode,
          montant: Number(allocated.toFixed(2)),
        });
        payment.montant = Number((payment.montant - allocated).toFixed(2));
        remainingOrderAmount = Number((remainingOrderAmount - allocated).toFixed(2));
      }
    }

    return {
      orderId: order.id,
      payments: orderPayments,
    };
  });
};

const DriverSummaryCard = ({ driver, amount, countLabel, colorClass, onClick, subtitle }) => (
  <Card
    className={`cursor-pointer transition-all hover:shadow-md ${amount > 0 ? '' : 'opacity-50'} ${colorClass}`}
    onClick={() => amount > 0 && onClick(driver)}
  >
    <CardContent className="flex items-center justify-between p-4">
      <div>
        <p className="text-lg font-bold">{driver.prenom} {driver.nom}</p>
        <p className="text-sm text-gray-500">{driver.telephone}</p>
        {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div className="text-right">
        <p className="text-xl font-bold">{safeToFixed(amount)}€</p>
        <p className="text-xs text-gray-500">{countLabel}</p>
      </div>
    </CardContent>
  </Card>
);

const PaymentSection = ({
  type,
  label,
  icon: Icon,
  colorClass,
  payments,
  getTotalByType,
  addPaymentLine,
  removePaymentLine,
  updatePaymentLine,
  activeKeyboard,
  setActiveKeyboard,
  performCalculation,
}) => {
  const items = payments[type] || [];
  const total = getTotalByType(type);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <Label>{label}</Label>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-bold ${colorClass}`}>{safeToFixed(total)}€</span>
          <Button type="button" size="sm" variant="outline" onClick={() => addPaymentLine(type)} className="p-2">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => {
            const keyboardKey = `${type}-${item.id}`;
            return (
              <div key={item.id} className="flex gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={item.amount}
                  onChange={(e) => updatePaymentLine(type, item.id, e.target.value)}
                  onBlur={() => performCalculation(type, item.id)}
                  onFocus={() => setActiveKeyboard(keyboardKey)}
                  className={activeKeyboard === keyboardKey ? 'ring-2 ring-blue-500' : ''}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => removePaymentLine(type, item.id)}
                  className="p-2 text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-2 text-center text-sm text-gray-500">Cliquez sur + pour ajouter un montant</p>
      )}
    </div>
  );
};

const HistoryView = ({ groupedSettlements, selectedDate, setSelectedDate, handleCancelSettlement }) => (
  <Card className="shadow-lg">
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-3">
          <History className="h-6 w-6 text-green-500" />
          Historique des Encaissements
        </CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {format(selectedDate, 'dd/MM/yyyy', { locale: fr })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus locale={fr} />
          </PopoverContent>
        </Popover>
      </div>
    </CardHeader>
    <CardContent>
      {groupedSettlements.length > 0 ? (
        <Accordion type="single" collapsible className="space-y-2">
          {groupedSettlements.map((settlement) => (
            <AccordionItem key={settlement.key} value={settlement.key} className="rounded-lg border bg-gray-50 px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold text-blue-600">{settlement.driver.prenom} {settlement.driver.nom}</span>
                  <span className="text-gray-500">{format(settlement.date, 'HH:mm', { locale: fr })}</span>
                  <span className="text-lg font-bold text-green-600">{safeToFixed(settlement.total)}€</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="border-t p-4">
                  <h4 className="mb-3 font-semibold">Detail du reglement :</h4>
                  {Object.keys(settlement.paymentSummary).length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {Object.entries(settlement.paymentSummary).map(([method, amount]) => (
                        <li key={method} className="flex justify-between">
                          <span>{LABELS[method] || method}</span>
                          <span className="font-medium">{safeToFixed(amount)}€</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                      Details de paiement non disponibles. Total encaisse : {safeToFixed(settlement.total)}€
                    </div>
                  )}

                  <h4 className="mb-2 mt-4 font-semibold text-gray-800">Commandes incluses ({settlement.orders.length}) :</h4>
                  <div className="max-h-32 overflow-y-auto rounded-lg border bg-white p-2">
                    <ul className="space-y-1 text-sm">
                      {settlement.orders.map((order) => (
                        <li key={order.id} className="flex items-center justify-between rounded p-1 hover:bg-gray-50">
                          <span>Commande <strong>#{order.numero_caisse || order.numero_commande?.slice(-6) || ''}</strong></span>
                          <span className="font-semibold">{safeToFixed(order.total_ttc)}€</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-4 gap-2"
                    onClick={() => handleCancelSettlement(settlement.orders.map((order) => order.id))}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Annuler cet encaissement
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="py-12 text-center text-gray-500">
          <History className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>Aucun encaissement pour le {format(selectedDate, 'dd MMMM yyyy', { locale: fr })}</p>
        </div>
      )}
    </CardContent>
  </Card>
);

const DriverSelectionView = ({ title, note, date, setDate, drivers, onSelect, amountKey, countKey, subtitleBuilder, emptyLabel }) => (
  <Card className="shadow-lg">
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-blue-500" />
          {title} du {format(date, 'dd/MM/yyyy', { locale: fr })}
        </CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {format(date, 'dd/MM/yyyy', { locale: fr })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={date} onSelect={(value) => value && setDate(value)} initialFocus locale={fr} />
          </PopoverContent>
        </Popover>
      </div>
    </CardHeader>
    <CardContent>
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-sm text-blue-800">{note}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {drivers.map((driver) => (
          <DriverSummaryCard
            key={driver.id}
            driver={driver}
            amount={driver[amountKey] || 0}
            countLabel={`${driver[countKey] || 0} commande${driver[countKey] === 1 ? '' : 's'}`}
            colorClass=""
            subtitle={subtitleBuilder ? subtitleBuilder(driver) : null}
            onClick={onSelect}
          />
        ))}
      </div>

      {drivers.filter((driver) => (driver[amountKey] || 0) > 0).length === 0 && (
        <div className="py-8 text-center text-gray-500">
          <CalendarIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p className="font-medium">{emptyLabel}</p>
          <p className="text-sm">pour le {format(date, 'dd MMMM yyyy', { locale: fr })}</p>
        </div>
      )}
    </CardContent>
  </Card>
);

const DriverCalculatorView = ({
  title,
  ordersTitle,
  selectedDriver,
  orders,
  payments,
  setPayments,
  totalExpected,
  showValidation,
  actionLabel,
  onValidate,
  onBack,
  showOrderStatus = false,
  allowDifference = false,
}) => {
  const [activeKeyboard, setActiveKeyboard] = useState(null);

  const getTotalByType = (type) => (payments[type] || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const totalEntered = getTotalByType('especes') + getTotalByType('carte_bancaire') + getTotalByType('ticket_restaurant') + getTotalByType('cheque');
  const difference = totalExpected - totalEntered;

  const addPaymentLine = (type) => {
    setPayments((prev) => ({
      ...prev,
      [type]: [...prev[type], { id: String(Date.now()) + Math.random().toString(36).slice(2, 9), amount: '' }],
    }));
  };

  const removePaymentLine = (type, id) => {
    setPayments((prev) => ({
      ...prev,
      [type]: prev[type].filter((item) => item.id !== id),
    }));
  };

  const updatePaymentLine = (type, id, value) => {
    setPayments((prev) => ({
      ...prev,
      [type]: prev[type].map((item) => (item.id === id ? { ...item, amount: value } : item)),
    }));
  };

  const performCalculation = (type, id) => {
    const line = payments[type]?.find((item) => item.id === id);
    if (!line || !String(line.amount).trim()) return;

    const sanitized = String(line.amount).replace(/[^0-9\.\+\-\*\/]/g, '');
    try {
      const result = new Function(`return ${sanitized}`)();
      updatePaymentLine(type, id, typeof result === 'number' && Number.isFinite(result) ? result.toFixed(2) : '');
    } catch {
      updatePaymentLine(type, id, '');
    }
  };

  const keyboardValue = useMemo(() => {
    if (!activeKeyboard) return '';
    const [type, id] = activeKeyboard.split('-');
    const line = payments[type]?.find((item) => item.id === id);
    return line?.amount || '';
  }, [activeKeyboard, payments]);

  return (
    <div>
      <Button onClick={onBack} variant="outline" className="mb-6 gap-2">
        <ArrowLeft className="h-4 w-4" />
        Retour a la liste des livreurs
      </Button>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Card className="bg-gray-50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <CreditCard className="h-5 w-5" />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1 rounded-lg border bg-white p-4 text-center">
                <p className="text-sm text-gray-600">Total theorique</p>
                <p className="text-3xl font-bold text-blue-600">{safeToFixed(totalExpected)}€</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <PaymentSection type="especes" label="Especes" icon={Banknote} colorClass="text-green-600" payments={payments} getTotalByType={getTotalByType} addPaymentLine={addPaymentLine} removePaymentLine={removePaymentLine} updatePaymentLine={updatePaymentLine} activeKeyboard={activeKeyboard} setActiveKeyboard={setActiveKeyboard} performCalculation={performCalculation} />
                <PaymentSection type="carte_bancaire" label="Carte Bancaire" icon={CreditCard} colorClass="text-blue-600" payments={payments} getTotalByType={getTotalByType} addPaymentLine={addPaymentLine} removePaymentLine={removePaymentLine} updatePaymentLine={updatePaymentLine} activeKeyboard={activeKeyboard} setActiveKeyboard={setActiveKeyboard} performCalculation={performCalculation} />
                <PaymentSection type="ticket_restaurant" label="Tickets Resto" icon={FileText} colorClass="text-orange-600" payments={payments} getTotalByType={getTotalByType} addPaymentLine={addPaymentLine} removePaymentLine={removePaymentLine} updatePaymentLine={updatePaymentLine} activeKeyboard={activeKeyboard} setActiveKeyboard={setActiveKeyboard} performCalculation={performCalculation} />
                <PaymentSection type="cheque" label="Cheques" icon={CheckSquare} colorClass="text-purple-600" payments={payments} getTotalByType={getTotalByType} addPaymentLine={addPaymentLine} removePaymentLine={removePaymentLine} updatePaymentLine={updatePaymentLine} activeKeyboard={activeKeyboard} setActiveKeyboard={setActiveKeyboard} performCalculation={performCalculation} />
              </div>

              <div className="space-y-1 rounded-lg border bg-white p-4 text-center">
                <p className="text-sm text-gray-600">Total saisi</p>
                <p className="text-2xl font-bold text-gray-900">{safeToFixed(totalEntered)}€</p>
              </div>

              <div className={`rounded-lg border p-3 text-center ${Math.abs(difference) < 0.01 ? 'border-green-200 bg-green-100' : 'border-red-200 bg-red-100'}`}>
                <p className="text-sm">{difference > 0.01 ? 'Restant a saisir' : difference < -0.01 ? 'Trop percu' : 'Ecart'}</p>
                <p className={`text-xl font-bold ${Math.abs(difference) < 0.01 ? 'text-green-700' : 'text-red-700'}`}>{safeToFixed(difference)}€</p>
              </div>

              {showValidation && (
                <Button
                  onClick={onValidate}
                  disabled={(!allowDifference && Math.abs(difference) > 0.01) || totalExpected === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {actionLabel}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <User className="h-5 w-5" />
                {ordersTitle || `Commandes pour ${selectedDriver.prenom} ${selectedDriver.nom}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numero</TableHead>
                      <TableHead>Date</TableHead>
                      {showOrderStatus && <TableHead>Etat</TableHead>}
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.numero_caisse || order.numero_commande?.slice(-6) || ''}</TableCell>
                        <TableCell>{(() => {
                          const orderDate = toParisDate(order.created_date);
                          return orderDate ? format(orderDate, 'dd/MM/yyyy HH:mm', { locale: fr }) : 'Date invalide';
                        })()}</TableCell>
                        {showOrderStatus && (
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className={`text-xs font-medium ${order.payee ? 'text-green-700' : 'text-orange-700'}`}>
                                {order.payee ? 'Payee' : 'Non payee'}
                              </span>
                              <span className="text-xs text-gray-500">{order.statut}</span>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="text-right font-semibold">{safeToFixed(order.total_ttc)}€</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div>
          <NumericKeyboard
            currentValue={keyboardValue}
            onInput={(key) => {
              if (!activeKeyboard) return;
              const [type, id] = activeKeyboard.split('-');
              const line = payments[type]?.find((item) => item.id === id);
              updatePaymentLine(type, id, `${line?.amount || ''}${key}`);
            }}
            onClear={() => {
              if (!activeKeyboard) return;
              const [type, id] = activeKeyboard.split('-');
              updatePaymentLine(type, id, '');
            }}
            onBackspace={() => {
              if (!activeKeyboard) return;
              const [type, id] = activeKeyboard.split('-');
              const line = payments[type]?.find((item) => item.id === id);
              updatePaymentLine(type, id, String(line?.amount || '').slice(0, -1));
            }}
            onEnter={() => {
              if (!activeKeyboard) return;
              const [type, id] = activeKeyboard.split('-');
              performCalculation(type, id);
              setActiveKeyboard(null);
            }}
          />
        </div>
      </div>
    </div>
  );
};

const CashDeskSettlementView = ({
  date,
  setDate,
  orders,
  bipeurDrafts,
  setBipeurDrafts,
  onSaveBipeur,
  onOpenSettlement,
}) => (
  <Card className="shadow-lg">
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-3">
          <Receipt className="h-6 w-6 text-orange-500" />
          Encaissements caisse / bipeurs
        </CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {format(date, 'dd/MM/yyyy', { locale: fr })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={date} onSelect={(value) => value && setDate(value)} initialFocus locale={fr} />
          </PopoverContent>
        </Popover>
      </div>
    </CardHeader>
    <CardContent>
      <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
        Saisissez un numero de bipeur pour les commandes a emporter ou sur place. Vous pouvez aussi ouvrir directement l'encaissement de la commande.
      </div>

      {orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((order) => {
            const draftValue = bipeurDrafts[order.id] ?? order.numero_bipeur ?? '';
            const orderDate = toParisDate(order.created_date);
            return (
              <div key={order.id} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-bold text-gray-900">
                        Commande #{order.numero_caisse || order.numero_commande?.slice(-6) || ''}
                      </p>
                      <Badge className={order.type_commande === 'sur_place' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}>
                        <span className="flex items-center gap-1">
                          {order.type_commande === 'sur_place' ? <Receipt className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
                          {order.type_commande === 'sur_place' ? 'Sur place' : 'Emporter'}
                        </span>
                      </Badge>
                      <Badge className={order.payee ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {order.payee ? 'Payee' : 'Non payee'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {orderDate ? format(orderDate, 'dd/MM/yyyy HH:mm', { locale: fr }) : 'Date invalide'}
                    </p>
                    <p className="text-xl font-bold text-gray-900">{safeToFixed(order.total_ttc)}€</p>
                    {order.numero_bipeur ? (
                      <p className="text-sm font-medium text-orange-700">Bipeur actuel : {order.numero_bipeur}</p>
                    ) : (
                      <p className="text-sm text-gray-500">Aucun bipeur enregistre</p>
                    )}
                  </div>

                  <div className="flex w-full flex-col gap-3 lg:w-[360px]">
                    <div className="space-y-2">
                      <Label htmlFor={`bipeur-${order.id}`}>Numero de bipeur</Label>
                      <Input
                        id={`bipeur-${order.id}`}
                        value={draftValue}
                        onChange={(e) => setBipeurDrafts((prev) => ({ ...prev, [order.id]: e.target.value }))}
                        placeholder="Ex: 12"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => onSaveBipeur(order.id, draftValue)}>
                        <Save className="mr-2 h-4 w-4" />
                        Enregistrer
                      </Button>
                      {!order.payee && (
                        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => onOpenSettlement(order.id)}>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Encaisser
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-gray-500">
          <Receipt className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>Aucune commande sur place ou emporter pour le {format(date, 'dd MMMM yyyy', { locale: fr })}</p>
        </div>
      )}
    </CardContent>
  </Card>
);

export default function Encaissements() {
  const { filterByTenant, currentTenant, currentUser, withTenant } = useTenant();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('encaissement');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [encaissementDate, setEncaissementDate] = useState(new Date());
  const [verificationDate, setVerificationDate] = useState(new Date());
  const [cashDeskDate, setCashDeskDate] = useState(new Date());
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedVerificationDriver, setSelectedVerificationDriver] = useState(null);
  const [payments, setPayments] = useState(emptyPayments());
  const [verificationPayments, setVerificationPayments] = useState(emptyPayments());
  const [bipeurDrafts, setBipeurDrafts] = useState({});

  const { data: cagnotteRule } = useQuery({
    queryKey: ['cagnotteRule', currentTenant?.id],
    queryFn: () => appClient.entities.CagnotteRule.filter({ tenant_id: currentTenant?.id, active: true }),
    select: (data) => data?.[0] || null,
    enabled: !!currentTenant,
    staleTime: 10 * 60 * 1000,
  });

  const { data: rawDeliveryPeople = [], isLoading: isLoadingDrivers } = useQuery({
    queryKey: ['rawDeliveryPeople', currentTenant?.id],
    queryFn: () => appClient.entities.DeliveryPerson.filter(filterByTenant()),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    enabled: !!currentTenant,
  });

  const { data: allOrders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ['allOrdersForSettlement', currentTenant?.id],
    queryFn: async () => {
      return await appClient.entities.Order.filter(filterByTenant(), '-created_date', 2000);
    },
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
    enabled: !!currentTenant,
  });

  const allDriverOrders = useMemo(() => allOrders.filter(isDeliveryOrder), [allOrders]);

  const { data: settledOrdersData = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['settledOrders', selectedDate.toDateString(), currentTenant?.id],
    queryFn: async () => {
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      return allDriverOrders.filter((order) => (
        isSettlementHistoryCandidate(order)
        && getParisDateKey(order.updated_date) === selectedDateStr
      ));
    },
    enabled: activeTab === 'historique' && !!currentTenant,
    refetchOnWindowFocus: false,
  });

  const settlementOrders = useMemo(() => {
    const dateKey = format(encaissementDate, 'yyyy-MM-dd');
    return allDriverOrders.filter((order) => isSettlementCandidate(order) && getParisDateKey(order.created_date) === dateKey);
  }, [allDriverOrders, encaissementDate]);

  const verificationOrdersData = useMemo(() => {
    const dateKey = format(verificationDate, 'yyyy-MM-dd');
    return allDriverOrders.filter((order) => isDriverVerificationCandidate(order) && getParisDateKey(order.created_date) === dateKey);
  }, [allDriverOrders, verificationDate]);

  const cashDeskOrders = useMemo(() => {
    const dateKey = format(cashDeskDate, 'yyyy-MM-dd');
    return allOrders.filter((order) => isCashDeskCandidate(order) && getParisDateKey(order.created_date) === dateKey);
  }, [allOrders, cashDeskDate]);

  const augmentedDeliveryPeople = useMemo(() => {
    return rawDeliveryPeople.map((driver) => {
      const driverSettlementOrders = settlementOrders.filter((order) => order.delivery_person_id === driver.id);
      const driverVerificationOrders = verificationOrdersData.filter((order) => order.delivery_person_id === driver.id);
      return {
        ...driver,
        calculated_total_encaisse: driverSettlementOrders.reduce((sum, order) => sum + (order.total_ttc || 0), 0),
        calculated_nb_livraisons_jour: driverSettlementOrders.length,
        verification_total: driverVerificationOrders.reduce((sum, order) => sum + (order.total_ttc || 0), 0),
        verification_count: driverVerificationOrders.length,
        verification_paid_count: driverVerificationOrders.filter((order) => order.payee).length,
        verification_unpaid_count: driverVerificationOrders.filter((order) => !order.payee).length,
      };
    });
  }, [rawDeliveryPeople, settlementOrders, verificationOrdersData]);

  const ordersToSettle = useMemo(() => {
    if (!selectedDriver) return [];
    return settlementOrders.filter((order) => order.delivery_person_id === selectedDriver.id);
  }, [settlementOrders, selectedDriver]);

  const verificationOrders = useMemo(() => {
    if (!selectedVerificationDriver) return [];
    return verificationOrdersData.filter((order) => order.delivery_person_id === selectedVerificationDriver.id);
  }, [verificationOrdersData, selectedVerificationDriver]);

  const totalToSettle = ordersToSettle.reduce((sum, order) => sum + (order.total_ttc || 0), 0);
  const verificationTotal = verificationOrders.reduce((sum, order) => sum + (order.total_ttc || 0), 0);

  const groupedSettlements = useMemo(() => {
    const settlementsMap = settledOrdersData.reduce((acc, order) => {
      const driver = augmentedDeliveryPeople.find((item) => item.id === order.delivery_person_id);
      if (!driver || !order.updated_date) return acc;
      const settlementTime = toParisDate(order.updated_date);
      if (!settlementTime) return acc;

      const minuteDate = new Date(settlementTime.getFullYear(), settlementTime.getMonth(), settlementTime.getDate(), settlementTime.getHours(), settlementTime.getMinutes());
      const key = `${driver.id}-${minuteDate.toISOString()}`;

      if (!acc[key]) {
        acc[key] = {
          key,
          driver,
          date: settlementTime,
          orders: [],
          total: 0,
          paymentSummary: {},
        };
      }

      acc[key].orders.push(order);
      acc[key].total += order.total_ttc || 0;

      (order.mode_paiement || []).forEach((payment) => {
        if (!acc[key].paymentSummary[payment.methode]) acc[key].paymentSummary[payment.methode] = 0;
        acc[key].paymentSummary[payment.methode] += parseFloat(payment.montant) || 0;
      });

      return acc;
    }, {});

    return Object.values(settlementsMap).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [settledOrdersData, augmentedDeliveryPeople]);

  const handleSaveBipeur = async (orderId, value) => {
    try {
      await appClient.entities.Order.update(orderId, withTenant({
        numero_bipeur: String(value || '').trim() || null,
      }));

      toast({
        title: 'Bipeur enregistre',
        description: 'Le numero de bipeur a ete mis a jour.',
        variant: 'success',
      });

      queryClient.invalidateQueries({ queryKey: ['allOrdersForSettlement', currentTenant?.id] });
    } catch (error) {
      console.error('Erreur enregistrement bipeur:', error);
      toast({
        title: 'Erreur',
        description: "Impossible d'enregistrer le numero de bipeur.",
        variant: 'destructive',
      });
    }
  };

  const handleOpenCashDeskSettlement = (orderId) => {
    navigate(createPageUrl(`StrasykPos?order_to_settle=${orderId}`));
  };

  const handleCancelSettlement = async (orderIds) => {
    if (!confirm("Etes-vous sur de vouloir annuler cet encaissement ?")) return;

    try {
      for (const orderId of orderIds) {
        await appClient.entities.Order.update(orderId, { payee: false, mode_paiement: [] });
      }

      toast({
        title: 'Annulation reussie',
        description: "L'encaissement a ete annule.",
        variant: 'success',
      });

      queryClient.invalidateQueries({ queryKey: ['allDriverOrders', currentTenant?.id] });
    } catch (error) {
      console.error('Erreur lors de l annulation:', error);
      toast({
        title: 'Erreur',
        description: "Impossible d'annuler cet encaissement.",
        variant: 'destructive',
      });
    }
  };

  const handleSettle = async () => {
    if (totalToSettle === 0) {
      toast({
        title: 'Aucune commande',
        description: "Il n'y a aucune commande a encaisser pour ce livreur a cette date.",
        variant: 'warning',
      });
      return;
    }

    const totalEntered = Object.values(payments).flat().reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    if (Math.abs(totalToSettle - totalEntered) > 0.01) {
      toast({
        title: "Erreur d'encaissement",
        description: 'Le montant saisi ne correspond pas au total a regler.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const paymentBreakdown = Object.entries(payments)
        .flatMap(([type, items]) => items.map((item) => ({ methode: type, montant: parseFloat(item.amount) || 0 })))
        .filter((item) => item.montant > 0);
      const paymentAllocation = allocatePaymentBreakdownAcrossOrders(ordersToSettle, paymentBreakdown);

      for (const order of ordersToSettle) {
        const allocatedPayments = paymentAllocation.find((item) => item.orderId === order.id)?.payments || paymentBreakdown;
        await appClient.entities.Order.update(order.id, {
          payee: true,
          mode_paiement: allocatedPayments,
          statut: 'livree',
        });

        if (order.customer_id && cagnotteRule?.accumulation_rate > 0) {
          try {
            const customers = await appClient.entities.Customer.filter({ id: order.customer_id });
            const customer = customers?.[0];
            if (!customer) continue;

            const amountEarned = (order.total_ttc || 0) * (cagnotteRule.accumulation_rate / 100);
            if (amountEarned <= 0.01) continue;

            const balanceBefore = customer.cagnotte_balance || 0;
            const balanceAfter = balanceBefore + amountEarned;

            await appClient.entities.CagnotteHistory.create({
              tenant_id: currentTenant.id,
              customer_id: customer.id,
              order_id: order.id,
              type: 'earn',
              amount: amountEarned,
              balance_before: balanceBefore,
              balance_after: balanceAfter,
              created_date: new Date().toISOString(),
            });

            await appClient.entities.Customer.update(customer.id, { cagnotte_balance: balanceAfter });
          } catch (error) {
            console.error('Erreur cagnotte pour commande', order.id, error);
          }
        }
      }

      toast({
        title: 'Encaissement valide',
        description: `Encaissement pour ${selectedDriver.prenom} ${selectedDriver.nom} enregistre.`,
        variant: 'success',
      });

      setSelectedDriver(null);
      setPayments(emptyPayments());
      queryClient.invalidateQueries({ queryKey: ['allDriverOrders', currentTenant?.id] });
    } catch (error) {
      console.error('Erreur lors de l encaissement:', error);
      toast({
        title: 'Erreur',
        description: "Une erreur est survenue lors de la validation de l'encaissement.",
        variant: 'destructive',
      });
    }
  };

  const handleSaveVerification = async () => {
    if (!selectedVerificationDriver || verificationOrders.length === 0) {
      toast({
        title: 'Aucune commande',
        description: "Il n'y a aucune commande a verifier pour ce livreur a cette date.",
        variant: 'warning',
      });
      return;
    }

    try {
      const paymentBreakdown = Object.entries(verificationPayments)
        .flatMap(([type, items]) => items.map((item) => ({ methode: type, montant: parseFloat(item.amount) || 0 })))
        .filter((item) => item.montant > 0);

      const enteredTotal = paymentBreakdown.reduce((sum, item) => sum + item.montant, 0);
      const difference = verificationTotal - enteredTotal;

      await appClient.entities.DeliveryVerificationLog.create(withTenant({
        delivery_person_id: selectedVerificationDriver.id,
        verification_date: format(verificationDate, 'yyyy-MM-dd'),
        expected_total: verificationTotal,
        entered_total: enteredTotal,
        difference,
        payment_breakdown: paymentBreakdown,
        order_ids: verificationOrders.map((order) => order.id),
        orders_snapshot: verificationOrders.map((order) => ({
          id: order.id,
          numero_caisse: order.numero_caisse || null,
          numero_commande: order.numero_commande || null,
          total_ttc: order.total_ttc || 0,
          payee: !!order.payee,
          statut: order.statut,
          created_date: order.created_date || null,
        })),
        created_by: currentUser?.full_name || currentUser?.email || null,
      }));

      toast({
        title: 'Verification enregistree',
        description: `Trace enregistree pour ${selectedVerificationDriver.prenom} ${selectedVerificationDriver.nom}.`,
        variant: 'success',
      });

      setSelectedVerificationDriver(null);
      setVerificationPayments(emptyPayments());
      queryClient.invalidateQueries({ queryKey: ['deliveryVerificationLogs', currentTenant?.id] });
    } catch (error) {
      console.error('Erreur lors de l enregistrement de la verification:', error);
      toast({
        title: 'Erreur',
        description: error?.message || "Impossible d'enregistrer la verification.",
        variant: 'destructive',
      });
    }
  };

  const globalLoading = isLoadingDrivers || isLoadingOrders || isLoadingHistory;
  const isSettlementDetail = !!selectedDriver;
  const isVerificationDetail = !!selectedVerificationDriver;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">Encaissement des Livreurs</h1>

        {globalLoading && <p>Chargement des donnees...</p>}

        {!globalLoading && !isSettlementDetail && !isVerificationDetail && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="encaissement" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Encaissements
              </TabsTrigger>
              <TabsTrigger value="historique" className="gap-2">
                <History className="h-4 w-4" />
                Historique
              </TabsTrigger>
              <TabsTrigger value="verification" className="gap-2">
                <FileText className="h-4 w-4" />
                Verification livreur
              </TabsTrigger>
              <TabsTrigger value="caisse" className="gap-2">
                <Receipt className="h-4 w-4" />
                Caisse / Bipeurs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="encaissement">
              <DriverSelectionView
                title="Encaissements"
                note="Ce total correspond uniquement aux commandes non encore encaissees (paiement a la livraison)."
                date={encaissementDate}
                setDate={setEncaissementDate}
                drivers={augmentedDeliveryPeople}
                onSelect={setSelectedDriver}
                amountKey="calculated_total_encaisse"
                countKey="calculated_nb_livraisons_jour"
                emptyLabel="Aucun encaissement a faire"
              />
            </TabsContent>

            <TabsContent value="historique">
              <HistoryView
                groupedSettlements={groupedSettlements}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                handleCancelSettlement={handleCancelSettlement}
              />
            </TabsContent>

            <TabsContent value="verification">
              <DriverSelectionView
                title="Verification livreur"
                note="Ce controle affiche toutes les commandes du livreur, payees ou non, pour comparer sa caisse au theorique."
                date={verificationDate}
                setDate={setVerificationDate}
                drivers={augmentedDeliveryPeople}
                onSelect={setSelectedVerificationDriver}
                amountKey="verification_total"
                countKey="verification_count"
                subtitleBuilder={(driver) => `${driver.verification_paid_count || 0} payee(s) · ${driver.verification_unpaid_count || 0} non payee(s)`}
                emptyLabel="Aucune commande livreur"
              />
            </TabsContent>

            <TabsContent value="caisse">
              <CashDeskSettlementView
                date={cashDeskDate}
                setDate={setCashDeskDate}
                orders={cashDeskOrders}
                bipeurDrafts={bipeurDrafts}
                setBipeurDrafts={setBipeurDrafts}
                onSaveBipeur={handleSaveBipeur}
                onOpenSettlement={handleOpenCashDeskSettlement}
              />
            </TabsContent>
          </Tabs>
        )}

        {!globalLoading && isSettlementDetail && (
          <DriverCalculatorView
            title="Calculateur d'Encaissement"
            ordersTitle={`Commandes a regler pour ${selectedDriver.prenom} ${selectedDriver.nom}`}
            selectedDriver={selectedDriver}
            orders={ordersToSettle}
            payments={payments}
            setPayments={setPayments}
            totalExpected={totalToSettle}
            showValidation
            actionLabel="Valider l'Encaissement"
            onValidate={handleSettle}
            onBack={() => {
              setSelectedDriver(null);
              setPayments(emptyPayments());
            }}
          />
        )}

        {!globalLoading && isVerificationDetail && (
          <DriverCalculatorView
            title="Calculateur de Verification"
            ordersTitle={`Toutes les commandes de ${selectedVerificationDriver.prenom} ${selectedVerificationDriver.nom}`}
            selectedDriver={selectedVerificationDriver}
            orders={verificationOrders}
            payments={verificationPayments}
            setPayments={setVerificationPayments}
            totalExpected={verificationTotal}
            showValidation
            actionLabel="Enregistrer la verification"
            onValidate={handleSaveVerification}
            onBack={() => {
              setSelectedVerificationDriver(null);
              setVerificationPayments(emptyPayments());
            }}
            showOrderStatus
            allowDifference
          />
        )}
      </div>
    </div>
  );
}
