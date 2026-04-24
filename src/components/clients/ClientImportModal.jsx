import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, Download, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { UploadFile, ExtractDataFromUploadedFile } from '@/integrations/Core';
import { Customer } from '@/entities/Customer';
import { useTenant } from '../contexts/TenantContext';

const REQUIRED_HEADERS = ['nom', 'prenom', 'telephone', 'email', 'adresse', 'code_postal', 'ville', 'etage', 'interphone', 'notes'];

export default function ClientImportModal({ isOpen, onClose, onImportSuccess }) {
  const { withTenant } = useTenant();
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setSuccessMessage('');
    }
  };

  const downloadTemplate = () => {
    const csvContent = REQUIRED_HEADERS.join(';');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modele_import_clients.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleImport = async () => {
    if (!file) {
      setError("Veuillez sélectionner un fichier CSV.");
      return;
    }
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // 1. Upload the file
      const { file_url } = await UploadFile({ file });
      if (!file_url) throw new Error("L'upload du fichier a échoué.");

      // 2. Extract data using the integration
      const customerSchema = Customer.schema();
      const extractionResult = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            clients: {
              type: "array",
              items: customerSchema,
            }
          }
        },
      });

      if (extractionResult.status !== 'success' || !extractionResult.output?.clients) {
        throw new Error(extractionResult.details || "L'extraction des données a échoué. Vérifiez le format de votre fichier.");
      }

      const clientsToCreate = extractionResult.output.clients.filter(c => c.nom && c.telephone);

      if (clientsToCreate.length === 0) {
        throw new Error("Aucun client valide trouvé dans le fichier. Assurez-vous que les colonnes 'nom' et 'telephone' sont remplies.");
      }

      // 3. Bulk create customers with tenant_id
      const clientsWithTenant = clientsToCreate.map(client => withTenant(client));
      await Customer.bulkCreate(clientsWithTenant);
      
      setSuccessMessage(`${clientsToCreate.length} clients ont été importés avec succès !`);
      setTimeout(onImportSuccess, 2000); // Wait 2s before closing

    } catch (e) {
      setError(e.message || "Une erreur inattendue est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    setFile(null);
    setError('');
    setSuccessMessage('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importer des clients depuis un fichier CSV</DialogTitle>
          <DialogDescription>
            Suivez les étapes ci-dessous pour importer votre liste de clients.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-800">Étape 1: Télécharger le modèle</h3>
            <p className="text-sm text-blue-700 mt-1">
              Utilisez notre modèle pour garantir que vos données sont correctement formatées.
            </p>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="mt-3 gap-2">
              <Download className="w-4 h-4" />
              Télécharger le modèle CSV
            </Button>
          </div>

          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-semibold text-green-800">Étape 2: Importer votre fichier</h3>
            <p className="text-sm text-green-700 mt-1">
              Sélectionnez votre fichier CSV complété ci-dessous.
            </p>
            <div className="mt-3">
              <Label htmlFor="csv-upload" className="sr-only">Importer un fichier CSV</Label>
              <Input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} />
              {file && (
                <div className="mt-3 flex items-center justify-center gap-2 p-3 bg-green-100 rounded-lg">
                    <FileText className="w-5 h-5 text-green-600"/>
                    <p className="font-medium text-green-700">{file.name}</p>
                </div>
              )}
            </div>
          </div>

          {error && (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
           {successMessage && (
             <Alert variant="default" className="bg-green-100 border-green-300 text-green-800">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>Annuler</Button>
          <Button onClick={handleImport} disabled={isLoading || !file || !!successMessage}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {isLoading ? 'Import en cours...' : 'Lancer l\'importation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
