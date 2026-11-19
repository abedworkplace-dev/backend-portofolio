const path = require("path");
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();

// Autoriser les URLs de CLIENT_URL (séparées par des virgules) + local/prod
const clientUrls = (process.env.CLIENT_URL || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://portofolio-nu-lilac-60.vercel.app",
  ...clientUrls,
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origine non autorisée par CORS"));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

const SERVICE_LABELS = {
  web: "Développement Web (React / Fullstack)",
  mobile: "Développement Mobile (React Native / iOS & Android)",
  api: "API REST & Architecture Backend (Node.js / MySQL)",
  uiux: "Intégration UI/UX Pixel-Perfect (Figma)",
  autre: "Autre projet spécifique",
};

const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const createTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS.replace(/\s+/g, ""),
    },
  });
};

app.get("/", (req, res) => {
  res.status(200).json({ ok: true, message: "API Portfolio Abed opérationnelle" });
});

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, service, message } = req.body;

    if (!name?.trim() || !email?.trim() || !service?.trim() || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tous les champs sont obligatoires.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Adresse email invalide.",
      });
    }

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(500).json({
        success: false,
        message: "Configuration SMTP manquante sur le serveur.",
      });
    }

    const serviceLabel = SERVICE_LABELS[service] || service;

    const mailOptions = {
      from: `"Portfolio Abed" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
      replyTo: email.trim(),
      subject: `Nouveau message Portfolio : ${serviceLabel} - ${name.trim()}`,
      text: `Nom : ${name}\nEmail : ${email}\nService : ${serviceLabel}\n\nMessage :\n${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eae5dc; border-radius: 12px; overflow: hidden;">
          <div style="background: #ce3c13; color: #ffffff; padding: 20px 24px;">
            <h2 style="margin: 0; font-size: 20px;">Nouveau contact depuis votre Portfolio</h2>
          </div>
          <div style="padding: 24px; background: #ffffff; color: #101010; line-height: 1.6;">
            <p><strong>Nom & Prénoms :</strong> ${escapeHtml(name)}</p>
            <p><strong>Email :</strong> <a href="mailto:${escapeHtml(email)}" style="color: #ce3c13;">${escapeHtml(email)}</a></p>
            <p><strong>Service souhaité :</strong> ${escapeHtml(serviceLabel)}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 18px 0;" />
            <p style="margin-bottom: 8px;"><strong>Message :</strong></p>
            <div style="background: #fdf5ec; padding: 16px; border-radius: 8px; border-left: 4px solid #ce3c13; white-space: pre-wrap;">${escapeHtml(message)}</div>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: "Message envoyé avec succès !",
    });
  } catch (error) {
    console.error("Erreur envoi email :", error);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de l'envoi du message.",
    });
  }
});

app.post("/api/visit", async (req, res) => {
  try {
    const {
      page = "Non renseignée",
      referrer = "Accès direct",
      language = "Inconnue",
      platform = "Inconnu",
      screen = "Inconnu",
      timezone = "Inconnu",
      userAgent = req.headers["user-agent"] || "Inconnu",
    } = req.body || {};

    // 1. Ignorer les bots / crawlers
    if (/bot|crawl|spider|slurp|lighthouse|headless|facebookexternalhit/i.test(userAgent)) {
      return res.status(200).json({ success: true, ignored: "bot" });
    }

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(500).json({
        success: false,
        message: "Configuration SMTP manquante sur le serveur.",
      });
    }

    // 2. Récupérer l'IP réelle du visiteur
    const forwarded = req.headers["x-forwarded-for"];
    let ip = forwarded
      ? forwarded.split(",")[0].trim()
      : req.socket?.remoteAddress || "Inconnue";

    if (ip.startsWith("::ffff:")) {
      ip = ip.replace("::ffff:", "");
    }

    const isLocalIp = ip === "127.0.0.1" || ip === "::1" || ip === "Inconnue";

    // 3. Infos géographiques (fallback sur les headers Vercel si présents)
    let geo = {
      country: req.headers["x-vercel-ip-country"] || "Inconnu",
      region: req.headers["x-vercel-ip-country-region"] || "Inconnue",
      city: req.headers["x-vercel-ip-city"]
        ? decodeURIComponent(req.headers["x-vercel-ip-city"])
        : "Inconnue",
      isp: "Inconnu",
      org: "Inconnu",
      flag: "",
    };

    if (!isLocalIp) {
      try {
        const geoRes = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
          signal: AbortSignal.timeout(3000),
        });
        const geoData = await geoRes.json();

        if (geoData && geoData.success) {
          geo = {
            country: geoData.country || geo.country,
            region: geoData.region || geo.region,
            city: geoData.city || geo.city,
            isp: geoData.connection?.isp || "Inconnu",
            org: geoData.connection?.org || "Inconnu",
            flag: geoData.flag?.emoji || "",
          };
        }
      } catch (geoErr) {
        console.warn("Erreur lookup GeoIP :", geoErr.message);
      }
    } else {
      geo.country = "Localhost (Test local)";
    }

    const dateVisit = new Date().toLocaleString("fr-FR", {
      timeZone: "Africa/Porto-Novo",
      dateStyle: "full",
      timeStyle: "medium",
    });

    // 4. Envoi de l'email avec tes variables SMTP_USER et ADMIN_EMAIL
    await transporter.sendMail({
      from: `"Portfolio Abed" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
      subject: `👀 Nouvelle visite sur ton portfolio (${geo.country} ${geo.flag})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eae5dc; border-radius: 12px; overflow: hidden;">
          <div style="background: #ce3c13; color: #fff; padding: 16px 24px;">
            <h2 style="margin: 0; font-size: 18px;">Nouvelle visite détectée</h2>
          </div>
          <div style="padding: 20px 24px; color: #101010; background: #ffffff; line-height: 1.6;">
            <p><strong>Date (Bénin) :</strong> ${escapeHtml(dateVisit)}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 14px 0;" />
            <h3 style="margin: 0 0 10px; color: #ce3c13;">Réseau & Localisation</h3>
            <ul style="padding-left: 18px; margin: 0;">
              <li><strong>Adresse IP :</strong> ${escapeHtml(ip)}</li>
              <li><strong>Pays :</strong> ${escapeHtml(geo.country)} ${escapeHtml(geo.flag)}</li>
              <li><strong>Région :</strong> ${escapeHtml(geo.region)}</li>
              <li><strong>Ville :</strong> ${escapeHtml(geo.city)}</li>
              <li><strong>FAI / Opérateur :</strong> ${escapeHtml(geo.isp)}</li>
              <li><strong>Organisation :</strong> ${escapeHtml(geo.org)}</li>
            </ul>
            <hr style="border: none; border-top: 1px solid #eee; margin: 14px 0;" />
            <h3 style="margin: 0 0 10px; color: #ce3c13;">Appareil & Navigation</h3>
            <ul style="padding-left: 18px; margin: 0;">
              <li><strong>Page visitée :</strong> ${escapeHtml(page)}</li>
              <li><strong>Provenance (Referrer) :</strong> ${escapeHtml(referrer)}</li>
              <li><strong>Langue :</strong> ${escapeHtml(language)}</li>
              <li><strong>Système :</strong> ${escapeHtml(platform)}</li>
              <li><strong>Résolution écran :</strong> ${escapeHtml(screen)}</li>
              <li><strong>Fuseau horaire :</strong> ${escapeHtml(timezone)}</li>
              <li><strong>User-Agent :</strong> <small>${escapeHtml(userAgent)}</small></li>
            </ul>
          </div>
        </div>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erreur /api/visit :", error);
    return res.status(500).json({ success: false });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
  });
}

module.exports = app;