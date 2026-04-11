import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function generatePIN(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

export async function POST(req: NextRequest) {
  try {
    const {
      email, full_name, role, hotel_id,
      phone_number, assigned_floors, shift_type, working_hours,
    } = await req.json();

    if (!email || !full_name || !role || !hotel_id) {
      return NextResponse.json({ error: "Champs obligatoires manquants." }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Clé service manquante. Ajoutez SUPABASE_SERVICE_ROLE_KEY dans .env.local." },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const pin      = generatePIN();
    const tempPwd  = generateTempPassword();

    // Create user directly — no email invite, no rate limit
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password: tempPwd,
      email_confirm: true,          // mark email as confirmed immediately
      user_metadata: { full_name },
    });

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 400 });
    }

    // Update the auto-created profile with all fields
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name,
        email,
        role,
        hotel_id,
        phone_number:    phone_number    || null,
        assigned_floors: assigned_floors || "",
        shift_type:      shift_type      || null,
        working_hours:   working_hours   || null,
        pin_code:        pin,
        is_active:       true,
      })
      .eq("id", userData.user.id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, pin, temp_password: tempPwd, user_id: userData.user.id });
  } catch {
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}

// PATCH: update existing staff member fields
export async function PATCH(req: NextRequest) {
  try {
    const { id, ...fields } = await req.json();
    if (!id) return NextResponse.json({ error: "ID manquant." }, { status: 400 });

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Clé service manquante." }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase.from("profiles").update(fields).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}
