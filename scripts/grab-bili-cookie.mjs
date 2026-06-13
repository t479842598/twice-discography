#!/usr/bin/env node
/**
 * B站 Cookie 自动获取工具
 *
 * 用法：
 *   node scripts/grab-bili-cookie.mjs [--backend http://localhost:3000]
 *
 * 流程：
 *   1. 打开 B站登录页
 *   2. 你手动输入账号密码 + 完成验证码
 *   3. 登录成功后自动提取 Cookie
 *   4. 通过内网接口直接保存到后端数据库
 */

import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

// Read BILI_CREDENTIAL_ENCRYPTION_KEY from .env
function readEnvKey() {
  try {
    const envPath = resolve(rootDir, '.env')
    const content = readFileSync(envPath, 'utf8')
    const match = content.match(/^BILI_CREDENTIAL_ENCRYPTION_KEY\s*=\s*(.+)$/m)
    return match?.[1]?.trim() ?? null
  } catch {
    return null
  }
}

async function main() {
  const args = process.argv.slice(2)
  let backendUrl = 'http://localhost:3000'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--backend' && args[i + 1]) {
      backendUrl = args[i + 1].replace(/\/+$/, '')
      i++
    }
  }

  const encryptionKey = readEnvKey()
  if (!encryptionKey) {
    console.error('❌ 未在 .env 中找到 BILI_CREDENTIAL_ENCRYPTION_KEY，请先配置。')
    process.exit(1)
  }

  console.log('🚀 正在启动浏览器...')
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'zh-CN',
  })

  const page = await context.newPage()

  // Navigate to B站 login page
  console.log('🌐 打开 B站登录页...')
  await page.goto('https://passport.bilibili.com/login', { waitUntil: 'domcontentloaded' })

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('👆 请在浏览器中完成登录（输入账号密码 + 验证码）')
  console.log('   脚本会自动检测登录状态，无需手动干预。')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  // Wait for successful login by detecting cookies or page redirect
  try {
    await page.waitForFunction(
      () => {
        const cookies = document.cookie
        return (
          cookies.includes('SESSDATA=') &&
          cookies.includes('bili_jct=') &&
          (document.title.includes('Bilibili') || document.URL.includes('bilibili.com'))
        )
      },
      { timeout: 300_000 }, // 5 minutes
      // Poll every second to avoid consuming CPU
    )
  } catch {
    // Even if waitForFunction times out, try to get whatever cookies we have
  }

  // Small delay to ensure all cookies are set
  await page.waitForTimeout(2000)

  // Extract cookies from browser context
  const playwrightCookies = await context.cookies('https://bilibili.com')
  const cookieStr = playwrightCookies
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')

  if (!cookieStr || !cookieStr.includes('SESSDATA')) {
    console.log('')
    console.log('⚠️  未检测到有效的 B站 Cookie。请确认已成功登录。')
    console.log('   1. 关闭此窗口')
    console.log('   2. 手动在 B站复制 Cookie')
    console.log('   3. 粘贴到后台 Admin → B站设置 中')
    await browser.close()
    process.exit(1)
  }

  console.log('✅ Cookie 已提取，长度:', cookieStr.length, '字符')

  // Save to backend
  console.log('💾 正在保存到后端...')
  try {
    const response = await fetch(`${backendUrl}/api/admin/bili-credential/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie: cookieStr, key: encryptionKey }),
    })

    const result = await response.json()
    if (response.ok) {
      console.log('✅ Cookie 已自动保存到后端数据库！')
      console.log('   验证状态:', result.lastVerifyStatus ?? '未验证')
    } else {
      console.log('❌ 保存失败:', result.error, result.message)
    }
  } catch (err) {
    console.log('❌ 无法连接到后端:', err.message)
    console.log('   后端地址:', backendUrl)
    console.log('   请确认后端已启动后重试。')
  }

  await browser.close()
  console.log('👋 完成。浏览器已关闭。')
}

main().catch((err) => {
  console.error('❌ 脚本异常:', err.message)
  process.exit(1)
})
