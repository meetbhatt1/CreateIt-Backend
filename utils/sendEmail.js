// // utils/sendEmail.js
// import nodemailer from 'nodemailer';

// const transporter = nodemailer.createTransport({
//     service: 'Gmail', // or use custom SMTP
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//     },
// });

// const sendEmail = async ({ to, subject, text }) => {
//     const mailOptions = {
//         from: process.env.EMAIL_USER,
//         to,
//         subject,
//         text,
//     };

//     await transporter.sendMail(mailOptions);
// };

// export default sendEmail;

// utils/sendEmail.js
import nodemailer from 'nodemailer';

const sendEmail = async ({ to, subject, text }) => {
    try {
        // Create the transporter
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Mail options
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            text,
        };

        // Send the email
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent: ", info.response);
    } catch (err) {
        console.error("Error sending email:", err);
        throw err;
    }
};

export default sendEmail;
