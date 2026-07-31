#!/usr/bin/env node
/**
 * B站 Cookie 本地导入工具
 *
 * 用法：pnpm grab-bili-cookie
 *
 * 浏览器登录完成后，Playwright 从浏览器上下文读取 Cookie，并通过 stdin
 * 交给本机的 `pnpm bili:save`。Cookie、加密密钥和密文均不会走 HTTP、
 * 不会打印到终端，也不会写入日志。
 */

import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const REQUIRED_COOKIE_NAMES = ['SESSDATA']
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

async function main() {
  console.log('正在启动浏览器…')
  const browser = await chromium.launch({ headless: false })

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'zh-CN',
    })
    const page = await context.newPage()

    console.log('正在打开 B站登录页…')
    await page.goto('https://passport.bilibili.com/login', { waitUntil: 'domcontentloaded' })
    console.log('请在打开的浏览器中完成登录和验证；工具会检测 SESSDATA。')

    const cookieHeader = await waitForCookieHeader(context)
    console.log(`已从浏览器上下文获取 ${cookieHeader.split('; ').length} 个 Cookie，正在按 v2 格式本地加密保存…`)
    await saveLocally(cookieHeader)
    console.log('Cookie 已按 bili-cookie-v2 格式保存。请回到后台点击“验证凭证”确认登录状态。')
  } finally {
    await browser.close()
  }
}

async function waitForCookieHeader(context) {
  const deadline = Date.now() + 5 * 60 * 1000
  while (Date.now() < deadline) {
    const cookies = await context.cookies(['https://www.bilibili.com', 'https://passport.bilibili.com'])
    const byName = new Map(cookies.map((cookie) => [cookie.name, cookie.value]))
    if (REQUIRED_COOKIE_NAMES.every((name) => Boolean(byName.get(name)))) {
      return Array.from(byName, ([name, value]) => `${name}=${value}`).join('; ')
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error('五分钟内未检测到 SESSDATA；请确认 B站登录已成功。')
}

function saveLocally(cookieHeader) {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpmCommand, ['bili:save'], {
      cwd: process.cwd(),
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let output = ''
    let errorOutput = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { errorOutput += chunk })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) return resolve()
      reject(new Error((errorOutput || output || `本地保存进程退出，状态码 ${code}`).trim()))
    })
    child.stdin.end(cookieHeader)
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
