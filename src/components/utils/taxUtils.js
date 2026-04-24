const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;

export function computeTaxSummaryFromArticles(articles = [], totalTtcOverride = null) {
  const normalizedArticles = Array.isArray(articles) ? articles : [];

  let totalTtcFromArticles = 0;
  let totalTva = 0;
  const breakdown = {};

  normalizedArticles.forEach((article) => {
    const lineTotal = Number(
      article?.total_ligne ?? ((Number(article?.prix_unitaire) || 0) * (Number(article?.quantite) || 0))
    ) || 0;
    const rate = Number(article?.tva) || 0;

    totalTtcFromArticles += lineTotal;

    const lineHt = rate > 0 ? lineTotal / (1 + rate / 100) : lineTotal;
    const lineTva = lineTotal - lineHt;

    totalTva += lineTva;

    if (!breakdown[rate]) {
      breakdown[rate] = { rate, ttc: 0, ht: 0, tva: 0 };
    }

    breakdown[rate].ttc += lineTotal;
    breakdown[rate].ht += lineHt;
    breakdown[rate].tva += lineTva;
  });

  const totalTtc = totalTtcOverride == null ? totalTtcFromArticles : Number(totalTtcOverride) || 0;
  const roundedTotalTva = roundCurrency(totalTva);

  return {
    totalTtc: roundCurrency(totalTtc),
    totalHt: roundCurrency(totalTtc - roundedTotalTva),
    totalTva: roundedTotalTva,
    breakdown: Object.fromEntries(
      Object.entries(breakdown).map(([rate, values]) => [
        rate,
        {
          rate: Number(rate),
          ttc: roundCurrency(values.ttc),
          ht: roundCurrency(values.ht),
          tva: roundCurrency(values.tva),
        },
      ])
    ),
  };
}

