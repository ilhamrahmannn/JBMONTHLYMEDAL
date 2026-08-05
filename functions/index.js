const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { defineSecret } = require("firebase-functions/params");
const {
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { jsPDF } = require("jspdf");
const { Resend } = require("resend");

initializeApp();

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const REGION = "asia-southeast1";
const ADMIN_EMAIL = "ilhamrahmannn@gmail.com";
const FROM_EMAIL = "JB Monthly Medal <registration@booking.ilhamtennis.com>";
const VENUE = "Nusa Duta Tennis Complex";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const display = (value, fallback = "Not provided") =>
  escapeHtml(value || fallback);

const sendEmail = async (payload, idempotencyKey) => {
  const resend = new Resend(RESEND_API_KEY.value());
  const { data, error } = await resend.emails.send(payload, {
    idempotencyKey,
  });
  if (error) throw new Error(error.message || JSON.stringify(error));
  return data;
};

const createConfirmationPdf = ({ id, registration }) => {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const category = registration.categoryLabel || registration.category;
  const tournamentName = registration.tournamentName || "JB Monthly Medal";
  const tournamentDate = registration.tournamentDate || "To be announced";
  const reference = `JBMM-${id.slice(0, 8).toUpperCase()}`;

  pdf.setFillColor(7, 16, 12);
  pdf.rect(0, 0, 210, 297, "F");
  pdf.setFillColor(163, 230, 53);
  pdf.rect(0, 0, 8, 297, "F");
  pdf.setTextColor(190, 242, 100);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("JB MONTHLY MEDAL", 22, 30);
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(25);
  pdf.text("OFFICIAL PARTICIPANT", 22, 47);
  pdf.text("CONFIRMATION", 22, 58);
  pdf.setDrawColor(55, 82, 45);
  pdf.roundedRect(22, 78, 166, 143, 5, 5, "S");
  pdf.setTextColor(141, 160, 149);
  pdf.setFontSize(9);
  pdf.text("PARTICIPANT", 32, 96);
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  const nameLines = pdf.splitTextToSize(registration.fullName || "Participant", 142);
  pdf.text(nameLines, 32, 109);
  pdf.setTextColor(141, 160, 149);
  pdf.setFontSize(9);
  pdf.text("CONFIRMED CATEGORY", 32, 139);
  pdf.setTextColor(190, 242, 100);
  pdf.setFontSize(15);
  pdf.text(pdf.splitTextToSize(category || "Category", 142), 32, 151);
  pdf.setTextColor(141, 160, 149);
  pdf.setFontSize(9);
  pdf.text("TOURNAMENT DATE", 32, 177);
  pdf.text("VENUE", 112, 177);
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.text(String(tournamentDate), 32, 188);
  pdf.text(pdf.splitTextToSize(VENUE, 65), 112, 188);
  pdf.setFillColor(17, 29, 20);
  pdf.roundedRect(32, 201, 146, 12, 3, 3, "F");
  pdf.setTextColor(190, 242, 100);
  pdf.setFontSize(9);
  pdf.text("APPROVED · OFFICIAL PARTICIPANT", 105, 209, { align: "center" });
  pdf.setTextColor(141, 160, 149);
  pdf.setFontSize(9);
  pdf.text(`Tournament: ${tournamentName}`, 22, 248);
  pdf.text(`Reference: ${reference}`, 22, 256);
  pdf.setTextColor(190, 242, 100);
  pdf.setFontSize(12);
  pdf.text("SEE YOU ON COURT!", 22, 276);

  return {
    filename: `${reference}-participant-confirmation.pdf`,
    content: pdf.output("datauristring").split(",")[1],
  };
};

exports.notifyAdminOnRegistration = onDocumentCreated(
  {
    document: "registrations/{registrationId}",
    region: REGION,
    secrets: [RESEND_API_KEY],
  },
  async (event) => {
    const registration = event.data?.data();
    if (!registration) return;
    const id = event.params.registrationId;
    const category = registration.categoryLabel || registration.category;

    try {
      const result = await sendEmail(
        {
          from: FROM_EMAIL,
          to: [ADMIN_EMAIL],
          replyTo: registration.email || ADMIN_EMAIL,
          subject: `New registration - ${registration.fullName} (${category})`,
          html: `<div style="background:#07100c;padding:32px;font-family:Arial,sans-serif;color:#f7faf8"><div style="max-width:620px;margin:auto;border:1px solid #36522d;border-radius:18px;overflow:hidden;background:#0b130e"><div style="padding:26px;border-bottom:1px solid #263529"><p style="margin:0;color:#bef264;font-size:11px;font-weight:800;letter-spacing:1.5px">REGISTRATION NOTIFICATION</p><h1 style="margin:10px 0 0;font-size:28px">New participant submission</h1></div><div style="padding:26px;color:#dce5df;line-height:1.7"><p>A new registration is ready for payment verification.</p><div style="padding:18px;border-radius:12px;background:#111d14;border-left:4px solid #a3e635"><strong style="display:block;color:#fff;font-size:18px">${display(registration.fullName)}</strong><span style="color:#bef264;font-weight:800">${display(category)}</span></div><p><strong>Email:</strong> ${display(registration.email)}<br><strong>WhatsApp:</strong> ${display(registration.phone)}<br><strong>From:</strong> ${display(registration.origin)}<br><strong>NTRP:</strong> ${display(registration.ntrpLevel)}<br><strong>Ranking:</strong> ${registration.rankingPosition ? `#${display(registration.rankingPosition)}` : "NR"}<br><strong>Payment:</strong> RM${display(registration.paymentAmount)}</p><p style="margin-bottom:0;color:#98a69d">Open Registration Verification in the admin page to approve or reject this participant.</p></div></div></div>`,
        },
        `registration-admin-${id}`
      );
      await event.data.ref.update({
        adminNotificationEmailId: result.id,
        adminNotificationSentAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      logger.error("Admin registration email failed", { id, error });
      throw error;
    }
  }
);

exports.welcomeApprovedParticipant = onDocumentUpdated(
  {
    document: "registrations/{registrationId}",
    region: REGION,
    secrets: [RESEND_API_KEY],
  },
  async (event) => {
    const before = event.data?.before.data();
    const registration = event.data?.after.data();
    if (!registration || before?.status === "approved" || registration.status !== "approved") return;

    const id = event.params.registrationId;
    const category = registration.categoryLabel || registration.category;
    const tournamentName = registration.tournamentName || "JB Monthly Medal";
    const pdf = createConfirmationPdf({ id, registration });

    try {
      const result = await sendEmail(
        {
          from: FROM_EMAIL,
          to: [registration.email],
          replyTo: ADMIN_EMAIL,
          subject: `Welcome as an official participant - ${tournamentName}`,
          html: `<div style="background:#07100c;padding:32px;font-family:Arial,sans-serif;color:#f7faf8"><div style="max-width:620px;margin:auto;border:1px solid #36522d;border-radius:18px;overflow:hidden;background:#0b130e"><div style="padding:28px;border-bottom:1px solid #263529"><p style="margin:0;color:#bef264;font-size:11px;font-weight:800;letter-spacing:1.6px">JB MONTHLY MEDAL</p><h1 style="margin:10px 0 0;font-size:30px">Welcome to the tournament</h1></div><div style="padding:28px;color:#dce5df;line-height:1.7"><p>Hi <strong style="color:#fff">${display(registration.fullName)}</strong>,</p><p>Your registration for <strong style="color:#bef264">${display(tournamentName)}</strong> has been approved. You are officially welcomed as a participant.</p><div style="margin:22px 0;padding:18px;border-radius:12px;background:#111d14;border-left:4px solid #a3e635"><span style="display:block;color:#8da095;font-size:11px;font-weight:800">CONFIRMED CATEGORY</span><strong style="display:block;margin-top:6px;color:#fff;font-size:18px">${display(category)}</strong></div><p><strong>Date:</strong> ${display(registration.tournamentDate, "To be announced")}<br><strong>Venue:</strong> ${VENUE}</p><p>Your official participant confirmation is attached as a PDF. Please keep it for your records.</p><p style="margin-bottom:0;color:#bef264;font-weight:800">See you on court!</p></div></div></div>`,
          attachments: [{ filename: pdf.filename, content: pdf.content }],
        },
        `registration-approved-${id}`
      );
      await event.data.after.ref.update({
        confirmationEmailId: result.id,
        confirmationEmailSentAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      logger.error("Participant welcome email failed", { id, error });
      throw error;
    }
  }
);
