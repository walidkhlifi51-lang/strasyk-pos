import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { appClient } from '@/api/appClient';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useTenant } from '@/components/contexts/TenantContext';

export default function ScratchTicketConfigForm({ config = null, tenantId: tenantIdProp, onClose }) {
  const { currentTenant } = useTenant();
  const tenantId = tenantIdProp || currentTenant?.id;
  const queryClient = useQueryClient();
  const [nom, setNom] = useState(config?.nom || '');
  const [active, setActive] = useState(config?.active ?? true);
  const [displayLocation, setDisplayLocation] = useState(config?.display_location || 'site_home');
  const [montantMinimum, setMontantMinimum] = useState(config?.montant_minimum ?? 0);
  const [offres, setOffres] = useState(config?.offres || []);
  const [errors, setErrors] = useState({});

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products-for-scratch', tenantId],
    queryFn: () => appClient.entities.Product.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => appClient.entities.ScratchTicketConfig.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scratchTickets', tenantId] });
      onClose();
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data) => appClient.entities.ScratchTicketConfig.update(config.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scratchTickets', tenantId] });
      onClose();
    }
  });

  const handleAddOffre = () => {
    setOffres([...offres, {
      id: `offre-${Date.now()}`,
      type: 'product',
      product_id: '',
      product_nom: '',
      quantite: 1,
      nombre_tickets: 1
    }]);
  };

  const handleUpdateOffre = (index, field, value) => {
    const updated = [...offres];
    updated[index] = { ...updated[index], [field]: value };
    setOffres(updated);
  };

  const handleRemoveOffre = (index) => {
    setOffres(offres.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const e = {};
    if (!nom.trim()) e.nom = 'Requis';
    if (offres.length === 0) e.offres = 'Au moins une offre requise';
    offres.forEach((o, i) => {
      if (o.type === 'product' && !o.product_id) {
        e[`offre_${i}`] = 'Produit requis';
      }
      if ((o.type === 'percentage_discount' || o.type === 'fixed_discount') && !o.reduction_value) {
        e[`offre_${i}`] = 'Valeur requise';
      }
      if (!o.nombre_tickets || o.nombre_tickets < 1) {
        e[`offre_${i}`] = 'Nombre de tickets requis';
      }
    });

    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    const data = {
      tenant_id: tenantId,
      nom,
      active,
      display_location: displayLocation,
      montant_minimum: montantMinimum || 0,
      offres
    };

    if (config) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-lg">{config ? 'Modifier campagne' : 'Nouvelle campagne'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Nom de la campagne</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.nom ? 'border-red-400' : 'border-gray-200'}`}
              placeholder="Ex: Noël 2024"
            />
            {errors.nom && <p className="text-red-500 text-xs mt-1">{errors.nom}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">Affichage</label>
            <div className="space-y-2">
              {[
                { value: 'site_home', label: '🏠 Page d\'accueil du site' },
                { value: 'order_page', label: '🛒 Page de commande' },
                { value: 'pre_payment', label: '💳 Avant paiement' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="location"
                    value={opt.value}
                    checked={displayLocation === opt.value}
                    onChange={(e) => setDisplayLocation(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Montant minimum de commande (€)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={montantMinimum || ''}
              onChange={(e) => setMontantMinimum(parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="0 = pas de minimum"
            />
            <p className="text-xs text-gray-400 mt-1">Le client doit atteindre ce montant pour pouvoir utiliser son gain</p>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Activer cette campagne</span>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-gray-600">Offres</label>
              <button
                onClick={handleAddOffre}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>

            {errors.offres && <p className="text-red-500 text-xs mb-2">{errors.offres}</p>}

            <div className="space-y-3">
              {offres.map((offre, i) => (
                <div key={offre.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  {errors[`offre_${i}`] && (
                    <p className="text-red-500 text-xs">{errors[`offre_${i}`]}</p>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Type</label>
                      <select
                        value={offre.type}
                        onChange={(e) => handleUpdateOffre(i, 'type', e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
                      >
                        <option value="product">Produit gratuit</option>
                        <option value="percentage_discount">Réduction %</option>
                        <option value="fixed_discount">Réduction €</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Nombre de tickets</label>
                      <input
                        type="number"
                        min="1"
                        value={offre.nombre_tickets || 1}
                        onChange={(e) => handleUpdateOffre(i, 'nombre_tickets', parseInt(e.target.value) || 1)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
                      />
                    </div>
                  </div>

                  {offre.type === 'product' && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Produit</label>
                      <select
                        value={offre.product_id || ''}
                        onChange={(e) => {
                          const selected = products.find(p => p.id === e.target.value);
                          const updated = [...offres];
                          updated[i] = { ...updated[i], product_id: e.target.value, product_nom: selected?.nom || '' };
                          setOffres(updated);
                        }}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
                      >
                        <option value="">-- Choisir un produit --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.nom}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(offre.type === 'percentage_discount' || offre.type === 'fixed_discount') && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">
                        Valeur ({offre.type === 'percentage_discount' ? '%' : '€'})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={offre.reduction_value || ''}
                        onChange={(e) => handleUpdateOffre(i, 'reduction_value', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
                      />
                    </div>
                  )}

                  <div>
                    <button
                      onClick={() => handleRemoveOffre(i)}
                      className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t p-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 text-sm font-medium"
          >
            {isLoading ? 'Enregistrement...' : config ? 'Modifier' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
