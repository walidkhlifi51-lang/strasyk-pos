import { createClient } from '@supabase/supabase-js';

const [, , emailArg, passwordArg] = process.argv;

const email = (emailArg || '').trim().toLowerCase();
const password = passwordArg || '';
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const exitWithError = (message) => {
  console.error(message);
  process.exit(1);
};

if (!email) {
  exitWithError('Usage: npm run set-auth-password -- <email> <new-password>');
}

if (!password || password.length < 6) {
  exitWithError('Le nouveau mot de passe doit contenir au moins 6 caracteres.');
}

if (!supabaseUrl) {
  exitWithError('SUPABASE_URL ou VITE_SUPABASE_URL manquant dans les variables d environnement.');
}

if (!serviceRoleKey) {
  exitWithError('SUPABASE_SERVICE_ROLE_KEY manquant. Utilisez la service role key du projet Supabase.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const findUserByEmail = async (targetEmail) => {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    const matchedUser = users.find((user) => (user.email || '').toLowerCase() === targetEmail);
    if (matchedUser) return matchedUser;

    if (users.length < perPage) return null;
    page += 1;
  }
};

try {
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
    });

    if (error) throw error;

    console.log(`Mot de passe mis a jour pour ${data.user.email}`);
    process.exit(0);
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw error;

  console.log(`Utilisateur cree et mot de passe defini pour ${data.user.email}`);
  process.exit(0);
} catch (error) {
  exitWithError(error?.message || 'Impossible de definir le mot de passe utilisateur.');
}
