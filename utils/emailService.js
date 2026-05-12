const nodemailer = require("nodemailer");

// ---------------------------------------------------------------------------
// Transporter setup — always attempt to create; log errors verbosely.
// ---------------------------------------------------------------------------
const emailUser = (process.env.EMAIL_USER || "").trim();
// Gmail App Passwords may be pasted with spaces — strip them.
const emailPass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "").trim();

const isEmailConfigured =
  emailUser &&
  emailPass &&
  emailUser !== "your_email@gmail.com" &&
  emailPass !== "your_gmail_app_password";

let transporter = null;

if (isEmailConfigured) {
  transporter = nodemailer.createTransport({
    host: (process.env.EMAIL_HOST || "smtp.gmail.com").trim(),
    port: parseInt((process.env.EMAIL_PORT || "587").trim(), 10),
    secure: false, // STARTTLS on port 587
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    tls: {
      rejectUnauthorized: false, // allow self-signed certs in dev
    },
  });

  // Verify SMTP connection on startup
  transporter.verify((err, success) => {
    if (err) {
      console.error("[EmailService] SMTP connection FAILED:", err.message);
      console.error("[EmailService] Details:", JSON.stringify({ host: process.env.EMAIL_HOST, port: process.env.EMAIL_PORT, user: emailUser }));
    } else {
      console.log("[EmailService] ✅ SMTP connection verified. Ready to send emails.");
    }
  });
} else {
  console.warn(
    "[EmailService] SMTP credentials not configured. Emails will be skipped. " +
    "Set EMAIL_USER, EMAIL_PASS, and ADMIN_EMAIL in your .env file."
  );
}

// ---------------------------------------------------------------------------
// Safe send — logs success, throws on failure.
// ---------------------------------------------------------------------------
const safeSend = async (mailOptions) => {
  if (!transporter) {
    const errorMsg = "SMTP transporter is not initialized. Check your .env configuration.";
    console.warn(`[EmailService] ${errorMsg}`);
    throw new Error(errorMsg);
  }
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("[EmailService] ✅ Email sent to", mailOptions.to, "| MessageId:", info.messageId);
    return info;
  } catch (err) {
    console.error("[EmailService] ❌ Failed to send email to", mailOptions.to);
    console.error("[EmailService] Error:", err.message);
    if (err.response) console.error("[EmailService] SMTP Response:", err.response);
    throw err;
  }
};



const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim();
// Use the cleaned emailUser from the top of the file
const FROM = `"BizDigit UK" <${emailUser || "noreply@digiboost.com"}>`;


// ---------------------------------------------------------------------------
// 1. Notify Admin when a new customer registers
// ---------------------------------------------------------------------------
const sendRegistrationNotificationToAdmin = async (user) => {
  if (!ADMIN_EMAIL) return;
  await safeSend({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: "New Business Owner Registration — Action Required",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#0e1629;color:#e8edf8;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#00d4ff,#0097ba);padding:24px 32px;">
          <h1 style="margin:0;font-size:22px;color:#0a0f1e;">New Registration Submitted</h1>
        </div>
        <div style="padding:28px 32px;">
          <p style="color:#a8b8d0;margin-top:0;">A new business owner has registered and is awaiting your approval.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
              <td style="padding:10px 0;color:#6b80a0;font-size:13px;width:130px;">Full Name</td>
              <td style="padding:10px 0;color:#e8edf8;font-weight:600;">${user.name}</td>
            </tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
              <td style="padding:10px 0;color:#6b80a0;font-size:13px;">Email</td>
              <td style="padding:10px 0;color:#e8edf8;font-weight:600;">${user.email}</td>
            </tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
              <td style="padding:10px 0;color:#6b80a0;font-size:13px;">Business Name</td>
              <td style="padding:10px 0;color:#e8edf8;font-weight:600;">${user.businessName || "—"}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#6b80a0;font-size:13px;">Registered At</td>
              <td style="padding:10px 0;color:#e8edf8;font-weight:600;">${new Date().toLocaleString()}</td>
            </tr>
          </table>
          <p style="color:#a8b8d0;font-size:14px;">Please log in to the Admin Dashboard to review and approve or reject this registration.</p>
          <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/admin"
             style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#0097ba);color:#0a0f1e;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px;">
            Go to Admin Dashboard
          </a>
        </div>
        <div style="padding:16px 32px;background:rgba(0,0,0,0.2);font-size:12px;color:#6b80a0;">
          BizDigit UK — Automated notification
        </div>
      </div>
    `,
  });
};

// ---------------------------------------------------------------------------
// 2. Notify customer when their account is approved
// ---------------------------------------------------------------------------
const sendApprovalEmail = async (user) => {
  if (!user.email) return;
  await safeSend({
    from: FROM,
    to: user.email,
    subject: "🎉 Your DigiBoost Account Has Been Approved!",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#0e1629;color:#e8edf8;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#10b981,#059669);padding:24px 32px;">
          <h1 style="margin:0;font-size:22px;color:#fff;">Account Approved ✓</h1>
        </div>
        <div style="padding:28px 32px;">
          <p style="color:#e8edf8;font-size:16px;">Hello <strong>${user.name}</strong>,</p>
          <p style="color:#a8b8d0;">Great news! Your DigiBoost business owner account has been <strong style="color:#34d399;">approved</strong> by our admin team.</p>
          <p style="color:#a8b8d0;">You can now log in to access all platform features, manage your digital services, and grow your business.</p>
          <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0;color:#34d399;font-size:14px;">
              <strong>Business:</strong> ${user.businessName || "—"}<br/>
              <strong>Email:</strong> ${user.email}
            </p>
          </div>
          <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/login"
             style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#0097ba);color:#0a0f1e;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px;">
            Login to Your Account
          </a>
          <p style="color:#6b80a0;font-size:13px;margin-top:24px;">If you have any questions, please contact our support team.</p>
        </div>
        <div style="padding:16px 32px;background:rgba(0,0,0,0.2);font-size:12px;color:#6b80a0;">
          BizDigit UK — You received this because you registered a business owner account.
        </div>
      </div>
    `,
  });
};

// ---------------------------------------------------------------------------
// 3. Notify customer when their account is rejected
// ---------------------------------------------------------------------------
const sendRejectionEmail = async (user) => {
  if (!user.email) return;
  await safeSend({
    from: FROM,
    to: user.email,
    subject: "Update on Your DigiBoost Registration",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#0e1629;color:#e8edf8;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#f43f5e,#be123c);padding:24px 32px;">
          <h1 style="margin:0;font-size:22px;color:#fff;">Registration Update</h1>
        </div>
        <div style="padding:28px 32px;">
          <p style="color:#e8edf8;font-size:16px;">Hello <strong>${user.name}</strong>,</p>
          <p style="color:#a8b8d0;">We have reviewed your DigiBoost registration request. Unfortunately, your account has been <strong style="color:#fb7185;">rejected</strong> at this time.</p>
          <p style="color:#a8b8d0;">This may be due to incomplete information or business verification requirements not being met. If you believe this decision is in error, please contact us with your full business details for reconsideration.</p>
          <div style="background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.25);border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0;color:#fb7185;font-size:14px;">
              <strong>Registered Email:</strong> ${user.email}
            </p>
          </div>
          <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/contact"
             style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#0097ba);color:#0a0f1e;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px;">
            Contact Support
          </a>
          <p style="color:#6b80a0;font-size:13px;margin-top:24px;">We appreciate your interest in DigiBoost and hope to assist you in the future.</p>
        </div>
        <div style="padding:16px 32px;background:rgba(0,0,0,0.2);font-size:12px;color:#6b80a0;">
          BizDigit UK — You received this because you registered a business owner account.
        </div>
      </div>
    `,
  });
};

// ---------------------------------------------------------------------------
// 4. Send OTP for password reset
// ---------------------------------------------------------------------------
const sendPasswordResetOTPEmail = async (user, otp) => {
  if (!user.email) return;
  await safeSend({
    from: FROM,
    to: user.email,
    subject: "Your DigiBoost Password Reset Code",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#0e1629;color:#e8edf8;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#7c3aed,#4c1d95);padding:24px 32px;">
          <h1 style="margin:0;font-size:22px;color:#fff;">Password Reset Code</h1>
        </div>
        <div style="padding:28px 32px;">
          <p style="color:#e8edf8;font-size:16px;">Hello <strong>${user.name}</strong>,</p>
          <p style="color:#a8b8d0;">We received a request to reset your DigiBoost account password. Use the verification code below:</p>
          <div style="text-align:center;margin:28px 0;">
            <div style="display:inline-block;background:rgba(124,58,237,0.15);border:2px solid rgba(124,58,237,0.4);border-radius:12px;padding:20px 40px;">
              <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#a78bfa;">${otp}</span>
            </div>
            <p style="color:#6b80a0;font-size:13px;margin-top:12px;">⏱ This code expires in <strong style="color:#fbbf24;">15 minutes</strong></p>
          </div>
          <p style="color:#a8b8d0;font-size:14px;">If you did not request a password reset, you can safely ignore this email. Your password will not be changed.</p>
          <div style="background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.2);border-radius:8px;padding:14px;margin-top:20px;">
            <p style="margin:0;color:#fb7185;font-size:13px;">🔒 Never share this code with anyone. DigiBoost staff will never ask for it.</p>
          </div>
        </div>
        <div style="padding:16px 32px;background:rgba(0,0,0,0.2);font-size:12px;color:#6b80a0;">
          BizDigit UK — Password reset request for ${user.email}
        </div>
      </div>
    `,
  });
};

module.exports = {
  sendRegistrationNotificationToAdmin,
  sendApprovalEmail,
  sendRejectionEmail,
  sendPasswordResetOTPEmail,
};
