import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from "@/components/ui/use-toast";
import { Trash2 } from 'lucide-react';
import NumericKeyboard from '../encaissements/NumericKeyboard';
import { Input } from '@/components/ui/input';

const safeToFixed = (value, decimals = 2) => {
  const num = Number(value);
  return isNaN(num) ? '0.00' : num.toFixed(decimals);
};

const paymentMethods = [
  { value: 'especes', label: 'Espèces', emoji: '💵' },
  { value: 'carte_bancaire', label: 'Carte', emoji: '💳' },
  { value: 'ticket_restaurant', label: 'Ticket Resto', emoji: '🎫' },
  { value: 'cheque', label: 'Chèque', emoji: '📝' },
];

const methodColors = {
  especes: 'bg-green-500 hover:bg-green-600',
  carte_bancaire: 'bg-blue-500 hover:bg-blue-600',
  ticket_restaurant: 'bg-orange-500 hover:bg-orange-600',
  cheque: 'bg-purple-500 hover:bg-purple-600',
};

export default function PaymentModal({ isOpen, onClose, onPayment, onComplete, totalAmount, customerCagnotte = 0, cagnotteRule, orderType, profile, initialBipeurNumber = '', lockPaidState = false }) {
  const [isCredit, setIsCredit] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [cagnotteSpent, setCagnotteSpent] = useState(0);
  const [plannedPaymentMethod, setPlannedPaymentMethod] = useState('especes');
  const [numeroBipeur, setNumeroBipeur] = useState('');
  const [showBipeurPicker, setShowBipeurPicker] = useState(false);
  const [activeInputId, setActiveInputId] = useState(null);
  const [isReadyForNewInput, setIsReadyForNewInput] = useState(false);
  const [inputBuffer, setInputBuffer] = useState('');
  const { toast } = useToast();
  const showBipeurField = profile?.bipeur_enabled === true && (orderType === 'sur_place' || orderType === 'emporter');
  const quickBipeurNumbers = useMemo(() => Array.from({ length: 20 }, (_, index) => String(index + 1)), []);

  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.montant) || 0), 0) + (Number(cagnotteSpent) || 0);
  const remainingAmount = totalAmount - totalPaid;
  const hasCashPayment = payments.some((payment) => payment.methode === 'especes' && (Number(payment.montant) || 0) > 0);
  const overpaymentAmount = Math.max(0, Number(safeToFixed(totalPaid - totalAmount)));
  const isCreditSwitchDisabled = lockPaidState || (profile?.force_immediate_payment === true && (orderType === 'sur_place' || orderType === 'emporter'));

  useEffect(() => {
    if (isOpen) {
      setIsCredit(false);
      setPaymentChoice(isCreditSwitchDisabled ? 'pay_now' : null);
      setPayments([]);
      setCagnotteSpent(0);
      setPlannedPaymentMethod('especes');
      setNumeroBipeur(initialBipeurNumber ? String(initialBipeurNumber) : '');
      setShowBipeurPicker(false);
      setActiveInputId(null);
      setIsReadyForNewInput(false);
      setInputBuffer('');
    }
  }, [isOpen, initialBipeurNumber, isCreditSwitchDisabled]);

  useEffect(() => {
    if (isCredit) {
      setPayments([]);
      setCagnotteSpent(0);
      setActiveInputId(null);
      setIsReadyForNewInput(false);
    }
  }, [isCredit]);

  useEffect(() => {
    if (activeInputId) {
      setIsReadyForNewInput(true);
      setInputBuffer('');
    }
  }, [activeInputId]);

  useEffect(() => {
    if (!isCredit && cagnotteSpent > 0) {
      const remaining = totalAmount - cagnotteSpent;
      const autoPayment = payments.find(p => p.isAutoAdded);
      if (remaining > 0.01) {
        if (autoPayment) {
          setPayments(payments.map(p => p.id === autoPayment.id ? { ...p, montant: parseFloat(safeToFixed(remaining)) } : p));
        } else if (payments.length === 0) {
          const newPaymentId = Date.now();
          setPayments([{ id: newPaymentId, methode: 'especes', montant: parseFloat(safeToFixed(remaining)), isAutoAdded: true }]);
        }
      } else if (autoPayment) {
        setPayments(payments.filter(p => p.id !== autoPayment.id));
      }
    }
  }, [cagnotteSpent, isCredit, totalAmount]);

  const handleQuickPayment = (method) => {
    const amount = remainingAmount > 0 ? parseFloat(safeToFixed(remainingAmount)) : 0;
    const newPaymentId = Date.now();
    setPayments(prev => [...prev, { id: newPaymentId, methode: method, montant: amount, isAutoAdded: false }]);
    setActiveInputId(`payment-${newPaymentId}`);
    setInputBuffer('');
    setIsReadyForNewInput(true);
  };

  const updatePayment = (id, field, value) => {
    setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removePayment = (id) => {
    setPayments(payments.filter(p => p.id !== id));
    if (`payment-${id}` === activeInputId) setActiveInputId(null);
  };

  const handleValidate = async () => {
    if (!lockPaidState && profile?.force_immediate_payment === true && (orderType === 'sur_place' || orderType === 'emporter')) {
      if (isCredit || payments.length === 0) {
        toast({ title: "Paiement obligatoire", description: "Le paiement immédiat est obligatoire.", variant: "destructive" });
        return;
      }
    }
    if (!isCredit && requiresPaymentCollection && remainingAmount > 0.01) {
      toast({ title: "Montant incorrect", description: "Le montant payé ne couvre pas le total.", variant: "destructive" });
      return;
    }
    if (!isCredit && overpaymentAmount > 0.01 && !hasCashPayment) {
      toast({ title: "Montant incorrect", description: "La monnaie Ã  rendre n'est autorisÃ©e qu'avec un paiement en espÃ¨ces.", variant: "destructive" });
      return;
    }
    try {
      const normalizedPayments = isCredit
        ? []
        : payments.map(({ id, isAutoAdded, ...rest }) => ({ ...rest }));

      if (!isCredit && overpaymentAmount > 0.01) {
        const lastCashPaymentIndex = [...normalizedPayments].map((payment) => payment.methode).lastIndexOf('especes');
        if (lastCashPaymentIndex >= 0) {
          normalizedPayments[lastCashPaymentIndex] = {
            ...normalizedPayments[lastCashPaymentIndex],
            monnaie_a_rendre: overpaymentAmount,
          };
        }
      }

      const paymentData = {
        payee: !isCredit,
        mode_paiement: normalizedPayments,
        cagnotte_spent: cagnotteSpent,
        plannedPaymentMethod: (isCredit && orderType === 'livraison') ? plannedPaymentMethod : null,
        numero_bipeur: showBipeurField ? (String(numeroBipeur || '').trim() || null) : null,
      };
      const orderResult = await onPayment(paymentData);
      if (orderResult) {
        onComplete(orderResult);
        onClose();
      }
    } catch (error) {
      toast({ title: "Erreur", description: `La commande n'a pas pu être validée: ${error.message}`, variant: "destructive" });
    }
  };

  const handleKeyboardInput = (key) => {
    if (!activeInputId) return;
    let currentValue = inputBuffer || '';
    let newValueString;
    if (isReadyForNewInput && key !== 'del') {
      newValueString = key === '.' ? '0.' : key;
      setIsReadyForNewInput(false);
    } else {
      setIsReadyForNewInput(false);
      if (key === 'del') {
        newValueString = currentValue.slice(0, -1);
      } else {
        if (key === '.' && currentValue.includes('.')) return;
        newValueString = currentValue + key;
      }
    }
    setInputBuffer(newValueString);
    if (newValueString === '' || newValueString === '.') {
      if (activeInputId === 'cagnotte') setCagnotteSpent(0);
      else if (activeInputId.startsWith('payment-')) updatePayment(parseInt(activeInputId.replace('payment-', '')), 'montant', 0);
      return;
    }
    let newValue = parseFloat(newValueString) || 0;
    if (activeInputId === 'cagnotte') {
      if (newValue > customerCagnotte) { newValue = customerCagnotte; setInputBuffer(customerCagnotte.toString()); }
      if (newValue > totalAmount) { newValue = totalAmount; setInputBuffer(totalAmount.toString()); }
      setCagnotteSpent(newValue);
    } else if (activeInputId.startsWith('payment-')) {
      updatePayment(parseInt(activeInputId.replace('payment-', '')), 'montant', newValue);
    }
  };

  const handleKeyboardClear = () => {
    if (!activeInputId) return;
    if (activeInputId === 'cagnotte') setCagnotteSpent(0);
    else if (activeInputId.startsWith('payment-')) updatePayment(parseInt(activeInputId.replace('payment-', '')), 'montant', 0);
    setInputBuffer('');
    setIsReadyForNewInput(true);
  };

  const getDisplayValue = () => {
    if (!activeInputId) return '0';
    if (inputBuffer !== '') return inputBuffer;
    if (activeInputId === 'cagnotte') return String(cagnotteSpent);
    if (activeInputId.startsWith('payment-')) {
      const p = payments.find(p => p.id === parseInt(activeInputId.replace('payment-', '')));
      return p ? String(p.montant) : '0';
    }
    return '0';
  };

  const isFullyPaid = !isCredit
    && remainingAmount <= 0.01
    && (overpaymentAmount <= 0.01 || hasCashPayment)
    && (payments.length > 0 || cagnotteSpent >= totalAmount - 0.01);
  const showChoiceScreen = !paymentChoice;
  const activatePayNow = () => {
    setPaymentChoice('pay_now');
    setIsCredit(false);
  };
  const activateCredit = () => {
    if (isCreditSwitchDisabled) return;
    setPaymentChoice('credit');
    setIsCredit(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden">

        {/* Header */}
        <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">💳 Encaissement</h2>
          <div className="text-right">
            <p className="text-xs text-gray-400">Total à régler</p>
            <p className="text-3xl font-bold">{safeToFixed(totalAmount)}€</p>
          </div>
        </div>

        {showChoiceScreen ? (
          <div className="p-6 md:p-8 bg-white">
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Choix d'encaissement</p>
                <h3 className="text-2xl font-bold text-gray-900">Que voulez-vous faire pour cette commande ?</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={activatePayNow}
                  className="rounded-2xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-100 p-6 text-left shadow-sm transition-all hover:border-green-500 hover:shadow-md"
                >
                  <div className="text-4xl mb-3">💳</div>
                  <p className="text-xl font-bold text-green-800">Encaisser maintenant</p>
                  <p className="mt-2 text-sm text-green-700">Afficher les moyens de paiement et valider l'encaissement tout de suite.</p>
                </button>

                <button
                  type="button"
                  onClick={activateCredit}
                  disabled={isCreditSwitchDisabled}
                  className={`rounded-2xl border-2 p-6 text-left shadow-sm transition-all ${
                    isCreditSwitchDisabled
                      ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                      : 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-100 hover:border-amber-500 hover:shadow-md'
                  }`}
                >
                  <div className="text-4xl mb-3">📋</div>
                  <p className={`text-xl font-bold ${isCreditSwitchDisabled ? 'text-gray-400' : 'text-amber-800'}`}>Non payée / crédit</p>
                  <p className={`mt-2 text-sm ${isCreditSwitchDisabled ? 'text-gray-400' : 'text-amber-700'}`}>
                    {isCreditSwitchDisabled
                      ? "Le paiement immédiat est obligatoire pour ce type de commande."
                      : "Enregistrer la commande sans paiement immédiat et l'encaisser plus tard."}
                  </p>
                </button>
              </div>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* COLONNE GAUCHE */}
          <div className="p-3 space-y-3 border-r border-gray-200 overflow-y-auto max-h-[55vh]">

            <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <div>
                <p className="text-xs font-semibold text-gray-500">Mode sélectionné</p>
                <p className={`text-sm font-bold ${isCredit ? 'text-amber-700' : 'text-green-700'}`}>
                  {isCredit ? 'Commande non payée / crédit' : 'Encaissement immédiat'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPaymentChoice(isCreditSwitchDisabled ? 'pay_now' : null)}
              >
                Changer
              </Button>
            </div>

            {isCreditSwitchDisabled && (
              <p className="text-xs text-center text-red-600 font-medium p-2 bg-red-50 rounded-lg border border-red-200">
                ⚠️ Paiement immédiat obligatoire pour ce type de commande
              </p>
            )}

            {/* Mode de paiement prévu (crédit + livraison) */}
            {isCredit && orderType === 'livraison' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                <p className="font-semibold text-sm text-blue-900">Mode de paiement prévu à la livraison</p>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map(m => (
                    <Button key={m.value} variant={plannedPaymentMethod === m.value ? 'default' : 'outline'}
                      onClick={() => setPlannedPaymentMethod(m.value)} className="h-11 gap-2">
                      {m.emoji} {m.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {showBipeurField && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={showBipeurPicker ? 'default' : 'outline'}
                    onClick={() => setShowBipeurPicker((value) => !value)}
                    className="h-11"
                  >
                    Bippeur
                  </Button>
                  <Input
                    type="text"
                    value={numeroBipeur}
                    onChange={(e) => setNumeroBipeur(e.target.value)}
                    placeholder="Numero"
                    className="h-11 bg-white"
                  />
                  {numeroBipeur ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setNumeroBipeur('')}>
                      Effacer
                    </Button>
                  ) : null}
                </div>
                {showBipeurPicker && (
                  <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-3">
                    <p className="mb-3 text-sm font-semibold text-indigo-900">Choisir un numero de bippeur</p>
                    <div className="grid grid-cols-5 gap-2">
                      {quickBipeurNumbers.map((number) => (
                        <button
                          key={number}
                          type="button"
                          onClick={() => setNumeroBipeur(number)}
                          className={`h-14 rounded-xl border-2 text-lg font-bold shadow-sm transition-all ${
                            numeroBipeur === number
                              ? 'border-indigo-700 bg-indigo-600 text-white shadow-md scale-[1.02]'
                              : 'border-indigo-200 bg-white text-indigo-700 hover:border-indigo-400 hover:bg-indigo-100'
                          }`}
                        >
                          {number}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isCredit && (
              <>
                {/* Cagnotte */}
                {customerCagnotte > 0 && (
                  <div className={`p-3 bg-amber-50 rounded-xl border-2 ${activeInputId === 'cagnotte' ? 'border-blue-500' : 'border-amber-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">🎁</span>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">Cagnotte client</p>
                        <p className="text-xs text-amber-700">Solde : {safeToFixed(customerCagnotte)}€</p>
                      </div>
                      <input
                        type="text" inputMode="none" readOnly placeholder="0.00"
                        value={activeInputId === 'cagnotte' && inputBuffer !== '' ? inputBuffer : (cagnotteSpent > 0 ? safeToFixed(cagnotteSpent) : '')}
                        onFocus={() => { setActiveInputId('cagnotte'); setInputBuffer(''); setIsReadyForNewInput(true); }}
                        className={`w-24 text-right font-bold text-lg border-2 rounded-lg p-2 outline-none cursor-pointer ${activeInputId === 'cagnotte' ? 'border-blue-500 bg-blue-50' : 'border-amber-300 bg-white'}`}
                      />
                      <span className="font-bold text-amber-700">€</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-xs border-amber-300"
                        onClick={() => { const m = parseFloat(safeToFixed(Math.min(customerCagnotte, totalAmount))); setCagnotteSpent(m); setActiveInputId('cagnotte'); setInputBuffer(String(m)); setIsReadyForNewInput(false); }}>
                        Utiliser tout ({safeToFixed(Math.min(customerCagnotte, totalAmount))}€)
                      </Button>
                      {cagnotteSpent > 0 && (
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setCagnotteSpent(0); setInputBuffer(''); }}>✕ Effacer</Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Boutons de paiement rapide */}
                <div>
                  <p className="text-xs font-bold text-gray-700 mb-1">Mode de paiement :</p>
                  <div className="grid grid-cols-4 gap-2">
                    {paymentMethods.map(m => (
                      <button key={m.value} onClick={() => handleQuickPayment(m.value)}
                        className={`flex flex-col items-center justify-center gap-0.5 h-16 rounded-xl text-white font-bold text-xs shadow-md active:scale-95 transition-transform ${methodColors[m.value]}`}>
                        <span className="text-xl">{m.emoji}</span>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lignes de paiement */}
                {payments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-gray-700">Paiements saisis :</p>
                    {payments.map(p => (
                      <div key={p.id}
                        className={`bg-white border-2 rounded-xl p-2 ${activeInputId === `payment-${p.id}` ? 'border-blue-500 shadow-md' : 'border-gray-200'}`}>
                        {/* Boutons méthode */}
                        <div className="grid grid-cols-4 gap-1 mb-2">
                          {paymentMethods.map(m => (
                            <button key={m.value} onClick={() => updatePayment(p.id, 'methode', m.value)}
                              className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${p.methode === m.value ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}>
                              {m.emoji} {m.label}
                            </button>
                          ))}
                        </div>
                        {/* Montant + suppression */}
                        <div className="flex items-center gap-2">
                          <input
                            type="text" inputMode="none" readOnly placeholder="0.00"
                            value={activeInputId === `payment-${p.id}` && inputBuffer !== '' ? inputBuffer : (p.montant > 0 ? safeToFixed(p.montant) : '')}
                            onFocus={() => { setActiveInputId(`payment-${p.id}`); setInputBuffer(''); setIsReadyForNewInput(true); }}
                            className={`flex-1 text-right font-bold text-xl border-2 rounded-lg p-2 outline-none cursor-pointer ${activeInputId === `payment-${p.id}` ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                          />
                          <span className="font-bold text-gray-400">€</span>
                          <button onClick={() => removePayment(p.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Résumé */}
                {(payments.length > 0 || cagnotteSpent > 0) && (
                  <div className={`rounded-xl p-2.5 border-2 ${isFullyPaid ? 'bg-green-50 border-green-400' : remainingAmount < -0.01 ? 'bg-blue-50 border-blue-300' : 'bg-red-50 border-red-300'}`}>
                    {cagnotteSpent > 0 && (
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>🎁 Cagnotte :</span>
                        <span className="font-bold">-{safeToFixed(cagnotteSpent)}€</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Total encaissé :</span>
                      <span className="font-bold">{safeToFixed(totalPaid)}€</span>
                    </div>
                    <div className="flex justify-between text-base font-bold border-t border-gray-300 pt-1.5 mt-1">
                      {remainingAmount > 0.01 ? (
                        <><span>Reste à payer :</span><span className="text-red-600">{safeToFixed(remainingAmount)}€</span></>
                      ) : remainingAmount < -0.01 ? (
                        <><span>Monnaie à rendre :</span><span className="text-blue-600">{safeToFixed(Math.abs(remainingAmount))}€</span></>
                      ) : (
                        <span className="text-green-600 w-full text-center">✅ Montant exact — prêt à valider !</span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* COLONNE DROITE : CLAVIER */}
          <div className="flex flex-col items-center justify-center p-3 bg-gray-50">
            {!isCredit ? (
              <NumericKeyboard
                displayValue={getDisplayValue()}
                onInput={handleKeyboardInput}
                onClear={handleKeyboardClear}
                onEnter={handleValidate}
                disabled={false}
              />
            ) : (
              <div className="text-center text-gray-400 space-y-3 p-8">
                <p className="text-6xl">📋</p>
                <p className="font-semibold text-gray-500">Mode crédit activé</p>
                <p className="text-sm">La commande sera enregistrée sans paiement immédiat.</p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t bg-white">
          <Button variant="outline" size="lg" onClick={onClose} className="flex-none px-8">Annuler</Button>
          <Button
            size="lg"
            onClick={handleValidate}
            disabled={
              showChoiceScreen
                ? true
                : (!isCredit && !isFullyPaid)
            }
            className={`flex-1 text-lg font-bold transition-colors ${
              showChoiceScreen ? 'bg-gray-300 text-gray-500 cursor-not-allowed' :
              isCredit ? 'bg-amber-500 hover:bg-amber-600 text-white' :
              isFullyPaid ? 'bg-green-600 hover:bg-green-700 text-white' :
              'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {showChoiceScreen
              ? 'Choisissez un mode pour continuer'
              : isCredit
                ? '📋 Enregistrer en crédit'
                : isFullyPaid
                  ? '✅ Valider le paiement'
                  : `Reste ${safeToFixed(remainingAmount)}€ à saisir`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
