import React, { useRef, useEffect, useState } from 'react';
import { Gift, AlertCircle } from 'lucide-react';

const SCRATCH_THRESHOLD = 0.65; // Doit gratter 65% pour révéler
const SCRATCH_RADIUS = 25; // Rayon du grattage plus grand
const DRAG_CHECK_INTERVAL = 100; // Vérifier révélation tous les 100ms pour plus de réalisme

export default function ScratchTicketCard({ ticket, onRevealed, primaryColor, tenantId }) {
  const canvasRef = useRef(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [context, setContext] = useState(null);
  const [isScratching, setIsScratching] = useState(false);
  const lastCheckRef = useRef(0);

  // Initialiser le scratch
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Taille du canvas
    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = rect?.width || 300;
    const height = rect?.height || 150;

    canvas.width = width;
    canvas.height = height;

    // Remplir avec la couche de scratch (gris argenté avec texture)
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(0, 0, width, height);

    // Ajouter une texture avec du bruit
    ctx.fillStyle = '#c0a03c';
    for (let i = 0; i < 200; i++) {
      ctx.fillRect(
        Math.random() * width,
        Math.random() * height,
        Math.random() * 3,
        Math.random() * 3
      );
    }

    // Ombres pour effet 3D
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, 0, width, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(0, height - 3, width, 3);

    ctx.strokeStyle = '#a89534';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);

    setContext(ctx);
  }, []);

  const handleMouseDown = (e) => {
    if (!context || isRevealed) return;
    setIsScratching(true);
    scratchAt(e);
  };

  const handleMouseMove = (e) => {
    if (!isScratching || !context || isRevealed) return;
    scratchAt(e);
  };

  const handleMouseUp = () => {
    setIsScratching(false);
  };

  const handleTouchStart = (e) => {
    if (!context || isRevealed) return;
    e.preventDefault();
    setIsScratching(true);
    scratchAt(e.touches[0]);
  };

  const handleTouchMove = (e) => {
    if (!isScratching || !context || isRevealed) return;
    e.preventDefault();
    scratchAt(e.touches[0]);
  };

  const handleTouchEnd = () => {
    setIsScratching(false);
  };

  const scratchAt = (e) => {
    if (!context) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.pageX) - rect.left;
    const y = (e.clientY || e.pageY) - rect.top;

    // Gratter avec un rayon plus grand
    context.clearRect(x - SCRATCH_RADIUS, y - SCRATCH_RADIUS, SCRATCH_RADIUS * 2, SCRATCH_RADIUS * 2);

    // Vérifier révélation avec throttling
    const now = Date.now();
    if (now - lastCheckRef.current > DRAG_CHECK_INTERVAL) {
      lastCheckRef.current = now;
      checkReveal();
    }
  };

  const checkReveal = () => {
    if (!context || isRevealed) return;

    const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    const data = imageData.data;
    let scratched = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) scratched++;
    }
    const percent = scratched / (data.length / 4);

    if (percent > SCRATCH_THRESHOLD) {
      console.log('🎫 Ticket gratté à', (percent * 100).toFixed(1) + '%', '- Révélation:', ticket);
      setIsRevealed(true);
      onRevealed(ticket);
    }
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const getOffreLabel = () => {
    switch (ticket.offre_type) {
      case 'product':
        return `${ticket.offre_data.quantite}x ${ticket.offre_data.product_nom}`;
      case 'percentage_discount':
        return `-${ticket.offre_data.reduction_value}%`;
      case 'fixed_discount':
        return `-${ticket.offre_data.reduction_value}€`;
      default:
        return '?';
    }
  };

  const getOffreIcon = () => {
    switch (ticket.offre_type) {
      case 'product':
        return '🍕';
      case 'percentage_discount':
        return '🎁';
      case 'fixed_discount':
        return '💰';
      default:
        return '⭐';
    }
  };

  return (
    <div className="relative w-full">
      {isRevealed ? (
        <div
          className="relative w-full aspect-video rounded-xl overflow-hidden flex items-center justify-center text-center p-6 border-4 animate-in fade-in duration-500"
          style={{
            backgroundColor: `${primaryColor}15`,
            borderColor: primaryColor,
          }}
        >
          <div>
            <div className="text-5xl mb-3 animate-bounce">{getOffreIcon()}</div>
            <p className="text-xl font-bold text-gray-900 mb-1">Vous avez gagné !</p>
            <p className="text-3xl font-black" style={{ color: primaryColor }}>
              {getOffreLabel()}
            </p>
            <p className="text-xs text-gray-500 mt-3">↓ Ajout automatique au panier</p>
          </div>
        </div>
      ) : (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden cursor-pointer group select-none">
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="text-center text-white">
              <Gift className="w-12 h-12 mx-auto mb-2 opacity-80" />
              <p className="font-bold text-lg">Grattez pour gagner !</p>
              <p className="text-xs opacity-75 mt-1">Utilisez votre doigt ou souris</p>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onTouchMove={handleTouchMove}
            onTouchStart={handleTouchStart}
            className="absolute inset-0 w-full h-full cursor-pointer"
            style={{ touchAction: 'none' }}
          />

          <div className="absolute inset-0 pointer-events-none group-hover:opacity-75 transition-opacity flex items-center justify-center">
            <div className="text-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-sm font-semibold">Grattez ici</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
