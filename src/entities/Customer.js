import { createEntity } from './entityFactory';

export const Customer = createEntity('Customer', {
  type: 'object',
  properties: {
    nom: { type: 'string' },
    prenom: { type: 'string' },
    telephone: { type: 'string' },
    email: { type: 'string' },
    adresse: { type: 'string' },
    code_postal: { type: 'string' },
    ville: { type: 'string' },
    etage: { type: 'string' },
    interphone: { type: 'string' },
    notes: { type: 'string' },
  },
});

