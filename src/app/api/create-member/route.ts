import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
  const { email, password, full_name, role, hotel_id } = await req.json();

  if (!email || !password || !full_name || !role || !hotel_id) {
    return NextResponse.json({ error: "Tous les champs sont requis." }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Clé service manquante. Ajoutez SUPABASE_SERVICE_ROLE_KEY dans .env.local et redémarrez le serveur." }, { status: 500 });
  }

  // Service role client — can create auth users
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Update the auto-created profile with name, role, hotel
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name, role, hotel_id })
    .eq("id", authData.user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
