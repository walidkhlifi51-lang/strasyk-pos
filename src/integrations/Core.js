const uploadedFiles = new Map();

export const UploadFile = async ({ file }) => {
  const fileUrl = `local-upload://${Date.now()}-${file?.name || 'file'}`;
  uploadedFiles.set(fileUrl, file);
  return { file_url: fileUrl };
};

const parseCsvLine = (line, separator) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

const parseCsv = (text) => {
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  if (!cleanText) return [];

  const lines = cleanText.split(/\r?\n/).filter(Boolean);
  const separator = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const headers = parseCsvLine(lines[0], separator).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, separator);
    return headers.reduce((record, header, index) => {
      record[header] = values[index] || '';
      return record;
    }, {});
  });
};

export const ExtractDataFromUploadedFile = async ({ file_url }) => {
  const file = uploadedFiles.get(file_url);
  if (!file) {
    return {
      status: 'error',
      details: 'Fichier local introuvable.',
    };
  }

  const text = await file.text();
  return {
    status: 'success',
    output: {
      clients: parseCsv(text),
    },
  };
};

