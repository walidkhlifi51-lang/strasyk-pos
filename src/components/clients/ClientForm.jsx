import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTenant } from '../contexts/TenantContext';

export default function ClientForm({ initialData, onSubmit, onCancel }) {
  const { currentTenant } = useTenant();
  
  const [client, setClient] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    adresse: '',
    code_postal: '',
    ville: '',
    etage: '',
    interphone: '',
    notes: '',
  });

  useEffect(() => {
    if (initialData) {
      setClient({ ...initialData });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setClient(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...client, tenant_id: currentTenant.id });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="nom">Nom</Label>
                <Input id="nom" name="nom" value={client.nom || ''} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="prenom">Prénom</Label>
                <Input id="prenom" name="prenom" value={client.prenom || ''} onChange={handleChange} />
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="telephone">Téléphone</Label>
                <Input id="telephone" name="telephone" type="tel" value={client.telephone || ''} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={client.email || ''} onChange={handleChange} />
            </div>
        </div>
        <div className="space-y-2">
            <Label htmlFor="adresse">Adresse</Label>
            <Input id="adresse" name="adresse" value={client.adresse || ''} onChange={handleChange} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label htmlFor="code_postal">Code Postal</Label>
                <Input id="code_postal" name="code_postal" value={client.code_postal || ''} onChange={handleChange} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="ville">Ville</Label>
                <Input id="ville" name="ville" value={client.ville || ''} onChange={handleChange} />
            </div>
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label htmlFor="etage">Étage / Appt</Label>
                <Input id="etage" name="etage" value={client.etage || ''} onChange={handleChange} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="interphone">Interphone / Code</Label>
                <Input id="interphone" name="interphone" value={client.interphone || ''} onChange={handleChange} />
            </div>
        </div>
        <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" value={client.notes || ''} onChange={handleChange} />
        </div>
        <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
            <Button type="submit">{initialData && initialData.id ? 'Mettre à jour' : 'Créer Client'}</Button>
        </div>
    </form>
  );
}
