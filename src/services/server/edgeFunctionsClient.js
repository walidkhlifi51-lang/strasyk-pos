export const edgeFunctionsClient = {
  async invoke(functionName, payload = {}) {
    throw new Error(`Edge Function non implementee pour ${functionName}. Payload prepare: ${JSON.stringify(payload)}`);
  },
};
