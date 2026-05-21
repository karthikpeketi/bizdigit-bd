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



const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "bizdigituk@gmail.com").trim();
// Use the cleaned emailUser from the top of the file
const FROM = `"BizDigit UK" <${emailUser || "noreply@bizdigituk.com"}>`;

const BRAND_BACKGROUND = "#081224";
const CONTENT_BACKGROUND = "#0f1a36";
const TEXT_COLOR = "#e8edf8";
const MUTED_COLOR = "#8da1c5";
const ACCENT_COLOR = "#7faeb5";
const ACCENT_DARK = "#064a54";
const SUCCESS_COLOR = "#34d399";
const WARNING_COLOR = "#fbbf24";
const DANGER_COLOR = "#f43f5e";
const BORDER_COLOR = "rgba(255,255,255,0.08)";

const wrapEmailHtml = ({ title, intro, body, buttonText, buttonUrl, footerNote }) => `
  <div style="font-family:Inter,system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;max-width:600px;margin:auto;background:${BRAND_BACKGROUND};color:${TEXT_COLOR};border-radius:18px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,${ACCENT_COLOR},${ACCENT_DARK});padding:28px 32px;">
      <h1 style="margin:0;font-size:24px;line-height:1.2;color:#ffffff;">${title}</h1>
    </div>
    <div style="padding:28px 32px;background:${CONTENT_BACKGROUND};">
      <p style="color:${MUTED_COLOR};font-size:15px;margin-bottom:24px;">${intro}</p>
      ${body}
      ${buttonText ? `<a href="${buttonUrl}" style="display:inline-block;margin-top:24px;background:linear-gradient(135deg,${ACCENT_COLOR},${ACCENT_DARK});color:#0b1722;font-weight:700;padding:14px 26px;border-radius:12px;text-decoration:none;">${buttonText}</a>` : ""}
      ${footerNote ? `<p style="color:${MUTED_COLOR};font-size:13px;margin-top:28px;">${footerNote}</p>` : ""}
    </div>
    <div style="padding:18px 32px;background:rgba(255,255,255,0.05);font-size:12px;color:${MUTED_COLOR};">
      BizDigit UK — Keeping UK businesses digital, fast and secure.
    </div>
  </div>
`;

// ---------------------------------------------------------------------------
// 0. Contact form notification
// ---------------------------------------------------------------------------
const sendContactFormSubmissionEmail = async ({ name, email, company, message }) => {
  if (!ADMIN_EMAIL) return;
  const displayName = name?.trim() || "Anonymous";
  const displayCompany = company?.trim() || "Not provided";
  const html = wrapEmailHtml({
    title: "New Contact Form Submission",
    intro: "A visitor has sent a message via the BizDigit contact page.",
    body: `
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid ${BORDER_COLOR};">
          <td style="padding:10px 0;color:${MUTED_COLOR};font-size:13px;width:140px;">Name</td>
          <td style="padding:10px 0;color:${TEXT_COLOR};font-weight:600;">${displayName}</td>
        </tr>
        <tr style="border-bottom:1px solid ${BORDER_COLOR};">
          <td style="padding:10px 0;color:${MUTED_COLOR};font-size:13px;">Email</td>
          <td style="padding:10px 0;color:${TEXT_COLOR};font-weight:600;">${email}</td>
        </tr>
        <tr style="border-bottom:1px solid ${BORDER_COLOR};">
          <td style="padding:10px 0;color:${MUTED_COLOR};font-size:13px;">Company</td>
          <td style="padding:10px 0;color:${TEXT_COLOR};font-weight:600;">${displayCompany}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:${MUTED_COLOR};font-size:13px;vertical-align:top;">Message</td>
          <td style="padding:10px 0;color:${TEXT_COLOR};font-weight:600;white-space:pre-wrap;">${message}</td>
        </tr>
      </table>
    `,
    buttonText: "View Contact Page",
    buttonUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/contact#contact-form`,
    footerNote: "This notification is sent to the BizDigit support team whenever a new enquiry is received.",
  });

  await safeSend({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New contact enquiry from ${displayName}`,
    html,
  });
};

// ---------------------------------------------------------------------------
// 1. Notify Admin when a new customer registers
// ---------------------------------------------------------------------------
const sendRegistrationNotificationToAdmin = async (user) => {
  if (!ADMIN_EMAIL) return;
  const html = wrapEmailHtml({
    title: "New Business Owner Registration",
    intro: "A new business registration is waiting for your review.",
    body: `
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid ${BORDER_COLOR};">
          <td style="padding:10px 0;color:${MUTED_COLOR};font-size:13px;width:130px;">Full Name</td>
          <td style="padding:10px 0;color:${TEXT_COLOR};font-weight:600;">${user.name}</td>
        </tr>
        <tr style="border-bottom:1px solid ${BORDER_COLOR};">
          <td style="padding:10px 0;color:${MUTED_COLOR};font-size:13px;">Email</td>
          <td style="padding:10px 0;color:${TEXT_COLOR};font-weight:600;">${user.email}</td>
        </tr>
        <tr style="border-bottom:1px solid ${BORDER_COLOR};">
          <td style="padding:10px 0;color:${MUTED_COLOR};font-size:13px;">Business Name</td>
          <td style="padding:10px 0;color:${TEXT_COLOR};font-weight:600;">${user.businessName || "—"}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:${MUTED_COLOR};font-size:13px;">Registered At</td>
          <td style="padding:10px 0;color:${TEXT_COLOR};font-weight:600;">${new Date().toLocaleString()}</td>
        </tr>
      </table>
    `,
    buttonText: "Go to Admin Dashboard",
    buttonUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/admin`,
    footerNote: "Approve or reject the registration from the Admin Dashboard.",
  });

  await safeSend({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: "New Business Owner Registration — Action Required",
    html,
  });
};

// ---------------------------------------------------------------------------
// 2. Notify customer when their account is approved
// ---------------------------------------------------------------------------
const sendApprovalEmail = async (user) => {
  if (!user.email) return;
  const html = wrapEmailHtml({
    title: "Your BizDigit Account is Approved",
    intro: "Your account has been approved and is ready to use.",
    body: `
      <p style="color:${TEXT_COLOR};font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hello <strong>${user.name}</strong>, your BizDigit account is now approved.
      </p>
      <div style="background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.25);border-radius:12px;padding:18px;margin:16px 0;">
        <p style="margin:0;color:${SUCCESS_COLOR};font-size:14px;">
          <strong>Business:</strong> ${user.businessName || "—"}<br />
          <strong>Email:</strong> ${user.email}
        </p>
      </div>
    `,
    buttonText: "Login to Your Account",
    buttonUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`,
    footerNote: "Welcome to BizDigit — your UK business digital partner.",
  });

  await safeSend({
    from: FROM,
    to: user.email,
    subject: "🎉 Your BizDigit Account Has Been Approved!",
    html,
  });
};

// ---------------------------------------------------------------------------
// 3. Notify customer when their account is rejected
// ---------------------------------------------------------------------------
const sendRejectionEmail = async (user) => {
  if (!user.email) return;
  const html = wrapEmailHtml({
    title: "Registration Status Update",
    intro: "We've reviewed your registration request.",
    body: `
      <p style="color:${TEXT_COLOR};font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hello <strong>${user.name}</strong>, your registration was not accepted at this time.
      </p>
      <div style="background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.25);border-radius:12px;padding:18px;margin:16px 0;">
        <p style="margin:0;color:${DANGER_COLOR};font-size:14px;">
          <strong>Registered Email:</strong> ${user.email}
        </p>
      </div>
      <p style="color:${MUTED_COLOR};font-size:15px;line-height:1.6;margin:0;">
        If you think this is wrong, please contact us and include your full business details.
      </p>
    `,
    buttonText: "Contact Support",
    buttonUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/contact`,
    footerNote: "We’re here to help with next steps if you want to reapply.",
  });

  await safeSend({
    from: FROM,
    to: user.email,
    subject: "Update on Your BizDigit Registration",
    html,
  });
};

// ---------------------------------------------------------------------------
// 4. Send OTP for password reset
// ---------------------------------------------------------------------------
const sendPasswordResetOTPEmail = async (user, otp) => {
  if (!user.email) return;
  const html = wrapEmailHtml({
    title: "BizDigit Password Reset Code",
    intro: "Use this secure code to reset your account password.",
    body: `
      <p style="color:${TEXT_COLOR};font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hello <strong>${user.name}</strong>, here is your password reset code.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <div style="display:inline-block;background:rgba(124,58,237,0.12);border:2px solid rgba(124,58,237,0.35);border-radius:16px;padding:24px 32px;">
          <span style="font-size:44px;font-weight:900;letter-spacing:10px;color:#c4b5fd;">${otp}</span>
        </div>
      </div>
      <p style="margin:0;color:${MUTED_COLOR};font-size:14px;line-height:1.6;">This code expires in <strong style="color:${WARNING_COLOR};">15 minutes</strong>.</p>
      <div style="background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.2);border-radius:12px;padding:16px;margin-top:20px;">
        <p style="margin:0;color:${DANGER_COLOR};font-size:13px;">Never share this code. BizDigit staff will never ask for it.</p>
      </div>
    `,
    footerNote: "If you did not request a password reset, you can ignore this email.",
  });

  await safeSend({
    from: FROM,
    to: user.email,
    subject: "Your BizDigit UK Password Reset Code",
    html,
  });
};

module.exports = {
  sendContactFormSubmissionEmail,
  sendRegistrationNotificationToAdmin,
  sendApprovalEmail,
  sendRejectionEmail,
  sendPasswordResetOTPEmail,
};
