export class ProvisioningError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ProvisioningError';
    this.code = options.code || 'PROVISIONING_ERROR';
    this.details = options.details || null;
    this.exitCode = options.exitCode || 1;
    this.cause = options.cause;
  }
}

export const toProvisioningError = (error, fallbackMessage = 'Provisioning failure.') => {
  if (error instanceof ProvisioningError) {
    return error;
  }

  return new ProvisioningError(error?.message || fallbackMessage, {
    cause: error,
  });
};

const pickScalar = (value, fallback = null) => (value === undefined ? fallback : value);

const extractDiagnosticFields = (error) => {
  const nestedDetails = error?.details && typeof error.details === 'object' && !Array.isArray(error.details)
    ? error.details
    : {};
  return {
    operation: pickScalar(nestedDetails.operation, null),
    table: pickScalar(nestedDetails.table, nestedDetails.tableName ?? null),
    message: pickScalar(nestedDetails.message, error?.message ?? null),
    code: pickScalar(nestedDetails.code, error?.code ?? null),
    details: pickScalar(nestedDetails.details, typeof error?.details === 'string' ? error.details : null),
    hint: pickScalar(nestedDetails.hint, error?.hint ?? null),
    status: pickScalar(nestedDetails.status, error?.status ?? null),
    statusText: pickScalar(nestedDetails.statusText, error?.statusText ?? null),
    payloadColumns: pickScalar(nestedDetails.payloadColumns, nestedDetails.payloadShape?.columnNames ?? null),
    payloadTypes: pickScalar(nestedDetails.payloadTypes, nestedDetails.payloadShape?.valueTypes ?? null),
    nullFields: pickScalar(nestedDetails.nullFields, nestedDetails.payloadShape?.nullFields ?? null),
    absentExpectedFields: pickScalar(nestedDetails.absentExpectedFields, nestedDetails.payloadShape?.absentOptionalFields ?? null),
    compensation: pickScalar(nestedDetails.compensation, null),
    baselineRestored: pickScalar(nestedDetails.baselineRestored, nestedDetails.compensation?.baselineRestored ?? null),
    journal: pickScalar(nestedDetails.journal, nestedDetails.executionJournal ?? null),
    createdRecords: pickScalar(nestedDetails.createdRecords, null),
    deletedRecords: pickScalar(nestedDetails.deletedRecords, nestedDetails.compensation?.compensations ?? null),
    blockedCompensations: pickScalar(nestedDetails.blockedCompensations, nestedDetails.compensation?.blockedCompensations ?? null),
  };
};

const firstNonNull = (...values) => values.find((value) => value !== null && value !== undefined) ?? null;

export const serializeProvisioningError = (error) => {
  if (!error) return null;

  const currentFields = extractDiagnosticFields(error);
  const serializedCause = error.cause ? serializeProvisioningError(error.cause) : null;

  return {
    name: error.name || 'Error',
    message: error.message || currentFields.message || 'Provisioning failure.',
    code: error.code || currentFields.code || 'PROVISIONING_ERROR',
    operation: firstNonNull(currentFields.operation, serializedCause?.operation),
    table: firstNonNull(currentFields.table, serializedCause?.table),
    details: firstNonNull(currentFields.details, serializedCause?.details),
    hint: firstNonNull(currentFields.hint, serializedCause?.hint),
    status: firstNonNull(currentFields.status, serializedCause?.status),
    statusText: firstNonNull(currentFields.statusText, serializedCause?.statusText),
    supabaseMessage: firstNonNull(serializedCause?.supabaseMessage, serializedCause?.message, currentFields.message),
    supabaseCode: firstNonNull(serializedCause?.supabaseCode, serializedCause?.code, currentFields.code),
    payloadColumns: firstNonNull(currentFields.payloadColumns, serializedCause?.payloadColumns),
    payloadTypes: firstNonNull(currentFields.payloadTypes, serializedCause?.payloadTypes),
    nullFields: firstNonNull(currentFields.nullFields, serializedCause?.nullFields),
    absentExpectedFields: firstNonNull(currentFields.absentExpectedFields, serializedCause?.absentExpectedFields),
    compensation: firstNonNull(currentFields.compensation, serializedCause?.compensation),
    baselineRestored: firstNonNull(currentFields.baselineRestored, serializedCause?.baselineRestored),
    journal: firstNonNull(currentFields.journal, serializedCause?.journal),
    createdRecords: firstNonNull(currentFields.createdRecords, serializedCause?.createdRecords),
    deletedRecords: firstNonNull(currentFields.deletedRecords, serializedCause?.deletedRecords),
    blockedCompensations: firstNonNull(currentFields.blockedCompensations, serializedCause?.blockedCompensations),
    cause: serializedCause,
  };
};
