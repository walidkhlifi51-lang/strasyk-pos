import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  Banknote,
  Calendar as CalendarIcon,
  CheckSquare,
  CreditCard,
  FileText,
  History,
  RotateCcw,
  Truck,
  User,
} from 'lucide-react';

import { appClient } from '@/api/appClient';
import { useTenant } from '@/components/contexts/TenantContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toParisDate } from '@/lib/dateParsing';

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

const LABELS = {
  especes: 'Especes',
  carte_bancaire: 'Carte bancaire',
  cheque: 'Cheque',
  ticket_restaurant: 'Ticket restaurant',
};

const PAYMENT_METHOD_CONFIG = [
  { key: 'especes', label: 'Especes', icon: Banknote, buttonClass: 'border-green-200 bg-green-50 text-green-700', totalClass: 'text-green-700' },
  { key: 'carte_bancaire', label: 'Carte bancaire', icon: CreditCard, buttonClass: 'border-blue-200 bg-blue-50 text-blue-700', totalClass: 'text-blue-700' },
  { key: 'cheque', label: 'Cheque', icon: CheckSquare, buttonClass: 'border-violet-200 bg-violet-50 text-violet-700', totalClass: 'text-violet-700' },
  { key: 'ticket_restaurant', label: 'Ticket restaurant', icon: FileText, buttonClass: 'border-orange-200 bg-orange-50 text-orange-700', totalClass: 'text-orange-700' },
];

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
  const [keypadValue, setKeypadValue] = useState('');

  const getTotalByType = (type) => (payments[type] || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const totalEntered = PAYMENT_METHOD_CONFIG.reduce((sum, method) => sum + getTotalByType(method.key), 0);
  const difference = totalExpected - totalEntered;
  const totalCommands = orders.length;
  const isBalanced = Math.abs(difference) < 0.01;
  const hasOverflow = difference < -0.01;
  const parsedKeypadValue = Number.parseFloat(keypadValue);
  const currentEntryAmount = Number.isFinite(parsedKeypadValue) ? parsedKeypadValue : 0;

  const setPaymentTotal = (type, amount) => {
    const normalized = Number(amount) || 0;
    setPayments((prev) => ({
      ...prev,
      [type]: normalized > 0 ? [{ id: `${type}-total`, amount: normalized.toFixed(2) }] : [],
    }));
  };

  const addAmountToType = (type) => {
    if (currentEntryAmount <= 0) return;
    const nextTotal = getTotalByType(type) + currentEntryAmount;
    setPaymentTotal(type, nextTotal);
    setKeypadValue('');
  };

  const handleKeypadInput = (key) => {
    if (key === '.' && keypadValue.includes('.')) return;
    if (key === '.' && keypadValue === '') {
      setKeypadValue('0.');
      return;
    }
    setKeypadValue((prev) => `${prev}${key}`);
  };

  const clearAllPayments = () => {
    setPayments(emptyPayments());
    setKeypadValue('');
  };

  return (
    <div>
      <Button onClick={onBack} variant="outline" className="mb-6 gap-2">
        <ArrowLeft className="h-4 w-4" />
        Retour a la liste des livreurs
      </Button>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Card className="border-0 bg-white shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <CreditCard className="h-5 w-5" />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl bg-slate-900 px-6 py-5 text-white">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-300">Total a verifier</p>
                <p className="mt-3 text-5xl font-black tracking-tight">{safeToFixed(totalExpected)} EUR</p>
                <p className="mt-3 text-sm text-slate-300">{totalCommands} commande{totalCommands > 1 ? 's' : ''} - 1 livreur</p>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-bold text-slate-900">Verification du comptage</p>
                    <p className="text-sm text-slate-500">Saisis un montant puis clique sur un mode de paiement.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={clearAllPayments}>
                    Effacer tout
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {PAYMENT_METHOD_CONFIG.map((method) => {
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.key}
                        type="button"
                        onClick={() => addAmountToType(method.key)}
                        className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-transform hover:-translate-y-0.5 ${method.buttonClass} ${currentEntryAmount > 0 ? 'ring-2 ring-offset-2 ring-slate-300' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-white/80 p-3">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-base font-bold">{method.label}</p>
                            <p className="text-xs opacity-80">Ajouter le montant en cours</p>
                          </div>
                        </div>
                        <p className={`text-2xl font-black ${method.totalClass}`}>{safeToFixed(getTotalByType(method.key))} EUR</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-500">Total attendu</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{safeToFixed(totalExpected)} EUR</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-500">Total saisi</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{safeToFixed(totalEntered)} EUR</p>
                </div>
                <div className={`rounded-2xl border p-4 ${isBalanced ? 'border-green-200 bg-green-50' : hasOverflow ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
                  <p className={`text-sm ${isBalanced ? 'text-green-700' : hasOverflow ? 'text-amber-700' : 'text-red-700'}`}>
                    {isBalanced ? 'Comptage equilibre' : hasOverflow ? 'Surplus saisi' : 'Restant a saisir'}
                  </p>
                  <p className={`mt-2 text-3xl font-black ${isBalanced ? 'text-green-700' : hasOverflow ? 'text-amber-700' : 'text-red-700'}`}>
                    {safeToFixed(Math.abs(difference))} EUR
                  </p>
                </div>
              </div>

              {!allowDifference && !isBalanced && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${hasOverflow ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                  {hasOverflow
                    ? 'Le total saisi depasse le total attendu. Corrige le comptage avant validation.'
                    : 'Le total saisi est inferieur au total attendu. Complete le comptage avant validation.'}
                </div>
              )}

              {allowDifference && !isBalanced && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${hasOverflow ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                  {hasOverflow
                    ? 'Verification en excedent detectee. L enregistrement reste autorise.'
                    : 'Verification avec restant a saisir detectee. L enregistrement reste autorise.'}
                </div>
              )}

              {showValidation && (
                <Button
                  onClick={onValidate}
                  disabled={(!allowDifference && !isBalanced) || totalExpected === 0}
                  className="h-14 w-full bg-blue-600 text-base font-bold hover:bg-blue-700 disabled:bg-slate-300"
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
                      <TableHead>Mode</TableHead>
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
                        <TableCell>{Array.isArray(order.mode_paiement) && order.mode_paiement.length > 0 ? order.mode_paiement.map((payment) => LABELS[payment.methode] || payment.methode).join(', ') : '-'}</TableCell>
                        <TableCell className="text-right font-semibold">{safeToFixed(order.total_ttc)}€</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="sticky top-8 border-0 shadow-xl">
            <CardContent className="space-y-4 p-4">
              <div className="rounded-2xl bg-slate-900 p-4 text-right text-white">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Montant en cours</p>
                <p className="mt-2 text-4xl font-black">{keypadValue || '0'} EUR</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0'].map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant="outline"
                    className="h-16 text-2xl font-bold"
                    onClick={() => handleKeypadInput(key)}
                  >
                    {key}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-16 text-lg font-bold text-red-600"
                  onClick={() => setKeypadValue((prev) => prev.slice(0, -1))}
                >
                  Suppr
                </Button>
              </div>
              <Button type="button" variant="outline" className="h-12 w-full" onClick={() => setKeypadValue('')}>
                Effacer tout
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle>Recapitulatif</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total attendu</span>
                <span className="font-bold text-slate-900">{safeToFixed(totalExpected)} EUR</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total saisi</span>
                <span className="font-bold text-slate-900">{safeToFixed(totalEntered)} EUR</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={isBalanced ? 'text-green-700' : hasOverflow ? 'text-amber-700' : 'text-red-700'}>
                  {isBalanced ? 'Ecart' : hasOverflow ? 'Surplus' : 'Restant'}
                </span>
                <span className={`font-black ${isBalanced ? 'text-green-700' : hasOverflow ? 'text-amber-700' : 'text-red-700'}`}>
                  {safeToFixed(Math.abs(difference))} EUR
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};


export default function Encaissements() {
  const { filterByTenant, currentTenant, currentUser, withTenant } = useTenant();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('encaissement');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [encaissementDate, setEncaissementDate] = useState(new Date());
  const [verificationDate, setVerificationDate] = useState(new Date());
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedVerificationDriver, setSelectedVerificationDriver] = useState(null);
  const [payments, setPayments] = useState(emptyPayments());
  const [verificationPayments, setVerificationPayments] = useState(emptyPayments());

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
