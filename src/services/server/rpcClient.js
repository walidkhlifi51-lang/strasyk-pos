export const rpcClient = {
  async invoke(contractName, payload = {}) {
    throw new Error(`RPC non implemente pour ${contractName}. Payload prepare: ${JSON.stringify(payload)}`);
  },
};
