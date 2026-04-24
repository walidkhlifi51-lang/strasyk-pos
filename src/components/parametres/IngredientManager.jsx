import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Salad, Search, Loader2, Download, Upload } from "lucide-react";
import { appClient } from "@/api/appClient";
import { useToast } from "@/components/ui/use-toast";
import { useTenant } from "../contexts/TenantContext";

const unitTypes = ["kg", "g", "L", "ml", "piece"];

const normalizeUnit = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (!normalized) return "";
  if (["kg", "kilo", "kilos"].includes(normalized)) return "kg";
  if (["g", "gr", "gramme", "grammes"].includes(normalized)) return "g";
  if (["l", "litre", "litres"].includes(normalized)) return "L";
  if (["ml", "millilitre", "millilitres"].includes(normalized)) return "ml";
  if (["piece", "pieces", "piÃ¨ce", "piÃ¨ces", "pièce", "pièces", "pc", "pcs", "u", "unite", "unites"].includes(normalized)) {
    return "piece";
  }

  return "";
};

const formatUnit = (value) => normalizeUnit(value) || value || "";

const parseDecimal = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const detectSeparator = (line = "") => {
  const semicolons = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  return semicolons > commas ? ";" : ",";
};

const parseCsvLine = (line, separator) => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === separator && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, "").trim());
};

const IngredientForm = ({ ingredient, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    nom: ingredient?.nom || "",
    unite: normalizeUnit(ingredient?.unite) || "g",
    cout_unitaire: ingredient?.cout_unitaire !== null && ingredient?.cout_unitaire !== undefined ? ingredient.cout_unitaire : "",
    quantite_stock: ingredient?.quantite_stock !== null && ingredient?.quantite_stock !== undefined ? ingredient.quantite_stock : ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const dataToSave = {
      ...formData,
      unite: normalizeUnit(formData.unite) || "g",
      cout_unitaire: formData.cout_unitaire !== "" ? parseDecimal(formData.cout_unitaire) : null,
      quantite_stock: formData.quantite_stock !== "" ? (parseDecimal(formData.quantite_stock) ?? 0) : 0,
    };
    await onSave(dataToSave);
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="nom">Nom</Label>
        <Input id="nom" value={formData.nom} onChange={e => setFormData({ ...formData, nom: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="unite">Unite</Label>
          <Select value={formData.unite} onValueChange={value => setFormData({ ...formData, unite: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unitTypes.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantite_stock">Quantite en stock</Label>
          <Input
            id="quantite_stock"
            type="number"
            step="0.01"
            value={formData.quantite_stock}
            onChange={e => setFormData({ ...formData, quantite_stock: e.target.value })}
            placeholder="0"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cout_unitaire">Cout unitaire (EUR)</Label>
        <div className="relative">
          <Input
            id="cout_unitaire"
            type="number"
            step="0.01"
            value={formData.cout_unitaire}
            onChange={(e) => setFormData({ ...formData, cout_unitaire: e.target.value })}
            placeholder="Cout par kg, L, piece..."
            className="pr-8"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">EUR</span>
        </div>
      </div>
      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default function IngredientManager({ data, onDataChange }) {
  const { ingredients = [] } = data || {};
  const { toast } = useToast();
  const { withTenant } = useTenant();

  const [showDialog, setShowDialog] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef(null);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) =>
      ing.nom.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [ingredients, searchTerm]);

  const handleSave = async (formData) => {
    try {
      const dataWithTenant = withTenant(formData);

      if (editingIngredient) {
        await appClient.entities.Ingredient.update(editingIngredient.id, dataWithTenant);
      } else {
        await appClient.entities.Ingredient.create(dataWithTenant);
      }
      await onDataChange();
      setShowDialog(false);
      setEditingIngredient(null);
      toast({ title: "Ingredient enregistre." });
    } catch (error) {
      console.error("Erreur ingredient.save:", error);
      toast({
        title: "Erreur",
        description: error?.message || "Echec de l'enregistrement.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Supprimer cet ingredient ?")) {
      try {
        await appClient.entities.Ingredient.delete(id);
        await onDataChange();
        toast({ title: "Ingredient supprime." });
      } catch (error) {
        console.error("Erreur ingredient.delete:", error);
        toast({
          title: "Erreur",
          description: error?.message || "Echec de la suppression.",
          variant: "destructive"
        });
      }
    }
  };

  const handleExport = () => {
    if (ingredients.length === 0) {
      toast({ title: "Aucune donnee a exporter", variant: "destructive" });
      return;
    }

    const csvHeader = "Nom,Unite,Cout Unitaire (EUR),Quantite en Stock\n";
    const csvData = ingredients.map((ing) =>
      `"${ing.nom}","${formatUnit(ing.unite)}","${ing.cout_unitaire || ''}","${ing.quantite_stock || 0}"`
    ).join("\n");

    const csv = csvHeader + csvData;
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `ingredients_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Export reussi", description: `${ingredients.length} ingredients exportes` });
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.csv')) {
        toast({
          title: "Format non supporte",
          description: "Import ingredients: utilisez un fichier CSV. Les fichiers Excel ne sont pas encore pris en charge.",
          variant: "destructive"
        });
        return;
      }

      const text = await file.text();
      const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line);

      if (lines.length < 2) {
        toast({ title: "Erreur", description: "Fichier vide ou invalide", variant: "destructive" });
        return;
      }

      const separator = detectSeparator(lines[0]);
      const dataLines = lines.slice(1);
      const ingredientsToImport = [];
      let skippedRows = 0;

      for (const line of dataLines) {
        const values = parseCsvLine(line, separator);
        if (values.length < 2 || !values[0]) {
          skippedRows += 1;
          continue;
        }

        const [nom, rawUnit, cout_unitaire, quantite_stock] = values;
        const unite = normalizeUnit(rawUnit);

        if (!unite || !unitTypes.includes(unite)) {
          skippedRows += 1;
          continue;
        }

        const parsedCost = parseDecimal(cout_unitaire);
        const parsedStock = parseDecimal(quantite_stock);

        ingredientsToImport.push(withTenant({
          nom,
          unite,
          cout_unitaire: parsedCost,
          quantite_stock: parsedStock ?? 0
        }));
      }

      if (ingredientsToImport.length === 0) {
        toast({ title: "Erreur", description: "Aucun ingredient valide trouve", variant: "destructive" });
        return;
      }

      await appClient.entities.Ingredient.bulkCreate(ingredientsToImport);
      await onDataChange();

      toast({
        title: "Import reussi",
        description: skippedRows > 0
          ? `${ingredientsToImport.length} ingredients importes, ${skippedRows} lignes ignorees`
          : `${ingredientsToImport.length} ingredients importes`
      });
    } catch (error) {
      console.error("Erreur lors de l'import:", error);
      toast({
        title: "Erreur d'import",
        description: error?.message || "Verifiez le format du fichier CSV",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isLoading = !data;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Salad className="w-5 h-5 text-yellow-500" />
            Gestion des Ingredients
          </h3>
          <p className="text-sm text-gray-500 mt-1">{ingredients.length} ingredients en base</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto flex-wrap">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Rechercher un ingredient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              disabled={isImporting}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              {isImporting ? "Import..." : "Importer"}
            </Button>
            <Button
              onClick={handleExport}
              variant="outline"
              disabled={ingredients.length === 0}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Exporter
            </Button>
            <Button onClick={() => { setEditingIngredient(null); setShowDialog(true); }} className="bg-yellow-500 hover:bg-yellow-600 gap-2">
              <Plus className="w-4 h-4" />
              Nouvel Ingredient
            </Button>
          </div>
        </div>
      </div>

      {filteredIngredients.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Nom</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Cout Unitaire</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIngredients.map((ing) => (
                <TableRow key={ing.id}>
                  <TableCell className="font-medium">{ing.nom}</TableCell>
                  <TableCell>{ing.quantite_stock} {formatUnit(ing.unite)}</TableCell>
                  <TableCell>{ing.cout_unitaire ? `${ing.cout_unitaire.toFixed(2)} EUR / ${formatUnit(ing.unite)}` : 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingIngredient(ing); setShowDialog(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(ing.id)} className="text-red-500 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Salad className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun ingredient trouve.</p>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingIngredient ? "Modifier l'ingredient" : "Nouvel ingredient"}</DialogTitle>
          </DialogHeader>
          <IngredientForm
            ingredient={editingIngredient}
            onSave={handleSave}
            onCancel={() => setShowDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
