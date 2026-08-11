/**
 * 腾讯云开发（CloudBase）静态托管部署脚本
 * 将 dist/ 目录上传到云开发静态托管，作为客户访问的正式网址
 * 使用: npm run deploy-tcb
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, dirname } from 'path'
import { fileURLToPath } from 'url'
import COS from 'cos-nodejs-sdk-v5'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')
const DIST_DIR = join(PROJECT_ROOT, 'dist')

/** 读取 .env 配置 */
function loadEnv() {
  const env = {}
  const content = readFileSync(join(PROJECT_ROOT, '.env'), 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

const env = loadEnv()
const SECRET_ID = env.COS_SECRET_ID
const SECRET_KEY = env.COS_SECRET_KEY
const BUCKET = env.TCB_BUCKET
const REGION = env.TCB_REGION
const WEBSITE_URL = env.TCB_URL

if (!SECRET_ID || !SECRET_KEY || !BUCKET || !REGION) {
  console.error('❌ .env 配置不完整，请检查 COS_SECRET_ID / COS_SECRET_KEY / TCB_BUCKET / TCB_REGION')
  process.exit(1)
}

const cos = new COS({ SecretId: SECRET_ID, SecretKey: SECRET_KEY })

/** 递归获取目录下所有文件 */
function getAllFiles(dir) {
  const results = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      results.push(...getAllFiles(full))
    } else {
      results.push(full)
    }
  }
  return results
}

async function main() {
  console.log('='.repeat(50))
  console.log('☁️  腾讯云开发（CloudBase）静态托管部署')
  console.log('='.repeat(50))

  // 1. 清空托管桶旧文件（保持与本地一致）
  console.log('\n🗑️  清空托管旧文件...')
  await new Promise((resolve, reject) => {
    cos.getBucket({ Bucket: BUCKET, Region: REGION }, (err, data) => {
      if (err) return reject(err)
      const keys = (data.Contents || []).map(o => o.Key)
      if (keys.length === 0) return resolve()
      cos.deleteMultipleObject({
        Bucket: BUCKET,
        Region: REGION,
        Objects: keys.map(k => ({ Key: k })),
      }, (err2) => (err2 ? reject(err2) : resolve()))
    })
  })

  // 2. 上传所有文件
  const files = getAllFiles(DIST_DIR)
  console.log(`📤 上传 ${files.length} 个文件...`)
  let uploaded = 0
  for (const file of files) {
    const key = relative(DIST_DIR, file).split('\\').join('/')
    await new Promise((resolve, reject) => {
      cos.putObject({
        Bucket: BUCKET,
        Region: REGION,
        Key: key,
        Body: readFileSync(file),
        Headers: {
          'Content-Disposition': 'inline',
        },
      }, (err) => {
        if (err) return reject(err)
        uploaded++
        if (uploaded % 10 === 0) console.log(`  已上传 ${uploaded}/${files.length}`)
        resolve()
      })
    })
  }

  console.log(`\n✅ 全部上传完成！（${uploaded} 个文件）`)
  console.log(`🌐 客户访问网址: ${WEBSITE_URL}`)
}

main().catch(err => {
  console.error('\n❌ 部署失败:', err.message || err)
  process.exit(1)
})
