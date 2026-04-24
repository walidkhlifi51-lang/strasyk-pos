import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { XCircle, KeyRound, X } from 'lucide-react';
import { useSecurity } from '../contexts/SecurityContext';

export default function PinLockScreen({ pageName, children }) {
  const [pin, setPin] = useState('');
  const [isTemporarilyUnlocked, setTemporarilyUnlocked] = useState(false);
  const { verifyPin, pinError } = useSecurity();
  const navigate = useNavigate();

  const handleInput = (value) => {
    if (pin.length < 8) {
      setPin(pin + value);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (verifyPin(pageName, pin)) {
      setTemporarilyUnlocked(true);
    }
    setPin('');
  };

  const handleClose = () => {
    navigate(-1);
  };

  const PinDisplay = () => (
    <div className="flex justify-center items-center space-x-2 h-16 bg-gray-100 rounded-lg border">
      {Array.from({ length: pin.length }).map((_, i) => (
        <span key={i} className="w-4 h-4 bg-gray-700 rounded-full animate-pulse"></span>
      ))}
    </div>
  );

  if (isTemporarilyUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-2xl shadow-2xl relative">
        <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
            onClick={handleClose}
        >
            <X className="w-5 h-5"/>
        </Button>

        <div className="text-center">
          <KeyRound className="mx-auto h-12 w-12 text-indigo-500" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Accès à "{pageName}"</h1>
          <p className="mt-2 text-sm text-gray-600">Veuillez saisir le code PIN pour cette section.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PinDisplay />
          
          {pinError && (
              <div className="flex items-center justify-center gap-2 text-red-600 animate-shake">
                  <XCircle className="w-4 h-4"/>
                  <p className="text-sm font-medium">{pinError}</p>
              </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {[...Array(9).keys()].map(i => i + 1).map(num => (
              <Button key={num} type="button" variant="outline" className="h-14 text-2xl" onClick={() => handleInput(num.toString())}>
                {num}
              </Button>
            ))}
            <Button type="button" variant="outline" className="h-14 text-xl" onClick={handleBackspace}>⌫</Button>
            <Button type="button" variant="outline" className="h-14 text-2xl" onClick={() => handleInput('0')}>0</Button>
            <Button type="submit" className="h-14 text-lg font-semibold bg-indigo-600 hover:bg-indigo-700">OK</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
