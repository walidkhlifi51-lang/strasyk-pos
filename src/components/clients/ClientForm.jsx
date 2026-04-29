import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTenant } from '../contexts/TenantContext';

const emptyExtraAddress = () => ({
  label: '',
  adresse: '',
  code_postal: '',
  ville: '',
  etage: '',
  interphone: '',
});

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
    adresses: [],
  });

  useEffect(() => {
    if (initialData) {
      setClient({
        nom: initialData.nom || '',
        prenom: initialData.prenom || '',
        telephone: initialData.telephone || '',
        email: initialData.email || '',
        adresse: initialData.adresse || '',
        code_postal: initialData.code_postal || '',
        ville: initialData.ville || '',
        etage: initialData.etage || '',
        interphone: initialData.interphone || '',
        notes: initialData.notes || '',
        adresses: Array.isArray(initialData.adresses) ? initialData.adresses : [],
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setClient((prev) => ({ ...prev, [name]: value }));
  };

  const handleExtraAddressChange = (index, field, value) => {
    setClient((prev) => ({
      ...prev,
      adresses: prev.adresses.map((address, addressIndex) => (
        addressIndex === index ? { ...address, [field]: value } : address
      )),
    }));
  };

  const handleAddExtraAddress = () => {
    setClient((prev) => ({ ...prev, adresses: [...prev.adresses, emptyExtraAddress()] }));
  };

  const handleRemoveExtraAddress = (index) => {
    setClient((prev) => ({
      ...prev,
      adresses: prev.adresses.filter((_, addressIndex) => addressIndex !== index),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanedAddresses = (client.adresses || [])
      .map((address) => ({
        label: address.label || '',
        adresse: address.adresse || '',
        code_postal: address.code_postal || '',
        ville: address.ville || '',
        etage: address.etage || '',
        interphone: address.interphone || '',
      }))
      .filter((address) => address.adresse.trim());

    onSubmit({ ...client, adresses: cleanedAddresses, tenant_id: currentTenant.id });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-1">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nom">Nom</Label>
          <Input id="nom" name="nom" value={client.nom || ''} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prenom">Prenom</Label>
          <Input id="prenom" name="prenom" value={client.prenom || ''} onChange={handleChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="telephone">Telephone</Label>
          <Input id="telephone" name="telephone" type="tel" value={client.telephone || ''} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" value={client.email || ''} onChange={handleChange} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="adresse">Adresse principale</Label>
        <Input id="adresse" name="adresse" value={client.adresse || ''} onChange={handleChange} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="code_postal">Code postal</Label>
          <Input id="code_postal" name="code_postal" value={client.code_postal || ''} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ville">Ville</Label>
          <Input id="ville" name="ville" value={client.ville || ''} onChange={handleChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="etage">Etage / Appt</Label>
          <Input id="etage" name="etage" value={client.etage || ''} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="interphone">Interphone / Code</Label>
          <Input id="interphone" name="interphone" value={client.interphone || ''} onChange={handleChange} />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Adresses supplementaires</p>
            <p className="text-sm text-gray-500">Utiles si le client a plusieurs lieux de livraison.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddExtraAddress}>
            Ajouter une adresse
          </Button>
        </div>

        {(client.adresses || []).length > 0 ? (
          <div className="space-y-3">
            {client.adresses.map((address, index) => (
              <div key={index} className="rounded-lg border bg-gray-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Adresse {index + 1}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveExtraAddress(index)}>
                    Supprimer
                  </Button>
                </div>
                <Input
                  placeholder="Libelle (ex: Travail)"
                  value={address.label || ''}
                  onChange={(e) => handleExtraAddressChange(index, 'label', e.target.value)}
                />
                <Input
                  placeholder="Adresse"
                  value={address.adresse || ''}
                  onChange={(e) => handleExtraAddressChange(index, 'adresse', e.target.value)}
                />
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Input
                    placeholder="Code postal"
                    value={address.code_postal || ''}
                    onChange={(e) => handleExtraAddressChange(index, 'code_postal', e.target.value)}
                  />
                  <Input
                    placeholder="Ville"
                    value={address.ville || ''}
                    onChange={(e) => handleExtraAddressChange(index, 'ville', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Input
                    placeholder="Etage / Appt"
                    value={address.etage || ''}
                    onChange={(e) => handleExtraAddressChange(index, 'etage', e.target.value)}
                  />
                  <Input
                    placeholder="Interphone"
                    value={address.interphone || ''}
                    onChange={(e) => handleExtraAddressChange(index, 'interphone', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Aucune adresse supplementaire.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" value={client.notes || ''} onChange={handleChange} />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
        <Button type="submit">{initialData && initialData.id ? 'Mettre a jour' : 'Creer client'}</Button>
      </div>
    </form>
  );
}
