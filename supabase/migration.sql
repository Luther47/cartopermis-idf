-- =====================================================
-- Migration Supabase — Table transactions
-- Exécuter dans l'éditeur SQL de Supabase Dashboard
-- =====================================================

-- Table des transactions de paiement
CREATE TABLE IF NOT EXISTS transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pack_id text NOT NULL,
  credits integer NOT NULL,
  amount_cents integer NOT NULL,
  stripe_session_id text UNIQUE,
  stripe_payment_intent text,
  status text DEFAULT 'completed' CHECK (status IN ('completed', 'refunded', 'failed')),
  created_at timestamptz DEFAULT now()
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_session ON transactions(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- Sécurité RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs ne peuvent voir que leurs propres transactions
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Seul le service_role (Edge Functions) peut insérer
CREATE POLICY "Service role can insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (true);

-- Vérifier que la table profiles existe déjà (normalement oui)
-- Si elle n'existe pas, la créer :
-- CREATE TABLE IF NOT EXISTS profiles (
--   id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
--   credits integer DEFAULT 5,
--   created_at timestamptz DEFAULT now()
-- );
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
-- CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
