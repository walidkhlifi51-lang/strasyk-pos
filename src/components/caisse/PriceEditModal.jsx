import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Delete } from "lucide-react";

export default function PriceEditModal({ isOpen, onClose, onConfirm, currentPrice, productName }) {
  const [input, setInput] = useState(currentPrice?.toFixed(2) || "0.00");

  useEffect(() => {
    if (isOpen) {
      setInput(Number(currentPrice || 0).toFixed(2));
    }
  }, [isOpen, currentPrice]);

  const handleKey = (key) => {
    setInput(prev => {
      if (key === 'C') return "0";
      if (key === '⌫') {
        const next = prev.slice(0, -1);
        return next === '' ? "0" : next;
      }
      // Allow only one decimal point
      if (key === '.' && prev.includes('.')) return prev;
      // Limit to 2 decimal places
      if (prev.includes('.')) {
        const decimals = prev.split('.')[1];
        if (decimals && decimals.length >= 2) return prev;
      }
      if (prev === "0" && key !== '.') return key;
      return prev + key;
    });
  };

  const handleConfirm = () => {
    const price = parseFloat(input) || 0;
    onConfirm(price);
    onClose();
  };

  const keys = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['.', '0', '⌫'],
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-center text-base truncate">
            Modifier le prix — {productName}
          </DialogTitle>
        </DialogHeader>

        {/* Display */}
        <div className="bg-gray-900 rounded-xl p-4 text-right">
          <span className="text-4xl font-bold text-white tracking-wide">
            {input}€
          </span>
        </div>

        {/* Keypad */}
        <div className="grid grid-rows-4 gap-2">
          {keys.map((row, ri) => (
            <div key={ri} className="grid grid-cols-3 gap-2">
              {row.map(key => (
                <button
                  key={key}
                  onClick={() => handleKey(key)}
                  className={`h-14 rounded-xl text-xl font-bold transition-all active:scale-95 ${
                    key === '⌫'
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : key === 'C'
                      ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {key === '⌫' ? <Delete className="w-5 h-5 mx-auto" /> : key}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Button variant="outline" onClick={onClose} className="h-12 text-base">
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            className="h-12 text-base bg-green-600 hover:bg-green-700 text-white font-bold"
          >
            Valider
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

