import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { Gift, Phone, X, Loader2, AlertCircle } from 'lucide-react';

const unwrapInvokeResult = (result) => result?.data ?? result ?? null;

export default function CagnotteModal({ isOpen, onClose, tenantSlug, primaryColor }) {
  const [telephone, setTelephone] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!telephone.trim()) {
      setError('Veuillez entrer votre numéro de téléphone');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const phone = telephone.replace(/\s/g, '');
      let data;

      try {
        data = unwrapInvokeResult(await appClient.functions.invoke('getCustomerCagnotte', {
          tenant_id: tenantSlug,
          telephone: phone
        }));
      } catch {
        const customers = await appClient.entities.Customer.filter({
          tenant_id: tenantSlug,
          telephone: phone,
        });
        const customer = customers[0];
        data = customer
          ? {
              found: true,
              nom: customer.nom || '',
              prenom: customer.prenom || '',
              cagnotte_balance: customer.cagnotte_balance || 0,
            }
          : { found: false };
      }

      if (data?.found) {
        setResult({
          nom: `${data.prenom || ''} ${data.nom || ''}`.trim(),
          cagnotte: data.cagnotte_balance || 0
        });
      } else {
        setError('Aucun compte client trouvé avec ce numéro');
      }
    } catch (err) {
      setError('Erreur lors de la recherche. Veuillez réessayer.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTelephone('');
    setResult(null);
    setError('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}20` }}>
              <Gift className="w-5 h-5" style={{ color: primaryColor }} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Ma Cagnotte</h2>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form or Result */}
        {!result ? (
          <form onSubmit={handleCheck} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-1.5" />
                Numéro de téléphone
              </label>
              <input
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+33 6 12 34 56 78"
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 transition text-sm"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-2.5 rounded-lg transition text-white text-sm"
              style={{ 
                backgroundColor: loading ? '#d1d5db' : primaryColor,
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Recherche...
                </span>
              ) : (
                'Consulter ma cagnotte'
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-gradient-to-br rounded-xl p-6 text-center" style={{ backgroundColor: `${primaryColor}15`, borderLeft: `4px solid ${primaryColor}` }}>
              <p className="text-gray-600 text-sm mb-2">Bienvenue,</p>
              <h3 className="text-xl font-bold text-gray-900 mb-4">{result.nom}</h3>
              <div className="space-y-1">
                <p className="text-xs text-gray-600 uppercase tracking-wide">Solde de votre cagnotte</p>
                <div className="text-4xl font-bold" style={{ color: primaryColor }}>
                  {result.cagnotte.toFixed(2)}€
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-lg border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition"
              >
                Autre numéro
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-lg text-white font-semibold text-sm transition"
                style={{ backgroundColor: primaryColor }}
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
