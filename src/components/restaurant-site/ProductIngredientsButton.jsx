import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Info, X } from 'lucide-react';

export default function ProductIngredientsButton({ ingredients, darkMode = false }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  if (!ingredients || ingredients.length === 0) return null;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - 288)
      });
    }
    setOpen(o => !o);
  };

  const popup = open ? ReactDOM.createPortal(
    <>
      <div
        className="fixed inset-0 z-[1000]"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }}
      />
      <div
        className="fixed z-[1001] bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 min-w-52 max-w-72"
        style={{ top: pos.top, left: pos.left }}
        onClick={e => { e.preventDefault(); e.stopPropagation(); }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-gray-800">🧄 Ingrédients</p>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }}
            className="text-gray-400 hover:text-gray-600 w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ingredients.map((ing, i) => (
            <span key={i} className="text-xs bg-orange-50 text-orange-700 border border-orange-100 px-2.5 py-1 rounded-full font-medium">
              {ing}
            </span>
          ))}
        </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleClick}
        className={`w-6 h-6 rounded-full flex items-center justify-center transition flex-shrink-0 ${
          darkMode
            ? 'bg-white/15 hover:bg-white/25 text-white/70'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700'
        }`}
        title="Voir les ingrédients"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {popup}
    </>
  );
}
