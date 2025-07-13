const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const app = express();
const port = 3000;
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
const db = new sqlite3.Database('./registrations.db', (err) => {
  if (err) return console.error(err.message);
  console.log('Connected to SQLite database');
});
db.run(`
  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    gender TEXT,
    branch TEXT,
    section TEXT,
    payment TEXT,
    email TEXT,
    phone TEXT
  )
`);
app.post('/register', (req, res) => {
  const { name, gender, branch, section, payment, email, phone } = req.body;
  if (!name || !gender || !branch || !section || !payment || !email || !phone) {
    return res.status(400).send('All fields are required.');
  }
  const insertQuery = `INSERT INTO participants (name, gender, branch, section, payment, email, phone)
                       VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(insertQuery, [name, gender, branch, section, payment, email, phone], function (err) {
    if (err) {
      console.error('Error inserting data:', err.message);
      return res.status(500).send('Something went wrong.');
    }
    const doc = new PDFDocument();
    const filePath = `./certificate_${Date.now()}.pdf`;
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(20).text('Certificate of Registration', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Name: ${name}`);
    doc.text(`Gender: ${gender}`);
    doc.text(`Branch: ${branch}`);
    doc.text(`Section: ${section}`);
    doc.text(`Payment Mode: ${payment}`);
    doc.text(`Phone: ${phone}`);
    doc.text(`Email: ${email}`);
    doc.end();
    stream.on('finish', () => {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
      const mailOptions = {
        from: 'nvsk72@gmail.com',
        to: email,
        subject: 'Registration Confirmation with Certificate',
        text: `Hi ${name},\n\nThanks for registering!\n\nPlease find your certificate attached.`,
        attachments: [{
          filename: 'certificate.pdf',
          path: filePath,
        }],
      };
      transporter.sendMail(mailOptions, (err) => {
        fs.unlink(filePath, () => {}); // delete temp PDF
        if (err) {
          console.error('Email error:', err.message);
          return res.send('Registered, but failed to send email.');
        }
        res.send('Registration successful! Certificate sent via email.');
      });
    });
  });
});
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});