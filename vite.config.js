import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import nodemailer from 'nodemailer'

import { cloudflare } from "@cloudflare/vite-plugin";

function inviteHandler(env) {
  return async (req, res, next) => {
    if (req.method !== 'POST') return next()
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', async () => {
      res.setHeader('Content-Type', 'application/json')
      try {
        const { email, teamName, inviterName, role = 'Member' } = JSON.parse(body || '{}')
        if (!/^\S+@\S+\.\S+$/.test(email || '') || !teamName || !inviterName) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'A valid email, team name, and inviter name are required.' }))
          return
        }
        const required = ['TADA_SMTP_HOST', 'TADA_SMTP_USER', 'TADA_SMTP_PASS']
        const missing = required.filter((key) => !env[key])
        if (missing.length) {
          res.statusCode = 503
          res.end(JSON.stringify({ error: `Email delivery is not configured. Missing: ${missing.join(', ')}` }))
          return
        }
        const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
        const transporter = nodemailer.createTransport({
          host: env.TADA_SMTP_HOST,
          port: Number(env.TADA_SMTP_PORT || 587),
          secure: Number(env.TADA_SMTP_PORT || 587) === 465,
          auth: { user: env.TADA_SMTP_USER, pass: env.TADA_SMTP_PASS },
        })
        const appUrl = env.TADA_APP_URL || 'http://127.0.0.1:5173'
        const info = await transporter.sendMail({
          from: env.TADA_SMTP_FROM || `Tada <${env.TADA_SMTP_USER}>`,
          to: email,
          subject: `${inviterName} invited you to ${teamName} on Tada`,
          text: `${inviterName} invited you to join ${teamName} as ${role} on Tada. Open ${appUrl} to get started.`,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#191817"><div style="display:inline-block;background:#ff7058;color:white;border:2px solid #191817;border-radius:12px;padding:10px 14px;font-weight:800;box-shadow:-4px 4px 0 #191817">tada!</div><h1 style="font-size:34px;margin:30px 0 12px">You’re invited to ${escape(teamName)}.</h1><p style="line-height:1.6;color:#625c54"><strong>${escape(inviterName)}</strong> invited you to join as <strong>${escape(role)}</strong>. See what’s due today and tomorrow, collaborate on projects, and keep your team moving.</p><a href="${escape(appUrl)}" style="display:inline-block;margin-top:20px;background:#191817;color:white;text-decoration:none;border-radius:10px;padding:13px 20px;font-weight:700">Open Tada</a><p style="font-size:11px;color:#8a847b;margin-top:35px">Sent by Tada on behalf of ${escape(inviterName)}.</p></div>`,
        })
        res.statusCode = 200
        res.end(JSON.stringify({ sent: true, messageId: info.messageId }))
      } catch (error) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: error.message || 'Could not send invitation.' }))
      }
    })
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const handler = inviteHandler(env)
  return {
    plugins: [react(), {
      name: 'tada-invite-api',
      configureServer(server) { server.middlewares.use('/api/invite', handler) },
      configurePreviewServer(server) { server.middlewares.use('/api/invite', handler) },
    }, cloudflare()],
  };
})