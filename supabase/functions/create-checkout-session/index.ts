import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ========================================================
// ⚠️ REMPLACER PAR VOTRE CLÉ SECRÈTE STRIPE
// Ajouter dans Supabase : Settings > Edge Functions > Secrets
// Nom : STRIPE_SECRET_KEY   Valeur : sk_live_...
// ========================================================
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

// ========================================================
// ⚠️ CRÉER CES PRODUITS DANS LE DASHBOARD STRIPE
// Puis remplacer les price_... par les vrais Price IDs
// Dashboard Stripe > Produits > Créer un produit
// ========================================================
const PACK_PRICES: Record<string, { priceId: string; credits: number; name: string }> = {
  decouverte: {
    priceId: 'REMPLACER_PAR_PRICE_ID_DECOUVERTE', // price_... (9€ — 100 crédits)
    credits: 100,
    name: 'Pack Découverte',
  },
  pro: {
    priceId: 'REMPLACER_PAR_PRICE_ID_PRO', // price_... (39€ — 500 crédits)
    credits: 500,
    name: 'Pack Pro',
  },
  collectivite: {
    priceId: 'REMPLACER_PAR_PRICE_ID_COLLECTIVITE', // price_... (129€ — 2000 crédits)
    credits: 2000,
    name: 'Pack Collectivité',
  },
}

// ========================================================
// ⚠️ REMPLACER PAR VOTRE DOMAINE DÉPLOYÉ
// ========================================================
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://cartopermis-idf.vercel.app'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { packId, userId, userEmail } = await req.json()

    // Validation
    if (!packId || !PACK_PRICES[packId]) {
      return new Response(
        JSON.stringify({ error: 'Pack invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Utilisateur non connecté' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const pack = PACK_PRICES[packId]

    // Créer la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price: pack.priceId,
          quantity: 1,
        },
      ],
      metadata: {
        user_id: userId,
        pack_id: packId,
        credits: String(pack.credits),
      },
      customer_email: userEmail || undefined,
      success_url: `${SITE_URL}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}?payment=cancelled`,
      locale: 'fr',
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur interne' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
