import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { studentId } = await req.json();

    if (!studentId) {
      return new Response(JSON.stringify({ error: 'Student ID required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // First find the profile to get the auth.user.id
    const { data: profile, error: profileFetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('student_id', studentId)
      .single();

    if (profileFetchError) {
      // It's possible there is no profile if it was partially created
      console.log('Profile fetch error:', profileFetchError);
    }

    // Delete student record
    const { error: studentDeleteError } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId);

    if (studentDeleteError) {
      return new Response(JSON.stringify({ error: studentDeleteError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (profile) {
      // Delete from profiles
      await supabase.from('profiles').delete().eq('id', profile.id);

      // Delete from auth.users securely
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(profile.id);
      if (authDeleteError) {
        return new Response(JSON.stringify({ error: authDeleteError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
