import React, { useState } from 'react';
import { useTenant } from '@/components/contexts/TenantContext';

export default function TenantSelector() {
  const { availableTenants, currentTenant, selectTenant } = useTenant();
  const [error, setError] = useState('');
  if (availableTenants.length < 2) return null;
  return (
    <div className="border-b p-3">
      <label className="block text-xs font-medium text-gray-600">
        Commerce
        <select
          className="mt-1 w-full rounded border bg-white p-2 text-sm"
          value={currentTenant?.id || ''}
          onChange={async (event) => {
            setError('');
            try { await selectTenant(event.target.value); }
            catch { setError('Changement impossible. Verifiez vos acces et les operations en attente.'); }
          }}
        >
          {!currentTenant && <option value="" disabled>Choisir un commerce</option>}
          {availableTenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.nom_commercial}{tenant.active !== true ? ' (suspendu)' : ''}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
