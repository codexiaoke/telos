#!/usr/bin/env node
import { runContinuityBench } from './index.js'

const parityVerified = process.argv.includes('--dsh-parity-pass')
const report = runContinuityBench({ dshParityVerified: parityVerified })
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (report.status !== 'PASS') process.exitCode = 1
