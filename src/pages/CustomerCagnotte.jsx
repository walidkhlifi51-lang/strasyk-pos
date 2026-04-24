import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { Gift, Phone, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { buildPublicPageUrl, getPublicHostname, resolvePublicTenantContext } from '@/lib/publicSiteTenant';

const unwrapInvokeResult = (result) => result?.data ?? result ?? null;

export default function CustomerCagnotte() {
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');
  const currentHostname = getPublicHostname();

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
      const { tenant, resolvedBy, customDomain } = await resolvePublicTenantContext({ slug, hostname: currentHostname });

      if (!tenant?.id) {
        setError('Restaurant introuvable.');
        return;
      }

      const phone = telephone.replace(/\s/g, '');
      let data;

      try {
        data = unwrapInvokeResult(await appClient.functions.invoke('getCustomerCagnotte', {
          tenant_id: tenant.id,
          telephone: phone
        }));
      } catch {
        const customers = await appClient.entities.Customer.filter({
          tenant_id: tenant.id,
          telephone: phone,
        });
        const customer = customers[0];
        data = customer
          ? {
              found: true,
              customer_id: customer.id,
              nom: customer.nom || '',
              prenom: customer.prenom || '',
              cagnotte_balance: customer.cagnotte_balance || 0,
            }
          : { found: false };
      }

      if (data?.found) {
        setResult({
          nom: `${data.prenom || ''} ${data.nom || ''}`.trim(),
          cagnotte: data.cagnotte_balance || 0,
          customer_id: data.customer_id,
          order_url: buildPublicPageUrl('OrderOnline', {
            slug: tenant.slug,
            customDomain: resolvedBy === 'domain' ? customDomain : null,
          })
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

  if (!slug && !currentHostname) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <p className="text-gray-500">Erreur : paramètre slug manquant.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gift className="w-8 h-8 text-orange-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Ma Cagnotte</h1>
            <p className="text-gray-500">Consultez votre solde de points fidélité</p>
          </div>

          {/* Form */}
          <form onSubmit={handleCheck} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                Numéro de téléphone
              </label>
              <input
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+33 6 12 34 56 78"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-orange-500 transition"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              {loading ? 'Recherche...' : 'Consulter ma cagnotte'}
            </button>
          </form>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 border-2 border-orange-300 rounded-xl p-6 text-center mb-6">
              <p className="text-gray-600 text-sm mb-2">Bienvenue,</p>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{result.nom}</h2>
              <div className="space-y-2">
                <p className="text-xs text-gray-600 uppercase tracking-wide">Solde de votre cagnotte</p>
                <div className="text-5xl font-bold text-orange-600">
                  {result.cagnotte.toFixed(2)}€
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-sm text-gray-700">
            <p className="font-medium mb-1">💡 Comment ça marche ?</p>
            <p className="text-xs">Chaque achat vous permet d'accumuler des points. Vous pouvez utiliser votre cagnotte lors de vos prochaines commandes.</p>
          </div>
        </div>

        {/* Link to order */}
        {result && (
          <div className="text-center mt-6">
            <a
              href={result.order_url}
              className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-semibold"
            >
              <ChevronRight className="w-4 h-4" />
              Passer une commande
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
