const nodemailer = require('nodemailer');

// Set up the transporter using environment variables
const transporter = nodemailer.createTransport({
    host: 'smtpout.secureserver.net', // GoDaddy SMTP server address
    port: 465, // SMTP port for SSL
    secure: true, // true for 465, false for other ports
    auth: {
        user: 'noreply@codeklab.com', // your GoDaddy email address
        pass: 'AltShiftDel123@' // your GoDaddy email password
    }
});

// Generalized function to send emails
const sendEmail = async ({ toUser, subject, htmlBody }) => {
  const mailOptions = {
    from: '"Codek Lab" <noreply@codeklab.com>',
    to: toUser.email,
    subject: subject,
    html: htmlBody
  };

  await transporter.sendMail(mailOptions);
};

const VerificationEmail = async (user, verificationUrl) => {
  const subject = 'Verify Your Email';
  const htmlBody = `
  <!doctype html>
  <html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  
  <head>
      <title>
  
      </title>
      <!--[if !mso]><!-- -->
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <!--<![endif]-->
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style type="text/css">
          #outlook a {
              padding: 0;
          }
  
          .ReadMsgBody {
              width: 100%;
          }
  
          .ExternalClass {
              width: 100%;
          }
  
          .ExternalClass * {
              line-height: 100%;
          }
  
          body {
              margin: 0;
              padding: 0;
              -webkit-text-size-adjust: 100%;
              -ms-text-size-adjust: 100%;
          }
  
          table,
          td {
              border-collapse: collapse;
              mso-table-lspace: 0pt;
              mso-table-rspace: 0pt;
          }
  
          img {
              border: 0;
              height: auto;
              line-height: 100%;
              outline: none;
              text-decoration: none;
              -ms-interpolation-mode: bicubic;
          }
  
          p {
              display: block;
              margin: 13px 0;
          }
      </style>
      <!--[if !mso]><!-->
      <style type="text/css">
          @media only screen and (max-width:480px) {
              @-ms-viewport {
                  width: 320px;
              }
              @viewport {
                  width: 320px;
              }
          }
      </style>
      <!--<![endif]-->
      <!--[if mso]>
          <xml>
          <o:OfficeDocumentSettings>
            <o:AllowPNG/>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
          </xml>
          <![endif]-->
      <!--[if lte mso 11]>
          <style type="text/css">
            .outlook-group-fix { width:100% !important; }
          </style>
          <![endif]-->
  
  
      <style type="text/css">
          @media only screen and (min-width:480px) {
              .mj-column-per-100 {
                  width: 100% !important;
              }
          }
      </style>
  
  
      <style type="text/css">
      </style>
  
  </head>
  
  <body style="background-color:#f9f9f9;">
  
  
      <div style="background-color:#f9f9f9;">
  
  
          <!--[if mso | IE]>
        <table
           align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"
        >
          <tr>
            <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
        <![endif]-->
  
  
          <div style="background:#f9f9f9;background-color:#f9f9f9;Margin:0px auto;max-width:600px;">
  
              <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9f9f9;background-color:#f9f9f9;width:100%;">
                  <tbody>
                      <tr>
                          <td style="border-bottom:#333957 solid 5px;direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top;">
                              <!--[if mso | IE]>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  
          <tr>
        
          </tr>
        
                    </table>
                  <![endif]-->
                          </td>
                      </tr>
                  </tbody>
              </table>
  
          </div>
  
  
          <!--[if mso | IE]>
            </td>
          </tr>
        </table>
        
        <table
           align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"
        >
          <tr>
            <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
        <![endif]-->
  
  
          <div style="background:#fff;background-color:#fff;Margin:0px auto;max-width:600px;">
  
              <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;background-color:#fff;width:100%;">
                  <tbody>
                      <tr>
                          <td style="border:#dddddd solid 1px;border-top:0px;direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top;">
                              <!--[if mso | IE]>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  
          <tr>
        
              <td
                 style="vertical-align:bottom;width:600px;"
              >
            <![endif]-->
  
                              <div class="mj-column-per-100 outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:bottom;width:100%;">
  
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:bottom;" width="100%">
  
                                      <tr>
                                          <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
  
                                              <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0px;">
                                                  <tbody>
                                                      <tr>
                                                          <td style="width:64px;">
  
                                                              <img height="auto" src="https://i.imgur.com/YW3QjB3.jpeg" style="border:0;display:block;outline:none;text-decoration:none;width:100%;" width="64" />
  
                                                          </td>
                                                      </tr>
                                                  </tbody>
                                              </table>
  
                                          </td>
                                      </tr>
  
                                      <tr>
                                          <td align="center" style="font-size:0px;padding:10px 25px;padding-bottom:40px;word-break:break-word;">
  
                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:32px;font-weight:bold;line-height:1;text-align:center;color:#555;">
                                                  Please confirm your email
                                              </div>
  
                                          </td>
                                      </tr>
  
                                      <tr>
                                          <td align="center" style="font-size:0px;padding:10px 25px;padding-bottom:0;word-break:break-word;">
  
                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:22px;text-align:center;color:#555;">
                                                  Yes, we know.
                                              </div>
  
                                          </td>
                                      </tr>
  
                                      <tr>
                                          <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
  
                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:22px;text-align:center;color:#555;">
                                                  An email to confirm an email. 🤪
                                              </div>
  
                                          </td>
                                      </tr>
  
                                      <tr>
                                          <td align="center" style="font-size:0px;padding:10px 25px;padding-bottom:20px;word-break:break-word;">
  
                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:22px;text-align:center;color:#555;">
                                                  Please validate your email address in order to get started using Codek Lab course platform.
                                              </div>
  
                                          </td>
                                      </tr>
  
                                      <tr>
                                      <td align="center" style="font-size:0px;padding:10px 25px;padding-top:30px;padding-bottom:40px;word-break:break-word;">
                                          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;line-height:100%;">
                                              <tr>
                                                  <td align="center" bgcolor="#2F67F6" role="presentation" style="border:none;border-radius:3px;color:#ffffff;cursor:pointer;padding:15px 25px;" valign="middle">
                                                      <a href="https://www.codeklab.com/verify?code=${verificationUrl}" style="color: #ffffff; text-decoration: none;">
                                                          <p style="background:#2F67F6;color:#ffffff;font-family:'Helvetica Neue', Arial, sans-serif;font-size:15px;font-weight:normal;line-height:120%;Margin:0;text-transform:none;">
                                                              Confirm Your Email
                                                          </p>
                                                      </a>
                                                  </td>
                                              </tr>
                                          </table>
                                      </td>
                                  </tr>                                  
  
                                      <tr>
                                          <td align="center" style="font-size:0px;padding:10px 25px;padding-bottom:0;word-break:break-word;">
  
                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:22px;text-align:center;color:#555;">
                                                  Or verify using this link:
                                              </div>
  
                                          </td>
                                      </tr>
  
                                      <tr>
                                          <td align="center" style="font-size:0px;padding:10px 25px;padding-bottom:40px;word-break:break-word;">
  
                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:22px;text-align:center;color:#555;">
                                                  <a href="https://www.codeklab.com/verify?code=${verificationUrl}" style="color:#2F67F6">https://www.codeklab.com/verify?code=${verificationUrl}</a>
                                              </div>
  
                                          </td>
                                      </tr>
  
                                      <tr>
                                          <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
  
                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:26px;font-weight:bold;line-height:1;text-align:center;color:#555;">
                                                  Need Help?
                                              </div>
  
                                          </td>
                                      </tr>
  
                                      <tr>
                                          <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
  
                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:22px;text-align:center;color:#555;">
                                                  Please send and feedback or bug info<br> to <a href="mailto:Hello@codeklab.com" style="color:#2F67F6">Hello@codeklab.com</a>
                                              </div>
  
                                          </td>
                                      </tr>
  
                                  </table>
  
                              </div>
  
                              <!--[if mso | IE]>
              </td>
            
          </tr>
        
                    </table>
                  <![endif]-->
                          </td>
                      </tr>
                  </tbody>
              </table>
  
          </div>
  
  
          <!--[if mso | IE]>
            </td>
          </tr>
        </table>
        
        <table
           align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"
        >
          <tr>
            <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
        <![endif]-->
  
  
          <div style="Margin:0px auto;max-width:600px;">
  
              <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                  <tbody>
                      <tr>
                          <td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top;">
                              <!--[if mso | IE]>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  
          <tr>
        
              <td
                 style="vertical-align:bottom;width:600px;"
              >
            <![endif]-->
  
                              <div class="mj-column-per-100 outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:bottom;width:100%;">
  
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                      <tbody>
                                          <tr>
                                              <td style="vertical-align:bottom;padding:0;">
  
                                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  
                                                      <tr>
                                                          <td align="center" style="font-size:0px;padding:0;word-break:break-word;">
  
                                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:300;line-height:1;text-align:center;color:#575757;">
                                                                  Codek Lab, Iraq, Baghdad, Al-mansour st.
                                                              </div>
  
                                                          </td>
                                                      </tr>
  
                                                  </table>
  
                                              </td>
                                          </tr>
                                      </tbody>
                                  </table>
  
                              </div>
  
                              <!--[if mso | IE]>
              </td>
            
          </tr>
        
                    </table>
                  <![endif]-->
                          </td>
                      </tr>
                  </tbody>
              </table>
  
          </div> 
  
  
          <!--[if mso | IE]>
            </td>
          </tr>
        </table>
        <![endif]-->
  
  
      </div>
  
  </body>
  
  </html>
  `;
  await sendEmail({ toUser: user, subject, htmlBody });
};

// Function to send a verification email with minimal content
const sendVerificationEmail = async (user) => {
  const subject = 'Verify Your Email';
  const htmlBody = `<p>Hi ${user.username},</p><p>Success</p>`;
  await sendEmail({ toUser: user, subject, htmlBody });
};

// Function to send a welcome email with minimal content
const sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to Our Platform!';
  const htmlBody = `<!doctype html>
  <html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  
  <head>
      <title>
  
      </title>
      <!--[if !mso]><!-- -->
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <!--<![endif]-->
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style type="text/css">
          #outlook a {
              padding: 0;
          }
  
          .ReadMsgBody {
              width: 100%;
          }
  
          .ExternalClass {
              width: 100%;
          }
  
          .ExternalClass * {
              line-height: 100%;
          }
  
          body {
              margin: 0;
              padding: 0;
              -webkit-text-size-adjust: 100%;
              -ms-text-size-adjust: 100%;
          }
  
          table,
          td {
              border-collapse: collapse;
              mso-table-lspace: 0pt;
              mso-table-rspace: 0pt;
          }
  
          img {
              border: 0;
              height: auto;
              line-height: 100%;
              outline: none;
              text-decoration: none;
              -ms-interpolation-mode: bicubic;
          }
  
          p {
              display: block;
              margin: 13px 0;
          }
      </style>
      <!--[if !mso]><!-->
      <style type="text/css">
          @media only screen and (max-width:480px) {
              @-ms-viewport {
                  width: 320px;
              }
              @viewport {
                  width: 320px;
              }
          }
      </style>
      <!--<![endif]-->
      <!--[if mso]>
          <xml>
          <o:OfficeDocumentSettings>
            <o:AllowPNG/>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
          </xml>
          <![endif]-->
      <!--[if lte mso 11]>
          <style type="text/css">
            .outlook-group-fix { width:100% !important; }
          </style>
          <![endif]-->
  
  
      <style type="text/css">
          @media only screen and (min-width:480px) {
              .mj-column-per-100 {
                  width: 100% !important;
              }
          }
      </style>
  
  
      <style type="text/css">
      </style>
  
  </head>
  
  <body style="background-color:#f9f9f9;">
  
  
      <div style="background-color:#f9f9f9;">
  
  
          <!--[if mso | IE]>
        <table
           align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"
        >
          <tr>
            <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
        <![endif]-->
  
  
          <div style="background:#f9f9f9;background-color:#f9f9f9;Margin:0px auto;max-width:600px;">
  
              <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9f9f9;background-color:#f9f9f9;width:100%;">
                  <tbody>
                      <tr>
                          <td style="border-bottom:#333957 solid 5px;direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top;">
                              <!--[if mso | IE]>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  
          <tr>
        
          </tr>
        
                    </table>
                  <![endif]-->
                          </td>
                      </tr>
                  </tbody>
              </table>
  
          </div>
  
  
          <!--[if mso | IE]>
            </td>
          </tr>
        </table>
        
        <table
           align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"
        >
          <tr>
            <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
        <![endif]-->
  
  
          <div style="background:#fff;background-color:#fff;Margin:0px auto;max-width:600px;">
  
              <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;background-color:#fff;width:100%;">
                  <tbody>
                      <tr>
                          <td style="border:#dddddd solid 1px;border-top:0px;direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top;">
                              <!--[if mso | IE]>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  
          <tr>
        
              <td
                 style="vertical-align:bottom;width:600px;"
              >
            <![endif]-->
  
                              <div class="mj-column-per-100 outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:bottom;width:100%;">
  
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:bottom;" width="100%">
  
                                      <tr>
                                          <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
  
                                              <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0px;">
                                                  <tbody>
                                                      <tr>
                                                          <td style="width:64px;">
  
                                                              <img height="auto" src="https://i.imgur.com/YW3QjB3.jpeg" style="border:0;display:block;outline:none;text-decoration:none;width:100%;" width="64" />
  
                                                          </td>
                                                      </tr>
                                                  </tbody>
                                              </table>
  
                                          </td>
                                      </tr>
  
                                      <tr>
                                          <td align="center" style="font-size:0px;padding:10px 25px;padding-bottom:40px;word-break:break-word;">
  
                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:28px;font-weight:bold;line-height:1;text-align:center;color:#555;">
                                                  Welcome to Codek Lab platform
                                              </div>
  
                                          </td>
                                      </tr>
  
                                      <tr>
                                          <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
  
                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:22px;text-align:left;color:#555;">
                                                  Hello ${user.username}!<br></br>
                                                  Thank you for signing up for Codek lab course platform. We're really happy to have you!.
                                              </div>
  
                                          </td>
                                      </tr>
  
                                      <tr>
                                          <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
  
                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:20px;text-align:left;color:#525252;">
                                                  Best regards,<br><br> Yousif Dhrgam<br>Codek lab , CEO and Founder<br>
                                                  <a href="https://www.codeklab.com/course" style="color:#2F67F6">codeklab.com</a>
                                              </div>
  
                                          </td>
                                      </tr>
  
                                  </table>
  
                              </div>
  
                              <!--[if mso | IE]>
              </td>
            
          </tr>
        
                    </table>
                  <![endif]-->
                          </td>
                      </tr>
                  </tbody>
              </table>
  
          </div>
  
  
          <!--[if mso | IE]>
            </td>
          </tr>
        </table>
        
        <table
           align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"
        >
          <tr>
            <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
        <![endif]-->
  
  
          <div style="Margin:0px auto;max-width:600px;">
  
              <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                  <tbody>
                      <tr>
                          <td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top;">
                              <!--[if mso | IE]>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  
          <tr>
        
              <td
                 style="vertical-align:bottom;width:600px;"
              >
            <![endif]-->
  
                              <div class="mj-column-per-100 outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:bottom;width:100%;">
  
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                      <tbody>
                                          <tr>
                                              <td style="vertical-align:bottom;padding:0;">
  
                                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  
                                                      <tr>
                                                          <td align="center" style="font-size:0px;padding:0;word-break:break-word;">
  
                                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:300;line-height:1;text-align:center;color:#575757;">
                                                                  Some Firm Ltd, 35 Avenue. City 10115, USA
                                                              </div>
  
                                                          </td>
                                                      </tr>
  
                                                      <tr>
                                                          <td align="center" style="font-size:0px;padding:10px;word-break:break-word;">
  
                                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:300;line-height:1;text-align:center;color:#575757;">
                                                                  <a href="" style="color:#575757">Unsubscribe</a> from our emails
                                                              </div>
  
                                                          </td>
                                                      </tr>
  
                                                  </table>
  
                                              </td>
                                          </tr>
                                      </tbody>
                                  </table>
  
                              </div>
  
                              <!--[if mso | IE]>
              </td>
            
          </tr>
        
                    </table>
                  <![endif]-->
                          </td>
                      </tr>
                  </tbody>
              </table>
  
          </div>
  
  
          <!--[if mso | IE]>
            </td>
          </tr>
        </table>
        <![endif]-->
  
  
      </div>
  
  </body>
  
  </html>`;
  await sendEmail({ toUser: user, subject, htmlBody });
};

// Function to send a login notification email with minimal content
const sendLoginNotificationEmail = async (user, ip, userAgent) => {
  const subject = 'New Login Detected';
  const htmlBody = `<!doctype html>
  <html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  
  <head>
      <title>
  
      </title>
      <!--[if !mso]><!-- -->
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <!--<![endif]-->
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style type="text/css">
          #outlook a {
              padding: 0;
          }
  
          .ReadMsgBody {
              width: 100%;
          }
  
          .ExternalClass {
              width: 100%;
          }
  
          .ExternalClass * {
              line-height: 100%;
          }
  
          body {
              margin: 0;
              padding: 0;
              -webkit-text-size-adjust: 100%;
              -ms-text-size-adjust: 100%;
          }
  
          table,
          td {
              border-collapse: collapse;
              mso-table-lspace: 0pt;
              mso-table-rspace: 0pt;
          }
  
          img {
              border: 0;
              height: auto;
              line-height: 100%;
              outline: none;
              text-decoration: none;
              -ms-interpolation-mode: bicubic;
          }
  
          p {
              display: block;
              margin: 13px 0;
          }
      </style>
      <!--[if !mso]><!-->
      <style type="text/css">
          @media only screen and (max-width:480px) {
              @-ms-viewport {
                  width: 320px;
              }
              @viewport {
                  width: 320px;
              }
          }
      </style>
      <!--<![endif]-->
      <!--[if mso]>
          <xml>
          <o:OfficeDocumentSettings>
            <o:AllowPNG/>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
          </xml>
          <![endif]-->
      <!--[if lte mso 11]>
          <style type="text/css">
            .outlook-group-fix { width:100% !important; }
          </style>
          <![endif]-->
  
  
      <style type="text/css">
          @media only screen and (min-width:480px) {
              .mj-column-per-100 {
                  width: 100% !important;
              }
          }
      </style>
  
  
      <style type="text/css">
      </style>
  
  </head>
  
  <body style="background-color:#f9f9f9;">
  
  
      <div style="background-color:#f9f9f9;">
  
  
          <!--[if mso | IE]>
        <table
           align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"
        >
          <tr>
            <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
        <![endif]-->
  
  
          <div style="background:#f9f9f9;background-color:#f9f9f9;Margin:0px auto;max-width:600px;">
  
              <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9f9f9;background-color:#f9f9f9;width:100%;">
                  <tbody>
                      <tr>
                          <td style="border-bottom:#333957 solid 5px;direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top;">
                              <!--[if mso | IE]>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  
          <tr>
        
          </tr>
        
                    </table>
                  <![endif]-->
                          </td>
                      </tr>
                  </tbody>
              </table>
  
          </div>
  
  
          <!--[if mso | IE]>
            </td>
          </tr>
        </table>
        
        <table
           align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"
        >
          <tr>
            <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
        <![endif]-->
  
  
          <div style="background:#fff;background-color:#fff;Margin:0px auto;max-width:600px;">
  
              <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;background-color:#fff;width:100%;">
                  <tbody>
                      <tr>
                          <td style="border:#dddddd solid 1px;border-top:0px;direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top;">
                              <!--[if mso | IE]>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  
          <tr>
        
              <td
                 style="vertical-align:bottom;width:600px;"
              >
            <![endif]-->
  
                              <div class="mj-column-per-100 outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:bottom;width:100%;">
  
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:bottom;" width="100%">
  
                                      <tr>
                                          <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
  
                                              <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0px;">
                                                  <tbody>
                                                      <tr>
                                                          <td style="width:64px;">
  
                                                              <img height="auto" src="https://i.imgur.com/YW3QjB3.jpeg" style="border:0;display:block;outline:none;text-decoration:none;width:100%;" width="64" />
  
                                                          </td>
                                                      </tr>
                                                  </tbody>
                                              </table>
  
                                          </td>
                                      </tr>
  
                                      <tr>
                                          <td align="center" style="font-size:0px;padding:10px 25px;padding-bottom:40px;word-break:break-word;">
  
                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:28px;font-weight:bold;line-height:1;text-align:center;color:#555;">
                                                  New login detected
                                              </div>
  
                                          </td>
                                      </tr>
  
                                      <tr>
                                          <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
  
                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:22px;text-align:left;color:#555;">
                                                  Hi ${user.username}!<br></br>
                                                  We just noticed a new sign-in to your account and wanted to make sure it was you. Here are the details of the access:
                                              </div>
                                              
                                              <div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 22px; text-align: left; color: #0056b3;">
                                              <br></br>
                                              - IP address: ${ip}
                                          </div>
                                          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 22px; text-align: left; color: #0056b3;">
                                              - Device: ${userAgent.device}
                                          </div>
                                          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 22px; text-align: left; color: #0056b3;">
                                              - Browser: ${userAgent.browser}
                                          </div>
                                          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 22px; text-align: left; color: #0056b3;">
                                              - Operating System: ${userAgent.os}
                                          </div>                                          

                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:22px;text-align:left;color:#555;">
                                              <br></br>
                                              If this was you, awesome! Carry on and enjoy!
                                              <br></br>
                                              If this wasn’t you, awesome! You just got hacked! 😲 But no worries, we’ve got you covered:
                                              <br></br>
                                              
                                          </div>
                                              
                                          </td>
                                      </tr>
                                      <tr>
                                      <td align="center" style="font-size:0px; padding:10px 25px; padding-bottom:40px; word-break:break-word;">
                                        <div style="font-family:'Helvetica Neue', Arial, sans-serif; font-size:16px; line-height:22px; text-align:center; color:#555;">
                                          <!-- Styling the anchor tag to look like a button -->
                                          <a href="https://www.codeklab.com/reset" 
                                             style="background-color:#2F67F6; color:#ffffff; padding:10px 20px; border-radius:5px; text-decoration:none; font-weight:bold; display:inline-block;">
                                             Reset Password
                                          </a>
                                        </div>
                                      </td>
                                    </tr>                                    
  
                                      <tr>
                                          <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
  
                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:20px;text-align:left;color:#525252;">
                                                  Best regards,<br><br> Yousif Dhrgam<br>Codek lab , CEO and Founder<br>
                                                  <a href="https://www.codeklab.com/course" style="color:#2F67F6">codeklab.com</a>
                                              </div>
  
                                          </td>
                                      </tr>
  
                                  </table>
  
                              </div>
  
                              <!--[if mso | IE]>
              </td>
            
          </tr>
        
                    </table>
                  <![endif]-->
                          </td>
                      </tr>
                  </tbody>
              </table>
  
          </div>
  
  
          <!--[if mso | IE]>
            </td>
          </tr>
        </table>
        
        <table
           align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"
        >
          <tr>
            <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
        <![endif]-->
  
  
          <div style="Margin:0px auto;max-width:600px;">
  
              <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                  <tbody>
                      <tr>
                          <td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top;">
                              <!--[if mso | IE]>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  
          <tr>
        
              <td
                 style="vertical-align:bottom;width:600px;"
              >
            <![endif]-->
  
                              <div class="mj-column-per-100 outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:bottom;width:100%;">
  
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                      <tbody>
                                          <tr>
                                              <td style="vertical-align:bottom;padding:0;">
  
                                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  
                                                      <tr>
                                                          <td align="center" style="font-size:0px;padding:0;word-break:break-word;">
  
                                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:300;line-height:1;text-align:center;color:#575757;">
                                                                  Some Firm Ltd, 35 Avenue. City 10115, USA
                                                              </div>
  
                                                          </td>
                                                      </tr>
  
                                                      <tr>
                                                          <td align="center" style="font-size:0px;padding:10px;word-break:break-word;">
  
                                                              <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:300;line-height:1;text-align:center;color:#575757;">
                                                                  <a href="" style="color:#575757">Unsubscribe</a> from our emails
                                                              </div>
  
                                                          </td>
                                                      </tr>
  
                                                  </table>
  
                                              </td>
                                          </tr>
                                      </tbody>
                                  </table>
  
                              </div>
  
                              <!--[if mso | IE]>
              </td>
            
          </tr>
        
                    </table>
                  <![endif]-->
                          </td>
                      </tr>
                  </tbody>
              </table>
  
          </div>
  
  
          <!--[if mso | IE]>
            </td>
          </tr>
        </table>
        <![endif]-->
  
  
      </div>
  
  </body>
  
  </html>`;
  await sendEmail({ toUser: user, subject, htmlBody });
};

// Function to send a login notification email with minimal content
const sendResetNotificationEmail = async (user, link) => {
    const subject = 'Reset Password';
    const htmlBody = `
    <!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
    <title>

    </title>
    <!--[if !mso]><!-- -->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style type="text/css">
        #outlook a {
            padding: 0;
        }

        .ReadMsgBody {
            width: 100%;
        }

        .ExternalClass {
            width: 100%;
        }

        .ExternalClass * {
            line-height: 100%;
        }

        body {
            margin: 0;
            padding: 0;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }

        table,
        td {
            border-collapse: collapse;
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }

        img {
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
            -ms-interpolation-mode: bicubic;
        }

        p {
            display: block;
            margin: 13px 0;
        }
    </style>
    <!--[if !mso]><!-->
    <style type="text/css">
        @media only screen and (max-width:480px) {
            @-ms-viewport {
                width: 320px;
            }
            @viewport {
                width: 320px;
            }
        }
    </style>
    <!--<![endif]-->
    <!--[if mso]>
        <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
        </xml>
        <![endif]-->
    <!--[if lte mso 11]>
        <style type="text/css">
          .outlook-group-fix { width:100% !important; }
        </style>
        <![endif]-->


    <style type="text/css">
        @media only screen and (min-width:480px) {
            .mj-column-per-100 {
                width: 100% !important;
            }
        }
    </style>


    <style type="text/css">
    </style>

</head>

<body style="background-color:#f9f9f9;">


    <div style="background-color:#f9f9f9;">


        <!--[if mso | IE]>
      <table
         align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"
      >
        <tr>
          <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
      <![endif]-->


        <div style="background:#f9f9f9;background-color:#f9f9f9;Margin:0px auto;max-width:600px;">

            <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9f9f9;background-color:#f9f9f9;width:100%;">
                <tbody>
                    <tr>
                        <td style="border-bottom:#333957 solid 5px;direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top;">
                            <!--[if mso | IE]>
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                
        <tr>
      
        </tr>
      
                  </table>
                <![endif]-->
                        </td>
                    </tr>
                </tbody>
            </table>

        </div>


        <!--[if mso | IE]>
          </td>
        </tr>
      </table>
      
      <table
         align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"
      >
        <tr>
          <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
      <![endif]-->


        <div style="background:#fff;background-color:#fff;Margin:0px auto;max-width:600px;">

            <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;background-color:#fff;width:100%;">
                <tbody>
                    <tr>
                        <td style="border:#dddddd solid 1px;border-top:0px;direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top;">
                            <!--[if mso | IE]>
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                
        <tr>
      
            <td
               style="vertical-align:bottom;width:600px;"
            >
          <![endif]-->

                            <div class="mj-column-per-100 outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:bottom;width:100%;">

                                <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:bottom;" width="100%">

                                    <tr>
                                        <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">

                                            <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0px;">
                                                <tbody>
                                                    <tr>
                                                        <td style="width:64px;">

                                                            <img height="auto" src="https://i.imgur.com/YW3QjB3.jpeg" style="border:0;display:block;outline:none;text-decoration:none;width:100%;" width="64" />

                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>

                                        </td>
                                    </tr>

                                    <tr>
                                        <td align="center" style="font-size:0px;padding:10px 25px;padding-bottom:40px;word-break:break-word;">

                                            <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:38px;font-weight:bold;line-height:1;text-align:center;color:#555;">
                                                Oops!
                                            </div>

                                        </td>
                                    </tr>

                                    <tr>
                                        <td align="center" style="font-size:0px;padding:10px 25px;padding-bottom:40px;word-break:break-word;">

                                            <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:18px;line-height:1;text-align:center;color:#555;">
                                                Hello ${user.username}, It seems that you’ve forgotten your password.
                                            </div>

                                        </td>
                                    </tr>

                                    <tr>
                                        <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">

                                            <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0px;">
                                                <tbody>
                                                    <tr>
                                                        <td style="width:128px;">

                                                            <img height="auto" src="https://i.imgur.com/247tYSw.png" style="border:0;display:block;outline:none;text-decoration:none;width:100%;" width="128" />

                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>

                                        </td>
                                    </tr>

                                    <tr>
                                        <td align="center" style="font-size:0px;padding:10px 25px;padding-top:30px;padding-bottom:50px;word-break:break-word;">

                                            <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;line-height:100%;">
                                            <tr>
                                            <td align="center" style="font-size:0px;padding:10px 25px;padding-top:30px;padding-bottom:40px;word-break:break-word;">
                                                <a href="https://www.codeklab.com/verifyreset?token=${link}" style="background-color:#2F67F6;border:none;border-radius:3px;color:#ffffff;display:inline-block;font-family:'Helvetica Neue', Arial, sans-serif;font-size:15px;font-weight:normal;line-height:120%;text-align:center;text-decoration:none;width:auto;padding:15px 25px;margin:0 auto;text-transform:none;">
                                                    Reset Password
                                                </a>
                                            </td>
                                        </tr>                                        
                                            </table>

                                        </td>
                                    </tr>

                                    <tr>
                                        <td align="center" style="font-size:0px;padding:10px 25px;padding-bottom:40px;word-break:break-word;">

                                            <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:20px;text-align:center;color:#7F8FA4;">
                                                If you did not make this request, just ignore this email. Otherwise please click the button above to reset your password.
                                            </div>

                                        </td>
                                    </tr>

                                </table>

                            </div>

                            <!--[if mso | IE]>
            </td>
          
        </tr>
      
                  </table>
                <![endif]-->
                        </td>
                    </tr>
                </tbody>
            </table>

        </div>


        <!--[if mso | IE]>
          </td>
        </tr>
      </table>
      
      <table
         align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"
      >
        <tr>
          <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
      <![endif]-->


        <div style="Margin:0px auto;max-width:600px;">

            <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                <tbody>
                    <tr>
                        <td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top;">
                            <!--[if mso | IE]>
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                
        <tr>
      
            <td
               style="vertical-align:bottom;width:600px;"
            >
          <![endif]-->

                            <div class="mj-column-per-100 outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:bottom;width:100%;">

                                <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                    <tbody>
                                        <tr>
                                            <td style="vertical-align:bottom;padding:0;">

                                                <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">

                                                    <tr>
                                                        <td align="center" style="font-size:0px;padding:0;word-break:break-word;">

                                                            <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:300;line-height:1;text-align:center;color:#575757;">
                                                                Some Firm Ltd, 35 Avenue. City 10115, USA
                                                            </div>

                                                        </td>
                                                    </tr>

                                                    <tr>
                                                        <td align="center" style="font-size:0px;padding:10px;word-break:break-word;">

                                                            <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:300;line-height:1;text-align:center;color:#575757;">
                                                                <a href="" style="color:#575757">Unsubscribe</a> from our emails
                                                            </div>

                                                        </td>
                                                    </tr>

                                                </table>

                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                            </div>

                            <!--[if mso | IE]>
            </td>
          
        </tr>
      
                  </table>
                <![endif]-->
                        </td>
                    </tr>
                </tbody>
            </table>

        </div>


        <!--[if mso | IE]>
          </td>
        </tr>
      </table>
      <![endif]-->


    </div>

</body>

</html>
    `;
    await sendEmail({ toUser: user, subject, htmlBody });
  };

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendLoginNotificationEmail,
  VerificationEmail,
  sendResetNotificationEmail
};
