import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// ========================================================
// SECRETS SUPABASE NÉCESSAIRES :
// - STRIPE_SECRET_KEY (sk_live_...)
// - STRIPE_WEBHOOK_SECRET (whsec_...)
// - SUPABASE_URL (auto-injecté)
// - SUPABASE_SERVICE_ROLE_KEY (auto-injecté)
// ========================================================

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } }
)

// Mapping montant (centimes) → pack
const AMOUNT_TO_PACK: Record<number, { packId: string; credits: number }> = {
  900:   { packId: 'decouverte', credits: 100 },   // 9,00 €
  3900:  { packId: 'pro', credits: 500 },           // 39,00 €
  12900: { packId: 'collectivite', credits: 2000 }, // 129,00 €
}

serve(async (req) => {
  try {
    const body = await req.text()
    const sig = req.headers.get('stripe-signature')

    if (!sig) {
      return new Response('Missing stripe-signature header', { status: 400 })
    }

    // Vérifier la signature du webhook Stripe
    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }

    console.log(`Received Stripe event: ${event.type}`)

    // Traiter l'événement checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      // Payment Links utilisent client_reference_id pour l'ID utilisateur
      const userId = session.client_reference_id || session.metadata?.user_id
      const amountTotal = session.amount_total ?? 0

      if (!userId) {
        console.error('No user ID found in session:', session.id)
        return new Response('No user ID', { status: 400 })
      }

      // Déterminer le pack à partir du montant
      const packInfo = AMOUNT_TO_PACK[amountTotal]
      if (!packInfo) {
        console.error(`Unknown amount: ${amountTotal} cents for session ${session.id}`)
        return new Response('Unknown amount', { status: 400 })
      }

      console.log(`Processing payment for user ${userId}: +${packInfo.credits} credits (${packInfo.packId}, ${amountTotal/100}€)`)

      // 1. Vérifier que cette transaction n'a pas déjà été traitée (idempotence)
      const { data: existingTx } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('stripe_session_id', session.id)
        .single()

      if (existingTx) {
        console.log(`Transaction already processed for session ${session.id}`)
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // 2. Récupérer les crédits actuels
      const { data: profile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single()

      if (fetchError) {
        console.error('Error fetching profile:', fetchError)
        // Créer le profil s'il n'existe pas
        if (fetchError.code === 'PGRST116') {
          await supabaseAdmin.from('profiles').insert({ id: userId, credits: 0 })
        } else {
          return new Response('Error fetching profile', { status: 500 })
        }
      }

      const currentCredits = profile?.credits ?? 0
      const newCredits = currentCredits + packInfo.credits

      // 3. Mettre à jour les crédits
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          credits: newCredits,
        })

      if (updateError) {
        console.error('Error updating credits:', updateError)
        return new Response('Error updating credits', { status: 500 })
      }

      // 4. Enregistrer la transaction
      const { error: txError } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: userId,
          pack_id: packInfo.packId,
          credits: packInfo.credits,
          amount_cents: amountTotal,
          stripe_session_id: session.id,
          stripe_payment_intent: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
          status: 'completed',
        })

      if (txError) {
        console.error('Error recording transaction:', txError)
        // Ne pas échouer — les crédits sont déjà ajoutés
      }

      console.log(`✅ User ${userId}: ${currentCredits} → ${newCredits} credits (+${packInfo.credits})`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return new Response(`Webhook Error: ${error.message}`, { status: 500 })
  }
})
