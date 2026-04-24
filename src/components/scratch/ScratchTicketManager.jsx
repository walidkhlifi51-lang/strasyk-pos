import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ScratchTicketConfigForm from './ScratchTicketConfigForm';

export default function ScratchTicketManager({ tenantId }) {
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const queryClient = useQueryClient();

  const { data: configs = [] } = useQuery({
    queryKey: ['scratchTickets', tenantId],
    queryFn: () => appClient.entities.ScratchTicketConfig.filter({ tenant_id: tenantId }),
  });

  const toggleMutation = useMutation({
    mutationFn: (config) =>
      appClient.entities.ScratchTicketConfig.update(config.id, { active: !config.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scratchTickets', tenantId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (configId) => appClient.entities.ScratchTicketConfig.delete(configId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scratchTickets', tenantId] }),
  });

  const handleEdit = (config) => {
    setEditingConfig(config);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setEditingConfig(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Campagnes Scratch Tickets</h3>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nouvelle campagne
        </Button>
      </div>

      {configs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>Aucune campagne scratch créée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((config) => (
            <div key={config.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{config.nom}</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    {config.offres?.length || 0} offre(s) • 
                    {config.display_location === 'home' ? ' 🏠 Accueil' :
                     config.display_location === 'post_payment' ? ' ✅ Après paiement' :
                     config.display_location === 'both' ? ' 🔄 Les deux' : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {config.offres?.slice(0, 3).map((offre) => (
                      <span key={offre.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {offre.type === 'product'
                          ? `${offre.quantite}x ${offre.product_nom}`
                          : `${offre.type === 'percentage_discount' ? `-${offre.reduction_value}%` : `-${offre.reduction_value}€`}`}
                      </span>
                    ))}
                    {(config.offres?.length || 0) > 3 && (
                      <span className="text-xs text-gray-500">+{config.offres.length - 3}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => toggleMutation.mutate(config)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    {config.active ? (
                      <ToggleRight className="w-5 h-5 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(config)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition text-blue-600"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(config.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ScratchTicketConfigForm
          config={editingConfig}
          tenantId={tenantId}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
