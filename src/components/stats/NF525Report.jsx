
import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Download, Sheet, FileJson } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function NF525Report({ orders, profile, dateRange, customDateRange }) {
  const getNF525Data = useMemo(() => {
    // The orders prop is now expected to be already filtered and validated by the parent component.
    const filteredOrders = orders || [];

    const totalHT = filteredOrders.reduce((sum, order) => sum + (order.total_ht || 0), 0);
    const totalTVA = filteredOrders.reduce((sum, order) => sum + (order.total_tva || 0), 0);
    const totalTTC = filteredOrders.reduce((sum, order) => sum + (order.total_ttc || 0), 0);

    // Dynamic TVA rates based on profile
    const tvaRates = profile?.tva_rates?.map(r => r.rate) || [5.5, 10, 20]; // Default rates if not provided
    const tvaDetails = {};
    tvaRates.forEach(rate => {
        tvaDetails[rate] = { ht: 0, tva: 0, ttc: 0, label: profile?.tva_rates?.find(r => r.rate === rate)?.label || `Taux ${rate}%`};
    });
    // Add an 'Autres' category for rates not explicitly defined in the profile
    tvaDetails['Autres'] = { ht: 0, tva: 0, ttc: 0, label: "Autres Taux" };

    filteredOrders.forEach(order => {
      if (Array.isArray(order.articles)) {
        order.articles.forEach(article => {
          const articleTVA = article.tva || 0;
          // Determine if the article's TVA rate is one of the known rates, otherwise categorize as 'Autres'
          const tauxKey = tvaRates.includes(articleTVA) ? articleTVA : 'Autres';
          const totalLigne = article.total_ligne || 0;

          // Avoid division by zero if articleTVA is 0
          const ht = articleTVA !== 0 ? totalLigne / (1 + (articleTVA / 100)) : totalLigne;
          const tva = totalLigne - ht;
          
          tvaDetails[tauxKey].ht += ht;
          tvaDetails[tauxKey].tva += tva;
          tvaDetails[tauxKey].ttc += totalLigne;
        });
      }
    });

    // Clean up rates that have 0 total TTC (i.e., no transactions for that rate)
    Object.keys(tvaDetails).forEach(key => {
        if (tvaDetails[key].ttc === 0 && key !== 'Autres') { // Keep 'Autres' even if empty, might indicate unexpected rates
            delete tvaDetails[key];
        }
    });
    // If 'Autres' is empty, delete it too.
    if (tvaDetails['Autres'] && tvaDetails['Autres'].ttc === 0) {
        delete tvaDetails['Autres'];
    }

    return {
      nb_transactions: filteredOrders.length,
      totalHT,
      totalTVA,
      totalTTC,
      tvaDetails,
    };
  }, [orders, profile]);

  const nf525Data = getNF525Data;

  const getPeriodForExport = () => {
    if (customDateRange && customDateRange.start && customDateRange.end) {
      const start = format(customDateRange.start, 'dd/MM/yyyy', { locale: fr });
      const end = format(customDateRange.end, 'dd/MM/yyyy', { locale: fr });
      return `Du ${start} au ${end}`;
    }
    // Handle predefined dateRange strings
    switch (dateRange) {
      case 'today':
        return 'Journée en cours';
      case 'week':
        return '7 derniers jours';
      case 'month':
        return 'Mois en cours';
      default:
        return 'Période sélectionnée';
    }
  };

  const exportNF525ToJSON = () => {
    const displayPeriode = getPeriodForExport();

    const dynamicTvaDetailsForExport = {};
    Object.entries(nf525Data.tvaDetails).forEach(([rate, data]) => {
      dynamicTvaDetailsForExport[rate] = {
        base_ht: data.ht.toFixed(2),
        tva: data.tva.toFixed(2),
        total_ttc: data.ttc.toFixed(2),
        label: data.label
      };
    });

    const reportData = {
      date_edition: format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr }),
      periode: displayPeriode,
      nombre_transactions: nf525Data.nb_transactions,
      montant_total_ht: nf525Data.totalHT.toFixed(2),
      montant_total_tva: nf525Data.totalTVA.toFixed(2),
      montant_total_ttc: nf525Data.totalTTC.toFixed(2),
      detail_tva_rates: dynamicTvaDetailsForExport
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport-tva-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up the URL object
  };

  const exportNF525ToCSV = () => {
    const displayPeriode = getPeriodForExport();
    let csvContent = `Rapport de TVA\n`;
    csvContent += `Période;"${displayPeriode}"\n`;
    csvContent += `Date d'édition;"${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}"\n\n`;

    csvContent += "Résumé\n";
    csvContent += `"Nombre de transactions";"${nf525Data.nb_transactions}"\n`;
    csvContent += `"Total HT";"${nf525Data.totalHT.toFixed(2).replace('.', ',')}€"\n`; // Use comma for decimal in CSV
    csvContent += `"Total TVA";"${nf525Data.totalTVA.toFixed(2).replace('.', ',')}€"\n`;
    csvContent += `"Total TTC";"${nf525Data.totalTTC.toFixed(2).replace('.', ',')}€"\n\n`;

    csvContent += "Détail par taux de TVA\n";
    csvContent += "Taux;Libellé;Base HT;Montant TVA;Total TTC\n";
    Object.entries(nf525Data.tvaDetails).forEach(([rate, data]) => {
      csvContent += `"${rate}%";"${data.label}";"${data.ht.toFixed(2).replace('.', ',')}€";"${data.tva.toFixed(2).replace('.', ',')}€";"${data.ttc.toFixed(2).replace('.', ',')}€"\n`;
    });

    const BOM = '\uFEFF'; // Byte Order Mark for UTF-8 in Excel
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport-tva-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const exportNF525ToPDF = () => {
    const displayPeriode = getPeriodForExport();
    const tvaRows = Object.entries(nf525Data.tvaDetails).map(([rate, data]) => `
      <tr>
        <td>${rate}%</td>
        <td>${data.label}</td>
        <td class="text-right">${data.ht.toFixed(2)}€</td>
        <td class="text-right">${data.tva.toFixed(2)}€</td>
        <td class="text-right">${data.ttc.toFixed(2)}€</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Rapport de TVA - ${displayPeriode}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; font-size: 10px; color: #333; }
          .header { text-align: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
          .header h1 { font-size: 18px; margin: 0; }
          .header p { margin: 2px 0 0; color: #666; font-size: 11px;}
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          thead { background-color: #f5f5f5; }
          th { font-weight: bold; }
          .summary { background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .summary-item p { margin: 0; }
          .summary-item .label { color: #555; }
          .summary-item .value { font-weight: bold; font-size: 14px; }
          .text-right { text-align: right; }
        </style>
      </head>
      <body onload="window.print();">
        <div class="header">
          <h1>Rapport de TVA</h1>
          <p>Période: ${displayPeriode}</p>
          <p>Édité le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}</p>
        </div>
        <div class="summary">
          <div class="summary-item"><p class="label">Transactions</p><p class="value">${nf525Data.nb_transactions}</p></div>
          <div class="summary-item"><p class="label">Total TTC</p><p class="value">${nf525Data.totalTTC.toFixed(2)}€</p></div>
          <div class="summary-item"><p class="label">Total HT</p><p class="value">${nf525Data.totalHT.toFixed(2)}€</p></div>
          <div class="summary-item"><p class="label">Total TVA</p><p class="value">${nf525Data.totalTVA.toFixed(2)}€</p></div>
        </div>
        <h3>Détail par taux de TVA</h3>
        <table>
          <thead>
            <tr><th>Taux</th><th>Libellé</th><th class="text-right">Base HT</th><th class="text-right">Montant TVA</th><th class="text-right">Total TTC</th></tr>
          </thead>
          <tbody>${tvaRows}</tbody>
        </table>
      </body>
      </html>
    `;
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
      // For some browsers, onload might not fire immediately in new tab, so manual print call could be considered after a delay
      // For cross-browser compatibility for automatic print, it's often better for the user to trigger print manually from the new window
      // newWindow.print(); // Uncomment this if auto-printing is desired, but might be blocked by pop-up blockers or browser settings
    }
  };


  return (
    <Card className="shadow-lg border-0 bg-gradient-to-br from-indigo-50 to-blue-50">
      <CardHeader className="border-b border-blue-200">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Rapport de TVA
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Transactions:</p>
            <p className="font-bold text-lg">{nf525Data.nb_transactions}</p>
          </div>
          <div>
            <p className="text-gray-600">Total TTC:</p>
            <p className="font-bold text-lg text-green-600">
              {nf525Data.totalTTC.toFixed(2)}€
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-gray-800">Détail par taux de TVA :</h4>
          
          {Object.entries(nf525Data.tvaDetails).map(([rate, data]) => (
            <div key={rate} className="bg-white p-3 rounded border">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Taux {rate}%</span>
                <Badge variant="outline">{data.label}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-gray-500">Base HT</p>
                  <p className="font-semibold">{data.ht.toFixed(2)}€</p>
                </div>
                <div>
                  <p className="text-gray-500">TVA</p>
                  <p className="font-semibold">{data.tva.toFixed(2)}€</p>
                </div>
                <div>
                  <p className="text-gray-500">TTC</p>
                  <p className="font-semibold">{data.ttc.toFixed(2)}€</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
              <Download className="w-4 h-4" />
              Exporter le Rapport de TVA
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportNF525ToPDF}>
              <FileText className="mr-2 h-4 w-4" />
              <span>PDF</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportNF525ToCSV}>
              <Sheet className="mr-2 h-4 w-4" />
              <span>CSV</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportNF525ToJSON}>
              <FileJson className="mr-2 h-4 w-4" />
              <span>JSON</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </CardContent>
    </Card>
  );
}

