import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';

export function PriceInput({ value, onChange, placeholder = "0.00", className = "", ...props }) {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const previousValueRef = useRef(value);

  useEffect(() => {
    // Ne mettre à jour que si le champ n'est pas focusé ET que la valeur a vraiment changé de l'extérieur
    if (!isFocused && previousValueRef.current !== value) {
      previousValueRef.current = value;
      
      if (value === null || value === undefined || value === '' || value === 0) {
        setDisplayValue('');
      } else {
        setDisplayValue(String(value));
      }
    }
  }, [value, isFocused]);

  const handleFocus = (e) => {
    setIsFocused(true);
    // Vider le champ si c'est 0 ou vide
    if (value === 0 || value === '' || value === null || value === undefined) {
      setDisplayValue('');
    } else {
      setDisplayValue(String(value));
    }
    e.target.select(); // Sélectionner tout le texte pour faciliter l'édition
  };

  const handleBlur = () => {
    setIsFocused(false);
    
    // Vérifier que onChange existe et est une fonction
    if (typeof onChange !== 'function') {
      console.warn('PriceInput: onChange prop is not a function');
      return;
    }
    
    // Convertir la valeur finale
    const numValue = parseFloat(displayValue.replace(',', '.'));
    if (!isNaN(numValue)) {
      previousValueRef.current = numValue;
      onChange(numValue);
    } else if (displayValue === '') {
      previousValueRef.current = 0;
      onChange(0);
    }
  };

  const handleChange = (e) => {
    let newValue = e.target.value;
    // Remplacer la virgule par un point pour la validation
    const normalizedValue = newValue.replace(',', '.');
    
    // Accepter seulement les chiffres, un point et une virgule
    if (/^[0-9]*[.,]?[0-9]*$/.test(normalizedValue)) {
      setDisplayValue(newValue);
    }
  };

  const handleKeyDown = (e) => {
    // Permettre les touches de navigation et suppression
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      return;
    }
    // Remplacer automatiquement la virgule par un point
    if (e.key === ',') {
      e.preventDefault();
      const newValue = displayValue + '.';
      setDisplayValue(newValue);
    }
  };

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  );
}
