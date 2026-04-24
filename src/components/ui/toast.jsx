import React, { createContext, useContext, useState, useEffect } from "react";
import { X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const toast = ({ title, description, variant = "default", duration = 4000 }) => {
    if (!title && !description) return;
    const id = Date.now();
    const newToast = { id, title, description, variant, duration };
    
    setToasts(prev => [...prev, newToast]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, duration);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.filter(t => t.title || t.description).map((toast) => (
        <Toast key={toast.id} {...toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

export const Toast = ({ id, title, description, variant, onRemove }) => {
  if (!title && !description) return null;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleRemove = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (onRemove) onRemove(id);
    }, 300);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "destructive":
        return "bg-red-50 border-red-200 text-red-900";
      case "success":
        return "bg-green-50 border-green-200 text-green-900";
      default:
        return "bg-white border-gray-200 text-gray-900";
    }
  };

  const getIcon = () => {
    switch (variant) {
      case "destructive":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div
      className={`
        transform transition-all duration-300 ease-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        min-w-80 max-w-md p-4 rounded-lg shadow-lg border
        ${getVariantStyles()}
      `}
    >
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1 min-w-0">
          {title && <div className="font-semibold">{title}</div>}
          {description && <div className="text-sm opacity-90 mt-1">{description}</div>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          className="h-6 w-6 p-0 hover:bg-black/10"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export const ToastClose = ({ onClick }) => (
  <Button variant="ghost" size="sm" onClick={onClick} className="h-6 w-6 p-0 hover:bg-black/10">
    <X className="w-4 h-4" />
  </Button>
);

export const ToastTitle = ({ children }) => (
  <div className="font-semibold">{children}</div>
);

export const ToastDescription = ({ children }) => (
  <div className="text-sm opacity-90 mt-1">{children}</div>
);

export const ToastAction = ({ children, ...props }) => (
  <Button size="sm" {...props}>{children}</Button>
);

export const ToastViewport = ({ children }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2">{children}</div>
);
