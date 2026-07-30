const [, , commandName = 'unknown'] = process.argv;

console.error(`Commande desactivee : l'etape d'ecriture du provisioning n'est pas encore validee. (${commandName})`);
process.exit(1);
