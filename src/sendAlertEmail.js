const nodemailer = require('nodemailer');

async function sendAlertEmail({ subject, text }) {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error(
      'Faltan las variables de entorno GMAIL_USER y/o GMAIL_APP_PASSWORD.'
    );
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: GMAIL_USER,
    to: GMAIL_USER,
    subject,
    text,
  });
}

module.exports = { sendAlertEmail };
