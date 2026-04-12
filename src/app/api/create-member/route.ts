import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// ── helpers ───────────────────────────────────────────────────────────────────
function generatePIN(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

function buildWelcomeEmail({
  full_name,
  email,
  temp_password,
  pin,
  hotel_name,
  app_url,
}: {
  full_name: string;
  email: string;
  temp_password: string;
  pin: string;
  hotel_name: string;
  app_url: string;
}) {
  const first = full_name.split(" ")[0];
  const loginUrl = `${app_url}/bienvenue?email=${encodeURIComponent(email)}`;
  const pinDigits = pin.split("").map(d =>
    `<span style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:56px;background:#fff;border:2px solid #FA7866;border-radius:10px;font-size:28px;font-weight:900;color:#FA7866;margin:0 3px;font-family:monospace">${d}</span>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#FA7866 0%,#f95e48 100%);padding:36px 40px;text-align:center">
            <p style="margin:0 0 4px 0;font-size:28px;font-weight:900;color:#fff;letter-spacing:-0.5px">🏨 HotelHive</p>
            <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.8)">${hotel_name}</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:36px 40px 0">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1a1a1a">Bienvenue, ${first} ! 👋</p>
            <p style="margin:0;font-size:15px;color:#555;line-height:1.6">
              Votre responsable vient de créer votre compte sur <strong>HotelHive</strong>, l'application de gestion de l'équipe <strong>${hotel_name}</strong>.
            </p>
          </td>
        </tr>

        <!-- Credentials box -->
        <tr>
          <td style="padding:28px 40px 0">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1.5px solid #eee;border-radius:14px;overflow:hidden">
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid #eee">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999">Vos identifiants de connexion</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#888;width:140px">Email</td>
                      <td style="padding:6px 0;font-size:13px;font-weight:700;color:#1a1a1a;font-family:monospace">${email}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#888">Mot de passe temp.</td>
                      <td style="padding:6px 0;font-size:15px;font-weight:800;color:#FA7866;font-family:monospace;letter-spacing:1px">${temp_password}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px">
                  <p style="margin:0 0 4px;font-size:11px;color:#999">⚠️ Modifiez votre mot de passe après la première connexion.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- PIN -->
        <tr>
          <td style="padding:28px 40px 0;text-align:center">
            <p style="margin:0 0 16px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999">Votre code PIN kiosk</p>
            <div>${pinDigits}</div>
            <p style="margin:12px 0 0;font-size:12px;color:#aaa">Utilisez ce code pour accéder à l'interface kiosk</p>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:32px 40px;text-align:center">
            <a href="${loginUrl}"
               style="display:inline-block;background:#FA7866;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;letter-spacing:0.2px">
              Accéder à l'application →
            </a>
            <p style="margin:16px 0 0;font-size:12px;color:#aaa">Ou copiez ce lien : <span style="color:#FA7866">${loginUrl}</span></p>
          </td>
        </tr>

        <!-- Steps -->
        <tr>
          <td style="padding:0 40px 32px">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f7;border:1.5px solid #fde8e5;border-radius:14px">
              <tr><td style="padding:20px 24px">
                <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#FA7866">Comment commencer ?</p>
                <table cellpadding="0" cellspacing="0">
                  ${["Cliquez sur le bouton ci-dessus", "Connectez-vous avec votre email et mot de passe temporaire", "Changez votre mot de passe dans votre profil", "Utilisez votre PIN pour l'accès kiosk"].map((step, i) => `
                  <tr>
                    <td style="padding:5px 12px 5px 0;vertical-align:top">
                      <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#FA7866;color:#fff;border-radius:50%;font-size:11px;font-weight:700">${i + 1}</span>
                    </td>
                    <td style="padding:5px 0;font-size:13px;color:#555">${step}</td>
                  </tr>`).join("")}
                </table>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f0f0f0;text-align:center">
            <p style="margin:0;font-size:12px;color:#bbb">Cet email a été envoyé par votre responsable via HotelHive.<br>Si vous n'attendiez pas ce message, ignorez-le.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── POST: create staff member ─────────────────────────────────────────────────
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
        { error: "Clé service manquante (SUPABASE_SERVICE_ROLE_KEY)." },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const pin     = generatePIN();
    const tempPwd = generateTempPassword();

    // 1. Fetch hotel name for the email
    const { data: hotelRow } = await supabase
      .from("hotels")
      .select("name")
      .eq("id", hotel_id)
      .single();
    const hotel_name = (hotelRow as { name?: string } | null)?.name ?? "Votre hôtel";

    // 2. Create the user (no email sent by Supabase)
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password: tempPwd,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 400 });
    }

    // 3. Update auto-created profile
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

    // 4. Send branded welcome email via Resend
    const app_url = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    let email_sent = false;
    let email_error = "";

    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
          },
        });

        await transporter.sendMail({
          from: `"HotelHive 🏨" <${process.env.GMAIL_USER}>`,
          to: email,
          subject: `Bienvenue dans l'équipe ${hotel_name} — HotelHive`,
          html: buildWelcomeEmail({ full_name, email, temp_password: tempPwd, pin, hotel_name, app_url }),
        });

        email_sent = true;
        console.log("✅ Email sent via Gmail to:", email);
      } catch (mailErr) {
        email_error = String(mailErr);
        console.error("❌ Gmail error:", mailErr);
      }
    } else {
      email_error = "GMAIL_USER or GMAIL_APP_PASSWORD not set";
      console.warn("⚠️  Gmail credentials missing in .env.local");
    }

    return NextResponse.json({
      success: true,
      pin,
      temp_password: tempPwd,
      user_id: userData.user.id,
      email_sent,
      email_error: email_error || undefined,
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}

// ── PATCH: update existing staff member ───────────────────────────────────────
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
