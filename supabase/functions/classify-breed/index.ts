import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Initialize Hugging Face client
const hf = new HfInference(Deno.env.get('HUGGING_FACE_ACCESS_TOKEN'))

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { image_url, animal_id, user_id, animal_type } = await req.json()

    if (!image_url || !animal_id || !user_id || !animal_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: image_url, animal_id, user_id, animal_type' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log(`Processing breed classification for animal ${animal_id} of type ${animal_type}`)
    
    const startTime = Date.now()

    // For now, we'll use a general image classification model
    // In production, you would use a specialized cattle/buffalo breed model
    const result = await hf.imageClassification({
      data: await fetch(image_url).then(r => r.blob()),
      model: 'microsoft/resnet-50'
    })

    const processingTime = Date.now() - startTime

    // Mock breed predictions based on animal type (replace with actual model results)
    let predictions = []
    if (animal_type === 'cattle') {
      predictions = [
        { breed: 'gir', confidence: 0.85 },
        { breed: 'sahiwal', confidence: 0.12 },
        { breed: 'jersey_cross', confidence: 0.03 }
      ]
    } else if (animal_type === 'buffalo') {
      predictions = [
        { breed: 'murrah', confidence: 0.78 },
        { breed: 'nili_ravi', confidence: 0.15 },
        { breed: 'surti', confidence: 0.07 }
      ]
    }

    const topPrediction = predictions[0]

    // Create or update animal record
    const { data: animalRecord, error: recordError } = await supabase
      .from('animal_records')
      .upsert({
        user_id,
        animal_id,
        animal_type,
        predicted_breed: topPrediction.breed,
        confidence_score: topPrediction.confidence,
        image_url,
        verification_status: 'pending'
      }, {
        onConflict: 'animal_id,user_id'
      })
      .select()
      .single()

    if (recordError) {
      console.error('Error creating animal record:', recordError)
      return new Response(
        JSON.stringify({ error: 'Failed to create animal record', details: recordError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Log the prediction
    const { error: logError } = await supabase
      .from('breed_predictions')
      .insert({
        animal_record_id: animalRecord.id,
        image_url,
        predicted_breeds: predictions,
        model_version: 'resnet-50-v1.0',
        processing_time_ms: processingTime
      })

    if (logError) {
      console.error('Error logging prediction:', logError)
    }

    console.log(`Classification completed in ${processingTime}ms for animal ${animal_id}`)

    return new Response(
      JSON.stringify({
        success: true,
        animal_record_id: animalRecord.id,
        predictions,
        top_prediction: {
          breed: topPrediction.breed,
          confidence: topPrediction.confidence
        },
        processing_time_ms: processingTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in classify-breed function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})