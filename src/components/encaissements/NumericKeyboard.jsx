import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export default function NumericKeyboard({ currentValue, onInput, onClear, onBackspace, onEnter }) {
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg space-y-3 sticky top-8">
      <div className="bg-gray-100 border rounded-lg p-3 text-right">
        <span className="text-3xl font-mono break-all text-gray-800">{currentValue || '0'}</span>
        <span className="text-xl ml-1 text-gray-500">€</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {keys.map(key => (
          <Button
            key={key}
            onClick={() => onInput(key)}
            className="h-16 text-2xl font-semibold"
            variant="outline"
          >
            {key}
          </Button>
        ))}
        <Button onClick={() => onInput('.')} className="h-16 text-2xl font-semibold" variant="outline">.</Button>
        <Button onClick={() => onInput('0')} className="h-16 text-2xl font-semibold" variant="outline">0</Button>
        <Button onClick={onBackspace} className="h-16 flex items-center justify-center" variant="outline">
            <Trash2 className="w-6 h-6 text-red-500"/>
        </Button>
      </div>
      
      <Button onClick={onEnter} className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700">
        Valider l'entrée
      </Button>
    </div>
  );
}
