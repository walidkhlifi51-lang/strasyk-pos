import React from "react";
import { appClient } from "@/api/appClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Mail, LogOut } from "lucide-react";

export default function NoAccess() {
  const handleLogout = async () => {
    await appClient.auth.logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Accès en attente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">
                  Invitation en attente
                </h3>
                <p className="text-sm text-blue-800">
                  Votre compte a été créé mais aucun commerce ne vous a été assigné.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-2">Pour accéder à l'application :</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-700">
                <li>Contactez le propriétaire du commerce</li>
                <li>Demandez-lui de vous inviter depuis les paramètres</li>
                <li>Reconnectez-vous après l'invitation</li>
              </ol>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                💡 <strong>Astuce :</strong> Le propriétaire doit vous assigner à son commerce via l'interface d'administration.
              </p>
            </div>
          </div>

          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
