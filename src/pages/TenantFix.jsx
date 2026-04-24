import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Store, User } from "lucide-react";

const normalizeEmail = (value) => (value || "").trim().toLowerCase();

export default function TenantFix() {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Chargement des informations...");
  const [userInfo, setUserInfo] = useState(null);
  const [tenantInfo, setTenantInfo] = useState(null);

  useEffect(() => {
    loadInfo();
  }, []);

  const loadInfo = async () => {
    try {
      const user = await appClient.auth.me();
      setUserInfo(user);

      const tenants = await appClient.entities.Tenant.list();
      const myTenant = tenants.find(t => normalizeEmail(t.owner_email) === normalizeEmail(user.email));
      setTenantInfo(myTenant);

      if (!user.tenant_id && myTenant) {
        setStatus("needsFix");
        setMessage("Votre accès tenant doit être réparé.");
      } else if (user.tenant_id && myTenant) {
        setStatus("ok");
        setMessage("Tout est configuré correctement.");
      } else {
        setStatus("noTenant");
        setMessage("Aucun commerce trouvé.");
      }
    } catch (error) {
      setStatus("error");
      setMessage(`Erreur: ${error.message}`);
    }
  };

  const handleFix = async () => {
    setStatus("fixing");
    setMessage("Correction en cours...");

    try {
      await appClient.auth.updateMe({ tenant_id: tenantInfo.id });
      setStatus("success");
      setMessage("✅ Corrigé ! Redirection...");
      setTimeout(() => window.location.href = "/", 1500);
    } catch (error) {
      setStatus("error");
      setMessage(`❌ Erreur: ${error.message}`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-2xl p-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">🔧 Réparation Tenant</h1>
        
        {/* User Info */}
        {userInfo && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-800">Utilisateur</h2>
            </div>
            <p className="text-sm text-gray-700">Email: {userInfo.email}</p>
            <p className="text-sm text-gray-700">
              Tenant ID: {userInfo.tenant_id || <span className="text-red-600 font-bold">❌ NON DÉFINI</span>}
            </p>
          </div>
        )}

        {/* Tenant Info */}
        {tenantInfo && (
          <div className="mb-6 p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Store className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-gray-800">Votre Commerce</h2>
            </div>
            <p className="text-sm text-gray-700">Nom: {tenantInfo.nom_commercial}</p>
            <p className="text-sm text-gray-700">ID: {tenantInfo.id}</p>
          </div>
        )}

        {/* Status Messages */}
        <div className="mb-6">
          {status === "loading" && (
            <div className="flex items-center gap-3 text-blue-600">
              <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <p>{message}</p>
            </div>
          )}

          {status === "needsFix" && (
            <div className="flex items-center gap-3 text-orange-600">
              <AlertCircle className="w-5 h-5" />
              <p className="font-semibold">{message}</p>
            </div>
          )}

          {status === "ok" && (
            <div className="flex items-center gap-3 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <p className="font-semibold">{message}</p>
            </div>
          )}

          {status === "fixing" && (
            <div className="flex items-center gap-3 text-blue-600">
              <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <p>{message}</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex items-center gap-3 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <p className="font-semibold">{message}</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <p>{message}</p>
            </div>
          )}

          {status === "noTenant" && (
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <p className="font-semibold">{message}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {status === "needsFix" && (
            <Button onClick={handleFix} className="w-full bg-orange-500 hover:bg-orange-600">
              🔧 Corriger mon accès
            </Button>
          )}

          {status === "ok" && (
            <Button onClick={() => window.location.href = "/"} className="w-full bg-green-500 hover:bg-green-600">
              ✅ Retour à l'accueil
            </Button>
          )}

          {(status === "error" || status === "noTenant") && (
            <>
              <Button onClick={loadInfo} variant="outline" className="w-full">
                🔄 Réessayer
              </Button>
              <Button onClick={() => window.location.href = "/pages/TenantSetup"} className="w-full">
                ➕ Créer un commerce
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
