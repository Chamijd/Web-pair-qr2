import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',  // Gmail SMTP server
  port: 587,
  secure: false,
  auth: {
    user: 'ransikachamindu43@gmail.com',     // ඔබේ Gmail එක
    pass: 'Chamindu2008',  // Gmail App Password
  },
});

app.post('/send-email', async (req, res) => {
  const { name, email } = req.body;

  try {
    await transporter.sendMail({
      from: '"CHMA MD Bot" <yourgmail@gmail.com>',
      to: email,
      subject: 'Registration Successful!',
      text: `Hello ${name},\n\nThank you for registering with CHMA MD WhatsApp Bot!`,
      html: `<p>Hello <b>${name}</b>,</p><p>Thank you for registering with <b>CHMA MD WhatsApp Bot</b>!</p>`,
    });
    res.json({ success: true, message: 'Email sent' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ success: false, message: 'Failed to send email' });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
